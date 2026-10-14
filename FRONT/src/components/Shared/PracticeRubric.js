// ============================================================
// FRONT/src/components/Shared/PracticeRubric.js
// Componentes de Rúbrica Oficial UPTC:
// 1. RubricCriteriaSelector: Selección de 10 de 25 criterios para crear/editar práctica
// 2. RubricCriteriaViewer: Visualización oficial de los 10 criterios para todos los implicados
// 3. RubricEvaluationInput: Formulario de calificación criterio por criterio (0.1 a 0.5)
// ============================================================
import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Lock,
  Sparkles,
  HelpCircle,
  Award,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  MessageCircle,
  FileCheck,
  ShieldAlert,
  BookOpen,
  Info,
  Check,
  Zap,
} from "lucide-react";
import {
  RUBRIC_SCALE,
  RUBRIC_CATEGORIES,
  RUBRIC_CRITERIA,
  RUBRIC_CRITERIA_MAP,
  DEFAULT_RUBRIC_CRITERIA_IDS,
  parseRubricCriteriaIds,
  calculateRubricTotal,
  getPerformanceConcept,
} from "../../utils/evaluationRubric";

const CATEGORY_ICONS = {
  1: Stethoscope,
  2: MessageCircle,
  3: FileCheck,
  4: ShieldAlert,
  5: Award,
  6: BookOpen,
};

