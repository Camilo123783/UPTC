import React, { useState, useMemo } from "react";
import {
  GraduationCap,
  AlertTriangle,
  Check,
  X,
  Edit3,
  Trash2,
  RefreshCw,
  Crown,
  Landmark,
  Users,
  UserCheck,
  Search,
  Shield,
  Building2,
} from "lucide-react";
import TableSearchBar from "./TableSearchBar";
import TablePagination from "./TablePagination";
import TableSortIcon from "./TableSortIcon";

// ─── Utilidad para renderizar iconos de Lucide (forwardRef) o elementos JSX de forma segura ───
const renderSafeIcon = (IconCmp, className = "") => {
  if (!IconCmp) return null;
  if (React.isValidElement(IconCmp)) return IconCmp;
  if (typeof IconCmp === "function" || (typeof IconCmp === "object" && IconCmp.$$typeof)) {
    return React.createElement(IconCmp, { className });
  }
  return null;
};

// ─── Componente genérico para cada sección de rol ───
const RoleSection = ({
  id,
  title,
  icon,
  badgeTheme,
  users,
  programas = [],
  instituciones = [],
  hasCodeCol = false,
  hasStudentDataCol = false,
  showProgramFilter = false,
  extraColHeader = "Carrera / Programa",
  renderExtraCol,
  sortFields = [],
  initialSortKey = "Nombre",
  handleEditUser,
  requestDeleteUser,
  getProgramaName,
  getInstitucionName,
  ITEMS_PER_PAGE = 10,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProg, setSelectedProg] = useState("all");
  const [sortConfig, setSortConfig] = useState({
    key: initialSortKey,
    direction: "ascending",
  });
  const [page, setPage] = useState(1);

  // Filtrado
  const filtered = useMemo(() => {
    return users.filter((u) => {
      // Filtro de programa si aplica
      if (showProgramFilter && selectedProg !== "all") {
        if (selectedProg === "none") {
          if (u.programa_id) return false;
        } else if (String(u.programa_id) !== String(selectedProg)) {
          return false;
        }
      }

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const fullName = `${u.Nombre || ""} ${u.Apellidos || ""}`.toLowerCase();
      const cedula = String(u.Cédula || "").toLowerCase();
      const codigo = String(u.Codigo || "").toLowerCase();
      const email = String(u.Correo_Institucional || "").toLowerCase();
      const carrera = String(
        u.Carrera || (getProgramaName ? getProgramaName(u.programa_id) : "") || ""
      ).toLowerCase();
      const inst = String(
        (getInstitucionName ? getInstitucionName(u.institucion_id) : "") || ""
      ).toLowerCase();

      return (
        fullName.includes(term) ||
        cedula.includes(term) ||
        codigo.includes(term) ||
        email.includes(term) ||
        carrera.includes(term) ||
        inst.includes(term)
      );
    });
  }, [users, searchTerm, selectedProg, showProgramFilter, getProgramaName, getInstitucionName]);

  // Ordenamiento
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (!sortConfig.key) return list;

    return list.sort((a, b) => {
      let aVal = a[sortConfig.key] ?? "";
      let bVal = b[sortConfig.key] ?? "";

      if (sortConfig.key === "Carrera") {
        aVal = a.Carrera || (getProgramaName ? getProgramaName(a.programa_id) : "") || "";
        bVal = b.Carrera || (getProgramaName ? getProgramaName(b.programa_id) : "") || "";
      } else if (sortConfig.key === "Institucion") {
        aVal = a.Carrera || (getInstitucionName ? getInstitucionName(a.institucion_id) : "") || "";
        bVal = b.Carrera || (getInstitucionName ? getInstitucionName(b.institucion_id) : "") || "";
      } else if (sortConfig.key === "Tiene_Datos_Adicionales") {
        aVal = a.Tiene_Datos_Adicionales ? 1 : 0;
        bVal = b.Tiene_Datos_Adicionales ? 1 : 0;
      }

      const aStr = String(aVal).trim();
      const bStr = String(bVal).trim();
      const isNumA = /^-?\d+(\.\d+)?$/.test(aStr);
      const isNumB = /^-?\d+(\.\d+)?$/.test(bStr);

      let comp = 0;
      if (isNumA && isNumB) {
        comp = parseFloat(aStr) - parseFloat(bStr);
      } else {
        comp = aStr.localeCompare(bStr, "es", { sensitivity: "base", numeric: true });
      }

      if (sortConfig.direction === "descending") comp *= -1;
      return comp;
    });
  }, [filtered, sortConfig, getProgramaName, getInstitucionName]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
    setPage(1);
  };

  return (
    <div
      id={id}
      className="mb-8 sm:mb-10 p-3.5 sm:p-6 md:p-7 border border-gray-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors scroll-mt-24 w-full min-w-0"
    >
      {/* Título de la sección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
          {renderSafeIcon(icon, "w-6 h-6 text-blue-600 dark:text-blue-400")}
          <span>{title}</span>
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${badgeTheme}`}
        >
          <span>{users.length}</span>
          <span>registrado{users.length === 1 ? "" : "s"}</span>
        </span>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8 bg-gray-50/60 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
          <div className="flex justify-center mb-2">
            {renderSafeIcon(icon, "w-8 h-8 text-gray-400")}
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            No hay registros en esta categoría en este momento.
          </p>
        </div>
      ) : (
        <>
          {/* Barra de búsqueda y filtro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className={showProgramFilter ? "md:col-span-2" : "md:col-span-3"}>
              <TableSearchBar
                value={searchTerm}
                onChange={(val) => {
                  setSearchTerm(val);
                  setPage(1);
                }}
                placeholder={`Buscar en ${title.toLowerCase()} por nombre, cédula o email...`}
                totalResults={sorted.length}
                totalItems={users.length}
              />
            </div>
            {showProgramFilter && (
              <div>
                <select
                  value={selectedProg}
                  onChange={(e) => {
                    setSelectedProg(e.target.value);
                    setPage(1);
                  }}
                  className="w-full py-2.5 px-3 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                >
                  <option value="all" className="bg-white dark:bg-zinc-900">
                    Todos los Programas
                  </option>
                  {programas.map((p) => (
                    <option key={p.id} value={String(p.id)} className="bg-white dark:bg-zinc-900">
                      {p.nombreprograma}
                    </option>
                  ))}
                  <option value="none" className="bg-white dark:bg-zinc-900">
                    Sin Carrera asignada
                  </option>
                </select>
              </div>
            )}
          </div>

          {users.length > 0 && sorted.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-6 font-medium">
              No se encontraron resultados con los filtros aplicados.
            </p>
          )}

          {/* Tabla */}
          {sorted.length > 0 && (
            <>
              <div
                className="w-full max-w-full overflow-x-auto rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs touch-pan-x"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <table className="w-full divide-y divide-gray-200 dark:divide-zinc-800 text-left border-collapse table-auto text-xs sm:text-sm">
                  <thead className="bg-gray-50 dark:bg-zinc-800/80">
                    <tr>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                        Cédula
                      </th>
                      {hasCodeCol && (
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                          Código
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                        Nombre Completo
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                        {extraColHeader}
                      </th>
                      {hasStudentDataCol && (
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                          Datos Estudiante
                        </th>
                      )}
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                    {paginated.map((user, idx) => (
                      <tr
                        key={`${user.Rol}-${user.Cédula || ""}-${user.id_user_table || idx}`}
                        className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="px-3 py-3 whitespace-nowrap text-xs font-mono font-bold text-gray-800 dark:text-zinc-300 text-center">
                          {user.Cédula || "N/A"}
                        </td>
                        {hasCodeCol && (
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-center font-mono">
                            {user.Codigo ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {user.Codigo}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-zinc-500 italic text-xs">Sin código</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-3 text-xs sm:text-sm text-gray-900 dark:text-white font-medium text-left max-w-[210px] leading-snug">
                          {`${user.Nombre || ""} ${user.Apellidos || ""}`.trim() || "N/A"}
                        </td>
                        <td
                          className="px-3 py-3 text-xs text-gray-600 dark:text-zinc-400 font-mono text-left max-w-[200px] truncate"
                          title={user.Correo_Institucional}
                        >
                          {user.Correo_Institucional || "N/A"}
                        </td>
                        <td className="px-3 py-3 text-xs text-center max-w-[210px]">
                          {renderExtraCol ? renderExtraCol(user) : (user.Carrera || "N/A")}
                        </td>
                        {hasStudentDataCol && (
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${
                                user.Tiene_Datos_Adicionales
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                              }`}
                            >
                              <span>
                                {user.Tiene_Datos_Adicionales ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                              </span>
                              <span>{user.Tiene_Datos_Adicionales ? "Registrados" : "Incompletos"}</span>
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditUser(user)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                              title="Editar usuario"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteUser(user)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                currentPage={currentPage}
                totalItems={sorted.length}
                pageSize={ITEMS_PER_PAGE}
                onPageChange={setPage}
                entityLabel={title.toLowerCase()}
              />

              {/* Botones de ordenamiento rápido */}
              {sortFields.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center items-center gap-2 p-3 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-gray-200 dark:border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 mr-2">
                    Ordenar por:
                  </span>
                  {sortFields.map((field) => (
                    <button
                      key={field.key}
                      onClick={() => handleSort(field.key)}
                      className={`text-xs py-1 px-3 rounded-full transition-colors font-medium shadow-xs cursor-pointer ${
                        sortConfig.key === field.key
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700"
                      }`}
                    >
                      <TableSortIcon currentKey={field.key} config={sortConfig} label={field.label} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

// ─── Componente Principal UserTable ───
export const UserTable = ({
  users = [],
  isLoading,
  listError,
  programas = [],
  instituciones = [],
  handleEditUser,
  requestDeleteUser,
  getProgramaName,
  getInstitucionName,
  getRoleInfo,
  userRole,
}) => {
  const isSuperadmin = userRole === "superadmin";

  // Para superadmin: estado de búsqueda y ordenamiento exclusivo
  const [saSearchTerm, setSaSearchTerm] = useState("");
  const [saSortConfig, setSaSortConfig] = useState({ key: "Rol", direction: "ascending" });
  const [saPage, setSaPage] = useState(1);

  // Clasificación de usuarios por rol
  // IMPORTANTE: Para el Administrador regular, se filtran estrictamente los superadmins
  const { estudiantes, docentes, auditores, administradores, superadminList } = useMemo(() => {
    const est = [];
    const doc = [];
    const aud = [];
    const adm = [];
    const sa = [];

    users.forEach((u) => {
      const r = String(u.Rol || "").toLowerCase().trim();
      if (r === "student" || r === "estudiante") {
        est.push(u);
      } else if (r === "docent" || r === "docente") {
        doc.push(u);
      } else if (r === "auditor") {
        aud.push(u);
      } else if (r === "admin" || r === "administrador") {
        adm.push(u);
        sa.push(u);
      } else if (r === "superadmin") {
        sa.push(u);
        // NUNCA agregar superadmin a administradores de facultad
      }
    });

    return {
      estudiantes: est,
      docentes: doc,
      auditores: aud,
      administradores: adm,
      superadminList: sa,
    };
  }, [users]);

  // Si está cargando o hay error general
  if (isLoading) {
    return (
      <div className="mb-8 p-8 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 text-center">
        <p className="text-blue-600 dark:text-blue-400 font-semibold text-lg animate-pulse flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando usuarios del sistema...
        </p>
      </div>
    );
  }

  if (listError) {
    return (
      <div className="mb-8 p-8 border border-rose-200 dark:border-rose-900/60 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 text-center">
        <p className="text-rose-600 dark:text-rose-400 font-bold text-lg">{listError}</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // CASO 1: VISTA EXCLUSIVA PARA SUPERADMINISTRADOR
  // ══════════════════════════════════════════════════════════════════
  if (isSuperadmin) {
    const filteredSa = superadminList.filter((u) => {
      if (!saSearchTerm.trim()) return true;
      const term = saSearchTerm.toLowerCase();
      const fullName = `${u.Nombre || ""} ${u.Apellidos || ""}`.toLowerCase();
      const cedula = String(u.Cédula || "").toLowerCase();
      const email = String(u.Correo_Institucional || "").toLowerCase();
      const rol = String(u.Rol || "").toLowerCase();
      return fullName.includes(term) || cedula.includes(term) || email.includes(term) || rol.includes(term);
    });

    const sortedSa = [...filteredSa].sort((a, b) => {
      let aVal = a[saSortConfig.key] ?? "";
      let bVal = b[saSortConfig.key] ?? "";
      let comp = String(aVal).localeCompare(String(bVal), "es", { sensitivity: "base", numeric: true });
      return saSortConfig.direction === "descending" ? comp * -1 : comp;
    });

    const saTotalPages = Math.max(1, Math.ceil(sortedSa.length / 10));
    const currentSaPage = Math.min(saPage, saTotalPages);
    const paginatedSa = sortedSa.slice((currentSaPage - 1) * 10, currentSaPage * 10);

    return (
      <div className="mb-10 p-6 sm:p-8 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-xl bg-white dark:bg-zinc-900 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Crown className="w-6 h-6 text-amber-500" />
            <span>Listado De Usuarios (Superadmins y Admins)</span>
          </h2>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
            <span>{superadminList.length}</span>
            <span>registrado{superadminList.length === 1 ? "" : "s"}</span>
          </span>
        </div>

        <TableSearchBar
          value={saSearchTerm}
          onChange={(val) => {
            setSaSearchTerm(val);
            setSaPage(1);
          }}
          placeholder="Buscar por nombre, apellido, cédula, email o rol..."
          totalResults={sortedSa.length}
          totalItems={superadminList.length}
        />

        <div className="overflow-x-auto mt-4 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs">
          <table className="w-full divide-y divide-gray-200 dark:divide-zinc-800 text-left border-collapse table-auto text-xs sm:text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/80">
              <tr>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                  Cédula
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                  Nombre Completo
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                  Dependencia
                </th>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
              {paginatedSa.map((user, idx) => {
                const roleInfo = getRoleInfo(user.Rol);
                return (
                  <tr
                    key={`sa-${user.Cédula || idx}`}
                    className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${roleInfo.badgeClass}`}
                      >
                        <span>
                          {renderSafeIcon(roleInfo.icon, "w-3.5 h-3.5")}
                        </span>
                        <span>{roleInfo.label}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs font-mono font-bold text-gray-800 dark:text-zinc-300 text-center">
                      {user.Cédula || "N/A"}
                    </td>
                    <td className="px-3 py-3 text-xs sm:text-sm text-gray-900 dark:text-white font-medium text-left">
                      {`${user.Nombre || ""} ${user.Apellidos || ""}`.trim() || "N/A"}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 dark:text-zinc-400 font-mono text-left">
                      {user.Correo_Institucional || "N/A"}
                    </td>
                    <td className="px-3 py-3 text-xs text-center">
                      {user.Rol === "superadmin" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Crown className="w-3.5 h-3.5" /> Superadministración UPTC
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Landmark className="w-3.5 h-3.5" /> Administración UPTC
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditUser(user)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteUser(user)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={currentSaPage}
          totalItems={sortedSa.length}
          pageSize={10}
          onPageChange={setSaPage}
          entityLabel="administradores"
        />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // CASO 2: VISTA PARA ADMINISTRADOR DE FACULTAD
  // 4 Listados separados y ordenados estrictamente:
  // 1. Estudiantes (Único con columna "Datos Estudiante")
  // 2. Docentes
  // 3. Auditores
  // 4. Administradores (Sin ningún Superadmin)
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="w-full">
      {/* Barra de Navegación Rápida entre Listados */}
      <div className="mb-10 p-4 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800 dark:text-zinc-100 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" /> Listados de Usuarios:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="#listado-estudiantes"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-950/70 dark:text-violet-300 border border-violet-200 dark:border-violet-800 transition-colors"
          >
            <GraduationCap className="w-3.5 h-3.5" /> Estudiantes ({estudiantes.length})
          </a>
          <a
            href="#listado-docentes"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" /> Docentes ({docentes.length})
          </a>
          <a
            href="#listado-auditores"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-950/70 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 transition-colors"
          >
            <Search className="w-3.5 h-3.5" /> Auditores ({auditores.length})
          </a>
          <a
            href="#listado-administradores"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors"
          >
            <Shield className="w-3.5 h-3.5" /> Administradores ({administradores.length})
          </a>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. LISTADO DE ESTUDIANTES
          (Único con la columna "Datos Estudiante")
      ───────────────────────────────────────────────────────────── */}
      <RoleSection
        id="listado-estudiantes"
        title="Listado De Estudiantes"
        icon={GraduationCap}
        badgeTheme="bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800"
        users={estudiantes}
        programas={programas}
        hasCodeCol={true}
        hasStudentDataCol={true}
        showProgramFilter={true}
        extraColHeader="Carrera / Programa"
        renderExtraCol={(user) => {
          const progName = user.Carrera || (getProgramaName ? getProgramaName(user.programa_id) : "");
          return progName && progName !== "No asignado" && !progName.includes("(No encontrado)") ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px] inline-block align-bottom">{progName}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Sin asignar
            </span>
          );
        }}
        sortFields={[
          { key: "Cédula", label: "Cédula" },
          { key: "Codigo", label: "Código" },
          { key: "Nombre", label: "Nombre" },
          { key: "Correo_Institucional", label: "Email" },
          { key: "Carrera", label: "Carrera" },
          { key: "Tiene_Datos_Adicionales", label: "Datos Estudiante" },
        ]}
        initialSortKey="Nombre"
        handleEditUser={handleEditUser}
        requestDeleteUser={requestDeleteUser}
        getProgramaName={getProgramaName}
        getInstitucionName={getInstitucionName}
      />

      {/* ─────────────────────────────────────────────────────────────
          2. LISTADO DE DOCENTES
      ───────────────────────────────────────────────────────────── */}
      <RoleSection
        id="listado-docentes"
        title="Listado De Docentes"
        icon={UserCheck}
        badgeTheme="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
        users={docentes}
        programas={programas}
        hasStudentDataCol={false}
        showProgramFilter={true}
        extraColHeader="Programa Académico"
        renderExtraCol={(user) => {
          const progName = user.Carrera || (getProgramaName ? getProgramaName(user.programa_id) : "");
          return progName && progName !== "No asignado" && !progName.includes("(No encontrado)") ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px] inline-block align-bottom">{progName}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Sin asignar
            </span>
          );
        }}
        sortFields={[
          { key: "Cédula", label: "Cédula" },
          { key: "Nombre", label: "Nombre" },
          { key: "Correo_Institucional", label: "Email" },
          { key: "Carrera", label: "Programa" },
        ]}
        initialSortKey="Nombre"
        handleEditUser={handleEditUser}
        requestDeleteUser={requestDeleteUser}
        getProgramaName={getProgramaName}
        getInstitucionName={getInstitucionName}
      />

      {/* ─────────────────────────────────────────────────────────────
          3. LISTADO DE AUDITORES
      ───────────────────────────────────────────────────────────── */}
      <RoleSection
        id="listado-auditores"
        title="Listado De Auditores"
        icon={Search}
        badgeTheme="bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800"
        users={auditores}
        instituciones={instituciones}
        hasStudentDataCol={false}
        showProgramFilter={false}
        extraColHeader="Institución Asociada"
        renderExtraCol={(user) => {
          const instName =
            user.Carrera || (getInstitucionName ? getInstitucionName(user.institucion_id) : "");
          return instName && instName !== "No asignada" && !instName.includes("(No encontrado)") ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              <Building2 className="w-3.5 h-3.5" />
              <span className="truncate max-w-[160px] inline-block align-bottom">{instName}</span>
            </span>
          ) : (
            <span className="text-gray-400 dark:text-zinc-500 text-xs font-medium">N/A</span>
          );
        }}
        sortFields={[
          { key: "Cédula", label: "Cédula" },
          { key: "Nombre", label: "Nombre" },
          { key: "Correo_Institucional", label: "Email" },
          { key: "Institucion", label: "Institución" },
        ]}
        initialSortKey="Nombre"
        handleEditUser={handleEditUser}
        requestDeleteUser={requestDeleteUser}
        getProgramaName={getProgramaName}
        getInstitucionName={getInstitucionName}
      />

      {/* ─────────────────────────────────────────────────────────────
          4. LISTADO DE ADMINISTRADORES
          (Estrictamente sin Superadmins)
      ───────────────────────────────────────────────────────────── */}
      <RoleSection
        id="listado-administradores"
        title="Listado De Administradores"
        icon={Shield}
        badgeTheme="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
        users={administradores}
        hasStudentDataCol={false}
        showProgramFilter={false}
        extraColHeader="Dependencia"
        renderExtraCol={() => (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Landmark className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Administración UPTC
          </span>
        )}
        sortFields={[
          { key: "Cédula", label: "Cédula" },
          { key: "Nombre", label: "Nombre" },
          { key: "Correo_Institucional", label: "Email" },
        ]}
        initialSortKey="Nombre"
        handleEditUser={handleEditUser}
        requestDeleteUser={requestDeleteUser}
        getProgramaName={getProgramaName}
        getInstitucionName={getInstitucionName}
      />
    </div>
  );
};

export default UserTable;
