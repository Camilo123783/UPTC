import React from "react";
import { createPortal } from "react-dom";
import { Edit3 } from "lucide-react";

export const EditProgramaModal = ({
  editingPrograma,
  setEditingPrograma,
  onSave,
}) => {
  if (!editingPrograma) return null;
  const modalContent = (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-blue-500" /> Editar Programa
        </h3>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
            Nombre del Programa
          </label>
          <input
            type="text"
            value={editingPrograma.nombreprograma || ""}
            onChange={(e) =>
              setEditingPrograma({
                ...editingPrograma,
                nombreprograma: e.target.value,
              })
            }
            className="border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white p-2.5 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setEditingPrograma(null)}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-5 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(editingPrograma)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-colors cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export const EditAsignaturaModal = ({
  editingAsignatura,
  setEditingAsignatura,
  programas,
  onSave,
}) => {
  if (!editingAsignatura) return null;
  const modalContent = (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-blue-500" /> Editar Asignatura
        </h3>
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
              Código
            </label>
            <input
              type="text"
              value={editingAsignatura.Codigo || ""}
              onChange={(e) =>
                setEditingAsignatura({
                  ...editingAsignatura,
                  Codigo: e.target.value,
                })
              }
              className="border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white p-2.5 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={editingAsignatura.Nombre || ""}
              onChange={(e) =>
                setEditingAsignatura({
                  ...editingAsignatura,
                  Nombre: e.target.value,
                })
              }
              className="border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white p-2.5 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
              Programa Asociado
            </label>
            <select
              value={
                editingAsignatura.programa_id != null
                  ? String(editingAsignatura.programa_id)
                  : ""
              }
              onChange={(e) =>
                setEditingAsignatura({
                  ...editingAsignatura,
                  programa_id: e.target.value,
                })
              }
              className="border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white p-2.5 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer"
            >
              <option value="">Seleccionar Programa...</option>
              {programas.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nombreprograma}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setEditingAsignatura(null)}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-5 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(editingAsignatura)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-colors cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export const EditInstitucionModal = ({
  editingInstitucion,
  setEditingInstitucion,
  onSave,
}) => {
  if (!editingInstitucion) return null;
  const modalContent = (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-blue-500" /> Editar Institución
        </h3>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
            Nombre de la Institución
          </label>
          <input
            type="text"
            value={editingInstitucion.nombreinstitucion || ""}
            onChange={(e) =>
              setEditingInstitucion({
                ...editingInstitucion,
                nombreinstitucion: e.target.value,
              })
            }
            className="border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white p-2.5 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setEditingInstitucion(null)}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-5 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(editingInstitucion)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-colors cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export const EditServicioModal = ({
  editingServicio,
  setEditingServicio,
  instituciones,
  onSave,
}) => {
  if (!editingServicio) return null;
  const modalContent = (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-blue-500" /> Editar Servicio
        </h3>
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
              Nombre del Servicio
            </label>
            <input
              type="text"
              value={editingServicio.Nombre || ""}
              onChange={(e) =>
                setEditingServicio({
                  ...editingServicio,
                  Nombre: e.target.value,
                })
              }
              className="border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white p-2.5 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
              Institución Asociada
            </label>
            <select
              value={
                editingServicio.institucion_id != null
                  ? String(editingServicio.institucion_id)
                  : ""
              }
              onChange={(e) =>
                setEditingServicio({
                  ...editingServicio,
                  institucion_id: e.target.value,
                })
              }
              className="border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white p-2.5 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer"
            >
              <option value="">Seleccionar Institución...</option>
              {instituciones.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.nombreinstitucion}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setEditingServicio(null)}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-5 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(editingServicio)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-colors cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};
