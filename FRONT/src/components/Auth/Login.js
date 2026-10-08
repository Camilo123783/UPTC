import React, { useState, useEffect } from "react";
import {
  saveActiveSession,
  getSavedProgress,
  clearSavedProgress,
} from "../../utils/sessionManager";
import { useTheme } from "../../context/ThemeContext";
import { BACKEND_URL } from "../../config/api";
import { User, Lock, Eye, EyeOff, Sun, Moon, AlertTriangle } from "lucide-react";

const API_BASE_URL = BACKEND_URL;

const Login = ({ onLoginSuccess, onNavigate }) => {
  const { isDark, toggleTheme } = useTheme();

  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [inactivityNotice, setInactivityNotice] = useState(null);
  const [savedProgressInfo, setSavedProgressInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const [institutionInfo, setInstitutionInfo] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("institutionSettings"));
      if (saved) {
        const bg = saved.fondo_institucion || saved.loginBgUrl || saved.login_bg_url || "";
        return {
          name: saved.name || "Facultad Ciencias de la Salud",
          logoPreview: saved.logo_institucion || saved.logo_url || saved.logoPreview || `${process.env.PUBLIC_URL || ""}/images/uptc.png`,
          fondo_institucion: bg,
          loginBgUrl: bg,
          login_bg_url: bg,
          slogan: saved.slogan || "Gestor de Prácticas",
          ...saved,
        };
      }
    } catch (e) {}
    return {
      name: "Facultad Ciencias de la Salud",
      logoPreview: `${process.env.PUBLIC_URL || ""}/images/uptc.png`,
      fondo_institucion: "",
      loginBgUrl: "",
      login_bg_url: "",
      slogan: "Gestor de Prácticas",
    };
  });

  // Cargar la configuración de la institución y verificar aviso de inactividad / progreso guardado
  useEffect(() => {
    const sanitizeUrls = (obj) => {
      if (!obj) return obj;
      const clean = { ...obj };
      for (const key of ["logo_institucion", "logoPreview", "logo_url", "fondo_institucion", "loginBgUrl", "login_bg_url"]) {
        if (clean[key] && typeof clean[key] === "string" && clean[key].startsWith("http://") && !clean[key].includes("localhost")) {
          clean[key] = clean[key].replace("http://", "https://");
        }
      }
      return clean;
    };

    const savedData = JSON.parse(localStorage.getItem("institutionSettings"));
    if (savedData) {
      setInstitutionInfo((prev) => ({ ...prev, ...sanitizeUrls(savedData) }));
    }

    // Consultar al backend para tener los datos y colores más recientes
    fetch(`${API_BASE_URL}/api/institution-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.name) {
          const cleanData = sanitizeUrls(data);
          setInstitutionInfo((prev) => ({ ...prev, ...cleanData }));
          localStorage.setItem("institutionSettings", JSON.stringify(cleanData));
        }
      })
      .catch((e) => {
        console.warn("Usando configuración institucional almacenada localmente.");
      });

    const handleSettingsUpdated = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("institutionSettings"));
        if (saved) setInstitutionInfo((prev) => ({ ...prev, ...saved }));
      } catch (e) {}
    };
    window.addEventListener("institutionSettingsUpdated", handleSettingsUpdated);

    const notice = localStorage.getItem("inactivityNoticeMessage");
    if (notice) {
      setInactivityNotice(notice);
    }

    const progress = getSavedProgress();
    if (progress && progress.isValid) {
      setSavedProgressInfo(progress);
    }

    return () => window.removeEventListener("institutionSettingsUpdated", handleSettingsUpdated);
  }, []);

  // Solo permite números en el campo de cédula
  const handleCedulaChange = (e) => {
    const numericValue = e.target.value.replace(/[^0-9]/g, "");
    setCedula(numericValue);
  };

  const [isWakingUp, setIsWakingUp] = useState(false);

  // --- FUNCIÓN PRINCIPAL DE LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!cedula || !password) {
      setError("Por favor, ingresa tu cédula y contraseña.");
      return;
    }

    setLoading(true);
    const wakeupTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3500);

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula, password }),
      });

      const data = await response.json();

      if (response.ok && data.user && data.role) {
        const userData = data.user;
        const userRole = data.role;

        // Comprobar si hay un progreso guardado para restaurar la vista previa a la inactividad
        const progress = getSavedProgress();
        let targetPage = "dashboard";

        if (progress && progress.isValid) {
          targetPage = progress.currentPage || "dashboard";
        }

        // Guardar sesión activa persistente
        saveActiveSession(userRole, targetPage, userData, data.token);
        clearSavedProgress();

        // Llamamos al callback para redirigir
        onLoginSuccess(userRole, targetPage, userData, data.token);
      } else if (response.status === 401 || response.status === 400) {
        setError(
          data.message ||
            "Credenciales incorrectas. Verifica tu cédula y contraseña."
        );
      } else {
        setError("Error en el servidor. Inténtalo más tarde.");
      }
    } catch (err) {
      console.error("Error durante el login:", err);
      setError(
        "No se pudo conectar con el servidor. Asegúrate de que esté activo."
      );
    } finally {
      clearTimeout(wakeupTimer);
      setIsWakingUp(false);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none">
      {/* ─── 1. FONDO DE CAMPUS INSTITUCIONAL CON IMAGEN DE ALTA DEFINICIÓN (SIEMPRE DIFUMINADA) ─── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-110 transition-all duration-1000 ease-out"
        style={{
          backgroundImage: `url('${institutionInfo.fondo_institucion || institutionInfo.loginBgUrl || institutionInfo.login_bg_url || `${process.env.PUBLIC_URL || ""}/campus_background.jpg`}')`,
          filter: "blur(8px)",
          WebkitFilter: "blur(8px)",
        }}
      />

      {/* ─── 2. SUPERPOSICIÓN DE COLOR Y DESENFOQUE VÍTREO (GLASSMORPHISM) ─── */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isDark
            ? "bg-gradient-to-br from-black/85 via-zinc-950/80 to-blue-950/85 backdrop-blur-[6px]"
            : "bg-gradient-to-br from-slate-900/60 via-blue-950/50 to-indigo-950/70 backdrop-blur-[4px]"
        }`}
      />

      {/* ─── 4. BOTÓN FLOTANTE PARA ALTERNAR MODO OSCURO / CLARO ─── */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Cambiar tema"
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-md bg-white/20 dark:bg-black/40 border border-white/30 dark:border-zinc-700/60 text-white hover:bg-white/30 dark:hover:bg-black/60 transition shadow-lg text-xs font-semibold cursor-pointer"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-200" />
              <span className="hidden sm:inline">Modo Oscuro</span>
            </>
          )}
        </button>
      </div>

      {/* ─── 5. TARJETA DE LOGIN GLASSMORPHIC ─── */}
      <div className="relative z-10 w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/60 dark:border-zinc-800/80 text-center transition-all duration-300 hover:shadow-blue-500/20">
        {/* Logo Institucional */}
        <div className="inline-block p-2 bg-white rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-3">
          <img
            src={
              institutionInfo.logo_institucion ||
              institutionInfo.logoPreview ||
              institutionInfo.logo_url ||
              `${process.env.PUBLIC_URL || ""}/images/uptc.png`
            }
            alt="Logo Institución"
            className="h-20 w-auto object-contain mx-auto"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = `${process.env.PUBLIC_URL || ""}/images/uptc.png`;
            }}
          />
        </div>

        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            {institutionInfo.name}
          </h2>
          {institutionInfo.slogan && (
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              {institutionInfo.slogan}
            </p>
          )}
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          {/* Campo Cédula */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
              Cédula de Ciudadanía
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400 dark:text-gray-500">
                <User className="w-5 h-5" />
              </span>
              <input
                type="tel"
                placeholder="Ingresa tu número de cédula"
                value={cedula}
                onChange={handleCedulaChange}
                className="w-full pl-11 pr-4 py-3 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white/80 dark:bg-zinc-800/80 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition"
                required
              />
            </div>
          </div>

          {/* Campo Contraseña con Toggle Ocultar/Mostrar */}
          <div>
            <div className="flex justify-between items-center mb-1.5 ml-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Contraseña
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400 dark:text-gray-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white/80 dark:bg-zinc-800/80 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-rose-950/50 border border-red-200 dark:border-rose-900/60 rounded-xl text-red-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botón Iniciar Sesión */}
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: isDark
                ? (institutionInfo.color_primario_dark || "#f59e0b")
                : (institutionInfo.color_primario_light || "#f59e0b"),
              color: isDark && institutionInfo.color_primario_dark === "#f59e0b" ? "#0f172a" : "#ffffff",
            }}
            className={`w-full py-3.5 px-4 font-bold rounded-xl shadow-lg transition transform active:scale-[0.98] ${
              loading
                ? "opacity-50 cursor-not-allowed"
                : "hover:opacity-90 hover:shadow-xl cursor-pointer"
            }`}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>

          {isWakingUp && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold animate-pulse flex items-center justify-center gap-2">
              <span>El servidor en la nube se está reactivando... por favor espera un momento.</span>
            </div>
          )}
        </form>

        <div className="mt-5 text-sm">
          <button
            onClick={() => onNavigate("forgotPassword")}
            className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition text-xs font-semibold"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {/* Banner de inactividad / progreso guardado */}
        {savedProgressInfo ? (
          <div className="mt-5 p-3.5 bg-amber-50 dark:bg-amber-950/40 text-center border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs rounded-xl shadow-sm">
            <p className="font-bold mb-1">⏱️ PROCESO DE GUARDADO ACTIVADO ⏱️</p>
            <p>
              Tu sesión anterior se cerró por 5 minutos de inactividad.
              <br />
              Tienes{" "}
              <strong className="underline text-amber-950 dark:text-amber-300">
                {savedProgressInfo.remainingMinutes} minuto(s)
              </strong>{" "}
              para ingresar y continuar donde estabas.
            </p>
          </div>
        ) : (
          inactivityNotice && (
            <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded-xl">
              ℹ️ {inactivityNotice}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Login;
