import React, { useState, useEffect } from "react";
import { BACKEND_URL } from "../../config/api";

const API_BASE_URL = BACKEND_URL;

/**
 * Componente de Avatar Inteligente de Estudiante:
 * Muestra la foto de perfil real del estudiante si existe en el sistema.
 * Si no tiene foto cargada o falla la carga, realiza un fallback elegante
 * mostrando la letra inicial del nombre sobre un fondo estilizado.
 */
const StudentAvatar = ({
  cedula,
  name = "Estudiante",
  size = "md",
  className = "",
  border = true,
  fallbackBg = "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300",
}) => {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setLoaded(false);
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

  const initial = (name && typeof name === "string" ? name.trim().charAt(0) : "E").toUpperCase();
  const token = typeof window !== "undefined" ? (localStorage.getItem("authToken") || sessionStorage.getItem("authToken")) : null;
  const photoUrl = cedula ? `${API_BASE_URL}/api/student/photo/${cedula}${token ? `?token=${encodeURIComponent(token)}` : ""}` : null;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 select-none ${sizeClasses} ${
        border ? "border shadow-sm" : ""
      } ${className}`}
    >
      {photoUrl && !hasError ? (
        <>
          <img
            src={photoUrl}
            alt={name || "Estudiante"}
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

export default StudentAvatar;