// ────────────────────────────────────────────────────────────
// 1. SELECTOR DE CRITERIOS (Para Crear / Editar Práctica)
// ────────────────────────────────────────────────────────────
export const RubricCriteriaSelector = ({
  selectedCriteria,
  selectedCriteriaIds,
  onChange,
  isLocked = false,
  lockReason = "La práctica ya se encuentra iniciada o finalizada; los 10 criterios de evaluación no pueden modificarse.",
}) => {
  const [openCategories, setOpenCategories] = useState({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  });

  // Aceptar tanto selectedCriteriaIds como selectedCriteria para máxima robustez
  const rawList = selectedCriteriaIds !== undefined ? selectedCriteriaIds : selectedCriteria;
  const currentList = useMemo(() => {
    if (!rawList) return [];
    if (Array.isArray(rawList)) return rawList.filter(Boolean);
    if (typeof rawList === "string") {
      try {
        const parsed = JSON.parse(rawList);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {
        return rawList.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }, [rawList]);

  const selectedSet = useMemo(() => new Set(currentList), [currentList]);
  const count = currentList.length;
  const isExact10 = count === 10;

  const toggleCategory = (catId) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleToggleCriterion = (criterionId) => {
    if (isLocked) return;

    if (selectedSet.has(criterionId)) {
      const next = currentList.filter((id) => id !== criterionId);
      onChange?.(next);
    } else {
      if (count >= 10) {
        alert("Ya has seleccionado los 10 criterios máximos permitidos. Si deseas agregar este criterio, primero desmarca uno de los seleccionados.");
        return;
      }
      onChange?.([...currentList, criterionId]);
    }
  };

  const handleLoadDefaults = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isLocked) return;
    onChange?.([...DEFAULT_RUBRIC_CRITERIA_IDS]);
  };

  const handleClear = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isLocked) return;
    onChange?.([]);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-blue-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-4 sm:p-5 shadow-xs">
      {/* Encabezado y Estado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Rúbrica de Evaluación Institucional (10 Criterios)
            </h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5">
            Selecciona exactamente <strong>10 criterios</strong> de los 25 disponibles. Sobre estos 10 se evaluará a los estudiantes (Escala: Siempre 0.5, Casi siempre 0.4, En ocasiones 0.3, Rara vez 0.2, No cumple 0.1 = Nota máx. 5.0).
          </p>
        </div>

        {/* Contador y Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 shadow-2xs ${
              isExact10
                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                : count < 10
                ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
            }`}
          >
            {isExact10 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>10 / 10 Criterios Completos</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>
                  {count} / 10 Seleccionados ({10 - count > 0 ? `Faltan ${10 - count}` : `Sobran ${count - 10}`})
                </span>
              </>
            )}
          </span>

          {!isLocked && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLoadDefaults}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition cursor-pointer flex items-center gap-1"
                title="Cargar 10 criterios sugeridos automáticamente"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Cargar Sugeridos
              </button>
              {count > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-rose-600 transition cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Aviso si la práctica ya inició y está bloqueada */}
      {isLocked && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Rúbrica Bloqueada:</strong> {lockReason}
          </span>
        </div>
      )}

      {/* Escala de Calificación Informativa */}
      <div className="p-3 rounded-xl bg-white dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 block mb-1.5">
          Escala de Evaluación por Criterio (Suma = Calificación Oficial 0.0 - 5.0):
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {RUBRIC_SCALE.map((lvl) => (
            <div
              key={lvl.key}
              className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-gray-800 dark:text-zinc-200">{lvl.label}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-mono">
                  +{lvl.short}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 leading-tight">
                {lvl.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Listado de las 6 Categorías con sus Criterios */}
      <div className="space-y-3">
        {RUBRIC_CATEGORIES.map((cat) => {
          const catCriteria = RUBRIC_CRITERIA.filter((c) => c.categoriaId === cat.id);
          const selectedInCat = catCriteria.filter((c) => selectedSet.has(c.id)).length;
          const isOpen = Boolean(openCategories[cat.id]);
          const Icon = CATEGORY_ICONS[cat.id] || Stethoscope;

          return (
            <div
              key={cat.id}
              className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 overflow-hidden shadow-2xs"
            >
              {/* Header de la Categoría */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="w-full p-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-xs font-black text-gray-900 dark:text-white block truncate">
                      {cat.id}. {cat.nombre}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                      {catCriteria.length} criterios disponibles · {selectedInCat} seleccionado{selectedInCat === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedInCat > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      {selectedInCat}
                    </span>
                  )}
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Items de la Categoría */}
              {isOpen && (
                <div className="p-3 pt-0 space-y-2 border-t border-gray-100 dark:border-zinc-800">
                  {catCriteria.map((c) => {
                    const isChecked = selectedSet.has(c.id);
                    const disabled = isLocked || (!isChecked && count >= 10);

                    return (
                      <div
                        key={c.id}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!disabled) {
                            handleToggleCriterion(c.id);
                          }
                        }}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all select-none cursor-pointer ${
                          isChecked
                            ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-2xs"
                            : disabled
                            ? "bg-gray-50/50 dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800 opacity-60 cursor-not-allowed"
                            : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={disabled}
                          readOnly
                          tabIndex={-1}
                          className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 pointer-events-none disabled:cursor-not-allowed"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-gray-900 dark:text-white">
                              {c.nombre}
                            </span>
                            {isChecked && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0">
                                <Check className="w-3 h-3 text-blue-600" /> Seleccionado
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                            {c.descripcion}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumen de los 10 Criterios Seleccionados */}
      <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            Criterios que Conforman la Rúbrica de Esta Práctica ({count}/10):
          </span>
          <span className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold">
            {isExact10 ? "Listo para evaluar" : "Faltan criterios por elegir"}
          </span>
        </div>

        {count === 0 ? (
          <p className="text-xs text-gray-500 italic">
            No has seleccionado ningún criterio aún. Puedes elegir 10 manualmente o presionar "Cargar Sugeridos".
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {currentList.map((id, idx) => {
              const crit = RUBRIC_CRITERIA_MAP[id];
              if (!crit) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 border border-blue-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 shadow-3xs"
                >
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate max-w-[200px]">{crit.nombre}</span>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCriterion(id);
                      }}
                      className="text-gray-400 hover:text-rose-600 cursor-pointer ml-0.5"
                      title="Quitar"
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// 2. VISUALIZADOR DE RÚBRICA (Para Consultar Ficha de la Práctica)
// ────────────────────────────────────────────────────────────
export const RubricCriteriaViewer = ({
  rubricaCriterios,
  criteriaIds,
  variant = "detailed", // "detailed" | "card" | "modal"
  title = "Rúbrica de Evaluación de la Práctica (10 Criterios Oficiales)",
  subtitle = null,
}) => {
  const input = criteriaIds !== undefined ? criteriaIds : rubricaCriterios;
  const activeIds = useMemo(() => parseRubricCriteriaIds(input), [input]);
  const criteriaList = useMemo(() => activeIds.map((id) => RUBRIC_CRITERIA_MAP[id]).filter(Boolean), [activeIds]);

  if (criteriaList.length === 0) return null;

  if (variant === "card") {
    return (
      <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-black text-purple-900 dark:text-purple-300 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
            <Award className="w-3.5 h-3.5 text-purple-600" /> Rúbrica Oficial (10 Criterios)
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-200/80 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200">
            Escala 0.1 a 0.5
          </span>
        </div>
        <p className="text-[11px] text-gray-600 dark:text-zinc-400 line-clamp-2">
          {criteriaList.map((c) => c.nombre).join(" · ")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 via-blue-50/40 to-slate-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 border border-indigo-200/80 dark:border-zinc-800 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/60 dark:border-zinc-800 pb-3">
        <div>
          <h4 className="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{title}</span>
          </h4>
          <p className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5">
            Criterios formativos oficiales sobre los cuales se califica a todos los estudiantes vinculados a esta rotación.
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-600 text-white shadow-2xs self-start sm:self-auto">
          10 Criterios · Nota Máxima 5.0
        </span>
      </div>

      {/* Escala de Calificación */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        {RUBRIC_SCALE.map((lvl) => (
          <div
            key={lvl.key}
            className="p-2 rounded-xl bg-white dark:bg-zinc-850 border border-indigo-100 dark:border-zinc-800 text-center shadow-3xs"
          >
            <span className="text-[11px] font-black text-gray-800 dark:text-zinc-200 block">
              {lvl.label}
            </span>
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
              +{lvl.short} pts
            </span>
          </div>
        ))}
      </div>

      {/* Lista de los 10 Criterios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {criteriaList.map((c, index) => (
          <div
            key={c.id}
            className="p-3 rounded-xl bg-white dark:bg-zinc-850 border border-gray-200/90 dark:border-zinc-800 shadow-3xs flex items-start gap-2.5"
          >
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-gray-900 dark:text-white block leading-snug">
                {c.nombre}
              </span>
              <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 block mb-0.5">
                {c.categoriaNombre}
              </span>
              <p className="text-[11px] text-gray-600 dark:text-zinc-400 leading-relaxed">
                {c.descripcion}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 rounded-xl bg-indigo-100/50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
        <Info className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span>
          Esta rúbrica es de conocimiento público para todos los implicados (Administrador, Docente, Auditor y Estudiantes) garantizando transparencia y evaluación formativa estandarizada.
        </span>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// 3. FORMULARIO DE EVALUACIÓN (Para Calificar Estudiante)
// ────────────────────────────────────────────────────────────
export const RubricEvaluationInput = ({
  rubricaCriterios,
  scores = {},
  onChange,
  auditorReport = null,
  onApplyAuditorReport = null,
  isAuditor = false,
  readOnly = false,
}) => {
  const activeIds = useMemo(() => parseRubricCriteriaIds(rubricaCriterios), [rubricaCriterios]);
  const criteriaList = useMemo(() => activeIds.map((id) => RUBRIC_CRITERIA_MAP[id]).filter(Boolean), [activeIds]);

  const currentScore = useMemo(() => calculateRubricTotal(scores, activeIds), [scores, activeIds]);
  const concept = useMemo(() => getPerformanceConcept(currentScore), [currentScore]);

  const handleSelectScore = (criterionId, scaleValue) => {
    if (readOnly) return;
    const next = { ...scores, [criterionId]: scaleValue };
    onChange?.(next);
  };

  return (
    <div className="space-y-4">
      {/* Banner de Calificación Dinámica */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-transparent border border-blue-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 block">
            {isAuditor ? "Nota Sugerida del Auditor" : "Calificación Oficial del Docente"}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {currentScore.toFixed(1)}
            </span>
            <span className="text-sm font-semibold text-gray-500 dark:text-zinc-400">
              / 5.0 (Suma de los 10 criterios)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${concept.color}`}>
            {concept.label}
          </span>
        </div>
      </div>

      {/* Sugerencia del Auditor Clínico (Solo visible para el Docente Tutor) */}
      {!isAuditor && auditorReport && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Concepto Emitido por el Auditor Clínico (Privado para el Docente):
              </span>
              <p className="text-xs font-semibold mt-0.5">
                Nota sugerida en sitio: <strong>{Number(auditorReport.nota_sugerida || 4.0).toFixed(1)} / 5.0</strong> ({auditorReport.concepto || "Favorable"}).
              </p>
              {auditorReport.observaciones && (
                <p className="text-xs italic text-gray-700 dark:text-zinc-300 mt-1">
                  "{auditorReport.observaciones}"
                </p>
              )}
            </div>

            {onApplyAuditorReport && (
              <button
                type="button"
                onClick={onApplyAuditorReport}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-gray-900 shadow-xs transition cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Zap className="w-3.5 h-3.5" /> Tomar Evaluación del Auditor
              </button>
            )}
          </div>
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            * El estudiante no ve esta evaluación del auditor; solo verá la nota final oficial que tú como docente decidas asignarle.
          </p>
        </div>
      )}

      {/* Formulario Criterio por Criterio */}
      <div className="space-y-3">
        {criteriaList.map((c, index) => {
          const currentVal = scores[c.id] !== undefined ? Number(scores[c.id]) : null;

          return (
            <div
              key={c.id}
              className="p-3.5 rounded-xl bg-white dark:bg-zinc-850 border border-gray-200 dark:border-zinc-800 shadow-3xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-gray-900 dark:text-white">
                      {c.nombre}
                    </h5>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                      {c.descripcion}
                    </p>
                  </div>
                </div>

                {currentVal !== null && (
                  <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono shrink-0">
                    +{currentVal.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Opciones de la Escala (Botones estilo Segmented Control) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                {RUBRIC_SCALE.map((opt) => {
                  const isSelected = currentVal === opt.value;

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={readOnly}
                      onClick={() => handleSelectScore(c.id, opt.value)}
                      className={`p-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        isSelected
                          ? opt.activeClass
                          : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-gray-400"
                      }`}
                    >
                      <span className="block">{opt.label}</span>
                      <span className="text-[10px] opacity-80 font-mono">+{opt.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RubricCriteriaSelector;
