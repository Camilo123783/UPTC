import React, { useState, useEffect } from "react";
import { BACKEND_URL } from "../../config/api";
import { useDataSync } from "../../utils/dataSync";
import {
  User,
  Hospital,
  ClipboardCheck,
  Award,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Bell,
  CheckSquare,
  Crown,
  Landmark,
  Shield,
  Zap,
  GraduationCap,
  UserCheck,
  Search,
  Scroll,
  Users,
  FileText,
  Activity,
  Briefcase,
} from "lucide-react";
import AuditorDashboardView from "../Auditor/AuditorDashboardView";

// URL BASE para el backend
const API_BASE_URL = BACKEND_URL;

const DashboardHome = ({ userRole, onNavigate }) => {
  // ─── ESTADO Y LÓGICA ESPECÍFICA DE ADMIN ───
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersByRole, setUsersByRole] = useState({
    superadmin: 0,
    admin: 0,
    auditor: 0,
    docent: 0,
    student: 0,
  });
  const [isLoadingUsers, setIsLoadingUsers] = useState(
    userRole === "admin" || userRole === "superadmin"
  );
  const [userCountError, setUserCountError] = useState(null);

  const [totalPractices, setTotalPractices] = useState(0);
  const [isLoadingPractices, setIsLoadingPractices] = useState(
    userRole === "admin" || userRole === "superadmin"
  );
  const [practiceCountError, setPracticeCountError] = useState(null);

  const [reportStats, setReportStats] = useState({
    total_informes: 0,
    total_certificados: 0,
    total_asistencias: 0,
    total_emitidos: 0,
  });
  const [isLoadingReports, setIsLoadingReports] = useState(
    userRole === "admin" || userRole === "superadmin"
  );

  // ─── ESTADO Y LÓGICA ESPECÍFICA DE DOCENTE ───
  const [docentStats, setDocentStats] = useState({
    totalPractices: 0,
    activePractices: 0,
    totalStudents: 0,
    pendingEvaluations: 0,
    completedEvaluations: 0,
    pendingCertificates: 0,
    tasks: [],
  });
  const [isLoadingDocent, setIsLoadingDocent] = useState(userRole === "docent");

  // ─── ESTADO Y LÓGICA ESPECÍFICA DE ESTUDIANTE ───
  const [studentStats, setStudentStats] = useState({
    activePractices: 0,
    pendingEvaluations: 0,
    totalHours: 0,
    tasks: [],
  });
  const [isLoadingStudent, setIsLoadingStudent] = useState(userRole === "student");

  /**
   * Obtiene la cantidad total de usuarios del backend con desglose por rol (Admin).
   */
  const fetchTotalUsers = async () => {
    setIsLoadingUsers(true);
    setUserCountError(null);
    const URL = `${API_BASE_URL}/api/admin/users/count`;

    try {
      const response = await fetch(URL);
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      const data = await response.json();
      setTotalUsers(data.total_users || 0);
      if (data.by_role) {
        setUsersByRole({
          superadmin: data.by_role.superadmin || 0,
          admin: data.by_role.admin || 0,
          auditor: data.by_role.auditor || 0,
          docent: data.by_role.docent || 0,
          student: data.by_role.student || 0,
        });
      }
    } catch (error) {
      console.error("Error al obtener la cuenta de usuarios:", error);
      setUserCountError("Error al cargar la cuenta. Revisar API.");
      setTotalUsers("?");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  /**
   * Obtiene la cantidad total de prácticas registradas del backend (Admin).
   */
  const fetchTotalPractices = async () => {
    setIsLoadingPractices(true);
    setPracticeCountError(null);
    const URL = `${API_BASE_URL}/api/admin/practices/count`;

    try {
      const response = await fetch(URL);
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      const data = await response.json();
      setTotalPractices(data.total_practices || 0);
    } catch (error) {
      console.error("Error al obtener la cuenta de prácticas:", error);
      setPracticeCountError("Error al cargar prácticas.");
      setTotalPractices("?");
    } finally {
      setIsLoadingPractices(false);
    }
  };

  /**
   * Obtiene la cantidad de reportes y certificaciones emitidas (Admin).
   */
  const fetchReportStats = async () => {
    setIsLoadingReports(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reports/summary`);
      if (res.ok) {
        const data = await res.json();
        setReportStats({
          total_informes: data.total_informes || 0,
          total_certificados: data.total_certificados || 0,
          total_asistencias: data.total_asistencias || 0,
          total_emitidos: data.total_emitidos || 0,
        });
      }
    } catch (error) {
      console.error("Error al obtener estadísticas de reportes:", error);
    } finally {
      setIsLoadingReports(false);
    }
  };

  /**
   * Obtiene las métricas reales y tareas del docente autenticado.
   */
  const fetchDocentStats = async () => {
    setIsLoadingDocent(true);
    try {
      let docentCedula = null;
      try {
        const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
        if (stored) {
          const parsed = JSON.parse(stored);
          docentCedula = parsed.cedula || parsed.Cédula || parsed.id || null;
        }
      } catch (e) {
        console.warn("No se pudo leer sesión de docente:", e);
      }

      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const url = docentCedula
        ? `${API_BASE_URL}/api/docent/dashboard-stats/${docentCedula}`
        : `${API_BASE_URL}/api/docent/dashboard-stats`;

      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setDocentStats({
          totalPractices: data.totalPractices ?? 0,
          activePractices: data.activePractices ?? data.totalPractices ?? 0,
          totalStudents: data.totalStudents ?? 0,
          pendingEvaluations: data.pendingEvaluations ?? 0,
          completedEvaluations: data.completedEvaluations ?? 0,
          pendingCertificates: data.pendingCertificates ?? 0,
          tasks: data.tasks || [],
        });
      }
    } catch (error) {
      console.error("Error al cargar estadísticas del docente:", error);
    } finally {
      setIsLoadingDocent(false);
    }
  };

  /**
   * Obtiene las métricas reales y tareas del estudiante autenticado.
   */
  const fetchStudentStats = async () => {
    setIsLoadingStudent(true);
    try {
      let studentCedula = null;
      try {
        const stored = sessionStorage.getItem("userData");
        if (stored) {
          const parsed = JSON.parse(stored);
          studentCedula = parsed.cedula || parsed.Cédula || null;
        }
      } catch (e) {
        console.warn("No se pudo leer sesión de estudiante:", e);
      }

      if (studentCedula) {
        const response = await fetch(`${API_BASE_URL}/api/student/practices/${studentCedula}`);
        if (response.ok) {
          const practices = await response.json();
          const active = practices.filter(
            (p) => p.estado === "Activa" || p.estado === "En Curso"
          ).length;
          const pending = practices.filter(
            (p) => p.calificacion === null || p.estado_evaluacion === "Pendiente"
          ).length;
          const hours = practices.reduce((acc, p) => acc + (p.horas_totales || 0), 0);

          const tasksList = practices.length > 0
            ? practices.slice(0, 3).map((p) => {
                if (p.calificacion !== null) {
                  return `Calificación registrada en "${p.titulo}": ${Number(p.calificacion).toFixed(1)} / 5.0.`;
                }
                return `Rotación clínica activa en "${p.servicio_nombre || p.titulo}" (${p.institucion_nombre || "Sede"}).`;
              })
            : ["No tienes prácticas clínicas asignadas actualmente."];

          setStudentStats({
            activePractices: active,
            pendingEvaluations: pending,
            totalHours: hours,
            tasks: tasksList,
          });
        }
      }
    } catch (error) {
      console.error("Error al cargar estadísticas del estudiante:", error);
    } finally {
      setIsLoadingStudent(false);
    }
  };

  // Carga inicial según el rol
  useEffect(() => {
    if (userRole === "admin" || userRole === "superadmin") {
      fetchTotalUsers();
      fetchTotalPractices();
      fetchReportStats();
    } else if (userRole === "docent") {
      fetchDocentStats();
    } else if (userRole === "student") {
      fetchStudentStats();
    }
  }, [userRole]);

  // Sincronización en tiempo real
  useDataSync(() => {
    if (userRole === "admin" || userRole === "superadmin") {
      fetchTotalUsers();
      fetchTotalPractices();
      fetchReportStats();
    } else if (userRole === "docent") {
      fetchDocentStats();
    } else if (userRole === "student") {
      fetchStudentStats();
    }
  });

  // --- CONTENIDO ESPECÍFICO POR ROL ---
  const getRoleSpecificContent = (role) => {
    switch (role) {
      case "student":
        return (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Mi Panel Académico
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Accede a cada uno de tus módulos de formación, rotaciones clínicas y solicitudes oficiales.
                </p>
              </div>
            </div>

            {/* ─── Los 4 Menús del Estudiante en la parte superior con sus colores correctos ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* 1. Mi Perfil (Azul) */}
              <div
                onClick={() => onNavigate("studentProfile")}
                className="group relative bg-blue-50/80 dark:bg-blue-950/40 p-5 rounded-2xl border border-blue-200 dark:border-blue-800/60 shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 group-hover:scale-110 transition-transform duration-200 border border-blue-200 dark:border-blue-800">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Expediente
                  </span>
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
                    <span>Mi Perfil</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                    Consulta y actualiza tus datos personales, información médica y documentos adjuntos.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-blue-200/60 dark:border-blue-800/40 text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center justify-between">
                  <span>Ver mi perfil</span>
                  <span>→</span>
                </div>
              </div>

              {/* 2. Mis Prácticas (Verde / Emerald) */}
              <div
                onClick={() => onNavigate("studentPractices")}
                className="group relative bg-emerald-50/80 dark:bg-emerald-950/40 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm hover:shadow-lg hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:scale-110 transition-transform duration-200 border border-emerald-200 dark:border-emerald-800">
                    <Hospital className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {isLoadingStudent ? "..." : `${studentStats.activePractices} Activas`}
                  </span>
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                    <span>Mis Prácticas</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                    Revisa tus rotaciones asignadas, hospitales, docentes a cargo y avances formativos.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                  <span>Ver rotaciones</span>
                  <span>→</span>
                </div>
              </div>

              {/* 3. Evaluaciones (Púrpura / Morado) */}
              <div
                onClick={() => onNavigate("studentEvaluations")}
                className="group relative bg-purple-50/80 dark:bg-purple-950/40 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-sm hover:shadow-lg hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 group-hover:scale-110 transition-transform duration-200 border border-purple-200 dark:border-purple-800">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {isLoadingStudent ? "..." : `${studentStats.pendingEvaluations} Pendientes`}
                  </span>
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex items-center justify-between">
                    <span>Evaluaciones</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                    Consulta tus notas formativas, retroalimentación del docente y criterios de evaluación.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-purple-200/60 dark:border-purple-800/40 text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center justify-between">
                  <span>Consultar notas</span>
                  <span>→</span>
                </div>
              </div>

              {/* 4. Certificaciones (Ámbar / Naranja) */}
              <div
                onClick={() => onNavigate("studentCertifications")}
                className="group relative bg-amber-50/80 dark:bg-amber-950/40 p-5 rounded-2xl border border-amber-200 dark:border-amber-800/60 shadow-sm hover:shadow-lg hover:border-amber-400 dark:hover:border-amber-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 group-hover:scale-110 transition-transform duration-200 border border-amber-200 dark:border-amber-800">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Solicitudes
                  </span>
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center justify-between">
                    <span>Certificaciones</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                    Solicita certificados a tus docentes a cargo y descarga diplomas oficiales emitidos.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-800/40 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between">
                  <span>Tramitar certificados</span>
                  <span>→</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-6 bg-gray-50/80 dark:bg-zinc-800/50 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3.5 flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" /> Notificaciones y Estado de Rotaciones
              </h4>
              <ul className="space-y-2.5">
                {studentStats.tasks.map((task, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        );

      case "docent":
        return (
          <>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Resumen Docente
            </h3>

            {/* Accesos Directos Docente: 3 en la fila superior, 3 en la fila inferior */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Mis Prácticas (Púrpura) */}
              <div
                className="bg-purple-50/80 dark:bg-purple-950/40 p-5 rounded-2xl shadow-sm border border-purple-200 dark:border-purple-800/60 cursor-pointer hover:shadow-md hover:border-purple-400 dark:hover:border-purple-600 transition duration-150 flex flex-col justify-between"
                onClick={() => onNavigate("docentPractices")}
              >
                <div>
                  <p className="text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider">
                    Mis Prácticas
                  </p>
                  <p className="text-3xl font-black text-purple-950 dark:text-purple-100 mt-2">
                    {isLoadingDocent ? "..." : docentStats.totalPractices}
                  </p>
                </div>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-4 font-medium">
                  Gestionar y crear prácticas →
                </p>
              </div>

              {/* 2. Estudiantes (Esmeralda) */}
              <div
                className="bg-emerald-50/80 dark:bg-emerald-950/40 p-5 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-800/60 cursor-pointer hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition duration-150 flex flex-col justify-between"
                onClick={() => onNavigate("docentStudents")}
              >
                <div>
                  <p className="text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                    Estudiantes
                  </p>
                  <p className="text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-2">
                    {isLoadingDocent ? "..." : (docentStats.totalStudents ?? 0)}
                  </p>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-4 font-medium">
                  Alumnos a cargo y seguimiento →
                </p>
              </div>

              {/* 3. Cumplimiento de Horas (Azul) */}
              <div
                className="bg-blue-50/80 dark:bg-blue-950/40 p-5 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-800/60 cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition duration-150 flex flex-col justify-between"
                onClick={() => onNavigate("docentHoursCompliance")}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider">
                      Cumplimiento de Horas
                    </p>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                      Control
                    </span>
                  </div>
                  <p className="text-3xl font-black text-blue-950 dark:text-blue-100 mt-2">
                    {isLoadingDocent ? "..." : (docentStats.activePractices ?? docentStats.totalPractices)}
                  </p>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-4 font-medium">
                  Monitorear y validar horas →
                </p>
              </div>

              {/* 4. Solicitud de Certificados (Ámbar / Naranja) */}
              <div
                className="bg-amber-50/80 dark:bg-amber-950/40 p-5 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-800/60 cursor-pointer hover:shadow-md hover:border-amber-400 dark:hover:border-amber-600 transition duration-150 flex flex-col justify-between"
                onClick={() => onNavigate("docentCertificateRequests")}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
                      Solicitud de Certificados
                    </p>
                    {docentStats.pendingCertificates > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-3xl font-black text-amber-950 dark:text-amber-100 mt-2">
                    {isLoadingDocent ? "..." : docentStats.pendingCertificates}
                  </p>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-4 font-medium">
                  Revisar y avalar solicitudes →
                </p>
              </div>

              {/* 5. Diseñar Certificados (Rosa / Fucsia) */}
              <div
                className="bg-rose-50/80 dark:bg-rose-950/40 p-5 rounded-2xl shadow-sm border border-rose-200 dark:border-rose-800/60 cursor-pointer hover:shadow-md hover:border-rose-400 dark:hover:border-rose-600 transition duration-150 flex flex-col justify-between"
                onClick={() => onNavigate("docentCertificateDesigner")}
              >
                <div>
                  <p className="text-rose-700 dark:text-rose-300 text-xs font-bold uppercase tracking-wider">
                    Diseñar Certificados
                  </p>
                  <p className="text-3xl font-black text-rose-950 dark:text-rose-100 mt-2">
                    Formatos
                  </p>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-400 mt-4 font-medium">
                  Plantillas oficiales y firmas →
                </p>
              </div>

              {/* 6. Reportes y Constancias (Cian / Índigo) */}
              <div
                className="bg-cyan-50/80 dark:bg-cyan-950/40 p-5 rounded-2xl shadow-sm border border-cyan-200 dark:border-cyan-800/60 cursor-pointer hover:shadow-md hover:border-cyan-400 dark:hover:border-cyan-600 transition duration-150 flex flex-col justify-between"
                onClick={() => onNavigate("docentReports")}
              >
                <div>
                  <p className="text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
                    Reportes y Constancias
                  </p>
                  <p className="text-3xl font-black text-cyan-950 dark:text-cyan-100 mt-2">
                    Oficiales
                  </p>
                </div>
                <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-4 font-medium">
                  Emitir constancias en PDF →
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mt-8">
              Gestiona tus prácticas clínicas y califica el desempeño formativo de tus estudiantes con notas reales de 0.0 a 5.0.
            </p>

            {/* Tareas Asignadas Reales con Soporte de Modo Oscuro */}
            <div className="mt-6 p-6 bg-gray-50/80 dark:bg-zinc-800/50 rounded-2xl border border-gray-200 dark:border-zinc-800">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-purple-500" /> Mis Tareas Asignadas
              </h4>
              <ul className="space-y-2">
                {docentStats.tasks && docentStats.tasks.length > 0 ? (
                  docentStats.tasks.map((task, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0"></span>
                      <span>{task}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Todas las evaluaciones formativas están al día.
                  </li>
                )}
              </ul>
            </div>
          </>
        );

      case "auditor":
        return <AuditorDashboardView onNavigate={onNavigate} />;

      case "superadmin":
        return (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Crown className="w-6 h-6 text-amber-500" /> Panel de Control Super Administrador
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Gestión integral de la institución educativa, parámetros globales y usuarios de todas las facultades.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <Crown className="w-3.5 h-3.5" /> Superadmin Activo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tarjeta 1: Parametrización Institucional */}
              <div
                className="bg-amber-50/80 dark:bg-amber-950/40 p-6 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-800/60 cursor-pointer hover:shadow-md hover:border-amber-400 dark:hover:border-amber-600 transition duration-150"
                onClick={() => onNavigate("adminInstitutionSettings")}
              >
                <div className="flex items-center justify-between">
                  <p className="text-amber-700 dark:text-amber-300 text-sm font-bold uppercase tracking-wider">
                    Parametrización
                  </p>
                  <Landmark className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-2xl font-black text-amber-950 dark:text-amber-100 mt-2">
                  Institución
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Personalizar colores, nombre, logo y membrete →
                </p>
              </div>

              {/* Tarjeta 2: Total Administradores */}
              <div
                className="bg-gray-100 dark:bg-zinc-800/60 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-700 cursor-pointer hover:shadow-md transition duration-150"
                onClick={() => onNavigate("adminUsers")}
              >
                <p className="text-gray-700 dark:text-gray-300 text-sm font-bold uppercase tracking-wider">
                  Total Administradores
                </p>

                <div className="flex items-center justify-between gap-3 mt-2">
                  <p className="text-4xl font-black text-gray-900 dark:text-white flex-shrink-0">
                    {isLoadingUsers
                      ? "..."
                      : (usersByRole.superadmin || 0) + (usersByRole.admin || 0)}
                  </p>

                  <div className="flex flex-col text-[11px] leading-tight text-gray-700 dark:text-gray-300 border-l border-gray-300 dark:border-zinc-600 pl-3 space-y-1 select-none">
                    <span title="Superadministradores" className="flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-500" /> <strong>{isLoadingUsers ? "-" : usersByRole.superadmin}</strong> Superadmins
                    </span>
                    <span title="Administradores" className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-500" /> <strong>{isLoadingUsers ? "-" : usersByRole.admin}</strong> Admins
                    </span>
                  </div>
                </div>

                {userCountError && (
                  <p className="text-sm text-red-500 mt-1">{userCountError}</p>
                )}
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Gestionar administradores y superadmins →
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mt-8">
              Como Super Administrador tienes el control total para configurar la entidad educativa, personalizar la estética de la plataforma y gestionar la base de datos de usuarios administradores.
            </p>

            <div className="mt-6 p-6 bg-gray-50/80 dark:bg-zinc-800/50 rounded-2xl border border-gray-200 dark:border-zinc-800">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> Tareas Rápidas de Superadmin
              </h4>
              <ul className="space-y-2">
                <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                  <span>Parametrizar el nombre, logo, membrete y esquema de colores claro/oscuro.</span>
                </li>
                <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                  <span>Gestionar altas, bajas y permisos de superadministradores y administradores.</span>
                </li>
              </ul>
            </div>
          </>
        );

      case "admin":
        return (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Resumen Administrador Maestro
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
                  Control integral del sistema, parametrización de catálogos y gestión de rotaciones clínicas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Tarjeta 1: Total Usuarios (Azul Zafiro / Cyan) */}
              <div
                className="group relative bg-blue-50/80 dark:bg-blue-950/35 p-6 rounded-2xl border border-blue-200 dark:border-blue-800/60 shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
                onClick={() => onNavigate("adminUsers")}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider">
                      Total Usuarios
                    </p>
                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 group-hover:scale-110 transition-transform">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-4xl font-black text-blue-950 dark:text-blue-100 flex-shrink-0">
                      {isLoadingUsers
                        ? "..."
                        : (usersByRole.student || 0) +
                          (usersByRole.docent || 0) +
                          (usersByRole.auditor || 0) +
                          (usersByRole.admin || 0)}
                    </p>

                    <div className="flex flex-col text-[11px] leading-tight text-blue-800 dark:text-blue-300 border-l border-blue-300 dark:border-blue-800 pl-3 space-y-0.5 select-none">
                      <span title="Estudiantes" className="flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" /> <strong>{isLoadingUsers ? "-" : usersByRole.student}</strong> Estudiantes
                      </span>
                      <span title="Docentes" className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> <strong>{isLoadingUsers ? "-" : usersByRole.docent}</strong> Docentes
                      </span>
                      <span title="Auditores" className="flex items-center gap-1">
                        <Search className="w-3 h-3" /> <strong>{isLoadingUsers ? "-" : usersByRole.auditor}</strong> Auditores
                      </span>
                      <span title="Administradores" className="flex items-center gap-1">
                        <Shield className="w-3 h-3" /> <strong>{isLoadingUsers ? "-" : usersByRole.admin}</strong> Admins
                      </span>
                    </div>
                  </div>
                </div>

                {userCountError && (
                  <p className="text-xs text-red-500 mt-2">{userCountError}</p>
                )}
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-5 font-bold flex items-center justify-between">
                  <span>Gestionar todos los usuarios</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </p>
              </div>

              {/* Tarjeta 2: Prácticas Formativas (Verde Esmeralda) */}
              <div
                className="group relative bg-emerald-50/80 dark:bg-emerald-950/35 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm hover:shadow-lg hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
                onClick={() => onNavigate("adminPractices")}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                      Prácticas Formativas
                    </p>
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 group-hover:scale-110 transition-transform">
                      <Briefcase className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-4xl font-black text-emerald-950 dark:text-emerald-100 flex-shrink-0">
                      {isLoadingPractices ? "..." : totalPractices}
                    </p>
                    <div className="flex flex-col text-[11px] leading-tight text-emerald-800 dark:text-emerald-300 border-l border-emerald-300 dark:border-emerald-800 pl-3 space-y-0.5 select-none">
                      <span className="flex items-center gap-1">
                        <strong>Activas</strong> en curso
                      </span>
                      <span className="flex items-center gap-1">
                        Rotaciones clínicas
                      </span>
                    </div>
                  </div>
                </div>
                {practiceCountError && (
                  <p className="text-xs text-red-500 mt-2">{practiceCountError}</p>
                )}
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-5 font-bold flex items-center justify-between">
                  <span>Crear y gestionar prácticas</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </p>
              </div>

              {/* Tarjeta 3: Diseñar Certificados (Ámbar Dorado UPTC) */}
              <div
                className="group relative bg-amber-50/80 dark:bg-amber-950/35 p-6 rounded-2xl border border-amber-200 dark:border-amber-800/60 shadow-sm hover:shadow-lg hover:border-amber-400 dark:hover:border-amber-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
                onClick={() => onNavigate("adminCertificateDesigner")}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
                      Certificados
                    </p>
                    <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 group-hover:scale-110 transition-transform">
                      <Scroll className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-3xl font-black text-amber-950 dark:text-amber-100 flex items-center gap-1.5 flex-shrink-0">
                      <span>Oficial</span>
                    </p>
                    <div className="flex flex-col text-[11px] leading-tight text-amber-800 dark:text-amber-300 border-l border-amber-300 dark:border-amber-800 pl-3 space-y-0.5 select-none">
                      <span>Diseño UPTC</span>
                      <span>QR y membrete</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-5 font-bold flex items-center justify-between">
                  <span>Diseñar y emitir certificados</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </p>
              </div>

              {/* Tarjeta 4: Reportes Emitidos (Púrpura / Violeta - En lugar del 15 fijo) */}
              <div
                className="group relative bg-purple-50/80 dark:bg-purple-950/35 p-6 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-sm hover:shadow-lg hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
                onClick={() => onNavigate("adminReports")}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider">
                      Reportes Emitidos
                    </p>
                    <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 group-hover:scale-110 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-4xl font-black text-purple-950 dark:text-purple-100 flex-shrink-0">
                      {isLoadingReports ? "..." : reportStats.total_emitidos}
                    </p>
                    <div className="flex flex-col text-[11px] leading-tight text-purple-800 dark:text-purple-300 border-l border-purple-300 dark:border-purple-800 pl-3 space-y-0.5 select-none">
                      <span title="Informes clínicos emitidos" className="flex items-center gap-1">
                        <strong>{isLoadingReports ? "-" : reportStats.total_informes}</strong> Informes
                      </span>
                      <span title="Certificaciones solicitadas" className="flex items-center gap-1">
                        <strong>{isLoadingReports ? "-" : reportStats.total_certificados}</strong> Certificados
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-5 font-bold flex items-center justify-between">
                  <span>Consultar reportes y constancias</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mt-8">
              Control integral del sistema, parametrización de catálogos y gestión de rotaciones clínicas.
            </p>

            <div className="mt-6 p-6 bg-gray-50/80 dark:bg-zinc-800/50 rounded-2xl border border-gray-200 dark:border-zinc-800">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-500" /> Mis Tareas Asignadas
              </h4>
              <ul className="space-y-2">
                <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                  <span>Crear y habilitar nuevos usuarios de la facultad.</span>
                </li>
                <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                  <span>Parametrizar convenios y escenarios de práctica clínica.</span>
                </li>
                <li className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                  <span>Generar reporte de actividad y certificaciones.</span>
                </li>
              </ul>
            </div>
          </>
        );
      default:
        return (
          <p className="text-gray-700 dark:text-gray-300">
            Selecciona una opción del menú lateral.
          </p>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition-colors">
      <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-6 tracking-tight">
        Dashboard
      </h2>
      {getRoleSpecificContent(userRole)}
    </div>
  );
};

export default DashboardHome;
