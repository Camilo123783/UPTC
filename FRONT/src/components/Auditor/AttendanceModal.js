// ============================================================
// AttendanceModal.js — Modal de Confirmación y Registro de Asistencia
// Permite al auditor confirmar turnos de estudiantes en el hospital
// y actualizar inmediatamente las horas cumplidas y la barra de progreso
// ============================================================
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { notifyDataChanged } from "../../utils/dataSync";

const SHIFT_OPTIONS = [
  { label: "Turno Completo (8 Horas)", hours: 8, shift: "Turno Completo (8h)" },
  { label: "Turno Mañana (6 Horas)", hours: 6, shift: "Mañana (6h)" },
  { label: "Turno Tarde (6 Horas)", hours: 6, shift: "Tarde (6h)" },
  { label: "Turno Nocturno / Guardia (12 Horas)", hours: 12, shift: "Noche (12h)" },
  { label: "Turno Corto / Reemplazo (4 Horas)", hours: 4, shift: "Media Jornada (4h)" },
  { label: "Horas Personalizadas", hours: 0, shift: "Jornada Especial" },
];

const AttendanceModal = ({
  isOpen,
  onClose,
  student,
  practice,
  onSuccess,
}) => {
  const [fecha, setFecha] = useState(() => new Date().toISOString().substring(0, 10));
  const [selectedShiftIndex, setSelectedShiftIndex] = useState(0);
  const [customHours, setCustomHours] = useState(8);
  const [estado, setEstado] = useState("Presente");
  const [observaciones, setObservaciones] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  if (!isOpen || !student || !practice) return null;

  const currentShift = SHIFT_OPTIONS[selectedShiftIndex];
  const finalHours = currentShift.hours > 0 ? currentShift.hours : (parseInt(customHours, 10) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedbackMsg(null);

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const payload = {
        fecha,
        turno: currentShift.shift,
        horas: finalHours,
        estado,
        observaciones: observaciones.trim() || undefined,
      };

      const res = await fetch(
        `${BACKEND_URL}/api/auditor/practices/${practice.id}/students/${student.cedula}/attendance`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al registrar asistencia.");
      }

      setFeedbackMsg({
        type: "success",
        text: data.message,
      });

      notifyDataChanged("practices", "update");
      notifyDataChanged("students", "update");

      if (onSuccess) {
        onSuccess({
          studentCedula: student.cedula,
          practiceId: practice.id,
          horas_cumplidas: data.horas_cumplidas,
          progreso: data.progreso,
        });
      }

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error("Error al registrar asistencia:", err);
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
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
        {/* Cabecera */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Confirmar Asistencia y Turno
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Auditoría en Sitio Hospitalario
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

        {/* Info del Estudiante y Práctica */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-400 dark:text-zinc-500 block">Estudiante:</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {student.fullName || `${student.nombre} ${student.apellidos}`}
              </span>
              <span className="text-gray-500 dark:text-zinc-400 block mt-0.5">
                C.C. {student.cedula} {student.codigo ? `| Cód: ${student.codigo}` : ""}
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 dark:text-zinc-500 block">Práctica / Rotación:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 block">
                {practice.titulo}
              </span>
              <span className="text-gray-500 dark:text-zinc-400 block mt-0.5">
                Progreso actual: {student.horas_cumplidas || 0} / {student.horas_asignadas || practice.horas_totales || 120} h
              </span>
            </div>
          </div>

          {practice.horario && (
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-900/50 flex items-center gap-2 text-xs">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <span className="font-bold text-blue-800 dark:text-blue-300 block">Horario de la rotación:</span>
                <span className="text-gray-700 dark:text-zinc-300 font-medium">{practice.horario}</span>
              </div>
            </div>
          )}

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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fecha del turno */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Fecha del Turno Asistencial
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition"
              />
            </div>

            {/* Selector de Turno */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Tipo de Turno y Horas a Acreditar
              </label>
              <select
                value={selectedShiftIndex}
                onChange={(e) => setSelectedShiftIndex(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition"
              >
                {SHIFT_OPTIONS.map((opt, idx) => (
                  <option key={idx} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Horas personalizadas si aplica */}
            {currentShift.hours === 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Número Exacto de Horas
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition"
                />
              </div>
            )}

            {/* Estado de Asistencia */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Estado de la Asistencia
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "Presente", label: "Presente (+ Horas)", desc: "Cumplió turno normal", icon: CheckCircle2, color: "text-emerald-500" },
                  { id: "Tardanza", label: "Tardanza (+ Horas)", desc: "Ingreso demorado justificado", icon: AlertTriangle, color: "text-amber-500" },
                  { id: "Ausente Justificado", label: "Ausente Justificado", desc: "No suma horas", icon: Info, color: "text-blue-500" },
                  { id: "Ausente Injustificado", label: "Inasistencia Injustificada", desc: "No suma horas", icon: XCircle, color: "text-rose-500" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setEstado(item.id)}
                      className={`p-2.5 text-left rounded-xl border text-xs font-semibold transition ${
                        estado === item.id
                          ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20"
                          : "border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 text-gray-700 dark:text-zinc-300 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
                        <span>{item.label}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-zinc-500 font-normal mt-0.5">
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Observaciones del Turno (Opcional)
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Rotación en sala de reanimación, procedimientos supervisados con éxito..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition resize-none"
              />
            </div>

            {/* Acciones */}
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
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar +{finalHours}h Asistencia</span>
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

export default AttendanceModal;
