import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../utils/useAuth";
import { API_URL } from "../../config/api";
import { toast } from "react-toastify";
import {
  Key,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Crown,
  Shield,
  UserCheck,
  Search,
  GraduationCap,
  User,
} from "lucide-react";

const CHANGE_PASSWORD_URL = `${API_URL}/auth/change-password`;

const ROLE_BADGES = {
  superadmin: {
    label: "Super Administrador",
    icon: Crown,
    gradient: "from-amber-500 to-amber-700",
    badgeClass:
      "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  admin: {
    label: "Administrador del Sistema",
    icon: Shield,
    gradient: "from-purple-600 to-indigo-600",
    badgeClass:
      "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  docent: {
    label: "Docente Universitario",
    icon: UserCheck,
    gradient: "from-emerald-600 to-teal-600",
    badgeClass:
      "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  auditor: {
    label: "Auditor Institucional",
    icon: Search,
    gradient: "from-cyan-600 to-blue-600",
    badgeClass:
      "bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
  },
  student: {
    label: "Estudiante de Pregrado",
    icon: GraduationCap,
    gradient: "from-violet-600 to-purple-600",
    badgeClass:
      "bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  },
};

const AuthChangePassword = ({ onNavigate, isAdminChange = false }) => {
  const { user } = useAuth();

  // Obtener datos del usuario autenticado
  const [userData, setUserData] = useState({
    cedula: "",
    name: "",
    apellidos: "",
    email: "",
    role: "student",
  });

  // Campos de formulario
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Visibilidad de contraseñas
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados de proceso y feedback
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let currentCedula = user?.cedula || user?.id || "";
    let currentName = user?.name || user?.nombre || "";
    let currentApellidos = user?.apellidos || user?.apellido || "";
    let currentEmail = user?.email || user?.correo_institucional || "";
    let currentRole = user?.role || "student";

    if (!currentCedula || !currentName) {
      try {
        const stored = sessionStorage.getItem("userData");
        if (stored) {
          const parsed = JSON.parse(stored);
          currentCedula = currentCedula || parsed.cedula || parsed.id || "";
          currentName = currentName || parsed.nombre || parsed.name || "";
          currentApellidos = currentApellidos || parsed.apellidos || parsed.apellido || "";
          currentEmail =
            currentEmail || parsed.correo_institucional || parsed.email || "";
          currentRole = currentRole || parsed.role || "student";
        }
      } catch (err) {
        console.error("Error leyendo datos de sesión:", err);
      }
    }

    setUserData({
      cedula: currentCedula,
      name: currentName,
      apellidos: currentApellidos,
      email: currentEmail,
      role: String(currentRole || "student").toLowerCase(),
    });
  }, [user]);

  // --- CÁLCULO DE FORTALEZA DE CONTRASEÑA ---
  const strengthInfo = useMemo(() => {
    if (!newPassword) {
      return { score: 0, label: "Sin ingresar", color: "bg-gray-200 dark:bg-zinc-700", width: "0%" };
    }

    let score = 0;
    const hasMinLen = newPassword.length >= 6;
    const hasGoodLen = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

    if (hasMinLen) score += 1;
    if (hasGoodLen) score += 1;
    if (hasUpper && hasLower) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;

    if (score <= 1) {
      return {
        score: 1,
        label: "Muy Débil",
        color: "bg-red-500",
        textColor: "text-red-500",
        width: "25%",
        checks: { hasMinLen, hasUpper, hasNumber, hasSpecial },
      };
    }
    if (score === 2) {
      return {
        score: 2,
        label: "Regular",
        color: "bg-amber-500",
        textColor: "text-amber-500",
        width: "50%",
        checks: { hasMinLen, hasUpper, hasNumber, hasSpecial },
      };
    }
    if (score === 3 || score === 4) {
      return {
        score: 3,
        label: "Buena",
        color: "bg-blue-500",
        textColor: "text-blue-500",
        width: "75%",
        checks: { hasMinLen, hasUpper, hasNumber, hasSpecial },
      };
    }
    return {
      score: 4,
      label: "Excelente y Segura",
      color: "bg-emerald-500",
      textColor: "text-emerald-500",
      width: "100%",
      checks: { hasMinLen, hasUpper, hasNumber, hasSpecial },
    };
  }, [newPassword]);

  // Verificación de coincidencia
  const passwordsMatch = useMemo(() => {
    if (!newPassword || !confirmNewPassword) return null;
    return newPassword === confirmNewPassword;
  }, [newPassword, confirmNewPassword]);

  // Manejo de envío
  const handleChangePassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setMessage("");
    setMessageType("");

    if (!isAdminChange && !currentPassword) {
      const msg = "Por favor, ingresa tu contraseña actual.";
      setMessage(msg);
      setMessageType("error");
      toast.error(msg);
      return;
    }

    if (!newPassword || !confirmNewPassword) {
      const msg = "Por favor, ingresa y confirma tu nueva contraseña.";
      setMessage(msg);
      setMessageType("error");
      toast.error(msg);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      const msg = "Las nuevas contraseñas no coinciden. Verifícalas cuidadosamente.";
      setMessage(msg);
      setMessageType("error");
      toast.error(msg);
      return;
    }

    if (newPassword.length < 6) {
      const msg = "La nueva contraseña debe tener al menos 6 caracteres.";
      setMessage(msg);
      setMessageType("error");
      toast.error(msg);
      return;
    }

    if (!isAdminChange && currentPassword === newPassword) {
      const msg = "La nueva contraseña debe ser diferente a la contraseña actual.";
      setMessage(msg);
      setMessageType("error");
      toast.warning(msg);
      return;
    }

    setIsLoading(true);

    const payload = {
      cedula: userData.cedula,
      currentPassword: isAdminChange ? undefined : currentPassword,
      newPassword,
    };

    try {
      const token = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(CHANGE_PASSWORD_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (
        response.status === 401 ||
        data.message === "Contraseña actual incorrecta." ||
        data.message === "Clave actual incorrecta"
      ) {
        const errorMsg = "La contraseña actual es incorrecta. Inténtalo de nuevo.";
        setMessage(errorMsg);
        setMessageType("error");
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      if (response.ok) {
        const successMsg = data.message || "¡Contraseña actualizada exitosamente!";
        setMessage(successMsg);
        setMessageType("success");
        toast.success(successMsg);

        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");

        if (!isAdminChange) {
          setTimeout(() => {
            if (onNavigate) onNavigate("dashboard");
          }, 2000);
        }
      } else {
        const errorMsg =
          data.message || "Error al actualizar la contraseña. Revisa los datos ingresados.";
        setMessage(errorMsg);
        setMessageType("error");
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error("Error durante el cambio de contraseña:", error);
      const networkMsg = "Error de conexión con el servidor. Inténtalo más tarde.";
      setMessage(networkMsg);
      setMessageType("error");
      toast.error(networkMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const roleInfo =
    ROLE_BADGES[userData.role] || {
      label: userData.role || "Usuario",
      icon: User,
      gradient: "from-blue-600 to-indigo-600",
      badgeClass:
        "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    };

  const fullName =
    `${userData.name} ${userData.apellidos}`.trim() ||
    `Usuario #${userData.cedula || "N/A"}`;

  return (
    <div className="min-h-full flex flex-col justify-center items-center py-6 px-4 sm:px-6 w-full transition-colors animate-in fade-in duration-300">
      <div className="w-full max-w-2xl my-auto">

      {/* --- ENCABEZADO SUPERIOR DISCRETO --- */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Cambio de Contraseña
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Actualiza tu clave de acceso institucional de manera segura.
          </p>
        </div>

        {!isAdminChange && onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all border border-gray-200 dark:border-zinc-700 shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver</span>
          </button>
        )}
      </div>

      {/* --- PANEL ÚNICO INTEGRADO --- */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-2xl transition-all">
        {/* Encabezado del Usuario dentro del Panel */}
        <div className="flex items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${roleInfo.gradient} flex items-center justify-center text-white shadow-md flex-shrink-0`}
            >
              <roleInfo.icon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                {fullName}
              </h2>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleInfo.badgeClass}`}
                >
                  {roleInfo.label}
                </span>
                {userData.cedula && (
                  <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
                    Doc: <span className="font-mono text-gray-800 dark:text-zinc-200">{userData.cedula}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleChangePassword} className="space-y-5 pt-6">
          {/* CAMPO: CONTRASEÑA ACTUAL */}
          {!isAdminChange && (
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                Contraseña Actual
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-gray-400 dark:text-zinc-500 pointer-events-none">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  className="w-full pl-10 pr-11 py-2.5 sm:py-3 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700/80 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title={showCurrentPassword ? "Ocultar" : "Mostrar"}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* CAMPO: NUEVA CONTRASEÑA */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Nueva Contraseña
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-gray-400 dark:text-zinc-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
                className="w-full pl-10 pr-11 py-2.5 sm:py-3 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700/80 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                title={showNewPassword ? "Ocultar" : "Mostrar"}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Medidor de Fortaleza Dinámico */}
            {newPassword && (
              <div className="mt-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-700/60 space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-600 dark:text-zinc-400">
                    Fortaleza de la clave:
                  </span>
                  <span className={`font-bold ${strengthInfo.textColor}`}>
                    {strengthInfo.label}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${strengthInfo.color} transition-all duration-300 rounded-full`}
                    style={{ width: strengthInfo.width }}
                  />
                </div>

                {/* Checklist Compacto de Requisitos */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  <div
                    className={`flex items-center gap-1.5 ${
                      newPassword.length >= 6
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-gray-400 dark:text-zinc-500"
                    }`}
                  >
                    {newPassword.length >= 6 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 flex items-center justify-center">○</span>
                    )}
                    <span>Mínimo 6 caracteres</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      /[A-Z]/.test(newPassword)
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-gray-400 dark:text-zinc-500"
                    }`}
                  >
                    {/[A-Z]/.test(newPassword) ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 flex items-center justify-center">○</span>
                    )}
                    <span>Una mayúscula (A-Z)</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      /[0-9]/.test(newPassword)
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-gray-400 dark:text-zinc-500"
                    }`}
                  >
                    {/[0-9]/.test(newPassword) ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 flex items-center justify-center">○</span>
                    )}
                    <span>Al menos un número (0-9)</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      /[^A-Za-z0-9]/.test(newPassword)
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-gray-400 dark:text-zinc-500"
                    }`}
                  >
                    {/[^A-Za-z0-9]/.test(newPassword) ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 flex items-center justify-center">○</span>
                    )}
                    <span>Símbolo especial (@$!%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CAMPO: CONFIRMAR NUEVA CONTRASEÑA */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-gray-400 dark:text-zinc-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
                className="w-full pl-10 pr-11 py-2.5 sm:py-3 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700/80 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                title={showConfirmPassword ? "Ocultar" : "Mostrar"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Indicador de Coincidencia */}
            {passwordsMatch !== null && (
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                {passwordsMatch ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Check className="w-4 h-4" />
                    <span>Las contraseñas coinciden correctamente</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Las contraseñas aún no coinciden</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Mensaje de alerta en tarjeta */}
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                messageType === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
              }`}
            >
              {messageType === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}

          {/* BOTONES DE ACCIÓN */}
          <div className="pt-3 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 px-6 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Actualizando Contraseña...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Actualizar Contraseña</span>
                </>
              )}
            </button>

            {!isAdminChange && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                disabled={isLoading}
                className="sm:w-auto bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 py-3 px-6 rounded-xl font-bold text-sm transition-colors border border-gray-200 dark:border-zinc-700 cursor-pointer text-center"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  </div>
);
};

export default AuthChangePassword;
