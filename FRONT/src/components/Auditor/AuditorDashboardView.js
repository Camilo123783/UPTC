// ============================================================
// AuditorDashboardView.js — Panel de Control del Auditor UPTC
// Accesos directos limpios, control asistencial, usuarios y cosas pendientes
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BACKEND_URL } from "../../config/api";
import { useDataSync } from "../../utils/dataSync";
import {
  Clock,
  Users,
  MessageSquare,
  GraduationCap,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Hospital,
  Activity,
  ChevronRight,
  ListChecks,
  Building2,
  Calendar,
} from "lucide-react";

const AuditorDashboardView = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [practices, setPractices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const [statsRes, practicesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/auditor/dashboard-stats`, { headers }),
        fetch(`${BACKEND_URL}/api/auditor/practices`, { headers }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (practicesRes.ok) {
        const pData = await practicesRes.json();
        setPractices(Array.isArray(pData) ? pData : []);
      }
    } catch (err) {
      console.error("Error al cargar datos del dashboard de auditor:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDataSync(fetchData);

  const totalDocentsCount = useMemo(() => {
    if (stats?.totalDocents !== undefined && stats?.totalDocents !== null) {
      return stats.totalDocents;
    }
    if (!practices || practices.length === 0) return 0;
    const docSet = new Set(practices.map((p) => p.docente_cedula).filter(Boolean));
    return docSet.size;
  }, [stats, practices]);

  const totalStudentsCount = useMemo(() => {
    if (stats?.totalStudents !== undefined && stats?.totalStudents !== null) {
      return stats.totalStudents;
    }
    if (!practices || practices.length === 0) return 0;
    const stSet = new Set();
    practices.forEach((pr) => {
      (pr.estudiantes || []).forEach((st) => {
        if (st.cedula || st.estudiante_cedula) {
          stSet.add(String(st.cedula || st.estudiante_cedula));
        }
      });
    });
    return stSet.size;
  }, [stats, practices]);

  // Cálculo de pendientes reales de supervisión y asistencia
  const pendingList = useMemo(() => {
    const list = [];
    if (!practices || practices.length === 0) return list;

    practices.forEach((pr) => {
      const estudiantes = pr.estudiantes || [];
      estudiantes.forEach((st) => {
        const cumplidas = Number(st.horas_cumplidas || 0);
        const asignadas = Number(st.horas_asignadas || pr.horas_totales || 0);
        const stName = st.nombre_completo || `${st.nombre || ""} ${st.apellidos || ""}`.trim() || `Estudiante CC ${st.cedula || st.estudiante_cedula}`;

        if (cumplidas === 0) {
          list.push({
            id: `zero-hours-${pr.id}-${st.cedula || st.estudiante_cedula}`,
            type: "asistencia",
            title: `Registrar primer turno de asistencia`,
            description: `${stName} (${st.codigo || st.cedula || st.estudiante_cedula}) aún no registra horas en "${pr.titulo}".`,
            badge: "Asistencia Inicial",
            badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800",
            actionText: "Registrar Turno",
            actionPage: "auditorHoursCompliance",
          });
        } else if (asignadas > 0 && cumplidas < asignadas) {
          const restantes = asignadas - cumplidas;
          const porcentaje = Math.round((cumplidas / asignadas) * 100);
          list.push({
            id: `pending-hours-${pr.id}-${st.cedula || st.estudiante_cedula}`,
            type: "progreso",
            title: `Supervisión de turno en progreso`,
            description: `${stName} acumula ${cumplidas}h de ${asignadas}h (${restantes}h pendientes) en "${pr.titulo}".`,
            badge: `${porcentaje}% Completado`,
            badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800",
            actionText: "Ver Horas",
            actionPage: "auditorHoursCompliance",
          });
        }
      });

      if (pr.unread_messages_count > 0) {
        list.push({
          id: `unread-msg-${pr.id}`,
          type: "mensaje",
          title: `Novedad de docente sin revisar`,
          description: `Tienes ${pr.unread_messages_count} mensaje(s) nuevo(s) de ${pr.docente_nombre || "Docente"} en "${pr.titulo}".`,
          badge: "Novedad",
          badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800",
          actionText: "Abrir Comunicación",
          actionPage: "auditorCommunication",
        });
      }
    });

    return list;
  }, [practices]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Resumen Auditor
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
            Accesos directos al control de horas, seguimiento asistencial de usuarios y comunicación.
          </p>
        </div>
      </div>

      {/* ─── Fila Principal de los 4 Accesos Directos con Colores y Formas ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Cumplimiento de Horas (Verde Asistencial / Emerald) */}
        <div
          className="group relative bg-emerald-50/80 dark:bg-emerald-950/35 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm hover:shadow-lg hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          onClick={() => onNavigate("auditorHoursCompliance")}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                Cumplimiento de Horas
              </p>
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <p className="text-4xl font-black text-emerald-950 dark:text-emerald-100 flex-shrink-0">
                {isLoading ? "..." : `${stats?.totalHoursAudited || 0}h`}
              </p>
              <div className="flex flex-col text-[11px] leading-tight text-emerald-800 dark:text-emerald-300 border-l border-emerald-300 dark:border-emerald-800 pl-3 space-y-0.5 select-none">
                <span title="Estudiantes supervisados" className="flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> <strong>{isLoading ? "-" : totalStudentsCount}</strong> Estudiantes
                </span>
                <span title="Horas confirmadas" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> <strong>{isLoading ? "-" : stats?.totalHoursAudited || 0}h</strong> Hechas
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-5 font-bold flex items-center justify-between">
            <span>Gestionar asistencia y turnos</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </p>
        </div>

        {/* 2. Prácticas Supervisadas (Azul Zafiro / Cyan) */}
        <div
          className="group relative bg-blue-50/80 dark:bg-blue-950/35 p-6 rounded-2xl border border-blue-200 dark:border-blue-800/60 shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          onClick={() => onNavigate("auditorHoursCompliance")}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider">
                Prácticas Supervisadas
              </p>
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 group-hover:scale-110 transition-transform">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <p className="text-4xl font-black text-blue-950 dark:text-blue-100 flex-shrink-0">
                {isLoading ? "..." : stats?.totalPractices || practices.length}
              </p>
              <div className="flex flex-col text-[11px] leading-tight text-blue-800 dark:text-blue-300 border-l border-blue-300 dark:border-blue-800 pl-3 space-y-0.5 select-none">
                <span title="Prácticas activas" className="flex items-center gap-1">
                  <Activity className="w-3 h-3" /> <strong>{isLoading ? "-" : stats?.activePractices || practices.length}</strong> Activas
                </span>
                <span title="Escenarios clínicos" className="flex items-center gap-1">
                  <Hospital className="w-3 h-3" /> Rotaciones
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-5 font-bold flex items-center justify-between">
            <span>Supervisar rotaciones clínicas</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </p>
        </div>

        {/* 3. Visualizar Usuarios (Púrpura / Violeta) */}
        <div
          className="group relative bg-purple-50/80 dark:bg-purple-950/35 p-6 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-sm hover:shadow-lg hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          onClick={() => onNavigate("auditorUserViewer")}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider">
                Visualizar Usuarios
              </p>
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <p className="text-4xl font-black text-purple-950 dark:text-purple-100 flex-shrink-0">
                {isLoading ? "..." : totalStudentsCount}
              </p>
              <div className="flex flex-col text-[11px] leading-tight text-purple-800 dark:text-purple-300 border-l border-purple-300 dark:border-purple-800 pl-3 space-y-0.5 select-none">
                <span title="Estudiantes vinculados" className="flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> <strong>{isLoading ? "-" : totalStudentsCount}</strong> Estudiantes
                </span>
                <span title="Docentes a cargo" className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> <strong>{isLoading ? "-" : totalDocentsCount}</strong> Docentes
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-purple-700 dark:text-purple-400 mt-5 font-bold flex items-center justify-between">
            <span>Consultar estudiantes y docentes</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </p>
        </div>

        {/* 4. Comunicación con Docentes (Ámbar / Naranja UPTC) */}
        <div
          className="group relative bg-amber-50/80 dark:bg-amber-950/35 p-6 rounded-2xl border border-amber-200 dark:border-amber-800/60 shadow-sm hover:shadow-lg hover:border-amber-400 dark:hover:border-amber-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          onClick={() => onNavigate("auditorCommunication")}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
                Comunicación
              </p>
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <p className="text-3xl font-black text-amber-950 dark:text-amber-100 flex-shrink-0 flex items-center gap-1.5">
                <span>Docentes</span>
              </p>
              <div className="flex flex-col text-[11px] leading-tight text-amber-800 dark:text-amber-300 border-l border-amber-300 dark:border-amber-800 pl-3 space-y-0.5 select-none">
                <span title="Docentes tutores" className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> <strong>{isLoading ? "-" : totalDocentsCount}</strong> Tutores
                </span>
                <span title="Canal activo" className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Mensajería
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-5 font-bold flex items-center justify-between">
            <span>Enviar mensajes y novedades</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </p>
        </div>
      </div>

      {/* ─── SECCIÓN: COSAS PENDIENTES Y ACTIVIDADES DEL AUDITOR ─── */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (2/3): Tareas y Alertas Pendientes */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Cosas Pendientes por Atender
                </h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Acciones clave de asistencia, turnos y seguimiento que requieren tu atención.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              {pendingList.length} Pendiente{pendingList.length === 1 ? "" : "s"}
            </span>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-zinc-400 italic py-4">Cargando pendientes...</p>
          ) : pendingList.length > 0 ? (
            <div className="space-y-3">
              {pendingList.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                      <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {item.title}
                      </h5>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate(item.actionPage)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex-shrink-0 shadow-sm cursor-pointer"
                  >
                    <span>{item.actionText}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {pendingList.length > 5 && (
                <p className="text-xs text-center text-gray-500 dark:text-zinc-400 pt-2">
                  Y {pendingList.length - 5} pendientes más en el módulo de asistencia.
                </p>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                ¡Todas las actividades y turnos están al día!
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                No hay alertas de asistencias pendientes ni novedades atrasadas en tus rotaciones.
              </p>
            </div>
          )}
        </div>

        {/* Columna Derecha (1/3): Resumen Rápido de Rotaciones Activas */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <ListChecks className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    Rotaciones a Cargo
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Escenarios clínicos activos
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {practices.length} Total
              </span>
            </div>

            {isLoading ? (
              <p className="text-xs text-gray-500 dark:text-zinc-400 italic py-4">Cargando rotaciones...</p>
            ) : practices.length > 0 ? (
              <div className="space-y-3">
                {practices.slice(0, 3).map((pr) => {
                  const estList = pr.estudiantes || [];
                  const totalHorasReq = Number(pr.horas_totales || 0);
                  const horasHechas = estList.reduce((acc, e) => acc + Number(e.horas_cumplidas || 0), 0);
                  const horasObj = totalHorasReq * Math.max(1, estList.length);
                  const pct = horasObj > 0 ? Math.min(100, Math.round((horasHechas / horasObj) * 100)) : 0;

                  return (
                    <div
                      key={pr.id}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-700/60"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {pr.titulo}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {pr.estado || "Activa"}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400 mb-2 truncate">
                        {pr.institucion_nombre || "Hospital"} • {pr.servicio_nombre || "Servicio"}
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-zinc-400 mt-1">
                        <span>{estList.length} Estudiante{estList.length === 1 ? "" : "s"}</span>
                        <span>{pct}% avance</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-zinc-400 italic py-4">
                No tienes prácticas asignadas actualmente.
              </p>
            )}
          </div>

          <button
            onClick={() => onNavigate("auditorHoursCompliance")}
            className="w-full mt-4 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Ir a Control de Horas</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default AuditorDashboardView;
