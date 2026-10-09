// ============================================================
// src/components/Admin/AdminPractices.js — Gestión Integral de Prácticas
// ============================================================
import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import toast from "../../utils/toast";
import {
  Building2,
  ClipboardList,
  UserCheck,
  Shield,
  PenTool,
  Landmark,
  BookOpen,
  Book,
  Search,
  GraduationCap,
  FileEdit,
  X,
  Calendar,
  Clock,
  Flag,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { notifyDataChanged, useDataSync } from "../../utils/dataSync";

const API_BASE_URL = BACKEND_URL;

const ESTADOS_PRACTICA = [
  { value: "Activa", label: "Activa", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" },
  { value: "Planificada", label: "Planificada", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800" },
  { value: "En Curso", label: "En Curso", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" },
  { value: "Finalizada", label: "Finalizada", color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800" },
  { value: "Cancelada", label: "Cancelada", color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800" },
];

const getTodayIso = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatReadableDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const parts = dateStr.substring(0, 10).split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    }
  } catch (e) {}
  return dateStr;
};

// Cálculo automático del ciclo de vida de la práctica según sus fechas
const calculateLifecycleStatus = (currentStatus, fechaInicio, fechaFin) => {
  if (currentStatus === "Cancelada") return "Cancelada";
  const todayStr = getTodayIso();
  const fFin = fechaFin ? (typeof fechaFin === "string" ? fechaFin.substring(0, 10) : "") : "";
  const fIni = fechaInicio ? (typeof fechaInicio === "string" ? fechaInicio.substring(0, 10) : "") : "";

  // 1. Si llegó o superó la fecha final -> 'Finalizada'
  if (fFin && todayStr >= fFin) {
    return "Finalizada";
  }
  // 2. Si hoy es anterior a la fecha de inicio -> 'Planificada'
  if (fIni && todayStr < fIni) {
    return "Planificada";
  }
  // 3. Si llegó o superó la fecha de inicio (y no ha terminado) -> 'Activa'
  if (fIni && todayStr >= fIni) {
    return "Activa";
  }
  return currentStatus || "Planificada";
};


const AdminPractices = () => {
  const todayIso = getTodayIso();
  const todayFormattedText = useMemo(() => {
    try {
      const d = new Date();
      const text = d.toLocaleDateString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return text.charAt(0).toUpperCase() + text.slice(1);
    } catch (e) {
      return todayIso;
    }
  }, [todayIso]);

  const todayShortText = useMemo(() => {
    try {
      return new Date().toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return todayIso;
    }
  }, [todayIso]);

  // ─── Estados de Catálogos y Datos ───
  const [practices, setPractices] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [asignaturas, setAsignaturas] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Filtros y Búsqueda ───
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterPrograma, setFilterPrograma] = useState("Todos");
  const [filterInstitucion, setFilterInstitucion] = useState("Todas");

  // ─── Clave de Almacenamiento de Borrador ───
  const DRAFT_KEY = "admin_practice_form_draft";

  // ─── Formulario de Práctica ───
  const initialFormState = {
    id: null,
    titulo: "",
    programa_id: "",
    asignatura_id: "",
    institucion_id: "",
    servicio_id: "",
    docente_cedula: "",
    auditor_cedula: "",
    periodo: "2024-1",
    fecha_inicio: "",
    fecha_fin: "",
    horas_totales: 120,
    cupos: 10,
    estado: "Planificada",
    motivo_cancelacion: "",
    descripcion: "",
    horario: "",
    estudiantes: [], // Array de cédulas seleccionadas
  };

  // ─── Cargar Borrador si Existe ───
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.formData) return parsed.formData;
      }
    } catch (e) {
      console.warn("No se pudo restaurar el borrador de práctica:", e);
    }
    return initialFormState;
  });

  const [isModalOpen, setIsModalOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed && parsed.isModalOpen);
      }
    } catch (e) {
      console.warn(e);
    }
    return false;
  });

  const [isEditing, setIsEditing] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed && parsed.isEditing);
      }
    } catch (e) {
      console.warn(e);
    }
    return false;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [viewingPractice, setViewingPractice] = useState(null);
  const [deletingPractice, setDeletingPractice] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Guardar automáticamente el borrador en memoria de sesión si el modal está abierto
  useEffect(() => {
    if (isModalOpen) {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ isModalOpen, isEditing, formData })
      );
    }
  }, [isModalOpen, isEditing, formData]);


  // ─── Filtrar Docentes, Auditores y Estudiantes ───
  const docents = useMemo(() => users.filter((u) => u.Rol === "docent"), [users]);
  const auditors = useMemo(() => users.filter((u) => u.Rol === "auditor"), [users]);
  const students = useMemo(() => users.filter((u) => u.Rol === "student"), [users]);

  // ─── Cargar Datos del Servidor ───
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [practRes, progRes, asigRes, instRes, servRes, usersRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/admin/practices`),
        fetch(`${API_BASE_URL}/api/admin/programas`),
        fetch(`${API_BASE_URL}/api/admin/asignaturas`),
        fetch(`${API_BASE_URL}/api/admin/instituciones`),
        fetch(`${API_BASE_URL}/api/admin/servicios`),
        fetch(`${API_BASE_URL}/api/admin/users`),
      ]);

      if (practRes.status === "fulfilled" && practRes.value.ok) {
        setPractices(await practRes.value.json());
      }
      if (progRes.status === "fulfilled" && progRes.value.ok) {
        setProgramas(await progRes.value.json());
      }
      if (asigRes.status === "fulfilled" && asigRes.value.ok) {
        setAsignaturas(await asigRes.value.json());
      }
      if (instRes.status === "fulfilled" && instRes.value.ok) {
        setInstituciones(await instRes.value.json());
      }
      if (servRes.status === "fulfilled" && servRes.value.ok) {
        setServicios(await servRes.value.json());
      }
      if (usersRes.status === "fulfilled" && usersRes.value.ok) {
        setUsers(await usersRes.value.json());
      }
    } catch (err) {
      console.error("Error al cargar datos de prácticas:", err);
      toast.error("Error al sincronizar datos de prácticas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Sincronización en tiempo real
  useDataSync(fetchAllData);

  // ─── Programa seleccionado actualmente en el modal ───
  const selectedProgram = useMemo(() => {
    return programas.find((p) => String(p.id) === String(formData.programa_id));
  }, [programas, formData.programa_id]);

  const selectedProgramName = selectedProgram?.nombreprograma || "";

  // ─── Total de estudiantes registrados en el programa seleccionado ───
  const totalStudentsInProgram = useMemo(() => {
    if (!formData.programa_id) return 0;
    return students.filter((st) => String(st.programa_id) === String(formData.programa_id)).length;
  }, [students, formData.programa_id]);

  // ─── Asignaturas filtradas según el Programa seleccionado en el modal ───
  const availableAsignaturas = useMemo(() => {
    if (!formData.programa_id) return [];
    return asignaturas.filter(
      (a) => String(a.programa_id) === String(formData.programa_id)
    );
  }, [asignaturas, formData.programa_id]);

  // ─── Docentes filtrados según el Programa seleccionado en el modal ───
  const availableDocents = useMemo(() => {
    if (!formData.programa_id) return [];
    const filtered = docents.filter(
      (d) => String(d.programa_id) === String(formData.programa_id)
    );
    // Si estamos editando y ya había un docente asignado previamente, conservarlo para no desconfigurar
    if (formData.docente_cedula && !filtered.some((d) => String(d.Cédula) === String(formData.docente_cedula))) {
      const assignedDoc = docents.find((d) => String(d.Cédula) === String(formData.docente_cedula));
      if (assignedDoc) {
        filtered.push(assignedDoc);
      }
    }
    return filtered;
  }, [docents, formData.programa_id, formData.docente_cedula]);

  // ─── Servicios filtrados según la Institución seleccionada en el modal ───
  const availableServicios = useMemo(() => {
    if (!formData.institucion_id) return servicios;
    return servicios.filter(
      (s) => String(s.institucion_id) === String(formData.institucion_id)
    );
  }, [servicios, formData.institucion_id]);

  // ─── Auditores sugeridos según la Institución ───
  const availableAuditors = useMemo(() => {
    if (!formData.institucion_id) return auditors;
    const instAuditors = auditors.filter(
      (au) => String(au.institucion_id) === String(formData.institucion_id)
    );
    return instAuditors.length > 0 ? instAuditors : auditors;
  }, [auditors, formData.institucion_id]);

  // ─── Estudiantes disponibles para añadir al modal (no seleccionados aún y filtrados por programa) ───
  const selectableStudents = useMemo(() => {
    if (!formData.programa_id) return [];
    const selectedSet = new Set(formData.estudiantes.map(String));
    return students.filter((st) => {
      // Filtrar estrictamente por el programa académico seleccionado
      if (String(st.programa_id) !== String(formData.programa_id)) return false;
      const cedulaStr = String(st.Cédula || st.id_user_table);
      if (selectedSet.has(cedulaStr)) return false;
      if (!studentSearch.trim()) return true;
      const search = studentSearch.toLowerCase();
      const name = `${st.Nombre || ""} ${st.Apellidos || ""}`.toLowerCase();
      return name.includes(search) || cedulaStr.includes(search);
    });
  }, [students, formData.programa_id, formData.estudiantes, studentSearch]);

  // ─── Estudiantes seleccionados en el formulario con sus datos completos ───
  const selectedStudentsDetails = useMemo(() => {
    const selectedSet = new Set(formData.estudiantes.map(String));
    return students.filter((st) => selectedSet.has(String(st.Cédula || st.id_user_table)));
  }, [students, formData.estudiantes]);

  // ─── Limpieza automática de datos inconsistentes (ej. procedentes de borradores antiguos) ───
  useEffect(() => {
    if (formData.programa_id && formData.docente_cedula && docents.length > 0 && !isEditing) {
      const match = docents.some(
        (d) => String(d.Cédula) === String(formData.docente_cedula) && String(d.programa_id) === String(formData.programa_id)
      );
      if (!match) {
        setFormData((prev) => ({ ...prev, docente_cedula: "" }));
      }
    }
  }, [formData.programa_id, docents, isEditing]);

  useEffect(() => {
    if (formData.programa_id && formData.estudiantes.length > 0 && students.length > 0 && !isEditing) {
      const validStudentCedulas = new Set(
        students
          .filter((st) => String(st.programa_id) === String(formData.programa_id))
          .map((st) => String(st.Cédula || st.id_user_table))
      );
      const filtered = formData.estudiantes.filter((c) => validStudentCedulas.has(String(c)));
      if (filtered.length !== formData.estudiantes.length) {
        setFormData((prev) => ({ ...prev, estudiantes: filtered }));
      }
    }
  }, [formData.programa_id, students, isEditing]);

  // ─── Handlers del Formulario ───
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Si cambia el programa académico:
      if (name === "programa_id") {
        // Limpiar la asignatura si cambia de programa
        updated.asignatura_id = "";

        if (value) {
          // Si el docente asignado no pertenece al nuevo programa seleccionado, limpiarlo
          const docBelongs = docents.some(
            (d) => String(d.Cédula) === String(prev.docente_cedula) && String(d.programa_id) === String(value)
          );
          if (!docBelongs) {
            updated.docente_cedula = "";
          }

          // Filtrar estudiantes ya asignados para conservar únicamente los del nuevo programa
          const validStudentCedulas = new Set(
            students
              .filter((st) => String(st.programa_id) === String(value))
              .map((st) => String(st.Cédula || st.id_user_table))
          );
          const remainingStudents = (prev.estudiantes || []).filter((c) =>
            validStudentCedulas.has(String(c))
          );
          if (remainingStudents.length !== (prev.estudiantes || []).length) {
            toast.info("Se han actualizado los estudiantes asignados para coincidir con el programa seleccionado.");
          }
          updated.estudiantes = remainingStudents;
        } else {
          updated.docente_cedula = "";
          updated.estudiantes = [];
        }
      }

      // Si cambia la institución, limpiar el servicio
      if (name === "institucion_id") {
        updated.servicio_id = "";
      }

      // Sincronizar automáticamente el estado según el ciclo de vida por fechas
      if (name === "fecha_inicio" || name === "fecha_fin") {
        const newIni = name === "fecha_inicio" ? value : prev.fecha_inicio;
        const newFin = name === "fecha_fin" ? value : prev.fecha_fin;
        updated.estado = calculateLifecycleStatus(prev.estado, newIni, newFin);
      }
      return updated;
    });
  };

  const handleAddStudent = (cedula) => {
    const cedulaStr = String(cedula);
    if (!formData.estudiantes.includes(cedulaStr)) {
      if (formData.cupos && formData.estudiantes.length >= parseInt(formData.cupos, 10)) {
        toast.warning(`Has alcanzado el límite máximo de ${formData.cupos} cupos para esta práctica.`);
        return;
      }
      setFormData((prev) => ({
        ...prev,
        estudiantes: [...prev.estudiantes, cedulaStr],
      }));
    }
  };

  const handleRemoveStudent = (cedula) => {
    const cedulaStr = String(cedula);
    setFormData((prev) => ({
      ...prev,
      estudiantes: prev.estudiantes.filter((c) => String(c) !== cedulaStr),
    }));
  };

  // ─── Abrir Modal para Crear ───
  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setFormData(initialFormState);
    setStudentSearch("");
    setIsModalOpen(true);
  };

  // ─── Abrir Modal para Editar ───
  const handleOpenEditModal = (practice) => {
    if (practice.estado === "Finalizada" || practice.estado === "Cancelada") {
      toast.info(`La práctica está ${practice.estado.toLowerCase()} y su expediente está archivado en el Historial en modo solo lectura.`);
      return;
    }

    setIsEditing(true);
    const fIni = practice.fecha_inicio ? practice.fecha_inicio.substring(0, 10) : "";
    const fFin = practice.fecha_fin ? practice.fecha_fin.substring(0, 10) : "";
    const computedEstado = calculateLifecycleStatus(practice.estado || "Planificada", fIni, fFin);

    setFormData({
      id: practice.id,
      titulo: practice.titulo || "",
      programa_id: practice.programa_id ? String(practice.programa_id) : "",
      asignatura_id: practice.asignatura_id ? String(practice.asignatura_id) : "",
      institucion_id: practice.institucion_id ? String(practice.institucion_id) : "",
      servicio_id: practice.servicio_id ? String(practice.servicio_id) : "",
      docente_cedula: practice.docente_cedula ? String(practice.docente_cedula) : "",
      auditor_cedula: practice.auditor_cedula ? String(practice.auditor_cedula) : "",
      periodo: practice.periodo || "2024-1",
      fecha_inicio: fIni,
      fecha_fin: fFin,
      horas_totales: practice.horas_totales || 120,
      cupos: practice.cupos || 10,
      estado: computedEstado,
      motivo_cancelacion: practice.motivo_cancelacion || "",
      descripcion: practice.descripcion || "",
      horario: practice.horario || "",
      creado_por_rol: practice.creado_por_rol || "admin",
      creado_por_cedula: practice.creado_por_cedula || null,
      creador_nombre: practice.creador_nombre || "",
      docente_nombre: practice.docente_nombre || "",
      estudiantes: (practice.estudiantes || []).map((e) => String(e.cedula)),
    });
    setStudentSearch("");
    setIsModalOpen(true);
  };

  // ─── Cerrar Modal y Descartar Borrador ───
  const handleCloseModal = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setIsModalOpen(false);
    setIsEditing(false);
    setFormData(initialFormState);
  };

  // ─── Guardar Práctica (POST o PUT) ───
  const handleSubmitPractice = async (e) => {
    e.preventDefault();

    if (!formData.titulo.trim()) {
      toast.error("El título de la práctica es obligatorio.");
      return;
    }

    if (!formData.programa_id) {
      toast.error("Debes seleccionar un programa académico para la práctica.");
      return;
    }

    // Validar docente asignado si fue seleccionado
    if (formData.docente_cedula && formData.programa_id) {
      const doc = docents.find((d) => String(d.Cédula) === String(formData.docente_cedula));
      if (doc && String(doc.programa_id) !== String(formData.programa_id)) {
        toast.error("El docente asignado no pertenece al programa académico seleccionado.");
        return;
      }
    }

    // Validar estudiantes asignados si fueron seleccionados
    if (formData.estudiantes.length > 0 && formData.programa_id) {
      const invalidSt = students.filter(
        (st) =>
          formData.estudiantes.map(String).includes(String(st.Cédula || st.id_user_table)) &&
          String(st.programa_id) !== String(formData.programa_id)
      );
      if (invalidSt.length > 0) {
        toast.error("Uno o más estudiantes asignados no pertenecen al programa académico seleccionado.");
        return;
      }
    }

    // Sincronizar automáticamente el estado según fechas (Finalizada si llegó o pasó fecha_fin, Activa si llegó fecha_inicio, etc.)
    const finalEstado = calculateLifecycleStatus(formData.estado, formData.fecha_inicio, formData.fecha_fin);

    if (finalEstado === "Cancelada" && (!formData.motivo_cancelacion || !formData.motivo_cancelacion.trim())) {
      toast.error("Es obligatorio justificar y especificar el motivo por el cual se cancela la práctica formativa.");
      return;
    }
    const payload = { ...formData, estado: finalEstado };

    setIsSaving(true);
    try {
      const endpoint = isEditing
        ? `${API_BASE_URL}/api/admin/practices/${formData.id}`
        : `${API_BASE_URL}/api/admin/practices`;
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.message || "Error al guardar la práctica.");
      }

      toast.success(
        isEditing
          ? `Práctica "${formData.titulo}" actualizada con éxito.`
          : `Práctica "${formData.titulo}" creada con éxito.`
      );

      // Limpiar borrador al guardar exitosamente
      sessionStorage.removeItem(DRAFT_KEY);
      setIsModalOpen(false);
      setIsEditing(false);
      setFormData(initialFormState);

      await fetchAllData();
      notifyDataChanged("practice", isEditing ? "update" : "create");
    } catch (err) {
      console.error("Error al guardar práctica:", err);
      toast.error(err.message || "Error al guardar la práctica.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Eliminar Práctica ───
  const handleConfirmDeletePractice = async () => {
    if (!deletingPractice) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/practices/${deletingPractice.id}`, {
        method: "DELETE",
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || "Error al eliminar la práctica.");
      }

      toast.success(`Práctica "${deletingPractice.titulo}" eliminada correctamente.`);
      setDeletingPractice(null);
      await fetchAllData();
      notifyDataChanged("practice", "delete", { id: deletingPractice.id });
    } catch (err) {
      console.error("Error al eliminar práctica:", err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Filtrar Prácticas ───
  const filteredPractices = useMemo(() => {
    return practices.filter((p) => {
      // Si la práctica ya está cancelada, no se muestra aquí donde salen las demás (se consulta en Historial de Prácticas)
      if (p.estado === "Cancelada") return false;

      // Filtro por Estado
      if (filterEstado !== "Todos" && p.estado !== filterEstado) return false;
      // Filtro por Programa
      if (filterPrograma !== "Todos" && String(p.programa_id) !== String(filterPrograma)) return false;
      // Filtro por Institución
      if (filterInstitucion !== "Todas" && String(p.institucion_id) !== String(filterInstitucion)) return false;
      // Búsqueda en texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const titulo = (p.titulo || "").toLowerCase();
        const inst = (p.institucion_nombre || "").toLowerCase();
        const serv = (p.servicio_nombre || "").toLowerCase();
        const doc = (p.docente_nombre || "").toLowerCase();
        const aud = (p.auditor_nombre || "").toLowerCase();
        const prog = (p.programa_nombre || "").toLowerCase();
        const asig = (p.asignatura_nombre || "").toLowerCase();
        const estMatch = (p.estudiantes || []).some((e) =>
          (e.nombre_completo || "").toLowerCase().includes(query) ||
          String(e.cedula || "").includes(query)
        );

        return (
          titulo.includes(query) ||
          inst.includes(query) ||
          serv.includes(query) ||
          doc.includes(query) ||
          aud.includes(query) ||
          prog.includes(query) ||
          asig.includes(query) ||
          estMatch
        );
      }
      return true;
    });
  }, [practices, filterEstado, filterPrograma, filterInstitucion, searchTerm]);

  const getBadgeStyle = (estado) => {
    const found = ESTADOS_PRACTICA.find((e) => e.value === estado);
    return found ? found.color : "bg-gray-100 text-gray-800 border-gray-300";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">

      {/* ─── ENCABEZADO ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-3 bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 rounded-xl flex items-center justify-center">
              <Building2 className="w-8 h-8" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                Gestión y Creación de Prácticas
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Parametriza escenarios clínicos, asocia programas, asignaturas, entidades de salud, servicios, docentes, auditores y estudiantes.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all transform active:scale-95"
        >
          <span className="text-xl leading-none">+</span>
          <span>Nueva Práctica Formativa</span>
        </button>
      </div>

      {/* ─── FILTROS Y CONTROLES ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            BUSCAR PRÁCTICA / ASOCIACIÓN
          </label>
          <input
            type="text"
            placeholder="Título, hospital, docente, estudiante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            ESTADO DE LA PRÁCTICA
          </label>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          >
            <option value="Todos">
              Todos los Estados ({practices.filter((p) => p.estado !== "Cancelada").length})
            </option>
            {ESTADOS_PRACTICA.filter((est) => est.value !== "Cancelada").map((est) => (
              <option key={est.value} value={est.value}>
                {est.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            PROGRAMA ACADÉMICO
          </label>
          <select
            value={filterPrograma}
            onChange={(e) => setFilterPrograma(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          >
            <option value="Todos">Todos los Programas</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombreprograma}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            INSTITUCIÓN / HOSPITAL
          </label>
          <select
            value={filterInstitucion}
            onChange={(e) => setFilterInstitucion(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          >
            <option value="Todas">Todas las Instituciones</option>
            {instituciones.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombreinstitucion}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── LISTADO DE PRÁCTICAS ─── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Cargando catálogo de prácticas formativas...</p>
        </div>
      ) : filteredPractices.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800">
          <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">No se encontraron prácticas formativas</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-md mx-auto">
            {searchTerm || filterEstado !== "Todos" || filterPrograma !== "Todos" || filterInstitucion !== "Todas"
              ? "Prueba cambiando los filtros de búsqueda seleccionados."
              : "Aún no se han creado prácticas en el sistema. Haz clic en '+ Nueva Práctica Formativa' para configurar la primera."}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition"
          >
            + Crear Primera Práctica
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPractices.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition duration-200"
            >
              <div>
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getBadgeStyle(
                      p.estado
                    )}`}
                  >
                    ● {p.estado}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 rounded-md">
                    Periodo {p.periodo || "2024-1"}
                  </span>
                </div>

                {/* Título de la práctica */}
                <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-1">
                  {p.titulo}
                </h3>

                {/* Creador de la práctica - Ubicado INMEDIATAMENTE junto al nombre de la práctica */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Creada por:
                  </span>
                  {p.creado_por_rol === "docent" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shadow-sm">
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        Docente:
                      </span>
                      <span className="underline decoration-purple-400 underline-offset-2">
                        {p.creador_nombre || p.docente_nombre || "Docente"}
                      </span>
                      {p.creado_por_cedula && (
                        <span className="opacity-75 font-normal text-[11px]">(C.C. {p.creado_por_cedula})</span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 shadow-sm">
                      <span className="inline-flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        Administrador:
                      </span>
                      <span className="underline decoration-indigo-400 underline-offset-2">
                        {p.creador_nombre || "Administrador UPTC"}
                      </span>
                    </span>
                  )}
                </div>

                {p.descripcion && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                    {p.descripcion}
                  </p>
                )}

                {p.horario && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 mb-4">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{p.horario}</span>
                  </p>
                )}

                {/* Detalles relacionales asociados */}
                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 mb-6 bg-gray-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">
                      <strong>Creada por:</strong>{" "}
                      {p.creado_por_rol === "docent"
                        ? `Docente ${p.creador_nombre || p.docente_nombre || "Docente"}`
                        : `Administrador (${p.creador_nombre || "UPTC"})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">
                      <strong>Entidad:</strong> {p.institucion_nombre || "Sin asignar"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">
                      <strong>Servicio:</strong> {p.servicio_nombre || "Sin asignar"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">
                      <strong>Programa:</strong> {p.programa_nombre || "General"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Book className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">
                      <strong>Asignatura:</strong> {p.asignatura_nombre || "Sin asignar"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">
                      <strong>Docente:</strong> {p.docente_nombre?.trim() || "Sin docente"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate">
                      <strong>Auditor:</strong> {p.auditor_nombre?.trim() || "Sin auditor"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer de la tarjeta */}
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-zinc-800 pt-3 mb-4">
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span><strong>{p.total_estudiantes}</strong> / {p.cupos || 10} cupos</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <span>{p.horas_totales || 120}h certificadas</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setViewingPractice(p)}
                    className="py-2 px-3 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded-lg transition text-center"
                  >
                    Ver Ficha
                  </button>
                  {p.estado === "Finalizada" || p.estado === "Cancelada" ? (
                    <span
                      title="Práctica archivada en Historial - Inmutable"
                      className="py-2 px-3 text-xs font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 rounded-lg text-center flex items-center justify-center cursor-not-allowed"
                    >
                      Archivada
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpenEditModal(p)}
                      className="py-2 px-3 text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg transition text-center"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() => setDeletingPractice(p)}
                    className="py-2 px-3 text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg transition text-center"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL DE CREACIÓN / EDICIÓN COMPLETA ─── */}
      {isModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 rounded-3xl shadow-2xl border border-gray-200 dark:border-zinc-800 my-8 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-indigo-750 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileEdit className="w-6 h-6 text-white shrink-0" />
                <div>
                  <h3 className="text-xl font-bold">
                    {isEditing ? "Editar Práctica Formativa" : "Crear Nueva Práctica Formativa"}
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Asocia todos los requerimientos académicos, asistenciales y estudiantes.
                  </p>
                  {isEditing && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/20 text-white text-[11px] font-semibold">
                      <span>Creada por:</span>
                      <strong>
                        {formData.creado_por_rol === "docent" ? (
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            Docente: {formData.creador_nombre || formData.docente_nombre || "Docente"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Administrador ({formData.creador_nombre || "UPTC"})
                          </span>
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            <form onSubmit={handleSubmitPractice} className="p-6 overflow-y-auto space-y-6 flex-grow bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
              {/* 1. Datos Principales */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <span>1.</span> Datos Generales de la Práctica
                </h4>

                {/* Banner informativo de Fecha del Sistema / Hoy */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl mb-4 shadow-sm">
                  <div className="flex items-center gap-2.5 text-blue-950 dark:text-blue-200">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Fecha Actual del Sistema
                      </div>
                      <div className="text-sm font-bold">
                        {todayFormattedText}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-zinc-700 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Hoy: {todayShortText}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Título / Nombre de la Práctica *
                    </label>
                    <input
                      type="text"
                      name="titulo"
                      required
                      placeholder="Ej: Rotación en Pediatría y Urgencias Infantiles"
                      value={formData.titulo}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Periodo Académico
                    </label>
                    <input
                      type="text"
                      name="periodo"
                      placeholder="Ej: 2024-1"
                      value={formData.periodo}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Estado
                    </label>
                    <select
                      name="estado"
                      value={formData.estado}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    >
                      {ESTADOS_PRACTICA.map((e) => (
                        <option key={e.value} value={e.value} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.estado === "Cancelada" && (
                    <div className="md:col-span-2 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-1.5">
                      <label className="block text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span>Justificación / Motivo de Cancelación * (Obligatorio)</span>
                      </label>
                      <textarea
                        name="motivo_cancelacion"
                        required
                        rows="2"
                        placeholder="Escribe la justificación institucional detallada por la cual se cancela esta práctica formativa..."
                        value={formData.motivo_cancelacion || ""}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-rose-300 dark:border-rose-800 rounded-xl bg-white dark:bg-zinc-800 text-rose-950 dark:text-rose-100 placeholder-rose-400 focus:ring-2 focus:ring-rose-500 outline-none shadow-sm"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                      <span>Fecha de Inicio *</span>
                      <span className="text-[11px] font-normal text-blue-600 dark:text-blue-400">
                        (Hoy: {todayShortText})
                      </span>
                    </label>
                    <input
                      type="date"
                      name="fecha_inicio"
                      value={formData.fecha_inicio}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha de Finalización
                    </label>
                    <input
                      type="date"
                      name="fecha_fin"
                      value={formData.fecha_fin}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  {/* Alerta contextual cuando Estado es Planificada */}
                  {formData.estado === "Planificada" && (
                    <div className="md:col-span-2">
                      <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 flex items-start gap-3 text-xs leading-relaxed">
                        <Clock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-blue-800 dark:text-blue-300 font-bold mb-0.5">
                            Práctica en Estado Planificada
                          </strong>
                          La práctica comenzará próximamente ({formData.fecha_inicio ? formatReadableDate(formData.fecha_inicio) : "fecha por definir"}). Al llegar la fecha de inicio pasará automáticamente a <strong>"Activa"</strong>.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alerta contextual cuando Estado es Finalizada */}
                  {formData.estado === "Finalizada" && (
                    <div className="md:col-span-2">
                      <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/70 bg-purple-50/80 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 flex items-start gap-3 text-xs leading-relaxed">
                        <Flag className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-purple-800 dark:text-purple-300 font-bold mb-0.5">
                            Práctica en Estado Finalizada
                          </strong>
                          La fecha final de esta rotación ({formData.fecha_fin ? formatReadableDate(formData.fecha_fin) : "alcanzada"}) ha llegado o ha sido superada. La práctica quedará registrada como <strong>"Finalizada"</strong> en el sistema institucional, habilitando la expedición de certificados oficiales.
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Horas Formativas Totales
                    </label>
                    <input
                      type="number"
                      name="horas_totales"
                      min="1"
                      value={formData.horas_totales}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Cupos Máximos
                    </label>
                    <input
                      type="number"
                      name="cupos"
                      min="1"
                      value={formData.cupos}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Descripción / Objetivos Formativos
                    </label>
                    <textarea
                      name="descripcion"
                      rows="2"
                      placeholder="Breve descripción de las competencias, rotaciones o alcances de la práctica..."
                      value={formData.descripcion}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  {/* Horario de la Práctica */}
                  <div className="md:col-span-2 p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5 uppercase tracking-wide">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Horario de la Práctica (Días de la semana y horas)
                      </label>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Visible para el administrador y los participantes vinculados
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        Seleccionar días frecuentes:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((dia) => {
                          const isIncluded = (formData.horario || "").includes(dia);
                          return (
                            <button
                              key={dia}
                              type="button"
                              onClick={() => {
                                const current = formData.horario || "";
                                let next;
                                if (current.includes(dia)) {
                                  next = current.replace(new RegExp(`${dia}(,?\\s*)?`, "gi"), "").trim().replace(/,\s*$/, "");
                                } else {
                                  next = current ? `${current}, ${dia}` : dia;
                                }
                                setFormData((prev) => ({ ...prev, horario: next }));
                              }}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition border ${
                                isIncluded
                                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                  : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-blue-400"
                              }`}
                            >
                              {dia}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        name="horario"
                        placeholder="Ej: Lunes, Martes y Miércoles de 07:00 a 13:00 (Turno Mañana)"
                        value={formData.horario || ""}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-medium"
                      />
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Especifica qué días y en qué horas se llevará a cabo la práctica. Todos los implicados podrán consultarlo en el detalle de la práctica.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Área Académica (Programa y Asignatura en Cascada) */}
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-800">
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <span>2.</span> Área Académica Vinculada
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Programa Académico
                    </label>
                    <select
                      name="programa_id"
                      value={formData.programa_id}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">-- Seleccionar Programa --</option>
                      {programas.map((p) => (
                        <option key={p.id} value={p.id} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {p.nombreprograma}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Asignatura (Filtrada por programa)
                    </label>
                    <select
                      name="asignatura_id"
                      value={formData.asignatura_id}
                      onChange={handleInputChange}
                      disabled={!formData.programa_id}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-zinc-800/60"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                        {!formData.programa_id
                          ? "-- Primero elige un programa --"
                          : "-- Seleccionar Asignatura --"}
                      </option>
                      {availableAsignaturas.map((a) => (
                        <option key={a.id_asignatura_table || a.id} value={a.id_asignatura_table || a.id} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {a.Nombre} {a.Codigo ? `(${a.Codigo})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Escenario Asistencial (Institución y Servicio en Cascada) */}
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-800">
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <span>3.</span> Escenario de Práctica Asistencial
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Institución / Entidad de Salud (Hospital o Clínica)
                    </label>
                    <select
                      name="institucion_id"
                      value={formData.institucion_id}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">-- Seleccionar Institución --</option>
                      {instituciones.map((i) => (
                        <option key={i.id} value={i.id} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {i.nombreinstitucion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Servicio Hospitalario (Filtrado por institución)
                    </label>
                    <select
                      name="servicio_id"
                      value={formData.servicio_id}
                      onChange={handleInputChange}
                      disabled={!formData.institucion_id}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-zinc-800/60"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                        {!formData.institucion_id
                          ? "-- Primero elige una institución --"
                          : "-- Seleccionar Servicio --"}
                      </option>
                      {availableServicios.map((s) => (
                        <option key={s.id_servicio_table || s.id} value={s.id_servicio_table || s.id} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {s.Nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Responsables Asignados */}
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-800">
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <span>4.</span> Docente y Auditor Responsables
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                      <span>Docente Asistencial / Tutor *</span>
                      {selectedProgramName && (
                        <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          (Filtrado: {selectedProgramName})
                        </span>
                      )}
                    </label>
                    <select
                      name="docente_cedula"
                      value={formData.docente_cedula}
                      onChange={handleInputChange}
                      disabled={!formData.programa_id}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-zinc-800/60"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                        {!formData.programa_id
                          ? "-- Primero elige un programa académico --"
                          : availableDocents.length === 0
                          ? `-- No hay docentes registrados en ${selectedProgramName} --`
                          : "-- Seleccionar Docente --"}
                      </option>
                      {availableDocents.map((d) => (
                        <option key={d.Cédula || d.id_user_table} value={d.Cédula} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {d.Nombre} {d.Apellidos} ({d.Cédula}) - {d.Carrera || selectedProgramName || "UPTC"}
                        </option>
                      ))}
                    </select>
                    {!formData.programa_id && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Selecciona el programa en el paso 2 para habilitar los docentes correspondientes.</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Auditor de Salud
                    </label>
                    <select
                      name="auditor_cedula"
                      value={formData.auditor_cedula}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">-- Seleccionar Auditor --</option>
                      {availableAuditors.map((au) => (
                        <option key={au.Cédula || au.id_user_table} value={au.Cédula} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {au.Nombre} {au.Apellidos} ({au.Cédula})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 5. Asignación de Estudiantes (Multiselección) */}
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <span>5.</span> Estudiantes Asignados ({formData.estudiantes.length} / {formData.cupos || 10})
                    </h4>
                    {selectedProgramName && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Listando exclusivamente estudiantes del programa de <strong>{selectedProgramName}</strong>.
                      </p>
                    )}
                  </div>
                  {formData.estudiantes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, estudiantes: [] }))}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      Quitar todos
                    </button>
                  )}
                </div>

                {/* Chips de Estudiantes Seleccionados */}
                {selectedStudentsDetails.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl max-h-36 overflow-y-auto">
                    {selectedStudentsDetails.map((st) => (
                      <span
                        key={st.Cédula || st.id_user_table}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-200 text-xs font-semibold rounded-lg shadow-sm border border-blue-200 dark:border-zinc-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{st.Nombre} {st.Apellidos} ({st.Cédula})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(st.Cédula || st.id_user_table)}
                          className="text-rose-500 hover:text-rose-700 font-bold ml-1 inline-flex items-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-3">
                    No hay estudiantes vinculados a esta práctica todavía. Selecciona abajo los estudiantes que deseas asociar.
                  </p>
                )}

                {/* Si no se ha elegido programa, mostrar advertencia amigable */}
                {!formData.programa_id ? (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>
                      Debes seleccionar primero un <strong>Programa Académico</strong> en la sección 2 para ver y asignar a los estudiantes de dicha carrera.
                    </span>
                  </div>
                ) : (
                  /* Buscador y selector para añadir estudiantes filtrados por programa */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Estudiantes de <strong className="text-blue-600 dark:text-blue-400">{selectedProgramName}</strong>:
                      </span>
                      <span>
                        {selectableStudents.length} disponible(s) para asociar
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder={`Buscar estudiante de ${selectedProgramName} por nombre o cédula...`}
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                    />

                    {/* Lista de estudiantes disponibles */}
                    <div className="border border-gray-200 dark:border-zinc-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800 bg-gray-50 dark:bg-zinc-800/40">
                      {selectableStudents.length === 0 ? (
                        <p className="text-xs text-gray-400 p-3 text-center">
                          {studentSearch.trim()
                            ? "No hay más estudiantes que coincidan con la búsqueda."
                            : totalStudentsInProgram === 0
                            ? `No hay estudiantes registrados en el programa de ${selectedProgramName}.`
                            : `Todos los estudiantes (${totalStudentsInProgram}) de ${selectedProgramName} ya han sido asignados.`}
                        </p>
                      ) : (
                        selectableStudents.slice(0, 15).map((st) => (
                          <div
                            key={st.Cédula || st.id_user_table}
                            className="flex items-center justify-between p-2.5 hover:bg-blue-50 dark:hover:bg-zinc-700/50 transition"
                          >
                            <div className="text-xs">
                              <span className="font-bold text-gray-900 dark:text-white">
                                {st.Nombre} {st.Apellidos}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 ml-2">
                                C.C. {st.Cédula} · {st.Carrera || selectedProgramName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddStudent(st.Cédula || st.id_user_table)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md transition"
                            >
                              + Asignar
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50"
                >
                  {isSaving ? "Guardando..." : isEditing ? "Actualizar Práctica" : "Crear Práctica"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL DE FICHA DETALLADA ─── */}
      {viewingPractice && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 rounded-3xl shadow-2xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getBadgeStyle(viewingPractice.estado)}`}>
                  ● {viewingPractice.estado}
                </span>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                  {viewingPractice.titulo}
                </h3>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Creada por:
                  </span>
                  {viewingPractice.creado_por_rol === "docent" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Docente: {viewingPractice.creador_nombre || viewingPractice.docente_nombre || "Docente"}</span>
                      {viewingPractice.creado_por_cedula && ` (C.C. ${viewingPractice.creado_por_cedula})`}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Administrador: {viewingPractice.creador_nombre || "Administrador UPTC"}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Periodo Académico: {viewingPractice.periodo || "2024-1"}
                </p>
              </div>
              <button
                onClick={() => setViewingPractice(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
              {viewingPractice.descripcion && (
                <div className="p-3.5 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                  <strong className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
                    Descripción
                  </strong>
                  <p>{viewingPractice.descripcion}</p>
                </div>
              )}

              {viewingPractice.horario && (
                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <strong className="text-xs text-blue-800 dark:text-blue-300 uppercase font-black tracking-wide">
                      Horario Oficial de la Práctica (Días y Horas)
                    </strong>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 whitespace-pre-line leading-relaxed">
                    {viewingPractice.horario}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                  <strong className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
                    Escenario Asistencial
                  </strong>
                  <p><strong>Entidad:</strong> {viewingPractice.institucion_nombre || "N/A"}</p>
                  <p><strong>Servicio:</strong> {viewingPractice.servicio_nombre || "N/A"}</p>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                  <strong className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
                    Área Académica
                  </strong>
                  <p><strong>Programa:</strong> {viewingPractice.programa_nombre || "N/A"}</p>
                  <p><strong>Asignatura:</strong> {viewingPractice.asignatura_nombre || "N/A"}</p>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                  <strong className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
                    Docente Asistencial
                  </strong>
                  <p className="font-semibold text-gray-900 dark:text-white">{viewingPractice.docente_nombre || "Sin asignar"}</p>
                  <p className="text-xs text-gray-500">{viewingPractice.docente_correo || `Cédula: ${viewingPractice.docente_cedula || "N/A"}`}</p>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                  <strong className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
                    Auditor de Salud
                  </strong>
                  <p className="font-semibold text-gray-900 dark:text-white">{viewingPractice.auditor_nombre || "Sin asignar"}</p>
                  <p className="text-xs text-gray-500">{viewingPractice.auditor_correo || `Cédula: ${viewingPractice.auditor_cedula || "N/A"}`}</p>
                </div>

                {/* Origen y Creador de la Práctica */}
                <div className="p-3.5 bg-gray-50 dark:bg-zinc-800 rounded-xl sm:col-span-2">
                  <strong className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">
                    Origen / Creado por
                  </strong>
                  {viewingPractice.creado_por_rol === "docent" ? (
                    <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300 font-semibold">
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span>
                        Registrada por Docente: {viewingPractice.creador_nombre || viewingPractice.docente_nombre || "Docente"}
                        {viewingPractice.creado_por_cedula && ` (C.C. ${viewingPractice.creado_por_cedula})`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300 font-semibold">
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>
                        Registrada por Administrador: {viewingPractice.creador_nombre || "Administrador UPTC"}
                        {viewingPractice.creado_por_cedula && ` (C.C. ${viewingPractice.creado_por_cedula})`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Estudiantes */}
              <div className="mt-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-white mb-3">
                  Estudiantes Inscritos ({viewingPractice.total_estudiantes} / {viewingPractice.cupos || 10})
                </h4>
                {viewingPractice.estudiantes && viewingPractice.estudiantes.length > 0 ? (
                  <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-xs">
                      <thead className="bg-gray-100 dark:bg-zinc-800">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-bold text-gray-600 dark:text-gray-300">Cédula</th>
                          <th className="px-4 py-2.5 text-left font-bold text-gray-600 dark:text-gray-300">Estudiante</th>
                          <th className="px-4 py-2.5 text-left font-bold text-gray-600 dark:text-gray-300">Correo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {viewingPractice.estudiantes.map((st) => (
                          <tr key={st.cedula} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                            <td className="px-4 py-2.5 font-mono text-gray-500">{st.cedula}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{st.nombre_completo}</td>
                            <td className="px-4 py-2.5 text-gray-500">{st.correo || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                    No hay estudiantes inscritos en esta práctica aún.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setViewingPractice(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white font-semibold rounded-xl text-sm transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ─── */}
      {deletingPractice && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-zinc-800 text-center">
            <Trash2 className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
              ¿Eliminar Práctica Formativa?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 font-semibold">
              "{deletingPractice.titulo}"
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Esta acción desvinculará a los {deletingPractice.total_estudiantes} estudiantes asignados y eliminará el registro de la base de datos.
            </p>

            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setDeletingPractice(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeletePractice}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-md transition disabled:opacity-50"
              >
                {isDeleting ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminPractices;
