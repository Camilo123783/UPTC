// ============================================================
// src/components/History/HistoryModule.js — Módulo de Historial
// ============================================================
import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "../../utils/toast";
import {
  Search,
  Calendar,
  Clock,
  Building2,
  BookOpen,
  GraduationCap,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Eye,
  Award,
  ChevronRight,
  Filter,
  Download,
  Printer,
  ShieldCheck,
  Hospital,
  RefreshCw,
  FolderArchive,
  Info,
  X,
  UserCheck,
  FileCheck
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { useTheme } from "../../context/ThemeContext";

const API_BASE_URL = BACKEND_URL;

const formatDateReadable = (dateStr) => {
  if (!dateStr) return "Por definir";
  try {
    const parts = String(dateStr).substring(0, 10).split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
    }
  } catch (e) {}
  return dateStr;
};

const HistoryModule = ({ userRole }) => {
  const { isDark } = useTheme();

  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos"); // "Todos", "Finalizada", "Cancelada"
  const [periodFilter, setPeriodFilter] = useState("Todos");
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Obtener token para peticiones
  const getAuthHeaders = () => {
    const token =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Cargar datos del historial desde la API
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/history`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al cargar el historial.");
      }

      const res = await response.json();
      setHistoryList(res.data || []);
    } catch (err) {
      console.error("Error al cargar historial:", err);
      toast.error(err.message || "No se pudo cargar el historial.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Sincronización manual para administradores
  const handleSyncHistory = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/history/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Error en la sincronización.");
      }

      toast.success("Historial sincronizado con éxito.");
      await fetchHistory();
    } catch (err) {
      toast.error(err.message || "Error al sincronizar historial.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Períodos únicos disponibles para el filtro
  const availablePeriods = useMemo(() => {
    const periods = new Set();
    historyList.forEach((p) => {
      if (p.periodo) periods.add(p.periodo);
    });
    return Array.from(periods).sort().reverse();
  }, [historyList]);

  // Métricas generales
  const metrics = useMemo(() => {
    const total = historyList.length;
    const finalizadas = historyList.filter((p) => p.estado === "Finalizada").length;
    const canceladas = historyList.filter((p) => p.estado === "Cancelada").length;
    const totalEstudiantes = historyList.reduce((acc, p) => acc + (p.total_estudiantes || 0), 0);

    return { total, finalizadas, canceladas, totalEstudiantes };
  }, [historyList]);

  // Filtrado reactivo con buscador multi-campo
  const filteredList = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return historyList.filter((item) => {
      // Filtro de Estado
      if (statusFilter !== "Todos" && item.estado !== statusFilter) {
        return false;
      }

      // Filtro de Periodo
      if (periodFilter !== "Todos" && item.periodo !== periodFilter) {
        return false;
      }

      // Buscador
      if (q) {
        const titleMatch = (item.titulo || "").toLowerCase().includes(q);
        const periodoMatch = (item.periodo || "").toLowerCase().includes(q);
        const progMatch = (item.programa_nombre || "").toLowerCase().includes(q);
        const asigMatch = (item.asignatura_nombre || "").toLowerCase().includes(q);
        const instMatch = (item.institucion_nombre || "").toLowerCase().includes(q);
        const servMatch = (item.servicio_nombre || "").toLowerCase().includes(q);
        const docMatch = (item.docente_nombre || "").toLowerCase().includes(q);
        const motivoMatch = (item.motivo_cancelacion || "").toLowerCase().includes(q);

        // Búsqueda en estudiantes vinculados
        const studentMatch = (item.estudiantes || []).some((st) => {
          const name = (st.nombre_completo || `${st.nombre} ${st.apellidos}`).toLowerCase();
          const code = String(st.codigo || "").toLowerCase();
          const ced = String(st.cedula || "").toLowerCase();
          return name.includes(q) || code.includes(q) || ced.includes(q);
        });

        return (
          titleMatch ||
          periodoMatch ||
          progMatch ||
          asigMatch ||
          instMatch ||
          servMatch ||
          docMatch ||
          motivoMatch ||
          studentMatch
        );
      }

      return true;
    });
  }, [historyList, searchTerm, statusFilter, periodFilter]);

  // Abrir modal de detalle
  const handleOpenDetail = (practice) => {
    setSelectedPractice(practice);
    setIsModalOpen(true);
  };

  // Ver documento de estudiante
  const handleViewDocument = (studentCedula, docType) => {
    const token =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const docUrl = `${API_BASE_URL}/api/student/documents/${studentCedula}/${docType}?view=true${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    window.open(docUrl, "_blank", "noopener,noreferrer");
  };

  // Función para imprimir el expediente actual
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto">
      {/* ── Encabezado Principal ── */}
      <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm transition-all ${
        isDark 
          ? "bg-zinc-900/80 border-zinc-800 text-white" 
          : "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border-amber-200/60 text-zinc-900"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                <FolderArchive className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Historial de Prácticas
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {userRole === "admin" || userRole === "superadmin"
                    ? "Registro centralizado de prácticas formativas finalizadas y canceladas en la institución."
                    : userRole === "docent"
                    ? "Expediente histórico de prácticas bajo tu tutoría formativa que han concluido o fueron canceladas."
                    : "Expediente oficial de tus prácticas y rotaciones formativas finalizadas o canceladas."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={fetchHistory}
              disabled={isLoading}
              className={`p-2.5 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                isDark
                  ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200"
                  : "bg-white border-gray-300 hover:bg-gray-100 text-gray-700 shadow-sm"
              }`}
              title="Refrescar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Tarjetas de Métricas Resumen ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-gray-200/60 dark:border-zinc-800/80">
          <div className={`p-4 rounded-2xl border ${
            isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-gray-200/70"
          }`}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
              Total Archivadas
            </span>
            <div className="text-2xl font-black">{metrics.total}</div>
          </div>

          <div className={`p-4 rounded-2xl border ${
            isDark ? "bg-emerald-950/20 border-emerald-900/40" : "bg-emerald-50/70 border-emerald-200/80"
          }`}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Finalizadas
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.finalizadas}
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${
            isDark ? "bg-rose-950/20 border-rose-900/40" : "bg-rose-50/70 border-rose-200/80"
          }`}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block mb-1 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Canceladas
            </span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {metrics.canceladas}
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${
            isDark ? "bg-blue-950/20 border-blue-900/40" : "bg-blue-50/70 border-blue-200/80"
          }`}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Estudiantes Registrados
            </span>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {metrics.totalEstudiantes}
            </div>
          </div>
        </div>
      </div>

      {/* ── Barra de Búsqueda y Filtros ── */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm space-y-4 ${
        isDark ? "bg-zinc-900/70 border-zinc-800" : "bg-white border-gray-200/80"
      }`}>
        <div className="flex flex-col md:flex-row gap-3">
          {/* Input Buscador */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, docente, estudiante, código, materia, institución o motivo..."
              className={`w-full pl-11 pr-10 py-3 rounded-xl border text-sm outline-none transition ${
                isDark
                  ? "bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-white"
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro por Período */}
          <div className="w-full md:w-56 flex-shrink-0">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className={`w-full py-3 px-3.5 rounded-xl border text-sm outline-none transition font-medium ${
                isDark
                  ? "bg-zinc-900 border-zinc-800 text-white"
                  : "bg-gray-50 border-gray-300 text-gray-900 focus:bg-white"
              }`}
            >
              <option value="Todos">Todos los Periodos</option>
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  Periodo: {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pestañas de Estado */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter("Todos")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === "Todos"
                  ? "bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950 shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
              }`}
            >
              Todas ({historyList.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Finalizada")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "Finalizada"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Finalizadas ({metrics.finalizadas})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Cancelada")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "Cancelada"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Canceladas ({metrics.canceladas})
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Mostrando <span className="font-bold text-gray-900 dark:text-white">{filteredList.length}</span> registros
          </div>
        </div>
      </div>

      {/* ── Listado de Registros del Historial ── */}
      {isLoading ? (
        <div className="p-16 text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            Cargando expediente histórico...
          </p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className={`p-12 sm:p-16 text-center rounded-3xl border ${
          isDark ? "bg-zinc-900/40 border-zinc-800 text-zinc-400" : "bg-white border-gray-200 text-gray-500"
        }`}>
          <FolderArchive className="w-14 h-14 mx-auto text-gray-400/80 mb-3" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            No se encontraron registros en el historial
          </h3>
          <p className="text-xs sm:text-sm max-w-md mx-auto">
            {searchTerm || statusFilter !== "Todos" || periodFilter !== "Todos"
              ? "Prueba modificando los criterios de búsqueda o limpiando los filtros actuales."
              : "Las prácticas aparecerán aquí una vez que hayan finalizado según su calendario académico o sean canceladas con su justificación."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map((practice) => {
            const isCancelada = practice.estado === "Cancelada";

            return (
              <div
                key={practice.id}
                onClick={() => handleOpenDetail(practice)}
                className={`p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:-translate-y-1 shadow-sm hover:shadow-xl ${
                  isDark
                    ? isCancelada
                      ? "bg-zinc-950/80 border-rose-950/70 hover:border-rose-700/80"
                      : "bg-zinc-950/80 border-zinc-800 hover:border-amber-500/50"
                    : isCancelada
                    ? "bg-white border-rose-200/90 hover:border-rose-400"
                    : "bg-white border-gray-200/90 hover:border-amber-400/80"
                }`}
              >
                <div>
                  {/* Encabezado de la tarjeta: Estado y Periodo */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${
                        isCancelada
                          ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800"
                          : "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800"
                      }`}>
                        {isCancelada ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {practice.estado}
                      </span>
                      {practice.periodo && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
                          {practice.periodo}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      #{practice.practica_id}
                    </span>
                  </div>

                  {/* Título de la práctica */}
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white leading-snug mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {practice.titulo}
                  </h3>

                  {/* Argumento / Justificación si es Cancelada */}
                  {isCancelada && practice.motivo_cancelacion && (
                    <div className="mb-3.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold mb-0.5">Motivo de Cancelación:</strong>
                          <p className="line-clamp-2 italic">{practice.motivo_cancelacion}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Datos Clave */}
                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 mb-4">
                    {practice.institucion_nombre && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{practice.institucion_nombre}</span>
                      </div>
                    )}
                    {practice.asignatura_nombre && (
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{practice.asignatura_nombre}</span>
                      </div>
                    )}
                    {practice.docente_nombre && (
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                          Docente: {practice.docente_nombre}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-500 pt-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>
                        {formatDateReadable(practice.fecha_inicio)} — {formatDateReadable(practice.fecha_fin)}
                      </span>
                    </div>
                  </div>

                  {/* Vista específica si el usuario es Estudiante */}
                  {userRole === "student" && practice.miDetalle && (
                    <div className={`p-3 rounded-2xl border mb-3 text-xs ${
                      isDark ? "bg-zinc-900/80 border-zinc-800" : "bg-gray-50 border-gray-200"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-500 dark:text-gray-400">Tu Calificación:</span>
                        <span className={`font-black px-2 py-0.5 rounded-lg text-xs ${
                          practice.miDetalle.calificacion !== null
                            ? practice.miDetalle.calificacion >= 3.0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
                        }`}>
                          {practice.miDetalle.calificacion !== null
                            ? `${Number(practice.miDetalle.calificacion).toFixed(1)} / 5.0`
                            : "Sin calificar"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>Horas cumplidas:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {practice.miDetalle.horas_cumplidas || 0} de {practice.horas_totales || 0} hrs
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer de la Tarjeta */}
                <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    {practice.total_estudiantes || 0} estudiantes
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                    Ver Expediente
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL DETALLADO / EXPEDIENTE HISTÓRICO ── */}
      {isModalOpen && selectedPractice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div
            className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden transition-all ${
              isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-gray-200 text-zinc-900"
            }`}
          >
            {/* Cabecera del Modal */}
            <div className={`p-5 sm:p-6 border-b flex items-start justify-between gap-4 ${
              isDark ? "border-zinc-800 bg-zinc-950/95" : "border-gray-200 bg-gray-50/80"
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${
                    selectedPractice.estado === "Cancelada"
                      ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                      : "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
                  }`}>
                    {selectedPractice.estado === "Cancelada" ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Práctica {selectedPractice.estado}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    Periodo {selectedPractice.periodo || "N/A"}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    ID Registro: #{selectedPractice.practica_id}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black leading-tight text-gray-900 dark:text-white pt-1">
                  {selectedPractice.titulo}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 rounded-xl border text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  title="Imprimir Ficha"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenido con Scroll */}
            <div className="p-5 sm:p-7 overflow-y-auto space-y-6">
              {/* Alerta Destacada si fue Cancelada */}
              {selectedPractice.estado === "Cancelada" && (
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-950 dark:text-rose-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300 text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                    <span>Justificación / Motivo Oficial de Cancelación</span>
                  </div>
                  <p className="text-sm font-medium pl-7 leading-relaxed">
                    {selectedPractice.motivo_cancelacion || "No se registró un motivo explícito al momento de cancelar."}
                  </p>
                </div>
              )}

              {/* Grid de Metadatos de la Práctica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div className={`p-3.5 rounded-2xl border ${
                  isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-gray-50 border-gray-200/80"
                }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Programa Académico
                  </span>
                  <div className="font-semibold text-sm">
                    {selectedPractice.programa_nombre || "No especificado"}
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-gray-50 border-gray-200/80"
                }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Asignatura
                  </span>
                  <div className="font-semibold text-sm">
                    {selectedPractice.asignatura_nombre || "No especificada"}
                    {selectedPractice.asignatura_codigo && (
                      <span className="text-xs text-gray-400 block">({selectedPractice.asignatura_codigo})</span>
                    )}
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-gray-50 border-gray-200/80"
                }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Institución Hospitalaria / Sede
                  </span>
                  <div className="font-semibold text-sm">
                    {selectedPractice.institucion_nombre || "No especificada"}
                  </div>
                  {selectedPractice.servicio_nombre && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 block mt-0.5 font-medium">
                      Servicio: {selectedPractice.servicio_nombre}
                    </span>
                  )}
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-gray-50 border-gray-200/80"
                }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Docente Tutor Responsable
                  </span>
                  <div className="font-semibold text-sm">
                    {selectedPractice.docente_nombre || "Sin docente asignado"}
                  </div>
                  {selectedPractice.docente_correo && (
                    <span className="text-xs text-gray-400 block mt-0.5 truncate">{selectedPractice.docente_correo}</span>
                  )}
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-gray-50 border-gray-200/80"
                }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Auditor Asignado
                  </span>
                  <div className="font-semibold text-sm">
                    {selectedPractice.auditor_nombre || "Sin auditor asignado"}
                  </div>
                  {selectedPractice.auditor_correo && (
                    <span className="text-xs text-gray-400 block mt-0.5 truncate">{selectedPractice.auditor_correo}</span>
                  )}
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-gray-50 border-gray-200/80"
                }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Horas y Calendario
                  </span>
                  <div className="font-semibold text-sm">
                    {selectedPractice.horas_totales || 0} horas formativas
                  </div>
                  <span className="text-xs text-gray-400 block mt-0.5">
                    {formatDateReadable(selectedPractice.fecha_inicio)} al {formatDateReadable(selectedPractice.fecha_fin)}
                  </span>
                </div>
              </div>

              {selectedPractice.descripcion && (
                <div className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed ${
                  isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-gray-50 border-gray-200"
                }`}>
                  <strong className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Descripción y Objetivos Formativos:
                  </strong>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">
                    {selectedPractice.descripcion}
                  </p>
                </div>
              )}

              {/* ── Sección de Estudiantes Vinculados y Calificaciones ── */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b pb-3 border-gray-200 dark:border-zinc-800">
                  <h3 className="text-lg font-extrabold flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    <span>Estudiantes Vinculados ({selectedPractice.estudiantes?.length || 0})</span>
                  </h3>
                  <span className="text-xs text-gray-400 font-medium">
                    Expediente inmutable de notas y documentos
                  </span>
                </div>

                {(!selectedPractice.estudiantes || selectedPractice.estudiantes.length === 0) ? (
                  <div className="p-8 text-center text-xs text-gray-400">
                    No hubo estudiantes vinculados formalmente a esta práctica.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedPractice.estudiantes.map((st, index) => {
                      const hasGrade = st.calificacion !== null && st.calificacion !== undefined;
                      const isPassing = hasGrade && Number(st.calificacion) >= 3.0;

                      return (
                        <div
                          key={st.cedula || index}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                            isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-gray-50/70 border-gray-200"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div>
                              <h4 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white">
                                {st.nombre_completo || `${st.nombre} ${st.apellidos}`}
                              </h4>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap mt-0.5">
                                <span>C.C: <strong>{st.cedula}</strong></span>
                                {st.codigo && <span>Código: <strong>{st.codigo}</strong></span>}
                                {st.correo_institucional && <span>{st.correo_institucional}</span>}
                              </div>
                            </div>

                            {/* Badge de Nota */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-3 py-1 rounded-xl text-xs font-black border ${
                                hasGrade
                                  ? isPassing
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                    : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                                  : "bg-gray-200 text-gray-800 border-gray-300 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}>
                                {hasGrade ? `Nota: ${Number(st.calificacion).toFixed(1)} / 5.0 (${isPassing ? "Aprobado" : "Reprobado"})` : "Sin Calificación"}
                              </span>

                              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                {st.horas_cumplidas || 0} / {st.horas_asignadas || selectedPractice.horas_totales || 0} hrs
                              </span>
                            </div>
                          </div>

                          {/* Retroalimentación docente si existe */}
                          {st.retroalimentacion && (
                            <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs text-gray-700 dark:text-zinc-300 mb-3">
                              <strong className="block text-gray-500 font-semibold mb-0.5">Retroalimentación del Tutor:</strong>
                              <p className="italic">{st.retroalimentacion}</p>
                            </div>
                          )}

                          {/* Criterios / Rúbrica Likert si existen */}
                          {st.criterios && typeof st.criterios === "object" && (
                            <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                              {Object.entries(st.criterios).map(([k, v]) => (
                                <div key={k} className="p-2 rounded-lg bg-gray-100 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800 flex justify-between">
                                  <span className="capitalize text-gray-500">{k}:</span>
                                  <span className="font-bold">{v}/5</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Documentos Vinculados del Estudiante */}
                          <div className="pt-2 border-t border-gray-200/60 dark:border-zinc-800/80">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-2 flex items-center gap-1.5">
                              <FileCheck className="w-3.5 h-3.5" />
                              Documentos Vinculados ({st.total_documentos_vinculados || 0} de {st.total_documentos_requeridos || 6})
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {(st.documentos || []).map((doc) => (
                                <div
                                  key={doc.tipo}
                                  className={`p-2 rounded-xl border flex items-center justify-between text-xs ${
                                    doc.vinculado
                                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300"
                                      : "bg-gray-100/60 border-gray-200 text-gray-400 dark:bg-zinc-900/40 dark:border-zinc-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate pr-1">
                                    {doc.vinculado ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{doc.label}</span>
                                  </div>

                                  {doc.vinculado && (
                                    <button
                                      type="button"
                                      onClick={() => handleViewDocument(st.cedula, doc.tipo)}
                                      className="p-1 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer flex-shrink-0"
                                      title="Visualizar documento"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pie de expediente con fecha de archivo */}
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-between text-xs text-gray-400">
                <span>Expediente sellado oficialmente en el sistema UPTC.</span>
                <span>Archivado el: {formatDateReadable(selectedPractice.fecha_archivo)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryModule;
