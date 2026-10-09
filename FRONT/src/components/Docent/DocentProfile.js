// ============================================================
// DocentProfile.js — Panel de Datos Docente y Firma Digital UPTC
// Permite al docente consultar su información institucional,
// y gestionar su foto de perfil y la foto de su firma oficial
// para la emisión automática de certificados y reportes.
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Save,
  Trash2,
  UploadCloud,
  FileCheck,
  RefreshCw,
  PenTool,
  Info,
  Shield,
} from "lucide-react";

const DocentProfile = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estados de imágenes (Base64)
  const [photoPreview, setPhotoPreview] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const photoInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  // Obtener cédula
  const getDocentCedula = useCallback(() => {
    if (user?.cedula) return user.cedula;
    if (user?.id) return user.id;
    try {
      const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.cedula || parsed.Cédula || parsed.id || null;
      }
    } catch (e) {}
    return null;
  }, [user]);

  // Cargar datos reales del perfil docente desde el backend
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${BACKEND_URL}/api/docent/profile`, { headers });
      const resData = await res.json();

      if (res.ok && resData.success && resData.data) {
        setProfileData(resData.data);
        setPhotoPreview(resData.data.foto_perfil || null);
        setSignaturePreview(resData.data.foto_firma || null);
      } else {
        // Fallback a datos de sesión
        const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
        const parsed = stored ? JSON.parse(stored) : {};
        setProfileData({
          cedula: parsed.cedula || getDocentCedula() || "3",
          nombre_completo: `${parsed.nombre || "Gloria"} ${parsed.apellidos || "Alvarez"}`.trim(),
          correo_institucional: parsed.correo_institucional || parsed.email || "gh@ghj.com",
          programa: parsed.nombreprograma || "Facultad de Ciencias de la Salud",
          foto_perfil: parsed.foto_perfil || null,
          foto_firma: parsed.foto_firma || null,
          has_signature: Boolean(parsed.foto_firma),
        });
      }
    } catch (err) {
      console.error("Error al cargar perfil docente:", err);
      toast.error("Error de conexión al cargar datos del docente.");
    } finally {
      setIsLoading(false);
      setHasChanges(false);
    }
  }, [getDocentCedula]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Manejo de carga de Foto de Perfil
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
      setPhotoPreview(event.target?.result);
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  // Manejo de carga de Foto de Firma
  const handleSignatureSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido para la firma (PNG, JPG).");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.warning("El archivo de firma no debe superar los 4 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSignaturePreview(event.target?.result);
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  // Guardar Cambios (Foto de Perfil y Foto de Firma)
  const handleSaveChanges = async () => {
    setIsSaving(true);
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/docent/profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          foto_perfil: photoPreview,
          foto_firma: signaturePreview,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al actualizar los datos.");

      // Actualizar localStorage y sessionStorage para reflejar foto en Navbar inmediatamente
      ["userData", "user"].forEach((key) => {
        try {
          const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.foto_perfil = photoPreview;
            parsed.foto_firma = signaturePreview;
            localStorage.setItem(key, JSON.stringify(parsed));
            sessionStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch (e) {}
      });

      // Guardar firma local para generador de reportes
      if (signaturePreview) {
        localStorage.setItem("uptc_cert_signature", signaturePreview);
        localStorage.setItem("uptc_report_docent_sig", signaturePreview);
      } else {
        localStorage.removeItem("uptc_cert_signature");
        localStorage.removeItem("uptc_report_docent_sig");
      }

      // Notificar reactivamente a la barra superior (Navbar)
      window.dispatchEvent(new CustomEvent("uptc:profile-updated", { detail: { foto_perfil: photoPreview } }));
      notifyDataChanged("docent-profile", "update");

      setProfileData((prev) => ({
        ...prev,
        foto_perfil: photoPreview,
        foto_firma: signaturePreview,
        has_signature: Boolean(signaturePreview),
        has_photo: Boolean(photoPreview),
      }));

      setHasChanges(false);
      toast.success("¡Datos y firma digital guardados exitosamente!");
    } catch (err) {
      console.error("Error guardando datos del docente:", err);
      toast.error(err.message || "Ocurrió un error al guardar los datos.");
    } finally {
      setIsSaving(false);
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

  return (
    <div className="max-w-6xl mx-auto space-y-7 pb-16">
      {/* ─── Encabezado Principal ─── */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 shadow-inner">
              <User className="w-8 h-8" />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  Datos del Docente
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Docente
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Consulta tu información institucional registrada y administra tu foto de perfil y tu firma oficial para la emisión de certificados y reportes.
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
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-500" : ""}`} />
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={isSaving || !hasChanges}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition duration-150 cursor-pointer ${
                hasChanges
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 scale-[1.02]"
                  : "bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
            </button>
          </div>
        </div>

        {/* Banner de Estado de Firma Digital */}
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-zinc-800">
          {signaturePreview ? (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 text-xs font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <strong>Firma Digital Registrada:</strong> Tu firma está configurada y se estampará automáticamente como tu rúbrica oficial al avalar y emitir certificados o reportes a los estudiantes.
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs font-medium">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <strong>Firma Pendiente por Subir:</strong> Debes adjuntar la foto de tu firma abajo. Si no la cargas, el sistema no te permitirá emitir certificados ni constancias oficiales.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Contenedor en Cuadrícula ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* ─── Columna Izquierda: Información Institucional por Defecto (Solo Lectura) ─── */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Información Institucional
              </h2>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              Datos registrados en el sistema académico UPTC asociados a tu cuenta de docente:
            </p>

            <div className="space-y-4">
              {/* Nombre Completo */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500 block mb-1">
                  Nombre Completo
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {profileData?.nombre_completo || "Gloria Alvarez"}
                </p>
              </div>

              {/* Documento de Identidad */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500 block mb-1">
                  Cédula de Ciudadanía
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                  C.C. {profileData?.cedula || "3"}
                </p>
              </div>

              {/* Correo Institucional */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500 block mb-1">
                  Correo Electrónico
                </span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {profileData?.correo_institucional || "gh@ghj.com"}
                </p>
              </div>

              {/* Programa Académico */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500 block mb-1">
                  Programa / Escuela
                </span>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {profileData?.programa || "Enfermería"}
                </p>
              </div>

              {/* Entidad Académica */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500 block mb-1">
                  Institución
                </span>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Universidad Pedagógica y Tecnológica de Colombia (UPTC) — Facultad Ciencias de la Salud
                </p>
              </div>
            </div>

            <div className="mt-5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Para corregir nombres o adscripción de programa, comunícate con la Coordinación de Prácticas o el Administrador.
              </span>
            </div>
          </div>
        </div>

        {/* ─── Columna Derecha: Gestión de Foto de Perfil y Firma Digital ─── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Foto de Perfil */}
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Foto de Perfil
                </h2>
              </div>
              <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">PNG / JPG / WebP</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar circular con preview */}
              <div className="relative group">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Foto de perfil del docente"
                    className="w-28 h-28 rounded-full object-cover shadow-lg border-4 border-emerald-500/40 ring-4 ring-emerald-500/10"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center text-3xl font-black shadow-lg border-4 border-emerald-400/30">
                    {getInitials(profileData?.nombre_completo)}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title="Cambiar foto de perfil"
                  className="absolute bottom-1 right-1 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md border-2 border-white dark:border-zinc-900 transition cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Fotografía de Identificación
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta foto se mostrará en tu barra de navegación, en los mensajes con estudiantes y en las bitácoras institucionales.
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
                    <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Seleccionar Foto</span>
                  </button>

                  {photoPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        setHasChanges(true);
                      }}
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

          {/* Card: Foto de la Firma Digital (Requerida) */}
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <PenTool className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Foto de la Firma Digital Oficial
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Requerida para Emisión
              </span>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              Carga una fotografía clara o imagen escaneada de tu firma manuscrita (idealmente sobre fondo blanco o transparente). 
              Esta firma se estampará automáticamente como tu <strong>rúbrica oficial</strong> al emitir certificados de aprobación, reportes de rotación y constancias.
            </p>

            {/* Recuadro de Visualización de Firma */}
            <div className="p-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/70 dark:bg-zinc-800/40 flex flex-col items-center justify-center min-h-[160px] text-center">
              {signaturePreview ? (
                <div className="space-y-3 w-full flex flex-col items-center">
                  <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-inner border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                    <img
                      src={signaturePreview}
                      alt="Firma digital oficial del docente"
                      className="max-h-24 max-w-full object-contain filter contrast-125"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Firma oficial lista para estampar en certificados y reportes</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 py-4">
                  <PenTool className="w-10 h-10 text-gray-400 dark:text-zinc-600 mx-auto" />
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    No has cargado la foto de tu firma digital
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-sm">
                    Para poder avalar solicitudes de estudiantes, primero debes subir aquí la imagen de tu firma.
                  </p>
                </div>
              )}
            </div>

            {/* Botones de Acción de Firma */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{signaturePreview ? "Cambiar Foto de Firma" : "Adjuntar Foto de Firma"}</span>
              </button>

              {signaturePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setSignaturePreview(null);
                    setHasChanges(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar Firma</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocentProfile;
