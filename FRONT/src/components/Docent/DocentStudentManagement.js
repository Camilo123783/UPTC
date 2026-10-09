// ============================================================
// DocentStudentManagement.js — Gestión y Consulta de Estudiantes por Práctica
// Permite al docente seleccionar la práctica formativa primero
// y luego gestionar, calificar y consultar las fichas de los estudiantes
// ============================================================
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { generateCsv, generatePdf } from '../../utils/reportGenerator';
import { BACKEND_URL } from '../../config/api';
import { notifyDataChanged, useDataSync } from '../../utils/dataSync';
import toast from '../../utils/toast';
import StudentAvatar from '../Shared/StudentAvatar';
import StudentFichaModal from '../Shared/StudentFichaModal';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Building2,
  Search,
  Eye,
  RefreshCw,
  ClipboardList,
  UserCheck,
  Shield,
  Landmark,
  BookOpen,
  Book,
  GraduationCap,
  Check,
  CheckCircle2,
  XCircle,
  Users,
  Edit3,
  FileEdit,
  Save,
  X,
  Stethoscope,
  Sparkles,
  ThumbsUp,
  AlertTriangle,
  Star,
  Clock,
  ShieldCheck,
  FileCheck,
  ExternalLink,
} from 'lucide-react';

const API_BASE_URL = BACKEND_URL;

const PRACTICE_STATUSES = ['Activa', 'Planificada', 'En Curso', 'Finalizada', 'Cancelada'];

