import React from "react";
import { GraduationCap, User, UserCheck, BookOpen, Edit3, Trash2 } from "lucide-react";
import TableSearchBar from "./TableSearchBar";
import TablePagination from "./TablePagination";
import TableSortIcon from "./TableSortIcon";

export const ProgramaTable = ({
  programas,
  sortedProgramas,
  paginatedProgramas,
  programaSearchTerm,
  setProgramaSearchTerm,
  currentProgramaPage,
  setProgramaPage,
  ITEMS_PER_PAGE,
  programaSortConfig,
  setProgramaSortConfig,
  handleSort,
  setEditingPrograma,
  requestDeletePrograma,
  PROGRAMA_SORT_FIELDS,
}) => {
  return (
    <div className="mb-10 p-5 sm:p-7 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span>Listado De Programas</span>
        </h2>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
          <span>{programas.length}</span>
          <span>registrado{programas.length === 1 ? "" : "s"}</span>
        </span>
      </div>

      {programas.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-6">
          No hay programas académicos registrados para mostrar.
        </p>
      )}

      {programas.length > 0 && (
        <TableSearchBar
          value={programaSearchTerm}
          onChange={setProgramaSearchTerm}
          placeholder="Buscar por nombre de programa..."
          totalResults={sortedProgramas.length}
          totalItems={programas.length}
        />
      )}

      {programas.length > 0 && sortedProgramas.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-6 font-medium">
          No se encontraron programas que coincidan con "{programaSearchTerm}".
        </p>
      )}

      <div className="overflow-x-auto mt-2 rounded-xl border border-gray-200 dark:border-zinc-800">
        <table className="w-full divide-y divide-gray-200 dark:divide-zinc-800 text-left border-collapse table-auto text-xs sm:text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800/80">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                Nombre del Programa
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
            {paginatedProgramas.map((p, idx) => (
              <tr
                key={`prog-${p.id || idx}`}
                className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white font-bold text-center">
                  {p.nombreprograma}
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  <div className="flex flex-wrap justify-center items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-xs"
                      title="Estudiantes inscritos en este programa"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{p.total_estudiantes ?? 0} Estudiantes</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs"
                      title="Docentes asignados a este programa"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{p.total_docentes ?? 0} Docentes</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-xs"
                      title="Asignaturas pertenecientes a este programa"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{p.total_asignaturas ?? 0} Asignaturas</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingPrograma({ ...p })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                      title="Editar programa"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeletePrograma(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                      title="Eliminar programa"
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
        currentPage={currentProgramaPage}
        totalItems={sortedProgramas.length}
        pageSize={ITEMS_PER_PAGE}
        onPageChange={setProgramaPage}
        entityLabel="programas"
      />

      <div className="mt-4 flex flex-wrap justify-center items-center gap-2 p-4 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-gray-200 dark:border-zinc-800">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 mr-2">
          Ordenar por:
        </span>
        {PROGRAMA_SORT_FIELDS.map((field) => (
          <button
            key={field.key}
            onClick={() =>
              handleSort(field.key, setProgramaSortConfig, programaSortConfig)
            }
            className={`text-xs py-1.5 px-3 rounded-full transition-colors font-medium shadow-sm cursor-pointer ${
              programaSortConfig.key === field.key
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700"
            }`}
          >
            <TableSortIcon
              currentKey={field.key}
              config={programaSortConfig}
              label={field.label}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProgramaTable;
