// ============================================================
// StudentEvaluations.js — Consulta Real de Evaluaciones para el Estudiante
// Visualización del desempeño formativo del estudiante con desglose
// de los 10 criterios oficiales de la rúbrica UPTC y retroalimentación docente.
// ============================================================
import React, { useState, useEffect } from "react";
import { Award, RefreshCw, Sparkles, CheckCircle2, Info, BookOpen } from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { useDataSync } from "../../utils/dataSync";
import { SkeletonCardGrid } from "../Shared/Skeleton";
import { RubricCriteriaViewer } from "../Shared/PracticeRubric";
import {
  RUBRIC_CRITERIA_MAP,
  RUBRIC_SCALE,
  parseRubricCriteriaIds,
  getPerformanceConcept,
} from "../../utils/evaluationRubric";

const API_BASE_URL = BACKEND_URL;

const getScoreBadge = (val) => {
  const num = Number(val);
  if (num >= 0.5) {
    return {
      label: "Siempre",
      pts: "+0.5 pts",
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
    };
  }
  if (num >= 0.4) {
    return {
      label: "Casi siempre",
      pts: "+0.4 pts",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800",
    };
  }
  if (num >= 0.3) {
    return {
      label: "En ocasiones",
      pts: "+0.3 pts",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    };
  }
  if (num >= 0.2) {
    return {
      label: "Rara vez",
      pts: "+0.2 pts",
      className: "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-300 dark:border-orange-800",
    };
  }
  return {
    label: "No cumple",
    pts: "+0.1 pts",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800",
  };
};

