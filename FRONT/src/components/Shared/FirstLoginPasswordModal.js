// ============================================================
// src/components/Shared/FirstLoginPasswordModal.js
// Modal obligatorio de Cambio de Contraseña en Primer Inicio de Sesión
// ============================================================
import React, { useState } from "react";
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import toast from "../../utils/toast";

const FirstLoginPasswordModal = ({ isOpen, userName = "", onSuccess }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Por favor diligencia ambos campos de contraseña.");
      return;
    }

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener como mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden. Por favor verifícalas.");
      return;
    }

    setLoading(true);

    try {
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");

      const response = await fetch(`${BACKEND_URL}/api/auth/first-login-change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("¡Contraseña actualizada exitosamente! Bienvenido al sistema.");
        if (onSuccess) onSuccess();
      } else {
        setError(data.message || "No se pudo actualizar la contraseña. Inténtalo de nuevo.");
      }
    } catch (err) {
      console.error("Error al cambiar contraseña de primer inicio:", err);
      setError("Error de conexión al guardar la contraseña. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Cabecera del Modal */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 dark:from-emerald-950 dark:via-zinc-900 dark:to-zinc-950 p-5 sm:p-6 text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
            <KeyRound className="w-6 h-6 text-emerald-200" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/25 text-emerald-100 border border-emerald-400/30 mb-1">
              <ShieldCheck className="w-3 h-3" /> Seguridad Obligatoria
            </span>
            <h2 className="text-lg sm:text-xl font-bold leading-tight truncate">
              Personaliza tu Contraseña
            </h2>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              Requisito de Primer Inicio de Sesión
            </p>
          </div>
        </div>

        {/* Bienvenida personalizada */}
        {userName && (
          <div className="px-6 py-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200">
            Hola <strong>{userName}</strong>, por tu seguridad debes reemplazar la contraseña asignada por defecto por una clave personal definitiva.
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p>
              Crea una contraseña segura de al menos <strong>6 caracteres</strong>. Esta será tu contraseña definitiva para todos tus futuros ingresos.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Campo: Nueva Contraseña */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5">
              Nueva Contraseña *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-9 pr-10 py-2.5 bg-gray-50 dark:bg-zinc-800/80 border border-gray-300 dark:border-zinc-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Campo: Confirmar Contraseña */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5">
              Confirmar Nueva Contraseña *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu nueva contraseña"
                className="w-full pl-9 pr-10 py-2.5 bg-gray-50 dark:bg-zinc-800/80 border border-gray-300 dark:border-zinc-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword && (
              <p
                className={`text-[11px] mt-1 flex items-center gap-1 ${
                  newPassword === confirmPassword ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                }`}
              >
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Las contraseñas coinciden
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" /> Las contraseñas no coinciden
                  </>
                )}
              </p>
            )}
          </div>

          {/* Botón Guardar */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
                loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6
                  ? "bg-gray-300 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 cursor-not-allowed border border-gray-300 dark:border-zinc-700"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando contraseña...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Contraseña y Continuar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FirstLoginPasswordModal;
