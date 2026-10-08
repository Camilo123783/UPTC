import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  User,
  Mail,
  FileText,
  CheckCircle2,
  AlertCircle,
  Camera,
  Download,
  Eye,
  Phone,
  MapPin,
  Lock,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Save,
  UploadCloud,
  X,
  HeartHandshake,
  IdCard,
  FileCheck,
  RefreshCw,
  Check,
  Clock,
} from "lucide-react";
import { API_URL, BACKEND_URL } from "../../config/api";

// --- RESOLUCIÓN ROBUSTA DE SESIÓN Y CREDENCIALES ---
const getStoredUser = () => {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const raw = storage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) return parsed;
      }
    } catch (e) {}
  }
  return null;
};

const getStudentCedula = () => {
  const u = getStoredUser();
  if (u?.cedula) return String(u.cedula);
  if (u?.Cédula) return String(u.Cédula);
  if (u?.studentId) return String(u.studentId);
  if (u?.id) return String(u.id);

  for (const storage of [localStorage, sessionStorage]) {
    try {
      const token = storage.getItem("authToken");
      if (token && token.includes(".")) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload?.cedula) return String(payload.cedula);
        if (payload?.id) return String(payload.id);
      }
    } catch (e) {}
  }
  return null;
};

const getAuthToken = () => {
  return (
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
};

/**
 * Normaliza la URL de la foto de perfil para que apunte con absoluta certeza
 * a la URL base activa del backend y no a rutas relativas rotas o puertos cruzados.
 */
const normalizePhotoUrl = (rawUrl, cedula) => {
  if (!rawUrl && !cedula) return null;
  if (rawUrl && (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:"))) return rawUrl;
  let path = `/api/student/photo/${cedula}`;
  if (rawUrl) {
    if (rawUrl.startsWith("/api/student/photo/")) {
      path = rawUrl;
    } else if (rawUrl.includes("/api/student/photo/")) {
      path = rawUrl.substring(rawUrl.indexOf("/api/student/photo/"));
    }
  }
  const sep = path.includes("?") ? "&" : "?";
  return `${BACKEND_URL}${path}${sep}v=${Date.now()}`;
};

/**
 * Comprime y redimensiona la imagen de perfil en el cliente usando HTML5 Canvas.
 * Convierte a JPEG estándar de alta calidad (500x500 máx, ~40-60 KB) para carga instantánea
 * universal sin problemas de compatibilidad en ningún navegador.
 */
const compressImage = (file, maxWidth = 500, maxHeight = 500, quality = 0.85) => {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ file, dataUrl: null });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        // Fondo blanco para imágenes transparentes que se convierten a JPEG
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({ file, dataUrl: e.target.result });
              return;
            }
            const cleanName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
            const compressedFile = new File([blob], cleanName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve({ file: compressedFile, dataUrl });
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve({ file, dataUrl: e.target.result });
      img.src = e.target.result;
    };
    reader.onerror = () => resolve({ file, dataUrl: null });
    reader.readAsDataURL(file);
  });
};

// --- CONSTANTES DE ENDPOINTS ---
const API_BASE_URL = `${API_URL}/student/profile`;
const API_DETAILS_URL = `${API_URL}/student/details`;
const API_INSERT_URL = `${API_URL}/student/insert`;

