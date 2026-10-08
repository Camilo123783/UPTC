// ============================================================
// StudentEvaluations.js — Consulta Real de Evaluaciones para el Estudiante
// ============================================================
import React, { useState, useEffect } from 'react';
import { Award, RefreshCw } from 'lucide-react';
import { BACKEND_URL } from '../../config/api';
import { useDataSync } from '../../utils/dataSync';

const API_BASE_URL = BACKEND_URL;

const StudentEvaluations = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStudentEvaluations = async () => {
    setIsLoading(true);
    try {
      let studentCedula = null;
      try {
        const stored = sessionStorage.getItem("userData");
        if (stored) {
          const parsed = JSON.parse(stored);
          studentCedula = parsed.cedula || parsed.Cédula || null;
        }
      } catch (e) {
        console.warn("No se pudo leer sesión de estudiante:", e);
      }

      const url = studentCedula
        ? `${API_BASE_URL}/api/student/evaluations/${studentCedula}`
        : `${API_BASE_URL}/api/student/evaluations`;

      const res = await fetch(url);
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

  const likertOptions = [
    { value: 1, label: 'Deficiente' },
    { value: 2, label: 'Regular' },
    { value: 3, label: 'Bueno' },
    { value: 4, label: 'Muy Bueno' },
    { value: 5, label: 'Excelente' },
  ];

  const evaluationCriteria = [
    { key: 'knowledge', label: 'Conocimiento Teórico' },
    { key: 'skills', label: 'Habilidades Prácticas' },
    { key: 'attitude', label: 'Actitud y Profesionalismo' },
    { key: 'communication', label: 'Comunicación Clínica' },
  ];

  // Gráfico de barras de criterios Likert con proporciones contenidas
  const renderBarChart = (scores) => {
    if (!scores) return null;

    const maxScore = 5;
    const chartHeight = 84;

    return (
      <div className="flex justify-around items-end h-48 min-h-[190px] bg-gray-50 dark:bg-zinc-800/80 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-inner overflow-hidden">
        {evaluationCriteria.map((criterion) => {
          const score = scores[criterion.key] || 0;
          const barHeight = (score / maxScore) * chartHeight;
          const barColor =
            score >= 4
              ? 'bg-emerald-500'
              : score >= 3
              ? 'bg-blue-500'
              : 'bg-rose-500';

          return (
            <div key={criterion.key} className="flex flex-col items-center justify-end h-full flex-1 max-w-[90px] mx-1">
              <span className="text-xs font-black text-gray-800 dark:text-gray-100 mb-1.5 flex-shrink-0">
                {score}/5
              </span>
              <div
                className={`w-8 sm:w-11 rounded-t-lg transition-all duration-500 ease-out shadow-sm flex-shrink-0 ${barColor}`}
                style={{ height: `${Math.max(barHeight, 8)}px` }}
              ></div>
              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mt-2 text-center w-full truncate leading-tight flex-shrink-0" title={criterion.label}>
                {criterion.label.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition-colors">
      <div className="pb-6 mb-8 border-b border-gray-200 dark:border-zinc-800">
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <Award className="w-7 h-7 text-emerald-600 dark:text-emerald-400" /> Mis Evaluaciones de Práctica
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
          Consulta las calificaciones formativas oficiales (0.0 a 5.0) y la retroalimentación registrada por tus docentes supervisores.
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-blue-600 dark:text-blue-400 font-semibold animate-pulse flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Cargando tus evaluaciones oficiales...
        </div>
      ) : evaluations.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 dark:bg-zinc-800/40 rounded-2xl border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-gray-400">
          No tienes evaluaciones de rotación clínica registradas en este momento.
        </div>
      ) : (
        <div className="space-y-6">
          {evaluations.map((evaluation) => {
            const hasScore = evaluation.score !== null && evaluation.score !== undefined;
            const isApproved = hasScore && Number(evaluation.score) >= 3.0;

            return (
              <div
                key={evaluation.id}
                className="p-6 border border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-800/60 rounded-3xl shadow-sm hover:shadow-md transition duration-150"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900 mb-1 inline-block">
                      {evaluation.service || 'Rotación Clínica'}
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
                        evaluation.status === 'Completada' || hasScore
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      ● {evaluation.status || (hasScore ? 'Completada' : 'Pendiente')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300 mb-4 p-3 bg-white dark:bg-zinc-800/80 rounded-2xl border border-gray-200 dark:border-zinc-700">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Docente Supervisor:</span>
                    <strong className="text-sm text-gray-900 dark:text-white">{evaluation.docent}</strong>
                    {evaluation.docent_correo && (
                      <p className="text-blue-600 dark:text-blue-400 text-[11px] mt-0.5">{evaluation.docent_correo}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Fecha de Evaluación:</span>
                    <strong className="text-sm text-gray-900 dark:text-white">
                      {evaluation.date || 'Pendiente de cierre'}
                    </strong>
                  </div>
                </div>

                {hasScore ? (
                  <div className="space-y-4">
                    {/* Tarjeta de Calificación 0.0 - 5.0 */}
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          Calificación Formativa Oficial
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-4xl font-black text-emerald-950 dark:text-emerald-100">
                            {Number(evaluation.score).toFixed(1)}
                          </span>
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            / 5.0
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-start sm:items-end">
                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                            isApproved
                              ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                              : 'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200'
                          }`}
                        >
                          {isApproved ? 'Aprobado (≥ 3.0)' : 'Reprobado (< 3.0)'}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Escala oficial UPTC
                        </span>
                      </div>
                    </div>

                    {/* Retroalimentación del Docente */}
                    {evaluation.feedback && (
                      <div className="p-4 bg-white dark:bg-zinc-800/80 rounded-2xl border border-gray-200 dark:border-zinc-700">
                        <strong className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                          Concepto y Retroalimentación del Docente:
                        </strong>
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed italic">
                          "{evaluation.feedback}"
                        </p>
                      </div>
                    )}

                    {/* Desglose por Criterios */}
                    {evaluation.likertScores && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
                          Desglose Formativo por Competencias
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {evaluationCriteria.map((criterion) => {
                            const val = evaluation.likertScores[criterion.key];
                            const label =
                              likertOptions.find((o) => o.value === val)?.label || `${val}/5`;
                            return (
                              <div
                                key={criterion.key}
                                className="flex justify-between items-center p-2.5 bg-white dark:bg-zinc-800/80 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs"
                              >
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                  {criterion.label}:
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white">
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {renderBarChart(evaluation.likertScores)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">Evaluación en proceso</p>
                    <p className="mt-0.5 opacity-90">
                      Tu docente aún no ha registrado la nota final de esta rotación asistencial. Te notificaremos cuando esté disponible.
                    </p>
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