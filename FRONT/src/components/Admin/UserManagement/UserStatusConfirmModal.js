import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  UserCheck,
  UserX,
  AlertTriangle,
  Check,
  X,
  Mail,
  Shield,
  GraduationCap,
  Search,
  RefreshCw,
} from "lucide-react";

export const UserStatusConfirmModal = ({
  target,
  isToggling,
  onClose,
  onConfirm,
}) => {
  // Manejo de tecla Escape
  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isToggling) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [target, isToggling, onClose]);

  if (!target) return null;

  const isActivating = !!target.newStatus;
  const roleName = String(target.role || "").toLowerCase().trim();

  const getRoleBadge = () => {
    if (roleName === "student" || roleName === "estudiante") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
          <GraduationCap className="w-3 h-3" /> Estudiante
        </span>
      );
    }
    if (roleName === "docent" || roleName === "docente") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <UserCheck className="w-3 h-3" /> Docente
        </span>
      );
    }
    if (roleName === "auditor") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
          <Search className="w-3 h-3" /> Auditor
        </span>
      );
    }
    if (roleName === "admin" || roleName === "administrador") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <Shield className="w-3 h-3" /> Administrador
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
        Usuario
      </span>
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isToggling) {
          onClose();
        }
      }}
    >
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md border border-gray-100 dark:border-zinc-800 transform transition-all text-center animate-in zoom-in-95 duration-200">
        {/* Botón cerrar X */}
        <button
          type="button"
          onClick={onClose}
          disabled={isToggling}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icono de Cabecera */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border ${
            isActivating
              ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
              : "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60"
          }`}
        >
          {isActivating ? (
            <UserCheck className="w-8 h-8" />
          ) : (
            <UserX className="w-8 h-8" />
          )}
        </div>

        {/* Título y Subtítulo */}
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1.5 tracking-tight">
          {isActivating ? "¿Activar usuario?" : "¿Desactivar usuario?"}
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mb-4 font-normal">
          {isActivating
            ? "Estás a punto de reactivar el acceso al sistema para:"
            : "Estás a punto de suspender el acceso al sistema para:"}
        </p>

        {/* Tarjeta de Información del Usuario */}
        <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700/80 rounded-2xl p-4 mb-4 text-left shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-bold text-gray-900 dark:text-zinc-100 text-sm truncate">
              {target.userName || "Usuario"}
            </span>
            {getRoleBadge()}
          </div>

          <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-zinc-400 font-mono">
            <div>
              <span className="font-semibold text-gray-500 dark:text-zinc-500 font-sans mr-1">
                Cédula:
              </span>
              <span className="text-gray-800 dark:text-zinc-200 font-bold">
                {target.cedula || "N/A"}
              </span>
            </div>
            {target.email && (
              <div className="truncate">
                <span className="font-semibold text-gray-500 dark:text-zinc-500 font-sans mr-1">
                  Email:
                </span>
                <span className="text-gray-700 dark:text-zinc-300">
                  {target.email}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mensaje Informativo o Advertencia */}
        {isActivating ? (
          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-3 mb-6 text-left flex items-start gap-2.5">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
              El usuario podrá volver a ingresar a la plataforma inmediatamente con su cédula y contraseña registradas.
            </p>
          </div>
        ) : (
          <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/40 rounded-2xl p-3.5 mb-6 text-left space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>Acceso bloqueado en inicio de sesión</span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
              El usuario no podrá ingresar aunque ingrese su contraseña correcta. El sistema le indicará comunicarse con:
            </p>
            <div className="inline-flex items-center gap-1.5 font-mono font-bold text-rose-900 dark:text-rose-200 bg-rose-100/90 dark:bg-rose-900/40 px-2.5 py-1 rounded-lg text-xs w-full justify-center">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>enfermeriauptc2026@gmail.com</span>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex justify-center gap-3">
          <button
            type="button"
            disabled={isToggling}
            onClick={onClose}
            className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isToggling}
            onClick={onConfirm}
            className={`flex-1 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              isActivating
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25"
                : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25"
            }`}
          >
            {isToggling ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{isActivating ? "Activando..." : "Desactivando..."}</span>
              </>
            ) : isActivating ? (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Sí, Activar</span>
              </>
            ) : (
              <>
                <UserX className="w-4 h-4" />
                <span>Sí, Desactivar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default UserStatusConfirmModal;
