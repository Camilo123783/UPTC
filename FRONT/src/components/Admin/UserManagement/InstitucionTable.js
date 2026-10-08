import React from "react";
import { Landmark, Building2, Search, Edit3, Trash2 } from "lucide-react";
import TableSearchBar from "./TableSearchBar";
import TablePagination from "./TablePagination";
import TableSortIcon from "./TableSortIcon";

export const InstitucionTable = ({
  instituciones,
  sortedInstituciones,
  paginatedInstituciones,
  institucionSearchTerm,
  setInstitucionSearchTerm,
  currentInstitucionPage,
  setInstitucionPage,
  ITEMS_PER_PAGE,
  institucionSortConfig,
  setInstitucionSortConfig,
  handleSort,
  setEditingInstitucion,
  requestDeleteInstitucion,
  INSTITUCION_SORT_FIELDS,
}) => {
  return (
    <div className="mb-10 p-5 sm:p-7 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Landmark className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          <span>Listado De Instituciones</span>
        </h2>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800">
          <span>{instituciones.length}</span>
          <span>registrada{instituciones.length === 1 ? "" : "s"}</span>
        </span>
      </div>

      {instituciones.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-6">
          No hay instituciones registradas para mostrar.
        </p>
      )}

      {instituciones.length > 0 && (
        <TableSearchBar
          value={institucionSearchTerm}
          onChange={setInstitucionSearchTerm}
          placeholder="Buscar por nombre de institución..."
          totalResults={sortedInstituciones.length}
          totalItems={instituciones.length}
        />
      )}

      {instituciones.length > 0 && sortedInstituciones.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-6 font-medium">
          No se encontraron instituciones que coincidan con "{institucionSearchTerm}".
        </p>
      )}

      <div className="overflow-x-auto mt-2 rounded-xl border border-gray-200 dark:border-zinc-800">
        <table className="w-full divide-y divide-gray-200 dark:divide-zinc-800 text-left border-collapse table-auto text-xs sm:text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800/80">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                Nombre de la Institución
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                Elementos Asociados
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
            {paginatedInstituciones.map((i, idx) => (
              <tr
                key={`inst-${i.id || idx}`}
                className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold text-center">
                  {i.nombreinstitucion}
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  <div className="flex flex-wrap justify-center items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 shadow-xs"
                      title="Servicios médicos/clínicos vinculados"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{i.total_servicios ?? 0} Servicios</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-xs"
                      title="Auditores vinculados a esta institución"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{i.total_auditores ?? 0} Auditores</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingInstitucion({ ...i })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                      title="Editar institución"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeleteInstitucion(i)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                      title="Eliminar institución"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        currentPage={currentInstitucionPage}
        totalItems={sortedInstituciones.length}
        pageSize={ITEMS_PER_PAGE}
        onPageChange={setInstitucionPage}
        entityLabel="instituciones"
      />

      <div className="mt-4 flex flex-wrap justify-center items-center gap-2 p-4 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-gray-200 dark:border-zinc-800">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 mr-2">
          Ordenar por:
        </span>
        {INSTITUCION_SORT_FIELDS.map((field) => (
          <button
            key={field.key}
            onClick={() =>
              handleSort(
                field.key,
                setInstitucionSortConfig,
                institucionSortConfig
              )
            }
            className={`text-xs py-1.5 px-3 rounded-full transition-colors font-medium shadow-sm cursor-pointer ${
              institucionSortConfig.key === field.key
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700"
            }`}
          >
            <TableSortIcon
              currentKey={field.key}
              config={institucionSortConfig}
              label={field.label}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default InstitucionTable;