const StudentEvaluations = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStudentEvaluations = async () => {
    setIsLoading(true);
    try {
      let studentCedula = null;
      try {
        const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
        if (stored) {
          const parsed = JSON.parse(stored);
          studentCedula = parsed.cedula || parsed.Cédula || null;
        }
      } catch (e) {
        console.warn("No se pudo leer sesión de estudiante:", e);
      }

      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const url = studentCedula
        ? `${API_BASE_URL}/api/student/evaluations/${studentCedula}`
        : `${API_BASE_URL}/api/student/evaluations`;

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvaluations(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error al cargar evaluaciones reales del estudiante:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentEvaluations();
  }, []);

  useDataSync(fetchStudentEvaluations);

  return (
    <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition-colors">
      <div className="pb-6 mb-8 border-b border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <Award className="w-7 h-7 text-emerald-600 dark:text-emerald-400" /> Mis Evaluaciones de Práctica
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Consulta tus calificaciones formativas oficiales (0.0 a 5.0) y la rúbrica de 10 criterios establecida para tu rotación.
          </p>
        </div>

        <button
          onClick={fetchStudentEvaluations}
          disabled={isLoading}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl transition shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          <span>{isLoading ? "Actualizando..." : "Actualizar"}</span>
        </button>
      </div>

      {isLoading ? (
        <SkeletonCardGrid count={3} columns="grid-cols-1" />
      ) : evaluations.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 dark:bg-zinc-800/40 rounded-2xl border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-gray-400">
          No tienes evaluaciones de rotación clínica registradas en este momento.
        </div>
      ) : (
        <div className="space-y-6">
          {evaluations.map((evaluation) => {
            const hasScore = evaluation.score !== null && evaluation.score !== undefined;
            const isApproved = hasScore && Number(evaluation.score) >= 3.0;
            const concept = hasScore ? getPerformanceConcept(Number(evaluation.score)) : null;

            // Determinar si los criterios guardados corresponden a la rúbrica oficial de 25 criterios
            const criteriaScores = evaluation.likertScores || {};
            const activePracticeCriteria = parseRubricCriteriaIds(evaluation.rubrica_criterios);

            // Criterios a mostrar: priorizar los de la práctica configurados
            const criteriaToShow = activePracticeCriteria.length > 0
              ? activePracticeCriteria
              : Object.keys(criteriaScores);

            const hasRubricItems = criteriaToShow.some((k) => RUBRIC_CRITERIA_MAP[k]);

            return (
              <div
                key={evaluation.id}
                className="p-6 border border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-800/60 rounded-3xl shadow-sm hover:shadow-md transition duration-150"
              >
                {/* Encabezado de la Práctica */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900 mb-1 inline-block">
                      {evaluation.service || "Rotación Clínica"}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {evaluation.practice}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Institución: <strong>{evaluation.institution}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        evaluation.status === "Completada" || hasScore
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      ● {evaluation.status || (hasScore ? "Completada" : "Pendiente")}
                    </span>
                  </div>
                </div>

                {/* Datos del Docente y Fecha */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300 mb-4 p-3 bg-white dark:bg-zinc-800/80 rounded-2xl border border-gray-200 dark:border-zinc-700">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Docente Evaluador:</span>
                    <strong className="text-sm text-gray-900 dark:text-white">{evaluation.docent}</strong>
                    {evaluation.docent_correo && (
                      <p className="text-blue-600 dark:text-blue-400 text-[11px] mt-0.5">{evaluation.docent_correo}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Fecha de Registro:</span>
                    <strong className="text-sm text-gray-900 dark:text-white">
                      {evaluation.date || "Pendiente de calificación"}
                    </strong>
                  </div>
                </div>

                {hasScore ? (
                  <div className="space-y-4">
                    {/* Tarjeta de Calificación 0.0 - 5.0 */}
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> Calificación Formativa Definitiva
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-4xl font-black text-emerald-950 dark:text-emerald-100">
                            {Number(evaluation.score).toFixed(1)}
                          </span>
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            / 5.0 (Suma oficial de la rúbrica)
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-start sm:items-end gap-1">
                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                            isApproved
                              ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200"
                              : "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200"
                          }`}
                        >
                          {isApproved ? "Aprobado (≥ 3.0)" : "Reprobado (< 3.0)"}
                        </span>
                        {concept && (
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            Concepto: {concept.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Retroalimentación del Docente */}
                    {evaluation.feedback && (
                      <div className="p-4 bg-white dark:bg-zinc-800/80 rounded-2xl border border-gray-200 dark:border-zinc-700">
                        <strong className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                          Retroalimentación del Docente Evaluador:
                        </strong>
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed italic">
                          "{evaluation.feedback}"
                        </p>
                      </div>
                    )}

                    {/* Desglose de los 10 Criterios de la Rúbrica */}
                    {hasRubricItems ? (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                            Desglose de los 10 Criterios Evaluados
                          </h4>
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                            Siempre (+0.5) · Casi siempre (+0.4) · En ocasiones (+0.3) · Rara vez (+0.2) · No cumple (+0.1)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {criteriaToShow.map((critId, idx) => {
                            const meta = RUBRIC_CRITERIA_MAP[critId];
                            if (!meta) return null;
                            const scoreVal = criteriaScores[critId] !== undefined ? criteriaScores[critId] : null;
                            const badge = scoreVal !== null ? getScoreBadge(scoreVal) : null;

                            return (
                              <div
                                key={critId}
                                className="p-3 bg-white dark:bg-zinc-850 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-3xs flex flex-col justify-between gap-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                                      {idx + 1}
                                    </span>
                                    <div>
                                      <h5 className="text-xs font-bold text-gray-900 dark:text-white leading-snug">
                                        {meta.nombre}
                                      </h5>
                                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 block">
                                        {meta.categoriaNombre}
                                      </span>
                                    </div>
                                  </div>

                                  {badge && (
                                    <span
                                      className={`px-2 py-0.5 rounded-lg text-xs font-bold border shrink-0 ${badge.className}`}
                                    >
                                      {badge.label} ({badge.pts})
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed pl-7">
                                  {meta.descripcion}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Evaluación en proceso de calificación</p>
                        <p className="mt-0.5 opacity-90">
                          Tu docente aún no ha registrado la nota final de esta rotación asistencial. A continuación puedes consultar los 10 criterios de evaluación configurados para esta práctica.
                        </p>
                      </div>
                    </div>

                    {/* Visor de los 10 criterios para que el estudiante sepa cómo se le evaluará */}
                    <RubricCriteriaViewer
                      criteriaIds={evaluation.rubrica_criterios}
                      title="Criterios con los que serás evaluado en esta práctica"
                      variant="card"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentEvaluations;