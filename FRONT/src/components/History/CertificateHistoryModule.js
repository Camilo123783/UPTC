// ============================================================
// FRONT/src/components/History/CertificateHistoryModule.js
// Módulo de Historial de Certificados UPTC
// - Estudiantes: Visualización de certificados asociados (vigencia máx 1 año)
// - Administradores: Archivo maestro permanente con buscador avanzado
// - Identificador hexadecimal único en cada certificado y descarga directa en PDF
// ============================================================
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Award,
  Search,
  Download,
  Eye,
  Calendar,
  Building2,
  UserCheck,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Filter,
  X,
  ShieldCheck,
  Printer,
  Sparkles,
  Info,
  Archive,
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { useAuth } from "../../utils/useAuth";
import { useTheme } from "../../context/ThemeContext";
import toast from "../../utils/toast";
import { generateProfessionalCertificate } from "../../utils/certificateGenerator";
import { generateConstanciaPracticaVigente } from "../../utils/reportGenerator";

const API_BASE_URL = BACKEND_URL;

const CertificateHistoryModule = ({ userRole: propRole }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const userRole = useMemo(() => {
    if (propRole) return propRole.toLowerCase();
    const stored =
      localStorage.getItem("userRole") ||
      sessionStorage.getItem("userRole") ||
      user?.role ||
      user?.rol ||
      "admin";
    return String(stored).toLowerCase();
  }, [propRole, user]);

  if (userRole === "superadmin") {
    return (
      <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Acceso No Autorizado</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          El rol Superadministrador no tiene acceso al módulo de historial de certificados.
        </p>
      </div>
    );
  }

  const [certificates, setCertificates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "vigente" | "expirado"
  const [copiedHex, setCopiedHex] = useState(null);

  // Modal de Detalle
  const [selectedCert, setSelectedCert] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Configuración institucional para render de PDFs
  const [instSettings, setInstSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("institutionSettings")) || {};
    } catch (e) {
      return {};
    }
  });

  const fetchCertificates = useCallback(async () => {
    setIsLoading(true);
    try {
      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append("q", searchTerm.trim());
      if (programFilter !== "all") params.append("programa", programFilter);
      if (periodFilter !== "all") params.append("periodo", periodFilter);
      if (typeFilter !== "all") params.append("tipo", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const url = `${API_BASE_URL}/api/history/certificates/list?${params.toString()}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: No se pudo cargar el historial de certificados.`);
      }

      const json = await res.json();
      setCertificates(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error("Error al obtener certificados:", err);
      toast.error(err.message || "No se pudo sincronizar el historial de certificados.");
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, programFilter, periodFilter, typeFilter, statusFilter]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  // Copiar código hexadecimal
  const handleCopyHex = (hex, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(`#${hex}`);
    setCopiedHex(hex);
    toast.success(`Identificador #${hex} copiado al portapapeles`);
    setTimeout(() => setCopiedHex(null), 2500);
  };

  // Descargar PDF oficial
  const handleDownloadPDF = (cert, e) => {
    if (e) e.stopPropagation();

    const isConstancia =
      cert.categoria_solicitud === "constancia" ||
      (cert.tipo_certificado && cert.tipo_certificado.toLowerCase().includes("constancia")) ||
      (cert.tipo_certificado && cert.tipo_certificado.toLowerCase().includes("vigente"));

    try {
      if (isConstancia) {
        generateConstanciaPracticaVigente({
          studentName: cert.estudiante_nombre,
          studentCedula: cert.estudiante_cedula,
          studentCareer: cert.programa_nombre || "Medicina",
          practiceProgram: cert.programa_nombre || "Medicina",
          practiceName: cert.practica_titulo || "Práctica Formativa",
          serviceName: cert.servicio_nombre || "",
          institutionName: cert.institucion_nombre || "Hospital Universitario San Rafael de Tunja",
          docentName: cert.docente_nombre || "Docente Tutor UPTC",
          period: cert.periodo || "2026-1",
          startDate: cert.fecha_inicio || "",
          endDate: cert.fecha_fin || "",
          totalHours: cert.horas_totales || 120,
          accumulatedHours: cert.horas_totales || 120,
          issueDate: cert.fecha_emision ? cert.fecha_emision.substring(0, 10) : "",
          id_hex: cert.id_hex,
          institutionSettings: instSettings,
        });
      } else {
        generateProfessionalCertificate({
          studentName: cert.estudiante_nombre,
          cedula: cert.estudiante_cedula,
          career: cert.programa_nombre || "Medicina",
          practiceName: cert.practica_titulo || "Práctica Formativa",
          serviceName: cert.servicio_nombre || "",
          institution: cert.institucion_nombre || "Hospital Universitario San Rafael de Tunja",
          docentName: cert.docente_nombre || "Docente Tutor UPTC",
          hours: cert.horas_totales || 120,
          period: cert.periodo || "2026-1",
          startDate: cert.fecha_inicio || "",
          endDate: cert.fecha_fin || "",
          grade: cert.calificacion,
          date: cert.fecha_emision ? cert.fecha_emision.substring(0, 10) : "",
          id_hex: cert.id_hex,
          institutionSettings: instSettings,
        });
      }
      toast.success(`Certificado #${cert.id_hex} descargado en formato PDF.`);
    } catch (err) {
      console.error("Error al generar PDF:", err);
      toast.error("Ocurrió un error al descargar el PDF del certificado.");
    }
  };

  // Programas y periodos disponibles para filtros
  const availablePrograms = useMemo(() => {
    const set = new Set();
    certificates.forEach((c) => {
      if (c.programa_nombre) set.add(c.programa_nombre);
    });
    return Array.from(set);
  }, [certificates]);

  const availablePeriods = useMemo(() => {
    const set = new Set();
    certificates.forEach((c) => {
      if (c.periodo) set.add(c.periodo);
    });
    return Array.from(set);
  }, [certificates]);

  // Métricas
  const metrics = useMemo(() => {
    const total = certificates.length;
    const uniqueStudents = new Set(certificates.map((c) => c.estudiante_cedula)).size;
    const totalHours = certificates.reduce((acc, c) => acc + (Number(c.horas_totales) || 0), 0);
    const passingGrades = certificates.filter((c) => Number(c.calificacion) >= 3.0).length;
    return {
      total,
      uniqueStudents,
      totalHours,
      passingGrades,
    };
  }, [certificates]);

  const formatDateReadable = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return String(dateStr);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto">
      {/* ── Encabezado Principal ── */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border shadow-sm transition-all ${
          isDark
            ? "bg-zinc-900/80 border-zinc-800 text-white"
            : "bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-white border-blue-200/60 text-zinc-900"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Historial de Certificados
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400">
                  {userRole === "admin" || userRole === "superadmin"
                    ? "Archivo histórico permanente de todos los certificados oficiales y constancias emitidas en la institución."
                    : "Expediente digital de tus certificados y constancias oficiales avaladas en tus prácticas formativas."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchCertificates}
              disabled={isLoading}
              className={`p-2.5 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                isDark
                  ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200"
                  : "bg-white border-gray-300 hover:bg-gray-100 text-gray-700 shadow-sm"
              }`}
              title="Refrescar listado"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Métricas Resumen ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-gray-200/60 dark:border-zinc-800/80">
          <div
            className={`p-4 rounded-2xl border ${
              isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-gray-200/70"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 block mb-1">
              Total Certificados
            </span>
            <div className="text-2xl font-black">{metrics.total}</div>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isDark ? "bg-blue-950/20 border-blue-900/40" : "bg-blue-50/70 border-blue-200/80"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              {userRole === "student" ? "Prácticas Aprobadas" : "Estudiantes"}
            </span>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {userRole === "student" ? metrics.passingGrades : metrics.uniqueStudents}
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isDark ? "bg-emerald-950/20 border-emerald-900/40" : "bg-emerald-50/70 border-emerald-200/80"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Horas Certificadas
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.totalHours} hrs
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              isDark ? "bg-amber-950/20 border-amber-900/40" : "bg-amber-50/70 border-amber-200/80"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1 flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5" />
              {userRole === "student" ? "Vigencia en Perfil" : "Permanencia"}
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 truncate">
              {userRole === "student" ? "1 Año (Descargar)" : "Permanente"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Banner de Recomendación para el Estudiante ── */}
      {userRole === "student" && (
        <div className="p-4 sm:p-5 rounded-3xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start gap-3.5 shadow-sm animate-fadeIn">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
            <h4 className="font-extrabold text-amber-800 dark:text-amber-300">
              Recomendación importante para el estudiante
            </h4>
            <p>
              Te recomendamos <strong>descargar tus certificados en formato PDF</strong> y guardarlos en tu computador o dispositivo personal. Por políticas institucionales de almacenamiento, tus certificados y constancias permanecerán disponibles para consulta y descarga en tu perfil durante un período máximo de <strong>un (1) año</strong> a partir de su fecha de emisión.
            </p>
          </div>
        </div>
      )}

      {/* ── Buscador y Filtros Avanzados (Especialmente para Administrador) ── */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border shadow-sm space-y-4 ${
          isDark ? "bg-zinc-900/70 border-zinc-800" : "bg-white border-gray-200/80"
        }`}
      >
        <div className="flex flex-col md:flex-row gap-3">
          {/* Input Buscador */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por identificador hexadecimal (#A84B...), cédula, estudiante, práctica, tutor..."
              className={`w-full pl-11 pr-10 py-3 rounded-xl border text-sm outline-none transition font-medium ${
                isDark
                  ? "bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
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

          {/* Filtro por Programa Académico */}
          {availablePrograms.length > 0 && (
            <div className="w-full md:w-52 shrink-0">
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className={`w-full py-3 px-3.5 rounded-xl border text-sm outline-none transition font-medium ${
                  isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-gray-50 border-gray-300 text-gray-900 focus:bg-white"
                }`}
              >
                <option value="all">Todos los Programas</option>
                {availablePrograms.map((prg) => (
                  <option key={prg} value={prg}>
                    {prg}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro por Periodo */}
          {availablePeriods.length > 0 && (
            <div className="w-full md:w-44 shrink-0">
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className={`w-full py-3 px-3.5 rounded-xl border text-sm outline-none transition font-medium ${
                  isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-gray-50 border-gray-300 text-gray-900 focus:bg-white"
                }`}
              >
                <option value="all">Todos los Periodos</option>
                {availablePeriods.map((p) => (
                  <option key={p} value={p}>
                    Periodo {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Pestañas de Filtro Rápido */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                typeFilter === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
              }`}
            >
              Todos los Documentos ({certificates.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("certificado")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                typeFilter === "certificado"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
              }`}
            >
              Certificados Oficiales
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("constancia")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                typeFilter === "constancia"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
              }`}
            >
              Constancias de Práctica
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
            Mostrando <span className="font-bold text-gray-900 dark:text-white">{certificates.length}</span> certificados en historial
          </div>
        </div>
      </div>

      {/* ── Listado de Tarjetas de Certificados ── */}
      {isLoading ? (
        <div className="p-16 text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">
            Cargando historial de certificados...
          </p>
        </div>
      ) : certificates.length === 0 ? (
        <div
          className={`p-12 sm:p-16 text-center rounded-3xl border ${
            isDark ? "bg-zinc-900/40 border-zinc-800 text-zinc-400" : "bg-white border-gray-200 text-gray-500"
          }`}
        >
          <Award className="w-14 h-14 mx-auto text-gray-400/80 mb-3" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            No se encontraron certificados en el historial
          </h3>
          <p className="text-xs sm:text-sm max-w-md mx-auto">
            {searchTerm || programFilter !== "all" || periodFilter !== "all" || typeFilter !== "all"
              ? "Prueba modificando los criterios de búsqueda o limpiando los filtros actuales."
              : userRole === "student"
              ? "Tus certificados aparecerán aquí una vez que hayan sido avalados por tus docentes o emitidos oficialmente."
              : "Los certificados y constancias emitidos en la institución se archivarán automáticamente aquí para siempre."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {certificates.map((cert) => {
            const isConstancia =
              cert.categoria_solicitud === "constancia" ||
              (cert.tipo_certificado && cert.tipo_certificado.toLowerCase().includes("constancia"));
            const remainingDays = cert.dias_restantes !== undefined ? Number(cert.dias_restantes) : null;
            const isNearExpiry = remainingDays !== null && remainingDays <= 60 && remainingDays > 0;

            return (
              <div
                key={cert.id}
                onClick={() => {
                  setSelectedCert(cert);
                  setIsModalOpen(true);
                }}
                className={`p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:-translate-y-1 shadow-sm hover:shadow-xl ${
                  isDark
                    ? "bg-zinc-950/80 border-zinc-800 hover:border-blue-500/50"
                    : "bg-white border-gray-200/90 hover:border-blue-400/80"
                }`}
              >
                <div>
                  {/* Cabecera de la tarjeta: Identificador Hexadecimal y Badge de Tipo */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Código Hexadecimal con Copia Rápida */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyHex(cert.id_hex, e)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold bg-gray-100 hover:bg-gray-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 transition"
                        title="Clic para copiar código hexadecimal"
                      >
                        <span>#{cert.id_hex}</span>
                        {copiedHex === cert.id_hex ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-zinc-200" />
                        )}
                      </button>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          isConstancia
                            ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800"
                            : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800"
                        }`}
                      >
                        {isConstancia ? "Constancia" : "Certificado Oficial"}
                      </span>
                    </div>

                    {cert.periodo && (
                      <span className="text-[11px] font-bold text-gray-400 font-mono">
                        {cert.periodo}
                      </span>
                    )}
                  </div>

                  {/* Título del documento */}
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white leading-snug mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {cert.tipo_certificado}
                  </h3>

                  {/* Práctica asociada */}
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3 truncate">
                    {cert.practica_titulo}
                  </p>

                  {/* Metadatos */}
                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-zinc-400 mb-4">
                    {/* Estudiante (relevante para Admin) */}
                    {(userRole === "admin" || userRole === "superadmin") && (
                      <div className="flex items-center gap-2 truncate">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span className="truncate font-bold text-gray-800 dark:text-zinc-200">
                          {cert.estudiante_nombre} (C.C. {cert.estudiante_cedula})
                        </span>
                      </div>
                    )}

                    {cert.programa_nombre && (
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">{cert.programa_nombre}</span>
                      </div>
                    )}

                    {cert.institucion_nombre && (
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">{cert.institucion_nombre}</span>
                      </div>
                    )}

                    {cert.docente_nombre && (
                      <div className="flex items-center gap-2 truncate">
                        <UserCheck className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">Tutor: {cert.docente_nombre}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-0.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                      <span>Emitido el: {formatDateReadable(cert.fecha_emision)}</span>
                    </div>
                  </div>

                  {/* Horas y Calificación */}
                  <div
                    className={`p-3 rounded-2xl border mb-3 flex items-center justify-between text-xs ${
                      isDark ? "bg-zinc-900/80 border-zinc-800" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div>
                      <span className="text-gray-500 block text-[10px] font-bold uppercase">Intensidad:</span>
                      <span className="font-extrabold text-gray-800 dark:text-zinc-200">
                        {cert.horas_totales || 0} hrs
                      </span>
                    </div>

                    {cert.calificacion !== null && cert.calificacion !== undefined && (
                      <div className="text-right">
                        <span className="text-gray-500 block text-[10px] font-bold uppercase">Nota Final:</span>
                        <span
                          className={`font-black px-2 py-0.5 rounded-lg text-xs ${
                            Number(cert.calificacion) >= 3.0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {Number(cert.calificacion).toFixed(1)} / 5.0
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Estado de Retención / Vigencia */}
                  {userRole === "student" && remainingDays !== null && (
                    <div
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between mb-3 border ${
                        isNearExpiry
                          ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                          : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        {remainingDays > 0 ? `Vence en tu perfil en ${remainingDays} días` : "Próximo a expirar"}
                      </span>
                      <span className="text-[10px] uppercase font-black underline">Descargar</span>
                    </div>
                  )}
                </div>

                {/* Footer de la tarjeta con Botón de Descarga directa en PDF */}
                <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleDownloadPDF(cert, e)}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title="Descargar certificado en PDF con ID hexadecimal oficial"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCert(cert);
                      setIsModalOpen(true);
                    }}
                    className="p-2 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-300 transition cursor-pointer"
                    title="Ver Ficha Completa"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL DETALLADO DE CERTIFICADO ── */}
      {isModalOpen && selectedCert && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div
            className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden transition-all ${
              isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-gray-200 text-zinc-900"
            }`}
          >
            {/* Header del Modal */}
            <div
              className={`p-5 sm:p-6 border-b flex items-start justify-between gap-4 ${
                isDark ? "border-zinc-800 bg-zinc-950/95" : "border-gray-200 bg-gray-50/80"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                    {selectedCert.tipo_certificado}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
                    ID #{selectedCert.id_hex}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black leading-tight pt-1">
                  {selectedCert.practica_titulo}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm">
              {/* Identificador Hexadecimal y Verificación */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                    Identificador Hexadecimal de Autenticidad
                  </span>
                  <span className="font-mono text-base font-black text-blue-600 dark:text-blue-400">
                    #{selectedCert.id_hex}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Este código alfanumérico certifica la validez oficial del documento en la parte inferior derecha del PDF.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleCopyHex(selectedCert.id_hex, e)}
                  className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedHex === selectedCert.id_hex ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Grid de Metadatos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  className={`p-3.5 rounded-2xl border ${
                    isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Estudiante Acreditado
                  </span>
                  <div className="font-bold text-sm">{selectedCert.estudiante_nombre}</div>
                  <span className="text-xs text-gray-500 block">C.C. {selectedCert.estudiante_cedula}</span>
                </div>

                <div
                  className={`p-3.5 rounded-2xl border ${
                    isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Programa Académico
                  </span>
                  <div className="font-bold text-sm">{selectedCert.programa_nombre || "No especificado"}</div>
                  <span className="text-xs text-gray-500 block">Periodo {selectedCert.periodo || "N/A"}</span>
                </div>

                <div
                  className={`p-3.5 rounded-2xl border ${
                    isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Institución Hospitalaria / Sede
                  </span>
                  <div className="font-bold text-sm">{selectedCert.institucion_nombre || "Hospital Universitario"}</div>
                  {selectedCert.servicio_nombre && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 block">
                      Servicio: {selectedCert.servicio_nombre}
                    </span>
                  )}
                </div>

                <div
                  className={`p-3.5 rounded-2xl border ${
                    isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Docente Tutor Responsable
                  </span>
                  <div className="font-bold text-sm">{selectedCert.docente_nombre || "Docente Tutor UPTC"}</div>
                  <span className="text-xs text-gray-500 block">
                    Horas certificadas: {selectedCert.horas_totales || 120} hrs
                  </span>
                </div>
              </div>

              {/* Políticas de Almacenamiento */}
              <div
                className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                  isDark ? "bg-zinc-900/30 border-zinc-800" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Política Institucional de Almacenamiento UPTC:</span>
                </div>
                <p className="text-gray-500 dark:text-zinc-400">
                  {userRole === "student"
                    ? "Este certificado estará disponible para descarga en tu cuenta por un lapso de 1 año (hasta el " +
                      formatDateReadable(selectedCert.fecha_expiracion_estudiante) +
                      "). Pasado este tiempo se retirará de tu perfil, por lo que te recomendamos conservar una copia en PDF."
                    : "Como administrador, este registro histórico se mantiene almacenado para siempre de manera permanente en la base de datos institucional para fines de auditoría y convalidación."}
                </p>
              </div>

              {/* Botón de Descarga en Modal */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 font-semibold text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDownloadPDF(selectedCert, e)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Certificado Oficial (PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer sutil institucional */}
      <footer className="pt-8 pb-2 text-center select-none">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 font-normal tracking-wide">
          © 2026 Sistema de gestion de practicas · Camilo Sáenz R. · Fred Manrique A. · Tunja, Boyacá
        </p>
      </footer>
    </div>
  );
};

export default CertificateHistoryModule;
