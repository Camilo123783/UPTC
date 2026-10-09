// ============================================================
// src/components/Student/StudentPractices.js
// Prácticas Reales del Estudiante Autenticado — UPTC
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  Clock,
  Building2,
  UserCheck,
  GraduationCap,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  RefreshCw,
  Mail,
  FileText,
  Hospital,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
  Award,
  Check,
  Megaphone,
  User,
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { useAuth } from "../../utils/useAuth";
import { useDataSync } from "../../utils/dataSync";

const API_BASE_URL = BACKEND_URL;

// Configuración visual de badges según estado
const ESTADO_CONFIG = {
  Activa: {
    bg: "bg-emerald-100 dark:bg-emerald-950/60",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-300 dark:border-emerald-800",
    dot: "bg-emerald-500",
    label: "Activa",
  },
  Planificada: {
    bg: "bg-blue-100 dark:bg-blue-950/60",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-800",
    dot: "bg-blue-500",
    label: "Planificada",
  },
  Finalizada: {
    bg: "bg-purple-100 dark:bg-purple-950/60",
    text: "text-purple-800 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-800",
    dot: "bg-purple-500",
    label: "Finalizada",
  },
  Cancelada: {
    bg: "bg-rose-100 dark:bg-rose-950/60",
    text: "text-rose-800 dark:text-rose-300",
    border: "border-rose-300 dark:border-rose-800",
    dot: "bg-rose-500",
    label: "Cancelada",
  },
};

const getRemainingCertDays = (fechaFin) => {
  if (!fechaFin) return 30;
  try {
    const fStr = typeof fechaFin === "string" ? fechaFin.substring(0, 10) : "";
    if (!fStr) return 30;
    const finDate = new Date(fStr);
    const hoy = new Date();
    finDate.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((hoy.getTime() - finDate.getTime()) / 86400000);
    return Math.max(0, 30 - diffDays);
  } catch (e) {
    return 30;
  }
};

