// ============================================================
// AuditorReports.js — Centro Integral de Informes Clínicos UPTC
// Visualización de todas las prácticas a cargo, estudiantes matriculados,
// emisión de rúbricas de desempeño para el docente y exportación.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BACKEND_URL } from "../../config/api";
import { useDataSync } from "../../utils/dataSync";
import { generateCsv, generateXls } from "../../utils/reportGenerator";
import ClinicalReportModal from "./ClinicalReportModal";
import {
  FileText,
  Download,
  Search,
  Filter,
  RefreshCw,
  GraduationCap,
  Building,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  Award,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCheck,
  FileClock,
  ExternalLink,
} from "lucide-react";
import StudentAvatar from "../Shared/StudentAvatar";
import StudentFichaModal from "../Shared/StudentFichaModal";

const AuditorReports = () => {
  const [practices, setPractices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPracticeFilter, setSelectedPracticeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'pending' | 'completed'

  // Prácticas colapsadas / expandidas en la vista
  const [collapsedPractices, setCollapsedPractices] = useState({});

  // Modal para ver ficha completa e integral de un estudiante
  const [selectedStudentForFicha, setSelectedStudentForFicha] = useState(null);

  // Modal de Emisión / Edición de Reporte Clínico
  const [reportModal, setReportModal] = useState({
    isOpen: false,
    student: null,
    practice: null,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${BACKEND_URL}/api/auditor/practices`, { headers });
      if (!res.ok) throw new Error("No se pudieron cargar las prácticas formativas.");
      const pData = await res.json();
      setPractices(Array.isArray(pData) ? pData : []);
    } catch (err) {
      console.error("Error al cargar prácticas en AuditorReports:", err);
      setError("Error de conexión al cargar la información de las prácticas e informes.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDataSync(fetchData);

  const toggleCollapse = (practiceId) => {
    setCollapsedPractices((prev) => ({
      ...prev,
      [practiceId]: !prev[practiceId],
    }));
  };

  // Filtrado de Prácticas y Estudiantes
  const filteredPractices = useMemo(() => {
    return practices
      .filter((pr) => {
        if (selectedPracticeFilter !== "all" && String(pr.id) !== String(selectedPracticeFilter)) {
          return false;
        }
        return true;
      })
      .map((pr) => {
        let students = pr.estudiantes || [];

        // Filtro por estado de informe
        if (statusFilter === "pending") {
          students = students.filter((s) => !s.report_id);
        } else if (statusFilter === "completed") {
          students = students.filter((s) => !!s.report_id);
        }

        // Filtro por búsqueda
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const matchPrTitle = (pr.titulo || "").toLowerCase().includes(query);
          const matchInst = (pr.institucion_nombre || "").toLowerCase().includes(query);
          const matchDoc = (pr.docente_nombre || "").toLowerCase().includes(query);

          if (!matchPrTitle && !matchInst && !matchDoc) {
            students = students.filter((s) => {
              const matchName = (s.nombre_completo || "").toLowerCase().includes(query);
              const matchCed = String(s.cedula || "").includes(query);
              const matchCod = s.codigo && s.codigo.toLowerCase().includes(query);
              return matchName || matchCed || matchCod;
            });
          }
        }

        return {
          ...pr,
          displayStudents: students,
        };
      })
      .filter((pr) => pr.displayStudents.length > 0 || !searchTerm.trim());
  }, [practices, selectedPracticeFilter, statusFilter, searchTerm]);

  // Contadores Globales
  const totalMetrics = useMemo(() => {
    let totalEst = 0;
    let emitidos = 0;
    let pendientes = 0;

    practices.forEach((pr) => {
      (pr.estudiantes || []).forEach((st) => {
        totalEst++;
        if (st.report_id) {
          emitidos++;
        } else {
          pendientes++;
        }
      });
    });

    return {
      totalPractices: practices.length,
      totalEst,
      emitidos,
      pendientes,
    };
  }, [practices]);

  // Exportar Informe Consolidado
  const handleExportConsolidated = (format, practiceSubset = null) => {
    const listToExport = practiceSubset ? [practiceSubset] : practices;
    const exportRows = [];

    listToExport.forEach((pr) => {
      (pr.estudiantes || []).forEach((st) => {
        const horasAsignadas = st.horas_asignadas || pr.horas_totales || 120;
        const horasCumplidas = st.horas_cumplidas || 0;
        const pct = Math.round((horasCumplidas / (horasAsignadas || 1)) * 100);

        exportRows.push({
          Práctica: pr.titulo || `Práctica #${pr.id}`,
          Periodo: pr.periodo || "N/A",
          Institución_Hospital: pr.institucion_nombre || "N/A",
          Servicio: pr.servicio_nombre || "N/A",
          Docente_Tutor: pr.docente_nombre || "Docente UPTC",
          Docente_Correo: pr.docente_correo || "N/A",
          Estudiante_Nombre: st.nombre_completo || st.nombre,
          Estudiante_Cédula: st.cedula,
          Estudiante_Código: st.codigo || "N/A",
          Estudiante_Carrera: st.carrera || "Salud",
          Horas_Cumplidas: horasCumplidas,
          Horas_Requeridas: horasAsignadas,
          Progreso_Asistencia: `${pct}%`,
          Estado_Informe: st.report_id ? "Emitido" : "Pendiente",
          Nota_Sugerida: st.nota_sugerida !== null ? st.nota_sugerida : "N/A",
          Concepto_Clínico: st.concepto || "Sin evaluar",
          Conocimiento_Teórico: st.conocimiento_teorico || "N/A",
          Habilidades_Prácticas: st.habilidades_practicas || "N/A",
          Actitud_Ética: st.actitud_etica || "N/A",
          Comunicación_Equipo: st.comunicacion_equipo || "N/A",
          Puntualidad_Asistencia: st.puntualidad_asistencia || "N/A",
          Observaciones: st.observaciones || "N/A",
          Fecha_Informe: st.fecha_reporte ? new Date(st.fecha_reporte).toLocaleDateString("es-CO") : "N/A",
        });
      });
    });

    const filename = practiceSubset
      ? `Informe_Practica_${practiceSubset.id}_${new Date().toISOString().substring(0, 10)}`
      : `Informe_General_Auditoria_UPTC_${new Date().toISOString().substring(0, 10)}`;

    if (format === "csv") {
      generateCsv(exportRows, filename);
    } else {
      generateXls(exportRows, filename);
    }
  };

  const getConceptBadge = (concepto) => {
    switch (concepto) {
      case "Excelente":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
      case "Favorable":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
      case "En Seguimiento":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
      case "Requiere Refuerzo":
        return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
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
                <FileText className="w-5 h-5" />
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Generador de Informes y Rúbricas Clínicas
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Supervisión de todas las prácticas formativas a cargo, estudiantes matriculados y emisión de conceptos evaluativos para los docentes tutores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExportConsolidated("csv")}
              disabled={practices.length === 0}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Todos CSV</span>
            </button>
            <button
              onClick={() => handleExportConsolidated("xls")}
              disabled={practices.length === 0}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Todos Excel</span>
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 transition"
              title="Recargar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ─── Tarjetas de Resumen Global ─── */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              Prácticas a Cargo
            </span>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              {totalMetrics.totalPractices}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Rotaciones bajo auditoría</p>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Estudiantes Asignados
            </span>
            <p className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">
              {totalMetrics.totalEst}
            </p>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">En todos los servicios</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Informes Emitidos
            </span>
            <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
              {totalMetrics.emitidos}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">Entregados al docente</p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Pendientes por Evaluar
            </span>
            <p className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1">
              {totalMetrics.pendientes}
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Requieren rúbrica</p>
          </div>
        </div>

        {/* ─── Barra de Filtros ─── */}
        <div className="mt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por estudiante, código, cédula, práctica o docente..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <select
            value={selectedPracticeFilter}
            onChange={(e) => setSelectedPracticeFilter(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
          >
            <option value="all">Todas las prácticas ({practices.length})</option>
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.institucion_nombre || "Hospital"})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Solo pendientes por emitir</option>
            <option value="completed">Solo informes emitidos</option>
          </select>
        </div>

        {/* ─── LISTA COMPLETA DE PRÁCTICAS Y ESTUDIANTES ─── */}
        <div className="mt-8 space-y-6">
          {isLoading ? (
            <div className="text-center py-16 text-xs text-gray-500 animate-pulse">
              Cargando todas las prácticas formativas y expedientes de estudiantes...
            </div>
          ) : filteredPractices.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-dashed border-gray-200 dark:border-zinc-800">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                No se encontraron prácticas con los filtros seleccionados.
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Asegúrate de que el filtro de búsqueda o estado no esté limitando los resultados.
              </p>
            </div>
          ) : (
            filteredPractices.map((pr) => {
              const isCollapsed = !!collapsedPractices[pr.id];
              const students = pr.displayStudents || [];
              const prCompleted = students.filter((s) => s.report_id).length;

              return (
                <div
                  key={pr.id}
                  className="rounded-3xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-md overflow-hidden transition"
                >
                  {/* Cabecera de la Práctica */}
                  <div className="p-5 sm:p-6 bg-gray-50/80 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          {pr.estado || "Activa"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          Periodo {pr.periodo || "2026-1"}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400">
                          Horas requeridas: {pr.horas_totales || 120}h
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-gray-900 dark:text-white">
                        {pr.titulo || `Práctica Formativa #${pr.id}`}
                      </h3>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-600 dark:text-zinc-400 mt-2">
                        <span className="flex items-center gap-1 font-medium">
                          <Building className="w-3.5 h-3.5 text-amber-500" />
                          <span>{pr.institucion_nombre || "Hospital Universitario"}</span>
                          {pr.servicio_nombre && <span> · {pr.servicio_nombre}</span>}
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                          <span>
                            Docente: <strong>{pr.docente_nombre || "Docente UPTC"}</strong>
                          </span>
                          {pr.docente_correo && (
                            <span className="text-gray-400">({pr.docente_correo})</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Acciones de Cabecera */}
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        onClick={() => handleExportConsolidated("csv", pr)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition flex items-center gap-1 cursor-pointer"
                        title="Exportar esta práctica en CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar</span>
                      </button>

                      <button
                        onClick={() => toggleCollapse(pr.id)}
                        className="p-2 rounded-xl bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition cursor-pointer"
                        title={isCollapsed ? "Expandir" : "Contraer"}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo: Tabla de Estudiantes de esta Práctica */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      {students.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-500">
                          No hay estudiantes asignados en esta práctica bajo los criterios seleccionados.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] bg-gray-50/40 dark:bg-zinc-800/20">
                              <th className="py-3 px-4">Estudiante</th>
                              <th className="py-3 px-4">Horas Cumplidas</th>
                              <th className="py-3 px-4 text-center">Estado Informe</th>
                              <th className="py-3 px-4 text-center">Nota Sugerida</th>
                              <th className="py-3 px-4">Concepto y Rúbricas</th>
                              <th className="py-3 px-4">Observaciones Clínicas</th>
                              <th className="py-3 px-4 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                            {students.map((st) => {
                              const horasAsignadas = st.horas_asignadas || pr.horas_totales || 120;
                              const horasCumplidas = st.horas_cumplidas || 0;
                              const pct = Math.min(
                                100,
                                Math.round((horasCumplidas / (horasAsignadas || 1)) * 100)
                              );
                              const hasReport = !!st.report_id;

                              return (
                                <tr
                                  key={st.cedula}
                                  className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition"
                                >
                                  {/* Datos del estudiante: Avatar y nombre */}
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="cursor-pointer"
                                        onClick={() =>
                                          setSelectedStudentForFicha({
                                            ...st,
                                            practica_titulo: pr.titulo,
                                            institucion_nombre: pr.institucion_nombre,
                                            servicio_nombre: pr.servicio_nombre,
                                            docente_nombre: pr.docente_nombre,
                                            horas_totales: horasAsignadas,
                                          })
                                        }
                                        title={`Ver ficha completa de ${st.nombre_completo || st.nombre}`}
                                      >
                                        <StudentAvatar
                                          cedula={st.cedula}
                                          name={st.nombre_completo || st.nombre}
                                          size="md"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <div
                                          className="font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition truncate"
                                          onClick={() =>
                                            setSelectedStudentForFicha({
                                              ...st,
                                              practica_titulo: pr.titulo,
                                              institucion_nombre: pr.institucion_nombre,
                                              servicio_nombre: pr.servicio_nombre,
                                              docente_nombre: pr.docente_nombre,
                                              horas_totales: horasAsignadas,
                                            })
                                          }
                                        >
                                          {st.nombre_completo || st.nombre}
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                                          <span>C.C. {st.cedula}</span>
                                          {st.codigo && (
                                            <>
                                              <span>·</span>
                                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                Cód. {st.codigo}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Horas cumplidas y barra */}
                                  <td className="py-3.5 px-4 min-w-[140px]">
                                    <div className="flex items-center justify-between text-[11px] mb-1">
                                      <span className="font-bold text-gray-900 dark:text-white">
                                        {horasCumplidas}h / {horasAsignadas}h
                                      </span>
                                      <span className="text-gray-500">{pct}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full transition-all duration-300 rounded-full ${
                                          pct >= 100
                                            ? "bg-emerald-500"
                                            : pct >= 50
                                            ? "bg-amber-500"
                                            : "bg-blue-500"
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </td>

                                  {/* Estado del Informe */}
                                  <td className="py-3.5 px-4 text-center">
                                    {hasReport ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Emitido</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                        <Clock className="w-3 h-3" />
                                        <span>Pendiente</span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Nota Sugerida */}
                                  <td className="py-3.5 px-4 text-center">
                                    {hasReport && st.nota_sugerida !== null ? (
                                      <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                        {Number(st.nota_sugerida).toFixed(1)} / 5.0
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 italic text-[11px]">-</span>
                                    )}
                                  </td>

                                  {/* Concepto y mini rúbricas */}
                                  <td className="py-3.5 px-4">
                                    {hasReport ? (
                                      <div>
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border mb-1 ${getConceptBadge(
                                            st.concepto
                                          )}`}
                                        >
                                          {st.concepto || "Evaluado"}
                                        </span>
                                        <div className="flex gap-1 text-[10px] font-semibold text-gray-500 dark:text-zinc-400">
                                          <span title="Conocimiento Teórico">
                                            T:{st.conocimiento_teorico || "-"}
                                          </span>
                                          <span>·</span>
                                          <span title="Habilidades Prácticas">
                                            P:{st.habilidades_practicas || "-"}
                                          </span>
                                          <span>·</span>
                                          <span title="Actitud y Ética">
                                            E:{st.actitud_etica || "-"}
                                          </span>
                                          <span>·</span>
                                          <span title="Comunicación en Equipo">
                                            C:{st.comunicacion_equipo || "-"}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-gray-400 italic">
                                        Sin rúbrica emitida
                                      </span>
                                    )}
                                  </td>

                                  {/* Observaciones */}
                                  <td className="py-3.5 px-4 max-w-xs">
                                    {hasReport && st.observaciones ? (
                                      <p className="text-[11px] text-gray-600 dark:text-zinc-300 line-clamp-2">
                                        {st.observaciones}
                                      </p>
                                    ) : (
                                      <span className="text-[11px] text-gray-400 italic">
                                        Pendiente de observaciones clínicas
                                      </span>
                                    )}
                                  </td>

                                  {/* Acción */}
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedStudentForFicha({
                                            ...st,
                                            practica_titulo: pr.titulo,
                                            institucion_nombre: pr.institucion_nombre,
                                            servicio_nombre: pr.servicio_nombre,
                                            docente_nombre: pr.docente_nombre,
                                            horas_totales: horasAsignadas,
                                          })
                                        }
                                        className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 transition cursor-pointer"
                                        title="Ver Ficha Integral"
                                      >
                                        Ficha
                                      </button>
                                      <button
                                        onClick={() =>
                                          setReportModal({
                                            isOpen: true,
                                            student: st,
                                            practice: pr,
                                          })
                                        }
                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-sm ${
                                          hasReport
                                            ? "bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 border border-gray-300 dark:border-zinc-700"
                                            : "bg-amber-500 hover:bg-amber-600 text-gray-900 shadow-amber-500/20"
                                        }`}
                                      >
                                        {hasReport ? "Editar Informe" : "Emitir Informe"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Modal de Emisión de Reporte Clínico ─── */}
      <ClinicalReportModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ isOpen: false, student: null, practice: null })}
        student={reportModal.student}
        practice={reportModal.practice}
        onSuccess={() => {
          fetchData();
        }}
      />

      {/* Modal Ficha Integral del Estudiante */}
      <StudentFichaModal
        isOpen={!!selectedStudentForFicha}
        onClose={() => setSelectedStudentForFicha(null)}
        student={selectedStudentForFicha}
        role="auditor"
      />
    </div>
  );
};

export default AuditorReports;