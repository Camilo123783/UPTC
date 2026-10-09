// ============================================================
// AuditorUserViewer.js — Directorio de Prácticas y Usuarios Vinculados
// El auditor visualiza exclusivamente sus prácticas asignadas, el docente
// tutor a cargo y los estudiantes vinculados a cada rotación con buscador.
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BACKEND_URL } from "../../config/api";
import { useDataSync } from "../../utils/dataSync";
import {
  Building,
  GraduationCap,
  Users,
  Search,
  User,
  UserCheck,
  Mail,
  CreditCard,
  Hash,
  Clock,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  ClipboardList,
  Globe,
  Building2,
  FileSpreadsheet,
  Download,
  FileText,
} from "lucide-react";
import StudentAvatar from "../Shared/StudentAvatar";
import StudentFichaModal from "../Shared/StudentFichaModal";
import { generateCsv } from "../../utils/reportGenerator";
import toast from "../../utils/toast";

const API_BASE_URL = BACKEND_URL;

const AuditorUserViewer = () => {
  const [practices, setPractices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPracticeId, setSelectedPracticeId] = useState("all");

  // Estado para colapsar/expandir prácticas (por defecto todas abiertas)
  const [collapsedPractices, setCollapsedPractices] = useState({});

  // Modal para ver ficha completa e integral de un estudiante
  const [selectedStudentForFicha, setSelectedStudentForFicha] = useState(null);

  // Datos del auditor actual desde la sesión
  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("userData") || sessionStorage.getItem("userData");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchPracticesAndUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const token =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${API_BASE_URL}/api/auditor/practices`, { headers });
      if (!res.ok) {
        throw new Error("No se pudieron cargar las prácticas asignadas al auditor.");
      }
      const data = await res.json();
      setPractices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar prácticas y vinculados:", err);
      setError("Error de conexión al cargar las prácticas y los usuarios vinculados.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPracticesAndUsers();
  }, [fetchPracticesAndUsers]);

  useDataSync(fetchPracticesAndUsers);

  const toggleCollapse = (practiceId) => {
    setCollapsedPractices((prev) => ({
      ...prev,
      [practiceId]: !prev[practiceId],
    }));
  };

  // Exportar estudiantes y metadatos asociados de una práctica a CSV
  const handleDownloadPracticeCsv = (practice) => {
    if (!practice) return;
    const students = practice.estudiantes || [];
    if (students.length === 0) {
      toast.warn(`La práctica "${practice.titulo || practice.id}" no tiene estudiantes vinculados para exportar.`);
      return;
    }

    const exportRows = students.map((st, idx) => {
      const horasAsignadas = st.horas_asignadas || practice.horas_totales || 120;
      const horasCumplidas = st.horas_cumplidas || 0;
      const pct = Math.min(100, Math.round((horasCumplidas / (horasAsignadas || 1)) * 100));

      return {
        "N°": idx + 1,
        "Práctica ID": practice.id,
        "Práctica Título": practice.titulo || "Práctica Formativa",
        "Periodo": practice.periodo || "N/A",
        "Institución / Sede": practice.institucion_nombre || "Hospital Universitario",
        "Servicio Clínico": practice.servicio_nombre || "N/A",
        "Programa": practice.programa_nombre || "Medicina",
        "Asignatura": practice.asignatura_nombre || "Práctica Clínica",
        "Docente a Cargo": practice.docente_nombre || "N/A",
        "Docente Cédula": practice.docente_cedula || "N/A",
        "Docente Correo": practice.docente_correo || "N/A",
        "Auditor a Cargo": practice.auditor_nombre || "Sin auditor",
        "Estudiante Nombre": st.nombre_completo || st.nombre || `Estudiante #${st.cedula}`,
        "Estudiante Cédula": st.cedula || "N/A",
        "Código Estudiantil": st.codigo || "N/A",
        "Correo Institucional": st.correo || "N/A",
        "Teléfono": st.telefono || "N/A",
        "Programa / Carrera": st.carrera || practice.programa_nombre || "Medicina",
        "Horas Cumplidas": horasCumplidas,
        "Horas Asignadas / Meta": horasAsignadas,
        "Porcentaje Avance": `${pct}%`,
        "Estado": st.estado || "Asignado",
        "Calificación": st.calificacion !== null && st.calificacion !== undefined ? st.calificacion : "Sin calificar",
        "Estado Evaluación": st.estado_evaluacion || (st.calificacion !== null ? "Completada" : "Pendiente"),
        "Documentos Soportes": st.docs_count !== undefined ? `${st.docs_count}/6 cargados` : "Verificar soportes",
        "Informe Clínico": st.report_id ? (st.report_titulo || "Registrado") : "Pendiente",
      };
    });

    const safeTitle = (practice.titulo || "Practica").replace(/[^a-zA-Z0-9_-]/g, "_");
    generateCsv(exportRows, `Estudiantes_${safeTitle}_${practice.periodo || "2026"}.csv`);
    toast.success(`CSV descargado exitosamente con ${exportRows.length} estudiantes vinculados.`);
  };

  // Filtrado reactivo por buscador
  const filteredPractices = useMemo(() => {
    return practices
      .filter((pr) => {
        if (selectedPracticeId !== "all" && String(pr.id) !== String(selectedPracticeId)) {
          return false;
        }
        return true;
      })
      .map((pr) => {
        if (!searchTerm.trim()) {
          return { ...pr, displayStudents: pr.estudiantes || [] };
        }

        const query = searchTerm.toLowerCase();
        const matchTitle = (pr.titulo || "").toLowerCase().includes(query);
        const matchInst = (pr.institucion_nombre || "").toLowerCase().includes(query);
        const matchServ = (pr.servicio_nombre || "").toLowerCase().includes(query);
        const matchDoc = (pr.docente_nombre || "").toLowerCase().includes(query);
        const matchDocCed = String(pr.docente_cedula || "").includes(query);
        const matchDocEmail = (pr.docente_correo || "").toLowerCase().includes(query);

        // Si la práctica o docente coincide, mostrar todos sus estudiantes
        if (matchTitle || matchInst || matchServ || matchDoc || matchDocCed || matchDocEmail) {
          return { ...pr, displayStudents: pr.estudiantes || [] };
        }

        // Si no, filtrar estudiantes que coincidan
        const matchingStudents = (pr.estudiantes || []).filter((st) => {
          const matchName = (st.nombre_completo || st.nombre || "").toLowerCase().includes(query);
          const matchCed = String(st.cedula || "").includes(query);
          const matchCod = st.codigo && String(st.codigo).toLowerCase().includes(query);
          const matchEmail = (st.correo || "").toLowerCase().includes(query);
          const matchCarrera = (st.carrera || "").toLowerCase().includes(query);
          return matchName || matchCed || matchCod || matchEmail || matchCarrera;
        });

        return { ...pr, displayStudents: matchingStudents };
      })
      .filter((pr) => pr.displayStudents && pr.displayStudents.length > 0 || !searchTerm.trim());
  }, [practices, selectedPracticeId, searchTerm]);

  // Contadores de usuarios vinculados a las prácticas del auditor
  const summaryCounts = useMemo(() => {
    const studentCedulas = new Set();
    const docentCedulas = new Set();

    practices.forEach((pr) => {
      if (pr.docente_cedula) docentCedulas.add(pr.docente_cedula);
      (pr.estudiantes || []).forEach((st) => {
        if (st.cedula) studentCedulas.add(st.cedula);
      });
    });

    return {
      practicesCount: practices.length,
      docentsCount: docentCedulas.size,
      studentsCount: studentCedulas.size,
    };
  }, [practices]);

  return (
    <div className="space-y-6">
      {/* ─── Encabezado ─── */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Prácticas y Usuarios Vinculados
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Consulta de las rotaciones hospitalarias a tu cargo, el docente asignado y los estudiantes vinculados a cada servicio.
            </p>
          </div>

          <button
            onClick={fetchPracticesAndUsers}
            className="self-start sm:self-auto px-3.5 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* ─── Tarjetas de Resumen (Solo tus prácticas y vinculados) ─── */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Prácticas Asignadas
            </span>
            <p className="text-3xl font-black text-blue-950 dark:text-blue-100 mt-1">
              {summaryCounts.practicesCount}
            </p>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
              Rotaciones bajo tu auditoría
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Docentes Tutores Vinculados
            </span>
            <p className="text-3xl font-black text-purple-950 dark:text-purple-100 mt-1">
              {summaryCounts.docentsCount}
            </p>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
              A cargo de tus prácticas
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Estudiantes en Turno
            </span>
            <p className="text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
              {summaryCounts.studentsCount}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              Supervisados en tus servicios
            </p>
          </div>
        </div>

        {/* ─── Buscador Ágil ─── */}
        <div className="mt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por práctica, hospital, docente, estudiante o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <select
            value={selectedPracticeId}
            onChange={(e) => setSelectedPracticeId(e.target.value)}
            className="px-4 py-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Todas tus prácticas ({practices.length})</option>
            {practices.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.titulo} ({pr.institucion_nombre || "Hospital"})
              </option>
            ))}
          </select>
        </div>

        {/* ─── 1. Selector Previo de Prácticas Formativas ─── */}
        {!isLoading && practices.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-zinc-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-purple-600 dark:text-purple-400" /> 1. Seleccione la Práctica Formativa</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    {practices.length} {practices.length === 1 ? "práctica" : "prácticas"}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  Elige una práctica para consultar de forma rápida y filtrada a sus docentes tutores y estudiantes asignados.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPracticeId("all")}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    selectedPracticeId === "all"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700"
                  }`}
                  title="Ver todas las prácticas sin filtrar"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Ver Todas ({practices.length})</span>
                </button>
              </div>
            </div>

            {/* Grid interactivo de tarjetas de práctica */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {practices.map((pr) => {
                const isSelected = String(selectedPracticeId) === String(pr.id);
                const studentsTotal = (pr.estudiantes || []).length;

                return (
                  <div
                    key={pr.id}
                    onClick={() => setSelectedPracticeId(isSelected ? "all" : String(pr.id))}
                    className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-purple-50/60 dark:bg-purple-950/25 border-purple-500 dark:border-purple-500 ring-2 ring-purple-500/30 shadow-lg scale-[1.01]"
                        : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-700/60 hover:shadow-md"
                    }`}
                  >
                    <div>
                      {/* Insignias superiores de estado y periodo */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                            {pr.estado || "Activa"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            Periodo {pr.periodo || "2026-1"}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Seleccionada</span>
                          </span>
                        )}
                      </div>

                      {/* Título de la práctica */}
                      <h4 className="text-base font-black text-gray-900 dark:text-white line-clamp-1 mb-2">
                        {pr.titulo}
                      </h4>

                      {/* Detalles hospitalarios */}
                      <div className="space-y-1.5 text-xs text-gray-600 dark:text-zinc-400">
                        <div className="flex items-center gap-2 truncate">
                          <Building className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span className="font-semibold text-gray-800 dark:text-zinc-200 truncate">
                            {pr.institucion_nombre || "Hospital Universitario"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{pr.servicio_nombre || "Servicio Clínico"}</span>
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">
                            <strong>Docente:</strong> {pr.docente_nombre || "Sin docente asignado"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer con conteo y botón */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>{studentsTotal} estudiante{studentsTotal === 1 ? "" : "s"}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPracticeCsv(pr);
                          }}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                          title={`Descargar CSV con información de estudiantes vinculados`}
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPracticeId(isSelected ? "all" : String(pr.id));
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                              : "bg-gray-100 hover:bg-purple-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-purple-600 text-gray-700 dark:text-zinc-300"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Seleccionada</span>
                            </>
                          ) : (
                            <>
                              <ClipboardList className="w-3.5 h-3.5" />
                              <span>Seleccionar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Botón directo expandido de descarga cuando la práctica está seleccionada */}
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPracticeCsv(pr);
                        }}
                        className="mt-3 w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                        title={`Descargar archivo CSV con los ${studentsTotal} estudiantes vinculados`}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Descargar CSV de Estudiantes ({studentsTotal})</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── 2. Detalle y Usuarios Vinculados de la Práctica ─── */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-zinc-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-purple-600 dark:text-purple-400" /> 2. Usuarios Vinculados</span>
              {selectedPracticeId !== "all" ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  Práctica Filtrada
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                  Todas las Prácticas
                </span>
              )}
            </h3>

            <div className="flex items-center gap-3 flex-wrap">
              {selectedPracticeId !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    const activePr = practices.find((p) => String(p.id) === String(selectedPracticeId));
                    if (activePr) handleDownloadPracticeCsv(activePr);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                  title="Descargar lista de estudiantes vinculados en formato CSV"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Descargar CSV de la Práctica</span>
                </button>
              )}

              {selectedPracticeId !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedPracticeId("all")}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>←</span>
                  <span>Ver todas las prácticas</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-16 text-xs text-gray-500 animate-pulse">
              Cargando tus prácticas asignadas y usuarios vinculados...
            </div>
          ) : filteredPractices.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-dashed border-gray-200 dark:border-zinc-800">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                No se encontraron prácticas o usuarios con los criterios de búsqueda.
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Verifica el texto ingresado en el buscador.
              </p>
            </div>
          ) : (
            filteredPractices.map((pr) => {
              const isCollapsed = !!collapsedPractices[pr.id];
              const students = pr.displayStudents || [];

              return (
                <div
                  key={pr.id}
                  className="rounded-3xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md overflow-hidden transition"
                >
                  {/* Encabezado de la Práctica */}
                  <div
                    onClick={() => toggleCollapse(pr.id)}
                    className="p-5 sm:p-6 bg-gray-50/80 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-100/70 dark:hover:bg-zinc-800/90 transition select-none"
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                          {pr.estado || "Activa"}
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                          Periodo {pr.periodo || "2026-1"}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400">
                          Horas requeridas: {pr.horas_totales || 120}h
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-gray-900 dark:text-white">
                        {pr.titulo || `Práctica Formativa #${pr.id}`}
                      </h3>

                      <p className="text-xs text-gray-600 dark:text-zinc-400 flex items-center gap-1.5 mt-1.5">
                        <Building className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-semibold text-gray-800 dark:text-zinc-200">
                          {pr.institucion_nombre || "Hospital Universitario"}
                        </span>
                        {pr.servicio_nombre && <span> · {pr.servicio_nombre}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPracticeCsv(pr);
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title={`Descargar CSV con información de estudiantes de "${pr.titulo}"`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Descargar CSV</span>
                      </button>

                      <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
                        {students.length} Estudiante{students.length === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        className="p-2 rounded-xl bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700"
                        title={isCollapsed ? "Ver usuarios vinculados" : "Contraer"}
                      >
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Detalle Desplegable: Docente y Estudiantes Vinculados */}
                  {!isCollapsed && (
                    <div className="p-5 sm:p-6 space-y-6">
                      {/* Ficha del Docente a Cargo */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-purple-500" />
                          <span>Docente a Cargo</span>
                        </h4>

                        <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/25 border border-purple-200 dark:border-purple-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 flex items-center justify-center font-black text-sm">
                              {pr.docente_nombre ? pr.docente_nombre.charAt(0) : "D"}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900 dark:text-white">
                                {pr.docente_nombre || "Docente no asignado"}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-600 dark:text-zinc-400 mt-0.5">
                                {pr.docente_cedula && <span>C.C. {pr.docente_cedula}</span>}
                                {pr.docente_correo && (
                                  <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-medium">
                                    <Mail className="w-3 h-3" />
                                    <span>{pr.docente_correo}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="self-start sm:self-auto px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700">
                            Docente UPTC
                          </span>
                        </div>
                      </div>

                      {/* Lista de Estudiantes Vinculados a la Práctica */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-blue-500" />
                            <span>Estudiantes Matriculados ({students.length})</span>
                          </h4>
                        </div>

                        {students.length === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-500 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-dashed border-gray-200 dark:border-zinc-800">
                            No hay estudiantes vinculados a esta práctica bajo el filtro de búsqueda.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-zinc-800">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-gray-50/90 dark:bg-zinc-800/70 border-b border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="py-3 px-4">Estudiante</th>
                                  <th className="py-3 px-4">Identificación</th>
                                  <th className="py-3 px-4 text-center">Estado</th>
                                  <th className="py-3 px-4">Correo Institucional</th>
                                  <th className="py-3 px-4">Programa / Carrera</th>
                                  <th className="py-3 px-4">Horas Cumplidas</th>
                                  <th className="py-3 px-4 text-center">Informe Clínico</th>
                                  <th className="py-3 px-4 text-center">Documentos / Ficha</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900">
                                {students.map((st) => {
                                  const horasAsignadas = st.horas_asignadas || pr.horas_totales || 120;
                                  const horasCumplidas = st.horas_cumplidas || 0;
                                  const pct = Math.min(100, Math.round((horasCumplidas / (horasAsignadas || 1)) * 100));
                                  const hasReport = !!st.report_id;
                                  const isActivo =
                                    (st.estado || st.estado_asignacion || "").toLowerCase() === "activo" ||
                                    (st.estado || st.estado_asignacion || "").toLowerCase() === "activa";

                                  const studentForFicha = {
                                    ...st,
                                    practica_titulo: pr.titulo,
                                    institucion_nombre: pr.institucion_nombre,
                                    servicio_nombre: pr.servicio_nombre,
                                    docente_nombre: pr.docente_nombre,
                                    auditor_nombre: currentUser?.nombre_completo || currentUser?.nombre || "Auditor Clínico",
                                    horas_totales: horasAsignadas,
                                  };

                                  return (
                                    <tr
                                      key={st.cedula}
                                      className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition"
                                    >
                                      {/* Estudiante: Foto real o letra inicial con fallback */}
                                      <td className="py-3.5 px-4 whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedStudentForFicha(studentForFicha)}
                                          className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
                                          title={`Ver ficha completa de ${st.nombre_completo || st.nombre}`}
                                        >
                                          <StudentAvatar
                                            cedula={st.cedula}
                                            name={st.nombre_completo || st.nombre}
                                            size="sm"
                                            hasPhoto={st.tiene_foto}
                                            className="group-hover:scale-105 transition-transform"
                                          />
                                          <div>
                                            <p className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                              {st.nombre_completo || st.nombre}
                                            </p>
                                          </div>
                                        </button>
                                      </td>

                                      {/* Cédula y Código */}
                                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-700 dark:text-zinc-300">
                                        <div>C.C. {st.cedula}</div>
                                        {st.codigo && (
                                          <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                            Cód. {st.codigo}
                                          </div>
                                        )}
                                      </td>

                                      {/* Estado Estudiante (Activo / Pendiente) */}
                                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                        {isActivo ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                            <span>Activo</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                            <span>Pendiente</span>
                                          </span>
                                        )}
                                      </td>

                                      {/* Correo */}
                                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-600 dark:text-zinc-300">
                                        {st.correo || "No registrado"}
                                      </td>

                                      {/* Carrera */}
                                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-700 dark:text-zinc-300">
                                        <span className="font-medium">{st.carrera || "Facultad de Salud"}</span>
                                      </td>

                                      {/* Horas */}
                                      <td className="py-3.5 px-4 min-w-[130px]">
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

                                      {/* Estado Informe */}
                                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                        {hasReport ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>
                                              {st.nota_sugerida !== null ? `${Number(st.nota_sugerida).toFixed(1)} - ` : ""}
                                              {st.concepto || "Emitido"}
                                            </span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                            <Clock className="w-3 h-3" />
                                            <span>Pendiente</span>
                                          </span>
                                        )}
                                      </td>

                                      {/* Ver Documentos y Ficha Integral */}
                                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedStudentForFicha(studentForFicha)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition cursor-pointer shadow-sm"
                                          title={`Ver documentos oficiales (${st.docs_count !== undefined ? st.docs_count : 0}/6) y ficha integral de ${st.nombre_completo || st.nombre}`}
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>Documentos ({st.docs_count !== undefined ? st.docs_count : (st.has_cv ? "Cargados" : "0")}/6)</span>
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
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>

    {/* Modal Ficha Integral del Estudiante para el Auditor */}
    <StudentFichaModal
      isOpen={!!selectedStudentForFicha}
      onClose={() => setSelectedStudentForFicha(null)}
      student={selectedStudentForFicha}
      role="auditor"
    />
  </div>
);
};

export default AuditorUserViewer;