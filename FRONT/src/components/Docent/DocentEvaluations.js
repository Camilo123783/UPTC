// ============================================================
// DocentEvaluations.js — Gestión de Evaluaciones del Docente
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ClipboardList,
  Edit3,
  X,
  Stethoscope,
  Zap,
  Save,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { generateCsv, generatePdf } from '../../utils/reportGenerator';
import { BACKEND_URL } from '../../config/api';
import { notifyDataChanged, useDataSync } from '../../utils/dataSync';
import toast from '../../utils/toast';
import StudentAvatar from '../Shared/StudentAvatar';
import StudentFichaModal from '../Shared/StudentFichaModal';
import { SkeletonTable } from '../Shared/Skeleton';
import { RubricEvaluationInput } from '../Shared/PracticeRubric';
import { calculateRubricTotal, parseRubricCriteriaIds } from '../../utils/evaluationRubric';

const API_BASE_URL = BACKEND_URL;

const DocentEvaluations = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fichaStudent, setFichaStudent] = useState(null);

  const fetchLiveEvaluations = async () => {
    setIsLoading(true);
    try {
      let docentCedula = null;
      try {
        const stored = sessionStorage.getItem("userData");
        if (stored) {
          const parsed = JSON.parse(stored);
          docentCedula = parsed.cedula || parsed.Cédula || null;
        }
      } catch (e) {
        console.warn("No se pudo leer sesión de docente:", e);
      }

      const url = docentCedula
        ? `${API_BASE_URL}/api/docent/students/${docentCedula}`
        : `${API_BASE_URL}/api/docent/students`;

      const res = await fetch(url);
      if (res.ok) {
        const students = await res.json();
        const mapped = students.map((st) => ({
          id: `${st.cedula}-${st.practiceId}`,
          cedula: st.cedula,
          practiceId: st.practiceId,
          student: st.fullName || `${st.name} ${st.lastName}`.trim(),
          practice: st.practiceName,
          service: st.service,
          status: st.evaluationStatus || (st.score !== null ? "Completada" : "Pendiente"),
          score: st.score !== null ? Number(st.score) : null,
          feedback: st.feedback || null,
          date: st.evaluationDate || null,
          criterios: st.criterios || {},
          rubrica_criterios: st.rubrica_criterios || [],
          auditorReport: st.auditorReport || null,
        }));
        setEvaluations(mapped);
      }
    } catch (err) {
      console.error("Error al cargar evaluaciones:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveEvaluations();
  }, []);

  useDataSync(fetchLiveEvaluations);

  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [rubricScores, setRubricScores] = useState({});
  const [overallFeedback, setOverallFeedback] = useState('');

  const activeCriteriaIds = useMemo(() => {
    return parseRubricCriteriaIds(selectedEvaluation?.rubrica_criterios);
  }, [selectedEvaluation]);

  const scoredCriteriaCount = useMemo(() => {
    return activeCriteriaIds.filter(
      (id) => rubricScores[id] !== undefined && rubricScores[id] !== null && !isNaN(Number(rubricScores[id]))
    ).length;
  }, [activeCriteriaIds, rubricScores]);

  const isAllCriteriaScored = useMemo(() => {
    return activeCriteriaIds.length > 0 && scoredCriteriaCount === activeCriteriaIds.length;
  }, [activeCriteriaIds, scoredCriteriaCount]);

  const handleEvaluateClick = (evaluation) => {
    setSelectedEvaluation(evaluation);
    let saved = null;
    if (evaluation.criterios && typeof evaluation.criterios === "object" && Object.keys(evaluation.criterios).length > 0) {
      saved = evaluation.criterios;
    } else if (typeof evaluation.criterios === "string") {
      try {
        const p = JSON.parse(evaluation.criterios);
        if (p && Object.keys(p).length > 0) saved = p;
      } catch (e) {}
    } else if (evaluation.likertScores && typeof evaluation.likertScores === "object" && Object.keys(evaluation.likertScores).length > 0) {
      saved = evaluation.likertScores;
    }

    if (saved && Object.keys(saved).length > 0) {
      setRubricScores({ ...saved });
    } else {
      setRubricScores({});
    }
    setOverallFeedback(evaluation.feedback || '');
  };

  const handleSubmitEvaluation = async () => {
    if (!selectedEvaluation) return;

    if (!isAllCriteriaScored) {
      toast.error(
        `Debes calificar todos los ítems de la rúbrica formativa (${scoredCriteriaCount}/${activeCriteriaIds.length} completados) antes de guardar la nota.`
      );
      return;
    }

    const totalScore = calculateRubricTotal(rubricScores, selectedEvaluation.rubrica_criterios);

    setIsSaving(true);
    try {
      const payload = {
        practica_id: selectedEvaluation.practiceId,
        estudiante_cedula: selectedEvaluation.cedula,
        calificacion: totalScore,
        retroalimentacion: overallFeedback.trim() || 'Evaluación de competencias clínicas registrada satisfactoriamente.',
        criterios: rubricScores,
      };

      const res = await fetch(`${API_BASE_URL}/api/docent/evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al guardar calificación.');
      }

      setEvaluations((prev) =>
        prev.map((e) =>
          e.id === selectedEvaluation.id
            ? {
                ...e,
                status: 'Completada',
                score: totalScore,
                feedback: payload.retroalimentacion,
                criterios: rubricScores,
                date: new Date().toISOString().slice(0, 10),
              }
            : e
        )
      );

      setSelectedEvaluation(null);
      notifyDataChanged("evaluations", "update");
      notifyDataChanged("practices", "update");
      toast.success(`Calificación oficial de ${totalScore.toFixed(1)} / 5.0 guardada exitosamente para ${selectedEvaluation.student}.`);
    } catch (err) {
      console.error("Error al registrar evaluación:", err);
      toast.error(`Error al registrar evaluación: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadReport = (format) => {
    const dataToDownload = evaluations.map((evalItem) => {
      const criteriosDetails = evalItem.criterios && typeof evalItem.criterios === 'object'
        ? Object.entries(evalItem.criterios)
            .map(([key, val]) => `${key}: +${val} pts`)
            .join('; ')
        : 'N/A';

      return {
        Cedula: evalItem.cedula,
        Estudiante: evalItem.student,
        Practica: evalItem.practice,
        Servicio: evalItem.service || 'N/A',
        Estado: evalItem.status,
        CalificacionOficial:
          evalItem.score !== null ? `${evalItem.score.toFixed(1)} / 5.0` : 'Pendiente',
        Comentarios: evalItem.feedback || 'N/A',
        FechaEvaluacion: evalItem.date || 'N/A',
        DetalleRubrica: criteriosDetails,
      };
    });

    const filename = `Reporte_Evaluaciones_Docente.${format}`;
    if (format === 'csv') {
      generateCsv(dataToDownload, filename);
    } else if (format === 'pdf') {
      generatePdf(dataToDownload, filename);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-zinc-800">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Gestionar Evaluaciones Formativas
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Evalúa el desempeño de tus estudiantes mediante criterios formativos estandarizados (Escala 0.0 a 5.0).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadReport('csv')}
            className="py-2 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition border border-gray-300 dark:border-zinc-700 shadow-sm flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => handleDownloadReport('pdf')}
            className="py-2 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition border border-gray-300 dark:border-zinc-700 shadow-sm flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Tabla Dinámica de Evaluaciones */}
      <div className="border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900 mb-8">
        {isLoading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : evaluations.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            No tienes estudiantes pendientes de evaluación en tus prácticas clínicas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
              <thead className="bg-gray-100 dark:bg-zinc-800">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Estudiante
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Práctica / Rotación
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Calificación (0.0 - 5.0)
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Fecha Evaluación
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                {evaluations.map((ev) => (
                  <tr
                    key={ev.id}
                    className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/50 transition duration-150"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="cursor-pointer"
                          onClick={() =>
                            setFichaStudent({
                              cedula: ev.cedula,
                              fullName: ev.student,
                              career: ev.career,
                              practica_titulo: ev.practice,
                              servicio_nombre: ev.service,
                              calificacion: ev.score,
                              score: ev.score,
                              feedback: ev.feedback,
                            })
                          }
                          title={`Ver ficha completa de ${ev.student}`}
                        >
                          <StudentAvatar
                            cedula={ev.cedula}
                            name={ev.student}
                            size="md"
                            hasPhoto={ev.tiene_foto}
                          />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition truncate"
                            onClick={() =>
                              setFichaStudent({
                                cedula: ev.cedula,
                                fullName: ev.student,
                                career: ev.career,
                                practica_titulo: ev.practice,
                                servicio_nombre: ev.service,
                                calificacion: ev.score,
                                score: ev.score,
                                feedback: ev.feedback,
                              })
                            }
                          >
                            {ev.student}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            C.C. {ev.cedula}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {ev.practice}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        {ev.service || "Servicio Hospitalario"}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          ev.status === "Completada"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                        }`}
                      >
                        ● {ev.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {ev.score !== null ? (
                        <span
                          className={`font-black text-sm px-2.5 py-1 rounded-lg ${
                            ev.score >= 3.0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {ev.score.toFixed(1)} / 5.0
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Pendiente</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-gray-600 dark:text-gray-400">
                      {ev.date || "Sin calificar"}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setFichaStudent({
                              cedula: ev.cedula,
                              fullName: ev.student,
                              career: ev.career,
                              practica_titulo: ev.practice,
                              servicio_nombre: ev.service,
                              calificacion: ev.score,
                              score: ev.score,
                              feedback: ev.feedback,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 transition cursor-pointer"
                          title="Ver Ficha Integral"
                        >
                          Ficha
                        </button>
                        <button
                          onClick={() => handleEvaluateClick(ev)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer ${
                            ev.status === "Pendiente"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          {ev.status === "Pendiente" ? <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> Evaluar</span> : <span className="inline-flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" /> Modificar</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulario de Evaluación */}
      {selectedEvaluation && (
        <div className="p-6 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-lg bg-gray-50/80 dark:bg-zinc-800/60 mt-8">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200 dark:border-zinc-800">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Evaluación de {selectedEvaluation.student}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Práctica: <strong>{selectedEvaluation.practice}</strong> · C.C. {selectedEvaluation.cedula}
              </p>
            </div>
            <button
              onClick={() => setSelectedEvaluation(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario de Evaluación por Rúbrica Formativa (10 Criterios) */}
          <div className="space-y-4">
            <RubricEvaluationInput
              rubricaCriterios={selectedEvaluation.rubrica_criterios}
              scores={rubricScores}
              onChange={setRubricScores}
              auditorReport={selectedEvaluation.auditorReport}
              onApplyAuditorReport={() => {
                if (selectedEvaluation.auditorReport?.criterios_rubrica) {
                  setRubricScores(selectedEvaluation.auditorReport.criterios_rubrica);
                  toast.info("Se han cargado las calificaciones sugeridas por el auditor clínico.");
                }
                if (selectedEvaluation.auditorReport?.observaciones) {
                  setOverallFeedback(
                    (prev) =>
                      prev ||
                      `[Concepto Auditor: ${selectedEvaluation.auditorReport.concepto || "Favorable"}] ${selectedEvaluation.auditorReport.observaciones}`
                  );
                }
              }}
            />

            <div>
              <label
                htmlFor="overallFeedback"
                className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-1"
              >
                Comentarios y Retroalimentación para el Estudiante *
              </label>
              <textarea
                id="overallFeedback"
                value={overallFeedback}
                onChange={(e) => setOverallFeedback(e.target.value)}
                rows="3"
                placeholder="Observaciones de competencias clínicas, puntualidad y cumplimiento asistencial..."
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
              ></textarea>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-zinc-800">
            <div>
              {!isAllCriteriaScored ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Faltan {activeCriteriaIds.length - scoredCriteriaCount} de {activeCriteriaIds.length} ítems por calificar</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Todos los {activeCriteriaIds.length} ítems calificados ({calculateRubricTotal(rubricScores, selectedEvaluation.rubrica_criterios).toFixed(1)} / 5.0)</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setSelectedEvaluation(null)}
                className="py-2.5 px-4 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving || !isAllCriteriaScored}
                onClick={handleSubmitEvaluation}
                className={`py-2.5 px-5 rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 ${
                  isAllCriteriaScored
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    : "bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 border border-gray-300 dark:border-zinc-700 cursor-not-allowed opacity-60"
                }`}
                title={!isAllCriteriaScored ? `Debes calificar los ${activeCriteriaIds.length} ítems antes de guardar` : "Guardar calificación oficial"}
              >
                {isSaving ? "Guardando..." : <><Save className="w-3.5 h-3.5" /> Guardar Calificación Oficial</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ficha Integral del Estudiante */}
      <StudentFichaModal
        isOpen={!!fichaStudent}
        onClose={() => setFichaStudent(null)}
        student={fichaStudent}
        role="docent"
        onPrimaryAction={(st) => {
          const matchEv = evaluations.find((e) => String(e.cedula) === String(st.cedula));
          if (matchEv) handleEvaluateClick(matchEv);
        }}
        primaryActionLabel="Evaluar Desempeño"
      />
    </div>
  );
};

export default DocentEvaluations;