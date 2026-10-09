// ============================================================
// AdminReports.js — Panel de Reportes Generales y Constancias UPTC
// 1. Constancias de Práctica Formativa Vigente / En Curso (PDF Oficial)
// 2. Monitoreo de Estudiantes Activos (Prácticas en curso y acumuladas)
// 3. Monitoreo de Docentes Activos (Estudiantes a cargo y prácticas tuteladas)
// 4. Reportes y Listados Masivos (Excel, CSV, PDF, RTF)
// ============================================================
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  generateCsv,
  generateXls,
  generatePdf,
  generateRtf,
  generateConstanciaPracticaVigente,
} from "../../utils/reportGenerator";
import { BACKEND_URL } from "../../config/api";
import { useDataSync } from "../../utils/dataSync";
import { useAuth } from "../../utils/useAuth";
import toast from "../../utils/toast";
import {
  ClipboardList,
  GraduationCap,
  UserCheck,
  Building2,
  Clock,
  FileText,
  FileSpreadsheet,
  Search,
  Settings,
  PenTool,
  Trash2,
  Camera,
  Printer,
  Package,
  Eye,
  Info,
  Lock,
  User,
  Loader2,
  Stethoscope,
  Star
} from "lucide-react";
import uptcLogo from "../../assets/images/uptc.png";
import facultyLogo from "../../assets/images/logooo.png";

const API_BASE_URL = BACKEND_URL;

