// ============================================================
// FRONT/src/utils/evaluationRubric.js
// Catálogo Oficial de los 25 Criterios de Evaluación y Escala de Rúbrica UPTC
// ============================================================

export const RUBRIC_SCALE = [
  {
    key: "siempre",
    value: 0.5,
    label: "Siempre",
    badgeLabel: "Siempre (0.5)",
    short: "0.5",
    desc: "Cumple de forma integral, constante y con dominio técnico",
    color: "bg-emerald-500 text-white border-emerald-600",
    activeClass: "bg-emerald-600 text-white border-emerald-700 shadow-sm",
    btnColor: "hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "casi_siempre",
    value: 0.4,
    label: "Casi siempre",
    badgeLabel: "Casi siempre (0.4)",
    short: "0.4",
    desc: "Cumple con alta solvencia en la gran mayoría de las ocasiones",
    color: "bg-blue-500 text-white border-blue-600",
    activeClass: "bg-blue-600 text-white border-blue-700 shadow-sm",
    btnColor: "hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  },
  {
    key: "en_ocasiones",
    value: 0.3,
    label: "En ocasiones",
    badgeLabel: "En ocasiones (0.3)",
    short: "0.3",
    desc: "Cumple de forma intermitente o requiere supervisión puntual",
    color: "bg-amber-500 text-white border-amber-600",
    activeClass: "bg-amber-600 text-white border-amber-700 shadow-sm",
    btnColor: "hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  },
  {
    key: "rara_vez",
    value: 0.2,
    label: "Rara vez",
    badgeLabel: "Rara vez (0.2)",
    short: "0.2",
    desc: "Evidencia fallas frecuentes o requiere supervisión constante",
    color: "bg-orange-500 text-white border-orange-600",
    activeClass: "bg-orange-600 text-white border-orange-700 shadow-sm",
    btnColor: "hover:bg-orange-50 dark:hover:bg-orange-950/40 text-orange-700 dark:text-orange-300",
  },
  {
    key: "no_cumple",
    value: 0.1,
    label: "No cumple",
    badgeLabel: "No cumple (0.1)",
    short: "0.1",
    desc: "No evidencia la competencia o incurre en omisión crítica",
    color: "bg-rose-500 text-white border-rose-600",
    activeClass: "bg-rose-600 text-white border-rose-700 shadow-sm",
    btnColor: "hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300",
  },
];

export const RUBRIC_SCALE_MAP = {
  siempre: 0.5,
  casi_siempre: 0.4,
  en_ocasiones: 0.3,
  rara_vez: 0.2,
  no_cumple: 0.1,
};

export const RUBRIC_CATEGORIES = [
  {
    id: 1,
    nombre: "Competencias Clínicas, Procedimentales y Técnicas",
    shortName: "Competencias Clínicas",
    color: "blue",
    iconName: "Stethoscope",
  },
  {
    id: 2,
    nombre: "Comunicación y Relación con el Usuario",
    shortName: "Comunicación y Usuario",
    color: "emerald",
    iconName: "MessageCircle",
  },
  {
    id: 3,
    nombre: "Registro Clínico, Aspectos Legales y Éticos",
    shortName: "Registro y Bioética",
    color: "purple",
    iconName: "FileCheck",
  },
  {
    id: 4,
    nombre: "Trabajo Interdisciplinario y Seguridad del Paciente",
    shortName: "Trabajo en Equipo y Seguridad",
    color: "amber",
    iconName: "ShieldAlert",
  },
  {
    id: 5,
    nombre: "Profesionalismo, Actitud y Liderazgo",
    shortName: "Profesionalismo y Actitud",
    color: "rose",
    iconName: "Award",
  },
  {
    id: 6,
    nombre: "Aprendizaje Continuo y Salud Pública",
    shortName: "Evidencia y Salud Pública",
    color: "indigo",
    iconName: "BookOpen",
  },
];

export const RUBRIC_CRITERIA = [
  // 1. Competencias Clínicas, Procedimentales y Técnicas (7)
  {
    id: "c1",
    numero: 1,
    categoriaId: 1,
    categoriaNombre: "Competencias Clínicas, Procedimentales y Técnicas",
    nombre: "Anamnesis y entrevista clínica",
    descripcion:
      "Estructura la recolección de datos, antecedentes y motivo de consulta de forma completa, fluida y con técnicas de interrogatorio pertinentes según el área (médica, psicológica o de enfermería).",
  },
  {
    id: "c2",
    numero: 2,
    categoriaId: 1,
    categoriaNombre: "Competencias Clínicas, Procedimentales y Técnicas",
    nombre: "Exploración física o psicodiagnóstica",
    descripcion:
      "Ejecuta la técnica de exploración, valoración por patrones/sistemas o aplicación de pruebas psicométricas con destreza motriz, orden lógico y respeto por el pudor del usuario.",
  },
  {
    id: "c3",
    numero: 3,
    categoriaId: 1,
    categoriaNombre: "Competencias Clínicas, Procedimentales y Técnicas",
    nombre: "Juicio clínico y razonamiento diagnóstico",
    descripcion:
      "Integra signos, síntomas, factores psicosociales y paraclínicos para formular hipótesis diagnósticas o diagnósticos de enfermería/psicológicos fundamentados.",
  },
  {
    id: "c4",
    numero: 4,
    categoriaId: 1,
    categoriaNombre: "Competencias Clínicas, Procedimentales y Técnicas",
    nombre: "Plan terapéutico y de intervención",
    descripcion:
      "Diseña esquemas de manejo, planes de cuidado o intervenciones psicoterapéuticas basadas en guías de práctica clínica y ajustadas a la realidad del paciente.",
  },
  {
    id: "c5",
    numero: 5,
    categoriaId: 1,
    categoriaNombre: "Competencias Clínicas, Procedimentales y Técnicas",
    nombre: "Asepsia, bioseguridad y control de infecciones",
    descripcion:
      "Cumple con la técnica correcta de lavado de manos, uso de equipo de protección personal (EPP) y manipulación de material estéril o cortopunzante.",
  },
  {
    id: "c6",
    numero: 6,
    categoriaId: 1,
    categoriaNombre: "Competencias Clínicas, Procedimentales y Técnicas",
    nombre: "Manejo seguro de medicamentos e intervenciones invasivas",
    descripcion:
      "Aplica las reglas de seguridad (verificación de paciente, dosis, vía, horario, fármaco), vigila reacciones adversas o monitoriza efectos secundarios.",
  },
  {
    id: "c7",
    numero: 7,
    categoriaId: 1,
    categoriaNombre: "Competencias Clínicas, Procedimentales y Técnicas",
    nombre: "Respuesta ante urgencias o descompensaciones",
    descripcion:
      "Identifica oportunamente signos de alarma, descompensación orgánica o crisis emocional/psiquiátrica, activando la cadena de llamado y primeros auxilios/soporte vital correspondiente.",
  },

  // 2. Comunicación y Relación con el Usuario (4)
  {
    id: "c8",
    numero: 8,
    categoriaId: 2,
    categoriaNombre: "Comunicación y Relación con el Usuario",
    nombre: "Comunicación asertiva y empatía con el paciente/usuario",
    descripcion:
      "Emplea un lenguaje comprensible, libre de tecnicismos innecesarios, valida el estado emocional del paciente y practica la escucha activa.",
  },
  {
    id: "c9",
    numero: 9,
    categoriaId: 2,
    categoriaNombre: "Comunicación y Relación con el Usuario",
    nombre: "Comunicación y orientación a la familia o cuidadores",
    descripcion:
      "Brinda información clara sobre cuidados generales, evolución y dudas de los acompañantes, respetando la autonomía y límites del paciente.",
  },
  {
    id: "c10",
    numero: 10,
    categoriaId: 2,
    categoriaNombre: "Comunicación y Relación con el Usuario",
    nombre: "Consentimiento informado y educación en salud",
    descripcion:
      "Explica riesgos, beneficios y alternativas antes de cualquier procedimiento o sesión, además de educar en autocuidado, adherencia al tratamiento o prevención.",
  },
  {
    id: "c11",
    numero: 11,
    categoriaId: 2,
    categoriaNombre: "Comunicación y Relación con el Usuario",
    nombre: "Sensibilidad cultural y no discriminación",
    descripcion:
      "Adapta el trato y las decisiones asistenciales al contexto sociocultural, creencias, identidad de género y situación de vulnerabilidad del usuario.",
  },

  // 3. Registro Clínico, Aspectos Legales y Éticos (3)
  {
    id: "c12",
    numero: 12,
    categoriaId: 3,
    categoriaNombre: "Registro Clínico, Aspectos Legales y Éticos",
    nombre: "Diligenciamiento de la historia clínica",
    descripcion:
      "Redacta notas clínicas (evoluciones, notas de enfermería, informes psicológicos) de forma clara, oportuna, veraz y conforme a la normativa legal vigente (ej. uso de formato SOAP).",
  },
  {
    id: "c13",
    numero: 13,
    categoriaId: 3,
    categoriaNombre: "Registro Clínico, Aspectos Legales y Éticos",
    nombre: "Confidencialidad y manejo de datos sensibles",
    descripcion:
      "Custodia el secreto profesional, evita discutir casos en espacios públicos y gestiona la información clínica conforme a la protección de datos.",
  },
  {
    id: "c14",
    numero: 14,
    categoriaId: 3,
    categoriaNombre: "Registro Clínico, Aspectos Legales y Éticos",
    nombre: "Conducta bioética",
    descripcion:
      "Demuestra apego a los principios de beneficencia, no maleficencia, justicia y autonomía en dilemas clínicos y manejo del dolor o sufrimiento.",
  },

  // 4. Trabajo Interdisciplinario y Seguridad del Paciente (3)
  {
    id: "c15",
    numero: 15,
    categoriaId: 4,
    categoriaNombre: "Trabajo Interdisciplinario y Seguridad del Paciente",
    nombre: "Trabajo en equipo e interconsulta",
    descripcion:
      "Se coordina de forma efectiva con médicos, enfermeros, psicólogos, terapeutas y trabajo social, solicitando y respondiendo interconsultas con pertinencia.",
  },
  {
    id: "c16",
    numero: 16,
    categoriaId: 4,
    categoriaNombre: "Trabajo Interdisciplinario y Seguridad del Paciente",
    nombre: "Entrega de turno y transferencia de pacientes",
    descripcion:
      "Realiza traspasos de guardia estructurados (utilizando técnicas como SBAR/SAER), transmitiendo pendientes críticos y novedades sin omisiones.",
  },
  {
    id: "c17",
    numero: 17,
    categoriaId: 4,
    categoriaNombre: "Trabajo Interdisciplinario y Seguridad del Paciente",
    nombre: "Cultura de seguridad del paciente",
    descripcion:
      "Identifica, reporta y previene cuasifallas, eventos adversos, riesgo de caídas, úlceras por presión o errores de identificación.",
  },

  // 5. Profesionalismo, Actitud y Liderazgo (5)
  {
    id: "c18",
    numero: 18,
    categoriaId: 5,
    categoriaNombre: "Profesionalismo, Actitud y Liderazgo",
    nombre: "Puntualidad y asistencia",
    descripcion:
      "Cumple rigurosamente los horarios de guardia, pase de visita, talleres y entregas de turno programadas.",
  },
  {
    id: "c19",
    numero: 19,
    categoriaId: 5,
    categoriaNombre: "Profesionalismo, Actitud y Liderazgo",
    nombre: "Presentación personal y porte institucional",
    descripcion:
      "Mantiene el uniforme institucional limpio, credencial visible y apego a las normas del servicio (cabello recogido, uñas cortas, accesorios discretos).",
  },
  {
    id: "c20",
    numero: 20,
    categoriaId: 5,
    categoriaNombre: "Profesionalismo, Actitud y Liderazgo",
    nombre: "Reconocimiento de las propias limitaciones",
    descripcion:
      "Conoce el alcance de su nivel formativo y pide supervisión o ayuda antes de ejecutar procedimientos o tomar decisiones dudosas.",
  },
  {
    id: "c21",
    numero: 21,
    categoriaId: 5,
    categoriaNombre: "Profesionalismo, Actitud y Liderazgo",
    nombre: "Receptividad al feedback y autocrítica",
    descripcion:
      "Acepta observaciones del docente o personal de planta de forma constructiva e implementa las correcciones en su práctica diaria.",
  },
  {
    id: "c22",
    numero: 22,
    categoriaId: 5,
    categoriaNombre: "Profesionalismo, Actitud y Liderazgo",
    nombre: "Gestión del estrés e inteligencia emocional",
    descripcion:
      "Mantiene el autocontrol, la calma y la compostura en situaciones de alta demanda asistencial o conflicto.",
  },

  // 6. Aprendizaje Continuo y Salud Pública (3)
  {
    id: "c23",
    numero: 23,
    categoriaId: 6,
    categoriaNombre: "Aprendizaje Continuo y Salud Pública",
    nombre: "Sustentación bibliográfica y práctica basada en la evidencia",
    descripcion:
      "Justifica sus decisiones clínicas citando literatura científica actualizada, guías institucionales o metaanálisis durante el pase de visita o revista médica.",
  },
  {
    id: "c24",
    numero: 24,
    categoriaId: 6,
    categoriaNombre: "Aprendizaje Continuo y Salud Pública",
    nombre: "Promoción de la salud y prevención de la enfermedad",
    descripcion:
      "Diseña e implementa actividades de fomento de estilos de vida saludables en el ámbito individual o comunitario.",
  },
  {
    id: "c25",
    numero: 25,
    categoriaId: 6,
    categoriaNombre: "Aprendizaje Continuo y Salud Pública",
    nombre: "Gestión y optimización de recursos",
    descripcion:
      "Utiliza insumos, material descartable, pruebas diagnósticas y tiempos de atención con criterio de costo-efectividad y sostenibilidad institucional.",
  },
];

export const RUBRIC_CRITERIA_MAP = RUBRIC_CRITERIA.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

export const DEFAULT_RUBRIC_CRITERIA_IDS = [
  "c1",  // Anamnesis
  "c2",  // Exploración física
  "c3",  // Juicio clínico
  "c5",  // Asepsia y bioseguridad
  "c8",  // Comunicación y empatía
  "c10", // Consentimiento informado
  "c12", // Diligenciamiento historia clínica
  "c15", // Trabajo en equipo
  "c18", // Puntualidad y asistencia
  "c21", // Receptividad al feedback
];

/**
 * Normaliza y obtiene la lista de criterios seleccionados de una práctica.
 * Si no tiene rúbrica configurada aún, retorna los 10 criterios por defecto.
 */
export function parseRubricCriteriaIds(rubricaInput) {
  if (!rubricaInput) return DEFAULT_RUBRIC_CRITERIA_IDS;
  if (Array.isArray(rubricaInput)) {
    const valid = rubricaInput.filter((id) => RUBRIC_CRITERIA_MAP[id]);
    return valid.length === 10 ? valid : DEFAULT_RUBRIC_CRITERIA_IDS;
  }
  if (typeof rubricaInput === "string") {
    try {
      const parsed = JSON.parse(rubricaInput);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((id) => RUBRIC_CRITERIA_MAP[id]);
        return valid.length === 10 ? valid : DEFAULT_RUBRIC_CRITERIA_IDS;
      }
    } catch (e) {
      // Intenta separar por comas
      const parts = rubricaInput.split(",").map((s) => s.trim());
      const valid = parts.filter((id) => RUBRIC_CRITERIA_MAP[id]);
      if (valid.length === 10) return valid;
    }
  }
  return DEFAULT_RUBRIC_CRITERIA_IDS;
}

/**
 * Calcula la calificación numérica redondeada (0.0 a 5.0) a partir de los puntajes de los 10 criterios.
 */
export function calculateRubricTotal(scoresMap, activeCriteriaIds = null) {
  if (!scoresMap || typeof scoresMap !== "object") return 0.0;
  const ids = Array.isArray(activeCriteriaIds) && activeCriteriaIds.length === 10
    ? activeCriteriaIds
    : Object.keys(scoresMap);

  let sum = 0;
  for (const id of ids) {
    let val = scoresMap[id];
    if (typeof val === "string") {
      val = RUBRIC_SCALE_MAP[val] !== undefined ? RUBRIC_SCALE_MAP[val] : parseFloat(val);
    }
    if (typeof val === "number" && !isNaN(val)) {
      sum += Math.min(Math.max(val, 0.1), 0.5);
    } else {
      sum += 0.1;
    }
  }
  return Math.round(sum * 10) / 10;
}

/**
 * Obtiene el concepto formativo a partir de la nota final
 */
export function getPerformanceConcept(score) {
  const num = Number(score) || 0;
  if (num >= 4.6) return { label: "Excelente", color: "text-emerald-700 bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" };
  if (num >= 4.0) return { label: "Sobresaliente", color: "text-blue-700 bg-blue-100 border-blue-300 dark:bg-blue-950 dark:text-blue-300" };
  if (num >= 3.0) return { label: "Aprobado / Favorable", color: "text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-950 dark:text-amber-300" };
  return { label: "Requiere Refuerzo (Insuficiente)", color: "text-rose-700 bg-rose-100 border-rose-300 dark:bg-rose-950 dark:text-rose-300" };
}
