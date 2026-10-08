// ============================================================
// SendMessageModal.js — Mensajes y Comunicados del Auditor al Docente
// Permite al auditor enviar mensajes directos al docente a cargo
// sobre un tema importante de la práctica o de un estudiante específico
// ============================================================
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Clock, Star, Lightbulb, Mail, X } from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { notifyDataChanged } from "../../utils/dataSync";

const COMMUNICATION_TYPES = [
  { id: "General", label: "Asunto General", desc: "Coordinación de rotación o novedades de servicio", icon: MessageSquare, color: "text-blue-500" },
  { id: "Asistencia", label: "Novedad de Asistencia", desc: "Turnos, ausencias o reposición de horas", icon: Clock, color: "text-amber-500" },
  { id: "Desempeño", label: "Desempeño Clínico", desc: "Observaciones de competencias o destreza técnica", icon: Star, color: "text-purple-500" },
  { id: "Recomendación", label: "Recomendación Especial", desc: "Ajuste metodológico o seguimiento al estudiante", icon: Lightbulb, color: "text-emerald-500" },
];

const SendMessageModal = ({
  isOpen,
  onClose,
  practice,
  students = [],
  preselectedStudent = null,
  onSuccess,
}) => {
  const [selectedStudentCedula, setSelectedStudentCedula] = useState(
    preselectedStudent?.cedula || ""
  );
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("General");
  const [mensaje, setMensaje] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  if (!isOpen || !practice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mensaje.trim()) {
      setFeedbackMsg({
        type: "error",
        text: "Por favor escribe el contenido del mensaje.",
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
        titulo: titulo.trim() || undefined,
        mensaje: mensaje.trim(),
        tipo,
        estudiante_cedula: selectedStudentCedula ? selectedStudentCedula : undefined,
      };

      const res = await fetch(
        `${BACKEND_URL}/api/auditor/practices/${practice.id}/messages`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al enviar mensaje.");
      }

      setFeedbackMsg({
        type: "success",
        text: data.message,
      });

      notifyDataChanged("communications", "update");

      if (onSuccess) {
        onSuccess(data);
      }

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error("Error al enviar mensaje al docente:", err);
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
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Enviar Mensaje al Docente
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Canal Oficial de Coordinación Hospitalaria
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

        {/* Info de la práctica y docente */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-400 dark:text-zinc-500 block">Destinatario (Docente a Cargo):</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {practice.docente_nombre || "Docente Asignado"}
              </span>
              <span className="text-gray-500 dark:text-zinc-400 block mt-0.5">
                {practice.docente_correo || "Docente de rotación"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 dark:text-zinc-500 block">Práctica:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 block">
                {practice.titulo}
              </span>
              <span className="text-gray-500 dark:text-zinc-400 block mt-0.5">
                {practice.nombreinstitucion || "Hospital Asignado"}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Relacionar con un estudiante opcional */}
            {students.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Asociar Mensaje a un Estudiante (Opcional)
                </label>
                <select
                  value={selectedStudentCedula}
                  onChange={(e) => setSelectedStudentCedula(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition"
                >
                  <option value="">-- Asunto general de la práctica (sin estudiante específico) --</option>
                  {students.map((st) => (
                    <option key={st.cedula} value={st.cedula}>
                      {st.fullName || `${st.nombre} ${st.apellidos}`} (C.C. {st.cedula})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipo de Comunicación */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Categoría del Mensaje
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COMMUNICATION_TYPES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTipo(item.id)}
                      className={`p-2.5 text-left rounded-xl border text-xs font-semibold transition ${
                        tipo === item.id
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

            {/* Asunto / Título */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Asunto del Mensaje
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Novedad de turnos asistenciales / Reporte de desempeño"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition"
              />
            </div>

            {/* Mensaje */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Mensaje Detallado *
              </label>
              <textarea
                rows={4}
                required
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribe el mensaje o notificación para el docente a cargo..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition resize-none leading-relaxed"
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
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Mensaje al Docente</span>
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

export default SendMessageModal;
