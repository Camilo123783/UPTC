// ============================================================
// StudentDocentCommunication.js — Centro de Comunicación Estudiante - Docente UPTC
// Permite al estudiante comunicarse directamente con su docente asignado,
// revisar avisos institucionales de la práctica, reportar novedades y enviar consultas.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BACKEND_URL } from "../../config/api";
import { useAuth } from "../../utils/useAuth";
import { useDataSync, notifyDataChanged } from "../../utils/dataSync";
import toast from "../../utils/toast";
import {
  MessageSquare,
  Send,
  User,
  Users,
  Building,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  GraduationCap,
  Clock,
  ArrowRight,
  ShieldCheck,
  Mail,
  Phone,
  Stethoscope,
  Megaphone,
  Trash2,
} from "lucide-react";

const StudentDocentCommunication = () => {
  const { user } = useAuth();
  const [practices, setPractices] = useState([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingPractices, setIsLoadingPractices] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(null);

  // Filtros
  const [typeFilter, setTypeFilter] = useState("all");

  // Formulario de Envío
  const [messageForm, setMessageForm] = useState({
    titulo: "",
    mensaje: "",
    tipo: "General",
  });

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const messagesEndRef = useRef(null);

  // 0. Eliminar Mensaje (Límite estricto de 5 minutos)
  const handleDeleteMessage = async (msg) => {
    if (!msg || !msg.id) return;
    const createdAt = new Date(msg.created_at).getTime();
    const diffMinutes = (Date.now() - createdAt) / (1000 * 60);

    if (diffMinutes > 5) {
      toast.warning("El tiempo límite de 5 minutos para eliminar este mensaje ha expirado.");
      return;
    }

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/student/communication/messages/${msg.id}${studentCedula ? `?studentId=${studentCedula}` : ""}`,
        {
          method: "DELETE",
          headers,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al eliminar el mensaje.");

      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      toast.success("Mensaje eliminado exitosamente.");
      notifyDataChanged();
    } catch (err) {
      toast.error(err.message || "Error al eliminar el mensaje.");
    }
  };

  // Obtener la cédula del estudiante
  const studentCedula = useMemo(() => {
    if (user?.cedula) return user.cedula;
    if (user?.id) return user.id;
    try {
      const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.cedula || parsed.Cédula || parsed.id || null;
      }
    } catch (e) {}
    return null;
  }, [user]);

  // 1. Cargar Prácticas del Estudiante
  const fetchPractices = useCallback(async () => {
    setIsLoadingPractices(true);
    setError(null);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const url = `${BACKEND_URL}/api/student/communication/practices${studentCedula ? `?studentId=${studentCedula}` : ""}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("No se pudieron cargar tus prácticas asignadas.");
      const data = await res.json();
      const pList = Array.isArray(data) ? data : [];
      setPractices(pList);

      if (pList.length > 0) {
        setSelectedPracticeId((prev) => {
          if (prev && pList.some((p) => String(p.id) === String(prev))) return prev;
          return pList[0].id;
        });
      }
    } catch (err) {
      console.error("Error al cargar prácticas en StudentDocentCommunication:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoadingPractices(false);
    }
  }, [studentCedula]);

  // 2. Cargar Mensajes de la Práctica Seleccionada
  const fetchMessages = useCallback(async (practiceId) => {
    if (!practiceId) return;
    setIsLoadingMessages(true);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const url = `${BACKEND_URL}/api/student/communication/practices/${practiceId}/messages${studentCedula ? `?studentId=${studentCedula}` : ""}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);

        // Actualizar conteo de no leídos a 0 en la práctica seleccionada
        setPractices((prev) =>
          prev.map((p) =>
            String(p.id) === String(practiceId) ? { ...p, unread_messages_count: 0 } : p
          )
        );

        window.dispatchEvent(new CustomEvent("uptc:messages-read"));
      }
    } catch (err) {
      console.error("Error al cargar mensajes del docente:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [studentCedula]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("uptc:messages-read"));
  }, []);

  useEffect(() => {
    fetchPractices();
  }, [fetchPractices]);

  useEffect(() => {
    if (selectedPracticeId) {
      fetchMessages(selectedPracticeId);
    }
  }, [selectedPracticeId, fetchMessages]);

  useDataSync(() => {
    fetchPractices();
    if (selectedPracticeId) fetchMessages(selectedPracticeId);
  });

  // Scroll automático al final cuando llegan mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Práctica actualmente seleccionada
  const currentPractice = useMemo(() => {
    return practices.find((p) => String(p.id) === String(selectedPracticeId)) || null;
  }, [practices, selectedPracticeId]);

  // Mensajes filtrados por tipo
  const filteredMessages = useMemo(() => {
    if (typeFilter === "all") return messages;
    return messages.filter((m) => m.tipo === typeFilter);
  }, [messages, typeFilter]);

  // 3. Enviar Mensaje al Docente
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageForm.mensaje.trim() || !selectedPracticeId) return;

    setIsSending(true);
    setError(null);
    setFeedbackSuccess(null);

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const payload = {
        titulo: messageForm.titulo.trim() || "Consulta del Estudiante",
        mensaje: messageForm.mensaje.trim(),
        tipo: messageForm.tipo,
        estudiante_cedula: studentCedula,
      };

      const res = await fetch(
        `${BACKEND_URL}/api/student/communication/practices/${selectedPracticeId}/messages`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al enviar el mensaje.");

      setFeedbackSuccess("Mensaje entregado a tu docente exitosamente.");
      setMessageForm({
        titulo: "",
        mensaje: "",
        tipo: "General",
      });

      await fetchMessages(selectedPracticeId);
      notifyDataChanged();

      setTimeout(() => setFeedbackSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const getBadgeForType = (tipo) => {
    switch (tipo) {
      case "Asistencia":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
      case "Desempeño":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
      case "Recomendación":
        return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30";
      case "Aviso":
      case "Alerta":
        return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
      default:
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Encabezado Principal ─── */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Comunicación con el Docente
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Canal directo institucional con el docente asignado a tu práctica clínica para recibir indicaciones, resolver dudas y reportar novedades.
            </p>
          </div>

          <button
            onClick={() => {
              fetchPractices();
              if (selectedPracticeId) fetchMessages(selectedPracticeId);
            }}
            className="self-start sm:self-auto px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {feedbackSuccess && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}
      </div>

      {/* ─── Grid de Comunicación: Prácticas + Chat con Docente ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Mis Prácticas Inscritas (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-lg border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-emerald-500" />
                <span>Mis Prácticas ({practices.length})</span>
              </h3>
            </div>

            {/* Lista de Prácticas */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {isLoadingPractices ? (
                <div className="py-8 text-center text-xs text-gray-400 animate-pulse">
                  Cargando tus prácticas...
                </div>
              ) : practices.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No tienes prácticas inscritas actualmente.
                </div>
              ) : (
                practices.map((pr) => {
                  const isSelected = String(pr.id) === String(selectedPracticeId);
                  const unreadCount = Number(pr.unread_messages_count || 0);

                  return (
                    <div
                      key={pr.id}
                      onClick={() => setSelectedPracticeId(pr.id)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2.5 select-none ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/50 shadow-sm"
                          : "bg-gray-50/70 dark:bg-zinc-800/40 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800/70"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? "bg-emerald-600 text-white"
                                  : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300"
                              }`}
                            >
                              #{pr.id} · {pr.estado || "Activa"}
                            </span>
                            {unreadCount > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-sm shadow-red-600/40 border border-white/20 animate-pulse"
                                title={`${unreadCount} mensaje(s) nuevo(s) de tu docente`}
                              >
                                <Mail className="w-3 h-3" />
                                <span>{unreadCount} pendiente{unreadCount > 1 ? "s" : ""}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-semibold">
                            Periodo {pr.periodo || "2026-2"}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-1.5 line-clamp-1">
                          {pr.titulo}
                        </h4>

                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400 mt-1">
                          <Building className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                          <span className="truncate">{pr.institucion_nombre || "Institución Hospitalaria"}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200/60 dark:border-zinc-700/60 flex items-center justify-between text-[11px]">
                        <span className="text-gray-500 dark:text-zinc-400 flex items-center gap-1 truncate max-w-[170px]">
                          <User className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{pr.docente_nombre || "Docente"}</span>
                        </span>
                        <span
                          className={`font-bold flex items-center gap-1 ${
                            isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                          }`}
                        >
                          {isSelected ? "Seleccionada →" : "Ver chat"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Feed de Chat y Formulario de Envío (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {currentPractice ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col">
              {/* Cabecera del Chat con Datos del Docente */}
              <div className="p-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">
                        {currentPractice.titulo}
                      </h3>
                      <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        {currentPractice.institucion_nombre || "Institución"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      Servicio: {currentPractice.servicio_nombre || "General"} · Periodo {currentPractice.periodo || "2026-2"}
                    </p>
                  </div>

                  {/* Tarjeta pequeña del Docente */}
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {currentPractice.docente_nombre || "Docente"}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                        {currentPractice.docente_correo || "Docente de Práctica Clínica"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filtro por tipo de mensaje */}
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-200/60 dark:border-zinc-700/60 overflow-x-auto pb-0.5">
                  <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mr-1">
                    <Filter className="w-3 h-3" /> Tipo:
                  </span>
                  {["all", "General", "Asistencia", "Desempeño", "Recomendación", "Aviso"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                        typeFilter === t
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300"
                      }`}
                    >
                      {t === "all" ? "Todos" : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feed de Mensajes */}
              <div className="p-5 sm:p-6 min-h-[380px] max-h-[500px] overflow-y-auto space-y-4 bg-gray-50/30 dark:bg-zinc-950/20">
                {isLoadingMessages ? (
                  <div className="py-16 text-center text-xs text-gray-400 animate-pulse flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                    <span>Cargando mensajes del docente...</span>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                    <MessageSquare className="w-8 h-8 text-gray-300 dark:text-zinc-700" />
                    <p className="font-semibold text-gray-600 dark:text-zinc-400">
                      No hay mensajes registrados con este filtro.
                    </p>
                    <p className="text-[11px] text-gray-400 max-w-sm">
                      Escribe un mensaje o consulta a tu docente en el formulario inferior.
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((m) => {
                    const isDocent = m.remitente_rol === "docente";
                    const isBroadcast = m.destinatario_tipo === "todos" || !m.estudiante_cedula;

                    const createdAtTime = m.created_at ? new Date(m.created_at).getTime() : 0;
                    const elapsedMs = currentTime - createdAtTime;
                    const isAuthor = !isDocent && (!m.remitente_cedula || String(m.remitente_cedula) === String(studentCedula));
                    const canDelete = isAuthor;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isDocent ? "items-start" : "items-end"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[78%] p-4 rounded-2xl border shadow-sm ${
                            isDocent
                              ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-white border-emerald-500/30 rounded-bl-sm ring-1 ring-emerald-500/10"
                              : "bg-emerald-600 text-white border-emerald-500/40 rounded-br-sm"
                          }`}
                        >
                          {/* Cabecera del mensaje */}
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap text-[11px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-[10px] ${
                                  isDocent
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                    : "bg-white/20 text-white"
                                }`}
                              >
                                {isDocent ? `Docente: ${m.docente_nombre || "Tutor"}` : "Tú (Estudiante)"}
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isDocent
                                    ? getBadgeForType(m.tipo)
                                    : "bg-black/20 text-white border-white/20"
                                }`}
                              >
                                {m.tipo || "General"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(m)}
                                  title="Eliminar mensaje"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 hover:bg-rose-600 text-white text-[10px] font-bold shadow-sm transition cursor-pointer"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                  <span>Eliminar</span>
                                </button>
                              )}
                              <span
                                className={`text-[10px] ${
                                  isDocent ? "text-gray-400 dark:text-zinc-500" : "text-emerald-100"
                                }`}
                              >
                                {m.created_at
                                  ? new Date(m.created_at).toLocaleString("es-CO", {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })
                                  : "Reciente"}
                              </span>
                            </div>
                          </div>

                          {/* Indicador de comunicado general */}
                          {isDocent && isBroadcast && (
                            <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              <Megaphone className="w-3 h-3" />
                              <span>Comunicado general para toda la práctica</span>
                            </div>
                          )}

                          {/* Título */}
                          {m.titulo && (
                            <h5
                              className={`text-xs font-black mb-1 ${
                                isDocent ? "text-gray-900 dark:text-white" : "text-white"
                              }`}
                            >
                              {m.titulo}
                            </h5>
                          )}

                          {/* Mensaje */}
                          <p
                            className={`text-xs leading-relaxed whitespace-pre-wrap ${
                              isDocent ? "text-gray-700 dark:text-zinc-300" : "text-emerald-50"
                            }`}
                          >
                            {m.mensaje}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Formulario de Envío */}
              <div className="p-5 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Enviar Mensaje al Docente</span>
                    </h4>
                    <span className="text-[11px] text-gray-400">
                      Destinatario: {currentPractice.docente_nombre || "Docente"}
                    </span>
                  </div>

                  {/* Asunto y Tipo */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                        Asunto o Título:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Consulta sobre turno, aclaración de actividades..."
                        value={messageForm.titulo}
                        onChange={(e) => setMessageForm((prev) => ({ ...prev, titulo: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                        Tipo:
                      </label>
                      <select
                        value={messageForm.tipo}
                        onChange={(e) => setMessageForm((prev) => ({ ...prev, tipo: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold cursor-pointer"
                      >
                        <option value="General">General</option>
                        <option value="Asistencia">Asistencia / Novedad</option>
                        <option value="Duda">Duda / Consulta</option>
                        <option value="Solicitud">Solicitud</option>
                      </select>
                    </div>
                  </div>

                  {/* Cuerpo del Mensaje */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                      Mensaje:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Escribe tu mensaje o consulta para el docente..."
                      value={messageForm.mensaje}
                      onChange={(e) => setMessageForm((prev) => ({ ...prev, mensaje: e.target.value }))}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none"
                    />
                  </div>

                  {/* Botón de Enviar */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSending || !messageForm.mensaje.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-black shadow-md shadow-emerald-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Enviando mensaje...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Mensaje al Docente</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 text-center">
              <Building className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Selecciona una práctica
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                Elige una de tus prácticas asignadas en la columna izquierda para abrir la comunicación directa con tu docente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDocentCommunication;