const AdminReports = () => {
  const { user } = useAuth();

  // Obtener rol y datos del usuario de forma inmediata (síncrona) desde storage si useAuth() aún no los tiene
  const getUserContext = useCallback(() => {
    let role = user?.role || user?.rol || null;
    let cedula = user?.cedula || user?.id || null;
    let name = user?.name || user?.nombre || "";

    try {
      if (!role) {
        role = localStorage.getItem("userRole") || sessionStorage.getItem("userRole");
      }
      if (!cedula || !role) {
        const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!cedula) cedula = parsed.cedula || parsed.Cédula || parsed.id || null;
          if (!role) role = parsed.role || parsed.rol || null;
          if (!name) name = `${parsed.nombre || ""} ${parsed.apellidos || ""}`.trim();
        }
      }
    } catch (e) {
      console.warn("No se pudo leer la sesión:", e);
    }

    const normalizedRole = (role || "").toLowerCase();
    const isDoc = normalizedRole.includes("docen");

    return {
      role: normalizedRole,
      cedula: cedula ? String(cedula) : null,
      name,
      isDocent: isDoc,
    };
  }, [user]);

  const { isDocent } = getUserContext();

  // Pestaña activa: "constancias" | "estudiantes" | "docentes" | "reportesGenerales"
  const [activeTab, setActiveTab] = useState("constancias");

  // Datos principales del sistema
  const [practices, setPractices] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Estados para Generador de Constancias de Práctica Vigente ──
  const [selectedPracticeId, setSelectedPracticeId] = useState(null);
  const [selectedStudentCedula, setSelectedStudentCedula] = useState(null);
  const [catalogFilterStatus, setCatalogFilterStatus] = useState("all");
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [issueDate, setIssueDate] = useState(() => {
    const today = new Date();
    const meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    return `Tunja, ${today.getDate()} de ${meses[today.getMonth()]} de ${today.getFullYear()}`;
  });

  const [instSettings, setInstSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("institutionSettings")) || {};
    } catch (e) {
      return {};
    }
  });

  const [directorName, setDirectorName] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("institutionSettings")) || {};
      return s.director_nombre || s.representante || "Dirección de Escuela";
    } catch {
      return "Dirección de Escuela";
    }
  });
  const [directorRole, setDirectorRole] = useState("Director(a) de Escuela");

  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const s = JSON.parse(localStorage.getItem("institutionSettings")) || {};
        setInstSettings(s);
        if (s.director_nombre || s.representante) {
          setDirectorName(s.director_nombre || s.representante);
        }
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
            if (data.director_nombre || data.representante) {
              setDirectorName((prev) => (prev === "?????" || prev === "Dirección de Escuela" ? (data.director_nombre || data.representante) : prev));
            }
          }
        }
      } catch (e) {}
    };
    fetchSettings();

    return () => window.removeEventListener("institutionSettingsUpdated", handleSettingsUpdate);
  }, []);

  // Fotos / Imágenes digitalizadas de las firmas oficiales (Director(a) y Docente)
  const [directorSignature, setDirectorSignature] = useState(
    () => localStorage.getItem("uptc_report_director_sig") || null
  );
  const [docentSignature, setDocentSignature] = useState(
    () => localStorage.getItem("uptc_report_docent_sig") || null
  );
  const directorSigInputRef = React.useRef(null);
  const docentSigInputRef = React.useRef(null);

  const handleDirectorSigUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen válida de firma (PNG, JPG, etc.).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      setDirectorSignature(data);
      try {
        localStorage.setItem("uptc_report_director_sig", data);
      } catch (err) {}
      toast.success("Foto de firma de Dirección adjuntada.");
    };
    reader.readAsDataURL(file);
  };

  const handleDocentSigUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen válida de firma (PNG, JPG, etc.).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      setDocentSignature(data);
      try {
        localStorage.setItem("uptc_report_docent_sig", data);
      } catch (err) {}
      toast.success("Foto de firma de Docente adjuntada.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDirectorSig = () => {
    setDirectorSignature(null);
    try {
      localStorage.removeItem("uptc_report_director_sig");
    } catch (err) {}
    if (directorSigInputRef.current) directorSigInputRef.current.value = "";
    toast.info("Firma de Dirección removida.");
  };

  const handleRemoveDocentSig = () => {
    setDocentSignature(null);
    try {
      localStorage.removeItem("uptc_report_docent_sig");
    } catch (err) {}
    if (docentSigInputRef.current) docentSigInputRef.current.value = "";
    toast.info("Firma de Docente removida.");
  };

  // Cargar automáticamente la firma digital del docente si está en sesión docente
  useEffect(() => {
    if (isDocent && !docentSignature) {
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");
      if (token) {
        fetch(`${BACKEND_URL}/api/docent/profile`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((d) => {
            if (d?.data?.foto_firma) {
              setDocentSignature(d.data.foto_firma);
            }
          })
          .catch(() => {});
      }
    }
  }, [isDocent, docentSignature]);

  // Filtros de búsqueda para las pestañas
  const [studentSearch, setStudentSearch] = useState("");
  const [docentSearch, setDocentSearch] = useState("");
  const [practiceSearch, setPracticeSearch] = useState("");

  // Estados para reportes generales clásicos
  const [generalReportType, setGeneralReportType] = useState("activeStudents");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ── Carga de Datos desde el Backend ──
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    const { isDocent: docFlag, cedula: docCedula } = getUserContext();

    const token =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      if (docFlag) {
        // Modo Docente: solo cargar sus prácticas asignadas, nunca llamar a endpoints de admin
        let endpoint = docCedula
          ? `${API_BASE_URL}/api/docent/practices/${docCedula}`
          : `${API_BASE_URL}/api/docent/practices`;

        let resPractices = await fetch(endpoint, { headers });
        if (!resPractices.ok) {
          resPractices = await fetch(`${API_BASE_URL}/api/docent/practices`, { headers });
        }

        if (resPractices.ok) {
          let practicesData = await resPractices.json();
          practicesData = (Array.isArray(practicesData) ? practicesData : []).filter(
            (p) => (p.estado || "").toLowerCase() !== "cancelada"
          );
          if (docCedula) {
            practicesData = practicesData.filter((p) => String(p.docente_cedula) === String(docCedula));
          }
          setPractices(practicesData);
        } else {
          console.error("Error al cargar prácticas docentes en reportes:", resPractices.status);
          toast.error("Error al cargar las prácticas asignadas.");
        }
        setUsers([]);
      } else {
        // Modo Administrador
        const [resPractices, resUsers] = await Promise.all([
          fetch(`${API_BASE_URL}/api/admin/practices`, { headers }),
          fetch(`${API_BASE_URL}/api/admin/users`, { headers }).catch(() => ({ ok: false })),
        ]);

        if (resPractices.ok) {
          let practicesData = await resPractices.json();
          practicesData = (Array.isArray(practicesData) ? practicesData : []).filter(
            (p) => (p.estado || "").toLowerCase() !== "cancelada"
          );
          setPractices(practicesData);
        } else {
          toast.error("Error al cargar el catálogo de prácticas.");
        }

        if (resUsers && resUsers.ok) {
          const usersData = await resUsers.json();
          setUsers(Array.isArray(usersData) ? usersData : []);
        }
      }
    } catch (err) {
      console.error("Error al cargar datos en el panel de reportes:", err);
      toast.error("Error de conexión al cargar datos del sistema.");
    } finally {
      setIsLoading(false);
    }
  }, [getUserContext]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useDataSync(fetchAllData);

  // Auto-selección si viene practiceId por query param
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const prId = params.get("practiceId");
      const stCed = params.get("studentCedula");
      if (prId && practices.length > 0 && !selectedPracticeId) {
        setSelectedPracticeId(prId);
        if (stCed) setSelectedStudentCedula(stCed);
      }
    } catch (e) {}
  }, [practices, selectedPracticeId]);

  // ── Prácticas Activas o en Curso ──
  const activePractices = useMemo(() => {
    return practices.filter((p) => {
      const st = (p.estado || "").toLowerCase();
      return st === "activa" || st === "en curso";
    });
  }, [practices]);

  // Práctica actualmente seleccionada en el diseñador de constancias
  const currentPractice = useMemo(() => {
    if (!selectedPracticeId) return null;
    return practices.find((p) => String(p.id) === String(selectedPracticeId)) || null;
  }, [practices, selectedPracticeId]);

  // Estudiante actualmente enfocado en la práctica seleccionada
  const currentStudent = useMemo(() => {
    if (!currentPractice || !currentPractice.estudiantes) return null;
    return (
      currentPractice.estudiantes.find((s) => String(s.cedula) === String(selectedStudentCedula)) ||
      currentPractice.estudiantes[0] ||
      null
    );
  }, [currentPractice, selectedStudentCedula]);

  // Horas cumplidas reales del estudiante seleccionado desde la base de datos
  const realStudentHours = useMemo(() => {
    if (!currentStudent) return 0;
    return currentStudent.horas_cumplidas !== undefined && currentStudent.horas_cumplidas !== null
      ? Number(currentStudent.horas_cumplidas)
      : 0;
  }, [currentStudent]);

  // Filtrado de prácticas para el catálogo inicial de selección
  const filteredCatalogPractices = useMemo(() => {
    return practices.filter((pr) => {
      const st = (pr.estado || "").toLowerCase();
      if (st === "cancelada") return false;
      if (catalogFilterStatus === "activas" && st !== "activa" && st !== "en curso") return false;
      if (catalogFilterStatus === "planificadas" && st !== "planificada") return false;
      if (catalogFilterStatus === "finalizadas" && st !== "finalizada" && st !== "concluida") return false;

      if (!catalogSearchTerm.trim()) return true;
      const term = catalogSearchTerm.toLowerCase();
      const matchTitle = (pr.titulo || pr.servicio_nombre || "").toLowerCase().includes(term);
      const matchInst = (pr.institucion_nombre || "").toLowerCase().includes(term);
      const matchDoc = (pr.docente_nombre || "").toLowerCase().includes(term);
      const matchAud = (pr.auditor_nombre || "").toLowerCase().includes(term);
      const matchProg = (pr.programa_nombre || "").toLowerCase().includes(term);
      return matchTitle || matchInst || matchDoc || matchAud || matchProg;
    });
  }, [practices, catalogFilterStatus, catalogSearchTerm]);

  // ── AGREGACIÓN 1: Estudiantes Activos en Curso ──
  // Identifica qué estudiantes tienen prácticas vigentes y cuántas tienen en curso
  const activeStudentsList = useMemo(() => {
    const studentMap = {};

    activePractices.forEach((pr) => {
      (pr.estudiantes || []).forEach((st) => {
        const ced = String(st.cedula);
        if (!studentMap[ced]) {
          studentMap[ced] = {
            cedula: ced,
            nombre_completo: st.nombre_completo,
            correo: st.correo,
            carrera: st.carrera || pr.programa_nombre || "Medicina",
            practicas: [],
            totalHorasAcumuladas: 0,
            totalHorasCumplidas: 0,
          };
        }

        const hAsignadas = st.horas_asignadas || pr.horas_totales || 120;
        const hCumplidas = st.horas_cumplidas || 0;

        studentMap[ced].practicas.push({
          practica_id: pr.id,
          titulo: pr.titulo || pr.servicio_nombre || "Práctica Formativa",
          servicio: pr.servicio_nombre || "Servicio Asistencial",
          institucion: pr.institucion_nombre || "Hospital Universitario San Rafael",
          docente: pr.docente_nombre || "Docente UPTC",
          periodo: pr.periodo || "2026-1",
          horas: pr.horas_totales || 120,
          horas_asignadas: hAsignadas,
          horas_cumplidas: hCumplidas,
          estado: pr.estado || "Activa",
        });

        studentMap[ced].totalHorasAcumuladas += hAsignadas;
        studentMap[ced].totalHorasCumplidas += hCumplidas;
      });
    });

    return Object.values(studentMap);
  }, [activePractices]);

  // Filtro de estudiantes activos
  const filteredActiveStudents = useMemo(() => {
    if (!studentSearch.trim()) return activeStudentsList;
    const term = studentSearch.toLowerCase();
    return activeStudentsList.filter(
      (st) =>
        st.nombre_completo.toLowerCase().includes(term) ||
        st.cedula.toLowerCase().includes(term) ||
        st.carrera.toLowerCase().includes(term)
    );
  }, [activeStudentsList, studentSearch]);

  // ── AGREGACIÓN 2: Docentes Activos y Carga Académica ──
  // Identifica los docentes activos, cuántos estudiantes tienen a su cargo y qué prácticas tutelan
  const activeDocentsList = useMemo(() => {
    const docentMap = {};

    activePractices.forEach((pr) => {
      const docCedula = pr.docente_cedula ? String(pr.docente_cedula) : pr.docente_nombre || "Docente General";
      if (!docentMap[docCedula]) {
        docentMap[docCedula] = {
          cedula: pr.docente_cedula ? String(pr.docente_cedula) : "N/A",
          nombre_completo: pr.docente_nombre || "Docente Clínico",
          correo: pr.docente_correo || "docente@uptc.edu.co",
          practicas: [],
          estudiantesSet: new Set(),
          totalHorasTutoradas: 0,
          institucionesSet: new Set(),
        };
      }

      docentMap[docCedula].practicas.push({
        id: pr.id,
        titulo: pr.titulo || pr.servicio_nombre || "Práctica Formativa",
        servicio: pr.servicio_nombre || "Servicio Clínico",
        institucion: pr.institucion_nombre || "Hospital San Rafael",
        periodo: pr.periodo || "2026-1",
        estudiantesCount: (pr.estudiantes || []).length,
      });

      if (pr.institucion_nombre) {
        docentMap[docCedula].institucionesSet.add(pr.institucion_nombre);
      }

      (pr.estudiantes || []).forEach((st) => {
        docentMap[docCedula].estudiantesSet.add(String(st.cedula));
      });

      docentMap[docCedula].totalHorasTutoradas += pr.horas_totales || 120;
    });

    return Object.values(docentMap).map((d) => ({
      ...d,
      totalEstudiantesACargo: d.estudiantesSet.size,
      instituciones: Array.from(d.institucionesSet),
      totalPracticas: d.practicas.length,
    }));
  }, [activePractices]);

  // Filtro de docentes activos
  const filteredActiveDocents = useMemo(() => {
    if (!docentSearch.trim()) return activeDocentsList;
    const term = docentSearch.toLowerCase();
    return activeDocentsList.filter(
      (d) =>
        d.nombre_completo.toLowerCase().includes(term) ||
        d.cedula.toLowerCase().includes(term) ||
        d.correo.toLowerCase().includes(term)
    );
  }, [activeDocentsList, docentSearch]);

  // ── KPIs Generales del Sistema ──
  const kpiData = useMemo(() => {
    const totalEstudiantesActivos = activeStudentsList.length;
    const totalDocentesActivos = activeDocentsList.length;
    const totalPracticasActivas = activePractices.length;
    const totalHorasEnEjecucion = activePractices.reduce(
      (acc, curr) => acc + (curr.horas_totales || 120),
      0
    );

    return {
      totalEstudiantesActivos,
      totalDocentesActivos,
      totalPracticasActivas,
      totalHorasEnEjecucion,
    };
  }, [activeStudentsList, activeDocentsList, activePractices]);

  // ── Verificación normativa de emisión de constancias / certificados ──
  const getPracticeEmissionStatus = useCallback((pr) => {
    if (!pr) return { allowed: false, reason: "none", buttonText: "Seleccionar", tooltip: "" };
    const estado = (pr.estado || "").trim().toLowerCase();
    if (estado === "cancelada") {
      return {
        allowed: false,
        reason: "cancelled",
        badgeText: "Cancelada",
        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800",
        buttonText: "Emisión Bloqueada (Cancelada)",
        tooltip: "La práctica formativa está cancelada. Por normativa institucional, no se pueden emitir certificados ni constancias de prácticas canceladas.",
      };
    }
    if (estado === "finalizada" || estado === "concluida") {
      if (pr.fecha_fin) {
        const endDate = new Date(pr.fecha_fin);
        const diffDays = Math.floor((Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 30) {
          return {
            allowed: false,
            reason: "expired",
            badgeText: `Finalizada (Plazo vencido: ${diffDays}d)`,
            badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800",
            buttonText: "Plazo Vencido (>30 días de finalizada)",
            tooltip: `La práctica finalizó hace ${diffDays} días. El plazo máximo de 30 días posteriores a la finalización para emitir constancias ha expirado.`,
          };
        } else {
          const remaining = 30 - diffDays;
          return {
            allowed: true,
            reason: "finished_valid",
            badgeText: `Finalizada (${remaining}d restantes)`,
            badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800",
            buttonText: "Gestionar y Emitir Constancias",
            tooltip: `Práctica finalizada dentro del plazo permitido para emitir constancias (quedan ${remaining} días).`,
          };
        }
      }
      return {
        allowed: true,
        reason: "finished_valid",
        badgeText: "Finalizada",
        badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800",
        buttonText: "Gestionar y Emitir Constancias",
        tooltip: "Práctica finalizada, habilitada para emisión de constancias.",
      };
    }
    if (estado === "planificada") {
      return {
        allowed: true,
        reason: "active",
        badgeText: "Planificada",
        badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        buttonText: "Gestionar y Emitir Constancias",
        tooltip: "Práctica en estado planificada.",
      };
    }
    return {
      allowed: true,
      reason: "active",
      badgeText: pr.estado || "Activa",
      badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
      buttonText: "Gestionar y Emitir Constancias",
      tooltip: "Práctica activa habilitada para emisión de constancias.",
    };
  }, []);

  // ── Emisión de Constancia Individual de Práctica Vigente ──
  const handleDownloadSingleConstancia = () => {
    if (!currentPractice || !currentStudent) {
      toast.warn("Por favor, selecciona una práctica activa y un estudiante.");
      return;
    }

    const checkStatus = getPracticeEmissionStatus(currentPractice);
    if (!checkStatus.allowed) {
      toast.error(checkStatus.tooltip);
      return;
    }

    if (isDocent && !docentSignature) {
      toast.warning(
        "Tienes que terminar de subir tus datos primero (foto de la firma en 'Datos Docente') para poder emitir constancias o reportes."
      );
      return;
    }

    try {
      generateConstanciaPracticaVigente({
        studentName: currentStudent.nombre_completo,
        studentCedula: currentStudent.cedula,
        studentCareer: currentStudent.carrera || currentPractice.programa_nombre || "Medicina",
        practiceProgram: currentPractice.programa_nombre || currentStudent.carrera || "Medicina",
        practiceName: currentPractice.titulo || currentPractice.servicio_nombre || "Práctica Formativa",
        serviceName: currentPractice.servicio_nombre || "",
        institutionName: currentPractice.institucion_nombre || "Hospital Universitario San Rafael de Tunja",
        docentName: currentPractice.docente_nombre || "Docente UPTC",
        auditorName: currentPractice.auditor_nombre || "Auditor(a) Asistencial",
        period: currentPractice.periodo || "2026-1",
        startDate: currentPractice.fecha_inicio || "Inicio del Periodo",
        endDate: currentPractice.fecha_fin || "Final del Periodo",
        totalHours: currentPractice.horas_totales || 120,
        accumulatedHours: realStudentHours,
        issueDate,
        directorName,
        directorRole,
        directorSignature,
        docentSignature,
        institutionSettings: instSettings,
      });

      // Registrar en el historial de certificados del backend de forma reactiva
      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken");
      fetch(`${API_BASE_URL}/api/history/certificates/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          estudiante_cedula: currentStudent.cedula,
          practica_id: currentPractice.id,
          tipo_certificado: "Constancia de Práctica Formativa Vigente / En Curso",
          categoria_solicitud: "constancia",
          motivo: "Constancia Oficial UPTC",
          horas_totales: currentPractice.horas_totales || 120,
          metadatos: { emitido_por: user?.name || "Administración" },
        }),
      }).catch(console.error);

      if (isDocent) {
        toast.success(
          `Constancia de "${currentStudent.nombre_completo}" generada y descargada para control docente (no notifica al estudiante).`
        );
      } else {
        toast.success(
          `Constancia oficial generada exitosamente para "${currentStudent.nombre_completo}".`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Ocurrió un error al generar la constancia en PDF.");
    }
  };

  // ── Emisión en Lote de Constancias de Todos los Estudiantes de la Práctica ──
  const handleDownloadBatchConstancias = () => {
    if (!currentPractice || !currentPractice.estudiantes || currentPractice.estudiantes.length === 0) {
      toast.warn("No hay estudiantes registrados en esta práctica para generar constancias.");
      return;
    }

    const checkStatus = getPracticeEmissionStatus(currentPractice);
    if (!checkStatus.allowed) {
      toast.error(checkStatus.tooltip);
      return;
    }

    if (isDocent && !docentSignature) {
      toast.warning(
        "Tienes que terminar de subir tus datos primero (foto de la firma en 'Datos Docente') para poder emitir constancias o reportes."
      );
      return;
    }

    if (!currentPractice || !currentPractice.estudiantes || currentPractice.estudiantes.length === 0) {
      toast.warn("No hay estudiantes registrados en esta práctica para generar constancias.");
      return;
    }

    let count = 0;
    currentPractice.estudiantes.forEach((st, idx) => {
      setTimeout(() => {
        const studentRealHours = st.horas_cumplidas !== undefined && st.horas_cumplidas !== null
          ? Number(st.horas_cumplidas)
          : 0;

        generateConstanciaPracticaVigente({
          studentName: st.nombre_completo,
          studentCedula: st.cedula,
          studentCareer: st.carrera || currentPractice.programa_nombre || "Medicina",
          practiceProgram: currentPractice.programa_nombre || st.carrera || "Medicina",
          practiceName: currentPractice.titulo || currentPractice.servicio_nombre || "Práctica Formativa",
          serviceName: currentPractice.servicio_nombre || "",
          institutionName: currentPractice.institucion_nombre || "Hospital Universitario San Rafael de Tunja",
          docentName: currentPractice.docente_nombre || "Docente UPTC",
          auditorName: currentPractice.auditor_nombre || "Auditor(a) Asistencial",
          period: currentPractice.periodo || "2026-1",
          startDate: currentPractice.fecha_inicio || "Inicio del Periodo",
          endDate: currentPractice.fecha_fin || "Final del Periodo",
          totalHours: currentPractice.horas_totales || 120,
          accumulatedHours: studentRealHours,
          issueDate,
          directorName,
          directorRole,
          directorSignature,
          docentSignature,
          institutionSettings: instSettings,
        });
      }, idx * 600);
      count++;
    });

    toast.success(`Generando ${count} constancias oficiales en lote.`);
  };

  // Acción rápida para emitir constancia a un estudiante desde la lista de estudiantes activos
  const handleSelectStudentForConstancia = (stCedula, prId) => {
    setSelectedPracticeId(prId);
    setSelectedStudentCedula(stCedula);
    setActiveTab("constancias");
    toast.info("Práctica y estudiante seleccionados para emitir su constancia oficial.");
  };

  // ── Exportaciones de Reportes Generales (Excel, CSV, PDF, RTF) ──
  const handleExportGeneralReport = (format) => {
    let dataToExport = [];
    let filenamePrefix = "";

    switch (generalReportType) {
      case "activeStudents":
        dataToExport = activeStudentsList.map((s) => ({
          "Cédula": s.cedula,
          "Nombre Completo": s.nombre_completo,
          "Programa": s.carrera,
          "Prácticas en Curso": s.practicas.length,
          "Institución Actual": s.practicas[0]?.institucion || "N/A",
          "Servicio Clínico": s.practicas[0]?.servicio || "N/A",
          "Docente": s.practicas[0]?.docente || "N/A",
          "Horas Acumuladas": s.totalHorasAcumuladas,
        }));
        filenamePrefix = "Estudiantes_Activos_Practicas";
        break;

      case "activeDocents":
        dataToExport = activeDocentsList.map((d) => ({
          "Cédula": d.cedula,
          "Docente": d.nombre_completo,
          "Correo": d.correo,
          "Estudiantes a Cargo": d.totalEstudiantesACargo,
          "Prácticas Activas": d.totalPracticas,
          "Instituciones": d.instituciones.join(", "),
        }));
        filenamePrefix = "Docentes_Activos_Carga_Academica";
        break;

      case "practicesCatalog":
        dataToExport = practices.map((pr) => ({
          "ID": pr.id,
          "Título / Servicio": pr.servicio_nombre || pr.titulo,
          "Institución": pr.institucion_nombre,
          "Docente": pr.docente_nombre,
          "Periodo": pr.periodo,
          "Estado": pr.estado,
          "Estudiantes": (pr.estudiantes || []).length,
          "Horas Totales": pr.horas_totales,
        }));
        filenamePrefix = "Catalogo_Practicas_UPTC";
        break;

      default:
        toast.warn("Selecciona un tipo de reporte válido.");
        return;
    }

    if (dataToExport.length === 0) {
      toast.warn("No hay datos disponibles para exportar este reporte.");
      return;
    }

    const filename = `${filenamePrefix}_${new Date().toISOString().split("T")[0]}.${format}`;

    switch (format) {
      case "csv":
        generateCsv(dataToExport, filename);
        break;
      case "xls":
        generateXls(dataToExport, filename);
        break;
      case "pdf":
        generatePdf(dataToExport, filename);
        break;
      case "rtf":
        generateRtf(dataToExport, filename);
        break;
      default:
        toast.error("Formato no compatible.");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-colors space-y-6">

      {/* ── Encabezado Principal ── */}
      <div className="p-6 sm:p-8 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                {isDocent ? "Reportes y Constancias de Mis Prácticas" : "Reportes y Constancias Institucionales"}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-1 max-w-3xl">
              {isDocent
                ? "Emisión y personalización de constancias oficiales de práctica vigente en PDF para los estudiantes de tus rotaciones a cargo, seguimiento de horas cumplidas y generación de listados."
                : "Emisión de constancias oficiales de práctica vigente en PDF (para certificar rotación activa, horas realizadas y sede clínica), seguimiento de estudiantes activos, docentes tutores con estudiantes a cargo y descargas generales."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              UPTC Facultad de Ciencias de la Salud
            </span>
          </div>
        </div>
      </div>

      {/* ── Tarjetas de Indicadores Rápidos (KPIs) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Estudiantes Activos
            </p>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">
              {kpiData.totalEstudiantesActivos}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              {isDocent ? "Mis Prácticas" : "Docentes con Asignación"}
            </p>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">
              {isDocent ? practices.length : kpiData.totalDocentesActivos}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Prácticas en Curso
            </p>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">
              {kpiData.totalPracticasActivas}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Horas en Ejecución
            </p>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">
              {kpiData.totalHorasEnEjecucion} hrs
            </h3>
          </div>
        </div>
      </div>

      {/* ── Banner Informativo Docente ── */}
      {isDocent && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Generación de Constancias y Reportes para Uso Docente
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 leading-relaxed">
              Como docente vinculado, puedes emitir, visualizar e imprimir constancias de asistencia y reportes de tus prácticas asignadas en cualquier momento para tu control docente. <strong>Esta acción no envía notificaciones ni altera las solicitudes de los estudiantes</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ── Navegación de Pestañas (Tabs) ── */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 space-x-1 sm:space-x-4 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("constancias")}
          className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "constancias"
              ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
              : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Constancia de Práctica Vigente (PDF)</span>
        </button>

        <button
          onClick={() => setActiveTab("estudiantes")}
          className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "estudiantes"
              ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
              : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Estudiantes Activos en Curso ({activeStudentsList.length})</span>
        </button>

        {!isDocent && (
          <button
            onClick={() => setActiveTab("docentes")}
            className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "docentes"
                ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
                : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Docentes Activos y Carga ({activeDocentsList.length})</span>
          </button>
        )}

      </div>

      {/* ============================================================
          PESTAÑA 1: GENERADOR DE CONSTANCIAS DE PRÁCTICA VIGENTE EN PDF
          - Selección previa de práctica formativa en catálogo de tarjetas
          - Parámetros institucionales con horas reales del estudiante
          - Previsualización fiel 1:1 idéntica a la descarga en PDF
          ============================================================ */}
      {activeTab === "constancias" && (
        <>
          {/* VISTA 1: CATÁLOGO DE TARJETAS DE PRÁCTICAS SI NO HAY UNA SELECCIONADA */}
          {!selectedPracticeId ? (
            <div className="space-y-6">
              {/* Barra superior de encabezado, búsqueda y filtros */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border border-gray-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span>Selecciona una Práctica para Generar Constancias</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Elige una práctica para emitir las constancias de rotación activa con información real de sus estudiantes.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={catalogSearchTerm}
                      onChange={(e) => setCatalogSearchTerm(e.target.value)}
                      placeholder="Buscar práctica, tutor, sede..."
                      className="w-full sm:w-64 pl-8 pr-3.5 py-2 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setCatalogFilterStatus("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        catalogFilterStatus === "all"
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      Todas ({practices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogFilterStatus("activas")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        catalogFilterStatus === "activas"
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      Activas ({activePractices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogFilterStatus("planificadas")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        catalogFilterStatus === "planificadas"
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      Planificadas ({practices.filter((p) => (p.estado || "").toLowerCase() === "planificada").length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid de Tarjetas de Prácticas */}
              {isLoading ? (
                <div className="p-12 text-center text-gray-500 dark:text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="font-semibold text-sm">Cargando catálogo de prácticas formativas...</p>
                </div>
              ) : filteredCatalogPractices.length === 0 ? (
                <div className="p-12 border border-dashed border-gray-300 dark:border-zinc-800 rounded-3xl text-center bg-white dark:bg-zinc-900/50">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mt-3">
                    No se encontraron prácticas con los filtros seleccionados
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    Prueba modificando el término de búsqueda o selecciona otro filtro de estado.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCatalogPractices.map((pr) => {
                    const emissionStatus = getPracticeEmissionStatus(pr);
                    const totalStudents = (pr.estudiantes || []).length;
                    const evaluatedCount = (pr.estudiantes || []).filter(
                      (s) => s.calificacion !== null && s.calificacion !== undefined
                    ).length;

                    return (
                      <div
                        key={pr.id}
                        className={`p-6 border rounded-3xl shadow-md hover:shadow-xl transition-all flex flex-col justify-between group ${
                          !emissionStatus.allowed && emissionStatus.reason === "cancelled"
                            ? "bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40"
                            : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
                        }`}
                      >
                        <div>
                          {/* Estado y Periodo */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${emissionStatus.badgeClass}`}
                            >
                              {emissionStatus.badgeText}
                            </span>
                            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">
                              Periodo {pr.periodo || "2026-1"}
                            </span>
                          </div>

                          {/* Título Oficial Real de la Práctica */}
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors leading-snug">
                            {pr.titulo || pr.servicio_nombre || `Práctica #${pr.id}`}
                          </h3>
                          {pr.servicio_nombre && pr.servicio_nombre !== pr.titulo && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5 inline-flex items-center gap-1">
                              <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                              <span>Servicio: {pr.servicio_nombre}</span>
                            </p>
                          )}

                          {/* Institución / Hospital */}
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 font-medium flex items-center gap-1.5 mt-2">
                            <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <span>{pr.institucion_nombre || "Hospital Universitario"}</span>
                          </p>

                          {/* Docente */}
                          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-gray-500" />
                              Tutor:
                            </span>
                            <span className="font-semibold text-gray-700 dark:text-zinc-200">
                              {pr.docente_nombre || "Docente UPTC"}
                            </span>
                          </p>

                          {/* Auditor */}
                          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1">
                              <Search className="w-3.5 h-3.5 text-gray-500" />
                              Auditor:
                            </span>
                            <span className="text-gray-700 dark:text-zinc-300">
                              {pr.auditor_nombre || "Sin auditor asignado"}
                            </span>
                          </p>

                          {/* Horas Totales y Programa */}
                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-gray-500" />
                              {pr.horas_totales || 120} horas de práctica
                            </span>
                            <span className="font-bold text-slate-800 dark:text-zinc-200">
                              {pr.programa_nombre || "Enfermería"}
                            </span>
                          </div>
                        </div>

                        {/* Footer de la tarjeta con Estudiantes y Botón de emisión */}
                        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
                          <div className="flex items-center justify-between mb-3 text-xs">
                            <span className="font-bold text-gray-700 dark:text-zinc-300 inline-flex items-center gap-1">
                              <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              {totalStudents} Estudiantes
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                              <Star className="w-3.5 h-3.5" />
                              {evaluatedCount} con notas
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={!emissionStatus.allowed}
                            onClick={() => {
                              if (!emissionStatus.allowed) {
                                toast.warning(emissionStatus.tooltip);
                                return;
                              }
                              setSelectedPracticeId(pr.id);
                              if (pr.estudiantes && pr.estudiantes.length > 0) {
                                setSelectedStudentCedula(pr.estudiantes[0].cedula);
                              } else {
                                setSelectedStudentCedula(null);
                              }
                            }}
                            className={`w-full py-2.5 px-4 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm ${
                              !emissionStatus.allowed
                                ? "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed shadow-none border border-gray-200 dark:border-zinc-700"
                                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white cursor-pointer active:scale-95"
                            }`}
                            title={emissionStatus.tooltip}
                          >
                            <ClipboardList className="w-4 h-4" />
                            <span>{emissionStatus.buttonText}</span>
                            {emissionStatus.allowed && <span>→</span>}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* VISTA 2: DENTRO DE LA PRÁCTICA SELECCIONADA: FORMULARIO Y PREVISUALIZACIÓN */
            <div className="space-y-4">
              {/* Barra de cabecera con botón de retorno al catálogo de prácticas */}
              <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm">
                <button
                  type="button"
                  onClick={() => setSelectedPracticeId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>←</span>
                  <span>Volver a Selección de Prácticas</span>
                </button>
                <div className="text-right">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {currentPractice?.titulo || currentPractice?.servicio_nombre}
                  </h3>
                  {currentPractice?.servicio_nombre && currentPractice.servicio_nombre !== currentPractice.titulo && (
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-1 justify-end">
                      <Stethoscope className="w-3 h-3" />
                      <span>Servicio: {currentPractice.servicio_nombre}</span>
                    </span>
                  )}
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {currentPractice?.institucion_nombre} · Periodo {currentPractice?.periodo}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ─── Columna Izquierda: Controles y Selección de Estudiante ─── */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-5 border border-gray-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Parámetros de la Constancia</span>
                    </h3>

                    {/* Detalles clave de la práctica elegida */}
                    {currentPractice && (
                      <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-[11px] space-y-1 text-gray-700 dark:text-zinc-300">
                        <p>
                          <strong className="text-gray-900 dark:text-white">Hospital Sede:</strong>{" "}
                          {currentPractice.institucion_nombre || "Hospital Universitario"}
                        </p>
                        <p>
                          <strong className="text-gray-900 dark:text-white">Docente:</strong>{" "}
                          {currentPractice.docente_nombre || "Docente UPTC"}
                        </p>
                        <p>
                          <strong className="text-gray-900 dark:text-white">Horas Totales Programadas:</strong>{" "}
                          {currentPractice.horas_totales || 120} horas · Periodo: {currentPractice.periodo}
                        </p>
                      </div>
                    )}

                    {/* Selector de Estudiante dentro de la práctica */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                        Estudiantes Inscritos en esta Práctica ({currentPractice?.estudiantes?.length || 0})
                      </label>
                      {!currentPractice?.estudiantes || currentPractice.estudiantes.length === 0 ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400 italic p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                          Esta práctica no tiene estudiantes vinculados actualmente.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {currentPractice.estudiantes.map((st) => {
                            const isFocused = String(st.cedula) === String(selectedStudentCedula);
                            return (
                              <div
                                key={st.cedula}
                                onClick={() => setSelectedStudentCedula(st.cedula)}
                                className={`p-2 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                  isFocused
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-900 dark:text-blue-200 shadow-sm ring-1 ring-blue-400"
                                    : "border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-300"
                                }`}
                              >
                                <div>
                                  <p className="font-bold">{st.nombre_completo}</p>
                                  <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                                    C.C. {st.cedula} · {st.carrera || currentPractice.programa_nombre}
                                  </p>
                                </div>
                                {isFocused && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white">
                                    Seleccionado
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Información Real de Horas del Estudiante (Sin input manual) */}
                    <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs">
                      <span className="block text-[11px] font-semibold text-gray-600 dark:text-zinc-400 mb-0.5">
                        Horas Realizadas Registradas (Información Real):
                      </span>
                      <span className="text-xs sm:text-sm font-black text-blue-700 dark:text-blue-300">
                        {realStudentHours} Horas Ejecutadas / {currentPractice?.horas_totales || 120} Horas Programadas
                      </span>
                    </div>

                    {/* Fecha y Firmantes */}
                    <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-2.5 text-xs">
                      <div>
                        <label className="block font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                          Fecha de Expedición
                        </label>
                        <input
                          type="text"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                            Director(a) de Escuela
                          </label>
                          <input
                            type="text"
                            value={directorName}
                            onChange={(e) => setDirectorName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                            Cargo Oficial Firma
                          </label>
                          <input
                            type="text"
                            value={directorRole}
                            onChange={(e) => setDirectorRole(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Panel para adjuntar foto de los firmantes */}
                    <div className="p-3.5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <PenTool className="w-4 h-4 text-gray-700 dark:text-zinc-300" />
                          <span>Fotos de Firmas de los Firmantes</span>
                        </label>
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500">PNG / JPG</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Firma 1: Director(a) de Escuela */}
                        <div className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex flex-col justify-between">
                          <div>
                            <p className="text-[11px] font-bold text-gray-800 dark:text-zinc-200 truncate">
                              {directorName || "Director(a)"}
                            </p>
                            <p className="text-[9.5px] text-gray-500 dark:text-zinc-400 mb-2 truncate">
                              {directorRole || "Director(a) de Escuela"}
                            </p>
                          </div>

                          {directorSignature ? (
                            <div className="space-y-1.5">
                              <div className="h-12 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-emerald-300 dark:border-emerald-700 p-1 flex items-center justify-center">
                                <img
                                  src={directorSignature}
                                  alt="Firma Director"
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleRemoveDirectorSig}
                                className="w-full py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Quitar Firma</span>
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                ref={directorSigInputRef}
                                onChange={handleDirectorSigUpload}
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => directorSigInputRef.current?.click()}
                                className="w-full py-2 px-2 border border-dashed border-gray-300 dark:border-zinc-700 hover:border-blue-500 rounded-lg text-[10px] font-bold text-gray-600 dark:text-zinc-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1 cursor-pointer bg-gray-50 dark:bg-zinc-800/60"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Adjuntar Foto Firma</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Firma 2: Docente */}
                        <div className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex flex-col justify-between">
                          <div>
                            <p className="text-[11px] font-bold text-gray-800 dark:text-zinc-200 truncate">
                              {currentPractice?.docente_nombre || "Docente"}
                            </p>
                            <p className="text-[9.5px] text-gray-500 dark:text-zinc-400 mb-2 truncate">
                              Docente
                            </p>
                          </div>

                          {docentSignature ? (
                            <div className="space-y-1.5">
                              <div className="h-12 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-emerald-300 dark:border-emerald-700 p-1 flex items-center justify-center">
                                <img
                                  src={docentSignature}
                                  alt="Firma Docente"
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleRemoveDocentSig}
                                className="w-full py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Quitar Firma</span>
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                ref={docentSigInputRef}
                                onChange={handleDocentSigUpload}
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => docentSigInputRef.current?.click()}
                                className="w-full py-2 px-2 border border-dashed border-gray-300 dark:border-zinc-700 hover:border-blue-500 rounded-lg text-[10px] font-bold text-gray-600 dark:text-zinc-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-1 cursor-pointer bg-gray-50 dark:bg-zinc-800/60"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Adjuntar Foto Firma</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botones de Emisión y Descarga */}
                    <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 space-y-2">
                      <button
                        type="button"
                        onClick={handleDownloadSingleConstancia}
                        disabled={!currentStudent}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-xs sm:text-sm"
                      >
                        <Printer className="w-4 h-4" />
                        <span>
                          {isDocent
                            ? "Imprimir / Descargar Constancia (Copia Docente)"
                            : `Descargar Constancia PDF de ${currentStudent?.nombre_completo?.split(" ")[0] || "Estudiante"}`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadBatchConstancias}
                        disabled={!currentPractice?.estudiantes || currentPractice.estudiantes.length === 0}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-xs"
                      >
                        <Package className="w-4 h-4" />
                        <span>
                          {isDocent
                            ? "Descargar Constancias de Toda la Práctica (Lote Docente)"
                            : "Emitir Constancias de Toda la Práctica (Lote)"}
                        </span>
                      </button>

                      {isDocent && (
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400 text-center mt-1 inline-flex items-center justify-center gap-1 w-full">
                          <Lock className="w-3 h-3 text-gray-400" />
                          <span>Descarga para control docente (no notifica a los estudiantes).</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── Columna Derecha: Vista Previa en Vivo de la Constancia en Hoja Blanca ─── */}
                <div className="lg:col-span-7">
                  <div className="p-6 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-zinc-800">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Vista Previa de la Constancia Oficial</span>
                      </h3>
                      <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                        Estudiante: {currentStudent?.nombre_completo || "Seleccione Estudiante"}
                      </span>
                    </div>

                    {/* HOJA DE LA CONSTANCIA EN PANTALLA: SIEMPRE BLANCA Y VERTICAL (A4) */}
                    <div
                      className="relative w-full aspect-[210/297] p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-300 select-none overflow-hidden flex flex-col justify-between"
                      style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                    >
                      {/* Franja superior dorada UPTC */}
                      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 border-b border-amber-700"></div>

                      {/* Membrete Oficial */}
                      <div>
                        <div className="flex items-center justify-between mt-1 mb-2">
                          <img
                            src={instSettings.logo_institucion || instSettings.logoPreview || instSettings.logo_url || uptcLogo}
                            alt="Logo Institución"
                            className="h-8 sm:h-9 w-auto object-contain"
                            onError={(e) => {
                              if (e.currentTarget.src !== uptcLogo) e.currentTarget.src = uptcLogo;
                            }}
                          />
                          {instSettings.logo_facultad ? (
                            <img
                              src={instSettings.logo_facultad}
                              alt="Logo Facultad"
                              className="h-9 sm:h-10 w-auto object-contain"
                            />
                          ) : (
                            <img
                              src={facultyLogo}
                              alt="Facultad Ciencias de la Salud"
                              className="h-10 sm:h-11 w-auto object-contain"
                            />
                          )}
                        </div>

                        <div className="text-center border-b border-slate-200 pb-2">
                          <h4 className="font-bold text-[10px] sm:text-xs text-slate-900 uppercase tracking-wide">
                            {instSettings.name || instSettings.nombre || "Universidad Pedagógica y Tecnológica de Colombia"}
                          </h4>
                          <p className="font-bold text-[9px] sm:text-[10.5px] text-slate-700">
                            {instSettings.faculty || instSettings.facultad || "Facultad de Ciencias de la Salud"}
                          </p>
                          <p className="text-[8px] sm:text-[9px] text-slate-500 italic">
                            Programa de {(() => {
                              const raw = currentPractice?.programa_nombre || currentStudent?.carrera || "Medicina";
                              return raw.replace(/^programa\s+(de\s+)?/i, "").trim();
                            })()}
                          </p>
                        </div>
                      </div>

                      {/* Título Principal y Badge de Estado (Sin Radicado) */}
                      <div className="space-y-1.5 my-1">
                        <div className="text-center">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 uppercase">
                            CONSTANCIA DE PRÁCTICA FORMATIVA VIGENTE
                          </h3>
                          <span className="inline-block px-3 py-0.5 rounded-full text-[8.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 mt-1">
                            ESTADO: VIGENTE / EN CURSO
                          </span>
                        </div>
                      </div>

                      {/* Texto Certificatorio */}
                      <div className="space-y-2 text-[9px] sm:text-[10px] text-slate-700 leading-relaxed">
                        <p>
                          La Dirección del programa de {(() => {
                            const raw = currentPractice?.programa_nombre || currentStudent?.carrera || "Medicina";
                            return raw.replace(/^programa\s+(de\s+)?/i, "").trim();
                          })()} de la {instSettings.faculty || instSettings.facultad || "Facultad de Ciencias de la Salud"} de la {instSettings.name || instSettings.nombre || "Universidad Pedagógica y Tecnológica de Colombia (UPTC)"}, hace constar que el(la) estudiante:
                        </p>

                        {/* Recuadro Estudiante */}
                        <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="font-black text-xs sm:text-sm text-slate-900">
                            {currentStudent?.nombre_completo || "NOMBRE DEL ESTUDIANTE"}
                          </p>
                          <p className="text-[8.5px] sm:text-[9px] text-slate-600 mt-0.5">
                            C.C. {currentStudent?.cedula || "00000000"}
                          </p>
                        </div>

                        <p>
                          Se encuentra formalmente vinculado(a) y en desarrollo activo de su rotación académica en la siguiente práctica formativa supervisada:
                        </p>

                        {/* Tabla de Datos de la Práctica (7 Parámetros Idénticos a la Constancia) */}
                        <div className="rounded-lg border border-slate-200 overflow-hidden text-[8px] sm:text-[9px]">
                          <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100/70 p-1 font-bold">
                            <span className="col-span-5 text-slate-600">Parámetro</span>
                            <span className="col-span-7 text-slate-900">Detalle de la Rotación</span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-slate-200 p-1">
                            <span className="col-span-5 font-semibold text-slate-600">Práctica / Asignatura:</span>
                            <span className="col-span-7 font-bold text-slate-900">
                              {currentPractice?.titulo || currentPractice?.servicio_nombre || "Práctica Formativa"}
                            </span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-slate-200 p-1 bg-slate-50/50">
                            <span className="col-span-5 font-semibold text-slate-600">Institución / IPS:</span>
                            <span className="col-span-7 text-slate-900">
                              {currentPractice?.institucion_nombre || "Hospital Universitario"}
                            </span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-slate-200 p-1">
                            <span className="col-span-5 font-semibold text-slate-600">Docente:</span>
                            <span className="col-span-7 text-slate-900">
                              {currentPractice?.docente_nombre || "Docente UPTC"}
                            </span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-slate-200 p-1 bg-slate-50/50">
                            <span className="col-span-5 font-semibold text-slate-600">Periodo Académico:</span>
                            <span className="col-span-7 text-slate-900">
                              {currentPractice?.periodo || "2026-1"}
                            </span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-slate-200 p-1">
                            <span className="col-span-5 font-semibold text-slate-600">Horas Totales Programadas:</span>
                            <span className="col-span-7 font-bold text-slate-900">
                              {currentPractice?.horas_totales || 120} Horas
                            </span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-slate-200 p-1 bg-slate-50/50">
                            <span className="col-span-5 font-semibold text-slate-600">Horas Realizadas a la Fecha:</span>
                            <span className="col-span-7 font-black text-blue-700">
                              {realStudentHours} Horas Ejecutadas
                            </span>
                          </div>
                          <div className="grid grid-cols-12 p-1">
                            <span className="col-span-5 font-semibold text-slate-600">Estado de Vigencia:</span>
                            <span className="col-span-7 font-bold text-emerald-600">
                              ACTIVA / EN CURSO
                            </span>
                          </div>
                        </div>

                        <p className="text-[8px] sm:text-[9px] italic text-slate-500">
                          Se expide la presente a solicitud del interesado en {issueDate}.
                        </p>
                      </div>

                      {/* 2 Firmas: Director(a) de Escuela y Docente con fotos si fueron adjuntadas */}
                      <div className="grid grid-cols-2 gap-8 px-4 text-center mt-2 pt-1 border-t border-slate-200">
                        <div>
                          <div className="h-10 flex items-end justify-center mb-1">
                            {directorSignature ? (
                              <img
                                src={directorSignature}
                                alt="Firma Dirección"
                                className="max-h-9 max-w-[120px] object-contain"
                              />
                            ) : (
                              <div className="h-3"></div>
                            )}
                          </div>
                          <div className="w-4/5 h-[1px] bg-slate-400 mx-auto mb-1"></div>
                          <p className="text-[8.5px] sm:text-[9.5px] font-bold text-slate-900">{directorName}</p>
                          <p className="text-[7.5px] sm:text-[8px] text-slate-500">{directorRole}</p>
                        </div>
                        <div>
                          <div className="h-10 flex items-end justify-center mb-1">
                            {docentSignature ? (
                              <img
                                src={docentSignature}
                                alt="Firma Docente"
                                className="max-h-9 max-w-[120px] object-contain"
                              />
                            ) : (
                              <div className="h-3"></div>
                            )}
                          </div>
                          <div className="w-4/5 h-[1px] bg-slate-400 mx-auto mb-1"></div>
                          <p className="text-[8.5px] sm:text-[9.5px] font-bold text-slate-900">
                            {currentPractice?.docente_nombre || "Docente"}
                          </p>
                          <p className="text-[7.5px] sm:text-[8px] text-slate-500">Docente</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================
          PESTAÑA 2: ESTUDIANTES ACTIVOS Y PRÁCTICAS EN CURSO
          ============================================================ */}
      {activeTab === "estudiantes" && (
        <div className="p-6 border border-gray-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Estudiantes Activos en Prácticas Formativas</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Visualiza cuáles estudiantes están vigentes en prácticas, cuántas tienen actualmente en curso y emite directamente su constancia.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportGeneralReport("xls")}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => handleExportGeneralReport("csv")}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Buscar por estudiante, cédula o programa..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Tabla de Estudiantes Activos */}
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-left text-xs">
              <thead className="bg-gray-50 dark:bg-zinc-800/80 font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Estudiante</th>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Programa Académico</th>
                  <th className="px-4 py-3 text-center">Prácticas en Curso</th>
                  <th className="px-4 py-3">Horas Realizadas / Meta</th>
                  <th className="px-4 py-3">Rotaciones / Sede Clínica</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900">
                {filteredActiveStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-gray-500 dark:text-zinc-400 italic">
                      No se encontraron estudiantes activos con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredActiveStudents.map((st) => {
                    const pct = Math.min(100, Math.round(((st.totalHorasCumplidas || 0) / (st.totalHorasAcumuladas || 1)) * 100));
                    return (
                      <tr key={st.cedula} className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition">
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                          {st.nombre_completo}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">
                          {st.cedula}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
                          {st.carrera}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {st.practicas.length} en curso
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className={pct >= 100 ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "text-blue-600 dark:text-blue-400"}>
                                {st.totalHorasCumplidas || 0} hrs
                              </span>
                              <span className="text-gray-400 font-medium text-[10px]">
                                / {st.totalHorasAcumuladas} hrs ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 100
                                    ? "bg-emerald-500"
                                    : pct >= 50
                                    ? "bg-blue-500"
                                    : "bg-amber-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-zinc-400 space-y-1">
                          {st.practicas.map((pr, pIdx) => (
                            <div key={pIdx} className="text-[11px]">
                              <span className="font-semibold text-gray-800 dark:text-zinc-200">
                                {pr.titulo}
                              </span>{" "}
                              — <span className="text-gray-500">{pr.institucion} ({pr.horas_cumplidas || 0}/{pr.horas_asignadas || pr.horas}h)</span>
                            </div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {st.practicas[0] && (
                            <button
                              onClick={() =>
                                handleSelectStudentForConstancia(st.cedula, st.practicas[0].practica_id)
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white dark:bg-blue-950/60 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                            >
                              Emitir Constancia
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          PESTAÑA 3: DOCENTES ACTIVOS Y ESTUDIANTES A CARGO
          ============================================================ */}
      {activeTab === "docentes" && (
        <div className="p-6 border border-gray-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Docentes Activos y Carga Académica de Tutoría</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Consulta los docentes tutores vigentes, cuántos estudiantes tienen a su cargo y sus centros de rotación.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportGeneralReport("xls")}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => handleExportGeneralReport("csv")}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              value={docentSearch}
              onChange={(e) => setDocentSearch(e.target.value)}
              placeholder="Buscar por nombre de docente, cédula o correo..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Tabla de Docentes Activos */}
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-left text-xs">
              <thead className="bg-gray-50 dark:bg-zinc-800/80 font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Docente</th>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Correo Institucional</th>
                  <th className="px-4 py-3 text-center">Estudiantes a Cargo</th>
                  <th className="px-4 py-3 text-center">Prácticas Activas</th>
                  <th className="px-4 py-3">Sedes Asistenciales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900">
                {filteredActiveDocents.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500 dark:text-zinc-400 italic">
                      No se encontraron docentes activos con los filtros indicados.
                    </td>
                  </tr>
                ) : (
                  filteredActiveDocents.map((d, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        {d.nombre_completo}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">
                        {d.cedula}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">
                        {d.correo}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <User className="w-3.5 h-3.5" />
                          <span>{d.totalEstudiantesACargo} Estudiantes</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-zinc-200">
                        {d.totalPracticas} prácticas
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">
                        {d.instituciones.length > 0 ? d.instituciones.join(", ") : "Hospital Universitario"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminReports;
