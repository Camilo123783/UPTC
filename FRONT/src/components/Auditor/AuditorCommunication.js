// ============================================================
// AuditorCommunication.js — Centro de Comunicación Auditor - Docente UPTC
// Permite al auditor comunicarse directamente con los docentes a cargo
// de cada práctica clínica, enviar observaciones y avisos sobre estudiantes.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { BACKEND_URL } from "../../config/api";
import { useDataSync, notifyDataChanged } from "../../utils/dataSync";
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
  Sparkles,
  Clock,
  ArrowRight,
  ShieldCheck,
  Trash2,
  Mail,
} from "lucide-react";

const AuditorCommunication = () => {
  const [practices, setPractices] = useState([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingPractices, setIsLoadingPractices] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(null);

  // Filtros
  const [searchPractice, setSearchPractice] = useState("");
  const [selectedStudentFilter, setSelectedStudentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Formulario de Envío
  const [messageForm, setMessageForm] = useState({
    titulo: "",
    mensaje: "",
    tipo: "General",
    estudiante_cedula: "",
  });

  const [currentTime, setCurrentTime] = useState(Date.now());
  const messagesEndRef = useRef(null);

  // Contador en vivo para el tiempo límite de 5 minutos de eliminación
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      const res = await fetch(`${BACKEND_URL}/api/auditor/practices/${selectedPracticeId}/messages/${msg.id}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al eliminar el mensaje.");

      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      toast.success("Mensaje eliminado exitosamente.");
      notifyDataChanged();
    } catch (err) {
      toast.error(err.message || "Error al eliminar el mensaje.");
    }
  };

  // 1. Cargar Prácticas a cargo del Auditor
  const fetchPractices = useCallback(async () => {
    setIsLoadingPractices(true);
    setError(null);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${BACKEND_URL}/api/auditor/practices`, { headers });
      if (!res.ok) throw new Error("No se pudieron cargar las prácticas asignadas.");
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
      console.error("Error al cargar prácticas en AuditorCommunication:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoadingPractices(false);
    }
  }, []);

  // 2. Cargar Mensajes de la Práctica Seleccionada
  const fetchMessages = useCallback(async (practiceId) => {
    if (!practiceId) return;
    setIsLoadingMessages(true);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${BACKEND_URL}/api/auditor/practices/${practiceId}/messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
        setPractices((prev) =>
          prev.map((p) =>
            String(p.id) === String(practiceId)
              ? { ...p, unread_messages_count: 0 }
              : p
          )
        );
        window.dispatchEvent(new CustomEvent("uptc:messages-read"));
      }
    } catch (err) {
      console.error("Error al cargar mensajes de la práctica:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

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

  // Prácticas filtradas en la lista lateral
  const filteredPractices = useMemo(() => {
    if (!searchPractice.trim()) return practices;
    const term = searchPractice.toLowerCase();
    return practices.filter(
      (p) =>
        (p.titulo || "").toLowerCase().includes(term) ||
        (p.institucion_nombre || "").toLowerCase().includes(term) ||
        (p.docente_nombre || "").toLowerCase().includes(term) ||
        (p.servicio_nombre || "").toLowerCase().includes(term)
    );
  }, [practices, searchPractice]);

  // Mensajes filtrados en la vista principal
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (typeFilter !== "all" && m.tipo !== typeFilter) return false;
      if (selectedStudentFilter !== "all" && String(m.estudiante_cedula) !== String(selectedStudentFilter)) return false;
      return true;
    });
  }, [messages, typeFilter, selectedStudentFilter]);

  // 3. Enviar Mensaje
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
      const res = await fetch(`${BACKEND_URL}/api/auditor/practices/${selectedPracticeId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          titulo: messageForm.titulo.trim() || "Comunicado del Auditor",
          mensaje: messageForm.mensaje.trim(),
          tipo: messageForm.tipo,
          estudiante_cedula: messageForm.estudiante_cedula || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al enviar el mensaje.");

      setFeedbackSuccess("Mensaje entregado al docente exitosamente.");
      setMessageForm({
        titulo: "",
        mensaje: "",
        tipo: "General",
        estudiante_cedula: "",
      });

      // Recargar mensajes y notificar sincronización global
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
      case "Alerta":
      case "Novedad":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
      default:
        return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Encabezado ─── */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <MessageSquare className="w-5 h-5" />
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Comunicación con Docentes
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Canal directo institucional para reportar novedades asistenciales, desempeño de estudiantes y consultas al docente.
            </p>
          </div>

          <button
            onClick={() => {
              fetchPractices();
              if (selectedPracticeId) fetchMessages(selectedPracticeId);
            }}
            className="self-start sm:self-auto px-3.5 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        {/* ─── Alertas globales ─── */}
        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {feedbackSuccess && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}

        {/* ─── Contenedor Grid Principal (Lista de Prácticas + Área de Mensajes) ─── */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
          {/* ──── COLUMNA IZQUIERDA: Selector de Prácticas y Docentes (4 cols) ──── */}
          <div className="lg:col-span-4 flex flex-col space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchPractice}
                onChange={(e) => setSearchPractice(e.target.value)}
                placeholder="Buscar por práctica, hospital o docente..."
                className="w-full pl-10 pr-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] pr-1">
              {isLoadingPractices ? (
                <div className="text-center py-10 text-xs text-gray-500 dark:text-zinc-500">
                  Cargando prácticas asignadas...
                </div>
              ) : filteredPractices.length === 0 ? (
                <div className="p-4 text-center rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-dashed border-gray-200 dark:border-zinc-700 text-xs text-gray-500">
                  No se encontraron prácticas a cargo.
                </div>
              ) : (
                filteredPractices.map((pr) => {
                  const isSelected = String(pr.id) === String(selectedPracticeId);
                  const enrolledCount = pr.estudiantes?.length || 0;

                  return (
                    <div
                      key={pr.id}
                      onClick={() => setSelectedPracticeId(pr.id)}
                      className={`p-4 rounded-2xl border transition cursor-pointer text-left ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500/60 dark:bg-amber-500/15 dark:border-amber-500/50 shadow-sm"
                          : "bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800/80 border-gray-200 dark:border-zinc-700/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {pr.titulo || pr.servicio_nombre || `Práctica #${pr.id}`}
                          </h4>
                          <p className="text-[11px] text-gray-600 dark:text-zinc-400 truncate mt-0.5 flex items-center gap-1">
                            <Building className="w-3 h-3 flex-shrink-0" />
                            <span>{pr.institucion_nombre || "Hospital Asignado"}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Number(pr.unread_messages_count) > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-sm shadow-red-600/40 border border-white/20 animate-pulse"
                              title={`${pr.unread_messages_count} mensaje(s) pendiente(s) del docente`}
                            >
                              <Mail className="w-3 h-3" />
                              <span>{pr.unread_messages_count} pendiente{Number(pr.unread_messages_count) > 1 ? "s" : ""}</span>
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                            {pr.periodo || "Activa"}
                          </span>
                        </div>
                      </div>

                      {/* Info Docente */}
                      <div className="mt-3 pt-2.5 border-t border-gray-200 dark:border-zinc-700/60 flex items-center justify-between text-[11px]">
                        <span className="text-gray-700 dark:text-zinc-300 font-medium truncate flex items-center gap-1">
                          <User className="w-3 h-3 text-amber-500" />
                          <span>{pr.docente_nombre || "Docente no asignado"}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {Number(pr.unread_messages_count) > 0 && (
                            <span className="text-[10px] font-black text-red-500 flex items-center gap-0.5">
                              ● {pr.unread_messages_count} nuevo{Number(pr.unread_messages_count) > 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-semibold flex items-center gap-0.5">
                            <Users className="w-3 h-3" />
                            <span>{enrolledCount} est.</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ──── COLUMNA DERECHA: Hilo de Conversación y Formulario (8 cols) ──── */}
          <div className="lg:col-span-8 flex flex-col bg-gray-50/70 dark:bg-zinc-800/40 rounded-2xl border border-gray-200 dark:border-zinc-700/70 p-4 sm:p-5">
            {currentPractice ? (
              <>
                {/* Cabecera de la práctica actual */}
                <div className="pb-4 border-b border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <span>{currentPractice.titulo || "Práctica Formativa"}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {currentPractice.estado || "Activa"}
                      </span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-zinc-400 mt-1">
                      <span className="flex items-center gap-1 font-semibold text-gray-900 dark:text-zinc-200">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                        <span>Docente: {currentPractice.docente_nombre || "Sin asignar"}</span>
                      </span>
                      {currentPractice.docente_correo && (
                        <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                          ({currentPractice.docente_correo})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Filtros de Mensajes */}
                  <div className="flex items-center gap-2">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
                    >
                      <option value="all">Todos los tipos</option>
                      <option value="General">General</option>
                      <option value="Asistencia">Asistencia</option>
                      <option value="Desempeño">Desempeño</option>
                      <option value="Recomendación">Recomendación</option>
                      <option value="Novedad">Novedad</option>
                    </select>

                    <select
                      value={selectedStudentFilter}
                      onChange={(e) => setSelectedStudentFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 max-w-[150px] truncate"
                    >
                      <option value="all">Todos los estudiantes</option>
                      {(currentPractice.estudiantes || []).map((s) => (
                        <option key={s.cedula} value={s.cedula}>
                          {s.nombre_completo || s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Hilo de Mensajes */}
                <div className="flex-1 overflow-y-auto space-y-3 py-4 max-h-[360px] pr-2">
                  {isLoadingMessages ? (
                    <div className="text-center py-12 text-xs text-gray-500">
                      Cargando historial de comunicaciones...
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-2xl bg-white/50 dark:bg-zinc-900/40 border border-dashed border-gray-200 dark:border-zinc-800">
                      <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                        No hay mensajes registrados con los filtros seleccionados.
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
                        Utiliza el formulario inferior para redactar un comunicado o reporte al docente.
                      </p>
                    </div>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isFromMe = msg.autor_rol === "auditor";
                      const canDelete = isFromMe;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isFromMe ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-3xl p-4 sm:p-5 shadow-sm border space-y-2 transition ${
                              isFromMe
                                ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/10"
                                : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white"
                            }`}
                          >
                            {/* Encabezado del Mensaje */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-gray-100 dark:border-zinc-800/80">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    isFromMe
                                      ? "bg-white/20 text-white"
                                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                  }`}
                                >
                                  {isFromMe ? (
                                    <>
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>Auditor Clínico (Tú)</span>
                                    </>
                                  ) : (
                                    <>
                                      <GraduationCap className="w-3 h-3" />
                                      <span>Docente</span>
                                    </>
                                  )}
                                </span>

                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isFromMe
                                      ? "bg-white/10 text-white border-white/20"
                                      : getBadgeForType(msg.tipo)
                                  }`}
                                >
                                  {msg.tipo || "General"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(msg)}
                                    title="Eliminar mensaje"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 hover:bg-rose-600 text-white text-[10px] font-bold shadow-sm transition cursor-pointer"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                    <span>Eliminar</span>
                                  </button>
                                )}
                                <span
                                  className={`text-[10px] flex items-center gap-1 ${
                                    isFromMe ? "text-blue-200" : "text-gray-400 dark:text-zinc-500"
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {msg.created_at
                                      ? new Date(msg.created_at).toLocaleString("es-CO", {
                                          dateStyle: "short",
                                          timeStyle: "short",
                                        })
                                      : "Reciente"}
                                  </span>
                                </span>
                              </div>
                            </div>

                            {/* Título */}
                            {msg.titulo && (
                              <h4
                                className={`text-xs font-black tracking-tight ${
                                  isFromMe ? "text-white" : "text-gray-900 dark:text-white"
                                }`}
                              >
                                {msg.titulo}
                              </h4>
                            )}

                            {/* Estudiante Vinculado */}
                            {msg.estudiante_nombre && (
                              <div
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                  isFromMe
                                    ? "bg-white/20 text-white"
                                    : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                }`}
                              >
                                <Users className="w-2.5 h-2.5" />
                                <span>Estudiante: {msg.estudiante_nombre}</span>
                              </div>
                            )}

                            {/* Cuerpo del Mensaje */}
                            <p
                              className={`text-xs leading-relaxed whitespace-pre-wrap ${
                                isFromMe
                                  ? "text-white/95 font-normal"
                                  : "text-gray-700 dark:text-zinc-300 font-normal"
                              }`}
                            >
                              {msg.mensaje}
                            </p>

                            {/* Pie del mensaje */}
                            <div
                              className={`text-[10px] pt-1 flex items-center justify-between border-t ${
                                isFromMe
                                  ? "text-blue-200 border-white/10"
                                  : "text-gray-400 dark:text-zinc-500 border-gray-100 dark:border-zinc-800"
                              }`}
                            >
                              <span>
                                {isFromMe
                                  ? "Enviado por ti"
                                  : `Enviado por: ${msg.autor_nombre || "Docente"}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Formulario de Redacción */}
                <form
                  onSubmit={handleSendMessage}
                  className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Asunto / Título (ej. Turno Extra, Puntualidad)..."
                      value={messageForm.titulo}
                      onChange={(e) => setMessageForm({ ...messageForm, titulo: e.target.value })}
                      className="sm:col-span-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />

                    <select
                      value={messageForm.tipo}
                      onChange={(e) => setMessageForm({ ...messageForm, tipo: e.target.value })}
                      className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="General">Tipo: General</option>
                      <option value="Asistencia">Tipo: Asistencia</option>
                      <option value="Desempeño">Tipo: Desempeño Clínico</option>
                      <option value="Recomendación">Tipo: Recomendación / Calificación</option>
                      <option value="Novedad">Tipo: Novedad / Alerta</option>
                    </select>

                    <select
                      value={messageForm.estudiante_cedula}
                      onChange={(e) => setMessageForm({ ...messageForm, estudiante_cedula: e.target.value })}
                      className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">(Opcional) Vincular a estudiante...</option>
                      {(currentPractice.estudiantes || []).map((st) => (
                        <option key={st.cedula} value={st.cedula}>
                          {st.nombre_completo || st.nombre} {st.codigo ? `(${st.codigo})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      placeholder={`Escribe tu mensaje para el docente ${currentPractice.docente_nombre || "tutor"}...`}
                      value={messageForm.mensaje}
                      onChange={(e) => setMessageForm({ ...messageForm, mensaje: e.target.value })}
                      required
                      className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />

                    <button
                      type="submit"
                      disabled={isSending || !messageForm.mensaje.trim()}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-gray-900 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSending ? "Enviando..." : "Enviar"}</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <Building className="w-12 h-12 text-gray-400 mb-3 opacity-40" />
                <h4 className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                  Selecciona una práctica asignada
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Elige una práctica en la columna izquierda para abrir el hilo de comunicación directa con el docente a cargo.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditorCommunication;
