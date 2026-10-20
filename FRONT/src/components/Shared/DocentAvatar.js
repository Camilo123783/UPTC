// ============================================================
// DocentAvatar.js — Avatar Inteligente y Foto Oficial del Docente
// Muestra la foto real del docente en cualquier vista (estudiante, auditor, admin, docente).
// Si no tiene foto cargada o falla la carga, realiza un fallback elegante
// con la inicial del docente sobre fondo morado institucional UPTC.
// Sincronizado en tiempo real ante actualizaciones de foto.
// ============================================================
import React, { useState, useEffect } from "react";
import { BACKEND_URL } from "../../config/api";
import { DATA_SYNC_EVENT } from "../../utils/dataSync";

const API_BASE_URL = BACKEND_URL;

const DocentAvatar = ({
  cedula,
  name = "Docente",
  size = "md",
  className = "",
  border = true,
  hasPhoto = null,
  fallbackBg = "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300",
}) => {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(1);
  const [forceHasPhoto, setForceHasPhoto] = useState(null);

  useEffect(() => {
    setHasError(false);
    setLoaded(false);
  }, [cedula, hasPhoto, version]);

  // Escuchar actualizaciones de foto en tiempo real
  useEffect(() => {
    if (!cedula) return;

    const handlePhotoUpdate = (e) => {
      const targetCedula = e?.detail?.cedula;
      if ((targetCedula && String(targetCedula) === String(cedula)) || (e?.type === "uptc:profile-photo-updated" && !targetCedula)) {
        setVersion(Date.now());
        setForceHasPhoto(true);
        setHasError(false);
        setLoaded(false);
      }
    };

    window.addEventListener("uptc:profile-photo-updated", handlePhotoUpdate);
    window.addEventListener("uptc:profile-updated", handlePhotoUpdate);
    window.addEventListener("uptc:user-data-updated", handlePhotoUpdate);
    window.addEventListener(DATA_SYNC_EVENT, handlePhotoUpdate);

    return () => {
      window.removeEventListener("uptc:profile-photo-updated", handlePhotoUpdate);
      window.removeEventListener("uptc:profile-updated", handlePhotoUpdate);
      window.removeEventListener("uptc:user-data-updated", handlePhotoUpdate);
      window.removeEventListener(DATA_SYNC_EVENT, handlePhotoUpdate);
    };
  }, [cedula]);

  const sizeClasses = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
    "2xl": "w-20 h-20 text-2xl",
    "3xl": "w-24 h-24 text-3xl",
  }[size] || size;

  const initial = (name && typeof name === "string" ? name.trim().charAt(0) : "D").toUpperCase();
  const effectiveHasPhoto = forceHasPhoto !== null ? forceHasPhoto : hasPhoto;
  const shouldFetchPhoto = effectiveHasPhoto !== false && Boolean(cedula);
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token")
      : null;

  const photoUrl = shouldFetchPhoto
    ? `${API_BASE_URL}/api/docent/photo/${cedula}?v=${version}${token ? `&token=${encodeURIComponent(token)}` : ""}`
    : null;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 select-none ${sizeClasses} ${
        border ? "border shadow-sm" : ""
      } ${className}`}
    >
      {photoUrl && !hasError ? (
        <>
          <img
            key={`${cedula}-${version}`}
            src={photoUrl}
            alt={name || "Docente"}
            className={`w-full h-full object-cover rounded-full transition-opacity duration-200 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
            onError={() => setHasError(true)}
          />
          {!loaded && (
            <div
              className={`absolute inset-0 flex items-center justify-center font-black ${fallbackBg}`}
            >
              {initial}
            </div>
          )}
        </>
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-black ${fallbackBg}`}
        >
          {initial}
        </div>
      )}
    </div>
  );
};

export default DocentAvatar;
