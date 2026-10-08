import React, { useState, useEffect, useMemo } from "react";
import AdminUserEditModal from "./AdminUserEditModal";
import AdminCsvImportModal from "./AdminCsvImportModal";
import { toast } from "react-toastify";
import {
  GraduationCap,
  UserCheck,
  Search,
  Crown,
  Shield,
  User
} from "lucide-react";

import { BACKEND_URL } from "../../config/api";
import { notifyDataChanged, useDataSync } from "../../utils/dataSync";

// Subcomponentes modulares de Gestión de Usuarios
import {
  UserTable,
  ProgramaTable,
  AsignaturaTable,
  InstitucionTable,
  ServicioTable,
  EditProgramaModal,
  EditAsignaturaModal,
  EditInstitucionModal,
  EditServicioModal,
  DeleteConfirmModal,
  BlockedDeleteModal,
  UserCreationSection,
  DEFAULT_ROLES,
  SUPERADMIN_ROLES,
  ADMIN_ROLES,
  DEFAULT_CREATION_CARDS,
  SUPERADMIN_CREATION_CARDS,
} from "./UserManagement";

const API_BASE_URL = BACKEND_URL;

// --- CONFIGURACIÓN DE FILTROS POR LISTA ---
export const USER_SORT_FIELDS = [
  { key: "Rol", label: "Rol" },
  { key: "Cédula", label: "Cédula" },
  { key: "Nombre", label: "Nombre" },
  { key: "Correo_Institucional", label: "Email" },
  { key: "Carrera", label: "Carrera" },
];

export const PROGRAMA_SORT_FIELDS = [
  { key: "nombreprograma", label: "Nombre del Programa" },
  { key: "total_estudiantes", label: "Estudiantes" },
  { key: "total_docentes", label: "Docentes" },
  { key: "total_asignaturas", label: "Asignaturas" },
];

export const ASIGNATURA_SORT_FIELDS = [
  { key: "Codigo", label: "Código" },
  { key: "Nombre", label: "Nombre de Asignatura" },
  { key: "ProgramaAsociado", label: "Programa Asociado" },
];

export const INSTITUCION_SORT_FIELDS = [
  { key: "nombreinstitucion", label: "Nombre de Institución" },
  { key: "total_servicios", label: "Servicios" },
  { key: "total_auditores", label: "Auditores" },
];

export const SERVICIO_SORT_FIELDS = [
  { key: "Nombre", label: "Nombre de Servicio" },
  { key: "InstitucionAsociada", label: "Institución Asociada" },
];

// Configuración inicial de ordenamiento
const USER_INITIAL_SORT = { key: "Rol", direction: "ascending" };
const PROGRAMA_INITIAL_SORT = { key: "nombreprograma", direction: "ascending" };
const ASIGNATURA_INITIAL_SORT = { key: "Nombre", direction: "ascending" };
const INSTITUCION_INITIAL_SORT = { key: "nombreinstitucion", direction: "ascending" };
const SERVICIO_INITIAL_SORT = { key: "Nombre", direction: "ascending" };

