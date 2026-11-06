// ============================================================
// DocentProfile.js — Panel de Datos Docente y Firma Digital UPTC
// Permite al docente consultar su información institucional,
// registrar sus datos personales, contacto de emergencia,
// adjuntar sus soportes de práctica (PDF) y gestionar su firma digital oficial.
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { BACKEND_URL } from "../../config/api";
import { useAuth } from "../../utils/useAuth";
import { notifyDataChanged } from "../../utils/dataSync";
import toast from "../../utils/toast";
import {
  User,
  Mail,
  Award,
  IdCard,
  Building,
  GraduationCap,
  Camera,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Save,
  Trash2,
  UploadCloud,
  FileCheck,
  RefreshCw,
  PenTool,
  Info,
  Shield,
  ShieldCheck,
  Phone,
  MapPin,
  HeartHandshake,
  FileText,
  Check,
  Eye,
  Download,
  Sparkles,
  Lock,
  X,
  ExternalLink,
} from "lucide-react";
import { SkeletonProfile } from "../Shared/Skeleton";

const DOCENT_DOCUMENTS_CONFIG = [
  {
    key: "cvDigital",
    dbColumn: "hoja_vida_digital",
    title: "Hoja de Vida Digital",
    description: "Formato institucional o estandarizado en formato PDF.",
    icon: FileText,
  },
  {
    key: "socialSecurity",
    dbColumn: "seguridad_social_eps",
    title: "Seguridad Social (EPS)",
    description: "Certificado de afiliación vigente a EPS.",
    icon: ShieldCheck,
  },
  {
    key: "professionalRisks",
    dbColumn: "riesgos_profesionales_arl",
    title: "Riesgos Laborales (ARL)",
    description: "Certificado de afiliación vigente a Riesgos Laborales ARL.",
    icon: ShieldCheck,
  },
  {
    key: "idCopy",
    dbColumn: "copia_documento_identidad",
    title: "Documento de Identidad",
    description: "Copia legible de la cédula de ciudadanía.",
    icon: IdCard,
  },
  {
    key: "carnetCopy",
    dbColumn: "copia_carnet_docente",
    title: "Carnet Docente / Institucional",
    description: "Copia legible del carnet vigente de la UPTC.",
    icon: GraduationCap,
  },
  {
    key: "vaccines",
    dbColumn: "carnet_vacunas",
    title: "Carnet de Vacunas",
    description: "Esquema completo según requerimientos de salud.",
    icon: FileCheck,
  },
];