const StudentPractices = () => {
  const { user } = useAuth();
  const [practices, setPractices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPractice, setSelectedPractice] = useState(null);

  // Obtener la cédula del estudiante de manera robusta
  const getStudentCedula = useCallback(() => {
    if (user?.cedula) return user.cedula;
    if (user?.id) return user.id;
    try {
      const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.cedula || parsed.Cédula || parsed.id || null;
      }
    } catch (e) {
      console.warn("No se pudo obtener la cédula desde el almacenamiento:", e);
    }
    return null;
  }, [user]);

  // Formatear fechas en formato legible en español
  const formatDate = (dateStr) => {
    if (!dateStr) return "Por definir";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.substring(0, 10);
      return d.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateStr.substring(0, 10);
    }
  };

  // Calcular el progreso temporal de la práctica (%)
  const calculateProgress = (startDate, endDate, status) => {
    if (status === "Finalizada") return 100;
    if (status === "Cancelada") return 0;
    if (status === "Planificada") return 0;
    if (!startDate || !endDate) return status === "Activa" ? 50 : 20;

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();

    if (isNaN(start) || isNaN(end) || end <= start) {
      return status === "Activa" ? 60 : 30;
    }

    if (now <= start) return 0;
    if (now >= end) return 100;

    const percent = Math.round(((now - start) / (end - start)) * 100);
    return Math.min(100, Math.max(0, percent));
  };

  // Cargar las prácticas reales del estudiante desde el backend
  const fetchStudentPractices = useCallback(async () => {
    const studentCedula = getStudentCedula();

    if (!studentCedula) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE_URL}/api/student/practices/${studentCedula}`, { headers });

      if (!res.ok) {
        throw new Error(`Error del servidor (${res.status}): No se pudieron cargar las prácticas.`);
      }

      const data = await res.json();
      // Las prácticas canceladas se consultan exclusivamente en el Historial de Prácticas
      const list = (Array.isArray(data) ? data : []).filter((p) => p.estado !== "Cancelada");
      setPractices(list);
    } catch (err) {
      console.error("Error al cargar prácticas del estudiante:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  }, [getStudentCedula]);

  useEffect(() => {
    fetchStudentPractices();
  }, [fetchStudentPractices]);

  // Escuchar sincronización reactiva en tiempo real (cuando el Admin o Docente actualiza)
  useDataSync(fetchStudentPractices);

  // Obtener configuración visual de estado
  const getEstadoBadge = (status) => {
    const config = ESTADO_CONFIG[status] || {
      bg: "bg-gray-100 dark:bg-slate-800",
      text: "text-gray-800 dark:text-gray-300",
      border: "border-gray-300 dark:border-slate-700",
      dot: "bg-gray-400",
      label: status || "No asignado",
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}
      >
        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
        {config.label}
      </span>
    );
  };

  const studentName = user?.name || user?.nombre || "Estudiante";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ─── Encabezado Principal ─── */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 transition duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                <Hospital className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Mis Prácticas
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Rotaciones clínicas y formativas asignadas a tu expediente académico
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStudentPractices}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition duration-150 shadow-sm border border-gray-200 dark:border-slate-700"
              title="Actualizar listado de prácticas"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
              <span>{isLoading ? "Actualizando..." : "Actualizar"}</span>
            </button>
          </div>
        </div>

        {/* Resumen numérico con Horas Reales */}
        {!isLoading && !error && (() => {
          const totalCumplidas = practices.reduce((acc, p) => acc + (Number(p.horas_cumplidas) || 0), 0);
          const totalAsignadas = practices.reduce(
            (acc, p) => acc + (Number(p.horas_asignadas) || Number(p.horas_totales) || 120),
            0
          );
          const cumplimientoGlobal =
            totalAsignadas > 0 ? Math.min(100, Math.round((totalCumplidas / totalAsignadas) * 100)) : 0;

          return (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Total Prácticas</span>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{practices.length}</p>
              </div>
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 rounded-xl">
                <span className="text-xs text-blue-700 dark:text-blue-300 uppercase font-semibold">Horas Cumplidas</span>
                <p className="text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                  {totalCumplidas} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">/ {totalAsignadas}h ({cumplimientoGlobal}%)</span>
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Prácticas Activas</span>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {practices.filter((p) => p.estado === "Activa").length}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Finalizadas</span>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                  {practices.filter((p) => p.estado === "Finalizada").length}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ─── Estado de Error ─── */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 flex-shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-base mb-1">No se pudieron cargar tus prácticas</h4>
            <p className="text-sm opacity-90 mb-3">{error}</p>
            <button
              onClick={fetchStudentPractices}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        </div>
      )}

      {/* ─── Skeleton de Carga ─── */}
      {isLoading && (
        <div className="space-y-6">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 animate-pulse space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="h-6 w-1/3 bg-gray-200 dark:bg-slate-700 rounded-md"></div>
                <div className="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded-full"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
              </div>
              <div className="h-2.5 bg-gray-200 dark:bg-slate-700 rounded-full w-full mt-4"></div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Estado Vacío (Sin Prácticas Asignadas) ─── */}
      {!isLoading && !error && practices.length === 0 && (
        <div className="bg-white dark:bg-slate-900 p-10 sm:p-12 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-slate-700 shadow-inner">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No tienes prácticas asignadas actualmente
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-6">
            Estimado/a <span className="font-semibold text-gray-800 dark:text-gray-200">{studentName}</span>, en este momento no registras rotaciones clínicas o prácticas formativas activas en tu programa académico.
          </p>
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl max-w-md mx-auto text-left flex items-start gap-3 mb-6">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Cuando la coordinación académica o tu docente formalice tu inscripción en el centro hospitalario, tu práctica se reflejará aquí de forma automática con todos los detalles de rotación.
            </p>
          </div>
          <button
            onClick={fetchStudentPractices}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition duration-150"
          >
            <RefreshCw className="w-4 h-4" /> Comprobar Nuevas Asignaciones
          </button>
        </div>
      )}

      {/* ─── Listado de Prácticas Reales ─── */}
      {!isLoading && !error && practices.length > 0 && (
        <div className="space-y-6">
          {practices.map((practice) => {
            const horasCumplidas = Number(practice.horas_cumplidas || 0);
            const horasAsignadas = Number(practice.horas_asignadas || practice.horas_totales || 120);
            const hoursProgress = horasAsignadas > 0 ? Math.min(100, Math.round((horasCumplidas / horasAsignadas) * 100)) : 0;
            const temporalProgress = calculateProgress(practice.fecha_inicio, practice.fecha_fin, practice.estado);
            const hospitalName = practice.institucion_nombre || "Institución Hospitalaria";
            const serviceName = practice.servicio_nombre || "Servicio General";

            return (
              <div
                key={practice.id}
                className="bg-white dark:bg-slate-900 p-6 sm:p-7 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-md hover:shadow-lg transition duration-200 ease-in-out"
              >
                {/* Cabecera de la Práctica */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                        {practice.periodo || "2024-1"}
                      </span>
                      {practice.asignatura_codigo && (
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          Cod: {practice.asignatura_codigo}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {practice.titulo}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {getEstadoBadge(practice.estado)}
                    {practice.estado_asignacion && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {practice.estado_asignacion}
                      </span>
                    )}
                  </div>
                </div>

                {/* Subtítulo: Hospital y Servicio */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm font-medium text-gray-700 dark:text-gray-300 mb-5 pb-4 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span>{hospitalName}</span>
                  </div>
                  <span className="text-gray-300 dark:text-slate-700 hidden sm:inline">•</span>
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Hospital className="w-4 h-4" />
                    <span>{serviceName}</span>
                  </div>
                  {practice.programa_nombre && (
                    <>
                      <span className="text-gray-300 dark:text-slate-700 hidden sm:inline">•</span>
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <GraduationCap className="w-4 h-4" />
                        <span>{practice.programa_nombre}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Aviso oficial de 30 días para certificados si la práctica está Finalizada */}
                {practice.estado === "Finalizada" && (() => {
                  const remaining = getRemainingCertDays(practice.fecha_fin);
                  return (
                    <div className="mb-5 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5 shadow-xs">
                      <Clock className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
                      <div>
                        <strong className="block font-bold">
                          {remaining > 0
                            ? `Quedan ${remaining} días para la emisión y descarga de certificados.`
                            : "Plazo de 30 días para emisión de certificados cumplido."}
                        </strong>
                        <span className="text-[11px] opacity-80 block">
                          Esta rotación ha finalizado formalmente.
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Grid de Información Clave */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-5">
                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>Fecha de Inicio</span>
                    </div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {formatDate(practice.fecha_inicio)}
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-rose-500" />
                      <span>Fecha de Finalización</span>
                    </div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {formatDate(practice.fecha_fin)}
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Horas Asistenciales</span>
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{hoursProgress}%</span>
                    </div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {horasCumplidas} / {horasAsignadas} hrs
                    </p>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 truncate">
                      {horasCumplidas >= horasAsignadas ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <Check className="w-3 h-3" /> 100% Horas cumplidas
                        </span>
                      ) : (
                        `Faltan ${Math.max(0, horasAsignadas - horasCumplidas)}h por registrar`
                      )}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Docente Asesor</span>
                    </div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {practice.docente_nombre || "Por asignar"}
                    </p>
                  </div>
                </div>

                {/* Asignatura y Descripción Breve */}
                {practice.asignatura_nombre && (
                  <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>
                      <strong>Asignatura:</strong> {practice.asignatura_nombre}
                    </span>
                  </div>
                )}

                {/* Calificación Formativa Oficial del Estudiante */}
                {practice.calificacion !== null && practice.calificacion !== undefined ? (
                  <div className="mb-4 p-4 rounded-xl border bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Calificación Formativa Obtenida
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          Number(practice.calificacion) >= 3.0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                        }`}
                      >
                        {Number(practice.calificacion) >= 3.0 ? "Aprobada" : "Reprobada"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-emerald-900 dark:text-emerald-100">
                        {Number(practice.calificacion).toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">/ 5.0</span>
                      {practice.fecha_evaluacion && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-auto">
                          Evaluado el: {new Date(practice.fecha_evaluacion).toLocaleDateString("es-CO")}
                        </span>
                      )}
                    </div>

                    {practice.retroalimentacion && (
                      <div className="mt-1 pt-2 border-t border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-950 dark:text-emerald-200">
                        <strong>Concepto del Docente:</strong> "{practice.retroalimentacion}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-4 p-3 rounded-xl border bg-gray-50 dark:bg-zinc-800/40 border-gray-200 dark:border-zinc-700/60 flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      <span>⏳</span> Calificación Formativa:
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      Pendiente de evaluación por el docente
                    </span>
                  </div>
                )}



                {/* Barra de Progreso de Horas Asistenciales Reales */}
                <div className="mb-5 p-4 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-gray-600 dark:text-gray-400 font-semibold mb-2">
                    <span className="flex items-center gap-1.5 text-gray-900 dark:text-white font-bold">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>Progreso de Horas Asistenciales</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 dark:text-gray-300 font-mono">
                        <strong>{horasCumplidas}</strong> de <strong>{horasAsignadas}</strong> horas
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                          hoursProgress >= 100
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : hoursProgress > 0
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400"
                        }`}
                      >
                        {hoursProgress}%
                      </span>
                    </div>
                  </div>

                  {/* Barra animada */}
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ease-out ${
                        hoursProgress >= 100
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : hoursProgress >= 50
                          ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                          : hoursProgress > 0
                          ? "bg-gradient-to-r from-amber-500 to-blue-500"
                          : "bg-gray-300 dark:bg-slate-600"
                      }`}
                      style={{ width: `${Math.max(hoursProgress > 0 ? 3 : 0, hoursProgress)}%` }}
                    ></div>
                  </div>

                  {/* Leyenda aclaratoria */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                    <span className="flex items-center gap-1">
                      {hoursProgress >= 100 ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" /> ¡Has completado la totalidad de horas asistenciales requeridas!
                        </>
                      ) : hoursProgress > 0 ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-blue-500" /> Horas registradas y avaladas por tu docente en la plataforma.
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-500" /> Aún no se registran horas asistenciales en esta práctica.
                        </>
                      )}
                    </span>
                    <span className="opacity-75 font-medium">
                      Periodo lectivo: {temporalProgress}% del tiempo
                    </span>
                  </div>
                </div>

                {/* Botón de Acción */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ID Práctica: #{practice.id}
                  </div>
                  <button
                    onClick={() => setSelectedPractice(practice)}
                    className="inline-flex items-center gap-2 py-2 px-4 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold rounded-xl transition duration-150 text-sm border border-blue-200 dark:border-blue-800"
                  >
                    <span>Ver Detalles Completos</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal de Detalles Exhaustivos de la Práctica ─── */}
      {selectedPractice && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-slate-800 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                    Periodo {selectedPractice.periodo || "2024-1"}
                  </span>
                  {getEstadoBadge(selectedPractice.estado)}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedPractice.titulo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPractice(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido en Secciones */}
            <div className="space-y-6">
              {/* Sección 1: Entorno Hospitalario */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  Centro de Práctica y Rotación
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Institución de Salud</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {selectedPractice.institucion_nombre || "Clínica / Hospital UPTC"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Servicio / Especialidad</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {selectedPractice.servicio_nombre || "Servicio Clínico Integral"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección 2: Información Académica */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-500" />
                  Marco Académico
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Programa Académico</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {selectedPractice.programa_nombre || "Facultad de Ciencias de la Salud"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Asignatura</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {selectedPractice.asignatura_nombre || "Práctica Formativa"}
                      {selectedPractice.asignatura_codigo && ` (${selectedPractice.asignatura_codigo})`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección 3: Equipo Asesor y Supervisión */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-500" />
                  Docente y Auditoría
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Docente Supervisor</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm block">
                      {selectedPractice.docente_nombre || "Por asignar"}
                    </span>
                    {selectedPractice.docente_correo && (
                      <div className="mt-1">
                        <a
                          href={`mailto:${selectedPractice.docente_correo}`}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{selectedPractice.docente_correo}</span>
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Auditor Clínico</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm block">
                      {selectedPractice.auditor_nombre || "No asignado"}
                    </span>
                    {selectedPractice.auditor_correo && (
                      <div className="mt-1">
                        <a
                          href={`mailto:${selectedPractice.auditor_correo}`}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{selectedPractice.auditor_correo}</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección 4: Calendario y Horas Reales */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  Calendario y Carga Horaria Asistencial
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Fecha Inicio</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {formatDate(selectedPractice.fecha_inicio)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Fecha Término</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {formatDate(selectedPractice.fecha_fin)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Horas Asignadas</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {selectedPractice.horas_asignadas || selectedPractice.horas_totales || 120} horas
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Horas Cumplidas</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                      {selectedPractice.horas_cumplidas || 0} horas
                    </span>
                  </div>
                </div>

                {/* Barra de progreso en el modal */}
                <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                    <span className="text-gray-600 dark:text-gray-300">Progreso en Horas Realizadas:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {selectedPractice.horas_cumplidas || 0} de {selectedPractice.horas_asignadas || selectedPractice.horas_totales || 120} hrs (
                      {(selectedPractice.horas_asignadas || selectedPractice.horas_totales || 120) > 0
                        ? Math.min(
                            100,
                            Math.round(
                              ((selectedPractice.horas_cumplidas || 0) /
                                (selectedPractice.horas_asignadas || selectedPractice.horas_totales || 120)) *
                                100
                            )
                          )
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          (selectedPractice.horas_asignadas || selectedPractice.horas_totales || 120) > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  ((selectedPractice.horas_cumplidas || 0) /
                                    (selectedPractice.horas_asignadas || selectedPractice.horas_totales || 120)) *
                                    100
                                )
                              )
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Horario de la Práctica Formativa */}
              {selectedPractice.horario && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Horario de la Práctica (Días y Horas)
                  </h4>
                  <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/60 text-sm font-semibold text-blue-950 dark:text-blue-100 whitespace-pre-line leading-relaxed flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>{selectedPractice.horario}</div>
                  </div>
                </div>
              )}

              {/* Sección 5: Descripción u Observaciones Generales */}
              {selectedPractice.descripcion && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Indicaciones / Competencias
                  </h4>
                  <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {selectedPractice.descripcion}
                  </div>
                </div>
              )}

              {/* Sección 5.5: Calificación Oficial Formativa (0.0 - 5.0) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Calificación Formativa y Desempeño
                </h4>
                {selectedPractice.calificacion !== null && selectedPractice.calificacion !== undefined ? (
                  <div className="p-4 rounded-xl border bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        Nota Oficial Definitiva
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          Number(selectedPractice.calificacion) >= 3.0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                        }`}
                      >
                        {Number(selectedPractice.calificacion) >= 3.0 ? "Aprobada (≥ 3.0)" : "Reprobada (< 3.0)"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-emerald-900 dark:text-emerald-100">
                        {Number(selectedPractice.calificacion).toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">/ 5.0</span>
                      {selectedPractice.fecha_evaluacion && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                          Fecha de registro: {new Date(selectedPractice.fecha_evaluacion).toLocaleDateString("es-CO")}
                        </span>
                      )}
                    </div>

                    {selectedPractice.retroalimentacion && (
                      <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-950 dark:text-emerald-200">
                        <strong>Retroalimentación del Docente Supervisor:</strong>
                        <p className="mt-1 italic">"{selectedPractice.retroalimentacion}"</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                    <span>El docente aún no ha registrado la calificación formativa para esta práctica.</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">Pendiente</span>
                  </div>
                )}
              </div>

            </div>

            {/* Footer del Modal */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPractice(null)}
                className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold rounded-xl text-sm transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentPractices;