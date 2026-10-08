// ============================================================
// DocentStudentCommunication.js — Centro de Comunicación Docente - Estudiantes UPTC
// Permite a los docentes tutores comunicarse directamente con los estudiantes
// de cada práctica clínica, enviar avisos a toda la cohorte o a estudiantes
// específicos, responder preguntas y revisar mensajes pendientes.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BACKEND_URL } from "../../config/api";
import { useDataSync, notifyDataChanged } from "../../utils/dataSync";
import { toast } from "react-toastify";
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
  Check,
  CheckCheck,
  Info,
  ChevronDown,
  Megaphone,
  Trash2,
  Mail,
} from "lucide-react";

const DocentStudentCommunication = () => {
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

  // Destinatarios en el formulario de envío
  const [recipientMode, setRecipientMode] = useState("all"); // 'all' | 'specific'
  const [selectedStudentCedulas, setSelectedStudentCedulas] = useState([]);

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
      const res = await fetch(`${BACKEND_URL}/api/docent/student-communication/messages/${msg.id}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al eliminar el mensaje.");

      setMessages((prev) =>
        prev.filter((m) => m.id !== msg.id && (!msg.grupo_envio_id || m.grupo_envio_id !== msg.grupo_envio_id))
      );
      toast.success("Mensaje eliminado exitosamente.");
      notifyDataChanged();
    } catch (err) {
      toast.error(err.message || "Error al eliminar el mensaje.");
    }
  };

  // 1. Cargar Prácticas del Docente con sus estudiantes y mensajes pendientes
  const fetchPractices = useCallback(async () => {
    setIsLoadingPractices(true);
    setError(null);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${BACKEND_URL}/api/docent/student-communication/practices`, { headers });
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
      console.error("Error al cargar prácticas en DocentStudentCommunication:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoadingPractices(false);
    }
  }, []);

  // 2. Cargar Mensajes de la Práctica Seleccionada
  const fetchMessages = useCallback(async (practiceId, studentCedula = "all") => {
    if (!practiceId) return;
    setIsLoadingMessages(true);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      let url = `${BACKEND_URL}/api/docent/student-communication/practices/${practiceId}/messages`;
      if (studentCedula && studentCedula !== "all") {
        url += `?studentCedula=${studentCedula}`;
      }

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);

        // Actualizar el conteo de no leídos en la lista de prácticas
        setPractices((prev) =>
          prev.map((p) => {
            if (String(p.id) === String(practiceId)) {
              if (studentCedula === "all") {
                return {
                  ...p,
                  unread_messages_count: 0,
                  estudiantes: (p.estudiantes || []).map((st) => ({ ...st, unread_count: 0 })),
                };
              } else {
                const updatedStudents = (p.estudiantes || []).map((st) =>
                  String(st.cedula) === String(studentCedula) ? { ...st, unread_count: 0 } : st
                );
                const remainingUnread = updatedStudents.reduce((sum, s) => sum + (s.unread_count || 0), 0);
                return {
                  ...p,
                  unread_messages_count: remainingUnread,
                  estudiantes: updatedStudents,
                };
              }
            }
            return p;
          })
        );

        window.dispatchEvent(new CustomEvent("uptc:messages-read"));
      }
    } catch (err) {
      console.error("Error al cargar mensajes de estudiantes:", err);
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
      fetchMessages(selectedPracticeId, selectedStudentFilter);
    }
  }, [selectedPracticeId, selectedStudentFilter, fetchMessages]);

  useDataSync(() => {
    fetchPractices();
    if (selectedPracticeId) fetchMessages(selectedPracticeId, selectedStudentFilter);
  });

  // Scroll automático al final cuando llegan mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Práctica actualmente seleccionada
  const currentPractice = useMemo(() => {
    return practices.find((p) => String(p.id) === String(selectedPracticeId)) || null;
  }, [practices, selectedPracticeId]);

  // Estudiantes de la práctica seleccionada
  const currentStudents = useMemo(() => {
    return currentPractice?.estudiantes || [];
  }, [currentPractice]);

  // Prácticas filtradas en la lista lateral
  const filteredPractices = useMemo(() => {
    if (!searchPractice.trim()) return practices;
    const term = searchPractice.toLowerCase();
    return practices.filter(
      (p) =>
        (p.titulo || "").toLowerCase().includes(term) ||
        (p.institucion_nombre || "").toLowerCase().includes(term) ||
        (p.servicio_nombre || "").toLowerCase().includes(term)
    );
  }, [practices, searchPractice]);

  // Mensajes filtrados en la vista principal
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (typeFilter !== "all" && m.tipo !== typeFilter) return false;
      if (selectedStudentFilter !== "all") {
        if (m.destinatario_tipo === "todos") return true;
        if (String(m.estudiante_cedula) !== String(selectedStudentFilter)) return false;
      }
      return true;
    });
  }, [messages, typeFilter, selectedStudentFilter]);

  // Manejador para alternar selección de estudiantes individuales en formulario
  const toggleStudentSelection = (cedula) => {
    setSelectedStudentCedulas((prev) => {
      const exists = prev.includes(cedula);
      if (exists) {
        return prev.filter((c) => c !== cedula);
      } else {
        return [...prev, cedula];
      }
    });
  };

  const selectAllStudents = () => {
    if (currentStudents.length === 0) return;
    setSelectedStudentCedulas(currentStudents.map((s) => s.cedula));
  };

  const clearStudentSelection = () => {
    setSelectedStudentCedulas([]);
  };

  // 3. Enviar Mensaje a Estudiantes
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageForm.mensaje.trim() || !selectedPracticeId) return;

    if (recipientMode === "specific" && selectedStudentCedulas.length === 0) {
      setError("Por favor selecciona al menos un estudiante destinatario.");
      return;
    }

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
        destinatario_tipo: recipientMode === "all" ? "todos" : "seleccionados",
        estudiante_cedulas: recipientMode === "all" ? [] : selectedStudentCedulas,
        titulo: messageForm.titulo.trim() || (recipientMode === "all" ? "Comunicado a toda la práctica" : "Mensaje del Docente"),
        mensaje: messageForm.mensaje.trim(),
        tipo: messageForm.tipo,
      };

      const res = await fetch(
        `${BACKEND_URL}/api/docent/student-communication/practices/${selectedPracticeId}/messages`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al enviar el mensaje.");

      setFeedbackSuccess(
        recipientMode === "all"
          ? "Comunicado enviado a todos los estudiantes de la práctica."
          : `Mensaje entregado a ${selectedStudentCedulas.length} estudiante(s) seleccionado(s).`
      );

      setMessageForm({
        titulo: "",
        mensaje: "",
        tipo: "General",
      });
      if (recipientMode === "specific") {
        setSelectedStudentCedulas([]);
      }

      await fetchMessages(selectedPracticeId, selectedStudentFilter);
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
              <span className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <GraduationCap className="w-5 h-5" />
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Comunicación con el Estudiante
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Canal directo institucional con los estudiantes asignados a cada práctica formativa para enviar avisos grupales, retroalimentaciones individuales y resolver consultas académicas.
            </p>
          </div>

          <button
            onClick={() => {
              fetchPractices();
              if (selectedPracticeId) fetchMessages(selectedPracticeId, selectedStudentFilter);
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
        {/* Columna Izquierda: Listado de Prácticas y Estudiantes (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-lg border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-blue-500" />
                <span>Tus Prácticas ({practices.length})</span>
              </h3>
            </div>

            {/* Buscador de prácticas */}
            <div className="relative mb-4">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por práctica u hospital..."
                value={searchPractice}
                onChange={(e) => setSearchPractice(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  const totalEstudiantes = pr.total_estudiantes || (pr.estudiantes || []).length;
                  const unreadCount = Number(pr.unread_messages_count || 0);

                  return (
                    <div
                      key={pr.id}
                      onClick={() => {
                        setSelectedPracticeId(pr.id);
                        setSelectedStudentFilter("all");
                        setSelectedStudentCedulas([]);
                      }}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2.5 select-none ${
                        isSelected
                          ? "bg-blue-500/10 border-blue-500/50 shadow-sm"
                          : "bg-gray-50/70 dark:bg-zinc-800/40 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800/70"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300"
                              }`}
                            >
                              #{pr.id} · {pr.estado || "Activa"}
                            </span>
                            {unreadCount > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-sm shadow-red-600/40 border border-white/20 animate-pulse"
                                title={`${unreadCount} mensaje(s) de estudiantes pendiente(s)`}
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
                          <Building className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                          <span className="truncate">{pr.institucion_nombre || "Sede Clínica"}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200/60 dark:border-zinc-700/60 flex items-center justify-between text-[11px]">
                        <span className="text-gray-500 dark:text-zinc-400 flex items-center gap-1">
                          <Users className="w-3 h-3 text-blue-500" />
                          <span>{totalEstudiantes} estudiante{totalEstudiantes !== 1 ? "s" : ""}</span>
                        </span>
                        <span
                          className={`font-bold flex items-center gap-1 ${
                            isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
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

        {/* Columna Derecha: Canal de Mensajes y Formulario de Envío (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {currentPractice ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col">
              {/* Cabecera del Chat con Datos de la Práctica */}
              <div className="p-5 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">
                        {currentPractice.titulo}
                      </h3>
                      <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                        {currentPractice.institucion_nombre || "Institución"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {currentStudents.length} estudiante(s) inscritos · Servicio: {currentPractice.servicio_nombre || "General"}
                    </p>
                  </div>

                  {/* Selector / Filtro por Estudiante */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                      Conversación:
                    </label>
                    <select
                      value={selectedStudentFilter}
                      onChange={(e) => setSelectedStudentFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer max-w-[220px] truncate"
                    >
                      <option value="all">Todos los estudiantes</option>
                      {currentStudents.map((st) => (
                        <option key={st.cedula} value={st.cedula}>
                          {st.nombre_completo} {st.unread_count > 0 ? `(${st.unread_count} sin leer)` : ""}
                        </option>
                      ))}
                    </select>
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
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300"
                      }`}
                    >
                      {t === "all" ? "Todos" : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenedor del Feed de Mensajes */}
              <div className="p-5 sm:p-6 min-h-[380px] max-h-[500px] overflow-y-auto space-y-4 bg-gray-50/30 dark:bg-zinc-950/20">
                {isLoadingMessages ? (
                  <div className="py-16 text-center text-xs text-gray-400 animate-pulse flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                    <span>Cargando mensajes de la práctica...</span>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                    <MessageSquare className="w-8 h-8 text-gray-300 dark:text-zinc-700" />
                    <p className="font-semibold text-gray-600 dark:text-zinc-400">
                      No hay mensajes registrados con los filtros aplicados.
                    </p>
                    <p className="text-[11px] text-gray-400 max-w-sm">
                      Envía un comunicado general o mensaje personalizado a los estudiantes usando el formulario inferior.
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((m) => {
                    const isDocent = m.remitente_rol === "docente";
                    const isBroadcast = m.destinatario_tipo === "todos" || !m.estudiante_cedula;

                    const createdAtTime = m.created_at ? new Date(m.created_at).getTime() : 0;
                    const elapsedMs = currentTime - createdAtTime;
                    const canDelete = isDocent && elapsedMs >= 0 && elapsedMs <= 5 * 60 * 1000;
                    const remainingSeconds = Math.max(0, Math.ceil((5 * 60 * 1000 - elapsedMs) / 1000));
                    const minsLeft = Math.floor(remainingSeconds / 60);
                    const secsLeft = remainingSeconds % 60;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isDocent ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[78%] p-4 rounded-2xl border shadow-sm ${
                            isDocent
                              ? "bg-blue-600 text-white border-blue-500/40 rounded-br-sm"
                              : "bg-white dark:bg-zinc-900 text-gray-900 dark:text-white border-gray-200 dark:border-zinc-800 rounded-bl-sm"
                          }`}
                        >
                          {/* Cabecera del mensaje */}
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap text-[11px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-[10px] ${
                                  isDocent
                                    ? "bg-white/20 text-white"
                                    : "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                                }`}
                              >
                                {isDocent ? "Docente (Tú)" : `Estudiante: ${m.remitente_nombre || "Estudiante"}`}
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isDocent
                                    ? "bg-black/20 text-white border-white/20"
                                    : getBadgeForType(m.tipo)
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
                                  title="Eliminar mensaje (solo disponible durante los primeros 5 minutos)"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 hover:bg-rose-600 text-white text-[10px] font-bold shadow-sm transition"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                  <span>Eliminar ({minsLeft}:{secsLeft < 10 ? `0${secsLeft}` : secsLeft})</span>
                                </button>
                              )}
                              <span
                                className={`text-[10px] ${
                                  isDocent ? "text-blue-100" : "text-gray-400 dark:text-zinc-500"
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

                          {/* Destinatario visual */}
                          {isDocent && (
                            <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-semibold">
                              {isBroadcast ? (
                                <>
                                  <Megaphone className="w-3 h-3 text-amber-300" />
                                  <span>Difusión a todos los estudiantes</span>
                                </>
                              ) : (
                                <>
                                  <User className="w-3 h-3 text-blue-200" />
                                  <span>
                                    Para: {m.estudiante_nombre_completo || `C.C. ${m.estudiante_cedula}`}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Título */}
                          {m.titulo && (
                            <h5
                              className={`text-xs font-black mb-1 ${
                                isDocent ? "text-white" : "text-gray-900 dark:text-white"
                              }`}
                            >
                              {m.titulo}
                            </h5>
                          )}

                          {/* Mensaje */}
                          <p
                            className={`text-xs leading-relaxed whitespace-pre-wrap ${
                              isDocent ? "text-blue-50" : "text-gray-700 dark:text-zinc-300"
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

              {/* Formulario de Envío de Mensaje */}
              <div className="p-5 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-blue-500" />
                      <span>Enviar Mensaje a Estudiantes</span>
                    </h4>
                    <span className="text-[11px] text-gray-400">
                      Práctica #{currentPractice.id}
                    </span>
                  </div>

                  {/* Selector de Destinatario: Todos o Selección Múltiple */}
                  <div className="bg-gray-50 dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-gray-200 dark:border-zinc-700/80 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                        Destinatarios del mensaje:
                      </span>

                      <div className="inline-flex rounded-xl bg-gray-200 dark:bg-zinc-700 p-0.5 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientMode("all");
                            setSelectedStudentCedulas([]);
                          }}
                          className={`px-3 py-1 rounded-lg transition ${
                            recipientMode === "all"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-gray-600 dark:text-zinc-300 hover:text-black dark:hover:text-white"
                          }`}
                        >
                          <span className="flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5" /> Todos los estudiantes ({currentStudents.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecipientMode("specific")}
                          className={`px-3 py-1 rounded-lg transition ${
                            recipientMode === "specific"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-gray-600 dark:text-zinc-300 hover:text-black dark:hover:text-white"
                          }`}
                        >
                          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Seleccionar estudiante(s)</span>
                        </button>
                      </div>
                    </div>

                    {/* Si eligió "Seleccionar estudiante(s) específico(s)" */}
                    {recipientMode === "specific" && (
                      <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 dark:text-zinc-400 font-semibold">
                            {selectedStudentCedulas.length} seleccionado(s) de {currentStudents.length}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={selectAllStudents}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                            >
                              Seleccionar todos
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={clearStudentSelection}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 font-bold"
                            >
                              Limpiar
                            </button>
                          </div>
                        </div>

                        {currentStudents.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">
                            No hay estudiantes asignados en esta práctica.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                            {currentStudents.map((st) => {
                              const isChecked = selectedStudentCedulas.includes(st.cedula);
                              return (
                                <div
                                  key={st.cedula}
                                  onClick={() => toggleStudentSelection(st.cedula)}
                                  className={`p-2 rounded-xl border text-xs cursor-pointer select-none flex items-center justify-between gap-2 transition ${
                                    isChecked
                                      ? "bg-blue-500/15 border-blue-500 text-blue-900 dark:text-blue-200 font-bold"
                                      : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-gray-300"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <div
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                                        isChecked
                                          ? "bg-blue-600 border-blue-600 text-white"
                                          : "border-gray-300 dark:border-zinc-600"
                                      }`}
                                    >
                                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span className="truncate">{st.nombre_completo}</span>
                                  </div>
                                  {st.codigo && (
                                    <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                                      {st.codigo}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Asunto y Tipo */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                        Asunto o Título:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Indicaciones para el turno de mañana, entrega de informe..."
                        value={messageForm.titulo}
                        onChange={(e) => setMessageForm((prev) => ({ ...prev, titulo: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">
                        Tipo de Mensaje:
                      </label>
                      <select
                        value={messageForm.tipo}
                        onChange={(e) => setMessageForm((prev) => ({ ...prev, tipo: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer"
                      >
                        <option value="General">General</option>
                        <option value="Asistencia">Asistencia</option>
                        <option value="Desempeño">Desempeño</option>
                        <option value="Recomendación">Recomendación</option>
                        <option value="Aviso">Aviso / Importante</option>
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
                      placeholder="Escribe el mensaje o retroalimentación para los estudiantes..."
                      value={messageForm.mensaje}
                      onChange={(e) => setMessageForm((prev) => ({ ...prev, mensaje: e.target.value }))}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium resize-none"
                    />
                  </div>

                  {/* Botón de Enviar */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSending || !messageForm.mensaje.trim()}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-black shadow-md shadow-blue-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Enviando mensaje...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {recipientMode === "all"
                              ? "Enviar a toda la práctica"
                              : `Enviar a ${selectedStudentCedulas.length} estudiante(s)`}
                          </span>
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
                Elige una práctica en la columna izquierda para ver la conversación con los estudiantes y enviarles mensajes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocentStudentCommunication;