const DocentStudentManagement = () => {
  // ─── Estados Principales ───
  const [students, setStudents] = useState([]);
  const [docentPractices, setDocentPractices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ─── Estados de Selección y Filtro de Prácticas ───
  const [selectedPracticeId, setSelectedPracticeId] = useState(null);
  const [practiceSearchTerm, setPracticeSearchTerm] = useState('');
  const [practiceStatusFilter, setPracticeStatusFilter] = useState('Todos');

  // ─── Estados de Búsqueda y Filtros de Estudiantes ───
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [evaluationStatusFilter, setEvaluationStatusFilter] = useState('Todos');

  // ─── Referencias ───
  const studentsSectionRef = useRef(null);

  // ─── Estados para Evaluaciones ───
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [evaluationFeedback, setEvaluationFeedback] = useState('');
  const [likertScores, setLikertScores] = useState({
    knowledge: 3,
    skills: 3,
    attitude: 3,
    communication: 3,
  });
  const [viewingStudent, setViewingStudent] = useState(null);
  const [isEvaluatingModalOpen, setIsEvaluatingModalOpen] = useState(false);
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);

  // ─── Estados para Validación y Aval Documental ───
  const [validatingStudent, setValidatingStudent] = useState(null);
  const [isValidatingModalOpen, setIsValidatingModalOpen] = useState(false);
  const [isValidatingLoading, setIsValidatingLoading] = useState(false);

  // ─── Estilos de Insignias de Estado de Práctica ───
  const getBadgeStyle = (status) => {
    switch (status) {
      case 'Activa':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'Planificada':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Finalizada':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'Cancelada':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      default:
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    }
  };

  // ─── Carga de Datos Reales ───
  const fetchDocentData = useCallback(async () => {
    setIsLoading(true);
    try {
      let docentCedula = null;
      try {
        const stored = sessionStorage.getItem('userData') || localStorage.getItem('userData');
        if (stored) {
          const parsed = JSON.parse(stored);
          docentCedula = parsed.cedula || parsed.Cédula || parsed.id || null;
        }
      } catch (e) {
        console.warn('No se pudo leer sesión docente:', e);
      }

      const token =
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const studentsUrl = docentCedula
        ? `${API_BASE_URL}/api/docent/students/${docentCedula}`
        : `${API_BASE_URL}/api/docent/students`;

      const practicesUrl = docentCedula
        ? `${API_BASE_URL}/api/docent/practices/${docentCedula}`
        : `${API_BASE_URL}/api/docent/practices`;

      const [studentsRes, practicesRes] = await Promise.allSettled([
        fetch(studentsUrl, { headers }),
        fetch(practicesUrl, { headers }),
      ]);

      if (studentsRes.status === 'fulfilled' && studentsRes.value.ok) {
        const data = await studentsRes.value.json();
        setStudents(Array.isArray(data) ? data : []);
      }

      if (practicesRes.status === 'fulfilled' && practicesRes.value.ok) {
        const pData = await practicesRes.value.json();
        const pList = Array.isArray(pData) ? pData : [];
        setDocentPractices(pList);

        // Preseleccionar automáticamente la primera práctica activa o disponible
        if (pList.length > 0) {
          setSelectedPracticeId((prev) => {
            if (prev === 'Todas') return 'Todas';
            if (prev && pList.some((p) => String(p.id) === String(prev))) return prev;
            const activePractice = pList.find((p) => p.estado === 'Activa');
            return activePractice ? activePractice.id : pList[0].id;
          });
        }
      }
    } catch (err) {
      console.error('Error al cargar datos del docente:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocentData();
  }, [fetchDocentData]);

  useDataSync(fetchDocentData);

  // ─── Selección de Práctica y Desplazamiento Suave ───
  const handleSelectPractice = (practiceId) => {
    setSelectedPracticeId(practiceId);
    setTimeout(() => {
      studentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // ─── Práctica Actualmente Seleccionada ───
  const currentPractice = useMemo(() => {
    if (!selectedPracticeId || selectedPracticeId === 'Todas') return null;
    return docentPractices.find((p) => String(p.id) === String(selectedPracticeId)) || null;
  }, [docentPractices, selectedPracticeId]);

  // ─── Filtrado de Tarjetas de Prácticas ───
  const filteredPractices = useMemo(() => {
    return docentPractices.filter((p) => {
      const term = practiceSearchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        (p.titulo || '').toLowerCase().includes(term) ||
        (p.institucion_nombre || '').toLowerCase().includes(term) ||
        (p.servicio_nombre || '').toLowerCase().includes(term) ||
        (p.programa_nombre || '').toLowerCase().includes(term) ||
        (p.asignatura_nombre || '').toLowerCase().includes(term);

      const matchesStatus =
        practiceStatusFilter === 'Todos'
          ? true
          : (p.estado || '').toLowerCase() === practiceStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [docentPractices, practiceSearchTerm, practiceStatusFilter]);

  // ─── Estudiantes de la Práctica Seleccionada ───
  const practiceStudents = useMemo(() => {
    if (!currentPractice) {
      return students; // si es 'Todas'
    }
    return students.filter((s) => String(s.practiceId) === String(currentPractice.id));
  }, [students, currentPractice]);

  // ─── Filtrado de Estudiantes por Búsqueda y Evaluación ───
  const filteredStudents = useMemo(() => {
    return practiceStudents.filter((st) => {
      const term = studentSearchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        (st.name || '').toLowerCase().includes(term) ||
        (st.lastName || '').toLowerCase().includes(term) ||
        (st.fullName || '').toLowerCase().includes(term) ||
        (st.cedula || '').toLowerCase().includes(term) ||
        (st.email || '').toLowerCase().includes(term) ||
        (st.career || '').toLowerCase().includes(term);

      const matchesEvaluation =
        evaluationStatusFilter === 'Todos'
          ? true
          : evaluationStatusFilter === 'Completada'
          ? st.score !== null && st.score !== undefined
          : st.score === null || st.score === undefined;

      return matchesSearch && matchesEvaluation;
    });
  }, [practiceStudents, studentSearchTerm, evaluationStatusFilter]);

  // ─── Métricas KPI de la Práctica Seleccionada ───
  const practiceMetrics = useMemo(() => {
    const list = practiceStudents;
    const total = list.length;
    const completed = list.filter((s) => s.score !== null && s.score !== undefined).length;
    const pending = total - completed;
    const averageScore =
      completed > 0
        ? (
            list
              .filter((s) => s.score !== null && s.score !== undefined)
              .reduce((acc, s) => acc + Number(s.score), 0) / completed
          ).toFixed(1)
        : '—';
    return { total, completed, pending, averageScore };
  }, [practiceStudents]);

  // ─── Contadores Globales para Métricas Superiores ───
  const globalMetrics = useMemo(() => {
    const totalStudents = students.length;
    const totalEvaluated = students.filter(
      (s) => s.evaluationStatus === 'Completada' || (s.score !== null && s.score !== undefined)
    ).length;
    const totalPending = totalStudents - totalEvaluated;
    const totalPractices = docentPractices.length;
    return { totalStudents, totalEvaluated, totalPending, totalPractices };
  }, [students, docentPractices]);

  // ─── Cálculo Automático de Nota y Desempeño según los 4 Ítems ───
  const computedScore = useMemo(() => {
    const k = Number(likertScores.knowledge) || 1;
    const s = Number(likertScores.skills) || 1;
    const a = Number(likertScores.attitude) || 1;
    const c = Number(likertScores.communication) || 1;
    return (k + s + a + c) / 4;
  }, [likertScores]);

  const getPerformanceBadge = (score) => {
    if (score >= 4.6) {
      return {
        label: 'Excelente (Aprobado)',
        icon: Sparkles,
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-800',
      };
    }
    if (score >= 4.0) {
      return {
        label: 'Sobresaliente (Aprobado)',
        icon: Star,
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800',
      };
    }
    if (score >= 3.0) {
      return {
        label: 'Aprobado Básico',
        icon: ThumbsUp,
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      };
    }
    return {
      label: 'Reprobado (< 3.0)',
      icon: AlertTriangle,
      className: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    };
  };

  // ─── Renderizador de Estado Académico según Nota (0.0 - 5.0) ───
  const getScoreBadge = (score) => {
    if (score === null || score === undefined) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Clock className="w-3.5 h-3.5" /> Pendiente
        </span>
      );
    }

    const num = Number(score);
    const isApproved = num >= 3.0;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm ${
          isApproved
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
        }`}
      >
        {isApproved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
        <span>{num.toFixed(1)} / 5.0</span>
      </span>
    );
  };

  // ─── Acciones de Evaluación ───
  const handleOpenEvaluation = (student) => {
    setSelectedStudent(student);
    setEvaluationFeedback(student.feedback || '');
    if (student.likertScores && typeof student.likertScores === 'object') {
      setLikertScores({
        knowledge: Number(student.likertScores.knowledge) || 3,
        skills: Number(student.likertScores.skills) || 3,
        attitude: Number(student.likertScores.attitude) || 3,
        communication: Number(student.likertScores.communication) || 3,
      });
    } else if (student.score !== null && student.score !== undefined) {
      const base = Math.min(5, Math.max(1, Math.round(Number(student.score))));
      setLikertScores({
        knowledge: base,
        skills: base,
        attitude: base,
        communication: base,
      });
    } else {
      setLikertScores({
        knowledge: 3,
        skills: 3,
        attitude: 3,
        communication: 3,
      });
    }
    setIsEvaluatingModalOpen(true);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedStudent) return;

    const numScore = parseFloat(computedScore.toFixed(1));

    setIsSavingEvaluation(true);
    try {
      const payload = {
        practica_id: selectedStudent.practiceId,
        estudiante_cedula: selectedStudent.cedula,
        calificacion: numScore,
        retroalimentacion: evaluationFeedback.trim() || 'Desempeño clínico evaluado satisfactoriamente.',
        criterios: likertScores,
      };

      const res = await fetch(`${API_BASE_URL}/api/docent/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'No se pudo guardar la calificación.');
      }

      // Actualizar estado local inmediatamente
      setStudents((prev) =>
        prev.map((s) =>
          String(s.cedula) === String(selectedStudent.cedula) &&
          String(s.practiceId) === String(selectedStudent.practiceId)
            ? {
                ...s,
                evaluationStatus: 'Completada',
                score: numScore,
                feedback: payload.retroalimentacion,
                likertScores: likertScores,
                evaluationDate: new Date().toISOString().substring(0, 10),
              }
            : s
        )
      );

      setIsEvaluatingModalOpen(false);
      notifyDataChanged('evaluations', 'update');
      notifyDataChanged('practices', 'update');
      toast.success(
        `Calificación de ${numScore.toFixed(1)} / 5.0 guardada exitosamente para ${
          selectedStudent.fullName || selectedStudent.name
        }. El estudiante ya puede visualizarla en su panel.`
      );
    } catch (err) {
      console.error('Error al guardar evaluación:', err);
      toast.error(`Error al registrar calificación: ${err.message}`);
    } finally {
      setIsSavingEvaluation(false);
    }
  };

  // ─── Apertura y Acción de Validación Documental ───
  const handleOpenValidationModal = async (student) => {
    setValidatingStudent(student);
    setIsValidatingModalOpen(true);

    // Consultar el expediente en vivo del estudiante para garantizar datos frescos
    try {
      const token =
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/student/details/${student.cedula}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          const d = json.data;
          setValidatingStudent((prev) => {
            if (!prev || String(prev.cedula) !== String(student.cedula)) return prev;
            return {
              ...prev,
              has_cv: !!d.cvDigital,
              has_eps: !!d.socialSecurity,
              has_arl: !!d.professionalRisks,
              has_id: !!d.idCopy,
              has_carnet: !!d.carnetCopy,
              has_vaccines: !!d.vaccines,
              docs_count: [
                d.cvDigital,
                d.socialSecurity,
                d.professionalRisks,
                d.idCopy,
                d.carnetCopy,
                d.vaccines,
              ].filter(Boolean).length,
            };
          });
        }
      }
    } catch (e) {
      console.warn('No se pudo refrescar el expediente en vivo del estudiante:', e);
    }
  };

  const handleUpdateStudentValidation = async (nuevoEstado) => {
    if (!validatingStudent) return;
    const practiceId = validatingStudent.practiceId || currentPractice?.id;
    if (!practiceId) {
      toast.error('No se pudo identificar la práctica para validar el estudiante.');
      return;
    }

    setIsValidatingLoading(true);
    try {
      const token =
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('token');

      const res = await fetch(
        `${API_BASE_URL}/api/docent/practices/${practiceId}/students/${validatingStudent.cedula}/validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ estado: nuevoEstado }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al actualizar el estado de validación.');
      }

      // Actualizar estado en lista local de estudiantes
      setStudents((prev) =>
        prev.map((s) =>
          String(s.cedula) === String(validatingStudent.cedula) &&
          String(s.practiceId) === String(practiceId)
            ? { ...s, estado: nuevoEstado, estado_asignacion: nuevoEstado }
            : s
        )
      );

      setValidatingStudent((prev) =>
        prev ? { ...prev, estado: nuevoEstado, estado_asignacion: nuevoEstado } : null
      );

      notifyDataChanged('practices', 'update');

      if (nuevoEstado === 'Activo') {
        toast.success(
          `¡Aval otorgado! El estudiante ${
            validatingStudent.fullName || validatingStudent.name
          } ha sido validado y marcado como Activo.`
        );
      } else {
        toast.info(
          `El estudiante ${
            validatingStudent.fullName || validatingStudent.name
          } ha sido marcado como Pendiente.`
        );
      }
    } catch (err) {
      console.error('Error al validar estudiante:', err);
      toast.error(err.message || 'Error al guardar la validación.');
    } finally {
      setIsValidatingLoading(false);
    }
  };

  // ─── Descarga de Listado Oficial ───
  const handleDownloadList = (format) => {
    const dataToDownload = filteredStudents.map(
      ({
        id,
        name,
        lastName,
        cedula,
        email,
        career,
        practiceName,
        service,
        hospital,
        evaluationStatus,
        score,
        feedback,
        practiceStartDate,
        practiceEndDate,
        practiceStatus,
        horas_cumplidas,
        horas_asignadas,
      }) => ({
        ID: id,
        Estudiante: `${name} ${lastName}`.trim(),
        Cedula: cedula,
        Programa: career,
        Email: email,
        Practica: practiceName || currentPractice?.titulo || 'Práctica',
        Escenario: hospital || currentPractice?.institucion_nombre || 'N/A',
        Servicio: service || currentPractice?.servicio_nombre || 'N/A',
        HorasRealizadas: `${horas_cumplidas || 0} / ${horas_asignadas || currentPractice?.horas_totales || 120}h`,
        EstadoPractica: practiceStatus || currentPractice?.estado || 'Activa',
        EstadoEvaluacion: evaluationStatus,
        Calificacion: score !== null && score !== undefined ? `${Number(score).toFixed(1)} / 5.0` : 'Pendiente',
        Retroalimentacion: feedback || 'N/A',
        FechaInicio: practiceStartDate || currentPractice?.fecha_inicio || 'N/A',
        FechaFin: practiceEndDate || currentPractice?.fecha_fin || 'N/A',
      })
    );

    const safeTitle = (currentPractice?.titulo || 'Todos_Los_Estudiantes').replace(/\s+/g, '_');
    const filename = `Estudiantes_${safeTitle}.${format}`;
    if (format === 'csv') {
      generateCsv(dataToDownload, filename);
    } else if (format === 'pdf') {
      generatePdf(dataToDownload, filename);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition-colors duration-200">
      {/* ─── Encabezado Principal ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-2xl border border-blue-200 dark:border-blue-900/60 shadow-sm flex items-center justify-center">
            <Stethoscope className="w-8 h-8" />
          </span>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Mis Estudiantes en Práctica
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Selecciona una práctica formativa para visualizar y gestionar exclusivamente a sus alumnos inscritos.
            </p>
          </div>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex items-center gap-2">
          <a
            href="/docent/hours-compliance"
            className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Clock className="w-3.5 h-3.5" /> Panel de Horas
          </a>
          <button
            onClick={() => handleDownloadList('csv')}
            disabled={filteredStudents.length === 0}
            className="py-2 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition border border-gray-300 dark:border-zinc-700 flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => handleDownloadList('pdf')}
            disabled={filteredStudents.length === 0}
            className="py-2 px-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition border border-gray-300 dark:border-zinc-700 flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* ─── Métricas Resumen (Globales del Docente) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Total en Clase
          </p>
          <p className="text-3xl font-black text-blue-950 dark:text-blue-100 mt-1">
            {globalMetrics.totalStudents}
          </p>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
            Alumnos vinculados
          </p>
        </div>

        <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Evaluados
          </p>
          <p className="text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
            {globalMetrics.totalEvaluated}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
            Calificaciones registradas
          </p>
        </div>

        <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Por Evaluar
          </p>
          <p className="text-3xl font-black text-amber-950 dark:text-amber-100 mt-1">
            {globalMetrics.totalPending}
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            Pendientes de nota
          </p>
        </div>

        <div className="p-4 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
            Mis Prácticas
          </p>
          <p className="text-3xl font-black text-purple-950 dark:text-purple-100 mt-1">
            {globalMetrics.totalPractices}
          </p>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
            Escenarios a cargo
          </p>
        </div>
      </div>

      {/* ============================================================
          SECCIÓN 1: SELECTOR DE PRÁCTICAS FORMATIVAS
          ============================================================ */}
      <div className="space-y-4 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600 inline-block" /> 1. Selecciona la Práctica Formativa ({filteredPractices.length})
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Haz clic sobre cualquier práctica para cargar sus estudiantes inscritos y gestionar sus evaluaciones y notas.
            </p>
          </div>

          {/* Filtros y Opciones de la Galería de Prácticas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={practiceSearchTerm}
                onChange={(e) => setPracticeSearchTerm(e.target.value)}
                placeholder="Buscar por título, hospital, servicio..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={practiceStatusFilter}
              onChange={(e) => setPracticeStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="Todos">Todos los Estados</option>
              <option value="Activa">Activas</option>
              <option value="Planificada">Planificadas</option>
              <option value="Finalizada">Finalizadas</option>
              <option value="Cancelada">Canceladas</option>
            </select>

            <button
              type="button"
              onClick={() => setSelectedPracticeId('Todas')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                selectedPracticeId === 'Todas'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Ver Todos Juntos
            </button>
          </div>
        </div>

        {/* Galería de Tarjetas de Prácticas */}
        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
              Cargando prácticas formativas...
            </p>
          </div>
        ) : filteredPractices.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400">
            <ClipboardList className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="font-semibold text-sm">No se encontraron prácticas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPractices.map((p) => {
              const isSelected = selectedPracticeId !== 'Todas' && String(p.id) === String(selectedPracticeId);
              const studentCount =
                students.filter((s) => String(s.practiceId) === String(p.id)).length ||
                (p.estudiantes || []).length;
              const totalHoursReq = p.horas_totales || 120;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPractice(p.id)}
                  className={`flex flex-col justify-between rounded-2xl p-6 transition duration-200 cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-50/20 dark:bg-blue-950/30 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500 shadow-xl shadow-blue-500/15'
                      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-gray-400 dark:hover:border-zinc-600 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getBadgeStyle(p.estado)}`}>
                        ● {p.estado || 'Activa'}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 rounded-md">
                        Periodo {p.periodo || '2024-1'}
                      </span>
                    </div>

                    {/* Título de la práctica */}
                    <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-1">
                      {p.titulo}
                    </h3>

                    {/* Creada por */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Creada por:
                      </span>
                      {p.creado_por_rol === 'docent' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shadow-sm">
                          <UserCheck className="w-3.5 h-3.5 inline-block" />
                          <span>Docente:</span>
                          <span className="underline decoration-purple-400 underline-offset-2">
                            {p.creador_nombre || p.docente_nombre || 'Docente'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 shadow-sm">
                          <Shield className="w-3.5 h-3.5 inline-block" />
                          <span>Administrador:</span>
                          <span className="underline decoration-indigo-400 underline-offset-2">
                            {p.creador_nombre || 'Administrador UPTC'}
                          </span>
                        </span>
                      )}
                    </div>

                    {p.descripcion && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                        {p.descripcion}
                      </p>
                    )}

                    {/* Detalles relacionales asociados */}
                    <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 mb-6 bg-gray-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Entidad:</strong> {p.institucion_nombre || 'Sin asignar'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Servicio:</strong> {p.servicio_nombre || 'Sin asignar'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Programa:</strong> {p.programa_nombre || 'General'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Book className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Asignatura:</strong> {p.asignatura_nombre || 'Sin asignar'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Docente:</strong> {p.docente_nombre?.trim() || 'Sin docente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          <strong>Auditor:</strong> {p.auditor_nombre?.trim() || 'Sin auditor'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer de la tarjeta */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-zinc-800 pt-3 mb-4">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-gray-400 inline-block" /> <strong>{studentCount}</strong> / {p.cupos || 10} cupos
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400 inline-block" /> {totalHoursReq}h requeridas
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPractice(p.id);
                      }}
                      className={`w-full py-2.5 px-3 text-xs font-bold rounded-xl transition text-center flex items-center justify-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                          : 'bg-gray-100 hover:bg-blue-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-blue-600 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Práctica Seleccionada
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-3.5 h-3.5" /> Seleccionar Práctica
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================
          SECCIÓN 2: ESTUDIANTES Y GESTIÓN DE LA PRÁCTICA SELECCIONADA
          ============================================================ */}
      <div ref={studentsSectionRef} className="space-y-6 pt-2">
        {currentPractice ? (
          <div className="rounded-3xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            {/* Banner de la Práctica Seleccionada */}
            <div className="p-6 bg-gradient-to-r from-blue-900/10 via-indigo-900/5 to-transparent border-b border-gray-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getBadgeStyle(currentPractice.estado)}`}>
                    ● {currentPractice.estado || 'Activa'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    Periodo {currentPractice.periodo || '2024-1'}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Estudiantes de: <span className="text-blue-600 dark:text-blue-400">{currentPractice.titulo}</span>
                </h3>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-gray-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1"><Landmark className="w-3.5 h-3.5 text-gray-400" /> Sede: <strong className="text-gray-700 dark:text-zinc-200">{currentPractice.institucion_nombre || 'Sin sede'}</strong></span>
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-gray-400" /> Servicio: <strong className="text-gray-700 dark:text-zinc-200">{currentPractice.servicio_nombre || 'Sin servicio'}</strong></span>
                  <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-gray-400" /> Docente: <strong className="text-gray-700 dark:text-zinc-200">{currentPractice.docente_nombre || 'Docente'}</strong></span>
                  <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-gray-400" /> Auditor: <strong className="text-emerald-600 dark:text-emerald-400">{currentPractice.auditor_nombre?.trim() || 'Sin auditor asignado'}</strong></span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /> Meta Base: <strong className="text-gray-700 dark:text-zinc-200">{currentPractice.horas_totales || 120} hrs</strong></span>
                </div>
              </div>

              {/* Indicadores KPI en el Banner */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400 block">Inscritos</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{practiceMetrics.total} alumnos</span>
                </div>
                <div className="px-4 py-2 bg-emerald-50/10 border border-emerald-50/20 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Evaluados</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{practiceMetrics.completed} / {practiceMetrics.total}</span>
                </div>
                <div className="px-4 py-2 bg-blue-50/10 border border-blue-50/20 rounded-2xl text-center">
                  <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">Promedio</span>
                  <span className="text-lg font-black text-blue-700 dark:text-blue-300">{practiceMetrics.averageScore}</span>
                </div>
              </div>
            </div>

            {/* Barra de Filtros para los Estudiantes de esta Práctica */}
            <div className="p-4 bg-gray-50/80 dark:bg-zinc-800/40 border-b border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar alumno por nombre, cédula o programa..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <select
                  value={evaluationStatusFilter}
                  onChange={(e) => setEvaluationStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="Todos">Todos los Alumnos ({practiceStudents.length})</option>
                  <option value="Pendiente">Pendientes de Nota ({practiceMetrics.pending})</option>
                  <option value="Completada">Evaluados con Nota ({practiceMetrics.completed})</option>
                </select>

                <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:inline">
                  Escala: 0.0 - 5.0 (Aprobación ≥ 3.0)
                </span>
              </div>
            </div>

            {/* Tabla de Estudiantes de la Práctica Seleccionada */}
            {isLoading ? (
              <div className="p-12 text-center text-blue-600 dark:text-blue-400 font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2 text-blue-600" /> Sincronizando estudiantes y calificaciones de {currentPractice.titulo}...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <GraduationCap className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="font-semibold text-sm">
                  {practiceStudents.length === 0
                    ? `No hay estudiantes inscritos en la práctica "${currentPractice.titulo}".`
                    : 'No se encontraron estudiantes que coincidan con la búsqueda.'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {practiceStudents.length === 0
                    ? 'Los estudiantes asignados a esta rotación aparecerán aquí automáticamente.'
                    : 'Intenta limpiar el término de búsqueda o cambiar el filtro.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                  <thead className="bg-gray-100 dark:bg-zinc-800">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Cédula
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Estudiante
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Escenario / Servicio
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Horas Realizadas
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Documentos / Estado
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Calificación
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {filteredStudents.map((st) => {
                      const totalAsig = st.horas_asignadas || currentPractice.horas_totales || 120;
                      const cumplidas = st.horas_cumplidas || 0;
                      const pct = Math.min(100, Math.round((cumplidas / totalAsig) * 100));
                      const isActivo = st.estado === 'Activo' || st.estado_asignacion === 'Activo';

                      return (
                        <tr
                          key={`${st.cedula}-${st.practiceId}`}
                          className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/50 transition duration-150"
                        >
                          <td className="px-5 py-3.5 font-mono text-xs text-gray-600 dark:text-gray-400 font-semibold">
                            {st.cedula}
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="cursor-pointer"
                                onClick={() => setViewingStudent(st)}
                                title={`Ver ficha completa de ${st.fullName || `${st.name} ${st.lastName}`.trim()}`}
                              >
                                <StudentAvatar
                                  cedula={st.cedula}
                                  name={st.fullName || `${st.name} ${st.lastName}`.trim()}
                                  size="md"
                                  hasPhoto={st.tiene_foto}
                                />
                              </div>
                              <div className="min-w-0">
                                <div
                                  className="font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition truncate"
                                  onClick={() => setViewingStudent(st)}
                                  title="Ver ficha completa"
                                >
                                  {st.fullName || `${st.name} ${st.lastName}`.trim()}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {st.email} {st.career ? `· ${st.career}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300">
                            <div className="font-medium">{st.hospital || currentPractice.institucion_nombre || 'Hospital'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {st.service || currentPractice.servicio_nombre || 'Servicio'}
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="space-y-1 min-w-[120px]">
                              <div className="flex items-center gap-1 font-bold text-xs">
                                <span className={cumplidas >= totalAsig ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-blue-600 dark:text-blue-400'}>
                                  {cumplidas}
                                </span>
                                <span className="text-gray-400 font-medium text-[10px]">
                                  / {totalAsig}h ({pct}%)
                                </span>
                              </div>
                              <div className="w-24 bg-gray-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    cumplidas >= totalAsig
                                      ? 'bg-emerald-500'
                                      : cumplidas > 0
                                      ? 'bg-blue-500'
                                      : 'bg-gray-300 dark:bg-zinc-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-2xs ${
                                  isActivo
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                }`}
                              >
                                {isActivo ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>Activo</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    <span>Pendiente</span>
                                  </>
                                )}
                              </span>
                              <div className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
                                {st.docs_count !== undefined ? `${st.docs_count} / 6 docs` : 'Verificar soportes'}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            {getScoreBadge(st.score)}
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenValidationModal(st)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5 ${
                                  isActivo
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                                }`}
                                title="Verificar los 6 documentos requeridos y gestionar el aval del estudiante"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{isActivo ? 'Verificar Docs (Activo)' : 'Verificar Documentos'}</span>
                              </button>

                              <button
                                onClick={() => handleOpenEvaluation(st)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer ${
                                  st.score !== null && st.score !== undefined
                                    ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                              >
                                {st.score !== null && st.score !== undefined ? (
                                  <>
                                    <Edit3 className="w-3 h-3 inline mr-1" /> Modificar Nota
                                  </>
                                ) : (
                                  <>
                                    <FileEdit className="w-3 h-3 inline mr-1" /> Evaluar
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => setViewingStudent(st)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                              >
                                Ficha
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : selectedPracticeId === 'Todas' ? (
          /* Vista de Todos los Estudiantes Juntos (cuando se presiona "Ver Todos Juntos") */
          <div className="rounded-3xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-purple-900/10 via-indigo-900/5 to-transparent border-b border-gray-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500 inline-block" /> Todos los Estudiantes de Todas las Prácticas
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                  Visualización consolidada de todas tus clases y rotaciones clínicas activas.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-700 text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-zinc-400 block">Total</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{students.length} alumnos</span>
                </div>
              </div>
            </div>

            {/* Barra de Filtros */}
            <div className="p-4 bg-gray-50/80 dark:bg-zinc-800/40 border-b border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido, cédula, práctica o programa..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <select
                value={evaluationStatusFilter}
                onChange={(e) => setEvaluationStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="Todos">Todos los Alumnos ({students.length})</option>
                <option value="Pendiente">Pendientes de Nota</option>
                <option value="Completada">Evaluados con Nota</option>
              </select>
            </div>

            {/* Tabla de Todos los Estudiantes */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                <thead className="bg-gray-100 dark:bg-zinc-800">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Cédula
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Estudiante
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Práctica Formativa
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Escenario / Servicio
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Horas Realizadas
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Documentos / Estado
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Calificación
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                  {filteredStudents.map((st) => {
                    const isActivo = st.estado === 'Activo' || st.estado_asignacion === 'Activo';

                    return (
                    <tr
                      key={`${st.cedula}-${st.practiceId}`}
                      className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/50 transition duration-150"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600 dark:text-gray-400 font-semibold">
                        {st.cedula}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="cursor-pointer"
                            onClick={() => setViewingStudent(st)}
                            title={`Ver ficha completa de ${st.fullName || `${st.name} ${st.lastName}`.trim()}`}
                          >
                            <StudentAvatar
                              cedula={st.cedula}
                              name={st.fullName || `${st.name} ${st.lastName}`.trim()}
                              size="md"
                              hasPhoto={st.tiene_foto}
                            />
                          </div>
                          <div className="min-w-0">
                            <div
                              className="font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition truncate"
                              onClick={() => setViewingStudent(st)}
                              title="Ver ficha completa"
                            >
                              {st.fullName || `${st.name} ${st.lastName}`.trim()}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {st.email} {st.career ? `· ${st.career}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          {st.practiceName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {st.practiceStartDate} a {st.practiceEndDate}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300">
                        <div className="font-medium">{st.hospital || 'Hospital'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {st.service || 'Servicio'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-1 min-w-[100px]">
                          <div className="flex items-center gap-1 font-bold text-xs">
                            <span className={(st.horas_cumplidas || 0) >= (st.horas_asignadas || 120) ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-blue-600 dark:text-blue-400'}>
                              {st.horas_cumplidas || 0}
                            </span>
                            <span className="text-gray-400 font-medium text-[10px]">
                              / {st.horas_asignadas || 120}h
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-2xs ${
                              isActivo
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {isActivo ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Activo</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>Pendiente</span>
                              </>
                            )}
                          </span>
                          <div className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
                            {st.docs_count !== undefined ? `${st.docs_count} / 6 docs` : 'Verificar soportes'}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {getScoreBadge(st.score)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenValidationModal(st)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5 ${
                              isActivo
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                            }`}
                            title="Verificar los 6 documentos requeridos y gestionar el aval del estudiante"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{isActivo ? 'Verificar Docs (Activo)' : 'Verificar Documentos'}</span>
                          </button>

                          <button
                            onClick={() => handleOpenEvaluation(st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer ${
                              st.score !== null && st.score !== undefined
                                ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {st.score !== null && st.score !== undefined ? (
                              <>
                                <Edit3 className="w-3 h-3 inline mr-1" /> Modificar Nota
                              </>
                            ) : (
                              <>
                                <FileEdit className="w-3 h-3 inline mr-1" /> Evaluar
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setViewingStudent(st)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            Ficha
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Estado cuando no hay práctica seleccionada */
          <div className="p-12 text-center rounded-3xl border border-dashed border-gray-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50">
            <Building2 className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <h3 className="text-base font-bold text-gray-800 dark:text-zinc-200">
              Selecciona una práctica formativa arriba
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Haz clic en cualquiera de las tarjetas de tus prácticas para consultar y evaluar exclusivamente a sus alumnos asignados.
            </p>
          </div>
        )}
      </div>

      {/* ─── Modal de Calificación Oficial (0.0 - 5.0) ─── */}
      {isEvaluatingModalOpen && selectedStudent && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-200 dark:border-zinc-800 my-8">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200 dark:border-zinc-800">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <FileEdit className="w-5 h-5 text-blue-500 inline-block" /> Evaluación
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Estudiante: <strong className="text-gray-800 dark:text-gray-200">{selectedStudent.fullName || selectedStudent.name}</strong> (C.C. {selectedStudent.cedula})
                </p>
              </div>
              <button
                onClick={() => setIsEvaluatingModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 cursor-pointer flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl mb-4 text-xs text-blue-900 dark:text-blue-200">
              <p><strong>Práctica:</strong> {selectedStudent.practiceName || currentPractice?.titulo}</p>
              <p><strong>Servicio:</strong> {selectedStudent.service} · {selectedStudent.hospital}</p>
            </div>

            {/* Desempeño del Estudiante calculado en tiempo real por los 4 ítems */}
            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50/50 dark:from-zinc-800/70 dark:to-blue-950/30 border border-gray-200 dark:border-zinc-700 rounded-2xl mb-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-0.5">
                  Desempeño del Estudiante
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {computedScore.toFixed(1)}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    / 5.0 (Promedio ponderado)
                  </span>
                </div>
              </div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm border transition-all duration-150 ${getPerformanceBadge(computedScore).className}`}
                >
                  {getPerformanceBadge(computedScore).label}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Desglose por Criterios de Evaluación (Los 4 ítems) */}
              <div>
                <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Criterios de Evaluación (1 a 5) *</span>
                  <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                    Actualizan el desempeño
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700/80">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold block mb-1.5">
                      Conocimiento Teórico:
                    </span>
                    <select
                      value={likertScores.knowledge}
                      onChange={(e) => setLikertScores({ ...likertScores, knowledge: parseInt(e.target.value, 10) })}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="1">1 - Deficiente</option>
                      <option value="2">2 - Regular</option>
                      <option value="3">3 - Bueno</option>
                      <option value="4">4 - Muy Bueno</option>
                      <option value="5">5 - Excelente</option>
                    </select>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700/80">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold block mb-1.5">
                      Habilidades Prácticas:
                    </span>
                    <select
                      value={likertScores.skills}
                      onChange={(e) => setLikertScores({ ...likertScores, skills: parseInt(e.target.value, 10) })}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="1">1 - Deficiente</option>
                      <option value="2">2 - Regular</option>
                      <option value="3">3 - Bueno</option>
                      <option value="4">4 - Muy Bueno</option>
                      <option value="5">5 - Excelente</option>
                    </select>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700/80">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold block mb-1.5">
                      Actitud y Ética:
                    </span>
                    <select
                      value={likertScores.attitude}
                      onChange={(e) => setLikertScores({ ...likertScores, attitude: parseInt(e.target.value, 10) })}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="1">1 - Deficiente</option>
                      <option value="2">2 - Regular</option>
                      <option value="3">3 - Bueno</option>
                      <option value="4">4 - Muy Bueno</option>
                      <option value="5">5 - Excelente</option>
                    </select>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700/80">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold block mb-1.5">
                      Comunicación Clínica:
                    </span>
                    <select
                      value={likertScores.communication}
                      onChange={(e) => setLikertScores({ ...likertScores, communication: parseInt(e.target.value, 10) })}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="1">1 - Deficiente</option>
                      <option value="2">2 - Regular</option>
                      <option value="3">3 - Bueno</option>
                      <option value="4">4 - Muy Bueno</option>
                      <option value="5">5 - Excelente</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Retroalimentación Textual */}
              <div>
                <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-1">
                  Retroalimentación para el Estudiante *
                </label>
                <textarea
                  rows="3"
                  placeholder="Detalla las fortalezas, aspectos a mejorar y concepto formativo..."
                  value={evaluationFeedback}
                  onChange={(e) => setEvaluationFeedback(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm placeholder-gray-400 dark:placeholder-zinc-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEvaluatingModalOpen(false)}
                className="px-4 py-2.5 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingEvaluation}
                onClick={handleSaveEvaluation}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">{isSavingEvaluation ? 'Guardando...' : <><Save className="w-3.5 h-3.5" /> Guardar Evaluación</>}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Modal Profesional de Ficha Integral del Estudiante ─── */}
      <StudentFichaModal
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        student={viewingStudent}
        practiceInfo={currentPractice || {}}
        role="docent"
        onPrimaryAction={(st) => {
          handleOpenEvaluation(st);
        }}
        primaryActionLabel="Evaluar Estudiante"
        onValidateAction={(st) => {
          handleOpenValidationModal(st);
        }}
      />

      {/* ─── Modal Profesional de Verificación Documental y Aval Docente ─── */}
      {isValidatingModalOpen && validatingStudent && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[92vh] flex flex-col">
            {/* Cabecera del Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    Verificación Documental y Aval Docente
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Estudiante: <strong className="text-gray-800 dark:text-gray-200">{validatingStudent.fullName || `${validatingStudent.name} ${validatingStudent.lastName}`.trim()}</strong> (C.C. {validatingStudent.cedula})
                    {validatingStudent.career ? ` · ${validatingStudent.career}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsValidatingModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido con Scroll */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Tarjeta de Resumen de Estado */}
              {(() => {
                const docFields = [
                  { key: 'hoja_vida_digital', name: 'Hoja de Vida Digital', desc: 'Formato institucional o normalizado en PDF', loaded: Boolean(validatingStudent.has_cv), icon: FileText },
                  { key: 'seguridad_social_eps', name: 'Seguridad Social (EPS)', desc: 'Certificado de afiliación vigente a EPS', loaded: Boolean(validatingStudent.has_eps), icon: ShieldCheck },
                  { key: 'riesgos_profesionales_arl', name: 'Riesgos Laborales (ARL)', desc: 'Certificado de afiliación vigente a ARL', loaded: Boolean(validatingStudent.has_arl), icon: ShieldCheck },
                  { key: 'copia_documento_identidad', name: 'Documento de Identidad', desc: 'Copia legible del documento de identidad', loaded: Boolean(validatingStudent.has_id), icon: FileCheck },
                  { key: 'copia_carnet_estudiantil', name: 'Carnet Estudiantil', desc: 'Copia legible del carnet vigente de la UPTC', loaded: Boolean(validatingStudent.has_carnet), icon: GraduationCap },
                  { key: 'carnet_vacunas', name: 'Carnet de Vacunas', desc: 'Esquema completo según requerimientos de salud', loaded: Boolean(validatingStudent.has_vaccines), icon: FileCheck },
                ];
                const uploadedCount = docFields.filter((d) => d.loaded).length;
                const isActivo = validatingStudent.estado === 'Activo' || validatingStudent.estado_asignacion === 'Activo';
                const token =
                  localStorage.getItem('authToken') ||
                  sessionStorage.getItem('authToken') ||
                  localStorage.getItem('token') ||
                  sessionStorage.getItem('token') ||
                  '';

                return (
                  <>
                    <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-gray-200/80 dark:border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                          Estado Actual de la Vinculación
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${
                              isActivo
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {isActivo ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Activo (Aval Otorgado)</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Pendiente de Validación</span>
                              </>
                            )}
                          </span>
                          <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300">
                            {uploadedCount} de 6 documentos cargados
                          </span>
                        </div>
                      </div>

                      <div className="w-full sm:w-auto text-left sm:text-right">
                        <div className="text-xs text-gray-500 dark:text-zinc-400">Progreso Documental</div>
                        <div className="text-sm font-black text-gray-900 dark:text-white">
                          {Math.round((uploadedCount / 6) * 100)}% Completado
                        </div>
                      </div>
                    </div>

                    {/* Mensaje de recomendación */}
                    {uploadedCount < 6 ? (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                          El estudiante no ha completado la totalidad de los 6 documentos de práctica. Si los documentos presentados no son conformes, puedes mantenerlo o marcarlo como <strong>Pendiente</strong>.
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          ¡Todos los 6 documentos han sido cargados! Examina cada archivo y pulsa <strong>Dar Aval (Marcar como Activo)</strong> para certificar su conformidad.
                        </span>
                      </div>
                    )}

                    {/* Grid de los 6 documentos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {docFields.map((doc) => {
                        const IconComponent = doc.icon;
                        const viewUrl = `${API_BASE_URL}/api/student/view/${validatingStudent.cedula}/${doc.key}?view=true${token ? `&token=${encodeURIComponent(token)}` : ''}`;
                        const downloadUrl = `${API_BASE_URL}/api/student/download/${validatingStudent.cedula}/${doc.key}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

                        return (
                          <div
                            key={doc.key}
                            className={`p-3.5 rounded-xl border transition-all ${
                              doc.loaded
                                ? 'bg-white dark:bg-zinc-800/80 border-gray-200 dark:border-zinc-700 shadow-2xs'
                                : 'bg-gray-50/70 dark:bg-zinc-800/30 border-gray-200/60 dark:border-zinc-800 text-gray-400 opacity-80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    doc.loaded
                                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                      : 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  <IconComponent className="w-4 h-4" />
                                </div>
                                <div className="font-bold text-xs text-gray-900 dark:text-white leading-tight">
                                  {doc.name}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                  doc.loaded
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                                }`}
                              >
                                {doc.loaded ? 'Cargado' : 'Sin cargar'}
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-500 dark:text-zinc-400 mb-3 line-clamp-1">
                              {doc.desc}
                            </p>

                            <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-zinc-700/60">
                              {doc.loaded ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => window.open(viewUrl, '_blank')}
                                    className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                                    title="Previsualizar PDF en nueva pestaña"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Ver PDF</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.open(downloadUrl, '_blank')}
                                    className="py-1.5 px-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-200 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                                    title="Descargar archivo PDF"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Descargar</span>
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic py-1">
                                  Archivo no adjuntado por el estudiante
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Pie de Acciones del Modal */}
            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsValidatingModalOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                disabled={isValidatingLoading}
                onClick={() => handleUpdateStudentValidation('Pendiente')}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold rounded-xl text-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Marcar como Pendiente</span>
              </button>

              <button
                type="button"
                disabled={isValidatingLoading}
                onClick={() => handleUpdateStudentValidation('Activo')}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isValidatingLoading ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Dar Aval (Marcar como Activo)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DocentStudentManagement;