const DocentProfile = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Estado del perfil del docente
  const [profile, setProfile] = useState({
    // Datos Institucionales (tabla docente)
    name: "",
    lastName: "",
    fullName: "",
    cedula: "",
    email: "",
    career: "",
    specialty: "",

    // Datos Personales y Complementarios (tabla datos_docente)
    bio: "",
    phone: "",
    address: "",
    personalEmail: "",
    familyContactName: "",
    familyContactPhone: "",

    // Fotos y soportes
    photoFile: null,
    photoPreview: null,
    isNewPhoto: false,
    photoDeleted: false,
    signatureFile: null,
    signaturePreview: null,
    isNewSignature: false,
    signatureDeleted: false,
    documents: {}, // Archivos nuevos seleccionados localmente { key: { name, file } }
    documentsInDB: {}, // Existencia en BD { key: true/false }
  });

  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    title: "",
    url: "",
    downloadUrl: "",
    isImage: false,
  });

  const [photoError, setPhotoError] = useState(false);
  const photoInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  // Obtener cédula de manera robusta
  const getDocentCedula = useCallback(() => {
    if (user?.cedula) return String(user.cedula);
    if (user?.id) return String(user.id);
    try {
      const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
      if (stored) {
        const parsed = JSON.parse(stored);
        return String(parsed.cedula || parsed.Cédula || parsed.id || "");
      }
    } catch (e) {}
    return "";
  }, [user]);

  // Cargar datos completos del perfil docente desde el backend
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    const cedulaDoc = getDocentCedula();
    const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const endpoint = cedulaDoc ? `${BACKEND_URL}/api/docent/details/${cedulaDoc}` : `${BACKEND_URL}/api/docent/details`;
      const res = await fetch(endpoint, { headers });
      const resData = await res.json();

      let d = resData?.data;
      if (!d && res.ok) {
        // Fallback a /api/docent/profile
        const pRes = await fetch(`${BACKEND_URL}/api/docent/profile`, { headers });
        const pData = await pRes.json();
        d = pData?.data;
      }

      const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
      const parsedLocal = stored ? JSON.parse(stored) : {};

      const currentCedula = d?.cedula || cedulaDoc || parsedLocal.cedula || "";
      const currentName = d?.nombre || parsedLocal.nombre || "";
      const currentLastName = d?.apellidos || parsedLocal.apellidos || "";
      const fullName = d?.fullName || d?.nombre_completo || `${currentName} ${currentLastName}`.trim() || "Docente UPTC";

      let photoUrl = null;
      if (typeof d?.foto_perfil === "string" && d.foto_perfil.startsWith("data:")) {
        photoUrl = d.foto_perfil;
      } else if (d?.has_photo || d?.foto_perfil) {
        photoUrl = `${BACKEND_URL}/api/docent/photo/${currentCedula}?v=${Date.now()}`;
      }
      setPhotoError(false);

      let resolvedSig = null;
      if (typeof d?.foto_firma === "string") {
        resolvedSig = d.foto_firma;
      } else if (d?.foto_firma?.data && Array.isArray(d.foto_firma.data)) {
        try {
          const binary = String.fromCharCode.apply(null, d.foto_firma.data);
          resolvedSig = binary.startsWith("data:") ? binary : `data:image/png;base64,${btoa(binary)}`;
        } catch (_) {}
      }

      setProfile((prev) => ({
        ...prev,
        name: currentName,
        lastName: currentLastName,
        fullName: fullName,
        cedula: currentCedula,
        email: d?.correo_institucional || d?.email || parsedLocal.correo_institucional || parsedLocal.email || "",
        career: d?.career || d?.programa || parsedLocal.nombreprograma || "Facultad de Ciencias de la Salud",
        specialty: d?.especialidad || parsedLocal.especialidad || "",

        bio: d?.bio || d?.biografia || "",
        phone: d?.phone || d?.telefono || "",
        address: d?.address || d?.direccion || "",
        personalEmail: d?.personalEmail || d?.correo_personal || "",
        familyContactName: d?.familyContactName || d?.nombre_familiar || "",
        familyContactPhone: d?.familyContactPhone || d?.telefono_familiar || "",

        photoPreview: photoUrl,
        signaturePreview: resolvedSig,
        documentsInDB: {
          cvDigital: !!d?.cvDigital || !!d?.has_cv,
          socialSecurity: !!d?.socialSecurity || !!d?.has_eps,
          professionalRisks: !!d?.professionalRisks || !!d?.has_arl,
          idCopy: !!d?.idCopy || !!d?.has_id,
          carnetCopy: !!d?.carnetCopy || !!d?.has_carnet,
          vaccines: !!d?.vaccines || !!d?.has_vaccines,
        },
        documents: {},
        photoFile: null,
        isNewPhoto: false,
        photoDeleted: false,
        signatureFile: null,
        isNewSignature: false,
        signatureDeleted: false,
      }));
    } catch (err) {
      console.error("Error al cargar perfil docente:", err);
      toast.error("Error de conexión al cargar datos del docente.");
    } finally {
      setIsLoading(false);
    }
  }, [getDocentCedula]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Manejo de campos de texto editables
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numericFields = ["phone", "familyContactPhone"];

    if (numericFields.includes(name)) {
      const numericValue = value.replace(/[^0-9]/g, "");
      setProfile((prev) => ({ ...prev, [name]: numericValue }));
    } else {
      setProfile((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Manejo de Foto de Perfil
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.warning("La imagen no debe superar los 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoError(false);
      setProfile((prev) => ({
        ...prev,
        photoFile: file,
        photoPreview: event.target?.result,
        isNewPhoto: true,
        photoDeleted: false,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Manejo de Foto de Firma Digital Oficial
  const handleSignatureSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen válida para la firma (PNG, JPG).");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.warning("El archivo de firma no debe superar los 4 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setProfile((prev) => ({
        ...prev,
        signatureFile: file,
        signaturePreview: event.target?.result,
        isNewSignature: true,
        signatureDeleted: false,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Manejo de Documentos (PDF e imágenes de cédula / carnet)
  const handleDocumentSelect = (e, docKey) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    const isImageAllowed = docKey === "idCopy" || docKey === "carnetCopy";
    const isPdf = fileNameLower.endsWith(".pdf");
    const isImg = fileNameLower.endsWith(".jpg") || fileNameLower.endsWith(".jpeg") || fileNameLower.endsWith(".png") || fileNameLower.endsWith(".webp");

    if (isImageAllowed ? (!isPdf && !isImg) : !isPdf) {
      toast.error(
        isImageAllowed
          ? "El documento debe ser un archivo PDF (.pdf) o imagen (.jpg, .png, .webp)."
          : "El soporte adjuntado debe ser un archivo en formato PDF (.pdf)."
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.warning("El archivo no debe exceder 10 MB.");
      return;
    }

    setProfile((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [docKey]: { file, name: file.name },
      },
    }));
    toast.success(`Archivo "${file.name}" cargado localmente. Haz clic en Guardar para registrar.`);
  };

  // Guardar Cambios (Datos personales, foto, firma y documentos)
  const handleSaveProfile = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    const cedulaDoc = profile.cedula || getDocentCedula();

    if (!cedulaDoc) {
      setErrorMessage("No se pudo identificar la cédula del docente.");
      return;
    }

    // Validaciones básicas de campos
    if (!profile.phone || String(profile.phone).trim() === "") {
      setErrorMessage("El campo Teléfono / Celular es obligatorio.");
      return;
    }
    if (!profile.personalEmail || String(profile.personalEmail).trim() === "") {
      setErrorMessage("El campo Correo Personal es obligatorio.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.personalEmail)) {
      setErrorMessage("El correo personal no tiene un formato válido.");
      return;
    }

    if (
      (profile.phone && !/^\d+$/.test(String(profile.phone).trim())) ||
      (profile.familyContactPhone && !/^\d+$/.test(String(profile.familyContactPhone).trim()))
    ) {
      setErrorMessage("Los teléfonos deben contener solo números.");
      return;
    }

    setIsSaving(true);
    const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || localStorage.getItem("token") || sessionStorage.getItem("token");

    try {
      const formData = new FormData();
      formData.append("cedula", cedulaDoc);
      formData.append("biografia", profile.bio || "");
      formData.append("direccion", profile.address || "");
      formData.append("telefono", profile.phone || "");
      formData.append("correo_personal", profile.personalEmail || "");
      formData.append("nombre_familiar", profile.familyContactName || "");
      formData.append("telefono_familiar", profile.familyContactPhone || "");

      // Foto de perfil
      if (profile.photoFile) {
        formData.append("foto_perfil", profile.photoFile);
      } else if (profile.isNewPhoto && profile.photoPreview && profile.photoPreview.startsWith("data:")) {
        formData.append("foto_perfil", profile.photoPreview);
      } else if (profile.photoDeleted) {
        formData.append("eliminar_foto_perfil", "true");
      }

      // Foto de firma
      if (profile.signatureFile) {
        formData.append("foto_firma", profile.signatureFile);
      } else if (profile.isNewSignature && profile.signaturePreview && profile.signaturePreview.startsWith("data:")) {
        formData.append("foto_firma", profile.signaturePreview);
      } else if (profile.signatureDeleted) {
        formData.append("eliminar_foto_firma", "true");
      }

      // Documentos PDF
      DOCENT_DOCUMENTS_CONFIG.forEach((doc) => {
        const localDoc = profile.documents[doc.key]?.file;
        if (localDoc) {
          formData.append(doc.dbColumn, localDoc);
        }
      });

      const res = await fetch(`${BACKEND_URL}/api/docent/insert`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "Error al actualizar expediente del docente.");
      }

      // Actualizar sesión y navbar reactivamente
      const updatedPhotoUrl = `${BACKEND_URL}/api/docent/photo/${cedulaDoc}?v=${Date.now()}`;
      ["userData", "user"].forEach((key) => {
        try {
          const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.has_photo = Boolean(profile.photoPreview);
            parsed.foto_url = updatedPhotoUrl;
            delete parsed.foto_perfil;
            localStorage.setItem(key, JSON.stringify(parsed));
            sessionStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch (e) {}
      });

      // Guardar firma local para generador de reportes
      if (profile.signaturePreview) {
        try { localStorage.setItem("uptc_cert_signature", profile.signaturePreview); } catch (e) {}
        try { localStorage.setItem("uptc_report_docent_sig", profile.signaturePreview); } catch (e) {}
      }

      window.dispatchEvent(new CustomEvent("uptc:profile-updated", { detail: { foto_perfil: updatedPhotoUrl, cedula: cedulaDoc } }));
      window.dispatchEvent(new CustomEvent("uptc:profile-photo-updated", { detail: { foto_perfil: updatedPhotoUrl, cedula: cedulaDoc } }));
      window.dispatchEvent(new CustomEvent("uptc:user-data-updated", { detail: { foto_perfil: updatedPhotoUrl, cedula: cedulaDoc } }));
      notifyDataChanged("docent-profile", "update");

      setSuccessMessage("¡Datos y soportes documentales guardados exitosamente en la base de datos!");
      toast.success("¡Expediente docente actualizado con éxito en la base de datos!");
      await fetchProfile();
    } catch (err) {
      console.error("Error al guardar datos del docente:", err);
      setErrorMessage(err.message || "Ocurrió un error al guardar los datos.");
      toast.error(err.message || "Error al guardar el expediente.");
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    }
  };

  const getInitials = (name) => {
    if (!name) return "DOC";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join("");
  };

  const completedDocsCount = DOCENT_DOCUMENTS_CONFIG.filter(
    (doc) => profile.documents[doc.key]?.file || profile.documentsInDB[doc.key]
  ).length;

  const missingDocs = DOCENT_DOCUMENTS_CONFIG.filter(
    (doc) => !profile.documents[doc.key]?.file && !profile.documentsInDB[doc.key]
  );

  if (isLoading) {
    return <SkeletonProfile />;
  }

  const token = typeof window !== "undefined"
    ? localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-7 pb-16">
      {/* ─── Encabezado Principal y Hero Banner ─── */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900 shadow-inner">
              <User className="w-8 h-8" />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  Expediente y Perfil del Docente
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  Docente Tutor
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Consulta tu información institucional, actualiza tus datos de contacto, sube tus soportes de práctica y administra tu firma digital.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchProfile}
              disabled={isLoading}
              title="Recargar datos"
              className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition border border-gray-200 dark:border-zinc-700 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-purple-500" : ""}`} />
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/30 transition duration-150 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          </div>
        </div>

        {/* Mensajes de Alerta */}
        {errorMessage && (
          <div className="mt-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Resumen y Barra de Progreso de Soportes */}
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/50">
            <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400 block">Soportes Requeridos</span>
              <div className="flex items-center justify-between text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                <span>{completedDocsCount} de {DOCENT_DOCUMENTS_CONFIG.length} documentos completos</span>
                <span>{Math.round((completedDocsCount / DOCENT_DOCUMENTS_CONFIG.length) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-purple-600 transition-all duration-300 rounded-full"
                  style={{ width: `${(completedDocsCount / DOCENT_DOCUMENTS_CONFIG.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800">
            <PenTool className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400 block">Firma Digital Oficial</span>
              <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                {profile.signaturePreview ? "Firma Registrada y Vigente" : "Pendiente por Adjuntar"}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                {profile.signaturePreview ? "Lista para estampar en certificados y reportes" : "Sube tu rúbrica abajo para avalar prácticas"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECCIÓN 1: DATOS INSTITUCIONALES (SOLO LECTURA) ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> No Modificable
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5">
              Información Institucional Oficial
            </h2>
          </div>
          <span className="text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800/60 font-medium flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Verificada por la UPTC
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Nombres y Apellidos
            </span>
            <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white block">
              {profile.fullName || `${profile.name} ${profile.lastName}`}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <IdCard className="w-3.5 h-3.5" /> Documento de Identidad
            </span>
            <span className="text-sm sm:text-base font-mono font-bold text-gray-900 dark:text-white block">
              C.C. {profile.cedula || "N/A"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Correo Institucional
            </span>
            <span className="text-xs sm:text-sm font-mono text-gray-800 dark:text-zinc-200 truncate block" title={profile.email}>
              {profile.email || "N/A"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" /> Programa / Escuela
            </span>
            <span className="text-sm font-bold text-purple-700 dark:text-purple-400 block">
              {profile.career || "Facultad de Ciencias de la Salud"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" /> Dependencia Institucional
            </span>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
              Universidad Pedagógica y Tecnológica de Colombia (UPTC)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
            <span className="text-xs font-medium text-purple-800 dark:text-purple-300 mb-1 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-purple-600" /> Especialidad Clínica
            </span>
            <span className="text-sm font-bold text-purple-900 dark:text-purple-200 block">
              {profile.specialty || "Docencia Clínica y Asistencial"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── SECCIÓN 2: INFORMACIÓN PERSONAL Y DE RESIDENCIA (MODIFICABLE) ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="pb-4 border-b border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
              Campos Modificables
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Información Personal y de Residencia
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Datos personales de contacto y localización para el cuerpo docente.
          </p>
        </div>

        {/* Biografía */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
              Biografía y Perfil Académico / Profesional *
            </label>
            <span className="text-[11px] text-gray-400 dark:text-zinc-500">
              {profile.bio?.length || 0} caracteres
            </span>
          </div>
          <textarea
            name="bio"
            value={profile.bio || ""}
            onChange={handleInputChange}
            rows="3"
            placeholder="Describe tu trayectoria profesional, especialidades clínicas o áreas de investigación docente..."
            className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-2xl text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-none shadow-xs"
          ></textarea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-500" /> Teléfono / Celular *
            </label>
            <input
              type="text"
              name="phone"
              value={profile.phone || ""}
              onChange={handleInputChange}
              inputMode="numeric"
              placeholder="Ej: 3101234567"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-500" /> Correo Personal *
            </label>
            <input
              type="email"
              name="personalEmail"
              value={profile.personalEmail || ""}
              onChange={handleInputChange}
              placeholder="docente@gmail.com"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-500" /> Dirección Residencial *
            </label>
            <input
              type="text"
              name="address"
              value={profile.address || ""}
              onChange={handleInputChange}
              placeholder="Ej: Carrera 10 # 18-45, Tunja"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* ─── SECCIÓN 3: CONTACTO DE EMERGENCIA ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="pb-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Contacto de Emergencia / Familiar
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Persona a quien notificar de inmediato ante cualquier eventualidad durante las rotaciones.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-500" /> Nombre del Contacto Familiar
            </label>
            <input
              type="text"
              name="familyContactName"
              value={profile.familyContactName || ""}
              onChange={handleInputChange}
              placeholder="Ej: Laura Castro (Cónyuge / Familiar)"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-500" /> Teléfono del Contacto Familiar
            </label>
            <input
              type="text"
              name="familyContactPhone"
              value={profile.familyContactPhone || ""}
              onChange={handleInputChange}
              inputMode="numeric"
              placeholder="Ej: 3123456789"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* ─── SECCIÓN 4: DOCUMENTACIÓN Y SOPORTES DIGITALES (PDF) ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="pb-4 border-b border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
              <FileText className="w-3.5 h-3.5" /> Requisitos de Práctica Docente
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Documentación y Soportes Digitales (PDF)
            </h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            Adjuntar exclusivamente archivos en formato PDF (máx. 10 MB).
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOCENT_DOCUMENTS_CONFIG.map((doc) => {
            const DocIcon = doc.icon;
            const localFile = profile.documents[doc.key]?.file;
            const isInDB = profile.documentsInDB[doc.key];
            const isReady = !!localFile || isInDB;
            const docCedula = profile.cedula || getDocentCedula();

            const viewUrl = `${BACKEND_URL}/api/docent/view/${docCedula}/${doc.dbColumn}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
            const downloadUrl = `${BACKEND_URL}/api/docent/download/${docCedula}/${doc.dbColumn}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

            return (
              <div
                key={doc.key}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  localFile
                    ? "bg-purple-50/30 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800"
                    : isInDB
                    ? "bg-gray-50/50 dark:bg-zinc-800/40 border-emerald-300 dark:border-emerald-800/60"
                    : "bg-gray-50/40 dark:bg-zinc-800/20 border-gray-200 dark:border-zinc-800"
                }`}
              >
                <div className="space-y-3 mb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 shadow-xs">
                      <DocIcon className="w-4 h-4" />
                    </div>

                    {localFile ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                        <UploadCloud className="w-3.5 h-3.5" /> Nuevo archivo
                      </span>
                    ) : isInDB ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Registrado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                        <AlertCircle className="w-3.5 h-3.5" /> Pendiente
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-zinc-100 mb-1">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">
                      {doc.description}
                    </p>
                  </div>

                  <div className="text-[11px] font-mono text-gray-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-gray-200 dark:border-zinc-800 truncate flex items-center gap-1.5">
                    {localFile ? (
                      <>
                        <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="truncate">{localFile.name}</span>
                      </>
                    ) : isInDB ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Archivo disponible en el servidor</span>
                      </>
                    ) : (
                      "Sin archivo adjuntado"
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <label
                    htmlFor={`file-${doc.key}`}
                    className="flex-1 py-1.5 px-3 text-center bg-white hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 text-xs font-semibold rounded-lg border border-gray-300 dark:border-zinc-700 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-gray-500" />
                    <span>{isReady ? "Reemplazar" : (doc.key === "idCopy" || doc.key === "carnetCopy" ? "Subir Archivo / Foto" : "Subir PDF")}</span>
                    <input
                      id={`file-${doc.key}`}
                      type="file"
                      accept={
                        doc.key === "idCopy" || doc.key === "carnetCopy"
                          ? ".pdf,application/pdf,image/jpeg,image/png,image/webp"
                          : ".pdf,application/pdf"
                      }
                      onChange={(e) => handleDocumentSelect(e, doc.key)}
                      className="hidden"
                    />
                  </label>

                  {localFile && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = URL.createObjectURL(localFile);
                        setPreviewModal({
                          isOpen: true,
                          title: `${doc.title} (Nuevo Archivo Seleccionado)`,
                          url,
                          downloadUrl: url,
                          isImage: localFile.type?.startsWith("image/"),
                        });
                      }}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                      title="Previsualizar archivo seleccionado"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}

                  {isInDB && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewModal({
                            isOpen: true,
                            title: doc.title,
                            url: viewUrl,
                            downloadUrl,
                            isImage: false,
                          })
                        }
                        className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800 transition cursor-pointer"
                        title="Ver Documento"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <a
                        href={downloadUrl}
                        download
                        className="p-1.5 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 transition"
                        title="Descargar Documento"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── SECCIÓN 5: FOTO DE PERFIL Y FIRMA DIGITAL OFICIAL ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
        {/* Card: Foto de Perfil */}
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Camera className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Foto de Perfil Oficial
              </h2>
            </div>
            <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">PNG / JPG</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group shrink-0">
              {profile.photoPreview && !photoError ? (
                <img
                  src={profile.photoPreview}
                  alt="Foto de perfil del docente"
                  onError={() => setPhotoError(true)}
                  className="w-28 h-28 rounded-full object-cover shadow-lg border-4 border-purple-500/40 ring-4 ring-purple-500/10"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 text-white flex items-center justify-center text-3xl font-black shadow-lg border-4 border-purple-400/30">
                  {getInitials(profile.fullName)}
                </div>
              )}

              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                title="Cambiar foto de perfil"
                className="absolute bottom-1 right-1 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-md border-2 border-white dark:border-zinc-900 transition cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Fotografía Institucional
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Visible para estudiantes, auditores hospitalarios y en los reportes de rotación.
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer border border-gray-300 dark:border-zinc-700"
                >
                  <UploadCloud className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Seleccionar Foto</span>
                </button>

                {profile.photoPreview && (
                  <button
                    type="button"
                    onClick={() => setProfile((prev) => ({ ...prev, photoPreview: null, photoFile: null, photoDeleted: true, isNewPhoto: false }))}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card: Foto de la Firma Digital Oficial */}
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <PenTool className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Firma Digital Oficial
              </h2>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Requerida
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Esta rúbrica se estampará automáticamente al avalar rotaciones, emitir certificados oficiales y suscribir constancias.
          </p>

          <div className="p-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/70 dark:bg-zinc-800/40 flex flex-col items-center justify-center min-h-[140px] text-center">
            {profile.signaturePreview ? (
              <div className="space-y-2 w-full flex flex-col items-center">
                <div className="max-w-xs w-full bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-inner border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                  <img
                    src={profile.signaturePreview}
                    alt="Firma digital oficial"
                    className="max-h-20 max-w-full object-contain filter contrast-125"
                  />
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Rúbrica oficial registrada
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 py-2">
                <PenTool className="w-8 h-8 text-gray-400 dark:text-zinc-600 mx-auto" />
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Sin firma digital cargada
                </p>
                <p className="text-[10.5px] text-gray-500 dark:text-gray-400">
                  Adjunta una imagen limpia de tu firma sobre fondo blanco.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <input
              type="file"
              ref={signatureInputRef}
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleSignatureSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => signatureInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{profile.signaturePreview ? "Cambiar Firma" : "Adjuntar Firma"}</span>
            </button>

            {profile.signaturePreview && (
              <button
                type="button"
                onClick={() => setProfile((prev) => ({ ...prev, signaturePreview: null, signatureFile: null, signatureDeleted: true, isNewSignature: false }))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Sección Inferior: Mensajes de Falta de Documentos y Botón de Guardado ─── */}
      <div className="space-y-4 pt-4">
        {/* Alerta de Error al final del panel */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs sm:text-sm font-semibold flex items-center gap-3 shadow-md animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Alerta de Éxito al final del panel */}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-3 shadow-md animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1">{successMessage}</div>
          </div>
        )}

        {/* Alerta informativa de documentos faltantes al final del panel */}
        {missingDocs.length > 0 && !errorMessage && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">
                Faltan {missingDocs.length} de {DOCENT_DOCUMENTS_CONFIG.length} soportes requeridos por adjuntar:
              </span>
              <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                {missingDocs.map((d) => d.title).join(", ")}.
              </p>
            </div>
          </div>
        )}

        {/* Barra de acción final con botón de Guardar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl">
          <div className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-purple-500 shrink-0" />
            <span>
              {completedDocsCount === DOCENT_DOCUMENTS_CONFIG.length
                ? "Todos los soportes requeridos han sido adjuntados satisfactoriamente."
                : "Recuerda completar todos tus datos y soportes antes de guardar el expediente."}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-black bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-600/30 transition duration-150 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Guardando Expediente...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Guardar Expediente Completo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de Previsualización Rápida de Soportes (PDF / Cédula / Carnet) */}
      {previewModal.isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 w-full max-w-4xl h-[88vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-950">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    {previewModal.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={previewModal.downloadUrl || previewModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en Pestaña</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewModal({ isOpen: false, title: "", url: "", downloadUrl: "", isImage: false })
                    }
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-lg transition cursor-pointer"
                    title="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-gray-100 dark:bg-zinc-950 p-2 sm:p-4 overflow-auto flex items-center justify-center">
                {previewModal.isImage ? (
                  <img
                    src={previewModal.url}
                    alt={previewModal.title}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-lg border border-gray-300 dark:border-zinc-800"
                  />
                ) : (
                  <iframe
                    src={previewModal.url}
                    className="w-full h-full rounded-xl border border-gray-300 dark:border-zinc-800 bg-white"
                    title="Previsualización de Documento"
                  ></iframe>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DocentProfile;
