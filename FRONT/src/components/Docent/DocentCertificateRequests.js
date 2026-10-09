// ============================================================
// src/components/Docent/DocentCertificateRequests.js
// Panel de Solicitudes de Certificados Recibidas para Docentes — UPTC
// Selección de Práctica Formativa y Gestión de Avales en Tiempo Real
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building2,
  Hospital,
  Calendar,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Send,
  Eye,
  Download,
  AlertCircle,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Check,
  X,
  ArrowRight,
  Upload,
  Stethoscope,
  PenTool,
  AlertTriangle,
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { useAuth } from "../../utils/useAuth";
import { useDataSync, notifyDataChanged } from "../../utils/dataSync";
import { generateProfessionalCertificate } from "../../utils/certificateGenerator";
import toast from "../../utils/toast";

const API_BASE_URL = BACKEND_URL;

const DocentCertificateRequests = () => {
  const { user } = useAuth();
  const [practices, setPractices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selección de práctica: null = vista de panel de prácticas; number/string = práctica seleccionada
  const [selectedPracticeId, setSelectedPracticeId] = useState(null);

  // Filtros
  const [practiceSearchTerm, setPracticeSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "Pendiente" | "Aprobado"

  // Modal para responder solicitud (Aprobar o Rechazar)
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalAction, setModalAction] = useState("approve"); // "approve" | "reject"
  const [docentResponseNote, setDocentResponseNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docentProfile, setDocentProfile] = useState(null);

  // Modal para cargar firma oficial al instante sin complicaciones
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [pendingActionAfterSig, setPendingActionAfterSig] = useState(null);

  // Configuración institucional viva
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

  // Obtener la cédula del docente
  const getDocentCedula = useCallback(() => {
    if (user?.cedula) return user.cedula;
    if (user?.id) return user.id;
    try {
      const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.cedula || parsed.Cédula || parsed.id || null;
      }
    } catch (e) {
      console.warn("No se pudo obtener cédula docente:", e);
    }
    return null;
  }, [user]);

  // Cargar datos 100% reales desde el backend (Prácticas, Solicitudes y Perfil)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const docentCedula = getDocentCedula();

    // Limpiar claves locales temporales de prueba
    try {
      localStorage.removeItem("uptc_cert_reqs_4");
    } catch (e) {}

    const token =
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const reqUrl = docentCedula
        ? `${API_BASE_URL}/api/docent/certificate-requests/${docentCedula}`
        : `${API_BASE_URL}/api/docent/certificate-requests`;

      const pracUrl = docentCedula
        ? `${API_BASE_URL}/api/docent/practices/${docentCedula}`
        : `${API_BASE_URL}/api/docent/practices`;

      const profUrl = `${API_BASE_URL}/api/docent/profile`;

      const [resReqs, resPracs, resProf] = await Promise.allSettled([
        fetch(reqUrl, { headers }),
        fetch(pracUrl, { headers }),
        fetch(profUrl, { headers }),
      ]);

      if (resReqs.status === "fulfilled" && resReqs.value.ok) {
        const data = await resReqs.value.json();
        // Solo datos 100% reales de la BD, sin datos simulados
        setRequests(Array.isArray(data) ? data : []);
      } else {
        setRequests([]);
      }

      if (resPracs.status === "fulfilled" && resPracs.value.ok) {
        const pData = await resPracs.value.json();
        setPractices(Array.isArray(pData) ? pData : []);
      } else {
        setPractices([]);
      }

      if (resProf.status === "fulfilled" && resProf.value.ok) {
        const profData = await resProf.value.json();
        if (profData?.data) {
          setDocentProfile(profData.data);
          if (profData.data.foto_firma) {
            try {
              localStorage.setItem("uptc_cert_signature", profData.data.foto_firma);
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error("Error al cargar datos reales de certificados:", err);
      setRequests([]);
      setPractices([]);
    } finally {
      setIsLoading(false);
    }
  }, [getDocentCedula]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDataSync(fetchData);

  // Práctica actualmente seleccionada
  const currentPractice = useMemo(() => {
    if (!selectedPracticeId) return null;
    return practices.find((p) => String(p.id) === String(selectedPracticeId)) || null;
  }, [practices, selectedPracticeId]);

  // Contadores rápidos (Excluyendo rechazadas según requerimiento)
  const counts = useMemo(() => {
    const valid = requests.filter((r) => r.estado !== "Rechazado");
    const pendientes = valid.filter((r) => r.estado === "Pendiente").length;
    const aprobadas = valid.filter((r) => r.estado === "Aprobado").length;
    return {
      pendientes,
      aprobadas,
      total: valid.length,
    };
  }, [requests]);

  // Filtro de Prácticas para la galería
  const filteredPractices = useMemo(() => {
    if (!practiceSearchTerm.trim()) return practices;
    const term = practiceSearchTerm.toLowerCase();
    return practices.filter(
      (p) =>
        (p.titulo || "").toLowerCase().includes(term) ||
        (p.institucion_nombre || "").toLowerCase().includes(term) ||
        (p.servicio_nombre || "").toLowerCase().includes(term) ||
        (p.periodo || "").toLowerCase().includes(term)
    );
  }, [practices, practiceSearchTerm]);

  // Filtrado de solicitudes dentro de la práctica seleccionada (NUNCA mostrar rechazadas)
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // 1. Debe pertenecer a la práctica seleccionada
      if (selectedPracticeId && String(r.practica_id) !== String(selectedPracticeId)) {
        return false;
      }

      // 2. Omitir rechazadas siempre
      if (r.estado === "Rechazado") return false;

      // 3. Filtro por estado
      if (statusFilter !== "all" && r.estado !== statusFilter) return false;

      // 4. Filtro por término de búsqueda
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const estMatch = (r.estudiante_nombre || "").toLowerCase().includes(term);
        const cedMatch = String(r.estudiante_cedula || "").includes(term);
        const prMatch = (r.practica_titulo || "").toLowerCase().includes(term);
        const servMatch = (r.servicio_nombre || "").toLowerCase().includes(term);
        const tipoMatch = (r.tipo_certificado || "").toLowerCase().includes(term);
        if (!estMatch && !cedMatch && !prMatch && !servMatch && !tipoMatch) return false;
      }
      return true;
    });
  }, [requests, selectedPracticeId, statusFilter, searchTerm]);

  // Manejar selección de archivo de firma
  const handleSignatureFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.warning("Por favor selecciona un archivo de imagen (PNG o JPG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("La imagen no debe superar los 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setSignaturePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Guardar firma oficial del docente en base de datos y continuar con la acción pendiente
  const handleSaveSignature = async (e) => {
    e.preventDefault();
    if (!signaturePreview) {
      toast.warning("Por favor selecciona o sube una imagen de tu firma.");
      return;
    }
    setIsSavingSignature(true);
    try {
      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      await fetch(`${API_BASE_URL}/api/docent/profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          foto_firma: signaturePreview,
        }),
      });

      localStorage.setItem("uptc_cert_signature", signaturePreview);
      setDocentProfile((prev) => ({
        ...(prev || {}),
        foto_firma: signaturePreview,
        has_signature: true,
      }));
      toast.success("Firma oficial registrada correctamente.");
      setIsSignatureModalOpen(false);

      // Si había una acción pendiente, continuar automáticamente sin complicaciones
      if (pendingActionAfterSig) {
        const { type, req } = pendingActionAfterSig;
        setPendingActionAfterSig(null);
        if (type === "approve") {
          setSelectedRequest(req);
          setModalAction("approve");
          setDocentResponseNote(
            "Cumplimiento satisfactorio de la práctica formativa y competencias asistenciales según bitácora y turnos rotatorios."
          );
        } else if (type === "download") {
          generateProfessionalCertificate({
            studentName: req.estudiante_nombre || "Estudiante UPTC",
            cedula: req.estudiante_cedula,
            career: req.estudiante_carrera || "Medicina",
            practiceName: req.servicio_nombre || req.practica_titulo,
            serviceName: req.servicio_nombre || req.practica_titulo,
            institution: req.institucion_nombre || instSettings.name || instSettings.nombre || "Hospital Universitario San Rafael de Tunja",
            docentName: req.docente_nombre || docentProfile?.nombre_completo || user?.nombre || "Docente UPTC",
            hours: req.horas_totales || 144,
            period: req.practica_periodo || "2026-2",
            startDate: req.practica_fecha_inicio,
            endDate: req.practica_fecha_fin,
            grade: req.estudiante_calificacion || req.calificacion,
            date: `Tunja, ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`,
            directorName: instSettings.director_nombre || instSettings.representante || "Dirección de Escuela",
            directorRole: "Director(a) de Escuela",
            deanName: instSettings.director_nombre || instSettings.representante || "Dirección de Escuela",
            signatureImage: signaturePreview,
            institutionSettings: instSettings,
          });
          toast.success("Descargando certificado avalado...");
        }
      }
    } catch (err) {
      console.error("Error al guardar firma:", err);
      localStorage.setItem("uptc_cert_signature", signaturePreview);
      setDocentProfile((prev) => ({
        ...(prev || {}),
        foto_firma: signaturePreview,
        has_signature: true,
      }));
      setIsSignatureModalOpen(false);
      toast.info("Firma cargada localmente para emitir.");
    } finally {
      setIsSavingSignature(false);
    }
  };

  // Abrir modal de acción (Verifica firma oficial para emisión automática)
  const handleOpenActionModal = (req, action) => {
    if (action === "approve") {
      const hasSignature = Boolean(
        docentProfile?.foto_firma ||
        docentProfile?.has_signature ||
        (typeof window !== "undefined" && localStorage.getItem("uptc_cert_signature"))
      );
      if (!hasSignature) {
        toast.warning(
          "Tienes que terminar de subir tus datos primero (foto de la firma) antes de poder emitir o avalar documentos."
        );
        setPendingActionAfterSig({ type: "approve", req });
        setSignaturePreview(null);
        setIsSignatureModalOpen(true);
        return;
      }
    }

    setSelectedRequest(req);
    setModalAction(action);
    setDocentResponseNote(
      action === "approve"
        ? "Cumplimiento satisfactorio de la práctica formativa y competencias asistenciales según bitácora y turnos rotatorios."
        : "Solicitud no avalada debido a horas asistenciales pendientes por reponer."
    );
  };

  // Enviar respuesta (Aprobar o Rechazar)
  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setIsSubmitting(true);
    const newStatus = modalAction === "approve" ? "Aprobado" : "Rechazado";

    try {
      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      await fetch(`${API_BASE_URL}/api/docent/certificate-requests/${selectedRequest.id}/respond`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          estado: newStatus,
          respuesta_docente: docentResponseNote.trim(),
        }),
      });

      // Actualizar estado en memoria
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? {
                ...r,
                estado: newStatus,
                fecha_respuesta: new Date().toISOString(),
                respuesta_docente: docentResponseNote.trim(),
              }
            : r
        )
      );

      // Notificar cambio reactivo en todo el sistema y actualizar badges en Navbar
      notifyDataChanged("certificate-requests", "respond");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("uptc:certificate-requests-updated"));
      }

      toast.success(
        newStatus === "Aprobado"
          ? `¡Documento para ${selectedRequest.estudiante_nombre} avalado con éxito!`
          : `Solicitud de ${selectedRequest.estudiante_nombre} rechazada.`
      );
    } catch (err) {
      console.error("Error respondiendo solicitud:", err);
      toast.error("Ocurrió un error al procesar la solicitud.");
    } finally {
      setIsSubmitting(false);
      setSelectedRequest(null);
    }
  };

  // Descargar el certificado generado desde la vista del docente
  const handleDownloadGeneratedCertificate = (req) => {
    const savedSig = docentProfile?.foto_firma || (typeof window !== "undefined" ? localStorage.getItem("uptc_cert_signature") : null);
    if (!savedSig) {
      toast.warning(
        "Tienes que terminar de subir tus datos primero (foto de la firma) antes de poder emitir o avalar documentos."
      );
      setPendingActionAfterSig({ type: "download", req });
      setSignaturePreview(null);
      setIsSignatureModalOpen(true);
      return;
    }
    generateProfessionalCertificate({
      studentName: req.estudiante_nombre || "Estudiante UPTC",
      cedula: req.estudiante_cedula,
      career: req.estudiante_carrera || "Medicina",
      practiceName: req.servicio_nombre || req.practica_titulo,
      serviceName: req.servicio_nombre || req.practica_titulo,
      institution: req.institucion_nombre || instSettings.name || instSettings.nombre || "Hospital Universitario San Rafael de Tunja",
      docentName: req.docente_nombre || docentProfile?.nombre_completo || user?.nombre || "Docente UPTC",
      hours: req.horas_totales || 144,
      period: req.practica_periodo || "2026-2",
      startDate: req.practica_fecha_inicio,
      endDate: req.practica_fecha_fin,
      grade: req.estudiante_calificacion || req.calificacion,
      date: `Tunja, ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`,
      directorName: instSettings.director_nombre || instSettings.representante || "Dirección de Escuela",
      directorRole: "Director(a) de Escuela",
      deanName: instSettings.director_nombre || instSettings.representante || "Dirección de Escuela",
      signatureImage: savedSig,
      institutionSettings: instSettings,
    });
    toast.success("Descargando certificado avalado...");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* ─── Encabezado Principal ─── */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 shadow-inner">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                Solicitudes de Certificados Recibidas
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Revisa, avala o gestiona las solicitudes de certificados radicadas por tus estudiantes a cargo
              </p>
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl transition duration-150 shadow-sm border border-gray-200 dark:border-zinc-700 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-600" : ""}`} />
            <span>{isLoading ? "Actualizando..." : "Actualizar"}</span>
          </button>
        </div>

        {/* ─── Contadores Rápidos (Solo 3 tarjetas, sin Rechazadas) ─── */}
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-md"
                : "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-700"
            }`}
          >
            <span className="text-xs uppercase font-bold tracking-wider block opacity-80">
              Total Solicitudes
            </span>
            <p className="text-2xl sm:text-3xl font-black mt-1">{counts.total}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("Pendiente")}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              statusFilter === "Pendiente"
                ? "bg-amber-600 text-white border-amber-600 shadow-md"
                : "bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 hover:border-amber-300"
            }`}
          >
            <span className="text-xs uppercase font-bold tracking-wider block opacity-80">
              Pendientes de Firma
            </span>
            <p className="text-2xl sm:text-3xl font-black mt-1">{counts.pendientes}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("Aprobado")}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              statusFilter === "Aprobado"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                : "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 hover:border-emerald-300"
            }`}
          >
            <span className="text-xs uppercase font-bold tracking-wider block opacity-80">
              Aprobadas / Avaladas
            </span>
            <p className="text-2xl sm:text-3xl font-black mt-1">{counts.aprobadas}</p>
          </button>
        </div>
      </div>

      {/* ─── SECCIÓN DINÁMICA: Panel de Prácticas O Vista de Solicitudes ─── */}
      {selectedPracticeId === null ? (
        /* ============================================================
           VISTA A: PANEL DE PRÁCTICAS A CARGO
           ============================================================ */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" /> Tus Prácticas a Cargo ({filteredPractices.length})
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Selecciona una práctica para revisar y avalar las solicitudes de certificados de tus estudiantes.
              </p>
            </div>

            {/* Buscador de prácticas */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={practiceSearchTerm}
                onChange={(e) => setPracticeSearchTerm(e.target.value)}
                placeholder="Buscar práctica, IPS o servicio..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-gray-400 animate-pulse">
              Cargando prácticas y solicitudes reales...
            </div>
          ) : filteredPractices.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl border border-gray-200 dark:border-zinc-800 text-center">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-40" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                No tienes prácticas formativas registradas
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                Cuando tengas prácticas asignadas, aparecerán aquí para gestionar sus certificados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPractices.map((pr) => {
                const pendingInPractice = requests.filter(
                  (r) => String(r.practica_id) === String(pr.id) && r.estado === "Pendiente"
                ).length;
                const approvedInPractice = requests.filter(
                  (r) => String(r.practica_id) === String(pr.id) && r.estado === "Aprobado"
                ).length;

                return (
                  <div
                    key={pr.id}
                    onClick={() => setSelectedPracticeId(pr.id)}
                    className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-xl transition duration-200 cursor-pointer flex flex-col justify-between select-none"
                  >
                    <div>
                      {/* Estado y Periodo */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
                          #{pr.id} · {pr.estado || "Activa"}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
                          Periodo {pr.periodo || "2026-1"}
                        </span>
                      </div>

                      {/* Título */}
                      <h3 className="text-base font-black text-gray-900 dark:text-white leading-snug line-clamp-2">
                        {pr.titulo}
                      </h3>

                      {/* Entidad e IPS */}
                      <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800">
                        <p className="truncate flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" /> <span><strong>IPS:</strong> {pr.institucion_nombre || "Hospital Universitario"}</span>
                        </p>
                        <p className="truncate flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-gray-400 shrink-0" /> <span><strong>Servicio:</strong> {pr.servicio_nombre || "Servicio Asistencial"}</span>
                        </p>
                      </div>
                    </div>

                    {/* Footer con contadores y botón */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="text-gray-500 dark:text-zinc-400 font-medium">
                          Solicitudes:
                        </span>
                        {pendingInPractice > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {pendingInPractice} pendiente{pendingInPractice > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" /> {approvedInPractice > 0 ? `${approvedInPractice} avalada(s)` : "0 pendientes"}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPracticeId(pr.id);
                        }}
                        className="w-full py-2.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Entrar a la Práctica</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ============================================================
           VISTA B: SOLICITUDES DE LA PRÁCTICA SELECCIONADA
           ============================================================ */
        <div className="space-y-5">
          {/* Banner de Práctica Seleccionada con Botón para Volver */}
          <div className="bg-amber-50/70 dark:bg-zinc-900 p-4 sm:p-5 rounded-3xl border border-amber-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Práctica #{currentPractice?.id}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    {currentPractice?.estado || "Activa"}
                  </span>
                </div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                  {currentPractice?.titulo}
                </h2>
                <p className="text-xs text-gray-600 dark:text-zinc-400">
                  {currentPractice?.institucion_nombre || "Hospital Universitario"} • {currentPractice?.servicio_nombre || "Rotación"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedPracticeId(null)}
              className="self-start sm:self-auto px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-700 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>←</span>
              <span>Cambiar de Práctica</span>
            </button>
          </div>

          {/* Buscador dentro de la práctica */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre de estudiante o tipo de certificado..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Listado de Solicitudes */}
          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl shadow-sm border border-gray-200 dark:border-zinc-800 text-center">
                <Award className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-40" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  No hay solicitudes de certificados en esta práctica
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                  En esta práctica no se registran solicitudes pendientes por avalar. Cuando los estudiantes a cargo radiquen una solicitud, la verás aquí.
                </p>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-zinc-800 hover:shadow-md transition duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1">
                    {/* Cabecera con estado y fecha */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border ${
                          req.estado === "Aprobado"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse"
                        }`}
                      >
                        {req.estado === "Aprobado" ? "● Aprobada y Avalada" : "⏳ Pendiente de tu Firma"}
                      </span>

                      <span className="text-xs text-gray-500 dark:text-zinc-400">
                        Radicada el:{" "}
                        {new Date(req.fecha_solicitud).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {req.estudiante_calificacion && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                          Nota: {Number(req.estudiante_calificacion).toFixed(1)} / 5.0
                        </span>
                      )}
                    </div>

                    {/* Estudiante y Tipo de Certificado */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {req.estudiante_nombre}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-zinc-400 font-mono">
                          (C.C. {req.estudiante_cedula})
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Solicitud:{" "}
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          {req.tipo_certificado}
                        </span>
                      </p>
                    </div>

                    {/* Ficha de la práctica */}
                    <div className="p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-100 dark:border-zinc-800 text-xs text-gray-600 dark:text-zinc-300 space-y-1">
                      <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Hospital className="w-3.5 h-3.5 text-blue-500" />
                        <strong>Práctica:</strong> {req.practica_titulo} ({req.practica_periodo || "2026-1"})
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        <strong>Sede / IPS:</strong> {req.institucion_nombre || "Hospital Universitario"} — {req.servicio_nombre || "Servicio"}
                      </p>
                      <p>
                        <strong>Finalidad:</strong> {req.motivo || "Trámite de Grado"} • <strong>Intensidad:</strong> {req.horas_totales || 120} horas
                      </p>
                      {req.observaciones && (
                        <p className="italic text-gray-500 dark:text-zinc-400 pt-1">
                          "{req.observaciones}"
                        </p>
                      )}
                    </div>

                    {/* Concepto del docente si ya fue avalada */}
                    {req.respuesta_docente && (
                      <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200">
                        <strong>Tu Concepto Docente:</strong> "{req.respuesta_docente}"
                      </div>
                    )}
                  </div>

                  {/* Acciones para el Docente */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-end gap-3 min-w-[200px]">
                    {req.estado === "Pendiente" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenActionModal(req, "approve")}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Avalar y Firmar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenActionModal(req, "reject")}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Rechazar</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDownloadGeneratedCertificate(req)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar Diploma PDF</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Modal para Avalar o Rechazar Solicitud ─── */}
      {selectedRequest && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-zinc-800 max-w-lg w-full p-6 sm:p-7 overflow-hidden">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    modalAction === "approve"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {modalAction === "approve" ? "Aval Institucional" : "Rechazo de Solicitud"}
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {modalAction === "approve" ? "Aprobar Certificado del Estudiante" : "Rechazar Solicitud"}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Datos del estudiante y práctica */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 mb-4 space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
              <p>
                <strong>Estudiante:</strong> {selectedRequest.estudiante_nombre} (C.C. {selectedRequest.estudiante_cedula})
              </p>
              <p>
                <strong>Práctica:</strong> {selectedRequest.practica_titulo}
              </p>
              <p>
                <strong>Tipo de Solicitud:</strong> {selectedRequest.tipo_certificado}
              </p>
            </div>

            {/* Firma oficial del docente */}
            {modalAction === "approve" && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <PenTool className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Firma Oficial: {docentProfile?.nombre_completo || "Docente"}
                    </p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      Se estampará tu firma registrada como rúbrica oficial.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSignaturePreview(docentProfile?.foto_firma || null);
                        setPendingActionAfterSig({ type: "approve", req: selectedRequest });
                        setIsSignatureModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 underline hover:text-emerald-900 dark:hover:text-emerald-100 mt-1 cursor-pointer block"
                    >
                      {docentProfile?.foto_firma ? "Cambiar foto de firma" : "Subir foto de firma"}
                    </button>
                  </div>
                </div>
                {docentProfile?.foto_firma && (
                  <div className="h-10 w-24 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-300 dark:border-emerald-700 p-1 flex items-center justify-center shadow-sm">
                    <img
                      src={docentProfile.foto_firma}
                      alt="Firma"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmitResponse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {modalAction === "approve"
                    ? "Concepto o Nota del Docente para el Certificado"
                    : "Motivo del Rechazo"} *
                </label>
                <textarea
                  rows="3"
                  value={docentResponseNote}
                  onChange={(e) => setDocentResponseNote(e.target.value)}
                  required
                  placeholder="Ingresa las observaciones o concepto oficial..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-md transition duration-150 ${
                    modalAction === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {modalAction === "approve" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  <span>
                    {isSubmitting
                      ? "Procesando..."
                      : modalAction === "approve"
                      ? "Confirmar Aprobación"
                      : "Confirmar Rechazo"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Modal para Cargar Firma Oficial al Instante ─── */}
      {isSignatureModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-zinc-800 max-w-md w-full p-6 sm:p-7 overflow-hidden">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Requisito de Emisión
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  Cargar Firma Oficial
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsSignatureModalOpen(false);
                  setPendingActionAfterSig(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span><strong>Tienes que terminar de subir tus datos primero (foto de la firma)</strong> antes de poder emitir o avalar documentos oficiales con validez institucional.</span>
            </p>

            <form onSubmit={handleSaveSignature} className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-amber-500 rounded-2xl p-5 text-center transition bg-gray-50/50 dark:bg-zinc-800/40">
                {signaturePreview ? (
                  <div className="space-y-3">
                    <div className="h-24 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-2 flex items-center justify-center shadow-inner">
                      <img
                        src={signaturePreview}
                        alt="Vista previa de firma"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Imagen de firma cargada
                    </p>
                    <label className="inline-block text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer underline">
                      Cambiar imagen
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleSignatureFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="w-9 h-9 mx-auto text-amber-500 mb-2 opacity-80" />
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Haz clic para seleccionar tu firma digitalizada
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                      PNG o JPG (fondo blanco o transparente recomendado)
                    </p>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleSignatureFileSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignatureModalOpen(false);
                    setPendingActionAfterSig(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!signaturePreview || isSavingSignature}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition duration-150 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSavingSignature ? "Guardando..." : "Guardar Firma y Continuar"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DocentCertificateRequests;
