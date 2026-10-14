// ============================================================
// ClinicalReportModal.js — Reporte Clínico del Auditor al Docente
// Permite al auditor evaluar el desempeño del estudiante en el hospital
// mediante los 10 criterios de la rúbrica oficial seleccionados para la práctica.
// NOTA: Esta evaluación NO es la nota final; es una guía confidencial
// que solo puede ver el docente para orientar su calificación oficial.
// ============================================================
import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, X, ShieldCheck, Info, Sparkles } from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { notifyDataChanged } from "../../utils/dataSync";
import { RubricEvaluationInput } from "../Shared/PracticeRubric";
import {
  parseRubricCriteriaIds,
  calculateRubricTotal,
  getPerformanceConcept,
  DEFAULT_RUBRIC_CRITERIA_IDS,
} from "../../utils/evaluationRubric";

const ClinicalReportModal = ({
  isOpen,
  onClose,
  student,
  practice,
  onSuccess,
}) => {
  const activeCriteriaIds = useMemo(() => {
    const ids = parseRubricCriteriaIds(practice?.rubrica_criterios);
    return ids.length === 10 ? ids : DEFAULT_RUBRIC_CRITERIA_IDS;
  }, [practice?.rubrica_criterios]);

  const [criteriosRubrica, setCriteriosRubrica] = useState({});
  const [observaciones, setObservaciones] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Conteo estricto de criterios evaluados
  const scoredCriteriaCount = useMemo(() => {
    return activeCriteriaIds.filter(
      (id) => typeof criteriosRubrica[id] === "number" && !isNaN(criteriosRubrica[id])
    ).length;
  }, [criteriosRubrica, activeCriteriaIds]);

  const isAllCriteriaScored = activeCriteriaIds.length > 0 && scoredCriteriaCount === activeCriteriaIds.length;

  // Calcular nota sugerida y concepto a partir de la rúbrica oficial
  const notaSugerida = useMemo(
    () => calculateRubricTotal(criteriosRubrica, activeCriteriaIds),
    [criteriosRubrica, activeCriteriaIds]
  );

  const conceptoAutomatico = useMemo(
    () => getPerformanceConcept(notaSugerida).label,
    [notaSugerida]
  );

  // Cargar reporte preexistente si lo hubiera
  useEffect(() => {
    if (!isOpen || !student || !practice) return;

    let isMounted = true;
    const loadReport = async () => {
      setIsLoadingExisting(true);
      setFeedbackMsg(null);

      // Si el estudiante ya trae criterios en el objeto props, usarlos de entrada
      let initialCriteria = null;
      if (student.criterios_rubrica) {
        try {
          initialCriteria =
            typeof student.criterios_rubrica === "string"
              ? JSON.parse(student.criterios_rubrica)
              : student.criterios_rubrica;
        } catch (e) {
          console.warn("Error parsing student.criterios_rubrica:", e);
        }
      }

      if (initialCriteria && Object.keys(initialCriteria).length > 0) {
        setCriteriosRubrica(initialCriteria);
        if (student.observaciones || student.report_observaciones) {
          setObservaciones(student.observaciones || student.report_observaciones);
        }
      }

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/auditor/practices/${practice.id}/students/${student.cedula}/report`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.report && isMounted) {
            let parsedCriteria = null;
            if (data.report.criterios_rubrica) {
              try {
                parsedCriteria =
                  typeof data.report.criterios_rubrica === "string"
                    ? JSON.parse(data.report.criterios_rubrica)
                    : data.report.criterios_rubrica;
              } catch (e) {
                console.warn("Error parsing criterios_rubrica:", e);
              }
            }

            if (parsedCriteria && Object.keys(parsedCriteria).length > 0) {
              setCriteriosRubrica(parsedCriteria);
            }

            setObservaciones(data.report.observaciones || "");
          } else if (isMounted && (!initialCriteria || Object.keys(initialCriteria).length === 0)) {
            // Reporte completamente nuevo: iniciar vacío
            setCriteriosRubrica({});
            setObservaciones("");
          }
        }
      } catch (e) {
        console.warn("No se pudo cargar reporte previo:", e);
      } finally {
        if (isMounted) setIsLoadingExisting(false);
      }
    };

    loadReport();
    return () => {
      isMounted = false;
    };
  }, [isOpen, student, practice, activeCriteriaIds]);

  if (!isOpen || !student || !practice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAllCriteriaScored) {
      setFeedbackMsg({
        type: "error",
        text: `Debes calificar los ${activeCriteriaIds.length} ítems de la rúbrica antes de guardar (llevas ${scoredCriteriaCount}/${activeCriteriaIds.length}).`,
      });
      return;
    }

    if (!observaciones.trim()) {
      setFeedbackMsg({
        type: "error",
        text: "Por favor describe el concepto clínico asistencial y recomendaciones para el docente.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const payload = {
        criterios_rubrica: criteriosRubrica,
        nota_sugerida: notaSugerida,
        concepto: conceptoAutomatico,
        observaciones: observaciones.trim(),
      };

      const res = await fetch(
        `${BACKEND_URL}/api/auditor/practices/${practice.id}/students/${student.cedula}/report`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al enviar reporte.");
      }

      setFeedbackMsg({
        type: "success",
        text: data.message,
      });

      notifyDataChanged("practices", "update");
      notifyDataChanged("evaluations", "update");

      if (onSuccess) {
        onSuccess({
          studentCedula: student.cedula,
          practiceId: practice.id,
          nota_sugerida: notaSugerida,
          concepto: conceptoAutomatico,
          criterios_rubrica: criteriosRubrica,
        });
      }

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error("Error al enviar reporte clínico:", err);
      setFeedbackMsg({
        type: "error",
        text: err.message || "Error al conectar con el servidor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl my-auto max-h-[92vh] flex flex-col overflow-hidden transform transition-all">
        {/* Cabecera Fija */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
                Evaluación Formativa en Sitio del Auditor
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Guía Docente
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Calificación orientadora basada en los 10 criterios oficiales de la práctica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario envolvente para sticky footer */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Contenido con scroll interno */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {/* Tarjeta de Información de Práctica y Confidencialidad */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-850 rounded-2xl border border-gray-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-gray-400 dark:text-zinc-500 block text-[11px]">Estudiante Evaluado:</span>
                <span className="font-bold text-gray-900 dark:text-white text-sm">
                  {student.fullName || `${student.nombre} ${student.apellidos}`}
                </span>
                <span className="text-gray-500 dark:text-zinc-400 block mt-0.5">
                  C.C. {student.cedula} {student.codigo ? `· Cód: ${student.codigo}` : ""}
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-gray-400 dark:text-zinc-500 block text-[11px]">Docente a Quien se Reporta:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 block">
                  {practice.docente_nombre || "Docente a cargo"}
                </span>
                <span className="text-gray-500 dark:text-zinc-400 block mt-0.5">
                  {practice.titulo} ({practice.servicio_nombre || "Servicio Clínico"})
                </span>
              </div>
            </div>

            {/* Aviso Institucional de Privacidad de la Nota del Auditor */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Aviso de Confidencialidad Asistencial:</strong> Esta evaluación emitida por auditoría{" "}
                <strong>NO es la nota final del estudiante</strong>. Es un informe formativo en sitio que{" "}
                <strong>solo el docente tutor puede ver</strong> para servirle de guía al calificar. El estudiante{" "}
                <strong>no tiene acceso</strong> a esta nota sugerida.
              </div>
            </div>

            {feedbackMsg && (
              <div
                className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                  feedbackMsg.type === "success"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                }`}
              >
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            {isLoadingExisting && (
              <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-2xl text-xs flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                <span>Cargando evaluación previa del estudiante...</span>
              </div>
            )}

            {/* Componente Oficial de los 10 Criterios de la Rúbrica */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-black text-gray-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Rúbrica Institucional ({activeCriteriaIds.length} Criterios Configurados)
                </span>
                <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                  Escala de Siempre (+0.5) a No cumple (+0.1)
                </span>
              </div>

              <RubricEvaluationInput
                rubricaCriterios={practice?.rubrica_criterios}
                scores={criteriosRubrica}
                onChange={setCriteriosRubrica}
                isAuditor={true}
              />
            </div>

            {/* Observaciones y Recomendaciones */}
            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Observaciones Asistenciales y Recomendaciones para el Docente *
              </label>
              <textarea
                rows={3}
                required
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Escribe recomendaciones técnicas, desempeño asistencial en el hospital, procedimientos realizados o aspectos que requieran refuerzo académico por parte del docente..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Pie Fijo con Progreso de Calificación y Acciones */}
          <div className="px-5 sm:px-6 py-3.5 bg-gray-50/90 dark:bg-zinc-950/90 border-t border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div>
              {isAllCriteriaScored ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{activeCriteriaIds.length} de {activeCriteriaIds.length} ítems calificados · Sugerida: {notaSugerida.toFixed(1)} ({conceptoAutomatico})</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Faltan {activeCriteriaIds.length - scoredCriteriaCount} ítems por calificar ({scoredCriteriaCount}/{activeCriteriaIds.length})</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!isAllCriteriaScored || isSubmitting}
                className={`px-5 py-2.5 text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md ${
                  isAllCriteriaScored && !isSubmitting
                    ? "bg-amber-500 hover:bg-amber-600 text-gray-900 shadow-amber-500/20"
                    : "bg-gray-300 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 cursor-not-allowed border border-gray-200 dark:border-zinc-700"
                }`}
                title={!isAllCriteriaScored ? `Debes calificar todos los ${activeCriteriaIds.length} criterios para guardar` : ""}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                    <span>Enviando al Docente...</span>
                  </>
                ) : !isAllCriteriaScored ? (
                  <>
                    <span>Califica todos los ítems ({scoredCriteriaCount}/{activeCriteriaIds.length})</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Reporte Guía ({notaSugerida.toFixed(1)} / 5.0)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export default ClinicalReportModal;
