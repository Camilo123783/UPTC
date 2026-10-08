// ============================================================
// DocentEvaluations.js — Gestión de Evaluaciones del Docente
// ============================================================
import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { generateCsv, generatePdf } from '../../utils/reportGenerator';
import { BACKEND_URL } from '../../config/api';
import { notifyDataChanged, useDataSync } from '../../utils/dataSync';
import { toast } from 'react-toastify';
import StudentAvatar from '../Shared/StudentAvatar';
import StudentFichaModal from '../Shared/StudentFichaModal';

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
          likertScores: st.likertScores || { knowledge: 4, skills: 4, attitude: 5, communication: 4 },
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
  const [likertScores, setLikertScores] = useState({
    knowledge: 4,
    skills: 4,
    attitude: 5,
    communication: 4,
  });
  const [overallFeedback, setOverallFeedback] = useState('');

  const likertOptions = [
    { value: 1, label: '1 - Deficiente' },
    { value: 2, label: '2 - Regular' },
    { value: 3, label: '3 - Bueno' },
    { value: 4, label: '4 - Muy Bueno' },
    { value: 5, label: '5 - Excelente' },
  ];

  const evaluationCriteria = [
    { key: 'knowledge', label: 'Conocimiento Teórico' },
    { key: 'skills', label: 'Habilidades Prácticas' },
    { key: 'attitude', label: 'Actitud y Profesionalismo' },
    { key: 'communication', label: 'Comunicación con Pacientes/Equipo' },
  ];

  const handleEvaluateClick = (evaluation) => {
    setSelectedEvaluation(evaluation);
    if (evaluation.status === 'Completada' && evaluation.likertScores) {
      setLikertScores(evaluation.likertScores);
      setOverallFeedback(evaluation.feedback || '');
    } else {
      setLikertScores({ knowledge: 4, skills: 4, attitude: 5, communication: 4 });
      setOverallFeedback('');
    }
  };

  const handleLikertChange = (criterion, value) => {
    setLikertScores({ ...likertScores, [criterion]: value });
  };

  const handleSubmitEvaluation = async () => {
    if (!selectedEvaluation) return;

    const totalScore = Object.values(likertScores).reduce((sum, score) => sum + score, 0);
    const averageScore = parseFloat((totalScore / evaluationCriteria.length).toFixed(1));

    setIsSaving(true);
    try {
      const payload = {
        practica_id: selectedEvaluation.practiceId,
        estudiante_cedula: selectedEvaluation.cedula,
        calificacion: averageScore,
        retroalimentacion: overallFeedback.trim() || 'Evaluación de competencias clínicas registrada satisfactoriamente.',
        criterios: likertScores,
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
                score: averageScore,
                feedback: payload.retroalimentacion,
                likertScores: likertScores,
                date: new Date().toISOString().slice(0, 10),
              }
            : e
        )
      );

      setSelectedEvaluation(null);
      notifyDataChanged("evaluations", "update");
      notifyDataChanged("practices", "update");
      toast.success(`Calificación oficial de ${averageScore.toFixed(1)} / 5.0 guardada exitosamente para ${selectedEvaluation.student}.`);
    } catch (err) {
      console.error("Error al registrar evaluación:", err);
      toast.error(`Error al registrar evaluación: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadReport = (format) => {
    const dataToDownload = evaluations.map((evalItem) => {
      const likertDetails = evalItem.likertScores
        ? Object.keys(evalItem.likertScores)
            .map(
              (key) =>
                `${evaluationCriteria.find((c) => c.key === key)?.label || key}: ${
                  evalItem.likertScores[key]
                }/5`
            )
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
        DetalleLikert: likertDetails,
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
          <div className="p-12 text-center text-blue-600 dark:text-blue-400 font-semibold animate-pulse flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Sincronizando evaluaciones en tiempo real...
          </div>
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

          {/* Reporte previo del Auditor Clínico */}
          {selectedEvaluation.auditorReport && (
            <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Concepto del Auditor Clínico ({selectedEvaluation.auditorReport.auditor_nombre || "Auditor Asistencial"})</span>
                </span>
                <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 border border-amber-500/40">
                  Nota Sugerida: {Number(selectedEvaluation.auditorReport.nota_sugerida).toFixed(1)} ({selectedEvaluation.auditorReport.concepto})
                </span>
              </div>
              <p className="text-xs mt-2 italic text-gray-700 dark:text-amber-100/90 bg-white/60 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-amber-500/20">
                "{selectedEvaluation.auditorReport.observaciones}"
              </p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-gray-600 dark:text-zinc-400">
                  <span>Teoría: {selectedEvaluation.auditorReport.likert?.knowledge || 4}/5</span>
                  <span>Práctica: {selectedEvaluation.auditorReport.likert?.skills || 4}/5</span>
                  <span>Ética: {selectedEvaluation.auditorReport.likert?.attitude || 5}/5</span>
                  <span>Comunicación: {selectedEvaluation.auditorReport.likert?.communication || 4}/5</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const lk = selectedEvaluation.auditorReport.likert;
                    if (lk) {
                      setLikertScores({
                        knowledge: Math.round(lk.knowledge) || 4,
                        skills: Math.round(lk.skills) || 4,
                        attitude: Math.round(lk.attitude) || 5,
                        communication: Math.round(lk.communication) || 4,
                      });
                    }
                    if (selectedEvaluation.auditorReport.observaciones) {
                      setOverallFeedback(
                        `[Aval del Auditor: ${selectedEvaluation.auditorReport.concepto}] ${selectedEvaluation.auditorReport.observaciones}`
                      );
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-gray-900 shadow-sm transition cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" /> Aplicar sugerencia del Auditor
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {evaluationCriteria.map((criterion) => (
              <div
                key={criterion.key}
                className="p-3 bg-white dark:bg-zinc-800/80 rounded-xl border border-gray-200 dark:border-zinc-700"
              >
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    {criterion.label}
                  </label>
                  <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                    {likertScores[criterion.key]} / 5
                  </span>
                </div>
                <div className="flex space-x-3 flex-wrap gap-y-2">
                  {likertOptions.map((option) => (
                    <label
                      key={option.value}
                      className="inline-flex items-center text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={criterion.key}
                        value={option.value}
                        checked={likertScores[criterion.key] === option.value}
                        onChange={() => handleLikertChange(criterion.key, option.value)}
                        className="form-radio h-4 w-4 text-blue-600 mr-1.5 focus:ring-blue-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                  Calificación Promedio Resultante (Escala 0.0 a 5.0):
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Calculada automáticamente a partir de los 4 criterios formativos.
                </p>
              </div>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {(
                  Object.values(likertScores).reduce((a, b) => a + b, 0) /
                  evaluationCriteria.length
                ).toFixed(1)}{" "}
                / 5.0
              </span>
            </div>

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

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setSelectedEvaluation(null)}
              className="py-2.5 px-4 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              Cancelar
            </button>
            <button
              disabled={isSaving}
              onClick={handleSubmitEvaluation}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? "Guardando..." : <><Save className="w-3.5 h-3.5" /> Guardar Calificación Oficial</>}
            </button>
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