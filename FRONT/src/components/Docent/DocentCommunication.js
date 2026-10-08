// ============================================================
// DocentCommunication.js — Centro de Comunicación Docente - Auditor UPTC
// Permite a los docentes tutores comunicarse directamente con los auditores
// clínicos asignados a sus prácticas formativas y revisar todos los mensajes,
// avisos de asistencia y reportes de desempeño enviados por los auditores.
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
  Stethoscope,
  Info,
  Trash2,
  Mail,
  Building2,
} from "lucide-react";

const DocentCommunication = () => {
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
      const res = await fetch(`${BACKEND_URL}/api/docent/practices/${selectedPracticeId}/messages/${msg.id}`, {
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

  // 1. Cargar Prácticas del Docente (con información de auditores y estudiantes)
  const fetchPractices = useCallback(async () => {
    setIsLoadingPractices(true);
    setError(null);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${BACKEND_URL}/api/docent/practices`, { headers });
      if (!res.ok) throw new Error("No se pudieron cargar las prácticas asignadas al docente.");
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
      console.error("Error al cargar prácticas en DocentCommunication:", err);
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
      const res = await fetch(`${BACKEND_URL}/api/docent/practices/${practiceId}/messages`, { headers });
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
        (p.auditor_nombre || "").toLowerCase().includes(term) ||
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

  // Conteo de mensajes enviados por el auditor en esta práctica
  const auditorMessagesCount = useMemo(() => {
    return messages.filter((m) => m.autor_rol === "auditor").length;
  }, [messages]);

  // 3. Enviar Mensaje o Respuesta al Auditor
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
      const res = await fetch(`${BACKEND_URL}/api/docent/practices/${selectedPracticeId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          titulo: messageForm.titulo.trim() || "Respuesta del Docente",
          mensaje: messageForm.mensaje.trim(),
          tipo: messageForm.tipo,
          estudiante_cedula: messageForm.estudiante_cedula || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al enviar el mensaje.");

      setFeedbackSuccess("Mensaje entregado al auditor clínico exitosamente.");
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
              <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <MessageSquare className="w-5 h-5" />
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Comunicación con el Auditor
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Canal directo para revisar novedades, confirmaciones de asistencia, reportes de desempeño y responder al auditor a cargo de cada escenario de práctica.
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

      {/* ─── Grid de Comunicación: Selector de Prácticas + Muro de Mensajes ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Listado de Prácticas y Auditor a Cargo (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-lg border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-amber-500" />
                <span>Tus Prácticas ({practices.length})</span>
              </h3>
            </div>

            {/* Buscador de prácticas */}
            <div className="relative mb-4">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar práctica, hospital o auditor..."
                value={searchPractice}
                onChange={(e) => setSearchPractice(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Lista de Prácticas */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {isLoadingPractices ? (
                <div className="py-8 text-center text-xs text-gray-400 animate-pulse">
                  Cargando prácticas asignadas...
                </div>
              ) : filteredPractices.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No se encontraron prácticas.
                </div>
              ) : (
                filteredPractices.map((pr) => {
                  const isSelected = String(pr.id) === String(selectedPracticeId);
                  const auditorName = pr.auditor_nombre || "Auditor Clínico";

                  return (
                    <div
                      key={pr.id}
                      onClick={() => setSelectedPracticeId(pr.id)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2.5 select-none ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500/50 shadow-sm"
                          : "bg-gray-50/70 dark:bg-zinc-800/40 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800/70"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? "bg-amber-500 text-white"
                                  : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300"
                              }`}
                            >
                              #{pr.id} · {pr.estado || "Activa"}
                            </span>
                            {Number(pr.unread_messages_count) > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-sm shadow-red-600/40 border border-white/20 animate-pulse"
                                title={`${pr.unread_messages_count} mensaje(s) pendiente(s) del auditor`}
                              >
                                <Mail className="w-3 h-3" />
                                <span>{pr.unread_messages_count} pendiente{Number(pr.unread_messages_count) > 1 ? "s" : ""}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-semibold">
                            Periodo {pr.periodo || "2026-1"}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-gray-900 dark:text-white mt-1.5 line-clamp-1">
                          {pr.titulo}
                        </h4>

                        <p className="text-[11px] text-gray-500 dark:text-zinc-400 line-clamp-1 mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-gray-400" /> {pr.institucion_nombre || "Hospital Universitario"}
                        </p>
                      </div>

                      {/* Auditor a cargo */}
                      <div className="pt-2 border-t border-gray-200/60 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                        <span className="text-gray-600 dark:text-zinc-300 flex items-center gap-1 font-medium truncate">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span className="truncate">{auditorName}</span>
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {Number(pr.unread_messages_count) > 0 && (
                            <span className="text-[10px] font-black text-red-500 flex items-center gap-0.5">
                              ● {pr.unread_messages_count} nuevo{Number(pr.unread_messages_count) > 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            {isSelected ? "Seleccionada →" : "Ver chat"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Muro de Mensajes + Formulario de Respuesta (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {currentPractice ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col">
              {/* Tarjeta del Auditor a Cargo */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-gray-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/20">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          Auditor Clínico a Cargo
                        </span>
                        {auditorMessagesCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                            {auditorMessagesCount} mensaje(s) del auditor
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                        {currentPractice.auditor_nombre || "Auditor Asignado del Escenario Clínico"}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-gray-400" /> {currentPractice.institucion_nombre || "Institución Hospitalaria"}</span>
                        {currentPractice.auditor_correo && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" /> {currentPractice.auditor_correo}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:text-right hidden sm:block">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {currentPractice.titulo}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                      {currentPractice.estudiantes?.length || 0} estudiante(s) en rotación
                    </p>
                  </div>
                </div>

                {/* Filtros de Mensajes */}
                <div className="mt-5 pt-4 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 flex items-center gap-1 mr-1">
                      <Filter className="w-3 h-3" /> Tipo:
                    </span>
                    {["all", "Asistencia", "Desempeño", "General", "Recomendación"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeFilter(t)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                          typeFilter === t
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {t === "all" ? "Todos" : t}
                      </button>
                    ))}
                  </div>

                  {/* Filtro por Estudiante */}
                  {currentPractice.estudiantes && currentPractice.estudiantes.length > 0 && (
                    <select
                      value={selectedStudentFilter}
                      onChange={(e) => setSelectedStudentFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="all">Todos los estudiantes</option>
                      {currentPractice.estudiantes.map((st) => (
                        <option key={st.cedula} value={st.cedula}>
                          {st.nombre} {st.apellidos}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Feed de Conversación / Mensajes */}
              <div className="p-5 sm:p-6 bg-gray-50/50 dark:bg-zinc-950/40 min-h-[380px] max-h-[460px] overflow-y-auto space-y-4">
                {isLoadingMessages ? (
                  <div className="text-center py-16 text-xs text-gray-400 animate-pulse">
                    Cargando mensajes de la práctica...
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center py-16 px-4 space-y-2">
                    <MessageSquare className="w-10 h-10 text-gray-300 dark:text-zinc-700 mx-auto" />
                    <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                      No hay mensajes en esta rotación bajo los filtros aplicados.
                    </p>
                    <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                      Los comunicados enviados por el auditor clínico aparecerán en esta sección. Puedes enviar una indicación o consulta mediante el formulario inferior.
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((m) => {
                    const isFromAuditor = m.autor_rol === "auditor";
                    const isClinicalReport = (m.mensaje || "").includes("[REPORTE CLÍNICO DEL AUDITOR]");
                    const isDocentSender = !isFromAuditor;
                    const canDelete = isDocentSender;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          isFromAuditor ? "items-start" : "items-end"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-3xl p-4 sm:p-5 shadow-sm border space-y-2 transition ${
                            isFromAuditor
                              ? isClinicalReport
                                ? "bg-amber-500/10 border-amber-500/30 text-gray-900 dark:text-white"
                                : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white"
                              : "bg-blue-600 text-white border-blue-600 shadow-blue-500/10"
                          }`}
                        >
                          {/* Encabezado del Mensaje */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-gray-100 dark:border-zinc-800/80">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  isFromAuditor
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                    : "bg-white/20 text-white"
                                }`}
                              >
                                {isFromAuditor ? (
                                  <>
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Auditor Clínico</span>
                                  </>
                                ) : (
                                  <>
                                    <GraduationCap className="w-3 h-3" />
                                    <span>Docente (Tú)</span>
                                  </>
                                )}
                              </span>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isFromAuditor
                                    ? getBadgeForType(m.tipo)
                                    : "bg-white/10 text-white border-white/20"
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
                                  isFromAuditor ? "text-gray-400 dark:text-zinc-500" : "text-blue-200"
                                }`}
                              >
                                {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                              </span>
                            </div>
                          </div>

                          {/* Título */}
                          {m.titulo && (
                            <h4
                              className={`text-xs font-black tracking-tight ${
                                isFromAuditor ? "text-gray-900 dark:text-white" : "text-white"
                              }`}
                            >
                              {m.titulo}
                            </h4>
                          )}

                          {/* Estudiante Etiquetado */}
                          {m.estudiante_nombre && (
                            <div
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                isFromAuditor
                                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                  : "bg-white/20 text-white"
                              }`}
                            >
                              <Users className="w-2.5 h-2.5" />
                              <span>Estudiante: {m.estudiante_nombre}</span>
                            </div>
                          )}

                          {/* Cuerpo del Mensaje */}
                          <p
                            className={`text-xs leading-relaxed whitespace-pre-wrap ${
                              isFromAuditor
                                ? "text-gray-700 dark:text-zinc-300 font-normal"
                                : "text-white/95 font-normal"
                            }`}
                          >
                            {m.mensaje}
                          </p>

                          {/* Pie del mensaje */}
                          <div
                            className={`text-[10px] pt-1 flex items-center justify-between ${
                              isFromAuditor ? "text-gray-400 dark:text-zinc-500" : "text-blue-200"
                            }`}
                          >
                            <span>
                              {isFromAuditor
                                ? `Enviado por: ${m.autor_display_nombre || m.autor_nombre || "Auditor Clínico"}`
                                : "Enviado por ti"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Formulario de Respuesta / Envío de Mensaje al Auditor */}
              <form onSubmit={handleSendMessage} className="p-5 sm:p-6 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-amber-500" />
                    <span>Responder al Auditor Clínico</span>
                  </h4>
                  <span className="text-[11px] text-gray-500">
                    Destinatario: <strong>{currentPractice.auditor_nombre || "Auditor Asignado"}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                      Asunto o Título:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Aclaración sobre turnos o seguimiento"
                      value={messageForm.titulo}
                      onChange={(e) => setMessageForm({ ...messageForm, titulo: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                        Tipo:
                      </label>
                      <select
                        value={messageForm.tipo}
                        onChange={(e) => setMessageForm({ ...messageForm, tipo: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="General">General</option>
                        <option value="Asistencia">Asistencia</option>
                        <option value="Desempeño">Desempeño</option>
                        <option value="Recomendación">Recomendación</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                        Estudiante (opcional):
                      </label>
                      <select
                        value={messageForm.estudiante_cedula}
                        onChange={(e) => setMessageForm({ ...messageForm, estudiante_cedula: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Ninguno / Toda la práctica</option>
                        {(currentPractice.estudiantes || []).map((st) => (
                          <option key={st.cedula} value={st.cedula}>
                            {st.nombre} {st.apellidos}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                    Mensaje para el Auditor:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Escribe el mensaje o retroalimentación para el auditor del hospital..."
                    value={messageForm.mensaje}
                    onChange={(e) => setMessageForm({ ...messageForm, mensaje: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSending || !messageForm.mensaje.trim()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? "Enviando comunicado..." : "Enviar Mensaje al Auditor"}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-16 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-md">
              <Building className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-50" />
              <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                Selecciona una práctica para abrir el canal con el auditor
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Podrás revisar el historial de mensajes enviados por el auditor clínico del hospital y responder de inmediato.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocentCommunication;
