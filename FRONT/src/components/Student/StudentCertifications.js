// ============================================================
// src/components/Student/StudentCertifications.js
// Panel de Certificaciones y Solicitud a Docentes — Estudiante UPTC
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Award,
  Download,
  Eye,
  FileCheck,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Hospital,
  UserCheck,
  Calendar,
  X,
  FileText,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  GraduationCap,
  ChevronRight,
  ShieldCheck,
  Mail,
  History,
  FilePlus,
  HelpCircle,
  Check,
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { useDataSync, notifyDataChanged } from "../../utils/dataSync";
import { useAuth } from "../../utils/useAuth";
import {
  generateProfessionalCertificate,
  formatDateEs,
  formatGrade,
} from "../../utils/certificateGenerator";
import { generateConstanciaPracticaVigente, generatePdf } from "../../utils/reportGenerator";
import toast from "../../utils/toast";
import uptcLogo from "../../assets/images/uptc.png";
import facultySeal from "../../assets/images/logooo.png";

const API_BASE_URL = BACKEND_URL;

// Constantes institucionales
const DEFAULT_DIRECTOR = "Dirección de Escuela";
const DEFAULT_DIRECTOR_ROLE = "Director(a) de Escuela";

const StudentCertifications = () => {
  // ── Estados de Datos ──
  const [practices, setPractices] = useState([]);
  const [issuedCertificates, setIssuedCertificates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Pestañas y Filtro de Prácticas ──
  const [activeTab, setActiveTab] = useState("certificados"); // "certificados" | "reportes" | "emitidos"
  const [requestCategory, setRequestCategory] = useState("certificado"); // "certificado" | "reporte"
  const [selectedPracticeFilter, setSelectedPracticeFilter] = useState("all");

  // ── Modal de Solicitud de Certificado / Reporte ──
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedPracticeForRequest, setSelectedPracticeForRequest] = useState(null);
  const [requestFormData, setRequestFormData] = useState({
    tipo_certificado: "Certificado de Aprobación de Práctica Clínica",
    motivo: "Trámite de Grado",
    observaciones: "",
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // ── Modal de Vista Previa de Diploma ──
  const [previewCert, setPreviewCert] = useState(null);

  // ── Configuración institucional dinámica ──
  const [instSettings, setInstSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("institutionSettings")) || {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        setInstSettings(JSON.parse(localStorage.getItem("institutionSettings")) || {});
      } catch (e) {}
    };
    window.addEventListener("institutionSettingsUpdated", handleSettingsUpdate);

    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/institution-settings`);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.name || data.nombre)) {
            setInstSettings(data);
            try {
              localStorage.setItem("institutionSettings", JSON.stringify(data));
            } catch (e) {}
          }
        }
      } catch (e) {}
    };
    fetchSettings();

    return () => window.removeEventListener("institutionSettingsUpdated", handleSettingsUpdate);
  }, []);

  // ── Obtener datos del estudiante autenticado ──
  const { user } = useAuth();

  // ── Obtener datos del estudiante autenticado ──
  const student = useMemo(() => {
    let cedula = user?.cedula || user?.id || null;
    let nombre = user?.nombre || user?.name || null;
    let apellido = user?.apellidos || user?.lastName || user?.apellido || "";
    let carrera = user?.programa || user?.carrera || user?.career || "Medicina";
    let correo = user?.correo_institucional || user?.correo || user?.email || "estudiante@uptc.edu.co";

    if (!cedula || !nombre) {
      try {
        const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!cedula) cedula = parsed.cedula || parsed.Cédula || parsed.id || null;
          if (!nombre) {
            const pNom = parsed.nombre || parsed.name || "";
            const pApe = parsed.apellidos || parsed.apellido || parsed.lastName || "";
            nombre = `${pNom} ${pApe}`.trim() || null;
          }
          if (parsed.programa || parsed.career) carrera = parsed.programa || parsed.career;
          if (parsed.correo_institucional || parsed.email) correo = parsed.correo_institucional || parsed.email;
        }
      } catch (e) {
        console.warn("No se pudo obtener datos de sesión:", e);
      }
    }

    return {
      cedula: cedula || "44",
      nombre: nombre ? (apellido && !nombre.includes(apellido) ? `${nombre} ${apellido}`.trim() : nombre) : "Ricardo Torres",
      carrera,
      correo,
    };
  }, [user]);

  // ── Cargar Prácticas, Solicitudes y Certificados Reales ──
  const loadData = useCallback(async () => {
    setIsLoading(true);
    const cedula = student.cedula;

    try {
      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Consultar Prácticas Reales del Estudiante desde la BD
      let studentPractices = [];
      try {
        const res = await fetch(`${API_BASE_URL}/api/student/practices/${cedula}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            studentPractices = data;
          }
        }
      } catch (err) {
        console.warn("Error al consultar prácticas del backend:", err);
      }

      setPractices(studentPractices);

      // 2. Cargar Solicitudes de Certificados Reales desde la BD
      let reqList = [];
      try {
        const resReq = await fetch(`${API_BASE_URL}/api/student/certificate-requests/${cedula}`, { headers });
        if (resReq.ok) {
          const reqData = await resReq.json();
          if (Array.isArray(reqData)) reqList = reqData;
        }
      } catch (err) {
        console.warn("Error consultando solicitudes en API:", err);
      }

      // Limpiar cachés anteriores
      try {
        localStorage.removeItem(`uptc_cert_reqs_${cedula}`);
      } catch (e) { }

      setRequests(reqList);

      // 3. Cargar Certificados Emitidos (ÚNICAMENTE Reales Avalados por Docente)
      const realIssued = reqList
        .filter((r) => r.estado === "Aprobado")
        .map((r) => {
          const matchPr = studentPractices.find((p) => p.id === r.practica_id);
          const issueYear = r.fecha_respuesta ? new Date(r.fecha_respuesta).getFullYear() : new Date().getFullYear();
          const consecutivo = `UPTC-FCS-${issueYear}-${String(r.id).padStart(4, "0")}`;
          return {
            id: `REQ-${r.id}`,
            reqId: r.id,
            consecutivo: consecutivo,
            name: r.tipo_certificado || `Certificado de Práctica en ${r.practica_titulo || "Salud"}`,
            type: "Certificado Oficial Avalado",
            practice: r.practica_titulo || matchPr?.titulo || "Práctica Formativa",
            practiceId: r.practica_id,
            institution: r.institucion_nombre || matchPr?.institucion_nombre || "Hospital Universitario UPTC",
            service: r.servicio_nombre || matchPr?.servicio_nombre || "Servicio Asistencial",
            hours: r.horas_totales || matchPr?.horas_totales || matchPr?.horas_asignadas || 120,
            issueDate: r.fecha_respuesta ? r.fecha_respuesta.substring(0, 10) : new Date().toISOString().substring(0, 10),
            docentName: r.docente_nombre || matchPr?.docente_nombre || "Docente UPTC",
            directorName: instSettings.director_nombre || instSettings.representante || DEFAULT_DIRECTOR,
            directorRole: DEFAULT_DIRECTOR_ROLE,
            period: r.practica_periodo || matchPr?.periodo || "2026-1",
            state: "Emitido Oficial",
          };
        });

      setIssuedCertificates(realIssued);
    } catch (err) {
      console.error("Error global al cargar datos de certificaciones:", err);
    } finally {
      setIsLoading(false);
    }
  }, [student]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useDataSync(loadData);

  // ── Prácticas del Estudiante para Selección ──
  const allAssignedPractices = practices;

  // Prácticas filtradas según selección del estudiante
  const displayedPractices = useMemo(() => {
    if (selectedPracticeFilter === "all") return practices;
    return practices.filter((p) => String(p.id) === String(selectedPracticeFilter));
  }, [practices, selectedPracticeFilter]);

  // Solicitudes divididas por categoría
  const certificateRequests = useMemo(() => {
    return requests.filter(
      (r) =>
        r.categoria_solicitud === "certificado" ||
        (!r.categoria_solicitud &&
          !((r.tipo_certificado || "").toLowerCase().includes("reporte") ||
            (r.tipo_certificado || "").toLowerCase().includes("constancia")))
    );
  }, [requests]);

  const reportRequests = useMemo(() => {
    return requests.filter(
      (r) =>
        r.categoria_solicitud === "reporte" ||
        ((r.tipo_certificado || "").toLowerCase().includes("reporte") ||
          (r.tipo_certificado || "").toLowerCase().includes("constancia"))
    );
  }, [requests]);

  // Mapas por ID de práctica
  const certificateRequestsByPracticeId = useMemo(() => {
    const map = {};
    certificateRequests.forEach((r) => {
      if (r.practica_id) map[r.practica_id] = r;
    });
    return map;
  }, [certificateRequests]);

  const reportRequestsByPracticeId = useMemo(() => {
    const map = {};
    reportRequests.forEach((r) => {
      if (r.practica_id) map[r.practica_id] = r;
    });
    return map;
  }, [reportRequests]);

  // Mapa de certificados emitidos por ID de práctica
  const issuedCertificatesByPracticeId = useMemo(() => {
    const map = {};
    issuedCertificates.forEach((c) => {
      if (c.practiceId) {
        map[c.practiceId] = c;
      }
    });
    return map;
  }, [issuedCertificates]);

  // ── Abrir Modal de Solicitud (Certificado Oficial o Reporte) ──
  const handleOpenRequestModal = (practice, category = "certificado") => {
    if (practice.estado === "Cancelada") {
      toast.error("La práctica está cancelada. Por normativa institucional, no es posible tramitar certificados ni reportes de prácticas canceladas.");
      return;
    }

    if (practice.estado === "Finalizada" && practice.fecha_fin) {
      const diffDays = Math.floor((Date.now() - new Date(practice.fecha_fin).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        toast.error(`El plazo máximo reglamentario de 30 días posteriores a la finalización de la práctica ha expirado (${diffDays} días transcurridos). Ya no se admiten trámites de certificación para esta práctica.`);
        return;
      }
    }

    setSelectedPracticeForRequest(practice);
    setRequestCategory(category);
    setRequestFormData({
      tipo_certificado:
        category === "reporte"
          ? "Constancia de Práctica Formativa Vigente / En Curso"
          : "Certificado Oficial de Aprobación de Práctica Clínica",
      motivo: category === "reporte" ? "Trámite Institucional / EPS" : "Trámite de Grado",
      observaciones: "",
    });
    setIsRequestModalOpen(true);
  };

  // ── Enviar Solicitud al Docente ──
  const handleSubmitCertificateRequest = async (e) => {
    e.preventDefault();
    if (!selectedPracticeForRequest) return;

    if (selectedPracticeForRequest.estado === "Cancelada") {
      toast.error("No es posible solicitar certificados para una práctica cancelada.");
      return;
    }

    if (selectedPracticeForRequest.estado === "Finalizada" && selectedPracticeForRequest.fecha_fin) {
      const diffDays = Math.floor((Date.now() - new Date(selectedPracticeForRequest.fecha_fin).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        toast.error("El plazo máximo de 30 días posteriores a la finalización de la práctica ha expirado.");
        return;
      }
    }

    // Validación si intenta solicitar certificado sin nota
    const isReport = requestCategory === "reporte";
    const hasGrade =
      selectedPracticeForRequest.calificacion !== null &&
      selectedPracticeForRequest.calificacion !== undefined &&
      selectedPracticeForRequest.calificacion !== "" &&
      Number(selectedPracticeForRequest.calificacion) > 0;

    if (!isReport && !hasGrade) {
      toast.warning(
        "Aún no tienes una nota final registrada en esta práctica. Por normativa institucional, no es posible tramitar un Certificado Oficial sin calificación. Por favor solicita un Reporte de Práctica."
      );
      setRequestCategory("reporte");
      setRequestFormData((prev) => ({
        ...prev,
        tipo_certificado: "Constancia de Práctica Formativa Vigente / En Curso",
        motivo: "Trámite Institucional / EPS",
      }));
      return;
    }

    setIsSubmittingRequest(true);

    const docentName = selectedPracticeForRequest.docente_nombre || "Docente UPTC";
    const payload = {
      estudiante_cedula: student.cedula,
      docente_cedula: selectedPracticeForRequest.docente_cedula || null,
      practica_id: selectedPracticeForRequest.id,
      categoria_solicitud: requestCategory,
      tipo_certificado: requestFormData.tipo_certificado,
      motivo: requestFormData.motivo,
      observaciones: requestFormData.observaciones,
      practica_titulo: selectedPracticeForRequest.titulo,
      practica_periodo: selectedPracticeForRequest.periodo || "2026-1",
      horas_totales: selectedPracticeForRequest.horas_totales || selectedPracticeForRequest.horas_asignadas || 120,
      servicio_nombre: selectedPracticeForRequest.servicio_nombre || "Servicio Asistencial",
      institucion_nombre: selectedPracticeForRequest.institucion_nombre || "Hospital Universitario UPTC",
      docente_nombre: docentName,
      docente_correo: selectedPracticeForRequest.docente_correo || "",
    };

    try {
      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_BASE_URL}/api/student/certificate-requests`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          isReport
            ? `¡Solicitud de Reporte enviada exitosamente a ${docentName}!`
            : `¡Solicitud de Certificado enviada exitosamente a ${docentName}! El docente avalará tu certificación.`
        );
        notifyDataChanged("certificate-requests", "create");
        await loadData();
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.requiresReport) {
          toast.warning(errData.message);
          setRequestCategory("reporte");
          setRequestFormData((prev) => ({
            ...prev,
            tipo_certificado: "Reporte de Práctica Formativa Vigente",
            motivo: "Trámite Institucional / EPS",
          }));
          return;
        }
        toast.error(errData.message || "Error al enviar la solicitud al docente.");
      }
    } catch (err) {
      console.error("Error al enviar solicitud:", err);
      toast.error("Error de conexión al enviar la solicitud.");
    } finally {
      setIsSubmittingRequest(false);
      setIsRequestModalOpen(false);
    }
  };

  // ── Cancelar Solicitud ──
  const handleCancelRequest = async (reqId) => {
    if (!window.confirm("¿Deseas cancelar esta solicitud?")) return;

    try {
      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE_URL}/api/student/certificate-requests/${reqId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        notifyDataChanged("certificate-requests", "delete");
        toast.info("Solicitud cancelada correctamente.");
        await loadData();
      } else {
        toast.error("No se pudo cancelar la solicitud.");
      }
    } catch (e) {
      console.error("Error cancelando solicitud:", e);
      toast.error("Error de conexión al cancelar la solicitud.");
    }
  };

  // ── Descargar Reporte Avalado en PDF ──
  const handleDownloadReport = (req) => {
    try {
      const matchPr = practices.find((p) => String(p.id) === String(req.practica_id));
      const issueYear = req.fecha_respuesta ? new Date(req.fecha_respuesta).getFullYear() : new Date().getFullYear();
      const consecutivo = `UPTC-REP-${issueYear}-${String(req.id).padStart(4, "0")}`;

      generateConstanciaPracticaVigente({
        consecutivo: consecutivo,
        studentName: student.nombre,
        studentCedula: student.cedula,
        studentCareer: student.carrera,
        practiceProgram: student.carrera,
        practiceName: req.practica_titulo || matchPr?.titulo || "Práctica Formativa",
        serviceName: req.servicio_nombre || matchPr?.servicio_nombre || "Servicio Asistencial",
        institutionName: req.institucion_nombre || matchPr?.institucion_nombre || "Hospital Universitario UPTC",
        docentName: req.docente_nombre || matchPr?.docente_nombre || "Docente UPTC",
        totalHours: req.horas_totales || matchPr?.horas_totales || matchPr?.horas_asignadas || 120,
        accumulatedHours: matchPr?.horas_cumplidas || 0,
        period: req.practica_periodo || matchPr?.periodo || "2026-2",
        directorName: instSettings.director_nombre || instSettings.representante || DEFAULT_DIRECTOR,
        directorRole: DEFAULT_DIRECTOR_ROLE,
        issueDate: req.fecha_respuesta ? req.fecha_respuesta.substring(0, 10) : new Date().toISOString().substring(0, 10),
        institutionSettings: instSettings,
      });
      toast.success("Reporte institucional generado y descargado exitosamente en PDF.");
    } catch (err) {
      console.error("Error al generar reporte PDF:", err);
      toast.error("Error al generar el archivo PDF del reporte.");
    }
  };

  // ── Descargar Certificado Oficial en PDF ──
  const handleDownloadCertificate = (cert) => {
    const isVigente = (cert.type || "").toLowerCase().includes("vigente") || (cert.name || "").toLowerCase().includes("vigente");

    if (isVigente) {
      generateConstanciaPracticaVigente({
        consecutivo: cert.consecutivo,
        studentName: student.nombre,
        studentCedula: student.cedula,
        studentCareer: student.carrera,
        practiceProgram: cert.programa_nombre || cert.career || student.carrera,
        practiceName: cert.practice || cert.name,
        serviceName: cert.service,
        institutionName: cert.institution,
        docentName: cert.docentName,
        totalHours: cert.hours,
        accumulatedHours: cert.hours,
        period: cert.period,
        directorName: cert.directorName,
        directorRole: cert.directorRole,
        issueDate: cert.issueDate,
        institutionSettings: instSettings,
      });
    } else {
      const savedSig = typeof window !== "undefined" ? localStorage.getItem("uptc_cert_signature") : null;
      generateProfessionalCertificate({
        studentName: student.nombre,
        cedula: student.cedula,
        career: student.carrera,
        practiceName: cert.practice || cert.name || cert.service,
        serviceName: cert.service || "",
        institution: cert.institution,
        docentName: cert.docentName,
        hours: cert.hours,
        period: cert.period || "2026-2",
        startDate: cert.startDate || cert.fecha_inicio,
        endDate: cert.endDate || cert.fecha_fin,
        grade: cert.calificacion || cert.grade,
        date: `Tunja, ${new Date(cert.issueDate || Date.now()).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`,
        directorName: cert.directorName || DEFAULT_DIRECTOR,
        directorRole: cert.directorRole || "Coordinador(a) de Práctica",
        signatureImage: cert.signatureImage || cert.docente_foto_firma || savedSig || null,
        institutionSettings: instSettings,
      });
    }

    toast.success(`Descargando ${cert.name}...`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">

      {/* ─── Encabezado Principal de la Vista ─── */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 transition duration-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 shadow-inner">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                Mis Certificaciones y Solicitudes
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Solicita certificados a tus docentes a cargo, consulta diplomas emitidos y acredita prácticas pasadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition duration-150 shadow-sm border border-gray-200 dark:border-slate-700"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-600" : ""}`} />
              <span>{isLoading ? "Cargando..." : "Actualizar"}</span>
            </button>
          </div>
        </div>

        {/* Resumen numérico rápido */}
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                Prácticas Asignadas
              </span>
              <p className="text-2xl font-black text-blue-950 dark:text-blue-100 mt-0.5">
                {practices.length}
              </p>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Rotaciones formativas registradas</span>
            </div>
            <Hospital className="w-8 h-8 text-blue-400/50" />
          </div>

          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-100 dark:border-amber-900/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Certificados Emitidos
              </span>
              <p className="text-2xl font-black text-amber-950 dark:text-amber-100 mt-0.5">
                {issuedCertificates.length}
              </p>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Listos para descargar en PDF</span>
            </div>
            <FileCheck className="w-8 h-8 text-amber-400/50" />
          </div>

          <div className="p-4 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                Solicitudes en Trámite
              </span>
              <p className="text-2xl font-black text-purple-950 dark:text-purple-100 mt-0.5">
                {requests.filter((r) => r.estado === "Pendiente").length}
              </p>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">En revisión por docentes</span>
            </div>
            <Clock className="w-8 h-8 text-purple-400/50" />
          </div>
        </div>

        {/* Pestañas Principales de Navegación */}
        <div className="flex border-b border-gray-200 dark:border-slate-800 gap-2 mt-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("certificados")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "certificados"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Certificados Oficiales</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reportes")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "reportes"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Reportes de Práctica</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("emitidos")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "emitidos"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Documentos Emitidos ({issuedCertificates.length})</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* PESTAÑA 1: CERTIFICADOS OFICIALES                          */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === "certificados" && (
        <section className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 transition duration-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Award className="w-4 h-4" />
                <span>Certificación de Culminación y Aprobación</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
                Solicitud de Certificados a Docentes
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Selecciona la práctica formativa para solicitar el certificado avalado por tu docente. Requiere calificación final aprobada.
              </p>
            </div>
          </div>

          {/* Selector de Práctica Asignada */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200">
              <Hospital className="w-4 h-4 text-amber-600" />
              <span>Selecciona la práctica asignada:</span>
            </div>
            <div className="flex-1 max-w-md">
              <select
                value={selectedPracticeFilter}
                onChange={(e) => setSelectedPracticeFilter(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">Todas mis prácticas asignadas ({practices.length})</option>
                {practices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo} — {p.institucion_nombre || "Sede"} ({p.estado || "Asignada"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid de Prácticas */}
          {displayedPractices.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No tienes prácticas formativas registradas para el filtro seleccionado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedPractices.map((pr) => {
                const hasGrade =
                  pr.calificacion !== null &&
                  pr.calificacion !== undefined &&
                  pr.calificacion !== "" &&
                  Number(pr.calificacion) > 0;
                const pendingReq = certificateRequestsByPracticeId[pr.id];
                const alreadyEmitted = issuedCertificatesByPracticeId[pr.id];

                return (
                  <div
                    key={pr.id}
                    className="bg-gradient-to-br from-white to-gray-50/50 dark:from-slate-900 dark:to-slate-800/40 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                          {pr.periodo || "2026-2"} • {pr.estado || "Asignada"}
                        </span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {pr.horas_cumplidas || 0} / {pr.horas_totales || pr.horas_asignadas || 120}h cumplidas
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                          {pr.titulo}
                        </h3>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 font-medium">
                          <Hospital className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{pr.servicio_nombre || "Servicio Asistencial"}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{pr.institucion_nombre || "Sede Hospitalaria"}</span>
                        </p>
                      </div>

                      {/* Docente a Cargo */}
                      <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block uppercase tracking-wider">
                              Docente a Cargo
                            </span>
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {pr.docente_nombre || "Docente Titular Asignado"}
                            </p>
                            {pr.docente_correo && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate block">
                                {pr.docente_correo}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Estado de Calificación */}
                      {hasGrade ? (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Nota Final: {Number(pr.calificacion).toFixed(1)} / 5.0
                          </span>
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                            Aprobada
                          </span>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span>Calificación Pendiente — Certificado No Disponible</span>
                          </div>
                          <p className="leading-relaxed text-gray-700 dark:text-zinc-300 text-[11px]">
                            Aún no tienes nota definitiva registrada en esta práctica. Los Certificados Oficiales solo se expiden tras la calificación final del docente.
                          </p>
                          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-amber-500/20">
                            <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                              ¿Necesitas constancia de avance o turnos?
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab("reportes");
                                setSelectedPracticeFilter(String(pr.id));
                                handleOpenRequestModal(pr, "reporte");
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Solicitar Reporte de Práctica</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botón de Acción según Estado */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                      {alreadyEmitted ? (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Emitido
                          </span>
                          <button
                            onClick={() => handleDownloadCertificate(alreadyEmitted)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" /> Descargar
                          </button>
                        </div>
                      ) : pendingReq ? (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 animate-spin" /> Solicitud en trámite con el docente
                          </span>
                          <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                            Pendiente
                          </span>
                        </div>
                      ) : hasGrade ? (
                        <button
                          onClick={() => handleOpenRequestModal(pr, "certificado")}
                          className="w-full inline-flex items-center justify-center gap-2 py-2 px-3.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition duration-150"
                        >
                          <Award className="w-4 h-4" />
                          <span>Solicitar Certificado Oficial al Docente</span>
                        </button>
                      ) : (
                        <div className="text-center py-1">
                          <span className="text-[11px] font-semibold text-gray-400">
                            Requiere nota para habilitar solicitud oficial
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Solicitudes de Certificados enviadas */}
          {certificateRequests.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Mis Solicitudes de Certificados Oficiales ({certificateRequests.length})</span>
              </h3>

              <div className="space-y-3">
                {certificateRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-gray-50/80 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            req.estado === "Aprobado"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                              : req.estado === "Rechazado"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                          }`}
                        >
                          {req.estado === "Aprobado" ? "● Aprobado por el Docente" : "⏳ Pendiente de Respuesta"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Enviada el: {new Date(req.fecha_solicitud).toLocaleDateString("es-CO")}
                        </span>
                      </div>

                      <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                        {req.tipo_certificado} — {req.practica_titulo}
                      </h4>

                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        <strong>Docente Responsable:</strong> {req.docente_nombre} • <strong>Motivo:</strong> {req.motivo}
                      </p>

                      {req.observaciones && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          "{req.observaciones}"
                        </p>
                      )}

                      {req.respuesta_docente && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                          <strong>Nota del Docente:</strong> "{req.respuesta_docente}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:self-center">
                      {req.estado === "Pendiente" && (
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl transition"
                        >
                          Cancelar Solicitud
                        </button>
                      )}

                      {req.estado === "Aprobado" && (
                        <button
                          onClick={() => {
                            const cert = issuedCertificates.find((c) => c.id === `REQ-${req.id}`);
                            if (cert) handleDownloadCertificate(cert);
                            else toast.info("Generando certificado aprobado...");
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Descargar Certificado
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* PESTAÑA 2: REPORTES E INFORMES DE PRÁCTICA (SIN NOTA REQ)   */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === "reportes" && (
        <section className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 transition duration-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>Gestión de Informes y Horas Formativas</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
                Solicitud de Reportes de Práctica y Cumplimiento
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tramita reportes de práctica vigente, registro de horas y asistencia ante tu docente sin necesidad de esperar a la nota final.
              </p>
            </div>
          </div>

          {/* Banner Informativo */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm text-blue-950 dark:text-blue-100 mb-0.5">
                ¿Cuándo solicitar un Reporte de Práctica?
              </strong>
              <p className="leading-relaxed text-gray-700 dark:text-zinc-300">
                Si requieres acreditar tu vinculación asistencial activa, turnos rotatorios, horas acumuladas a la fecha o acreditación de rotación ante EPS, IPS o convenios institucionales, puedes solicitar tu reporte en cualquier momento de tu práctica.
              </p>
            </div>
          </div>

          {/* Selector de Práctica Asignada */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200">
              <Hospital className="w-4 h-4 text-blue-600" />
              <span>Selecciona la práctica asignada para solicitar el reporte:</span>
            </div>
            <div className="flex-1 max-w-md">
              <select
                value={selectedPracticeFilter}
                onChange={(e) => setSelectedPracticeFilter(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas mis prácticas asignadas ({practices.length})</option>
                {practices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo} — {p.institucion_nombre || "Sede"} ({p.estado || "Asignada"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid de Prácticas para Reportes */}
          {displayedPractices.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No tienes prácticas formativas registradas para el filtro seleccionado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedPractices.map((pr) => {
                const pendingReportReq = reportRequestsByPracticeId[pr.id]?.estado === "Pendiente" ? reportRequestsByPracticeId[pr.id] : null;
                const approvedReportReq = reportRequestsByPracticeId[pr.id]?.estado === "Aprobado" ? reportRequestsByPracticeId[pr.id] : null;

                return (
                  <div
                    key={pr.id}
                    className="bg-gradient-to-br from-white to-gray-50/50 dark:from-slate-900 dark:to-slate-800/40 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                          {pr.periodo || "2026-2"} • {pr.estado || "Asignada"}
                        </span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {pr.horas_cumplidas || 0} / {pr.horas_totales || pr.horas_asignadas || 120}h
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                          {pr.titulo}
                        </h3>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 font-medium">
                          <Hospital className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{pr.servicio_nombre || "Servicio Asistencial"}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{pr.institucion_nombre || "Sede Hospitalaria"}</span>
                        </p>
                      </div>

                      {/* Docente */}
                      <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block uppercase tracking-wider">
                              Docente
                            </span>
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {pr.docente_nombre || "Docente Titular Asignado"}
                            </p>
                            {pr.docente_correo && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate block">
                                {pr.docente_correo}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info de horas y turnos */}
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Horas Realizadas:</span>
                          <strong className="text-blue-600 dark:text-blue-400">{pr.horas_cumplidas || 0} horas</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Horas Programadas:</span>
                          <strong>{pr.horas_totales || pr.horas_asignadas || 120} horas</strong>
                        </div>
                      </div>
                    </div>

                    {/* Botón de Acción para Reporte */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                      {pendingReportReq ? (
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 animate-spin" /> Solicitud en trámite con el docente
                          </span>
                          <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded">
                            Pendiente
                          </span>
                        </div>
                      ) : approvedReportReq ? (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Reporte Avalado
                          </span>
                          <button
                            onClick={() => handleDownloadReport(approvedReportReq)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" /> Descargar PDF
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenRequestModal(pr, "reporte")}
                          className="w-full inline-flex items-center justify-center gap-2 py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition duration-150"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Solicitar Reporte de Práctica</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Solicitudes de Reportes enviadas */}
          {reportRequests.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>Mis Solicitudes de Reportes de Práctica ({reportRequests.length})</span>
              </h3>

              <div className="space-y-3">
                {reportRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-gray-50/80 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            req.estado === "Aprobado"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                              : req.estado === "Rechazado"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300"
                          }`}
                        >
                          {req.estado === "Aprobado" ? "● Aprobado por el Docente" : "⏳ Pendiente de Respuesta"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Enviada el: {new Date(req.fecha_solicitud).toLocaleDateString("es-CO")}
                        </span>
                      </div>

                      <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                        {req.tipo_certificado} — {req.practica_titulo}
                      </h4>

                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        <strong>Docente Responsable:</strong> {req.docente_nombre} • <strong>Motivo:</strong> {req.motivo}
                      </p>

                      {req.observaciones && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          "{req.observaciones}"
                        </p>
                      )}

                      {req.respuesta_docente && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                          <strong>Nota del Docente:</strong> "{req.respuesta_docente}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:self-center">
                      {req.estado === "Pendiente" && (
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl transition"
                        >
                          Cancelar Solicitud
                        </button>
                      )}

                      {req.estado === "Aprobado" && (
                        <button
                          onClick={() => handleDownloadReport(req)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Descargar Reporte PDF
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* PESTAÑA 3: DOCUMENTOS Y CERTIFICADOS EMITIDOS              */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === "emitidos" && (
        <section className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 transition duration-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Documentos Avalados Oficiales</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
                Certificados y Reportes Emitidos
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Visualiza y descarga en PDF los certificados y diplomas oficiales formalmente avalados por tus docentes y la dirección de escuela.
              </p>
            </div>
          </div>

          {issuedCertificates.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Aún no tienes certificados o diplomas emitidos. Solicítalos a tus docentes en las pestañas superiores.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {issuedCertificates.map((cert) => (
                <div
                  key={cert.id}
                  className="relative bg-gradient-to-br from-white via-white to-amber-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/10 p-6 rounded-2xl border-2 border-amber-200/70 dark:border-amber-900/40 shadow-md hover:shadow-lg transition duration-200 flex flex-col justify-between overflow-hidden"
                >
                  {/* Franja dorada institucional superior */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600"></div>

                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          {cert.type}
                        </span>
                        <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-1">
                          Radicado: {cert.consecutivo}
                        </p>
                      </div>
                      <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                        <Award className="w-5 h-5" />
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug mb-2">
                      {cert.name}
                    </h3>

                    <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 mb-5">
                      <p className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <strong>Sede Hospitalaria:</strong> {cert.institution}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <strong>Intensidad:</strong> {cert.hours} Horas Académicas Certificadas
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <strong>Fecha de Emisión:</strong> {cert.issueDate}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <strong>Docente Avalador:</strong> {cert.docentName}
                      </p>
                    </div>
                  </div>

                  {/* Acciones: Previsualizar y Descargar */}
                  <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setPreviewCert(cert)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition duration-150 border border-gray-200 dark:border-slate-700"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Vista Previa</span>
                    </button>

                    <button
                      onClick={() => handleDownloadCertificate(cert)}
                      className="inline-flex items-center gap-2 py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition duration-150"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Certificado</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: SOLICITAR CERTIFICADO O REPORTE A DOCENTE      */}
      {/* ─────────────────────────────────────────────────────────── */}
      {isRequestModalOpen && selectedPracticeForRequest && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-white max-h-[92vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-slate-800 mb-5">
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                    requestCategory === "reporte"
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900"
                      : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900"
                  }`}
                >
                  {requestCategory === "reporte" ? "Trámite de Reporte Institucional" : "Trámite de Certificado Oficial"}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {requestCategory === "reporte"
                    ? "Solicitar Reporte de Práctica al Docente"
                    : "Solicitar Certificado Oficial de Aprobación"}
                </h3>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Práctica dentro del modal */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Práctica Asignada *
              </label>
              <select
                value={selectedPracticeForRequest.id}
                onChange={(e) => {
                  const found = practices.find((p) => String(p.id) === String(e.target.value));
                  if (found) setSelectedPracticeForRequest(found);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {practices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo} — {p.institucion_nombre || "Sede"} ({p.periodo || "Periodo"})
                  </option>
                ))}
              </select>
            </div>

            {/* Ficha de la práctica seleccionada */}
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 mb-4 space-y-2">
              <h4 className="font-bold text-sm text-blue-950 dark:text-blue-100">
                {selectedPracticeForRequest.titulo}
              </h4>
              <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                <p>
                  <strong>Docente:</strong> {selectedPracticeForRequest.docente_nombre || "Docente UPTC"}
                  {selectedPracticeForRequest.docente_correo && ` (${selectedPracticeForRequest.docente_correo})`}
                </p>
                <p>
                  <strong>Sede / IPS:</strong> {selectedPracticeForRequest.institucion_nombre || "Hospital Universitario"} — {selectedPracticeForRequest.servicio_nombre || "Servicio"}
                </p>
                <p>
                  <strong>Horas:</strong> {selectedPracticeForRequest.horas_cumplidas || 0} realizadas / {selectedPracticeForRequest.horas_totales || selectedPracticeForRequest.horas_asignadas || 120} programadas • <strong>Periodo:</strong> {selectedPracticeForRequest.periodo || "2026-2"}
                </p>
              </div>
            </div>

            {/* Verificación de Calificación si es Certificado */}
            {requestCategory === "certificado" &&
              (!selectedPracticeForRequest.calificacion || Number(selectedPracticeForRequest.calificacion) <= 0) && (
                <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Calificación Pendiente en esta Práctica</span>
                  </div>
                  <p className="leading-relaxed text-gray-700 dark:text-zinc-300 text-[11px]">
                    Esta práctica aún no cuenta con nota definitiva registrada por el docente. No es posible tramitar un Certificado de Aprobación sin nota.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestCategory("reporte");
                      setRequestFormData((prev) => ({
                        ...prev,
                        tipo_certificado: "Reporte de Práctica Formativa Vigente",
                        motivo: "Trámite Institucional / EPS",
                      }));
                    }}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Cambiar a Solicitud de Reporte de Práctica</span>
                  </button>
                </div>
              )}

            {/* Formulario */}
            <form onSubmit={handleSubmitCertificateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {requestCategory === "reporte" ? "Tipo de Reporte a Solicitar *" : "Tipo de Certificado a Solicitar *"}
                </label>
                <select
                  value={requestFormData.tipo_certificado}
                  onChange={(e) => setRequestFormData({ ...requestFormData, tipo_certificado: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  {requestCategory === "reporte" ? (
                    <>
                      <option value="Reporte de Práctica Formativa Vigente">
                        Reporte de Práctica Formativa Vigente
                      </option>
                      <option value="Reporte de Cumplimiento de Horas y Asistencia">
                        Reporte de Cumplimiento de Horas y Asistencia
                      </option>
                      <option value="Informe Parcial de Rotación Clínica Supervisada">
                        Informe Parcial de Rotación Clínica Supervisada
                      </option>
                      <option value="Certificado de Turnos Asistenciales Realizados">
                        Certificado de Turnos Asistenciales Realizados
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="Certificado de Aprobación de Práctica Clínica">
                        Certificado de Aprobación de Práctica Clínica
                      </option>
                      <option value="Certificación de Intensidad Horaria y Desempeño Asistencial">
                        Certificación de Intensidad Horaria y Desempeño Asistencial
                      </option>
                      <option value="Acreditación de Rotación por Servicio Especializado">
                        Acreditación de Rotación por Servicio Especializado
                      </option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Motivo o Destino del Documento *
                </label>
                <select
                  value={requestFormData.motivo}
                  onChange={(e) => setRequestFormData({ ...requestFormData, motivo: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  {requestCategory === "reporte" ? (
                    <>
                      <option value="Trámite Institucional / EPS">Trámite Institucional / EPS</option>
                      <option value="Presentación ante IPS o Centro de Práctica">Presentación ante IPS o Centro de Práctica</option>
                      <option value="Seguimiento Académico / Hoja de Vida">Seguimiento Académico / Hoja de Vida</option>
                      <option value="Solicitud de Beca o Apoyo Universitario">Solicitud de Beca o Apoyo Universitario</option>
                      <option value="Otro requerimiento institucional">Otro requerimiento institucional</option>
                    </>
                  ) : (
                    <>
                      <option value="Trámite de Grado">Trámite de Grado Académico</option>
                      <option value="Hoja de Vida / Postulación Asistencial">Hoja de Vida / Postulación Asistencial</option>
                      <option value="Requisito de Posgrado / Especialización">Requisito de Posgrado / Especialización</option>
                      <option value="Convalidación Institucional">Convalidación Institucional</option>
                      <option value="Otro requerimiento administrativo">Otro requerimiento administrativo</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Comentarios o Aclaraciones para el Docente (Opcional)
                </label>
                <textarea
                  rows="3"
                  value={requestFormData.observaciones}
                  onChange={(e) => setRequestFormData({ ...requestFormData, observaciones: e.target.value })}
                  placeholder={
                    requestCategory === "reporte"
                      ? "Ej: Estimado docente, solicito este reporte de horas acumuladas para presentar a la coordinación de rotaciones..."
                      : "Ej: Estimado docente, solicito este certificado con destino a la secretaría académica para radicar mi trámite de grado..."
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                ></textarea>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  Tu solicitud será enviada directamente al docente. Una vez avalada, tu documento se generará en formato PDF oficial institucional para su descarga inmediata.
                </span>
              </div>

              {/* Botones de acción del Modal */}
              <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingRequest ||
                    (requestCategory === "certificado" &&
                      (!selectedPracticeForRequest.calificacion || Number(selectedPracticeForRequest.calificacion) <= 0))
                  }
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-md transition duration-150 disabled:opacity-50 ${
                    requestCategory === "reporte" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmittingRequest
                      ? "Enviando Solicitud..."
                      : requestCategory === "reporte"
                      ? "Enviar Solicitud de Reporte al Docente"
                      : "Enviar Solicitud de Certificado al Docente"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 2: VISTA PREVIA DEL DIPLOMA OFICIAL UPTC             */}
      {/* ─────────────────────────────────────────────────────────── */}
      {previewCert && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-gray-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <Award className="w-6 h-6 text-amber-500" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Vista Previa del Diploma Oficial UPTC
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Radicado de emisión: {previewCert.consecutivo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewCert(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hoja de Certificado Virtual Vertical */}
            <div className="flex justify-center bg-slate-100/70 dark:bg-zinc-950/60 p-3 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <div
                className="certificate-preview-sheet relative w-full max-w-[540px] aspect-[210/297] p-7 sm:p-9 rounded-xl shadow-2xl border border-slate-300 select-none flex flex-col justify-between"
                style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
              >
                {/* Doble Marco Institucional Dorado */}
                <div className="absolute inset-3 border border-amber-600/60 rounded-lg pointer-events-none"></div>
                <div className="absolute inset-4 border border-amber-700/30 rounded-md pointer-events-none"></div>

                {/* Encabezado con Logos y Título Central */}
                <div className="relative z-10 pt-1">
                  <div className="flex items-center justify-between px-3 mb-2">
                    <div className="w-20 sm:w-24 flex items-center">
                      <img
                        src={instSettings.logo_institucion || instSettings.logoPreview || instSettings.logo_url || uptcLogo}
                        alt="Logo Institución"
                        className="h-9 sm:h-11 w-auto object-contain"
                        onError={(e) => {
                          if (e.currentTarget.src !== uptcLogo) e.currentTarget.src = uptcLogo;
                        }}
                      />
                    </div>
                    <div className="w-20 sm:w-24 flex items-center justify-end">
                      {instSettings.logo_facultad ? (
                        <img src={instSettings.logo_facultad} alt="Logo Facultad" className="h-9 sm:h-11 w-auto object-contain" />
                      ) : (
                        <div className="h-9 sm:h-11 w-10"></div>
                      )}
                    </div>
                  </div>
                  <div className="text-center px-2">
                    <h2 className="font-serif text-xs sm:text-sm font-bold tracking-wider uppercase leading-snug" style={{ color: "#0f172a" }}>
                      {(instSettings.name || instSettings.nombre || "UNIVERSIDAD PEDAGÓGICA Y TECNOLÓGICA DE COLOMBIA").toUpperCase()}
                    </h2>
                    <p className="font-serif italic text-xs sm:text-sm mt-0.5" style={{ color: "#334155" }}>
                      {instSettings.faculty || instSettings.facultad || "Facultad de Ciencias de la Salud"}
                    </p>
                  </div>
                  <div className="w-3/5 mx-auto h-[1px] bg-gradient-to-r from-transparent via-amber-600/60 to-transparent mt-2.5"></div>
                </div>

                {/* Contenido Central */}
                <div className="flex-1 flex flex-col justify-center space-y-4 my-auto relative z-10 py-2">
                  <div className="text-center">
                    <p className="font-serif text-xs sm:text-sm" style={{ color: "#1e293b" }}>
                      {(() => {
                        const rawCareer = student.carrera || "";
                        const cleanCareer = rawCareer
                          .replace(/^programa\s+(de\s+)?/i, "")
                          .replace(/["“”'«»]/g, "")
                          .trim();
                        return cleanCareer
                          ? `Informa que el(la) estudiante del programa ${cleanCareer}:`
                          : "Informa que el(la) estudiante:";
                      })()}
                    </p>
                  </div>

                  <div className="text-center">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-black tracking-wide font-sans uppercase" style={{ color: "#020617" }}>
                      {student.nombre}
                    </h3>
                    <p className="text-[11px] sm:text-xs font-bold mt-1" style={{ color: "#334155" }}>
                      C.C. {student.cedula}
                    </p>
                  </div>

                  <div className="text-center px-4 sm:px-8 leading-relaxed font-serif text-[11px] sm:text-[12.5px]" style={{ color: "#1e293b" }}>
                    Cumplió con éxito la práctica realizada en el(la){" "}
                    <span className="font-bold" style={{ color: "#020617" }}>
                      {previewCert.institution}
                    </span>{" "}
                    en el servicio de{" "}
                    <span className="font-bold" style={{ color: "#020617" }}>
                      {previewCert.service || previewCert.practice}
                    </span>{" "}
                    con una intensidad horaria de{" "}
                    <span className="font-bold" style={{ color: "#020617" }}>
                      {previewCert.hours} horas
                    </span>{" "}
                    iniciando el{" "}
                    <span className="font-bold" style={{ color: "#020617" }}>
                      {formatDateEs(previewCert.startDate, "01 de febrero de 2026")}
                    </span>{" "}
                    y finalizando el{" "}
                    <span className="font-bold" style={{ color: "#020617" }}>
                      {formatDateEs(previewCert.endDate, "30 de mayo de 2026")}
                    </span>{" "}
                    del periodo{" "}
                    <span className="font-bold" style={{ color: "#020617" }}>
                      {previewCert.period || "2026-2"}
                    </span>.
                  </div>

                  <div className="text-center pt-1">
                    <span className="text-xs sm:text-sm font-bold font-serif" style={{ color: "#0f172a" }}>
                      Nota ({formatGrade(previewCert.grade || previewCert.calificacion)})
                    </span>
                  </div>

                  <div className="text-center">
                    <p className="font-serif italic text-xs sm:text-sm" style={{ color: "#334155" }}>
                      Tunja, {new Date(previewCert.issueDate || Date.now()).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Firma Oficial Centrada */}
                <div className="relative z-10 pt-2 pb-1 flex flex-col items-center text-center">
                  {(previewCert.signatureImage || (typeof window !== "undefined" && localStorage.getItem("uptc_cert_signature"))) ? (
                    <div className="h-12 sm:h-14 flex items-center justify-center -mb-1">
                      <img
                        src={previewCert.signatureImage || (typeof window !== "undefined" && localStorage.getItem("uptc_cert_signature"))}
                        alt="Firma Oficial"
                        className="h-10 sm:h-12 max-w-[180px] object-contain"
                      />
                    </div>
                  ) : (
                    <svg className="w-36 sm:w-44 h-11 -mb-2" viewBox="0 0 160 50" fill="none" style={{ color: "#1e293b" }}>
                      <path
                        d="M15 35 C 30 10, 45 45, 60 20 C 70 5, 80 40, 95 25 C 110 15, 125 35, 145 28 M40 30 Q 75 10, 110 32 M65 25 L 85 40"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  <div className="w-48 sm:w-56 h-[1.5px] mx-auto mb-1.5" style={{ backgroundColor: "#64748b" }}></div>
                  <p className="text-xs sm:text-sm font-bold leading-tight" style={{ color: "#0f172a" }}>
                    {previewCert.directorName || DEFAULT_DIRECTOR}
                  </p>
                  <p className="text-[10px] sm:text-xs leading-tight mt-0.5" style={{ color: "#475569" }}>
                    {previewCert.directorRole || "Coordinador(a) de Práctica"}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 mt-6">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Documento oficial válido según reglamentación de la Facultad de Ciencias de la Salud UPTC.
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPreviewCert(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => handleDownloadCertificate(previewCert)}
                  className="inline-flex items-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Diploma PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentCertifications;