// ============================================================
// src/components/Docent/DocentPractices.js
// Gestión de Prácticas Reales y Observaciones para Docentes — UPTC
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  Building2,
  UserCheck,
  Users,
  GraduationCap,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Hospital,
  ChevronRight,
  MessageSquarePlus,
  Trash2,
  Send,
  Sparkles,
  Info,
  ShieldCheck,
  Mail,
  User,
  Plus,
  X,
  Search,
  Check,
  Edit3,
  Award,
  FileText,
  Lock,
  Flag,
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { useAuth } from "../../utils/useAuth";
import { notifyDataChanged, useDataSync } from "../../utils/dataSync";
import { toast } from "react-toastify";
import StudentAvatar from "../Shared/StudentAvatar";
import StudentFichaModal from "../Shared/StudentFichaModal";

const API_BASE_URL = BACKEND_URL;

// Configuración de tipos de observaciones
const TIPO_OBSERVACION_CONFIG = {
  General: {
    label: "General",
    badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    dot: "bg-blue-500",
    desc: "Avisos, directrices y pautas para toda la rotación",
  },
  Desempeño: {
    label: "Desempeño",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-emerald-500",
    desc: "Evaluación cualitativa, destrezas clínicas y competencias",
  },
  Asistencia: {
    label: "Asistencia",
    badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
    desc: "Puntualidad, turnos asistenciales y cumplimiento horario",
  },
  Recomendación: {
    label: "Recomendación",
    badge: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    dot: "bg-purple-500",
    desc: "Sugerencias de estudio, preparación y mejora continua",
  },
};

const ESTADOS_PRACTICA_DOCENTE = [
  { value: "Activa", label: "Activa" },
  { value: "Planificada", label: "Planificada" },
  { value: "En Curso", label: "En Curso" },
  { value: "Finalizada", label: "Finalizada" },
  { value: "Cancelada", label: "Cancelada" },
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


const getDocentPracticeStateBadge = (estado) => {
  const est = (estado || "Activa").toLowerCase();
  if (est === "activa") {
    return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
  }
  if (est === "planificada") {
    return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
  }
  if (est === "en curso") {
    return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
  if (est === "finalizada") {
    return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
  }
  if (est === "cancelada") {
    return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
  }
  return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700";
};

const DocentPractices = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [practices, setPractices] = useState([]);
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fichaStudent, setFichaStudent] = useState(null);

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

  // Formulario para nueva observación
  const [targetStudentCedula, setTargetStudentCedula] = useState("all"); // "all" o cédula específica
  const [obsTipo, setObsTipo] = useState("General");
  const [obsTitulo, setObsTitulo] = useState("");
  const [obsTexto, setObsTexto] = useState("");
  const [isSubmittingObs, setIsSubmittingObs] = useState(false);
  const [obsSuccessMsg, setObsSuccessMsg] = useState("");
  const [obsErrorMsg, setObsErrorMsg] = useState("");

  // ─── Estado para creación de nueva práctica formativa ───
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [catalogs, setCatalogs] = useState({
    programas: [],
    asignaturas: [],
    instituciones: [],
    servicios: [],
    estudiantes: [],
    auditores: [],
    docent_programa_id: null,
    docent_programa_nombre: null,
  });
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);

  // Bloquear el scroll de fondo mientras el modal esté abierto
  useEffect(() => {
    if (isCreateModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isCreateModalOpen]);

  const initialPracticeForm = {
    titulo: "",
    descripcion: "",
    programa_id: "",
    asignatura_id: "",
    institucion_id: "",
    servicio_id: "",
    periodo: "2024-1",
    fecha_inicio: "",
    fecha_fin: "",
    horas_totales: 120,
    cupos: 10,
    estado: "Planificada",
    auditor_cedula: "",
    estudiantes: [],
  };
  const [practiceFormData, setPracticeFormData] = useState(initialPracticeForm);
  const [isEditingPractice, setIsEditingPractice] = useState(false);
  const [editingPracticeId, setEditingPracticeId] = useState(null);
  const [isSubmittingPractice, setIsSubmittingPractice] = useState(false);
  const [practiceFormError, setPracticeFormError] = useState("");
  const [practiceFormSuccess, setPracticeFormSuccess] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");

  // Obtener la cédula del docente de forma segura
  const getDocentCedula = useCallback(() => {
    if (user?.cedula) return user.cedula;
    if (user?.id) return user.id;
    try {
      const stored = sessionStorage.getItem("userData") || localStorage.getItem("userData");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.cedula || parsed.Cédula || parsed.id || null;
      }
    } catch (e) {
      console.warn("No se pudo leer la cédula docente:", e);
    }
    return null;
  }, [user]);

  // Formatear fechas en español
  const formatDate = (dateStr) => {
    if (!dateStr) return "Por definir";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.substring(0, 10);
      return d.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateStr.substring(0, 10);
    }
  };

  // Cargar las prácticas reales del docente
  const fetchDocentPracticesData = useCallback(async () => {
    const docentCedula = getDocentCedula();

    if (!docentCedula) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE_URL}/api/docent/practices/${docentCedula}`, { headers });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: No se pudieron obtener las prácticas.`);
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setPractices(list);

      // Mantener la práctica seleccionada activa o seleccionar la primera por defecto
      if (list.length > 0) {
        setSelectedPractice((prev) => {
          if (!prev) return list[0];
          const found = list.find((p) => p.id === prev.id);
          return found || list[0];
        });
      } else {
        setSelectedPractice(null);
      }
    } catch (err) {
      console.error("Error al cargar prácticas del docente:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  }, [getDocentCedula]);

  useEffect(() => {
    fetchDocentPracticesData();
  }, [fetchDocentPracticesData]);

  // Sincronización reactiva con cambios de otras pestañas o admin
  useDataSync(fetchDocentPracticesData);

  // Manejar el envío de una nueva observación
  const handleCreateObservation = async (e) => {
    e.preventDefault();
    if (!selectedPractice) return;
    if (!obsTexto.trim()) {
      setObsErrorMsg("Por favor, ingresa el contenido de la observación.");
      return;
    }

    const docentCedula = getDocentCedula();
    setIsSubmittingObs(true);
    setObsErrorMsg("");
    setObsSuccessMsg("");

    try {
      const payload = {
        docente_cedula: docentCedula,
        estudiante_cedula: targetStudentCedula === "all" ? null : targetStudentCedula,
        titulo: obsTitulo.trim() || null,
        observacion: obsTexto.trim(),
        tipo: obsTipo,
      };

      const res = await fetch(
        `${API_BASE_URL}/api/docent/practices/${selectedPractice.id}/observations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "No se pudo guardar la observación.");
      }

      setObsSuccessMsg("Observación publicada con éxito. Los estudiantes ya pueden verla.");
      setObsTitulo("");
      setObsTexto("");
      setObsTipo("General");
      setTargetStudentCedula("all");

      // Actualizar el estado local y notificar globalmente
      await fetchDocentPracticesData();
      notifyDataChanged("observations", "create", { practiceId: selectedPractice.id });

      setTimeout(() => setObsSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error guardando observación:", err);
      setObsErrorMsg(err.message || "Ocurrió un error al guardar la observación.");
    } finally {
      setIsSubmittingObs(false);
    }
  };

  // Eliminar una observación
  const handleDeleteObservation = async (obsId) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta observación? Ya no será visible para los estudiantes.")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/docent/observations/${obsId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "No se pudo eliminar la observación.");
      }

      await fetchDocentPracticesData();
      notifyDataChanged("observations", "delete", { observationId: obsId });
    } catch (err) {
      toast.error(err.message || "Error al eliminar la observación.");
    }
  };

  // ─── Métodos para Creación de Prácticas ───
  const fetchCatalogs = useCallback(async () => {
    try {
      setIsLoadingCatalogs(true);
      const docentCedula = getDocentCedula();
      const url = docentCedula
        ? `${API_BASE_URL}/api/docent/catalogs?docente_cedula=${encodeURIComponent(docentCedula)}`
        : `${API_BASE_URL}/api/docent/catalogs`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const loadedProgId = data.docent_programa_id ? String(data.docent_programa_id) : null;
        const loadedProgNombre = data.docent_programa_nombre || null;

        setCatalogs({
          programas: Array.isArray(data.programas) ? data.programas : [],
          asignaturas: Array.isArray(data.asignaturas) ? data.asignaturas : [],
          instituciones: Array.isArray(data.instituciones) ? data.instituciones : [],
          servicios: Array.isArray(data.servicios) ? data.servicios : [],
          estudiantes: Array.isArray(data.estudiantes) ? data.estudiantes : [],
          auditores: Array.isArray(data.auditores) ? data.auditores : [],
          docent_programa_id: loadedProgId,
          docent_programa_nombre: loadedProgNombre,
        });

        // Si el docente pertenece a un programa académico, asignarlo automáticamente
        if (loadedProgId) {
          setPracticeFormData((prev) => ({
            ...prev,
            programa_id: prev.programa_id || loadedProgId,
          }));
        }
      }
    } catch (err) {
      console.error("Error al cargar catálogos:", err);
    } finally {
      setIsLoadingCatalogs(false);
    }
  }, [getDocentCedula]);

  const handleOpenCreateModal = () => {
    setIsEditingPractice(false);
    setEditingPracticeId(null);
    setPracticeFormData({
      ...initialPracticeForm,
      programa_id: catalogs.docent_programa_id ? String(catalogs.docent_programa_id) : "",
    });
    setPracticeFormError("");
    setPracticeFormSuccess("");
    setStudentSearchTerm("");
    setIsCreateModalOpen(true);
    fetchCatalogs();
  };

  const handleOpenEditModal = (practice) => {
    setIsEditingPractice(true);
    setEditingPracticeId(practice.id);
    setPracticeFormError("");
    setPracticeFormSuccess("");
    setStudentSearchTerm("");

    const fIni = practice.fecha_inicio ? practice.fecha_inicio.substring(0, 10) : "";
    const fFin = practice.fecha_fin ? practice.fecha_fin.substring(0, 10) : "";
    const computedEstado = calculateLifecycleStatus(practice.estado || "Planificada", fIni, fFin);

    setPracticeFormData({
      titulo: practice.titulo || "",
      descripcion: practice.descripcion || "",
      programa_id: practice.programa_id
        ? String(practice.programa_id)
        : (catalogs.docent_programa_id ? String(catalogs.docent_programa_id) : ""),
      asignatura_id: practice.asignatura_id ? String(practice.asignatura_id) : "",
      institucion_id: practice.institucion_id ? String(practice.institucion_id) : "",
      servicio_id: practice.servicio_id ? String(practice.servicio_id) : "",
      periodo: practice.periodo || "2024-1",
      fecha_inicio: fIni,
      fecha_fin: fFin,
      horas_totales: practice.horas_totales || 120,
      cupos: practice.cupos || 10,
      estado: computedEstado,
      auditor_cedula: practice.auditor_cedula ? String(practice.auditor_cedula) : "",
      estudiantes: (practice.estudiantes || []).map((e) => String(e.cedula || e.Cédula || e)),
    });

    setIsCreateModalOpen(true);
    fetchCatalogs();
  };

  const handlePracticeInputChange = (e) => {
    const { name, value } = e.target;
    setPracticeFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "programa_id") {
        next.asignatura_id = "";
      }
      if (name === "institucion_id") {
        next.servicio_id = "";
        next.auditor_cedula = "";
      }
      // Sincronizar automáticamente el estado según el ciclo de vida por fechas
      if (name === "fecha_inicio" || name === "fecha_fin") {
        const newIni = name === "fecha_inicio" ? value : prev.fecha_inicio;
        const newFin = name === "fecha_fin" ? value : prev.fecha_fin;
        next.estado = calculateLifecycleStatus(prev.estado, newIni, newFin);
      }
      return next;
    });
  };

  const handleToggleStudentSelection = (cedula) => {
    const cedStr = String(cedula);
    setPracticeFormData((prev) => {
      const current = prev.estudiantes.map(String);
      if (current.includes(cedStr)) {
        return { ...prev, estudiantes: current.filter((c) => c !== cedStr) };
      } else {
        const limit = Number(prev.cupos) || 10;
        if (current.length >= limit) {
          toast.warn(`Has alcanzado el límite de ${limit} cupos configurados para esta práctica.`);
          return prev;
        }
        return { ...prev, estudiantes: [...current, cedStr] };
      }
    });
  };

  const handleRemoveStudentSelection = (cedula) => {
    const cedStr = String(cedula);
    setPracticeFormData((prev) => ({
      ...prev,
      estudiantes: prev.estudiantes.map(String).filter((c) => c !== cedStr),
    }));
  };

  const handleCreateOrUpdatePracticeSubmit = async (e) => {
    e.preventDefault();
    setPracticeFormError("");
    setPracticeFormSuccess("");

    if (!practiceFormData.titulo.trim()) {
      setPracticeFormError("El título de la práctica es obligatorio.");
      return;
    }
    const docentCedula = getDocentCedula();
    if (!docentCedula) {
      setPracticeFormError("No se pudo identificar la cédula del docente actual.");
      return;
    }

    setIsSubmittingPractice(true);
    try {
      // Sincronizar automáticamente el estado según fechas (Finalizada si llegó o pasó fecha_fin, Activa si llegó fecha_inicio, etc.)
      const finalEstado = calculateLifecycleStatus(
        practiceFormData.estado,
        practiceFormData.fecha_inicio,
        practiceFormData.fecha_fin
      );

      const payload = {
        ...practiceFormData,
        estado: finalEstado,
        docente_cedula: docentCedula,
        horas_totales: Number(practiceFormData.horas_totales) || 120,
        cupos: Number(practiceFormData.cupos) || 10,
      };

      const endpoint = isEditingPractice
        ? `${API_BASE_URL}/api/docent/practices/${editingPracticeId}`
        : `${API_BASE_URL}/api/docent/practices`;
      const method = isEditingPractice ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Error al ${isEditingPractice ? "actualizar" : "crear"} la práctica formativa.`);
      }

      let successNotice = `¡Práctica ${isEditingPractice ? "actualizada" : "creada"} exitosamente! Sincronizando...`;
      if (finalEstado === "Finalizada") {
        successNotice = `¡Práctica ${isEditingPractice ? "actualizada" : "creada"} como Finalizada (fecha final alcanzada)!`;
      } else if (finalEstado === "Activa") {
        successNotice = `¡Práctica ${isEditingPractice ? "actualizada" : "creada"} y Activa institucionalmente!`;
      } else if (finalEstado === "Planificada") {
        successNotice = `¡Práctica ${isEditingPractice ? "actualizada" : "creada"} como Planificada (iniciará el ${practiceFormData.fecha_inicio ? formatReadableDate(practiceFormData.fecha_inicio) : "fecha indicada"})!`;
      }

      setPracticeFormSuccess(successNotice);
      notifyDataChanged("practices", isEditingPractice ? "update" : "create", {
        practiceId: editingPracticeId || data.practica_id || data.id,
      });

      setTimeout(async () => {
        setIsCreateModalOpen(false);
        setIsEditingPractice(false);
        setEditingPracticeId(null);
        setPracticeFormData(initialPracticeForm);
        await fetchDocentPracticesData();
      }, 700);
    } catch (err) {
      console.error("Error al registrar o actualizar práctica docente:", err);
      setPracticeFormError(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsSubmittingPractice(false);
    }
  };

  // Programa activo: forzado al programa del docente si existe, o al seleccionado en el formulario
  const activeProgramaId = catalogs.docent_programa_id || practiceFormData.programa_id;
  const activeProgramaNombre = catalogs.docent_programa_nombre ||
    catalogs.programas.find((p) => String(p.id) === String(activeProgramaId))?.nombreprograma ||
    catalogs.programas.find((p) => String(p.id) === String(activeProgramaId))?.nombre || "";

  const availableAsignaturas = (catalogs.asignaturas || []).filter((a) => {
    if (!activeProgramaId) return true;
    return String(a.programa_id || a.Programa_id) === String(activeProgramaId);
  });

  const availableServicios = (catalogs.servicios || []).filter((s) => {
    if (!practiceFormData.institucion_id) return true;
    return String(s.institucion_id || s.Institucion_id) === String(practiceFormData.institucion_id);
  });

  const availableAuditors = (catalogs.auditores || []).filter((au) => {
    if (!practiceFormData.institucion_id) return true;
    if (!au.institucion_id && !au.Institucion_id) return true;
    return (
      String(au.institucion_id || au.Institucion_id) === String(practiceFormData.institucion_id)
    );
  });

  // Filtrar estudiantes estrictamente al programa del docente (no permitir ver estudiantes de otras facultades/carreras)
  const programScopedStudents = useMemo(() => {
    return (catalogs.estudiantes || []).filter((st) => {
      // 1. Filtrar por ID de programa si está disponible
      if (activeProgramaId) {
        const stProgId = st.programa_id || st.Programa_id;
        if (stProgId) {
          return String(stProgId) === String(activeProgramaId);
        }
      }
      // 2. Filtrar por nombre de carrera si no hay id directo o para mayor precisión
      if (activeProgramaNombre) {
        const stCarrera = (st.carrera || st.Carrera || "").trim().toLowerCase();
        const activeName = activeProgramaNombre.trim().toLowerCase();
        if (stCarrera && activeName) {
          return stCarrera.includes(activeName) || activeName.includes(stCarrera);
        }
      }
      return true;
    });
  }, [catalogs.estudiantes, activeProgramaId, activeProgramaNombre]);

  const selectableStudents = programScopedStudents.filter((st) => {
    const q = studentSearchTerm.toLowerCase().trim();
    if (!q) return true;
    const fullName = (st.nombre_completo || `${st.nombre || st.Nombre || ""} ${st.apellidos || st.Apellidos || ""}`).toLowerCase();
    const ced = String(st.cedula || st.Cédula || "");
    const prog = (st.carrera || st.Carrera || "").toLowerCase();
    return fullName.includes(q) || ced.includes(q) || prog.includes(q);
  });

  const selectedStudentsDetails = (catalogs.estudiantes || []).filter((st) =>
    practiceFormData.estudiantes.map(String).includes(String(st.cedula || st.Cédula))
  );

  const docentName = user?.name || user?.nombre || "Docente";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ─── Encabezado Principal ─── */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 transition duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                <Hospital className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Mis Prácticas Asignadas
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Supervisión de rotaciones clínicas, seguimiento de estudiantes y publicación de observaciones
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition duration-150 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Práctica Formativa</span>
            </button>
            <button
              onClick={fetchDocentPracticesData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition duration-150 shadow-sm border border-gray-200 dark:border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
              <span>{isLoading ? "Actualizando..." : "Actualizar"}</span>
            </button>
          </div>
        </div>

        {/* Métricas rápidas */}
        {!isLoading && !error && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Mis Prácticas</span>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{practices.length}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Total Estudiantes</span>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {practices.reduce((acc, p) => acc + (p.total_estudiantes || 0), 0)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Observaciones Hechas</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {practices.reduce((acc, p) => acc + (p.total_observaciones || 0), 0)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Práctica Seleccionada</span>
              <p className="text-base font-bold text-gray-800 dark:text-gray-200 mt-1 truncate">
                {selectedPractice ? selectedPractice.titulo : "Ninguna"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Estado de Error ─── */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 flex-shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-base mb-1">Error al consultar tus prácticas</h4>
            <p className="text-sm opacity-90 mb-3">{error}</p>
            <button
              onClick={fetchDocentPracticesData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        </div>
      )}

      {/* ─── Skeleton de Carga ─── */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 animate-pulse space-y-3"
              >
                <div className="h-5 w-3/4 bg-gray-200 dark:bg-slate-700 rounded"></div>
                <div className="h-4 w-1/2 bg-gray-200 dark:bg-slate-700 rounded"></div>
                <div className="h-4 w-full bg-gray-200 dark:bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Estado Vacío: Docente sin Prácticas Asignadas ─── */}
      {!isLoading && !error && practices.length === 0 && (
        <div className="bg-white dark:bg-slate-900 p-10 sm:p-12 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-slate-700 shadow-inner">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No tienes prácticas clínicas asignadas actualmente
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-6">
            Apreciado/a docente <span className="font-semibold text-gray-800 dark:text-gray-200">{docentName}</span>, en este momento no figuras como docente supervisor de prácticas formativas en el sistema.
          </p>
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl max-w-md mx-auto text-left flex items-start gap-3 mb-6">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Comunícate con la coordinación académica de tu programa si requieres ser vinculado a una rotación hospitalaria.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-md transition duration-150"
            >
              <Plus className="w-4 h-4" /> Crear Nueva Práctica
            </button>
            <button
              onClick={fetchDocentPracticesData}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold transition duration-150"
            >
              <RefreshCw className="w-4 h-4" /> Comprobar Nuevas Asignaciones
            </button>
          </div>
        </div>
      )}

      {/* ─── Grid de Selección de Prácticas Reales ─── */}
      {!isLoading && !error && practices.length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Hospital className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Selecciona una Práctica para Administrar sus Observaciones
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {practices.map((practice) => {
                const isSelected = selectedPractice?.id === practice.id;
                return (
                  <div
                    key={practice.id}
                    onClick={() => setSelectedPractice(practice)}
                    className={`p-5 rounded-2xl cursor-pointer border transition-all duration-200 ${
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20"
                        : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                          {practice.periodo || "2024-1"}
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getDocentPracticeStateBadge(practice.estado)}`}>
                          {practice.estado === "Planificada" ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Planificada</span> : practice.estado || "Activa"}
                        </span>
                        {practice.creado_por_rol === "docent" ? (
                          <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Creada por mí
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> UPTC Admin
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                          Seleccionada
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 leading-snug">
                      {practice.titulo}
                    </h3>

                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                      <p className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{practice.institucion_nombre || "Institución Hospitalaria"}</span>
                      </p>
                      {practice.servicio_nombre && (
                        <p className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                          <Hospital className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{practice.servicio_nombre}</span>
                        </p>
                      )}
                      {practice.asignatura_nombre && (
                        <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 truncate">
                          <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{practice.asignatura_nombre}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold truncate pt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span>Auditor: {practice.auditor_nombre?.trim() || "Sin auditor asignado"}</span>
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        {practice.total_estudiantes || 0} est.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(practice);
                          }}
                          className="px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 rounded-md transition"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Panel de Detalle de la Práctica Seleccionada (Centrado) ─── */}
          {selectedPractice && (
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Resumen institucional */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Detalle de la Rotación
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        {selectedPractice.titulo}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/docent/certificates?practiceId=${selectedPractice.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 rounded-xl transition border border-amber-200 dark:border-amber-800 shadow-sm"
                        title="Diseñar o emitir certificados para esta práctica"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Certificados</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/docent/reports?practiceId=${selectedPractice.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-xl transition border border-emerald-200 dark:border-emerald-800 shadow-sm"
                        title="Generar constancias y reportes de esta práctica"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Constancias</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(selectedPractice)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 rounded-xl transition border border-blue-200 dark:border-blue-800 shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar Práctica</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Origen / Creador</span>
                      <span className="text-xs font-semibold text-right">
                        {selectedPractice.creado_por_rol === "docent" ? (
                          <span className="text-purple-600 dark:text-purple-400 font-bold inline-flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> Docente ({selectedPractice.creador_nombre || "Usted"})
                          </span>
                        ) : (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Administración UPTC
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Auditor Asignado</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-right text-xs flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>{selectedPractice.auditor_nombre?.trim() || "Sin auditor asignado"}</span>
                      </span>
                    </div>

                    {selectedPractice.auditor_correo && (
                      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-800">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Contacto del Auditor</span>
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 text-right truncate max-w-[200px]">
                          {selectedPractice.auditor_correo}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Institución</span>
                      <span className="font-semibold text-right">{selectedPractice.institucion_nombre || "No especificada"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Servicio</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 text-right">
                        {selectedPractice.servicio_nombre || "General"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Asignatura</span>
                      <span className="font-semibold text-right truncate max-w-[200px]">
                        {selectedPractice.asignatura_nombre || "Formativa"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Fechas</span>
                      <span className="font-semibold text-right text-xs">
                        {formatDate(selectedPractice.fecha_inicio)} – {formatDate(selectedPractice.fecha_fin)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Carga Horaria</span>
                      <span className="font-semibold text-right">{selectedPractice.horas_totales || 120} horas</span>
                    </div>
                  </div>

                  {selectedPractice.descripcion && (
                    <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl text-xs text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-slate-800">
                      <strong className="block text-gray-800 dark:text-gray-200 mb-0.5">Indicaciones:</strong>
                      {selectedPractice.descripcion}
                    </div>
                  )}
                </div>

                {/* Estudiantes asignados a esta práctica */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Estudiantes en esta Práctica ({selectedPractice.estudiantes?.length || 0})
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Inscritos formalmente en la rotación
                      </p>
                    </div>
                  </div>

                  {!selectedPractice.estudiantes || selectedPractice.estudiantes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                      No hay estudiantes asignados en esta práctica.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedPractice.estudiantes.map((st) => (
                        <div
                          key={st.cedula}
                          className="p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                setFichaStudent({
                                  ...st,
                                  practica_titulo: selectedPractice?.titulo,
                                  institucion_nombre: selectedPractice?.institucion_nombre,
                                  servicio_nombre: selectedPractice?.servicio_nombre,
                                  docente_nombre: selectedPractice?.docente_nombre || user?.nombre_completo || user?.nombre,
                                  auditor_nombre: selectedPractice?.auditor_nombre,
                                  horas_totales: selectedPractice?.horas_totales,
                                })
                              }
                              className="cursor-pointer group flex items-center gap-3 text-left focus:outline-none"
                              title={`Ver ficha completa de ${st.nombre_completo}`}
                            >
                              <StudentAvatar
                                cedula={st.cedula}
                                name={st.nombre_completo}
                                size="md"
                                className="group-hover:scale-105 transition-transform"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {st.nombre_completo}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  C.C. {st.cedula} {st.carrera ? `• ${st.carrera}` : ""}
                                </p>
                                {st.correo && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5 truncate">
                                    <Mail className="w-3 h-3 flex-shrink-0" /> {st.correo}
                                  </p>
                                )}
                              </div>
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setFichaStudent({
                                  ...st,
                                  practica_titulo: selectedPractice?.titulo,
                                  institucion_nombre: selectedPractice?.institucion_nombre,
                                  servicio_nombre: selectedPractice?.servicio_nombre,
                                  docente_nombre: selectedPractice?.docente_nombre || user?.nombre_completo || user?.nombre,
                                  auditor_nombre: selectedPractice?.auditor_nombre,
                                  horas_totales: selectedPractice?.horas_totales,
                                })
                              }
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 font-medium transition cursor-pointer"
                              title={`Ver ficha completa de ${st.nombre_completo}`}
                            >
                              Ficha
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL DE CREACIÓN DE NUEVA PRÁCTICA FORMATIVA ─── */}
      {isCreateModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 rounded-3xl shadow-2xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  {isEditingPractice ? <Edit3 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                </span>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                    {isEditingPractice ? "Editar Práctica Formativa" : "Nueva Práctica Formativa"}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isEditingPractice
                      ? `Modifica los parámetros, cupos o estudiantes asignados (${docentName})`
                      : `Crea una rotación clínica o práctica formativa asignada a tu rol docente (${docentName})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error / Success message */}
            {practiceFormError && (
              <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{practiceFormError}</span>
              </div>
            )}
            {practiceFormSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{practiceFormSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrUpdatePracticeSubmit} className="space-y-6">
              {/* Sección 1: Información General */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <span>1.</span> Datos de la Rotación
                </h4>

                {/* Banner de Fecha del Sistema / Hoy */}
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
                      Título de la Práctica *
                    </label>
                    <input
                      type="text"
                      name="titulo"
                      required
                      placeholder="Ej: Rotación de Pediatría y Urgencias Hospitalarias"
                      value={practiceFormData.titulo}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Periodo Académico
                    </label>
                    <input
                      type="text"
                      name="periodo"
                      placeholder="2024-1"
                      value={practiceFormData.periodo}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Estado
                    </label>
                    <select
                      name="estado"
                      value={practiceFormData.estado}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    >
                      {ESTADOS_PRACTICA_DOCENTE.map((e) => (
                        <option key={e.value} value={e.value} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </div>

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
                      value={practiceFormData.fecha_inicio}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha de Finalización
                    </label>
                    <input
                      type="date"
                      name="fecha_fin"
                      value={practiceFormData.fecha_fin}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  {/* Alerta contextual para Estado = Planificada */}
                  {practiceFormData.estado === "Planificada" && (
                    <div className="md:col-span-2">
                      <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 flex items-start gap-3 text-xs leading-relaxed">
                        <span className="text-base flex-shrink-0">⏳</span>
                        <div>
                          <strong className="block text-blue-800 dark:text-blue-300 font-bold mb-0.5">
                            Práctica en Estado Planificada
                          </strong>
                          La rotación comenzará próximamente ({practiceFormData.fecha_inicio ? formatReadableDate(practiceFormData.fecha_inicio) : "fecha por definir"}). Al llegar la fecha de inicio pasará automáticamente a <strong>"Activa"</strong>.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alerta contextual para Estado = Finalizada */}
                  {practiceFormData.estado === "Finalizada" && (
                    <div className="md:col-span-2">
                      <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/70 bg-purple-50/80 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 flex items-start gap-3 text-xs leading-relaxed">
                        <Flag className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-purple-800 dark:text-purple-300 font-bold mb-0.5">
                            Práctica en Estado Finalizada
                          </strong>
                          La fecha final de esta rotación ({practiceFormData.fecha_fin ? formatReadableDate(practiceFormData.fecha_fin) : "alcanzada"}) ha llegado o ha sido superada. La práctica quedará en estado <strong>"Finalizada"</strong> para el registro de horas y certificados de culminación.
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
                      value={practiceFormData.horas_totales}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
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
                      value={practiceFormData.cupos}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Descripción u Objetivos
                    </label>
                    <textarea
                      name="descripcion"
                      rows="2"
                      placeholder="Competencias clínicas a desarrollar, pautas de rotación, turnos..."
                      value={practiceFormData.descripcion}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Área Académica */}
              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <span>2.</span> Área Académica
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catalogs.docent_programa_id || catalogs.docent_programa_nombre ? (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                        <span>Programa Académico</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Tu Programa Asignado
                        </span>
                      </label>
                      <div className="w-full px-3.5 py-2.5 text-sm border border-blue-200 dark:border-blue-900/60 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 font-semibold flex items-center justify-between shadow-sm">
                        <span className="flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          {catalogs.docent_programa_nombre ||
                            catalogs.programas.find((p) => String(p.id) === String(catalogs.docent_programa_id))?.nombreprograma ||
                            "Programa Asignado"}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">Exclusivo docente</span>
                      </div>
                      <input
                        type="hidden"
                        name="programa_id"
                        value={practiceFormData.programa_id || catalogs.docent_programa_id || ""}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Programa Académico *
                      </label>
                      <select
                        name="programa_id"
                        required
                        value={practiceFormData.programa_id}
                        onChange={handlePracticeInputChange}
                        className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                      >
                        <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          -- Seleccionar Programa --
                        </option>
                        {catalogs.programas.map((p) => (
                          <option key={p.id} value={p.id} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                            {p.nombre || p.nombreprograma || p.Nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                      <span>Asignatura *</span>
                      {availableAsignaturas.length > 0 && (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                          {availableAsignaturas.length} disponible{availableAsignaturas.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </label>
                    <select
                      name="asignatura_id"
                      required
                      value={practiceFormData.asignatura_id}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                        {!activeProgramaId
                          ? "-- Primero elige un programa --"
                          : availableAsignaturas.length === 0
                          ? "-- Sin asignaturas registradas para este programa --"
                          : "-- Seleccionar Asignatura --"}
                      </option>
                      {availableAsignaturas.map((a) => (
                        <option key={a.id || a.id_asignatura_table} value={a.id || a.id_asignatura_table} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {a.nombre || a.nombreasignatura || a.Nombre} {(a.codigo || a.codigoasignatura || a.Codigo) ? `(${a.codigo || a.codigoasignatura || a.Codigo})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 3: Escenario Asistencial */}
              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <span>3.</span> Escenario de Práctica Asistencial
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Institución / Entidad de Salud
                    </label>
                    <select
                      name="institucion_id"
                      value={practiceFormData.institucion_id}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">-- Seleccionar Institución --</option>
                      {catalogs.instituciones.map((i) => (
                        <option key={i.id} value={i.id} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {i.nombre || i.nombreinstitucion || i.Nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Servicio Hospitalario
                    </label>
                    <select
                      name="servicio_id"
                      value={practiceFormData.servicio_id}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                        {!practiceFormData.institucion_id
                          ? "-- Primero elige una institución (o servicio general) --"
                          : "-- Seleccionar Servicio --"}
                      </option>
                      {availableServicios.map((s) => (
                        <option key={s.id || s.id_servicio_table} value={s.id || s.id_servicio_table} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {s.nombre || s.nombreservicio || s.Nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Auditor de Salud (Opcional)
                    </label>
                    <select
                      name="auditor_cedula"
                      value={practiceFormData.auditor_cedula}
                      onChange={handlePracticeInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    >
                      <option value="" className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">-- Sin auditor específico (o asignar después) --</option>
                      {availableAuditors.map((au) => (
                        <option key={au.cedula || au.Cédula} value={au.cedula || au.Cédula} className="bg-white text-gray-900 dark:bg-zinc-800 dark:text-white">
                          {au.nombre_completo || `${au.nombre || au.Nombre} ${au.apellidos || au.Apellidos}`} ({au.cedula || au.Cédula})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 4: Asignación de Estudiantes */}
              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <span>4.</span> Asignar Estudiantes ({practiceFormData.estudiantes.length} / {practiceFormData.cupos || 10})
                  </h4>
                  {practiceFormData.estudiantes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPracticeFormData((prev) => ({ ...prev, estudiantes: [] }))}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      Quitar todos
                    </button>
                  )}
                </div>

                {/* Banner de restricción académica para el docente */}
                {activeProgramaNombre && (
                  <div className="mb-3 px-3 py-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-200 flex items-center gap-2 shadow-xs">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span>
                      Mostrando únicamente estudiantes matriculados en <strong>{activeProgramaNombre}</strong>. No puedes vincular estudiantes de otras asignaturas o carreras.
                    </span>
                  </div>
                )}

                {/* Chips de estudiantes seleccionados */}
                {selectedStudentsDetails.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl max-h-36 overflow-y-auto">
                    {selectedStudentsDetails.map((st) => {
                      const ced = st.cedula || st.Cédula;
                      return (
                        <span
                          key={ced}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-200 text-xs font-semibold rounded-lg shadow-sm border border-blue-200 dark:border-zinc-700"
                        >
                          <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5 text-blue-500" /> {st.nombre_completo || `${st.nombre || st.Nombre} ${st.apellidos || st.Apellidos}`} (C.C. {ced})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudentSelection(ced)}
                            className="text-rose-500 hover:text-rose-700 font-bold ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-3">
                    Aún no has seleccionado estudiantes. Puedes buscar y marcar los estudiantes abajo para asignarlos a esta práctica.
                  </p>
                )}

                {/* Buscador de estudiantes */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Buscar estudiante por nombre, apellido o cédula..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                  </div>

                  {/* Lista de estudiantes disponibles */}
                  <div className="border border-gray-200 dark:border-zinc-800 rounded-xl max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800 bg-gray-50 dark:bg-zinc-800/40">
                    {selectableStudents.length === 0 ? (
                      <p className="text-xs text-gray-400 p-3 text-center">
                        {isLoadingCatalogs
                          ? "Cargando estudiantes..."
                          : activeProgramaNombre
                          ? `No hay más estudiantes disponibles en ${activeProgramaNombre} con ese criterio.`
                          : "No se encontraron estudiantes con ese criterio de búsqueda."}
                      </p>
                    ) : (
                      selectableStudents.map((st) => {
                        const ced = st.cedula || st.Cédula;
                        const isAssigned = practiceFormData.estudiantes.map(String).includes(String(ced));
                        return (
                          <div
                            key={ced}
                            onClick={() => handleToggleStudentSelection(ced)}
                            className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                              isAssigned
                                ? "bg-blue-100/60 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
                                : "hover:bg-white dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            <div>
                              <p className="font-semibold">
                                {st.nombre_completo || `${st.nombre || st.Nombre || ""} ${st.apellidos || st.Apellidos || ""}`}
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Cédula: {ced} {(st.carrera || st.Carrera) ? `• ${st.carrera || st.Carrera}` : ""}
                              </p>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                isAssigned
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300"
                              }`}
                            >
                              {isAssigned ? <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Asignado</span> : "+ Asignar"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmittingPractice}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPractice}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingPractice ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isEditingPractice ? "Guardando Cambios..." : "Creando Práctica..."}</span>
                    </>
                  ) : (
                    <>
                      {isEditingPractice ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      <span>{isEditingPractice ? "Guardar Cambios de la Práctica" : "Crear y Publicar Práctica Formativa"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Ficha Integral del Estudiante */}
      <StudentFichaModal
        isOpen={!!fichaStudent}
        onClose={() => setFichaStudent(null)}
        student={fichaStudent}
        practiceInfo={selectedPractice || {}}
        role="docent"
        onPrimaryAction={(st) => {
          setTargetStudentCedula(st.cedula);
          setObsTipo("Desempeño");
        }}
        primaryActionLabel="Redactar Observación"
      />
    </div>
  );
};

export default DocentPractices;