// Mapeo de claves frontend a nombres de columnas en la BD
const DOCUMENT_CONFIGS = [
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
    dbColumn: "copia_carnet_estudiantil",
    title: "Carnet Estudiantil",
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

const StudentProfile = () => {
  // Estado del perfil
  const [profile, setProfile] = useState({
    // Datos Institucionales (tabla estudiante) - Solo lectura
    name: "",
    lastName: "",
    email: "",
    studentId: "",
    code: "",
    career: "",
    semester: "",
    estado: "Pendiente",

    // Datos Personales y Complementarios (tabla datos_estudiante) - Modificables
    bio: "",
    phone: "",
    address: "",
    personalEmail: "",
    familyContactName: "",
    familyContactPhone: "",

    // Archivos y previsualizaciones
    photoFile: null,
    photoPreview: null,
    documents: {}, // Archivos nuevos { cvDigital: { name, file } }
    documentsInDB: {}, // Existencia en BD { cvDigital: true/false }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [photoError, setPhotoError] = useState(false);
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    title: "",
    url: "",
  });

  // =========================================================================
  // CARGA ROBUSTA Y PARALELA DE DATOS DEL ESTUDIANTE
  // =========================================================================
  const fetchStudentData = useCallback(async (cedulaParam) => {
    const id = cedulaParam || getStudentCedula();

    if (!id) {
      console.warn("No se encontró cédula de estudiante para cargar.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const token = getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // Cargar datos en paralelo con control de errores individual
      const [profileRes, detailsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/${id}`, { headers }).catch((err) => ({
          ok: false,
          error: err,
        })),
        fetch(`${API_DETAILS_URL}/${id}`, { headers }).catch((err) => ({
          ok: false,
          error: err,
        })),
      ]);

      let initialData = {};
      let detailsData = {};
      let docsInDB = {};

      if (profileRes && profileRes.ok) {
        initialData = await profileRes.json();
      } else {
        console.warn("Respuesta no OK en datos principales del perfil");
      }

      if (detailsRes && detailsRes.ok) {
        const result = await detailsRes.json();
        if (result && result.data) {
          detailsData = result.data;
          docsInDB = {
            cvDigital: !!detailsData.cvDigital,
            socialSecurity: !!detailsData.socialSecurity,
            professionalRisks: !!detailsData.professionalRisks,
            idCopy: !!detailsData.idCopy,
            carnetCopy: !!detailsData.carnetCopy,
            vaccines: !!detailsData.vaccines,
          };
        }
      }

      // Datos de respaldo almacenados en el navegador
      const localUser = getStoredUser();

      setProfile((prev) => ({
        ...prev,
        // Datos Institucionales oficiales (tabla estudiante)
        name: initialData.name || localUser?.nombre || prev.name,
        lastName:
          initialData.lastName ||
          localUser?.apellidos ||
          localUser?.apellido ||
          prev.lastName,
        email:
          initialData.email ||
          localUser?.correo_institucional ||
          localUser?.email ||
          prev.email,
        studentId: initialData.studentId || id,
        code:
          initialData.code ||
          detailsData.code ||
          localUser?.codigo ||
          prev.code ||
          "",
        career:
          initialData.career ||
          localUser?.carrera ||
          localUser?.nombreprograma ||
          prev.career,
        semester: initialData.semester
          ? String(initialData.semester)
          : prev.semester,

        // Datos Personales adicionales (tabla datos_estudiante)
        bio: detailsData.bio ?? prev.bio ?? "",
        phone: detailsData.phone ?? prev.phone ?? "",
        address: detailsData.address ?? prev.address ?? "",
        personalEmail: detailsData.personalEmail ?? prev.personalEmail ?? "",
        familyContactName:
          detailsData.familyContactName ?? prev.familyContactName ?? "",
        familyContactPhone:
          detailsData.familyContactPhone ?? prev.familyContactPhone ?? "",

        // Foto y documentos
        photoPreview: normalizePhotoUrl(detailsData.photoPreview, id) || prev.photoPreview,
        documentsInDB: docsInDB,
        estado: detailsData.estado || initialData.estado || prev.estado || "Pendiente",
      }));
      setPhotoError(false);
    } catch (err) {
      console.error("Error al obtener expediente del estudiante:", err);
      setError("No se pudo cargar la información del perfil.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cedula = getStudentCedula();
    if (cedula) {
      fetchStudentData(cedula);
    } else {
      // Reintento breve en caso de que el storage se esté hidratando
      const timer = setTimeout(() => {
        const retryCedula = getStudentCedula();
        if (retryCedula) {
          fetchStudentData(retryCedula);
        } else {
          setIsLoading(false);
          setError("No se encontró una sesión activa de estudiante.");
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [fetchStudentData]);

  // Manejador de campos de texto editables
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

  // Manejador de foto de perfil con compresión automática
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)) {
        setErrorMessage("La foto de perfil debe ser JPG, PNG o WEBP.");
        return;
      }
      setErrorMessage("");
      try {
        const { file: compressedFile, dataUrl } = await compressImage(file);
        setProfile((prev) => ({
          ...prev,
          photoFile: compressedFile,
          photoPreview: dataUrl,
        }));
        setPhotoError(false);
      } catch (err) {
        console.warn("Fallo en compresión de imagen, usando archivo original:", err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setProfile((prev) => ({
            ...prev,
            photoFile: file,
            photoPreview: reader.result,
          }));
          setPhotoError(false);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Manejador de documentos PDF
  const handleFileChange = (e, docKey) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setErrorMessage("El soporte adjuntado debe ser un archivo PDF.");
        return;
      }
      setErrorMessage("");
      setProfile((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [docKey]: { name: file.name, file },
        },
        documentsInDB: { ...prev.documentsInDB, [docKey]: false },
      }));
    }
  };

  // Previsualizar o descargar documento
  const handlePreviewDocument = (docKey) => {
    const docConfig = DOCUMENT_CONFIGS.find((d) => d.key === docKey);
    if (!docConfig) return;

    // Archivo local nuevo seleccionado
    const localFile = profile.documents[docKey]?.file;
    if (localFile) {
      const url = URL.createObjectURL(localFile);
      setPreviewModal({
        isOpen: true,
        title: `${docConfig.title} (Archivo Local)`,
        url,
      });
      return;
    }

    // Archivo ya registrado en el servidor
    if (profile.documentsInDB[docKey]) {
      const token = getAuthToken();
      const currentCedula = profile.studentId || getStudentCedula();
      const downloadUrl = `${API_URL}/student/download/${currentCedula}/${docConfig.dbColumn}?token=${encodeURIComponent(token)}`;
      window.open(downloadUrl, "_blank");
    }
  };

  // Guardar cambios del perfil
  const handleSaveProfile = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const currentCedula = profile.studentId || getStudentCedula();

    if (!currentCedula) {
      return setErrorMessage("No se pudo verificar la cédula del estudiante.");
    }

    // Validaciones de campos obligatorios editables (el código no se valida aquí)
    const requiredFields = [
      { field: "bio", label: "Biografía" },
      { field: "address", label: "Dirección Residencial" },
      { field: "phone", label: "Teléfono / Celular" },
      { field: "personalEmail", label: "Correo Personal" },
      { field: "familyContactName", label: "Nombre de Contacto Familiar" },
      { field: "familyContactPhone", label: "Teléfono de Contacto Familiar" },
    ];

    const empty = requiredFields.find(
      ({ field }) => !profile[field] || String(profile[field]).trim() === ""
    );
    if (empty) {
      return setErrorMessage(`El campo "${empty.label}" es obligatorio.`);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.personalEmail)) {
      return setErrorMessage("El correo personal ingresado no tiene un formato válido.");
    }

    if (
      !/^\d+$/.test(profile.phone) ||
      !/^\d+$/.test(profile.familyContactPhone)
    ) {
      return setErrorMessage("Los teléfonos deben contener solo números.");
    }

    // Validaciones de documentos
    const missingDoc = DOCUMENT_CONFIGS.find(
      ({ key }) => !profile.documents[key] && !profile.documentsInDB[key]
    );

    if (missingDoc) {
      return setErrorMessage(
        `El documento "${missingDoc.title}" es obligatorio y debe ser adjuntado.`
      );
    }

    if (!profile.photoFile && !profile.photoPreview) {
      return setErrorMessage("La foto de perfil es obligatoria.");
    }

    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("cedula", currentCedula);
      formData.append("biografia", profile.bio);
      formData.append("direccion", profile.address);
      formData.append("telefono", profile.phone);
      formData.append("correo_personal", profile.personalEmail);
      formData.append("nombre_familiar", profile.familyContactName);
      formData.append("telefono_familiar", profile.familyContactPhone);

      // Foto
      if (profile.photoFile) {
        formData.append("foto_perfil", profile.photoFile);
      }

      // PDFs
      DOCUMENT_CONFIGS.forEach(({ key, dbColumn }) => {
        const docObj = profile.documents[key];
        if (docObj?.file) {
          formData.append(dbColumn, docObj.file);
        }
      });

      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(API_INSERT_URL, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let serverMsg = "Error al actualizar la información.";
        try {
          const parsed = JSON.parse(errorText);
          serverMsg = parsed.message || parsed.error || serverMsg;
        } catch {
          if (!errorText.includes("<")) serverMsg = errorText;
        }
        throw new Error(serverMsg);
      }

      let updatedPhotoUrl = `${BACKEND_URL}/api/student/photo/${currentCedula}?t=${Date.now()}`;
      try {
        const resText = await response.text();
        const resJson = JSON.parse(resText);
        if (resJson.photoUrl) {
          updatedPhotoUrl = `${BACKEND_URL}${resJson.photoUrl}`;
        }
      } catch (e) {}

      setSuccessMessage("¡Perfil y documentación actualizados correctamente!");
      setProfile((prev) => ({
        ...prev,
        photoFile: null,
        photoPreview: prev.photoPreview || updatedPhotoUrl,
      }));
      setPhotoError(false);
      window.dispatchEvent(
        new CustomEvent("uptc:profile-updated", {
          detail: { foto_perfil: updatedPhotoUrl, cedula: currentCedula },
        })
      );
      // Refrescar expediente del estudiante
      fetchStudentData(currentCedula);

      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    } catch (err) {
      console.error("Error al guardar:", err);
      setErrorMessage(`Error al guardar perfil: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Conteo de documentos cargados
  const completedDocsCount = useMemo(() => {
    return DOCUMENT_CONFIGS.reduce((count, doc) => {
      const hasLocal = !!profile.documents[doc.key]?.file;
      const hasDB = !!profile.documentsInDB[doc.key];
      return count + (hasLocal || hasDB ? 1 : 0);
    }, 0);
  }, [profile.documents, profile.documentsInDB]);

  // =========================================================================
  // ESTADOS DE CARGA Y ERROR
  // =========================================================================
  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-md">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-gray-800 dark:text-zinc-200 font-semibold text-base">
            Cargando información del estudiante...
          </p>
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            Sincronizando datos académicos y soportes
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 p-8 rounded-3xl max-w-md text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            No se pudo cargar el perfil
          </h2>
          <p className="text-gray-600 dark:text-zinc-400 text-sm mb-5">{error}</p>
          <button
            onClick={() => fetchStudentData(getStudentCedula())}
            className="px-5 py-2.5 bg-gray-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl font-semibold text-sm transition-all cursor-pointer shadow-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-gray-900 dark:text-zinc-100 transition-colors duration-200">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ================================================================= */}
        {/* HERO BANNER: PERFIL DEL ESTUDIANTE */}
        {/* ================================================================= */}
        <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 sm:p-6 md:p-8 shadow-sm transition-colors">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            {/* Foto de Perfil */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                {profile.photoPreview && !photoError ? (
                  <img
                    src={profile.photoPreview}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                    onError={() => setPhotoError(true)}
                    onLoad={() => setPhotoError(false)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-zinc-800 text-blue-700 dark:text-blue-300 font-extrabold text-2xl select-none">
                    {((profile.name || "E").trim().charAt(0)).toUpperCase()}
                  </div>
                )}
              </div>
              <label
                htmlFor="photoUpload"
                className="absolute -bottom-2 -right-2 p-2 bg-gray-900 hover:bg-black dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl shadow cursor-pointer transition-transform hover:scale-110 active:scale-95 border border-white/20"
                title="Actualizar foto de perfil"
              >
                <Camera className="w-3.5 h-3.5" />
                <input
                  id="photoUpload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Datos Resumen */}
            <div className="flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Estudiante UPTC
                </span>

                {profile.code && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                    <GraduationCap className="w-3.5 h-3.5" /> Cód: {profile.code}
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
                  <IdCard className="w-3.5 h-3.5 text-gray-500" /> CC: {profile.studentId || "N/A"}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {profile.name || "Estudiante"} {profile.lastName || ""}
                </h1>

                {/* Estado académico avalado por el docente tutor */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${
                    (profile.estado || "").toLowerCase() === "activo"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800"
                  }`}
                  title={`Estado institucional determinado por el docente tutor: ${profile.estado || "Pendiente"}`}
                >
                  {(profile.estado || "").toLowerCase() === "activo" ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Activo</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Pendiente</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs sm:text-sm text-gray-600 dark:text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                  <GraduationCap className="w-4 h-4" />
                  {profile.career || "Programa Académico sin asignar"}
                </span>
                <span className="hidden sm:inline text-gray-300 dark:text-zinc-700">•</span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {profile.email || "correo@uptc.edu.co"}
                </span>
              </div>

              {/* Barra de progreso de soportes */}
              <div className="pt-2 max-w-md">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
                  <span>Documentos de práctica cargados</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {completedDocsCount} / {DOCUMENT_CONFIGS.length} completos
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{
                      width: `${(completedDocsCount / DOCUMENT_CONFIGS.length) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECCIÓN 1: DATOS INSTITUCIONALES (SOLO LECTURA) */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Lock className="w-3.5 h-3.5" /> No Modificable
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Información Institucional Oficial
              </h2>
            </div>
            <span className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 self-start sm:self-auto flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Verificada por la UPTC
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Nombres */}
            <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800 flex flex-col justify-center transition-colors">
              <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Nombres
              </span>
              <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-zinc-100">
                {profile.name || "N/A"}
              </span>
            </div>

            {/* Apellidos */}
            <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800 flex flex-col justify-center transition-colors">
              <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Apellidos
              </span>
              <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-zinc-100">
                {profile.lastName || "N/A"}
              </span>
            </div>

            {/* Cédula */}
            <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800 flex flex-col justify-center transition-colors">
              <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5" /> Documento de Identidad (Cédula)
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-gray-900 dark:text-zinc-100">
                {profile.studentId || "N/A"}
              </span>
            </div>

            {/* Código Estudiantil (Destacado institucional) */}
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300/80 dark:border-amber-800/60 flex flex-col justify-center shadow-xs transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" /> Código Estudiantil
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  Institucional
                </span>
              </div>
              <span className="text-base sm:text-lg font-mono font-black text-amber-900 dark:text-amber-200">
                {profile.code || "Sin código registrado"}
              </span>
            </div>

            {/* Correo Institucional */}
            <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800 flex flex-col justify-center transition-colors">
              <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Correo Institucional
              </span>
              <span className="text-xs sm:text-sm font-mono text-gray-800 dark:text-zinc-200 truncate" title={profile.email}>
                {profile.email || "N/A"}
              </span>
            </div>

            {/* Programa Académico */}
            <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800 flex flex-col justify-center transition-colors">
              <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> Programa Académico
              </span>
              <span className="text-sm sm:text-base font-semibold text-emerald-700 dark:text-emerald-400">
                {profile.career || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECCIÓN 2: INFORMACIÓN PERSONAL Y DE CONTACTO (MODIFICABLE) */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm transition-colors space-y-6">
          <div className="pb-4 border-b border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Campos Modificables
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Información Personal y de Residencia
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Datos para el contacto y seguimiento de prácticas formativas.
            </p>
          </div>

          {/* Biografía */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                Biografía y Perfil Profesional *
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
              placeholder="Escribe una breve descripción sobre tus intereses formativos y objetivos de práctica..."
              className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-2xl text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none shadow-xs"
            ></textarea>
          </div>

          {/* Grid de Contacto Personal */}
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
                pattern="[0-9]*"
                placeholder="Ej: 3101234567"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-xs"
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
                placeholder="ejemplo@gmail.com"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-xs"
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
                placeholder="Ej: Calle 24 # 5-60, Tunja"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECCIÓN 3: CONTACTO DE EMERGENCIA */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm transition-colors space-y-4">
          <div className="pb-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Contacto de Emergencia / Familiar
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Persona de contacto en caso de cualquier novedad durante las prácticas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-500" /> Nombre del Contacto Familiar *
              </label>
              <input
                type="text"
                name="familyContactName"
                value={profile.familyContactName || ""}
                onChange={handleInputChange}
                placeholder="Ej: María Puentes (Madre)"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-500" /> Teléfono del Contacto Familiar *
              </label>
              <input
                type="text"
                name="familyContactPhone"
                value={profile.familyContactPhone || ""}
                onChange={handleInputChange}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ej: 3209876543"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-zinc-100 text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECCIÓN 4: DOCUMENTACIÓN Y SOPORTES DIGITALES (PDF) */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm transition-colors space-y-6">
          <div className="pb-4 border-b border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                <FileText className="w-3.5 h-3.5" /> Requisitos de Práctica
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Documentación y Soportes Digitales (PDF)
              </h2>
            </div>
            <span className="text-xs text-gray-500 dark:text-zinc-400">
              Adjuntar exclusivamente archivos en formato PDF.
            </span>
          </div>

          {/* Grid de Tarjetas de Documentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DOCUMENT_CONFIGS.map((doc) => {
              const DocIcon = doc.icon;
              const localFile = profile.documents[doc.key]?.file;
              const isInDB = profile.documentsInDB[doc.key];
              const isReady = !!localFile || isInDB;

              return (
                <div
                  key={doc.key}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    localFile
                      ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                      : isInDB
                      ? "bg-gray-50/50 dark:bg-zinc-800/40 border-emerald-300 dark:border-emerald-800/60"
                      : "bg-gray-50/40 dark:bg-zinc-800/20 border-gray-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="space-y-3 mb-4">
                    {/* Encabezado del documento */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 shadow-xs">
                        <DocIcon className="w-4 h-4" />
                      </div>

                      {/* Estado */}
                      {localFile ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                          <UploadCloud className="w-3 h-3" /> Nuevo archivo
                        </span>
                      ) : isInDB ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Registrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                          <AlertCircle className="w-3 h-3" /> Pendiente
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

                    {/* Nombre del archivo */}
                    <div className="text-[11px] font-mono text-gray-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-gray-200 dark:border-zinc-800 truncate flex items-center gap-1.5">
                      {localFile ? (
                        <>
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
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

                  {/* Acciones */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <label
                      htmlFor={`file-${doc.key}`}
                      className="flex-1 py-1.5 px-3 text-center bg-white hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 text-xs font-semibold rounded-lg border border-gray-300 dark:border-zinc-700 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-gray-500" />
                      <span>{isReady ? "Reemplazar" : "Subir PDF"}</span>
                      <input
                        id={`file-${doc.key}`}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileChange(e, doc.key)}
                        className="hidden"
                      />
                    </label>

                    {isReady && (
                      <button
                        type="button"
                        onClick={() => handlePreviewDocument(doc.key)}
                        className="py-1.5 px-3 bg-gray-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        title="Ver o descargar soporte"
                      >
                        {localFile ? <Eye className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                        <span>{localFile ? "Ver" : "Descargar"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================================================================= */}
        {/* BARRA DE GUARDADO INFERIOR */}
        {/* ================================================================= */}
        <div className="sticky bottom-6 z-20 bg-white/95 dark:bg-zinc-900/95 border border-gray-200 dark:border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
          <div className="flex-1 text-center sm:text-left">
            {errorMessage && (
              <div className="text-rose-600 dark:text-rose-400 font-semibold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
            {!errorMessage && !successMessage && (
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Asegúrate de adjuntar los soportes requeridos antes de guardar.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-sm"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* ================================================================= */}
      {/* MODAL DE PREVISUALIZACIÓN DE ARCHIVO LOCAL */}
      {/* ================================================================= */}
      {previewModal.isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3.5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-gray-50 dark:bg-zinc-950">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                {previewModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModal({ isOpen: false, title: "", url: "" })}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-zinc-950 p-2">
              <iframe
                src={previewModal.url}
                className="w-full h-full rounded-xl border border-gray-300 dark:border-zinc-800"
                title="Previsualización de Documento"
              ></iframe>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentProfile;
