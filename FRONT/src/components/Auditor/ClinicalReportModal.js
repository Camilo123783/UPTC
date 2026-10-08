// ============================================================
// ClinicalReportModal.js — Reporte Clínico del Auditor al Docente
// Permite al auditor evaluar el desempeño del estudiante en el hospital
// y enviar un informe con nota sugerida e ítems clínicos al docente
// ============================================================
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, X } from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { notifyDataChanged } from "../../utils/dataSync";

const CRITERIA_ITEMS = [
  {
    key: "conocimiento_teorico",
    label: "Conocimiento Teórico Aplicado",
    desc: "Fundamentación científica, fisiopatología y justificación de decisiones en el servicio.",
  },
  {
    key: "habilidades_practicas",
    label: "Habilidades Prácticas y Procedimientos",
    desc: "Destreza técnica, aplicación de protocolos de bioseguridad y ejecución clínica.",
  },
  {
    key: "actitud_etica",
    label: "Actitud, Ética y Profesionalismo",
    desc: "Respeto a normas institucionales, presentación personal y trato humanizado.",
  },
  {
    key: "comunicacion_equipo",
    label: "Comunicación con Paciente y Equipo de Salud",
    desc: "Empatía con pacientes, articulación con enfermería, médicos y personal asistencial.",
  },
  {
    key: "puntualidad_asistencia",
    label: "Puntualidad, Disciplina y Asistencia",
    desc: "Cumplimiento estricto de turnos, entregas de guardia y disposición en el servicio.",
  },
];

const ClinicalReportModal = ({
  isOpen,
  onClose,
  student,
  practice,
  onSuccess,
}) => {
  const [scores, setScores] = useState({
    conocimiento_teorico: 4.2,
    habilidades_practicas: 4.0,
    actitud_etica: 4.8,
    comunicacion_equipo: 4.5,
    puntualidad_asistencia: 5.0,
  });

  const [observaciones, setObservaciones] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Calcular nota promedio sugerida
  const totalSum = Object.values(scores).reduce((acc, val) => acc + Number(val), 0);
  const notaSugerida = parseFloat((totalSum / CRITERIA_ITEMS.length).toFixed(1));

  const conceptoAutomatico =
    notaSugerida >= 4.5
      ? "Excelente"
      : notaSugerida >= 3.8
      ? "Favorable"
      : notaSugerida >= 3.0
      ? "En Seguimiento"
      : "Requiere Refuerzo";

  // Cargar reporte preexistente si lo hubiera
  useEffect(() => {
    if (!isOpen || !student || !practice) return;

    let isMounted = true;
    const loadReport = async () => {
      setIsLoadingExisting(true);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/auditor/practices/${practice.id}/students/${student.cedula}/report`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.report && isMounted) {
            setScores({
              conocimiento_teorico: Number(data.report.conocimiento_teorico) || 4.0,
              habilidades_practicas: Number(data.report.habilidades_practicas) || 4.0,
              actitud_etica: Number(data.report.actitud_etica) || 5.0,
              comunicacion_equipo: Number(data.report.comunicacion_equipo) || 4.0,
              puntualidad_asistencia: Number(data.report.puntualidad_asistencia) || 5.0,
            });
            setObservaciones(data.report.observaciones || "");
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
  }, [isOpen, student, practice]);

  if (!isOpen || !student || !practice) return null;

  const handleScoreChange = (key, val) => {
    setScores((prev) => ({
      ...prev,
      [key]: Math.min(5.0, Math.max(1.0, parseFloat(val) || 1.0)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!observaciones.trim()) {
      setFeedbackMsg({
        type: "error",
        text: "Por favor describe el concepto clínico y recomendaciones para el docente.",
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
        conocimiento_teorico: scores.conocimiento_teorico,
        habilidades_practicas: scores.habilidades_practicas,
        actitud_etica: scores.actitud_etica,
        comunicacion_equipo: scores.comunicacion_equipo,
        puntualidad_asistencia: scores.puntualidad_asistencia,
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
        });
      }

      setTimeout(() => {
        onClose();
      }, 1500);
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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden transform transition-all">
        {/* Cabecera */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Reporte Clínico de Auditoría para el Docente
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Apoyo a la Calificación Formativa de Práctica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumen */}
        <div className="p-6 space-y-5">
          <div className="p-4 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-gray-400 dark:text-zinc-500 block">Estudiante a Evaluar:</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {student.fullName || `${student.nombre} ${student.apellidos}`}
              </span>
              <span className="text-gray-500 dark:text-zinc-400 block mt-0.5">
                C.C. {student.cedula} {student.codigo ? `| Cód: ${student.codigo}` : ""}
              </span>
            </div>
            <div className="sm:text-right">
              <span className="text-gray-400 dark:text-zinc-500 block">Docente a Notificar:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 block">
                {practice.docente_nombre || "Docente a cargo"}
              </span>
              <span className="text-gray-500 dark:text-zinc-400 block mt-0.5">
                {practice.titulo} ({practice.servicio_nombre || "Servicio Clínico"})
              </span>
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
              <span>Cargando informe previo del estudiante...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rúbrica de Criterios Clínicos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                  Criterios de Evaluación en Sitio
                </span>
                <span className="text-xs text-gray-400 dark:text-zinc-500">
                  Escala de 1.0 (Deficiente) a 5.0 (Excelente)
                </span>
              </div>

              {CRITERIA_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="p-3.5 bg-gray-50/70 dark:bg-zinc-800/40 rounded-2xl border border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <span className="font-bold text-xs text-gray-900 dark:text-white block">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-zinc-400 block mt-0.5 leading-relaxed">
                      {item.desc}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.1"
                      value={scores[item.key]}
                      onChange={(e) => handleScoreChange(item.key, e.target.value)}
                      className="w-28 sm:w-32 accent-amber-500 cursor-pointer"
                    />
                    <span className="w-10 text-center font-bold text-sm px-2 py-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white shadow-sm">
                      {Number(scores[item.key]).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Banner de Calificación Sugerida y Concepto */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-600 dark:text-zinc-400 block uppercase tracking-wider">
                  Calificación Sugerida por Auditoría
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
                    {notaSugerida.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">/ 5.0</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-gray-600 dark:text-zinc-400 block uppercase tracking-wider">
                  Concepto Asistencial
                </span>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 ${
                    conceptoAutomatico === "Excelente"
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : conceptoAutomatico === "Favorable"
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      : "bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/30"
                  }`}
                >
                  {conceptoAutomatico}
                </span>
              </div>
            </div>

            {/* Observaciones y Recomendaciones */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Observaciones Clínicas y Recomendaciones para el Docente *
              </label>
              <textarea
                rows={3}
                required
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Escribe detalles sobre el desempeño del estudiante en turnos hospitalarios, procedimientos asistenciales destacados o áreas que requieran refuerzo académico..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition resize-none leading-relaxed"
              />
            </div>

            {/* Botones de Acción */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-gray-900 shadow-md shadow-amber-500/20 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
                    <span>Enviando al Docente...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Reporte ({notaSugerida.toFixed(1)} / 5.0)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export default ClinicalReportModal;
