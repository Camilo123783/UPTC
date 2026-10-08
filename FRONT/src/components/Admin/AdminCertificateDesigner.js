import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Award,
  Info,
  Search,
  RefreshCw,
  Building2,
  Stethoscope,
  UserCheck,
  Clock,
  GraduationCap,
  Star,
  ClipboardList,
  Package,
  PenTool,
  Camera,
  Printer,
  Lock,
  Eye,
  ArrowLeft,
} from "lucide-react";
import {
  generateProfessionalCertificate,
  formatCertificateNarrative,
} from "../../utils/certificateGenerator";
import { BACKEND_URL } from "../../config/api";
import { useDataSync } from "../../utils/dataSync";
import { useAuth } from "../../utils/useAuth";
import { toast } from "react-toastify";
import uptcLogo from "../../assets/images/uptc.png";
import facultyLogo from "../../assets/images/logooo.png";

const API_BASE_URL = BACKEND_URL;

const AdminCertificateDesigner = () => {
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

  // Práctica actualmente seleccionada (null = vista de catálogo)
  const [selectedPractice, setSelectedPractice] = useState(null);

  // Catálogo de prácticas
  const [practices, setPractices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros de prácticas
  const [statusFilter, setStatusFilter] = useState("todas"); // "todas" | "activas" | "finalizadas"
  const [searchTerm, setSearchTerm] = useState("");

  // Estudiantes seleccionados dentro de la práctica activa para emitir
  const [selectedStudentCedulas, setSelectedStudentCedulas] = useState([]);
  const [focusedStudent, setFocusedStudent] = useState(null);

  // Parámetros institucionales configurables
  const [issueDate, setIssueDate] = useState("Tunja, 14 de mayo de 2026");
  const [directorName, setDirectorName] = useState("?????");
  const [directorRole, setDirectorRole] = useState("Director(a) de Escuela");
  const [customTitle, setCustomTitle] = useState(
    "Mención de Reconocimiento y Acreditación a:"
  );

  // Foto/imagen digitalizada de la firma oficial (Base64)
  const [signatureImage, setSignatureImage] = useState(
    () => localStorage.getItem("uptc_cert_signature") || null
  );
  const signatureInputRef = React.useRef(null);

  // Configuración institucional viva (logos, nombre institución, facultad)
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

    // Si aún no están cargados en localStorage, consultarlos del backend
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

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido (PNG, JPG, etc.).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target?.result;
      setSignatureImage(base64Data);
      try {
        localStorage.setItem("uptc_cert_signature", base64Data);
      } catch (err) {
        console.warn("No se pudo persistir en localStorage:", err);
      }
      toast.success("Foto de firma cargada exitosamente.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setSignatureImage(null);
    try {
      localStorage.removeItem("uptc_cert_signature");
    } catch (e) { }
    if (signatureInputRef.current) signatureInputRef.current.value = "";
    toast.info("Foto de firma removida.");
  };

  // Cargar automáticamente la firma digital del docente si está en sesión docente
  useEffect(() => {
    if (isDocent && !signatureImage) {
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");
      if (token) {
        fetch(`${API_BASE_URL}/api/docent/profile`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((d) => {
            if (d?.data?.foto_firma) {
              setSignatureImage(d.data.foto_firma);
            }
          })
          .catch(() => {});
      }
    }
  }, [isDocent, signatureImage]);

  // ── Cargar Prácticas reales desde el backend ──
  const fetchPractices = useCallback(async () => {
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
      let endpoint = "";
      if (docFlag) {
        endpoint = docCedula
          ? `${API_BASE_URL}/api/docent/practices/${docCedula}`
          : `${API_BASE_URL}/api/docent/practices`;
      } else {
        endpoint = `${API_BASE_URL}/api/admin/practices`;
      }

      const res = await fetch(endpoint, { headers });
      if (res.ok) {
        let data = await res.json();
        data = Array.isArray(data) ? data : [];
        if (docFlag && docCedula) {
          data = data.filter((p) => String(p.docente_cedula) === String(docCedula));
        }
        setPractices(data);
      } else {
        if (docFlag) {
          const altEndpoint = `${API_BASE_URL}/api/docent/practices`;
          const altRes = await fetch(altEndpoint, { headers });
          if (altRes.ok) {
            let data = await altRes.json();
            data = Array.isArray(data) ? data : [];
            if (docCedula) {
              data = data.filter((p) => String(p.docente_cedula) === String(docCedula));
            }
            setPractices(data);
            return;
          }
        }
        console.error("Error al cargar prácticas:", res.status);
        toast.error("Error al cargar el catálogo de prácticas formativas.");
      }
    } catch (err) {
      console.error("Error al conectar con el servidor:", err);
      toast.error("No se pudo conectar con el servidor para cargar las prácticas.");
    } finally {
      setIsLoading(false);
    }
  }, [getUserContext]);

  useEffect(() => {
    fetchPractices();
  }, [fetchPractices]);

  useDataSync(fetchPractices);

  // Auto-selección si viene practiceId por query param
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const prId = params.get("practiceId");
      if (prId && practices.length > 0 && !selectedPractice) {
        const found = practices.find((p) => String(p.id) === String(prId));
        if (found) {
          handleSelectPractice(found);
        }
      }
    } catch (e) {}
  }, [practices, selectedPractice]);

  // ── Prácticas filtradas ──
  const filteredPractices = useMemo(() => {
    return practices.filter((pr) => {
      const status = (pr.estado || "").toLowerCase();
      if (statusFilter === "activas") {
        if (status !== "activa" && status !== "en curso") return false;
      } else if (statusFilter === "finalizadas") {
        if (status !== "finalizada" && status !== "concluida") return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const titleMatch = (pr.titulo || "").toLowerCase().includes(term);
        const servMatch = (pr.servicio_nombre || "").toLowerCase().includes(term);
        const instMatch = (pr.institucion_nombre || "").toLowerCase().includes(term);
        const docMatch = (pr.docente_nombre || "").toLowerCase().includes(term);
        if (!titleMatch && !servMatch && !instMatch && !docMatch) return false;
      }

      return true;
    });
  }, [practices, statusFilter, searchTerm]);

  // ── Al seleccionar una práctica ──
  const handleSelectPractice = (practice) => {
    setSelectedPractice(practice);
    const students = practice.estudiantes || [];

    // Por defecto, preseleccionar a los estudiantes que tienen nota aprobatoria (>= 3.0) o a todos si no hay notas
    const approved = students
      .filter((s) => s.calificacion !== null && s.calificacion >= 3.0)
      .map((s) => s.cedula);

    if (approved.length > 0) {
      setSelectedStudentCedulas(approved);
    } else {
      setSelectedStudentCedulas(students.map((s) => s.cedula));
    }

    setFocusedStudent(students[0] || null);
  };

  // ── Volver al catálogo de prácticas ──
  const handleBackToPractices = () => {
    setSelectedPractice(null);
    setFocusedStudent(null);
    setSelectedStudentCedulas([]);
  };

  // ── Alternar selección de un estudiante ──
  const handleToggleStudent = (cedula) => {
    setSelectedStudentCedulas((prev) =>
      prev.includes(cedula) ? prev.filter((c) => c !== cedula) : [...prev, cedula]
    );
  };

  // ── Seleccionar todos ──
  const handleSelectAllStudents = () => {
    if (!selectedPractice) return;
    setSelectedStudentCedulas(selectedPractice.estudiantes.map((s) => s.cedula));
  };

  // ── Seleccionar solo aprobados ──
  const handleSelectApprovedOnly = () => {
    if (!selectedPractice) return;
    const approved = selectedPractice.estudiantes
      .filter((s) => s.calificacion !== null && s.calificacion >= 3.0)
      .map((s) => s.cedula);
    setSelectedStudentCedulas(approved);
    if (approved.length === 0) {
      toast.info("No hay estudiantes con nota aprobatoria registrada en esta práctica.");
    }
  };

  // ── Deseleccionar todos ──
  const handleDeselectAll = () => {
    setSelectedStudentCedulas([]);
  };

  // ── Datos para el certificado en base a la práctica seleccionada y el estudiante enfocado ──
  const certificateData = useMemo(() => {
    if (!selectedPractice) return null;

    const practiceName =
      selectedPractice.titulo || selectedPractice.servicio_nombre || "Práctica Formativa";
    const serviceName =
      selectedPractice.servicio_nombre || "";
    const institution =
      selectedPractice.institucion_nombre || "Hospital Universitario San Rafael de Tunja";
    const docentName = selectedPractice.docente_nombre || "Docente UPTC";
    const auditorName =
      selectedPractice.auditor_nombre || "Auditor(a) de Calidad Asistencial";
    const hours = selectedPractice.horas_totales || 144;
    const period = selectedPractice.periodo || "2026-2";
    const startDate = selectedPractice.fecha_inicio || "";
    const endDate = selectedPractice.fecha_fin || "";

    const studentName = focusedStudent?.nombre_completo || "Estudiante UPTC";
    const studentCedula = focusedStudent?.cedula || "N/A";
    const studentCareer =
      focusedStudent?.carrera || selectedPractice.programa_nombre || "Medicina";
    const grade = focusedStudent?.calificacion;

    const narrative = formatCertificateNarrative({
      practiceName,
      serviceName,
      institution,
      docentName,
      auditorName,
      hours,
      period,
      startDate,
      endDate,
      grade,
    });

    return {
      studentName,
      cedula: studentCedula,
      career: studentCareer,
      practiceName,
      serviceName,
      institution,
      hours,
      period,
      startDate,
      endDate,
      grade,
      docentName,
      auditorName,
      directorName,
      directorRole,
      deanName: directorName,
      date: issueDate,
      customTitle,
      narrative,
      signatureImage,
    };
  }, [
    selectedPractice,
    focusedStudent,
    directorName,
    directorRole,
    issueDate,
    customTitle,
    signatureImage,
  ]);

  // ── Emitir Certificado Individual del estudiante actualmente en foco ──
  const handleIssueSingle = () => {
    if (!focusedStudent) {
      toast.warn("Por favor, selecciona un estudiante para visualizar y emitir.");
      return;
    }

    if (isDocent && !signatureImage) {
      toast.warning(
        "Tienes que terminar de subir tus datos primero (foto de la firma en 'Datos Docente') para poder emitir certificados."
      );
      return;
    }

    if (!certificateData) return;

    try {
      generateProfessionalCertificate({
        studentName: certificateData.studentName,
        cedula: certificateData.cedula,
        career: certificateData.career,
        practiceName: certificateData.practiceName,
        serviceName: certificateData.serviceName,
        institution: certificateData.institution,
        hours: certificateData.hours,
        period: certificateData.period,
        startDate: certificateData.startDate,
        endDate: certificateData.endDate,
        grade: certificateData.grade,
        date: certificateData.date,
        docentName: certificateData.docentName,
        auditorName: certificateData.auditorName,
        directorName: certificateData.directorName,
        directorRole: certificateData.directorRole,
        deanName: certificateData.directorName,
        customTitle: certificateData.customTitle,
        signatureImage: certificateData.signatureImage,
        institutionSettings: instSettings,
      });
      if (isDocent) {
        toast.success(
          `Certificado de "${certificateData.studentName}" generado e impreso/descargado para control docente (no notifica al estudiante).`
        );
      } else {
        toast.success(
          `Certificado oficial de "${certificateData.studentName}" generado exitosamente.`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Ocurrió un error al generar el PDF del certificado.");
    }
  };

  // ── Emitir Certificados de los Estudiantes Seleccionados (Lote) ──
  const handleIssueBatch = () => {
    if (isDocent && !signatureImage) {
      toast.warning(
        "Tienes que terminar de subir tus datos primero (foto de la firma en 'Datos Docente') para poder emitir certificados."
      );
      return;
    }

    if (!selectedPractice) return;
    if (selectedStudentCedulas.length === 0) {
      toast.warn("Selecciona al menos un estudiante para emitir certificados.");
      return;
    }

    const studentsToCertify = selectedPractice.estudiantes.filter((s) =>
      selectedStudentCedulas.includes(s.cedula)
    );

    let count = 0;
    studentsToCertify.forEach((st, idx) => {
      setTimeout(() => {
        generateProfessionalCertificate({
          studentName: st.nombre_completo,
          cedula: st.cedula,
          career: st.carrera || selectedPractice.programa_nombre || "Medicina",
          practiceName:
            selectedPractice.titulo || selectedPractice.servicio_nombre || "Práctica Formativa",
          serviceName:
            selectedPractice.servicio_nombre || "",
          institution:
            selectedPractice.institucion_nombre || "Hospital Universitario San Rafael de Tunja",
          hours: selectedPractice.horas_totales || 144,
          period: selectedPractice.periodo || "2026-2",
          startDate: selectedPractice.fecha_inicio,
          endDate: selectedPractice.fecha_fin,
          grade: st.calificacion,
          date: issueDate,
          docentName: selectedPractice.docente_nombre || "Docente UPTC",
          auditorName:
            selectedPractice.auditor_nombre || "Auditor(a) de Calidad Asistencial",
          directorName,
          directorRole,
          deanName: directorName,
          customTitle,
          signatureImage,
          institutionSettings: instSettings,
        });
      }, idx * 600);
      count++;
    });

    if (isDocent) {
      toast.success(
        `Descargando ${count} certificados seleccionados para archivo y control docente (no notifica a los estudiantes).`
      );
    } else {
      toast.success(
        `Generando ${count} certificados oficiales para los estudiantes seleccionados.`
      );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-colors">

      {/* ============================================================
          VISTA 1: CATÁLOGO DE PRÁCTICAS ACTIVAS Y FINALIZADAS
          ============================================================ */}
      {!selectedPractice && (
        <div className="space-y-6">
          {/* Encabezado Principal */}
          <div className="p-6 sm:p-8 border border-gray-100 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <Award className="w-8 h-8 text-amber-500" />
                  <span>{isDocent ? "Emisión de Certificados de Mis Prácticas" : "Emisión de Certificados Oficiales por Práctica"}</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-1">
                  {isDocent
                    ? "Selecciona una de tus prácticas formativas asignadas para inspeccionar sus estudiantes, verificar sus notas y emitir diplomas oficiales de aprobación."
                    : "Selecciona una práctica formativa activa o finalizada para inspeccionar sus estudiantes, revisar sus calificaciones y emitir los diplomas oficiales de acreditación."}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {practices.length} {isDocent ? "Prácticas Asignadas" : "Prácticas Registradas"}
                </span>
              </div>
            </div>
          </div>

          {/* Banner Explicativo para Docente */}
          {isDocent && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Emisión y Descarga para Uso y Archivo Docente
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                  Como docente vinculado, puedes generar, previsualizar e imprimir copias de los certificados de tus rotaciones en cualquier momento. <strong>Esta descarga es inmediata para ti y no notifica ni publica el documento al estudiante</strong>. La disponibilidad para los estudiantes se gestiona mediante el módulo de solicitudes avaladas.
                </p>
              </div>
            </div>
          )}

          {/* Barra de Filtros y Búsqueda */}
          <div className="p-4 sm:p-6 border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Buscador */}
            <div className="w-full md:w-96 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por práctica, hospital, servicio o docente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Pestañas de Estado */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter("todas")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === "todas"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                  }`}
              >
                Todas ({practices.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("activas")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === "activas"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                  }`}
              >
                Activas / En Curso (
                {
                  practices.filter(
                    (p) =>
                      (p.estado || "").toLowerCase() === "activa" ||
                      (p.estado || "").toLowerCase() === "en curso"
                  ).length
                }
                )
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("finalizadas")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === "finalizadas"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                  }`}
              >
                Finalizadas (
                {
                  practices.filter(
                    (p) =>
                      (p.estado || "").toLowerCase() === "finalizada" ||
                      (p.estado || "").toLowerCase() === "concluida"
                  ).length
                }
                )
              </button>
            </div>
          </div>

          {/* Grid de Prácticas */}
          {isLoading ? (
            <div className="p-12 text-center text-gray-500 dark:text-zinc-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
              <p className="font-semibold text-sm">Cargando catálogo de prácticas formativas...</p>
            </div>
          ) : filteredPractices.length === 0 ? (
            <div className="p-12 border border-dashed border-gray-300 dark:border-zinc-800 rounded-3xl text-center bg-white dark:bg-zinc-900/50">
              <Building2 className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white mt-3">
                No se encontraron prácticas con los filtros seleccionados
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                Intenta cambiar el término de búsqueda o selecciona otra pestaña de estado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPractices.map((pr) => {
                const isFinished =
                  (pr.estado || "").toLowerCase() === "finalizada" ||
                  (pr.estado || "").toLowerCase() === "concluida";
                const totalStudents = (pr.estudiantes || []).length;
                const evaluatedCount = (pr.estudiantes || []).filter(
                  (s) => s.calificacion !== null && s.calificacion !== undefined
                ).length;

                return (
                  <div
                    key={pr.id}
                    className="p-6 border border-gray-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Estado y Periodo */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${isFinished
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            }`}
                        >
                          {pr.estado || "Activa"}
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
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5 flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5" /> Servicio: {pr.servicio_nombre}
                        </p>
                      )}

                      {/* Institución / Hospital */}
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 font-medium flex items-center gap-1.5 mt-2">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{pr.institucion_nombre || "Hospital Universitario"}</span>
                      </p>

                      {/* Docente */}
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Docente:</span>
                        <span className="font-semibold text-gray-700 dark:text-zinc-200">
                          {pr.docente_nombre || "Docente UPTC"}
                        </span>
                      </p>

                      {/* Auditor */}
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span>Auditor:</span>
                        <span className="text-gray-700 dark:text-zinc-300">
                          {pr.auditor_nombre || "Sin auditor asignado"}
                        </span>
                      </p>

                      {/* Horas Totales */}
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>{pr.horas_totales || 180} horas de práctica</span>
                        </span>
                        <span className="font-bold text-slate-800 dark:text-zinc-200">
                          {pr.programa_nombre || "Salud"}
                        </span>
                      </div>
                    </div>

                    {/* Footer de la tarjeta con Estudiantes y Botón */}
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                          <span>{totalStudents} Estudiantes</span>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          <span>{evaluatedCount} con notas</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPractice(pr)}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-xs sm:text-sm"
                      >
                        <ClipboardList className="w-4 h-4" />
                        <span>Gestionar y Emitir Certificados</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          VISTA 2: DENTRO DE LA PRÁCTICA SELECCIONADA
          - Lista de Estudiantes con sus Notas
          - Previsualización en Vivo Siempre Blanca
          - Emisión Individual o en Lote
          ============================================================ */}
      {selectedPractice && (
        <div className="space-y-6">
          {/* Barra Superior de Retorno y Datos de la Práctica */}
          <div className="p-6 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleBackToPractices}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a Prácticas
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white">
                      {selectedPractice.servicio_nombre || selectedPractice.titulo}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {selectedPractice.estado || "Activa"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{selectedPractice.institucion_nombre}</span>
                    <span>·</span>
                    <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Tutor: {selectedPractice.docente_nombre || "Docente UPTC"}</span>
                    <span>·</span>
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{selectedPractice.horas_totales || 180} Horas</span>
                    <span>·</span>
                    <span>Periodo {selectedPractice.periodo || "2026-1"}</span>
                  </p>
                </div>
              </div>

              {/* Botón de Emisión en Lote */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleIssueBatch}
                  disabled={selectedStudentCedulas.length === 0}
                  className={`py-2.5 px-5 font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 shadow-md ${selectedStudentCedulas.length > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95"
                      : "bg-gray-300 dark:bg-zinc-800 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  <Package className="w-4 h-4" />
                  <span>
                    {isDocent
                      ? `Imprimir / Descargar en Lote (${selectedStudentCedulas.length} Certificados)`
                      : `Emitir en Lote (${selectedStudentCedulas.length} Certificados)`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
            {/* ─── COLUMNA IZQUIERDA: Listado de Estudiantes y Notas de la Práctica ─── */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-lg bg-white dark:bg-zinc-900 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-blue-600" />
                      <span>Estudiantes de la Práctica</span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      Visualiza sus calificaciones y selecciona a quiénes emitir su diploma.
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                    {selectedStudentCedulas.length} /{" "}
                    {(selectedPractice.estudiantes || []).length} seleccionados
                  </span>
                </div>

                {/* Controles de Selección Rápida */}
                <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b border-gray-100 dark:border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllStudents}
                    className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 font-semibold text-gray-700 dark:text-zinc-300"
                  >
                    Seleccionar Todos
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectApprovedOnly}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                  >
                    <Star className="w-3.5 h-3.5 text-emerald-600" /> Solo Aprobados (≥ 3.0)
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 font-semibold text-gray-700 dark:text-zinc-300"
                  >
                    Deseleccionar
                  </button>
                </div>

                {/* Lista de Tarjetas de Estudiantes */}
                {(selectedPractice.estudiantes || []).length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-zinc-400">
                    <p className="text-xs font-semibold">
                      Esta práctica no tiene estudiantes inscritos actualmente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                    {selectedPractice.estudiantes.map((st) => {
                      const isSelected = selectedStudentCedulas.includes(st.cedula);
                      const isFocused = focusedStudent?.cedula === st.cedula;
                      const hasScore =
                        st.calificacion !== null && st.calificacion !== undefined;
                      const isApproved = hasScore && st.calificacion >= 3.0;

                      return (
                        <div
                          key={st.cedula}
                          onClick={() => setFocusedStudent(st)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isFocused
                              ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm ring-2 ring-blue-400"
                              : "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 hover:border-gray-300 dark:hover:border-zinc-700"
                            }`}
                        >
                          {/* Checkbox y Datos del Estudiante */}
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleStudent(st.cedula);
                              }}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                                  {st.nombre_completo}
                                </span>
                                {isFocused && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-600 text-white">
                                    En Vista
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400">
                                C.C. {st.cedula} · {st.carrera || "Medicina"}
                              </p>
                            </div>
                          </div>

                          {/* Notas Asociadas */}
                          <div className="text-right">
                            {hasScore ? (
                              <div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-black ${isApproved
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                    }`}
                                >
                                  {st.calificacion.toFixed(1)} / 5.0
                                </span>
                                <p className="text-[9px] font-semibold text-gray-400 dark:text-zinc-500 mt-0.5">
                                  {isApproved ? "Aprobado" : "Reprobado"}
                                </p>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Sin nota
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Parámetros Adicionales Plegables */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
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
                    <div>
                      <label className="block font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                        Director(a) de Escuela
                      </label>
                      <input
                        type="text"
                        value={directorName}
                        onChange={(e) => setDirectorName(e.target.value)}
                        placeholder="Nombre Director(a)"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                      Cargo Oficial en Diploma
                    </label>
                    <input
                      type="text"
                      value={directorRole}
                      onChange={(e) => setDirectorRole(e.target.value)}
                      placeholder="Director(a) de Escuela"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Foto de la Firma Digital */}
                  <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <PenTool className="w-4 h-4 text-amber-600" />
                        <span>Foto / Imagen de la Firma</span>
                      </label>
                      {signatureImage && (
                        <button
                          type="button"
                          onClick={handleRemoveSignature}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={signatureInputRef}
                      onChange={handleSignatureUpload}
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden"
                      id="signature-upload-input"
                    />

                    {signatureImage ? (
                      <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-zinc-800/80 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-600">
                        <img
                          src={signatureImage}
                          alt="Firma Cargada"
                          className="h-10 max-w-[120px] object-contain bg-white rounded p-1 shadow-sm border border-slate-200"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Firma cargada correctamente
                          </p>
                          <label
                            htmlFor="signature-upload-input"
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            Cambiar foto de firma
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="signature-upload-input"
                        className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 bg-gray-50/50 dark:bg-zinc-800/40 cursor-pointer transition-all hover:bg-blue-50/30"
                      >
                        <Camera className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                          Subir foto de la firma
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          PNG o JPG (fondo blanco o transparente)
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Botón de Descarga Individual del Estudiante Enfocado */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={handleIssueSingle}
                    disabled={!focusedStudent}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-xs sm:text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {isDocent
                        ? "Imprimir / Descargar Certificado (Copia Docente)"
                        : `Descargar PDF de ${focusedStudent?.nombre_completo?.split(" ")[0] || "Estudiante"}`}
                    </span>
                  </button>
                  {isDocent && (
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 text-center mt-2 flex items-center justify-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>Descarga directa para control docente. El estudiante solo podrá descargar su certificado tras solicitarlo y ser aprobado formalmente.</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ─── COLUMNA DERECHA: Vista Previa en Vivo Siempre Blanca y Centrada ─── */}
            <div className="lg:col-span-7">
              <div className="p-6 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-zinc-800">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    <span>Vista Previa del Certificado Oficial UPTC</span>
                  </h3>
                  <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                    Estudiante: {certificateData?.studentName}
                  </span>
                </div>

                {/* HOJA DEL CERTIFICADO EN PANTALLA: FORMATO VERTICAL OFICIAL UPTC */}
                <div className="overflow-y-auto max-h-[82vh] p-2 sm:p-4 flex justify-center bg-slate-100/70 dark:bg-zinc-950/60 rounded-2xl border border-slate-200 dark:border-zinc-800">
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
                        {/* Logo Institucional a la izquierda */}
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

                        {/* Sello / Logo Facultad a la derecha: Solo si existe en la parametrización */}
                        <div className="w-20 sm:w-24 flex items-center justify-end">
                          {instSettings.logo_facultad ? (
                            <img
                              src={instSettings.logo_facultad}
                              alt="Logo Facultad"
                              className="h-9 sm:h-11 w-auto object-contain"
                            />
                          ) : (
                            <div className="h-9 sm:h-11 w-10"></div>
                          )}
                        </div>
                      </div>

                      {/* Encabezado Central Universitario */}
                      <div className="text-center px-2">
                        <h2
                          className="font-serif text-xs sm:text-sm font-bold tracking-wider uppercase leading-snug"
                          style={{ color: "#0f172a" }}
                        >
                          {(instSettings.name || instSettings.nombre || "UNIVERSIDAD PEDAGÓGICA Y TECNOLÓGICA DE COLOMBIA").toUpperCase()}
                        </h2>
                        <p
                          className="font-serif italic text-xs sm:text-sm mt-0.5"
                          style={{ color: "#334155" }}
                        >
                          {instSettings.faculty || instSettings.facultad || "Facultad de Ciencias de la Salud"}
                        </p>
                      </div>

                      {/* Línea decorativa dorada horizontal */}
                      <div className="w-3/5 mx-auto h-[1px] bg-gradient-to-r from-transparent via-amber-600/60 to-transparent mt-2.5"></div>
                    </div>

                    {/* Contenido Central */}
                    <div className="flex-1 flex flex-col justify-center space-y-4 my-auto relative z-10 py-2">
                      {/* Frase de Información */}
                      <div className="text-center">
                        <p
                          className="font-serif text-xs sm:text-sm"
                          style={{ color: "#1e293b" }}
                        >
                          {(() => {
                            const rawCareer = certificateData?.career || "";
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

                      {/* Nombre Destacado del Estudiante */}
                      <div className="text-center">
                        <h3
                          className="text-lg sm:text-xl md:text-2xl font-black tracking-wide font-sans uppercase"
                          style={{ color: "#020617" }}
                        >
                          {certificateData?.studentName || "Nombre del Estudiante"}
                        </h3>
                        <p
                          className="text-[11px] sm:text-xs font-bold mt-1"
                          style={{ color: "#334155" }}
                        >
                          C.C. {certificateData?.cedula || "N/A"}
                        </p>
                      </div>

                      {/* Cuerpo de Práctica: Centrado y con items en negrilla idénticos al certificado oficial */}
                      <div className="text-center px-4 sm:px-8 leading-relaxed font-serif text-[11px] sm:text-[12.5px]" style={{ color: "#1e293b" }}>
                        {certificateData?.narrative?.tokens ? (
                          <span>
                            {certificateData.narrative.tokens.map((tok, idx) => (
                              <span
                                key={idx}
                                className={tok.bold ? "font-bold" : ""}
                                style={{ color: tok.bold ? "#020617" : "#1e293b" }}
                              >
                                {tok.text}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span>{certificateData?.narrative?.fullText}</span>
                        )}
                      </div>

                      {/* Nota Académica */}
                      <div className="text-center pt-1">
                        <span
                          className="text-xs sm:text-sm font-bold font-serif"
                          style={{ color: "#0f172a" }}
                        >
                          Nota ({certificateData?.narrative?.gradeStr})
                        </span>
                      </div>

                      {/* Ciudad y Fecha de Emisión */}
                      <div className="text-center">
                        <p
                          className="font-serif italic text-xs sm:text-sm"
                          style={{ color: "#334155" }}
                        >
                          {issueDate.toLowerCase().startsWith("tunja") ? issueDate : `Tunja, ${issueDate}`}
                        </p>
                      </div>
                    </div>

                    {/* Firma Oficial Centrada */}
                    <div className="relative z-10 pt-2 pb-1 flex flex-col items-center text-center">
                      {/* Foto de firma o trazo vectorial */}
                      {signatureImage ? (
                        <div className="h-12 sm:h-14 flex items-center justify-center -mb-1">
                          <img
                            src={signatureImage}
                            alt="Firma Oficial"
                            className="h-10 sm:h-12 max-w-[180px] object-contain"
                          />
                        </div>
                      ) : (
                        <svg
                          className="w-36 sm:w-44 h-11 -mb-2"
                          viewBox="0 0 160 50"
                          fill="none"
                          style={{ color: "#1e293b" }}
                        >
                          <path
                            d="M15 35 C 30 10, 45 45, 60 20 C 70 5, 80 40, 95 25 C 110 15, 125 35, 145 28 M40 30 Q 75 10, 110 32 M65 25 L 85 40"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      <div
                        className="w-48 sm:w-56 h-[1.5px] mx-auto mb-1.5"
                        style={{ backgroundColor: "#64748b" }}
                      ></div>
                      <p
                        className="text-xs sm:text-sm font-bold leading-tight"
                        style={{ color: "#0f172a" }}
                      >
                        {directorName}
                      </p>
                      <p
                        className="text-[10px] sm:text-xs leading-tight mt-0.5"
                        style={{ color: "#475569" }}
                      >
                        {directorRole || "Coordinador(a) de Práctica"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCertificateDesigner;