// --- MAPEO Y FORMATO DE ROLES EN ESPAÑOL ---
export const getRoleInfo = (rol) => {
  const r = String(rol || "").toLowerCase().trim();
  switch (r) {
    case "student":
    case "estudiante":
      return {
        key: "estudiante",
        label: "Estudiante",
        icon: GraduationCap,
        badgeClass:
          "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
      };
    case "docent":
    case "docente":
      return {
        key: "docente",
        label: "Docente",
        icon: UserCheck,
        badgeClass:
          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "auditor":
      return {
        key: "auditor",
        label: "Auditor",
        icon: Search,
        badgeClass:
          "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-800",
      };
    case "superadmin":
      return {
        key: "superadmin",
        label: "Super Admin",
        icon: Crown,
        badgeClass:
          "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
      };
    case "admin":
    case "administrador":
      return {
        key: "admin",
        label: "Administrador",
        icon: Shield,
        badgeClass:
          "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
      };
    default:
      return {
        key: r,
        label: rol || "N/A",
        icon: User,
        badgeClass:
          "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
      };
  }
};

// --------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------
const AdminUserManagement = ({ userRole: propUserRole }) => {
  const userRole =
    propUserRole ||
    localStorage.getItem("userRole") ||
    sessionStorage.getItem("userRole") ||
    "";
  const isSuperadmin = userRole === "superadmin";

  // --- ESTADOS PRINCIPALES DE LA UI Y FORMULARIO ---
  const [newEntity, setNewEntity] = useState({
    type: "",
    subType: "",
    role: "",
    cedula: "",
    codigo: "",
    nombre: "",
    apellidos: "",
    correo: "",
    password: "",
    programaId: "",
    institucionId: "",
    nombrePrograma: "",
    codigoAsignatura: "",
    nombreAsignatura: "",
    nombreInstitucion: "",
    nombreServicio: "",
  });

  const [errorMessage, setErrorMessage] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // --- ESTADOS DE LISTADO ---
  const [users, setUsers] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [asignaturas, setAsignaturas] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState(null);

  // --- ESTADOS DE ORDENAMIENTO ---
  const [userSortConfig, setUserSortConfig] = useState(USER_INITIAL_SORT);
  const [programaSortConfig, setProgramaSortConfig] = useState(PROGRAMA_INITIAL_SORT);
  const [asignaturaSortConfig, setAsignaturaSortConfig] = useState(ASIGNATURA_INITIAL_SORT);
  const [institucionSortConfig, setInstitucionSortConfig] = useState(INSTITUCION_INITIAL_SORT);
  const [servicioSortConfig, setServicioSortConfig] = useState(SERVICIO_INITIAL_SORT);

  // --- ESTADOS DE BÚSQUEDA ---
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [programaSearchTerm, setProgramaSearchTerm] = useState("");
  const [asignaturaSearchTerm, setAsignaturaSearchTerm] = useState("");
  const [institucionSearchTerm, setInstitucionSearchTerm] = useState("");
  const [servicioSearchTerm, setServicioSearchTerm] = useState("");
  const [selectedProgramaFilter, setSelectedProgramaFilter] = useState("all");

  // --- ESTADOS DE PAGINACIÓN (10 registros por página) ---
  const ITEMS_PER_PAGE = 10;
  const [userPage, setUserPage] = useState(1);
  const [programaPage, setProgramaPage] = useState(1);
  const [asignaturaPage, setAsignaturaPage] = useState(1);
  const [institucionPage, setInstitucionPage] = useState(1);
  const [servicioPage, setServicioPage] = useState(1);

  // --- ESTADOS DE MODALES ---
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingPrograma, setEditingPrograma] = useState(null);
  const [editingAsignatura, setEditingAsignatura] = useState(null);
  const [editingInstitucion, setEditingInstitucion] = useState(null);
  const [editingServicio, setEditingServicio] = useState(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // --- ESTADOS DE CONFIRMACIÓN Y BLOQUEO DE ELIMINACIÓN ---
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [blockedDeleteInfo, setBlockedDeleteInfo] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --------------------------------------------------
  // FUNCIONES AUXILIARES PARA RELACIONES
  // --------------------------------------------------
  const getProgramaName = (programaId) => {
    if (!programaId) return "N/A";
    const programa = programas.find((p) => String(p.id) === String(programaId));
    return programa ? programa.nombreprograma : `ID: ${programaId} (No encontrado)`;
  };

  const getInstitucionName = (institucionId) => {
    if (!institucionId) return "N/A";
    const institucion = instituciones.find((i) => String(i.id) === String(institucionId));
    return institucion ? institucion.nombreinstitucion : `ID: ${institucionId} (No encontrado)`;
  };

  // --------------------------------------------------
  // LÓGICA DE ORDENAMIENTO
  // --------------------------------------------------
  const sortData = (data, config) => {
    if (!data || data.length === 0) return [];
    const sortableData = [...data];
    if (!config || !config.key) return sortableData;

    return sortableData.sort((a, b) => {
      let aVal = a[config.key] ?? "";
      let bVal = b[config.key] ?? "";

      if (config.key === "Carrera") {
        aVal = a.Carrera || getProgramaName(a.programa_id) || "";
        bVal = b.Carrera || getProgramaName(b.programa_id) || "";
      } else if (config.key === "Rol") {
        aVal = getRoleInfo(a.Rol).label;
        bVal = getRoleInfo(b.Rol).label;
      }

      const aStr = String(aVal).trim();
      const bStr = String(bVal).trim();

      const isNumA = /^-?\d+(\.\d+)?$/.test(aStr);
      const isNumB = /^-?\d+(\.\d+)?$/.test(bStr);

      let comparison = 0;
      if (isNumA && isNumB) {
        comparison = parseFloat(aStr) - parseFloat(bStr);
      } else {
        comparison = aStr.localeCompare(bStr, "es", {
          sensitivity: "base",
          numeric: true,
        });
      }

      if (config.direction === "descending") {
        comparison *= -1;
      }

      if (comparison === 0) {
        const tieA = `${a.Nombre || ""} ${a.Apellidos || ""} ${a.Cédula || a.id_user_table || a.id || ""}`;
        const tieB = `${b.Nombre || ""} ${b.Apellidos || ""} ${b.Cédula || b.id_user_table || b.id || ""}`;
        comparison = tieA.localeCompare(tieB, "es", {
          sensitivity: "base",
          numeric: true,
        });
      }

      return comparison;
    });
  };

  const handleSort = (key, setConfig, currentConfig) => {
    let direction = "ascending";
    if (currentConfig.key === key && currentConfig.direction === "ascending") {
      direction = "descending";
    }
    setConfig({ key, direction });
  };

  // --- DEDUPLICACIÓN DE SEGURIDAD Y FILTRADO POR ROL PARA USUARIOS ---
  const uniqueUsers = useMemo(() => {
    const seen = new Set();
    const sourceUsers = isSuperadmin
      ? users.filter(
          (u) =>
            u.Rol === "superadmin" ||
            u.Rol === "admin" ||
            u.Rol === "administrador"
        )
      : users.filter((u) => u.Rol !== "superadmin");

    return sourceUsers.filter((u, idx) => {
      const key = `${u.Rol || ""}-${u.Cédula || ""}-${u.id_user_table || idx}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [users, isSuperadmin]);

  // --- FILTRADO EN TIEMPO REAL ---
  const filteredUsers = useMemo(() => {
    return uniqueUsers.filter((u) => {
      if (selectedProgramaFilter && selectedProgramaFilter !== "all") {
        if (selectedProgramaFilter === "none") {
          if (u.programa_id) return false;
        } else if (String(u.programa_id) !== String(selectedProgramaFilter)) {
          return false;
        }
      }

      if (!userSearchTerm.trim()) return true;
      const term = userSearchTerm.toLowerCase();
      const fullName = `${u.Nombre || ""} ${u.Apellidos || ""}`.toLowerCase();
      const cedula = String(u.Cédula || "").toLowerCase();
      const email = String(u.Correo_Institucional || "").toLowerCase();
      const rolLabel = getRoleInfo(u.Rol).label.toLowerCase();
      const rawRol = String(u.Rol || "").toLowerCase();
      const carrera = String(u.Carrera || getProgramaName(u.programa_id) || "").toLowerCase();
      const institucion = String(getInstitucionName(u.institucion_id) || "").toLowerCase();
      return (
        fullName.includes(term) ||
        cedula.includes(term) ||
        email.includes(term) ||
        rolLabel.includes(term) ||
        rawRol.includes(term) ||
        carrera.includes(term) ||
        institucion.includes(term)
      );
    });
  }, [uniqueUsers, selectedProgramaFilter, userSearchTerm, programas, instituciones]);

  const filteredProgramas = useMemo(() => {
    return programas.filter((p) => {
      if (!programaSearchTerm.trim()) return true;
      const term = programaSearchTerm.toLowerCase();
      return (p.nombreprograma || "").toLowerCase().includes(term);
    });
  }, [programas, programaSearchTerm]);

  const filteredAsignaturas = useMemo(() => {
    return asignaturas.filter((a) => {
      if (!asignaturaSearchTerm.trim()) return true;
      const term = asignaturaSearchTerm.toLowerCase();
      const nombre = (a.Nombre || "").toLowerCase();
      const codigo = String(a.Codigo || "").toLowerCase();
      const programa = (a.ProgramaAsociado || "").toLowerCase();
      return (
        nombre.includes(term) || codigo.includes(term) || programa.includes(term)
      );
    });
  }, [asignaturas, asignaturaSearchTerm]);

  const filteredInstituciones = useMemo(() => {
    return instituciones.filter((i) => {
      if (!institucionSearchTerm.trim()) return true;
      const term = institucionSearchTerm.toLowerCase();
      return (i.nombreinstitucion || "").toLowerCase().includes(term);
    });
  }, [instituciones, institucionSearchTerm]);

  const filteredServicios = useMemo(() => {
    return servicios.filter((s) => {
      if (!servicioSearchTerm.trim()) return true;
      const term = servicioSearchTerm.toLowerCase();
      const nombre = (s.Nombre || "").toLowerCase();
      const institucion = (s.InstitucionAsociada || "").toLowerCase();
      return nombre.includes(term) || institucion.includes(term);
    });
  }, [servicios, servicioSearchTerm]);

  // --- Datos Ordenados Memoizados ---
  const sortedUsers = useMemo(() => sortData(filteredUsers, userSortConfig), [filteredUsers, userSortConfig]);
  const sortedProgramas = useMemo(() => sortData(filteredProgramas, programaSortConfig), [filteredProgramas, programaSortConfig]);
  const sortedAsignaturas = useMemo(() => sortData(filteredAsignaturas, asignaturaSortConfig), [filteredAsignaturas, asignaturaSortConfig]);
  const sortedInstituciones = useMemo(() => sortData(filteredInstituciones, institucionSortConfig), [filteredInstituciones, institucionSortConfig]);
  const sortedServicios = useMemo(() => sortData(filteredServicios, servicioSortConfig), [filteredServicios, servicioSortConfig]);

  // --- REINICIAR PÁGINAS A 1 AL BUSCAR O FILTRAR ---
  useEffect(() => { setUserPage(1); }, [userSearchTerm, selectedProgramaFilter, userSortConfig]);
  useEffect(() => { setProgramaPage(1); }, [programaSearchTerm, programaSortConfig]);
  useEffect(() => { setAsignaturaPage(1); }, [asignaturaSearchTerm, asignaturaSortConfig]);
  useEffect(() => { setInstitucionPage(1); }, [institucionSearchTerm, institucionSortConfig]);
  useEffect(() => { setServicioPage(1); }, [servicioSearchTerm, servicioSortConfig]);

  // --- DATOS PAGINADOS (10 registros por página) ---
  const totalUserPages = Math.max(1, Math.ceil(sortedUsers.length / ITEMS_PER_PAGE));
  const currentUserPage = Math.min(userPage, totalUserPages);
  const paginatedUsers = sortedUsers.slice((currentUserPage - 1) * ITEMS_PER_PAGE, currentUserPage * ITEMS_PER_PAGE);

  const totalProgramaPages = Math.max(1, Math.ceil(sortedProgramas.length / ITEMS_PER_PAGE));
  const currentProgramaPage = Math.min(programaPage, totalProgramaPages);
  const paginatedProgramas = sortedProgramas.slice((currentProgramaPage - 1) * ITEMS_PER_PAGE, currentProgramaPage * ITEMS_PER_PAGE);

  const totalAsignaturaPages = Math.max(1, Math.ceil(sortedAsignaturas.length / ITEMS_PER_PAGE));
  const currentAsignaturaPage = Math.min(asignaturaPage, totalAsignaturaPages);
  const paginatedAsignaturas = sortedAsignaturas.slice((currentAsignaturaPage - 1) * ITEMS_PER_PAGE, currentAsignaturaPage * ITEMS_PER_PAGE);

  const totalInstitucionPages = Math.max(1, Math.ceil(sortedInstituciones.length / ITEMS_PER_PAGE));
  const currentInstitucionPage = Math.min(institucionPage, totalInstitucionPages);
  const paginatedInstituciones = sortedInstituciones.slice((currentInstitucionPage - 1) * ITEMS_PER_PAGE, currentInstitucionPage * ITEMS_PER_PAGE);

  const totalServicioPages = Math.max(1, Math.ceil(sortedServicios.length / ITEMS_PER_PAGE));
  const currentServicioPage = Math.min(servicioPage, totalServicioPages);
  const paginatedServicios = sortedServicios.slice((currentServicioPage - 1) * ITEMS_PER_PAGE, currentServicioPage * ITEMS_PER_PAGE);

  // --------------------------------------------------
  // FUNCIONES DE CARGA DE LISTAS (FETCH)
  // --------------------------------------------------
  const fetchUsers = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error al obtener usuarios:", error.message);
      setListError(`Error al cargar usuarios: ${error.message}. Asegúrate de que el servidor esté activo.`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProgramas = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/programas`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = await response.json();
      setProgramas(data);
    } catch (error) {
      console.error("Error al obtener programas:", error.message);
    }
  };

  const fetchAsignaturas = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/asignaturas`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = await response.json();
      setAsignaturas(data);
    } catch (error) {
      console.error("Error al obtener asignaturas:", error.message);
    }
  };

  const fetchInstituciones = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/instituciones`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = await response.json();
      setInstituciones(data);
    } catch (error) {
      console.error("Error al obtener instituciones:", error.message);
    }
  };

  const fetchServicios = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/servicios`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = await response.json();
      setServicios(data);
    } catch (error) {
      console.error("Error al obtener servicios:", error.message);
    }
  };

  const refreshAllData = async () => {
    try {
      await Promise.allSettled([
        fetchUsers(),
        fetchProgramas(),
        fetchAsignaturas(),
        fetchInstituciones(),
        fetchServicios(),
      ]);
    } catch (err) {
      console.error("Error al sincronizar todos los datos:", err);
    }
  };

  useDataSync(refreshAllData);

  // --------------------------------------------------
  // GESTIÓN DE ELIMINACIÓN CON CONFIRMACIÓN
  // --------------------------------------------------
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}${deleteTarget.endpoint}/${deleteTarget.id}${deleteTarget.query || ""}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 || data.hasDependencies) {
        const targetBackup = { ...deleteTarget };
        setDeleteTarget(null);
        setBlockedDeleteInfo({
          entityType: data.entityType || targetBackup.entityType,
          entityName: data.entityName || targetBackup.name,
          message:
            data.message ||
            `No se puede eliminar "${targetBackup.name}" porque tiene elementos asociados en el sistema.`,
          dependencies: data.dependencies || targetBackup.dependencies || null,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || `Fallo al eliminar ${deleteTarget.name}.`);
      }

      toast.success(data.message || `${deleteTarget.name} eliminado con éxito.`);

      const deletedType = deleteTarget.entityType;
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);

      await refreshAllData();
      notifyDataChanged(deletedType, "delete", { id: deletedId });
    } catch (err) {
      console.error("Error al eliminar entidad:", err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDeleteUser = (user) => {
    const fullName =
      `${user.Nombre || ""} ${user.Apellidos || ""}`.trim() ||
      `Usuario #${user.Cédula || user.id_user_table}`;
    setDeleteTarget({
      id: user.Cédula || user.id_user_table,
      name: fullName,
      entityType: "Usuario",
      extra: `Cédula: ${user.Cédula || "N/A"} | Rol: ${getRoleInfo(user.Rol).label}`,
      endpoint: "/api/admin/users",
      query: user.Rol ? `?rol=${encodeURIComponent(String(user.Rol).toLowerCase())}` : "",
    });
  };

  const requestDeletePrograma = (p) => {
    const totalEst = parseInt(p.total_estudiantes || 0, 10);
    const totalDoc = parseInt(p.total_docentes || 0, 10);
    const totalAsig = parseInt(p.total_asignaturas || 0, 10);

    const items = [];
    if (totalEst > 0) items.push(`${totalEst} estudiante(s)`);
    if (totalDoc > 0) items.push(`${totalDoc} docente(s)`);
    if (totalAsig > 0) items.push(`${totalAsig} asignatura(s)`);

    setDeleteTarget({
      id: p.id,
      name: p.nombreprograma,
      entityType: "Programa Académico",
      extra:
        items.length > 0
          ? `Elementos asociados reportados: ${items.join(", ")}`
          : "Programa sin dependencias activas",
      endpoint: "/api/admin/programas",
      dependencies: {
        estudiantes: totalEst,
        docentes: totalDoc,
        asignaturas: totalAsig,
      },
    });
  };

  const requestDeleteAsignatura = (a) => {
    setDeleteTarget({
      id: a.id_asignatura_table,
      name: a.Nombre,
      entityType: "Asignatura",
      extra: `Código: ${a.Codigo || "N/A"} | Programa: ${a.ProgramaAsociado || "N/A"}`,
      endpoint: "/api/admin/asignaturas",
    });
  };

  const requestDeleteInstitucion = (i) => {
    const totalServ = parseInt(i.total_servicios || 0, 10);
    const totalAud = parseInt(i.total_auditores || 0, 10);

    const items = [];
    if (totalServ > 0) items.push(`${totalServ} servicio(s)`);
    if (totalAud > 0) items.push(`${totalAud} auditor(es)`);

    setDeleteTarget({
      id: i.id,
      name: i.nombreinstitucion,
      entityType: "Institución",
      extra:
        items.length > 0
          ? `Elementos asociados reportados: ${items.join(", ")}`
          : "Institución de Salud",
      endpoint: "/api/admin/instituciones",
      dependencies: {
        servicios: totalServ,
        auditores: totalAud,
      },
    });
  };

  const requestDeleteServicio = (s) => {
    setDeleteTarget({
      id: s.id_servicio_table,
      name: s.Nombre,
      entityType: "Servicio",
      extra: `Institución: ${s.InstitucionAsociada || "N/A"}`,
      endpoint: "/api/admin/servicios",
    });
  };

  // --------------------------------------------------
  // GUARDADO DE EDICIONES
  // --------------------------------------------------
  const handleSaveEditedUser = async (updatedUser) => {
    const cedula = updatedUser.cedula || updatedUser.Cédula || updatedUser.id_user_table;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${cedula}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedUser),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Error desconocido" }));
        throw new Error(`Fallo al actualizar usuario: ${errorData.message || response.statusText}`);
      }

      toast.success("Usuario actualizado con éxito.");
      setSelectedUser(null);
      await refreshAllData();
      notifyDataChanged("user", "update", { cedula });
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      toast.error(`Error al actualizar el usuario: ${error.message}`);
    }
  };

  const handleSaveEditedPrograma = async (p) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/programas/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreprograma: p.nombreprograma }),
      });
      if (!res.ok) throw new Error("Fallo al actualizar el programa.");
      toast.success("Programa actualizado con éxito.");
      setEditingPrograma(null);
      await refreshAllData();
      notifyDataChanged("programa", "update", { id: p.id });
    } catch (err) {
      toast.error(err.message || "Error al actualizar el programa.");
    }
  };

  const handleStartEditAsignatura = (a) => {
    let progId = a.programa_id;
    if (!progId && a.ProgramaAsociado && programas.length > 0) {
      const found = programas.find(
        (p) =>
          String(p.id) === String(a.programa_id) ||
          p.nombreprograma?.trim().toLowerCase() === a.ProgramaAsociado?.trim().toLowerCase()
      );
      if (found) progId = found.id;
    }
    setEditingAsignatura({
      ...a,
      programa_id: progId != null ? String(progId) : "",
    });
  };

  const handleSaveEditedAsignatura = async (a) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/asignaturas/${a.id_asignatura_table || a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoasignatura: a.Codigo,
          nombreasignatura: a.Nombre,
          programa_id: a.programa_id,
        }),
      });
      if (!res.ok) throw new Error("Fallo al actualizar la asignatura.");
      toast.success("Asignatura actualizada con éxito.");
      setEditingAsignatura(null);
      await refreshAllData();
      notifyDataChanged("asignatura", "update", { id: a.id_asignatura_table || a.id });
    } catch (err) {
      toast.error(err.message || "Error al actualizar la asignatura.");
    }
  };

  const handleSaveEditedInstitucion = async (i) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/instituciones/${i.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreinstitucion: i.nombreinstitucion }),
      });
      if (!res.ok) throw new Error("Fallo al actualizar la institución.");
      toast.success("Institución actualizada con éxito.");
      setEditingInstitucion(null);
      await refreshAllData();
      notifyDataChanged("institucion", "update", { id: i.id });
    } catch (err) {
      toast.error(err.message || "Error al actualizar la institución.");
    }
  };

  const handleStartEditServicio = (s) => {
    let instId = s.institucion_id;
    if (!instId && s.InstitucionAsociada && instituciones.length > 0) {
      const found = instituciones.find(
        (i) =>
          String(i.id) === String(s.institucion_id) ||
          i.nombreinstitucion?.trim().toLowerCase() === s.InstitucionAsociada?.trim().toLowerCase()
      );
      if (found) instId = found.id;
    }
    setEditingServicio({
      ...s,
      institucion_id: instId != null ? String(instId) : "",
    });
  };

  const handleSaveEditedServicio = async (s) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/servicios/${s.id_servicio_table || s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreservicio: s.Nombre,
          institucion_id: s.institucion_id,
        }),
      });
      if (!res.ok) throw new Error("Fallo al actualizar el servicio.");
      toast.success("Servicio actualizado con éxito.");
      setEditingServicio(null);
      await refreshAllData();
      notifyDataChanged("servicio", "update", { id: s.id_servicio_table || s.id });
    } catch (err) {
      toast.error(err.message || "Error al actualizar el servicio.");
    }
  };

  // --------------------------------------------------
  // LÓGICA DE CREACIÓN
  // --------------------------------------------------
  const resetToOptions = () =>
    setNewEntity({
      type: "",
      subType: "",
      role: "",
      cedula: "",
      codigo: "",
      nombre: "",
      apellidos: "",
      correo: "",
      password: "",
      programaId: "",
      institucionId: "",
      nombrePrograma: "",
      codigoAsignatura: "",
      nombreAsignatura: "",
      nombreInstitucion: "",
      nombreServicio: "",
    });

  const goBackStep = () => {
    setErrorMessage(null);
    if (newEntity.subType) setNewEntity({ ...newEntity, subType: "" });
    else if (newEntity.role) setNewEntity({ ...newEntity, role: "" });
    else setNewEntity({ ...newEntity, type: "" });
  };

  const handleTypeChange = (newType) =>
    setNewEntity({ ...newEntity, type: newType, subType: "", role: "" });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "cedula" || name === "codigo") {
      const numericVal = String(value || "").replace(/\D/g, "");
      setNewEntity((prev) => ({ ...prev, [name]: numericVal }));
      return;
    }
    setNewEntity((prev) => ({ ...prev, [name]: value }));
  };

  const getRolId = (rol) => {
    const map = {
      superadmin: 1,
      admin: 2,
      administrador: 2,
      auditor: 3,
      docente: 4,
      estudiante: 5,
    };
    return map[rol] || null;
  };

  const validateForm = (entity) => {
    if (entity.type === "user") {
      if (!entity.role) return "Debe seleccionar un rol.";
      if (
        !entity.cedula ||
        !entity.nombre ||
        !entity.apellidos
      ) {
        return "Cédula, nombre y apellidos son obligatorios.";
      }
      if (!/^\d+$/.test(String(entity.cedula || "").trim())) {
        return "La cédula solo debe contener números (sin letras ni caracteres especiales).";
      }
      if (
        entity.role !== "superadmin" &&
        entity.role !== "admin" &&
        entity.role !== "administrador" &&
        !entity.correo
      ) {
        return "El correo institucional es obligatorio.";
      }
      if (
        ["docente", "estudiante"].includes(entity.role) &&
        !entity.programaId
      ) {
        return "El Programa es obligatorio para este rol.";
      }
      if (entity.role === "estudiante") {
        if (!entity.codigo) {
          return "El código estudiantil es obligatorio para los estudiantes.";
        }
        if (!/^\d+$/.test(String(entity.codigo || "").trim())) {
          return "El código estudiantil solo debe contener números (sin letras ni caracteres especiales).";
        }
      }
      if (entity.role === "auditor" && !entity.institucionId) {
        return "La Institución es obligatoria para el Auditor.";
      }
    } else if (entity.type === "programa" && !entity.nombrePrograma) {
      return "El Nombre del Programa es obligatorio.";
    } else if (entity.type === "asignatura") {
      if (
        !entity.codigoAsignatura ||
        !entity.nombreAsignatura ||
        !entity.programaId
      ) {
        return "Código, Nombre y Programa de la Asignatura son obligatorios.";
      }
    } else if (entity.type === "institucion_servicio") {
      if (!entity.subType)
        return "Debe seleccionar un tipo (Institución o Servicio).";
      if (entity.subType === "institucion" && !entity.nombreInstitucion) {
        return "El Nombre de la Institución es obligatorio.";
      }
      if (
        entity.subType === "servicio" &&
        (!entity.nombreServicio || !entity.institucionId)
      ) {
        return "Nombre del Servicio e Institución son obligatorios.";
      }
    } else if (!entity.type) {
      return "Seleccione un tipo de entidad a crear.";
    }
    return null;
  };

  const handleAddEntity = async () => {
    setErrorMessage(null);
    const validationError = validateForm(newEntity);
    if (validationError) {
      setErrorMessage(validationError);
      toast.error(validationError);
      return;
    }

    let endpoint = "";
    let dataToSend = {};
    let successMessage = "";

    try {
      switch (newEntity.type) {
        case "user":
          endpoint = `/api/admin/${newEntity.role}`;
          dataToSend = {
            rol_id: getRolId(newEntity.role),
            cedula: newEntity.cedula,
            password: newEntity.password || "123456",
            nombre: newEntity.nombre,
            apellidos: newEntity.apellidos,
            correo_institucional: newEntity.correo || null,
          };
          if (["docente", "estudiante"].includes(newEntity.role))
            dataToSend.programa_id = newEntity.programaId;
          if (newEntity.role === "estudiante")
            dataToSend.codigo = newEntity.codigo;
          if (newEntity.role === "auditor")
            dataToSend.institucion_id = newEntity.institucionId;

          successMessage = `Usuario ${newEntity.role.toUpperCase()} "${newEntity.nombre}" creado con éxito.`;
          break;

        case "programa":
          endpoint = "/api/admin/programa";
          dataToSend = { nombreprograma: newEntity.nombrePrograma };
          successMessage = `Programa "${newEntity.nombrePrograma}" creado con éxito.`;
          break;

        case "asignatura":
          endpoint = "/api/admin/asignatura";
          dataToSend = {
            codigoasignatura: newEntity.codigoAsignatura,
            nombreasignatura: newEntity.nombreAsignatura,
            programa_id: newEntity.programaId,
          };
          successMessage = `Asignatura "${newEntity.nombreAsignatura}" creada con éxito.`;
          break;

        case "institucion_servicio":
          if (newEntity.subType === "institucion") {
            endpoint = "/api/admin/institucion";
            dataToSend = { nombreinstitucion: newEntity.nombreInstitucion };
            successMessage = `Institución "${newEntity.nombreInstitucion}" creada con éxito.`;
          } else if (newEntity.subType === "servicio") {
            endpoint = "/api/admin/servicio";
            dataToSend = {
              nombreservicio: newEntity.nombreServicio,
              institucion_id: newEntity.institucionId,
            };
            successMessage = `Servicio "${newEntity.nombreServicio}" creado con éxito.`;
          }
          break;

        default:
          throw new Error("Seleccione un tipo de entidad válido.");
      }

      setIsCreating(true);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Error en la creación.");

      toast.success(successMessage);
      resetToOptions();

      await refreshAllData();
      notifyDataChanged(newEntity.type, "create");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Error en la creación.");
      setErrorMessage(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // --------------------------------------------------
  // --- RENDERIZADO PRINCIPAL ---
  // --------------------------------------------------
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-colors">

      {/* 1. SECCIÓN DE CREACIÓN DE ENTIDADES & ACCIONES */}
      <UserCreationSection
        newEntity={newEntity}
        setNewEntity={setNewEntity}
        handleTypeChange={handleTypeChange}
        handleInputChange={handleInputChange}
        handleAddEntity={handleAddEntity}
        goBackStep={goBackStep}
        isCreating={isCreating}
        setIsCsvModalOpen={setIsCsvModalOpen}
        programas={programas}
        instituciones={instituciones}
        roles={isSuperadmin ? SUPERADMIN_ROLES : ADMIN_ROLES}
        creationCards={isSuperadmin ? SUPERADMIN_CREATION_CARDS : DEFAULT_CREATION_CARDS}
      />

      {/* 2. TABLA DE USUARIOS */}
      <UserTable
        users={uniqueUsers}
        sortedUsers={sortedUsers}
        paginatedUsers={paginatedUsers}
        isLoading={isLoading}
        listError={listError}
        userSearchTerm={userSearchTerm}
        setUserSearchTerm={setUserSearchTerm}
        selectedProgramaFilter={selectedProgramaFilter}
        setSelectedProgramaFilter={setSelectedProgramaFilter}
        programas={programas}
        instituciones={instituciones}
        currentUserPage={currentUserPage}
        setUserPage={setUserPage}
        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
        userSortConfig={userSortConfig}
        setUserSortConfig={setUserSortConfig}
        handleSort={handleSort}
        handleEditUser={setSelectedUser}
        requestDeleteUser={requestDeleteUser}
        getProgramaName={getProgramaName}
        getInstitucionName={getInstitucionName}
        getRoleInfo={getRoleInfo}
        USER_SORT_FIELDS={USER_SORT_FIELDS}
        userRole={userRole}
      />

      {/* ─── Catálogos solo visibles para Administradores de Facultad ─── */}
      {!isSuperadmin && (
        <>
          {/* 3. TABLA DE PROGRAMAS ACADÉMICOS */}
      <ProgramaTable
        programas={programas}
        sortedProgramas={sortedProgramas}
        paginatedProgramas={paginatedProgramas}
        programaSearchTerm={programaSearchTerm}
        setProgramaSearchTerm={setProgramaSearchTerm}
        currentProgramaPage={currentProgramaPage}
        setProgramaPage={setProgramaPage}
        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
        programaSortConfig={programaSortConfig}
        setProgramaSortConfig={setProgramaSortConfig}
        handleSort={handleSort}
        setEditingPrograma={setEditingPrograma}
        requestDeletePrograma={requestDeletePrograma}
        PROGRAMA_SORT_FIELDS={PROGRAMA_SORT_FIELDS}
      />

      {/* 4. TABLA DE ASIGNATURAS */}
      <AsignaturaTable
        asignaturas={asignaturas}
        sortedAsignaturas={sortedAsignaturas}
        paginatedAsignaturas={paginatedAsignaturas}
        asignaturaSearchTerm={asignaturaSearchTerm}
        setAsignaturaSearchTerm={setAsignaturaSearchTerm}
        currentAsignaturaPage={currentAsignaturaPage}
        setAsignaturaPage={setAsignaturaPage}
        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
        asignaturaSortConfig={asignaturaSortConfig}
        setAsignaturaSortConfig={setAsignaturaSortConfig}
        handleSort={handleSort}
        handleStartEditAsignatura={handleStartEditAsignatura}
        requestDeleteAsignatura={requestDeleteAsignatura}
        ASIGNATURA_SORT_FIELDS={ASIGNATURA_SORT_FIELDS}
      />

      {/* 5. TABLA DE INSTITUCIONES */}
      <InstitucionTable
        instituciones={instituciones}
        sortedInstituciones={sortedInstituciones}
        paginatedInstituciones={paginatedInstituciones}
        institucionSearchTerm={institucionSearchTerm}
        setInstitucionSearchTerm={setInstitucionSearchTerm}
        currentInstitucionPage={currentInstitucionPage}
        setInstitucionPage={setInstitucionPage}
        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
        institucionSortConfig={institucionSortConfig}
        setInstitucionSortConfig={setInstitucionSortConfig}
        handleSort={handleSort}
        setEditingInstitucion={setEditingInstitucion}
        requestDeleteInstitucion={requestDeleteInstitucion}
        INSTITUCION_SORT_FIELDS={INSTITUCION_SORT_FIELDS}
      />

      {/* 6. TABLA DE SERVICIOS */}
      <ServicioTable
        servicios={servicios}
        sortedServicios={sortedServicios}
        paginatedServicios={paginatedServicios}
        servicioSearchTerm={servicioSearchTerm}
        setServicioSearchTerm={setServicioSearchTerm}
        currentServicioPage={currentServicioPage}
        setServicioPage={setServicioPage}
        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
        servicioSortConfig={servicioSortConfig}
        setServicioSortConfig={setServicioSortConfig}
        handleSort={handleSort}
        handleStartEditServicio={handleStartEditServicio}
        requestDeleteServicio={requestDeleteServicio}
        SERVICIO_SORT_FIELDS={SERVICIO_SORT_FIELDS}
      />
      </>
      )}

      {/* --- MODALES DE EDICIÓN --- */}
      {selectedUser && (
        <AdminUserEditModal
          user={selectedUser}
          programas={programas}
          instituciones={instituciones}
          onClose={() => setSelectedUser(null)}
          onSave={handleSaveEditedUser}
        />
      )}

      <EditProgramaModal
        editingPrograma={editingPrograma}
        setEditingPrograma={setEditingPrograma}
        onSave={handleSaveEditedPrograma}
      />

      <EditAsignaturaModal
        editingAsignatura={editingAsignatura}
        setEditingAsignatura={setEditingAsignatura}
        programas={programas}
        onSave={handleSaveEditedAsignatura}
      />

      <EditInstitucionModal
        editingInstitucion={editingInstitucion}
        setEditingInstitucion={setEditingInstitucion}
        onSave={handleSaveEditedInstitucion}
      />

      <EditServicioModal
        editingServicio={editingServicio}
        setEditingServicio={setEditingServicio}
        instituciones={instituciones}
        onSave={handleSaveEditedServicio}
      />

      {/* --- MODALES DE ELIMINACIÓN --- */}
      <DeleteConfirmModal
        deleteTarget={deleteTarget}
        isDeleting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <BlockedDeleteModal
        blockedDeleteInfo={blockedDeleteInfo}
        onClose={() => setBlockedDeleteInfo(null)}
      />

      {/* --- MODAL PARA CARGA MASIVA CSV / EXCEL --- */}
      <AdminCsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        initialEntityType={
          newEntity.type === "institucion_servicio"
            ? newEntity.subType || "institucion"
            : newEntity.type || "user"
        }
        initialRole={newEntity.role || (isSuperadmin ? "admin" : "estudiante")}
        programas={programas}
        instituciones={instituciones}
        userRole={userRole}
        onSuccess={() => {
          refreshAllData();
          notifyDataChanged("users", "bulk-import");
        }}
      />
    </div>
  );
};

export default AdminUserManagement;
