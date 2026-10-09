import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { BACKEND_URL } from "../../config/api";
import { useDataSync } from "../../utils/dataSync";

// Eliminé 'userName' de las props ya que lo obtendremos de sessionStorage
const DashboardLayout = ({
  children,
  userRole,
  currentPage,
  onLogout,
  onNavigate,
}) => {
  const { theme, toggleTheme, isDark } = useTheme();

  // Estado para controlar si el sidebar está colapsado (guardado) o expandido
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(isCollapsed));
  }, [isCollapsed]);

  const [institutionInfo, setInstitutionInfo] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("institutionSettings"));
      if (saved) {
        return {
          name: saved.name || "Facultad Ciencias de la Salud",
          logo_institucion: saved.logo_institucion || saved.logo_url || saved.logoPreview || `${process.env.PUBLIC_URL || ""}/images/uptc.png`,
          logoPreview: saved.logo_institucion || saved.logo_url || saved.logoPreview || `${process.env.PUBLIC_URL || ""}/images/uptc.png`,
          logo_url: saved.logo_institucion || saved.logo_url || saved.logoPreview || `${process.env.PUBLIC_URL || ""}/images/uptc.png`,
          slogan: saved.slogan || "Gestor de Prácticas",
          ...saved,
        };
      }
    } catch (e) {}
    return {
      name: "Facultad Ciencias de la Salud",
      logoPreview: `${process.env.PUBLIC_URL || ""}/images/uptc.png`,
      slogan: "Gestor de Prácticas",
    };
  });
  const [fullName, setFullName] = useState("Cargando...");

  const fetchInstitutionInfo = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/institution-settings`);
      if (res.ok) {
        const data = await res.json();
        setInstitutionInfo((prev) => ({ ...prev, ...data }));
        try {
          const current = JSON.parse(localStorage.getItem("institutionSettings") || "{}");
          localStorage.setItem("institutionSettings", JSON.stringify({ ...current, ...data }));
        } catch (e) {}
      }
    } catch (e) {
      try {
        const savedData = JSON.parse(localStorage.getItem("institutionSettings"));
        if (savedData) {
          setInstitutionInfo(savedData);
        }
      } catch (err) {}
    }
  };

  useEffect(() => {
    fetchInstitutionInfo();
  }, []);

  useDataSync(fetchInstitutionInfo);

  useEffect(() => {
    const handleSettingsUpdated = () => {
      fetchInstitutionInfo();
    };
    window.addEventListener("institutionSettingsUpdated", handleSettingsUpdated);
    return () => window.removeEventListener("institutionSettingsUpdated", handleSettingsUpdated);
  }, []);

  // ─── Estados de Usuario y Menú Superior Derecho ───
  const [currentUserData, setCurrentUserData] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const loadUserData = useCallback(() => {
    const storedData =
      sessionStorage.getItem("userData") || localStorage.getItem("userData");
    if (storedData) {
      try {
        const userData = JSON.parse(storedData);
        setCurrentUserData(userData);
        const apellido = userData.apellidos || userData.apellido || "";
        if (userData.nombre && apellido) {
          setFullName(`${userData.nombre} ${apellido}`);
        } else if (userData.nombre) {
          setFullName(userData.nombre);
        } else {
          setFullName("Usuario");
        }

        const cedula = userData.cedula || userData.id;
        const directPhoto =
          userData.foto_url ||
          userData.photoPreview ||
          userData.foto_perfil ||
          userData.foto;

        if (directPhoto) {
          setPhotoUrl(
            directPhoto.startsWith("http") || directPhoto.startsWith("data:")
              ? directPhoto
              : `${BACKEND_URL}${directPhoto.startsWith("/") ? "" : "/"}${directPhoto}`
          );
          setPhotoError(false);
          setPhotoLoading(true);
        } else if (
          (userRole === "student" || userData.role === "student") &&
          cedula
        ) {
          const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
          setPhotoUrl(`${BACKEND_URL}/api/student/photo/${cedula}${token ? `?token=${encodeURIComponent(token)}` : ""}`);
          setPhotoError(false);
          setPhotoLoading(true);
        } else {
          setPhotoUrl(null);
          setPhotoError(false);
          setPhotoLoading(false);
        }
      } catch (e) {
        console.error("Error al parsear userData de sessionStorage", e);
        setFullName("Usuario");
        setCurrentUserData(null);
        setPhotoUrl(null);
        setPhotoLoading(false);
      }
    } else {
      setFullName("Usuario");
      setCurrentUserData(null);
      setPhotoUrl(null);
      setPhotoLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Escuchar eventos si se actualiza la foto o datos del perfil
  useEffect(() => {
    const handleProfileUpdate = () => {
      loadUserData();
    };
    window.addEventListener("storage", handleProfileUpdate);
    window.addEventListener("uptc:profile-photo-updated", handleProfileUpdate);
    window.addEventListener("uptc:user-data-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("storage", handleProfileUpdate);
      window.removeEventListener("uptc:profile-photo-updated", handleProfileUpdate);
      window.removeEventListener("uptc:user-data-updated", handleProfileUpdate);
    };
  }, [loadUserData]);

  // Manejador para cerrar el menú al hacer click afuera o presionar Escape
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const getInitials = (name) => {
    if (!name || name === "Cargando...") return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0] ? parts[0][0] : "U").toUpperCase();
  };

  const getRoleBadge = (role) => {
    const name = getRoleName(role);
    switch (role) {
      case "superadmin":
        return {
          name,
          badgeClass: isDark
            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
            : "bg-purple-100 text-purple-800 border-purple-200",
          textAccent: isDark ? "text-purple-400" : "text-purple-700",
        };
      case "student":
        return {
          name,
          badgeClass: isDark
            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            : "bg-cyan-100 text-cyan-800 border-cyan-200",
          textAccent: isDark ? "text-cyan-400" : "text-cyan-700",
        };
      case "docent":
        return {
          name,
          badgeClass: isDark
            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
            : "bg-emerald-100 text-emerald-800 border-emerald-200",
          textAccent: isDark ? "text-emerald-400" : "text-emerald-700",
        };
      case "auditor":
        return {
          name,
          badgeClass: isDark
            ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
            : "bg-amber-100 text-amber-800 border-amber-200",
          textAccent: isDark ? "text-amber-500" : "text-amber-700",
        };
      case "admin":
        return {
          name,
          badgeClass: isDark
            ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
            : "bg-blue-100 text-blue-800 border-blue-200",
          textAccent: isDark ? "text-blue-400" : "text-blue-700",
        };
      default:
        return {
          name,
          badgeClass: isDark
            ? "bg-zinc-800 text-zinc-300 border-zinc-700"
            : "bg-gray-100 text-gray-800 border-gray-200",
          textAccent: isDark ? "text-zinc-300" : "text-gray-700",
        };
    }
  };

  // ─── Conteo de Mensajes Pendientes (Docente / Auditor / Estudiante) ───
  const [unreadAuditorMessages, setUnreadAuditorMessages] = useState(0);
  const [unreadStudentMessages, setUnreadStudentMessages] = useState(0);
  const [unreadDocentMessages, setUnreadDocentMessages] = useState(0);
  const [pendingDocentDocuments, setPendingDocentDocuments] = useState(0);

  const fetchUnreadMessages = useCallback(async () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    if (userRole === "docent") {
      try {
        const [resAud, resStd, resDocs] = await Promise.allSettled([
          fetch(`${BACKEND_URL}/api/docent/unread-messages-count`, { headers }),
          fetch(`${BACKEND_URL}/api/docent/student-communication/unread-count`, { headers }),
          fetch(`${BACKEND_URL}/api/docent/pending-documents-count`, { headers }),
        ]);
        if (resAud.status === "fulfilled" && resAud.value.ok) {
          const dataAud = await resAud.value.json();
          setUnreadAuditorMessages(typeof dataAud.unreadCount === "number" ? dataAud.unreadCount : 0);
        }
        if (resStd.status === "fulfilled" && resStd.value.ok) {
          const dataStd = await resStd.value.json();
          setUnreadStudentMessages(typeof dataStd.unreadCount === "number" ? dataStd.unreadCount : 0);
        }
        if (resDocs.status === "fulfilled" && resDocs.value.ok) {
          const dataDocs = await resDocs.value.json();
          setPendingDocentDocuments(typeof dataDocs.pendingCount === "number" ? dataDocs.pendingCount : 0);
        }
      } catch (e) {
        console.warn("No se pudo obtener conteo de alertas del docente:", e);
      }
    } else if (userRole === "student") {
      try {
        const studentCedula = currentUserData?.cedula || currentUserData?.id;
        const url = `${BACKEND_URL}/api/student/communication/unread-count${studentCedula ? `?studentId=${studentCedula}` : ""}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          setUnreadDocentMessages(typeof data.unreadCount === "number" ? data.unreadCount : 0);
        }
      } catch (e) {
        console.warn("No se pudo obtener conteo de mensajes pendientes del estudiante:", e);
      }
    } else if (userRole === "auditor") {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auditor/unread-messages-count`, { headers });
        if (res.ok) {
          const data = await res.json();
          setUnreadDocentMessages(typeof data.unreadCount === "number" ? data.unreadCount : 0);
        }
      } catch (e) {
        console.warn("No se pudo obtener conteo de mensajes pendientes del auditor:", e);
      }
    }
  }, [userRole, currentUserData]);

  useEffect(() => {
    fetchUnreadMessages();
  }, [fetchUnreadMessages, currentPage]);

  useDataSync(fetchUnreadMessages);

  // Escuchar evento personalizado de mensajes leídos o enviados y solicitudes actualizadas
  useEffect(() => {
    const handleEvents = () => {
      fetchUnreadMessages();
    };
    window.addEventListener("uptc:messages-read", handleEvents);
    window.addEventListener("uptc:certificate-requests-updated", handleEvents);
    window.addEventListener("uptc:data-sync", handleEvents);
    return () => {
      window.removeEventListener("uptc:messages-read", handleEvents);
      window.removeEventListener("uptc:certificate-requests-updated", handleEvents);
      window.removeEventListener("uptc:data-sync", handleEvents);
    };
  }, [fetchUnreadMessages]);

  // Sondeo suave periódico cada 12s para actualizar alertas en tiempo real
  useEffect(() => {
    if (userRole !== "docent" && userRole !== "auditor" && userRole !== "student") return;
    const interval = setInterval(() => {
      fetchUnreadMessages();
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchUnreadMessages, userRole]);

  const getRoleName = (role) => {
    switch (role) {
      case "superadmin":
        return "Superadmin";
      case "student":
        return "Estudiante";
      case "docent":
        return "Docente";
      case "auditor":
        return "Auditor";
      case "admin":
        return "Administrador";
      default:
        return "Usuario";
    }
  }; // Iconos SVG simples (se mantienen sin cambios)

  const icons = {
    Dashboard: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12h19.5m-19.5 0a2.25 2.25 0 0 1-2.25-2.25V6.75a2.25 2.25 0 0 1 2.25-2.25h19.5a2.25 2.25 0 0 1 2.25 2.25v3.003a2.25 2.25 0 0 1-2.25 2.25m-19.5 0a2.25 2.25 0 0 0 0 4.5h19.5a2.25 2.25 0 0 0 0-4.5m-19.5 0v.375a.75.75 0 0 0 .75.75h.75m-1.5 0h.375c.621 0 1.125.504 1.125 1.125v.375m-1.5 0h.375c.621 0 1.125.504 1.125 1.125v.375m-1.5 0h.375c.621 0 1.125.504 1.125 1.125v.375m-1.5 0h.375c.621 0 1.125.504 1.125 1.125v.375m-1.5 0h.375c.621 0 1.125.504 1.125 1.125v.375m-1.5 0h.375c.621 0 1.125.504 1.125 1.125v.375m-1.5 0h.375c.621 0 1.125.504 1.125 1.125v.375"
        />{" "}
      </svg>
    ),
    "Mi Perfil": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />{" "}
      </svg>
    ),
    "Mis Prácticas": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m-4.5 0A2.25 2.25 0 0 1 9 20.25H7.5A2.25 2.25 0 0 1 5.25 18V6.75A2.25 2.25 0 0 1 7.5 4.5h1.5m4.5 1.5h5.25A2.25 2.25 0 0 1 21 7.5v10.5a2.25 2.25 0 0 1-2.25 2.25H15M12 12a2.25 2.25 0 0 0 0 4.5"
        />{" "}
      </svg>
    ),
    Evaluaciones: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />{" "}
      </svg>
    ),
    "Solicitudes de Certificados": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.35 3.836A1.873 1.873 0 0 1 12 5.25c0 .416-.085.82-.25 1.193L9.423 17.593a2.25 2.25 0 0 0 1.11 2.641 2.25 2.25 0 0 0 3.021-.603 2.25 2.25 0 0 0-.603-3.021L10.95 12.953M8.625 7.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 12.75a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z"
        />
      </svg>
    ),
    Certificaciones: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.35 3.836A1.873 1.873 0 0 1 12 5.25c0 .416-.085.82-.25 1.193L9.423 17.593a2.25 2.25 0 0 0 1.11 2.641 2.25 2.25 0 0 0 3.021-.603 2.25 2.25 0 0 0-.603-3.021L10.95 12.953M8.625 7.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 12.75a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z"
        />
      </svg>
    ),
    "Cambiar Contraseña": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
        />{" "}
      </svg>
    ),
    Gestión: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0M3.75 18H7.5m3-6h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0M3.75 12H7.5"
        />{" "}
      </svg>
    ),
    Estudiantes: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM12 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM6 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM15 9.75a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z"
        />{" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Z"
        />{" "}
      </svg>
    ),
    Reportes: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h-3M12 7.5H10.5m0 6h.008v.008H12v-.008Z"
        />{" "}
      </svg>
    ),
    Administración: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.343 3.94c.07-.2.166-.38.275-.552A3.842 3.842 0 0 0 12 2.25c.54 0 1.05.174 1.427.468.109.172.205.352.275.552v.38c0 .2-.149.352-.327.352H10.67c-.178 0-.327-.152-.327-.352V3.94ZM12 2.25c-1.08 0-2.104.502-2.75 1.35A9.749 9.749 0 0 0 2.25 12c0 5.385 4.365 9.75 9.75 9.75s9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12 12.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        />{" "}
      </svg>
    ),
    "Gestión de Usuarios": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 18.75h15M4.5 12.75h15M4.5 6.75h15"
        />{" "}
      </svg>
    ),
    Instituciones: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21h1.5m-1.5-3h1.5m-1.5-3h1.5m3 6H15m-1.5 3H15m-1.5 3H15"
        />{" "}
      </svg>
    ),
    Asignaciones: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 12c0-1.232-.74-2.25-1.875-2.25H4.5c-1.135 0-1.875 1.018-1.875 2.25s.74 2.25 1.875 2.25H17.625c1.135 0 1.875-1.018 1.875-2.25Z"
        />{" "}
      </svg>
    ),
    "Asignar Prácticas": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4.5v15m7.5-7.5h-15"
        />{" "}
      </svg>
    ),
    "Gestionar Prácticas": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0M3.75 18H7.5m3-6h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0M3.75 12H7.5"
        />{" "}
      </svg>
    ),
    Informes: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0M3.75 18H7.5m3-6h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0M3.75 12H7.5"
        />{" "}
      </svg>
    ),
    "Generar Informes": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h-3M12 7.5H10.5m0 6h.008v.008H12v-.008Z"
        />{" "}
      </svg>
    ),
    "Visualizar Usuarios": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 18.75h15M4.5 12.75h15M4.5 6.75h15"
        />{" "}
      </svg>
    ),
    Comunicación: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.455 3.624 2.625 8.125 2.625s8.125-1.17 8.125-2.625V6.75c0-1.455-3.624-2.625-8.125-2.625S2.25 5.295 2.25 6.75v4.51Z"
        />{" "}
      </svg>
    ),
    "Comunicación con el Auditor": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.455 3.624 2.625 8.125 2.625s8.125-1.17 8.125-2.625V6.75c0-1.455-3.624-2.625-8.125-2.625S2.25 5.295 2.25 6.75v4.51Z"
        />
      </svg>
    ),
    "Comunicación con el Estudiante": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.26 10.147a60.438 60.438 0 0 1-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-5.25 6.557c0 1.05.513 2.012 1.34 2.613"
        />
      </svg>
    ),
    "Comunicación con el Docente": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v5.998Z"
        />
      </svg>
    ),
    "Datos Docente": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />
      </svg>
    ),
    Sistema: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.343 3.94c.07-.2.166-.38.275-.552A3.842 3.842 0 0 0 12 2.25c.54 0 1.05.174 1.427.468.109.172.205.352.275.552v.38c0 .2-.149.352-.327.352H10.67c-.178 0-.327-.152-.327-.352V3.94ZM12 2.25c-1.08 0-2.104.502-2.75 1.35A9.749 9.749 0 0 0 2.25 12c0 5.385 4.365 9.75 9.75 9.75s9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12 12.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        />{" "}
      </svg>
    ),
    "Administrar Usuarios": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 18.75h15M4.5 12.75h15M4.5 6.75h15"
        />{" "}
      </svg>
    ),
    "Crear Prácticas": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m-4.5 0A2.25 2.25 0 0 1 9 20.25H7.5A2.25 2.25 0 0 1 5.25 18V6.75A2.25 2.25 0 0 1 7.5 4.5h1.5m4.5 1.5h5.25A2.25 2.25 0 0 1 21 7.5v10.5a2.25 2.25 0 0 1-2.25 2.25H15M12 12a2.25 2.25 0 0 0 0 4.5"
        />
      </svg>
    ),
    "Diseñar Certificados": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.35 3.836A1.873 1.873 0 0 1 12 5.25c0 .416-.085.82-.25 1.193L9.423 17.593a2.25 2.25 0 0 0 1.11 2.641 2.25 2.25 0 0 0 3.021-.603 2.25 2.25 0 0 0-.603-3.021L10.95 12.953M8.625 7.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 12.75a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z"
        />{" "}
      </svg>
    ),
    "Reportes Generales": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h-3M12 7.5H10.5m0 6h.008v.008H12v-.008Z"
        />{" "}
      </svg>
    ),
    "Reportes y Constancias": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h-3M12 7.5H10.5m0 6h.008v.008H12v-.008Z"
        />{" "}
      </svg>
    ),
    "Mis Estudiantes": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        {" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM12 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM6 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM15 9.75a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z"
        />{" "}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Z"
        />{" "}
      </svg>
    ),
    Estudiantes: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM12 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM6 18.75c-.276 0-.5-.447-.5-.999 0-.553.224-1 .5-1s.5.447.5 1c0 .552-.224 1-.5 1ZM15 9.75a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Z"
        />
      </svg>
    ),
    Parametrización: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        />
      </svg>
    ),
    "Cumplimiento de Horas": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
    "Solicitud de Certificados": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
    ),
    "Solicitudes de Certificados": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
    ),
    "Historial": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12a9 9 0 0 1 15-6.7L21 8m0-5v5h-5"
        />
      </svg>
    ),
    "Historial de Prácticas": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12a9 9 0 0 1 15-6.7L21 8m0-5v5h-5"
        />
      </svg>
    ),
    "Historial de Certificados": (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
        />
      </svg>
    ),
  };

  const navItems = {
    student: [
      { name: "Dashboard", page: "dashboard" },
      { name: "Mi Perfil", page: "studentProfile", section: "Académico" },
      { name: "Mis Prácticas", page: "studentPractices" },
      { name: "Evaluaciones", page: "studentEvaluations" },
      { name: "Certificaciones", page: "studentCertifications" },
      { name: "Comunicación con el Docente", page: "studentDocentCommunication", section: "Comunicación" },
      { name: "Historial", page: "history", section: "Historial" },
      { name: "Historial de Certificados", page: "certificateHistory" },
    ],
    docent: [
      { name: "Dashboard", page: "dashboard" },
      { name: "Mis Prácticas", page: "docentPractices", section: "Gestión" },
      { name: "Estudiantes", page: "docentStudents" },
      { name: "Cumplimiento de Horas", page: "docentHoursCompliance" },
      { name: "Solicitud de Certificados", page: "docentCertificateRequests" },
      { name: "Diseñar Certificados", page: "docentCertificateDesigner" },
      { name: "Reportes y Constancias", page: "docentReports" },
      { name: "Comunicación con el Auditor", page: "docentCommunication", section: "Comunicación" },
      { name: "Comunicación con el Estudiante", page: "docentStudentCommunication" },
      { name: "Historial", page: "history", section: "Historial" },
    ],
    auditor: [
      { name: "Dashboard", page: "dashboard" },
      { name: "Cumplimiento de Horas", page: "auditorHoursCompliance", section: "Gestión" },
      { name: "Visualizar Usuarios", page: "auditorUserViewer", section: "Usuarios" },
      { name: "Comunicación con el Docente", page: "auditorCommunication", section: "Comunicación" },
      { name: "Historial", page: "history", section: "Historial" },
    ],
    admin: [
      { name: "Dashboard", page: "dashboard" },
      { name: "Administrar Usuarios", page: "adminUsers", section: "Sistema" },
      { name: "Crear Prácticas", page: "adminPractices" },
      { name: "Diseñar Certificados", page: "adminCertificateDesigner" },
      { name: "Reportes Generales", page: "adminReports" },
      { name: "Historial", page: "history", section: "Historial" },
      { name: "Historial de Certificados", page: "certificateHistory" },
    ],
    superadmin: [
      { name: "Dashboard", page: "dashboard" },
      {
        name: "Parametrización",
        page: "adminInstitutionSettings",
        section: "Configuración Institucional",
      },
      { name: "Administrar Usuarios", page: "adminUsers", section: "Sistema" },
      { name: "Historial", page: "history", section: "Historial" },
      { name: "Historial de Certificados", page: "certificateHistory" },
    ],
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-200 ${
        isDark ? "bg-black text-white" : "bg-white text-gray-800"
      }`}
    >
      {/* Header Fijo */}
      <header
        className={`w-full h-16 py-2 px-3 sm:px-6 flex justify-between items-center z-20 flex-shrink-0 transition-colors duration-200 ${
          isDark
            ? "bg-black text-white border-b border-zinc-800 shadow-md shadow-black/40"
            : "bg-white text-gray-800 border-b border-gray-200 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Botón hamburguesa para móvil (< md) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`p-2 md:hidden rounded-xl transition cursor-pointer flex items-center justify-center ${
              isDark
                ? "text-zinc-200 hover:bg-zinc-800"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            title={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>

          <img
            src={
              institutionInfo.logo_institucion ||
              institutionInfo.logo_url ||
              institutionInfo.logoPreview ||
              `${process.env.PUBLIC_URL || ""}/images/uptc.png`
            }
            alt="Logo Institución"
            className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = `${process.env.PUBLIC_URL || ""}/images/uptc.png`;
            }}
          />
          <div className="min-w-0">
            <h1
              className={`text-sm sm:text-base md:text-xl font-bold truncate ${
                isDark ? "text-white" : "text-gray-800"
              }`}
            >
              {institutionInfo.name}
            </h1>
            {institutionInfo.slogan && (
              <p
                className={`hidden sm:block text-xs truncate ${
                  isDark ? "text-zinc-400" : "text-gray-600"
                }`}
              >
                {institutionInfo.slogan}
              </p>
            )}
          </div>
        </div>
        {/* Menú de Perfil de Usuario en la esquina superior derecha */}
        <div className="relative" ref={userMenuRef}>
          {/* Recuadro con el nombre */}
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
            title="Opciones de perfil y cuenta"
            className={`group px-3.5 py-1.5 rounded-xl font-medium text-sm flex items-center gap-2 border transition-all duration-200 cursor-pointer select-none shadow-sm ${
              isUserMenuOpen
                ? isDark
                  ? "bg-zinc-800 border-zinc-500 text-white ring-2 ring-blue-500/30"
                  : "bg-gray-100 border-gray-400 text-gray-900 ring-2 ring-amber-500/30"
                : isDark
                ? "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200 hover:text-white hover:border-zinc-500"
                : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            <span className="truncate max-w-[170px] sm:max-w-[240px] font-semibold">
              {fullName}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.2"
              stroke="currentColor"
              className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${
                isUserMenuOpen
                  ? "rotate-180 text-amber-500 dark:text-blue-400"
                  : "text-gray-400 group-hover:text-gray-600 dark:text-zinc-400 dark:group-hover:text-zinc-200"
              }`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>

          {/* Recuadro un poco más grande (Dropdown / Popover) */}
          {isUserMenuOpen && (
            <div
              className={`absolute right-0 mt-2.5 w-72 sm:w-80 rounded-2xl p-5 shadow-2xl border z-50 transition-all duration-150 transform origin-top-right ${
                isDark
                  ? "bg-zinc-900/95 backdrop-blur-md border-zinc-700/90 shadow-black/80 text-white"
                  : "bg-white/95 backdrop-blur-md border-gray-200 shadow-2xl shadow-gray-400/30 text-gray-800"
              }`}
            >
              {/* Foto de Perfil (si tiene) con fallback elegante a iniciales */}
              <div className="flex justify-center mb-3">
                {photoUrl && !photoError ? (
                  <div className="relative">
                    <img
                      src={photoUrl}
                      alt={`Foto de perfil de ${fullName}`}
                      onLoad={() => setPhotoLoading(false)}
                      onError={() => {
                        setPhotoError(true);
                        setPhotoLoading(false);
                      }}
                      className={`w-20 h-20 rounded-full object-cover shadow-md border-2 ${
                        photoLoading ? "hidden" : "block"
                      } ${
                        isDark
                          ? "border-blue-500/40 ring-4 ring-blue-500/10"
                          : "border-amber-500/50 ring-4 ring-amber-500/15"
                      }`}
                    />
                    {photoLoading && (
                      <div
                        className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black shadow-md border-2 select-none animate-pulse ${
                          isDark
                            ? "bg-zinc-800 text-white border-zinc-700"
                            : "bg-amber-100 text-amber-900 border-amber-300"
                        }`}
                      >
                        {getInitials(fullName)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black shadow-md border-2 select-none ${
                      isDark
                        ? "bg-gradient-to-br from-zinc-800 to-zinc-950 text-white border-zinc-700 ring-4 ring-white/5"
                        : "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900 border-amber-300 ring-4 ring-amber-500/10"
                    }`}
                  >
                    {getInitials(fullName)}
                  </div>
                )}
              </div>

              {/* El rol seguido del nombre */}
              <div className="text-center mb-4">
                <div className="flex justify-center mb-1.5">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
                      getRoleBadge(userRole).badgeClass
                    }`}
                  >
                    {getRoleBadge(userRole).name}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                  <span
                    className={`${
                      getRoleBadge(userRole).textAccent
                    } font-extrabold`}
                  >
                    {getRoleBadge(userRole).name}
                  </span>{" "}
                  <span>{fullName}</span>
                </h3>
                {currentUserData?.cedula && (
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-mono">
                    C.C. {currentUserData.cedula}
                  </p>
                )}
                {(currentUserData?.correo_institucional ||
                  currentUserData?.email) && (
                  <p
                    className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 truncate max-w-full"
                    title={
                      currentUserData.correo_institucional ||
                      currentUserData.email
                    }
                  >
                    {currentUserData.correo_institucional ||
                      currentUserData.email}
                  </p>
                )}
              </div>

              {/* Línea divisoria */}
              <div
                className={`border-t mb-3.5 ${
                  isDark ? "border-zinc-800" : "border-gray-100"
                }`}
              />

              {/* Botones de Acción */}
              <div className="space-y-2">
                {/* Botón de Cambiar Contraseña */}
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onNavigate("changePassword");
                  }}
                  className={`w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                    isDark
                      ? "bg-zinc-800/90 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/80 hover:border-zinc-600"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.75"
                    stroke="currentColor"
                    className="w-4 h-4 text-amber-500 dark:text-blue-400 flex-shrink-0"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  </svg>
                  <span>Cambiar Contraseña</span>
                </button>

                {/* Botón de Cambiar Modo Claro / Oscuro */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                    isDark
                      ? "bg-zinc-800/90 hover:bg-zinc-700 text-yellow-300 border border-zinc-700/80 hover:border-zinc-600"
                      : "bg-gray-100 hover:bg-gray-200 text-slate-800 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {isDark ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4 text-yellow-400 flex-shrink-0"
                    >
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 01-1.5 0v-2.25A.75.75 0 0118 12h3a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4 text-slate-800 flex-shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <span>{isDark ? "Modo Claro" : "Modo Oscuro"}</span>
                </button>

                {/* Botón de Cerrar Sesión (rojo) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm shadow-red-600/30 transition-all duration-150 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="w-4 h-4 flex-shrink-0"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                    />
                  </svg>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Área Contenedora Principal */}
      <div className="flex flex-1 w-full overflow-hidden relative">
        {/* Backdrop para móvil */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Lateral */}
        <aside
          style={{
            backgroundColor: isDark
              ? (institutionInfo.color_secundario_dark && institutionInfo.color_secundario_dark !== "#0f172a" ? institutionInfo.color_secundario_dark : "#000000")
              : (institutionInfo.color_primario_light || "#fbbf24"),
            color: isDark
              ? (institutionInfo.color_texto_dark || "#ffffff")
              : (institutionInfo.color_texto_light || "#0f172a"),
          }}
          className={`h-full shadow-2xl md:shadow-xl flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out select-none
            fixed inset-y-0 left-0 z-40 md:static md:z-10
            ${isMobileMenuOpen ? "translate-x-0 w-72 max-w-[85vw] p-5" : "-translate-x-full md:translate-x-0"}
            ${isCollapsed ? "md:w-20 md:p-3" : "md:w-64 md:p-5"}
            ${
              isDark
                ? "border-r border-zinc-800"
                : "border-r border-amber-500/40"
            }`}
        >
          {/* Cabecera del Sidebar */}
          <div
            className={`flex items-center pb-3 mb-3 transition-all ${
              isDark ? "border-b border-zinc-800" : "border-b border-amber-500/50"
            } ${isCollapsed ? "justify-center" : "justify-between px-1"}`}
          >
            {/* Header y botón cerrar para móvil */}
            <div className="flex items-center justify-between w-full md:hidden">
              <span
                className={`text-xs font-black uppercase tracking-widest ${
                  isDark ? "text-slate-300" : "text-amber-950 font-bold"
                }`}
              >
                Menú de Navegación
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-800 hover:text-black hover:bg-amber-500/30"
                }`}
                title="Cerrar menú"
                aria-label="Cerrar menú"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Controles Desktop */}
            <div className="hidden md:flex w-full items-center justify-between">
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="flex items-center justify-between w-full group/navheader cursor-pointer focus:outline-none rounded-xl py-1 px-1 -mx-1 text-left"
                  title="Guardar menú"
                  aria-label="Guardar menú"
                >
                  <span
                    className={`text-xs font-black uppercase tracking-widest truncate transition-colors ${
                      isDark
                        ? "text-slate-400 group-hover/navheader:text-white"
                        : "text-amber-950/80 group-hover/navheader:text-black"
                    }`}
                  >
                    Navegación
                  </span>
                  <span
                    className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                      isDark
                        ? "text-slate-300 group-hover/navheader:text-white group-hover/navheader:bg-slate-800/90"
                        : "text-slate-900 group-hover/navheader:text-black group-hover/navheader:bg-amber-500/40"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                      />
                    </svg>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={`p-2 rounded-xl transition-all focus:outline-none focus:ring-2 flex items-center justify-center cursor-pointer mx-auto ${
                    isDark
                      ? "text-slate-300 hover:text-white hover:bg-slate-800/90 focus:ring-blue-500/50"
                      : "text-slate-900 hover:text-black hover:bg-amber-500/40 focus:ring-amber-600/50"
                  }`}
                  title="Expandir menú"
                  aria-label="Expandir menú"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Lista de navegación */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
            <ul className="space-y-1.5">
              {navItems[userRole]?.map((item, index) => {
                const isActive = currentPage === item.page;
                let badgeCount = 0;
                if (item.name === "Comunicación con el Auditor") {
                  badgeCount = unreadAuditorMessages;
                } else if (item.name === "Comunicación con el Estudiante") {
                  badgeCount = unreadStudentMessages;
                } else if (item.name === "Comunicación con el Docente") {
                  badgeCount = unreadDocentMessages;
                } else if (item.name === "Comunicación") {
                  badgeCount = unreadAuditorMessages || unreadDocentMessages;
                } else if (
                  item.name === "Solicitudes de Certificados" ||
                  item.page === "docentCertificateRequests"
                ) {
                  badgeCount = pendingDocentDocuments;
                }
                const showBadge = badgeCount > 0;

                return (
                  <React.Fragment key={item.page || item.name || index}>
                    {/* Encabezado de Sección */}
                    {item.section && (
                      <li className="list-none pt-3 pb-1">
                        {!isCollapsed ? (
                          <span
                            className={`text-[11px] font-extrabold uppercase tracking-wider px-3 block ${
                              isDark ? "text-slate-400" : "text-amber-950/80"
                            }`}
                          >
                            {item.section}
                          </span>
                        ) : (
                          <div
                            className={`my-1.5 mx-1 border-t ${
                              isDark
                                ? "border-slate-800"
                                : "border-amber-500/50"
                            }`}
                          />
                        )}
                      </li>
                    )}

                    {/* Botón de la opción */}
                    <li className="list-none relative group">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onNavigate(item.page);
                        }}
                        className={`w-full flex items-center rounded-xl transition-all duration-150 cursor-pointer font-medium relative ${
                          isCollapsed
                            ? "justify-center p-3"
                            : "px-3.5 py-2.5 text-sm"
                        } ${
                          isActive
                            ? isDark
                              ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                              : "bg-slate-950 text-white font-bold shadow-md"
                            : isDark
                            ? "text-slate-300 hover:text-white hover:bg-slate-800/80"
                            : "text-slate-950 hover:bg-amber-500/35 hover:text-black font-semibold"
                        }`}
                      >
                        <span
                          className={`flex items-center justify-center flex-shrink-0 ${
                            isCollapsed ? "" : "mr-3"
                          }`}
                        >
                          {icons[item.name] || (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                              />
                            </svg>
                          )}
                        </span>

                        {!isCollapsed && (
                          <span
                            className={`flex-1 leading-snug whitespace-normal break-words text-left ${
                              item.name.length > 18 ? "text-xs font-semibold" : "text-sm"
                            } ${showBadge ? "pr-5" : ""}`}
                          >
                            {item.name}
                          </span>
                        )}

                        {/* Badge con el número pequeño arriba a la derecha */}
                        {showBadge && (
                          <span
                            className={`absolute ${
                              isCollapsed ? "top-1 right-1" : "top-2 right-2.5"
                            } min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shadow-md shadow-red-600/40 border border-white/20 animate-pulse pointer-events-none z-10`}
                            title={`${badgeCount} mensajes pendientes`}
                          >
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                      </button>

                      {/* Tooltip flotante al pasar el cursor en modo colapsado */}
                      {isCollapsed && (
                        <div
                          className={`absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-2xl whitespace-nowrap z-50 pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 border ${
                            isDark
                              ? "bg-slate-900 text-white border-slate-700"
                              : "bg-slate-900 text-white border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {showBadge && (
                              <span className="px-1.5 py-0.2 bg-red-600 text-white text-[10px] font-black rounded-full">
                                {badgeCount > 99 ? "99+" : badgeCount}
                              </span>
                            )}
                          </div>
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                        </div>
                      )}
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          </nav>


        </aside>

        {/* Área de Contenido Principal (Única que hace Scroll) */}
        <main
          className={`flex-1 min-w-0 h-full p-3.5 sm:p-5 md:p-6 lg:p-8 overflow-y-auto transition-colors duration-200 flex flex-col justify-between ${
            isDark ? "bg-black text-gray-100" : "bg-white text-gray-900"
          }`}
        >
          <div className="flex-1 w-full">
            {children}
          </div>
          <footer className="w-full text-center py-4 mt-8 border-t border-gray-100 dark:border-zinc-900/80">
            <p className="text-[11px] sm:text-xs text-gray-400 dark:text-zinc-600 font-medium tracking-wide select-none">
              © 2026 Sistema de gestion de practicas · Camilo Sáenz R. · Fred Manrique A. · Tunja, Boyacá
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
