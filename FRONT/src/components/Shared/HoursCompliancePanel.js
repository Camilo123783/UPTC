// ============================================================
// HoursCompliancePanel.js — Panel de Cumplimiento de Horas UPTC
// Selección de Práctica (estilo Panel de Creación) y Cuadre de Horas de Estudiantes
// - Cantidad de horas asignadas: Administrador y Docente
// - Horas hechas (cumplidas): Docente y Auditor
// ============================================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { BACKEND_URL } from "../../config/api";
import { useDataSync, notifyDataChanged } from "../../utils/dataSync";
import { toast } from "react-toastify";
import { generateCsv, generateXls } from "../../utils/reportGenerator";
import {
  Clock,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Building2,
  GraduationCap,
  Zap,
  BarChart3,
  Search,
  ClipboardList,
  UserCheck,
  Shield,
  Edit3,
  Landmark,
  BookOpen,
  Book,
  CheckCircle2,
  Check,
  Hourglass,
  Circle,
  Save,
  MousePointerClick
} from "lucide-react";

const API_BASE_URL = BACKEND_URL;

const HoursCompliancePanel = ({ role = "docent" }) => {
  const isDocent = role === "docent";
  const isAuditor = role === "auditor";

  // ─── Estados de Datos ───
  const [practices, setPractices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState({});

  // Práctica actualmente seleccionada en el panel
  const [selectedPracticeId, setSelectedPracticeId] = useState(null);

  // ─── Modificaciones locales no guardadas: { [studentKey]: { horas_cumplidas, horas_asignadas } } ───
  const [editedHours, setEditedHours] = useState({});

  // ─── Filtros de Prácticas ───
  const [practiceSearchTerm, setPracticeSearchTerm] = useState("");
  const [practiceStatusFilter, setPracticeStatusFilter] = useState("Todos");

  // ─── Filtros de Estudiantes dentro de la práctica seleccionada ───
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all"); // 'all' | 'completed' | 'in_progress' | 'not_started'

  const studentsSectionRef = useRef(null);

  // ─── Carga de Datos desde la API ───
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const token =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      let storedUser = null;
      try {
        const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
        if (stored) storedUser = JSON.parse(stored);
      } catch (e) {
        console.warn("No se pudo leer sesión de usuario:", e);
      }

      const userCedula = storedUser?.cedula || storedUser?.Cédula || null;
      const userInstitucionId = storedUser?.institucion_id || null;

      let practicesUrl = "";
      if (isDocent) {
        practicesUrl = userCedula
          ? `${API_BASE_URL}/api/docent/practices/${userCedula}`
          : `${API_BASE_URL}/api/docent/practices`;
      } else if (isAuditor) {
        const instParam = userInstitucionId ? `?institucion_id=${userInstitucionId}` : "";
        practicesUrl = `${API_BASE_URL}/api/auditor/practices${instParam}`;
      } else {
        practicesUrl = `${API_BASE_URL}/api/admin/practices`;
      }

      const res = await fetch(practicesUrl, { headers });
      if (res.ok) {
        const pData = await res.json();
        const pList = Array.isArray(pData) ? pData : [];
        setPractices(pList);

        // Preseleccionar la primera práctica si no hay ninguna seleccionada
        if (pList.length > 0) {
          setSelectedPracticeId((prev) => {
            if (prev && pList.some((p) => String(p.id) === String(prev))) {
              return prev;
            }
            return pList[0].id;
          });
        }
      }
    } catch (err) {
      console.error("Error al cargar prácticas para cuadre de horas:", err);
      toast.error("Error de conexión al cargar las prácticas formativas.");
    } finally {
      setIsLoading(false);
    }
  }, [isDocent, isAuditor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDataSync(fetchData);

  // ─── Estilos de Badges de Estado de Práctica ───
  const getBadgeStyle = (estado) => {
    switch (estado) {
      case "Activa":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      case "Planificada":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800";
      case "Finalizada":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-800";
      case "Cancelada":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300 border-gray-300 dark:border-zinc-700";
    }
  };

  // ─── Filtrado de Tarjetas de Prácticas ───
  const filteredPractices = useMemo(() => {
    return practices.filter((p) => {
      // Filtro de estado
      if (practiceStatusFilter !== "Todos" && p.estado !== practiceStatusFilter) {
        return false;
      }

      // Filtro de búsqueda
      if (practiceSearchTerm.trim()) {
        const query = practiceSearchTerm.toLowerCase();
        const titulo = (p.titulo || "").toLowerCase();
        const inst = (p.institucion_nombre || "").toLowerCase();
        const serv = (p.servicio_nombre || "").toLowerCase();
        const doc = (p.docente_nombre || "").toLowerCase();
        const aud = (p.auditor_nombre || "").toLowerCase();
        const prog = (p.programa_nombre || "").toLowerCase();
        const asig = (p.asignatura_nombre || "").toLowerCase();

        const matchEstudiante = (p.estudiantes || []).some(
          (e) =>
            (e.nombre_completo || "").toLowerCase().includes(query) ||
            String(e.cedula || "").includes(query)
        );

        return (
          titulo.includes(query) ||
          inst.includes(query) ||
          serv.includes(query) ||
          doc.includes(query) ||
          aud.includes(query) ||
          prog.includes(query) ||
          asig.includes(query) ||
          matchEstudiante
        );
      }

      return true;
    });
  }, [practices, practiceStatusFilter, practiceSearchTerm]);

  // ─── Práctica Actualmente Seleccionada ───
  const currentPractice = useMemo(() => {
    if (!selectedPracticeId) return filteredPractices[0] || practices[0] || null;
    return practices.find((p) => String(p.id) === String(selectedPracticeId)) || filteredPractices[0] || practices[0] || null;
  }, [practices, filteredPractices, selectedPracticeId]);

  // ─── Estudiantes de la Práctica Seleccionada con Horas Editadas ───
  const practiceStudents = useMemo(() => {
    if (!currentPractice || !currentPractice.estudiantes) return [];

    return currentPractice.estudiantes.map((st) => {
      const key = `${currentPractice.id}_${st.cedula}`;
      const edited = editedHours[key];
      const horasAsignadas = edited?.horas_asignadas !== undefined
        ? edited.horas_asignadas
        : (st.horas_asignadas || currentPractice.horas_totales || 120);
      const horasCumplidas = edited?.horas_cumplidas !== undefined
        ? edited.horas_cumplidas
        : (st.horas_cumplidas || 0);

      const pct = Math.min(100, Math.round((horasCumplidas / (horasAsignadas || 1)) * 100));

      return {
        key,
        practiceId: currentPractice.id,
        practiceName: currentPractice.titulo || currentPractice.servicio_nombre || "Práctica Formativa",
        hospital: currentPractice.institucion_nombre || "Hospital Universitario",
        service: currentPractice.servicio_nombre || "Servicio Asistencial",
        docentName: currentPractice.docente_nombre || "Docente UPTC",
        auditorName: currentPractice.auditor_nombre || "Auditor Asistencial",
        period: currentPractice.periodo || "2024-1",
        cedula: String(st.cedula),
        fullName: st.nombre_completo || `${st.nombre || ""} ${st.apellidos || ""}`.trim() || `Estudiante #${st.cedula}`,
        career: st.carrera || currentPractice.programa_nombre || "Facultad de Salud",
        email: st.correo || st.correo_institucional || "",
        horasAsignadas,
        horasCumplidas,
        progreso: pct,
        isModified: !!edited,
      };
    });
  }, [currentPractice, editedHours]);

  // ─── Filtrado de Estudiantes de la Práctica Seleccionada ───
  const filteredStudents = useMemo(() => {
    return practiceStudents.filter((st) => {
      if (studentStatusFilter === "completed" && st.horasCumplidas < st.horasAsignadas) {
        return false;
      }
      if (studentStatusFilter === "in_progress" && (st.horasCumplidas === 0 || st.horasCumplidas >= st.horasAsignadas)) {
        return false;
      }
      if (studentStatusFilter === "not_started" && st.horasCumplidas > 0) {
        return false;
      }

      if (studentSearchTerm.trim()) {
        const term = studentSearchTerm.toLowerCase();
        return (
          st.fullName.toLowerCase().includes(term) ||
          st.cedula.includes(term) ||
          st.career.toLowerCase().includes(term) ||
          st.email.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [practiceStudents, studentStatusFilter, studentSearchTerm]);

  // ─── Estadísticas de la Práctica Seleccionada ───
  const practiceStats = useMemo(() => {
    const totalEst = practiceStudents.length;
    const totalAsig = practiceStudents.reduce((sum, s) => sum + (s.horasAsignadas || 0), 0);
    const totalCump = practiceStudents.reduce((sum, s) => sum + (s.horasCumplidas || 0), 0);
    const avgProg = totalAsig > 0 ? Math.min(100, Math.round((totalCump / totalAsig) * 100)) : 0;
    const cumplidos = practiceStudents.filter((s) => s.horasCumplidas >= s.horasAsignadas && s.horasAsignadas > 0).length;

    return { totalEst, totalAsig, totalCump, avgProg, cumplidos };
  }, [practiceStudents]);

  // ─── KPIs Globales ───
  const globalKpis = useMemo(() => {
    let totalEstudiantes = 0;
    let totalHorasProg = 0;
    let totalHorasHechas = 0;

    practices.forEach((pr) => {
      (pr.estudiantes || []).forEach((st) => {
        totalEstudiantes++;
        const asig = st.horas_asignadas || pr.horas_totales || 120;
        const cump = st.horas_cumplidas || 0;
        totalHorasProg += asig;
        totalHorasHechas += cump;
      });
    });

    const cumplimiento = totalHorasProg > 0 ? Math.min(100, Math.round((totalHorasHechas / totalHorasProg) * 100)) : 0;

    return {
      totalPracticas: practices.length,
      totalEstudiantes,
      totalHorasProg,
      totalHorasHechas,
      cumplimiento,
    };
  }, [practices]);

  // ─── Manejador de Selección de Práctica ───
  const handleSelectPractice = (practiceId) => {
    setSelectedPracticeId(practiceId);
    setTimeout(() => {
      if (studentsSectionRef.current) {
        studentsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // ─── Manejadores de Edición de Horas ───
  const handleHoursChange = (key, field, value) => {
    const numericVal = Math.max(0, parseInt(value, 10) || 0);
    setEditedHours((prev) => {
      const current = prev[key] || {};
      const currentStudent = practiceStudents.find((s) => s.key === key);
      return {
        ...prev,
        [key]: {
          horas_cumplidas: field === "horas_cumplidas"
            ? numericVal
            : (current.horas_cumplidas !== undefined ? current.horas_cumplidas : currentStudent?.horasCumplidas || 0),
          horas_asignadas: field === "horas_asignadas"
            ? numericVal
            : (current.horas_asignadas !== undefined ? current.horas_asignadas : currentStudent?.horasAsignadas || 120),
        },
      };
    });
  };

  // Botón de turno rápido (+4h, +8h, +12h, o reset a 0)
  const handleQuickAddShift = (key, delta) => {
    const currentStudent = practiceStudents.find((s) => s.key === key);
    if (!currentStudent) return;

    const currentCumplidas = currentStudent.horasCumplidas;
    const newCumplidas = Math.max(0, currentCumplidas + delta);

    setEditedHours((prev) => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          horas_cumplidas: newCumplidas,
          horas_asignadas: current.horas_asignadas !== undefined ? current.horas_asignadas : currentStudent.horasAsignadas,
        },
      };
    });
  };

  // ─── Guardar Horas de un Estudiante en el Backend ───
  const handleSaveStudentHours = async (st) => {
    const key = st.key;
    const edits = editedHours[key];
    if (!edits && !st.isModified) {
      toast.info("No hay cambios pendientes para guardar.");
      return;
    }

    const payload = {
      horas_cumplidas: edits?.horas_cumplidas !== undefined ? edits.horas_cumplidas : st.horasCumplidas,
      horas_asignadas: edits?.horas_asignadas !== undefined ? edits.horas_asignadas : st.horasAsignadas,
    };

    setIsSaving((prev) => ({ ...prev, [key]: true }));

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const endpoint = isAuditor
      ? `${API_BASE_URL}/api/auditor/practices/${st.practiceId}/students/${st.cedula}/hours`
      : `${API_BASE_URL}/api/docent/practices/${st.practiceId}/students/${st.cedula}/hours`;

    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Error al actualizar las horas en el servidor.");
      }

      // Actualizar estado local en `practices`
      setPractices((prev) =>
        prev.map((pr) => {
          if (String(pr.id) === String(st.practiceId)) {
            const updatedEstudiantes = (pr.estudiantes || []).map((e) => {
              if (String(e.cedula) === String(st.cedula)) {
                return {
                  ...e,
                  horas_cumplidas: payload.horas_cumplidas,
                  horas_asignadas: payload.horas_asignadas,
                  horas_totales: payload.horas_asignadas,
                };
              }
              return e;
            });
            return { ...pr, estudiantes: updatedEstudiantes };
          }
          return pr;
        })
      );

      // Limpiar del mapa de modificaciones pendientes
      setEditedHours((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });

      notifyDataChanged("practices", "update");
      toast.success(
        `Horas de ${st.fullName.split(" ")[0]} guardadas: ${payload.horas_cumplidas} / ${payload.horas_asignadas} hrs.`
      );
    } catch (err) {
      console.error("Error al guardar horas:", err);
      toast.error(`No se pudieron guardar las horas: ${err.message}`);
    } finally {
      setIsSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  // ─── Guardar Todos los Cambios de la Práctica Seleccionada ───
  const handleSaveAllPracticeChanges = async () => {
    const keys = Object.keys(editedHours).filter((k) =>
      k.startsWith(`${currentPractice?.id}_`)
    );

    if (keys.length === 0) {
      toast.info("No hay modificaciones pendientes en esta práctica.");
      return;
    }

    let successCount = 0;
    for (const key of keys) {
      const st = practiceStudents.find((s) => s.key === key);
      if (st) {
        try {
          await handleSaveStudentHours(st);
          successCount++;
        } catch (e) {
          console.error("Error en lote:", e);
        }
      }
    }

    if (successCount > 0) {
      toast.success(`Se guardaron exitosamente los cambios de ${successCount} estudiante(s) en ${currentPractice?.titulo}.`);
    }
  };

  // ─── Exportar Datos ───
  const handleExport = (format) => {
    const data = practiceStudents.map((st) => ({
      "Práctica": st.practiceName,
      "Hospital": st.hospital,
      "Servicio": st.service,
      "Docente": st.docentName,
      "Estudiante": st.fullName,
      "Cédula": st.cedula,
      "Programa": st.career,
      "Horas Asignadas (Meta)": st.horasAsignadas,
      "Horas Cumplidas (Hechas)": st.horasCumplidas,
      "Progreso (%)": `${st.progreso}%`,
      "Estado": st.progreso >= 100 ? "Cumplida" : st.progreso > 0 ? "En Rotación" : "Sin Iniciar",
    }));

    const filename = `Cumplimiento_Horas_${currentPractice?.titulo || "Practica"}_UPTC`;
    if (format === "csv") {
      generateCsv(data, filename);
    } else {
      generateXls(data, filename);
    }
    toast.success(`Reporte exportado exitosamente.`);
  };

  // Contar cambios pendientes en la práctica activa
  const pendingCountForCurrentPractice = Object.keys(editedHours).filter((k) =>
    k.startsWith(`${currentPractice?.id}_`)
  ).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">

      {/* ─── Encabezado Institucional ─── */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </span>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-blue-300">
                {isDocent ? "Portal Docente · Tutoría Clínica" : isAuditor ? "Portal Auditor · Gestión Asistencial" : "Panel de Horas"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Cumplimiento de Horas de Práctica
              </h1>
            </div>
          </div>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            {isDocent
              ? "Selecciona una práctica formativa a tu cargo para inspeccionar sus estudiantes inscritos. Puedes asignar la meta total de horas y registrar las horas que van realizando."
              : "Selecciona una práctica formativa asistencial para verificar y cuadrar las horas clínicas cumplidas por cada estudiante en las entidades de salud."}
          </p>
        </div>

        {/* Acciones del Encabezado */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleExport("xls")}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            onClick={() => handleExport("csv")}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold border border-blue-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={fetchData}
            title="Recargar datos"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-600 transition-all cursor-pointer flex items-center justify-center"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Tarjetas de Indicadores Rápidos (KPIs Globales) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Prácticas Disponibles
            </p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
              {globalKpis.totalPracticas}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Estudiantes a Cargo
            </p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
              {globalKpis.totalEstudiantes}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Horas Realizadas
            </p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {globalKpis.totalHorasHechas} <span className="text-xs font-semibold text-gray-500">hrs</span>
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Cumplimiento Global
            </p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
              {globalKpis.cumplimiento}%
            </h3>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECCIÓN 1: SELECTOR DE PRÁCTICAS (TARJETAS ESTILO PANEL DE CREACIÓN)
          ============================================================ */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600 inline-block" /> 1. Selecciona la Práctica Formativa ({filteredPractices.length})
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Haz clic sobre cualquier práctica para cargar sus estudiantes inscritos y cuadrar sus horas asistenciales.
            </p>
          </div>

          {/* Filtros de la Galería de Prácticas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={practiceSearchTerm}
                onChange={(e) => setPracticeSearchTerm(e.target.value)}
                placeholder="Buscar por título, hospital, servicio..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={practiceStatusFilter}
              onChange={(e) => setPracticeStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="Todos">Todos los Estados</option>
              <option value="Activa">Activas</option>
              <option value="Planificada">Planificadas</option>
              <option value="Finalizada">Finalizadas</option>
            </select>
          </div>
        </div>

        {/* Galería de Tarjetas de Prácticas — Estilo Idéntico al Panel de Creación */}
        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
              Cargando prácticas formativas...
            </p>
          </div>
        ) : filteredPractices.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400">
            <ClipboardList className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="font-semibold text-sm">No se encontraron prácticas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPractices.map((p) => {
              const isSelected = currentPractice && String(p.id) === String(currentPractice.id);
              const studentCount = (p.estudiantes || []).length;
              const totalHoursReq = p.horas_totales || 120;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPractice(p.id)}
                  className={`flex flex-col justify-between rounded-2xl p-6 transition duration-200 cursor-pointer border ${
                    isSelected
                      ? "bg-blue-50/20 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500 shadow-xl shadow-blue-500/15"
                      : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-gray-400 dark:hover:border-zinc-600 hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getBadgeStyle(p.estado)}`}>
                        ● {p.estado}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 rounded-md">
                        Periodo {p.periodo || "2024-1"}
                      </span>
                    </div>

                    {/* Título de la práctica */}
                    <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-1">
                      {p.titulo}
                    </h3>

                    {/* Creada por */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Creada por:
                      </span>
                      {p.creado_por_rol === "docent" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shadow-sm">
                          <UserCheck className="w-3.5 h-3.5 inline-block" />
                          <span>Docente:</span>
                          <span className="underline decoration-purple-400 underline-offset-2">
                            {p.creador_nombre || p.docente_nombre || "Docente"}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 shadow-sm">
                          <Shield className="w-3.5 h-3.5 inline-block" />
                          <span>Administrador:</span>
                          <span className="underline decoration-indigo-400 underline-offset-2">
                            {p.creador_nombre || "Administrador UPTC"}
                          </span>
                        </span>
                      )}
                    </div>

                    {p.descripcion && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                        {p.descripcion}
                      </p>
                    )}

                    {/* Detalles relacionales asociados */}
                    <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 mb-6 bg-gray-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Creada por:</strong>{" "}
                          {p.creado_por_rol === "docent"
                            ? `Docente ${p.creador_nombre || p.docente_nombre || "Docente"}`
                            : `Administrador (${p.creador_nombre || "UPTC"})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Landmark className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Entidad:</strong> {p.institucion_nombre || "Sin asignar"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Servicio:</strong> {p.servicio_nombre || "Sin asignar"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Programa:</strong> {p.programa_nombre || "General"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Book className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Asignatura:</strong> {p.asignatura_nombre || "Sin asignar"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Docente:</strong> {p.docente_nombre?.trim() || "Sin docente"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Auditor:</strong> {p.auditor_nombre?.trim() || "Sin auditor"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer de la tarjeta */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-zinc-800 pt-3 mb-4">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-gray-400 inline-block" /> <strong>{studentCount}</strong> / {p.cupos || 10} cupos
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400 inline-block" /> {totalHoursReq}h certificadas
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPractice(p.id);
                      }}
                      className={`w-full py-2.5 px-3 text-xs font-bold rounded-xl transition text-center flex items-center justify-center gap-2 cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                          : "bg-gray-100 hover:bg-blue-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-blue-600 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Práctica Seleccionada
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-3.5 h-3.5" /> Seleccionar para Cuadrar Horas
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================
          SECCIÓN 2: ESTUDIANTES Y CUADRE DE HORAS DE LA PRÁCTICA SELECCIONADA
          ============================================================ */}
      <div ref={studentsSectionRef} className="space-y-4 pt-4">
        {currentPractice ? (
          <div className="rounded-3xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            {/* Banner de la Práctica Seleccionada */}
            <div className="p-6 bg-gradient-to-r from-blue-900/10 via-indigo-900/5 to-transparent border-b border-gray-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getBadgeStyle(currentPractice.estado)}`}>
                    ● {currentPractice.estado}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    Periodo {currentPractice.periodo || "2024-1"}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                  Estudiantes de: <span className="text-blue-600 dark:text-blue-400">{currentPractice.titulo}</span>
                </h2>

                <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1"><Landmark className="w-3.5 h-3.5 text-gray-400" /> <strong>Sede:</strong> {currentPractice.institucion_nombre || "Hospital Universitario"}</span>
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-gray-400" /> <strong>Servicio:</strong> {currentPractice.servicio_nombre || "Servicio Clínico"}</span>
                  <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-gray-400" /> <strong>Docente:</strong> {currentPractice.docente_nombre || "Tutor Clínico"}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /> <strong>Meta Base:</strong> {currentPractice.horas_totales || 120} hrs</span>
                </p>
              </div>

              {/* Indicadores Rápidos de la Práctica Seleccionada */}
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 text-center">
                  <span className="block text-[10px] uppercase font-bold text-gray-400">Inscritos</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white">
                    {practiceStats.totalEst} alumnos
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 text-center">
                  <span className="block text-[10px] uppercase font-bold text-gray-400">Avance Práctica</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {practiceStats.avgProg}%
                  </span>
                </div>

                {pendingCountForCurrentPractice > 0 && (
                  <button
                    onClick={handleSaveAllPracticeChanges}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95 animate-pulse"
                  >
                    <Save className="w-3.5 h-3.5" /> Guardar Cambios ({pendingCountForCurrentPractice})
                  </button>
                )}
              </div>
            </div>

            {/* Barra de Filtros Internos de Estudiantes */}
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  placeholder="Buscar alumno por nombre, cédula o programa..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={studentStatusFilter}
                  onChange={(e) => setStudentStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="all">Todos los Alumnos ({practiceStudents.length})</option>
                  <option value="completed">Cumplidas (100%+)</option>
                  <option value="in_progress">En Rotación (1-99%)</option>
                  <option value="not_started">Sin Iniciar (0 hrs)</option>
                </select>

                <span className="text-[11px] text-gray-500 dark:text-zinc-400 hidden sm:inline">
                  {isDocent && "Docente: Puedes asignar la meta y cuadrar las horas hechas."}
                  {isAuditor && "Auditor: Puedes verificar y cambiar las horas hechas."}
                </span>
              </div>
            </div>

            {/* Tabla de Estudiantes para Cuadrar Horas */}
            {practiceStudents.length === 0 ? (
              <div className="py-16 text-center text-gray-500 dark:text-zinc-400 px-4">
                <GraduationCap className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-bold text-gray-700 dark:text-zinc-300">
                  Esta práctica formativa aún no tiene estudiantes inscritos.
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                  Para cuadrar horas, vincula estudiantes a esta rotación desde el panel de prácticas o solicita al administrador la inscripción correspondiente.
                </p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-gray-500 dark:text-zinc-400">
                <p className="text-sm font-semibold">No se encontraron estudiantes con los filtros seleccionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-zinc-800/80 font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3.5">Estudiante</th>
                      <th className="px-4 py-3.5">Programa Académico</th>
                      <th className="px-4 py-3.5 text-center min-w-[140px]">
                        Horas Asignadas (Meta)
                        {isDocent && <span className="block text-[9px] text-blue-500 lowercase font-normal">editable docente</span>}
                      </th>
                      <th className="px-4 py-3.5 text-center min-w-[200px]">
                        Horas Hechas (Cumplidas)
                        <span className="block text-[9px] text-emerald-500 lowercase font-normal">turnos en hospital</span>
                      </th>
                      <th className="px-4 py-3.5 text-center min-w-[140px]">Progreso (%)</th>
                      <th className="px-4 py-3.5 text-center">Estado</th>
                      <th className="px-4 py-3.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900">
                    {filteredStudents.map((st) => {
                      const isDone = st.horasCumplidas >= st.horasAsignadas && st.horasAsignadas > 0;
                      const isSavingThis = isSaving[st.key];

                      return (
                        <tr
                          key={st.key}
                          className={`hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition ${
                            st.isModified ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          {/* Estudiante */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-gray-900 dark:text-white text-xs">
                              {st.fullName}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                              C.C. {st.cedula}
                            </div>
                            {st.email && (
                              <div className="text-[10px] text-gray-400 dark:text-zinc-500 truncate max-w-[200px]">
                                {st.email}
                              </div>
                            )}
                          </td>

                          {/* Programa */}
                          <td className="px-4 py-3.5 text-gray-700 dark:text-zinc-300 font-medium">
                            <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-[11px]">
                              {st.career}
                            </span>
                          </td>

                          {/* Horas Asignadas (Meta) — Asignada por Administrador y Docente */}
                          <td className="px-4 py-3.5 text-center">
                            {isDocent ? (
                              <div className="inline-flex items-center gap-1.5 justify-center">
                                <input
                                  type="number"
                                  min="1"
                                  max="999"
                                  value={st.horasAsignadas}
                                  onChange={(e) => handleHoursChange(st.key, "horas_asignadas", e.target.value)}
                                  className="w-16 px-2 py-1 text-center font-bold text-xs rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-[11px] text-gray-500 font-semibold">hrs</span>
                              </div>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300">
                                {st.horasAsignadas} hrs
                              </span>
                            )}
                          </td>

                          {/* Horas Hechas (Cumplidas) — Cambiadas por Docente y Auditor */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col items-center gap-1.5">
                              {/* Input Numérico Directo */}
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="999"
                                  value={st.horasCumplidas}
                                  onChange={(e) => handleHoursChange(st.key, "horas_cumplidas", e.target.value)}
                                  className="w-20 px-2.5 py-1 text-center font-black text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <span className="text-[11px] font-bold text-gray-500">hrs hechas</span>
                              </div>

                              {/* Botones de Turnos Rápidos */}
                              <div className="flex items-center gap-1 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddShift(st.key, 4)}
                                  title="Sumar turno de 4 horas"
                                  className="px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 font-bold transition cursor-pointer"
                                >
                                  +4h
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddShift(st.key, 8)}
                                  title="Sumar turno de 8 horas"
                                  className="px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 font-bold transition cursor-pointer"
                                >
                                  +8h
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddShift(st.key, 12)}
                                  title="Sumar turno de 12 horas"
                                  className="px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 font-bold transition cursor-pointer"
                                >
                                  +12h
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHoursChange(st.key, "horas_cumplidas", 0)}
                                  title="Restablecer horas hechas a 0"
                                  className="px-1 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 transition cursor-pointer"
                                >
                                  0h
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Progreso Visual */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-1 w-28 mx-auto">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span className={isDone ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "text-gray-700 dark:text-zinc-300"}>
                                  {st.progreso}%
                                </span>
                                <span className="text-gray-400 text-[10px]">
                                  {st.horasCumplidas}/{st.horasAsignadas}h
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isDone
                                      ? "bg-emerald-500"
                                      : st.progreso >= 50
                                      ? "bg-blue-500"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${st.progreso}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3.5 text-center">
                            {isDone ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Cumplida
                              </span>
                            ) : st.horasCumplidas > 0 ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-300 dark:border-blue-800 inline-flex items-center gap-1">
                                <Hourglass className="w-3 h-3" /> En Rotación
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 inline-flex items-center gap-1">
                                <Circle className="w-3 h-3" /> Sin Horas
                              </span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleSaveStudentHours(st)}
                              disabled={isSavingThis}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 ml-auto cursor-pointer active:scale-95 ${
                                st.isModified
                                   ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
                              }`}
                            >
                              {isSavingThis ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Guardando...
                                </>
                              ) : st.isModified ? (
                                <>
                                  <Save className="w-3 h-3" /> Guardar
                                </>
                              ) : (
                                <>
                                  <Check className="w-3 h-3" /> Al día
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400">
            <MousePointerClick className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="font-bold text-sm">Selecciona una práctica arriba para ver sus estudiantes y cuadrar sus horas.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HoursCompliancePanel;
