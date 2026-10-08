import React from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  AlertTriangle,
  Ban,
  User,
  UserCheck,
  BookOpen,
  Building2,
  Search,
  Lightbulb,
} from "lucide-react";

export const DeleteConfirmModal = ({
  deleteTarget,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  if (!deleteTarget) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md border border-gray-100 dark:border-zinc-800 transform transition-all text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Trash2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">
          ¿Eliminar {deleteTarget.entityType}?
        </h3>
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-2">
          ¿Estás seguro de que deseas eliminar permanentemente:
        </p>
        <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-2xl p-3.5 mb-4">
          <p className="font-bold text-gray-900 dark:text-zinc-100 text-base">
            {deleteTarget.name}
          </p>
          {deleteTarget.extra && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{deleteTarget.extra}</p>
          )}
        </div>
        <p className="text-xs text-red-500 dark:text-red-400 font-semibold mb-6 flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Esta acción es irreversible y no se puede deshacer.</span>
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-6 py-2.5 rounded-xl font-bold text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white px-7 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isDeleting ? "Eliminando..." : "Sí, Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export const BlockedDeleteModal = ({ blockedDeleteInfo, onClose }) => {
  if (!blockedDeleteInfo) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-lg border border-amber-200 dark:border-amber-800/50 transform transition-all text-center">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Ban className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
          No es posible eliminar este elemento
        </h3>
        <p className="text-xs uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 mb-4">
          {blockedDeleteInfo.entityType || "Elemento con dependencias"}
        </p>

        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 mb-5 text-left">
          <p className="font-bold text-gray-900 dark:text-zinc-100 mb-1 text-sm">
            Registro:{" "}
            <span className="text-amber-900 dark:text-amber-300 font-extrabold">
              {blockedDeleteInfo.entityName}
            </span>
          </p>
          <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed mb-3">
            {blockedDeleteInfo.message}
          </p>

          {blockedDeleteInfo.dependencies && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/30">
              {blockedDeleteInfo.dependencies.estudiantes > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full text-xs font-semibold">
                  <User className="w-3.5 h-3.5" /> {blockedDeleteInfo.dependencies.estudiantes} Estudiante(s)
                </span>
              )}
              {blockedDeleteInfo.dependencies.docentes > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-semibold">
                  <UserCheck className="w-3.5 h-3.5" /> {blockedDeleteInfo.dependencies.docentes} Docente(s)
                </span>
              )}
              {blockedDeleteInfo.dependencies.asignaturas > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-full text-xs font-semibold">
                  <BookOpen className="w-3.5 h-3.5" /> {blockedDeleteInfo.dependencies.asignaturas} Asignatura(s)
                </span>
              )}
              {blockedDeleteInfo.dependencies.servicios > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 rounded-full text-xs font-semibold">
                  <Building2 className="w-3.5 h-3.5" /> {blockedDeleteInfo.dependencies.servicios} Servicio(s)
                </span>
              )}
              {blockedDeleteInfo.dependencies.auditores > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-semibold">
                  <Search className="w-3.5 h-3.5" /> {blockedDeleteInfo.dependencies.auditores} Auditor(es)
                </span>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-6 font-medium flex items-center justify-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Para poder eliminarlo, debes reasignar a otra entidad o eliminar previamente los registros asociados listados arriba.</span>
        </p>

        <button
          type="button"
          onClick={onClose}
          className="bg-blue-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-800 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};
