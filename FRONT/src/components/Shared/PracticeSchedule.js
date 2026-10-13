import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Clock,
  Calendar,
  Sparkles,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sun,
  Moon,
  Info,
} from "lucide-react";

export const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const DIA_ABR = {
  Lunes: "Lun",
  Martes: "Mar",
  Miércoles: "Mié",
  Jueves: "Jue",
  Viernes: "Vie",
  Sábado: "Sáb",
  Domingo: "Dom",
};

/**
 * Calcula la diferencia en horas entre dos strings de hora "HH:mm".
 */
export const calculateHoursDiff = (inicio, fin) => {
  if (!inicio || !fin) return 0;
  try {
    const [h1, m1] = inicio.split(":").map(Number);
    const [h2, m2] = fin.split(":").map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
    const mins1 = h1 * 60 + m1;
    const mins2 = h2 * 60 + m2;
    if (mins2 <= mins1) return 0;
    const diffMins = mins2 - mins1;
    return Math.round((diffMins / 60) * 10) / 10;
  } catch (e) {
    return 0;
  }
};

/**
 * Parsea cualquier cadena de texto de horario a un mapa estructurado de días y horas.
 */
export const parseHorarioAHoras = (horarioStr) => {
  const map = {};
  if (!horarioStr || typeof horarioStr !== "string") return map;

  DIAS_SEMANA.forEach((dia) => {
    // Busca patrones como "Lunes (07:00 - 13:00)", "Lunes: 07:00 a 13:00", etc.
    const regex = new RegExp(
      `${dia}(?:[\\s\\(:–-]+(\\d{1,2}:\\d{2})\\s*(?:-|a|al|hasta|–)\\s*(\\d{1,2}:\\d{2})\\)?)?`,
      "i"
    );
    const m = horarioStr.match(regex);
    if (m) {
      map[dia] = {
        inicio: m[1] || "07:00",
        fin: m[2] || "13:00",
      };
    }
  });

  return map;
};

/**
 * Convierte un mapa de días en un string legible y estandarizado.
 */
export const formatHorarioDesdeDias = (diasMap) => {
  if (!diasMap || typeof diasMap !== "object") return "";
  return DIAS_SEMANA.filter((dia) => !!diasMap[dia])
    .map((dia) => {
      const { inicio, fin } = diasMap[dia];
      return `${dia} (${inicio || "07:00"} - ${fin || "13:00"})`;
    })
    .join(", ");
};

/**
 * Calcula las horas semanales acumuladas a partir del mapa de días.
 */
export const calculateTotalWeeklyHours = (diasMap) => {
  if (!diasMap) return 0;
  let total = 0;
  Object.values(diasMap).forEach((slot) => {
    if (slot && slot.inicio && slot.fin) {
      total += calculateHoursDiff(slot.inicio, slot.fin);
    }
  });
  return Math.round(total * 10) / 10;
};

/**
 * Formatea una hora en formato militar "HH:mm" a formato amigable "hh:mm a.m./p.m."
 */
export const formatTime12h = (timeStr) => {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? "p. m." : "a. m.";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 => 12
  const strHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${strHours}:${minutes} ${ampm}`;
};

// ─────────────────────────────────────────────────────────────
// COMPONENTE VISUALIZADOR DE HORARIOS (READ-ONLY PARA TODOS)
// ─────────────────────────────────────────────────────────────
export const PracticeScheduleViewer = ({
  horario,
  variant = "card", // "card" | "detailed" | "inline"
  title = "Horario de la Práctica",
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const parsedDays = useMemo(() => parseHorarioAHoras(horario), [horario]);
  const activeDays = useMemo(
    () => DIAS_SEMANA.filter((dia) => !!parsedDays[dia]),
    [parsedDays]
  );
  const weeklyHours = useMemo(
    () => calculateTotalWeeklyHours(parsedDays),
    [parsedDays]
  );

  if (!horario || (typeof horario === "string" && !horario.trim())) {
    if (variant === "detailed") {
      return (
        <div
          className={`p-3.5 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800 text-xs text-gray-400 dark:text-zinc-500 flex items-center gap-2 ${className}`}
        >
          <Clock className="w-4 h-4 text-gray-400" />
          <span>Horario rotacional por concertar con el tutor.</span>
        </div>
      );
    }
    return null;
  }

  // Si no se detectó ningún día con formato estructurado, mostrar texto simple
  const isCustomText = activeDays.length === 0;

  // 1. Variante "inline": una línea compacta con icono
  if (variant === "inline") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 ${className}`}
      >
        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span className="truncate">{horario}</span>
      </div>
    );
  }

  // 2. Variante "card": Ideal para tarjetas de prácticas en listados
  if (variant === "card") {
    if (isCustomText) {
      return (
        <div
          className={`p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2 shadow-2xs ${className}`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-bold text-[11px] block uppercase tracking-wider text-blue-800 dark:text-blue-300">
              Horario Programado:
            </span>
            <span className="text-xs font-medium text-gray-800 dark:text-zinc-200 line-clamp-2">
              {horario}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 shadow-2xs ${className}`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Horario ({activeDays.length} día{activeDays.length === 1 ? "" : "s"})
          </span>
          {weeklyHours > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
              {weeklyHours}h / sem
            </span>
          )}
        </div>

        {/* Chips de Días */}
        <div className="flex flex-wrap gap-1">
          {activeDays.map((dia) => {
            const slot = parsedDays[dia];
            return (
              <span
                key={dia}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-white dark:bg-zinc-900 border border-blue-200 dark:border-zinc-800 text-gray-800 dark:text-zinc-200 shadow-3xs"
                title={`${dia}: ${formatTime12h(slot.inicio)} a ${formatTime12h(slot.fin)}`}
              >
                <span className="font-sans font-bold text-blue-600 dark:text-blue-400">
                  {DIA_ABR[dia] || dia}:
                </span>
                <span>
                  {slot.inicio} - {slot.fin}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. Variante "detailed": Para modales de detalles completos
  return (
    <div
      className={`p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 shadow-xs space-y-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 dark:border-blue-900/50 pb-2.5">
        <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{title}</span>
        </h4>
        <div className="flex items-center gap-2">
          {weeklyHours > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-600 text-white shadow-xs">
              {weeklyHours} hrs semanales estimadas
            </span>
          )}
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
            {activeDays.length > 0
              ? `${activeDays.length} día(s) configurado(s)`
              : "Turnos rotativos"}
          </span>
        </div>
      </div>

      {isCustomText ? (
        <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line bg-white dark:bg-zinc-900/80 p-3 rounded-xl border border-blue-100 dark:border-zinc-800">
          {horario}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {activeDays.map((dia) => {
            const slot = parsedDays[dia];
            const hours = calculateHoursDiff(slot.inicio, slot.fin);
            return (
              <div
                key={dia}
                className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-blue-200/70 dark:border-zinc-800 shadow-2xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-blue-700 dark:text-blue-300">
                    {dia}
                  </span>
                  {hours > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                      {hours}h
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {formatTime12h(slot.inicio)} — {formatTime12h(slot.fin)}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 font-mono">
                  ({slot.inicio} - {slot.fin} militar)
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen en texto plano */}
      <div className="text-[11px] text-gray-500 dark:text-zinc-400 flex items-center gap-1.5 pt-1">
        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span>
          Visible para todos los implicados (Estudiante, Docente, Tutor, Auditor y Administrador). Solo administradores y docentes pueden modificarlo.
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPONENTE CONSTRUCTOR DE HORARIOS (ORGANIZADO PARA ADMIN Y DOCENTE)
// ─────────────────────────────────────────────────────────────
export const PracticeScheduleEditor = ({
  value = "",
  onChange,
  readOnly = false,
  className = "",
}) => {
  // Estado local estructurado de días y horas
  const [scheduleDays, setScheduleDays] = useState(() => parseHorarioAHoras(value || ""));

  // Horario común para aplicación masiva
  const [commonStartTime, setCommonStartTime] = useState("07:00");
  const [commonEndTime, setCommonEndTime] = useState("13:00");
  const [appliedFeedback, setAppliedFeedback] = useState(false);

  // Sincronizar hacia adentro si value cambia desde afuera
  useEffect(() => {
    const parsed = parseHorarioAHoras(value || "");
    const formattedCurrent = formatHorarioDesdeDias(scheduleDays);
    if (value !== formattedCurrent) {
      setScheduleDays(parsed);
    }
  }, [value]);

  // Emitir cambios hacia afuera
  const emitChanges = useCallback(
    (newMap) => {
      setScheduleDays(newMap);
      const formatted = formatHorarioDesdeDias(newMap);
      if (onChange) {
        onChange(formatted);
      }
    },
    [onChange]
  );

  // Alternar selección de un día
  const handleToggleDay = (dia) => {
    const next = { ...scheduleDays };
    if (next[dia]) {
      delete next[dia];
    } else {
      next[dia] = {
        inicio: commonStartTime || "07:00",
        fin: commonEndTime || "13:00",
      };
    }
    emitChanges(next);
  };

  // Modificar hora de inicio o fin de un día particular
  const handleTimeChange = (dia, campo, nuevoValor) => {
    const next = {
      ...scheduleDays,
      [dia]: {
        ...(scheduleDays[dia] || { inicio: "07:00", fin: "13:00" }),
        [campo]: nuevoValor,
      },
    };
    emitChanges(next);
  };

  // Presets rápidos de días
  const handleApplyPreset = (tipo) => {
    let diasTarget = [];
    if (tipo === "semana") {
      diasTarget = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    } else if (tipo === "finsemana") {
      diasTarget = ["Sábado", "Domingo"];
    } else if (tipo === "todos") {
      diasTarget = DIAS_SEMANA;
    } else if (tipo === "limpiar") {
      emitChanges({});
      return;
    }

    const next = {};
    diasTarget.forEach((dia) => {
      next[dia] = scheduleDays[dia] || {
        inicio: commonStartTime || "07:00",
        fin: commonEndTime || "13:00",
      };
    });
    emitChanges(next);
  };

  // Aplicar horario común a todos los días actualmente seleccionados
  const handleApplyCommonHoursToAll = () => {
    const activeKeys = Object.keys(scheduleDays);
    if (activeKeys.length === 0) return;

    const next = {};
    activeKeys.forEach((dia) => {
      next[dia] = {
        inicio: commonStartTime || "07:00",
        fin: commonEndTime || "13:00",
      };
    });
    emitChanges(next);

    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 2000);
  };

  // Manejar edición manual directa del texto del resumen
  const handleManualTextChange = (e) => {
    const text = e.target.value;
    if (onChange) onChange(text);
    const parsed = parseHorarioAHoras(text);
    setScheduleDays(parsed);
  };

  const selectedDaysList = useMemo(
    () => DIAS_SEMANA.filter((dia) => !!scheduleDays[dia]),
    [scheduleDays]
  );

  const weeklyHours = useMemo(
    () => calculateTotalWeeklyHours(scheduleDays),
    [scheduleDays]
  );

  if (readOnly) {
    return <PracticeScheduleViewer horario={value} variant="detailed" className={className} />;
  }

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-blue-50/90 to-indigo-50/40 dark:from-blue-950/30 dark:to-zinc-900 border border-blue-200/90 dark:border-blue-900/60 shadow-sm space-y-4 ${className}`}
    >
      {/* ─── Encabezado de la Sección de Horarios ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/70 dark:border-zinc-800 pb-3">
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Horario de la Práctica (Organizador por Días y Reloj)</span>
          </label>
          <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
            Visible para todos los implicados en la práctica · Solo editable por Administrador y Docente
          </p>
        </div>

        {selectedDaysList.length > 0 && weeklyHours > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-black shadow-xs self-start sm:self-auto">
            <span>Total semanal estimado:</span>
            <span className="font-mono text-amber-200">{weeklyHours} hrs</span>
          </div>
        )}
      </div>

      {/* ─── Paso 1: Selección de Días con Accesos Rápidos ─── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            1. Selecciona los días de rotación:
          </span>

          {/* Accesos rápidos */}
          <div className="flex flex-wrap gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => handleApplyPreset("semana")}
              className="px-2.5 py-1 rounded-lg font-bold bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              Lun a Vie
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("finsemana")}
              className="px-2.5 py-1 rounded-lg font-bold bg-white dark:bg-zinc-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-zinc-700 hover:bg-purple-50 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              Fines de Semana
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("todos")}
              className="px-2.5 py-1 rounded-lg font-bold bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-zinc-700 hover:bg-emerald-50 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              Toda la Semana
            </button>
            {selectedDaysList.length > 0 && (
              <button
                type="button"
                onClick={() => handleApplyPreset("limpiar")}
                className="px-2 py-1 rounded-lg font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Botones de Días Individuales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
          {DIAS_SEMANA.map((dia) => {
            const isSelected = !!scheduleDays[dia];
            return (
              <button
                key={dia}
                type="button"
                onClick={() => handleToggleDay(dia)}
                className={`py-2 px-2.5 text-xs font-bold rounded-xl transition flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20"
                    : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-zinc-700"
                }`}
              >
                <span className="text-[11px] font-black">{dia}</span>
                <span
                  className={`text-[9px] uppercase font-bold tracking-wider ${
                    isSelected ? "text-blue-100" : "text-gray-400 dark:text-zinc-500"
                  }`}
                >
                  {isSelected ? "Activo" : "Inactivo"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Paso 2: Asignación Rápida Masiva de Horas (Opcional pero muy útil) ─── */}
      {selectedDaysList.length > 0 && (
        <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-blue-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-bold text-gray-800 dark:text-zinc-200">
              Copiar horario común a todos los días ({selectedDaysList.length}):
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-semibold">
                Inicio:
              </span>
              <input
                type="time"
                value={commonStartTime}
                onChange={(e) => setCommonStartTime(e.target.value)}
                className="px-2 py-1 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-bold text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <span className="text-gray-400 font-bold">-</span>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-semibold">
                Fin:
              </span>
              <input
                type="time"
                value={commonEndTime}
                onChange={(e) => setCommonEndTime(e.target.value)}
                className="px-2 py-1 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-bold text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={handleApplyCommonHoursToAll}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-xs ${
                appliedFeedback
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
              }`}
            >
              {appliedFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5" /> ¡Aplicado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Aplicar a todos
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── Paso 3: Tarjetas de Ajuste Individual por Día ─── */}
      {selectedDaysList.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="block text-xs font-bold text-gray-700 dark:text-zinc-300">
            2. Ajusta las horas específicas de cada día (puedes personalizar cada uno):
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {selectedDaysList.map((dia) => {
              const slot = scheduleDays[dia] || { inicio: "07:00", fin: "13:00" };
              const hours = calculateHoursDiff(slot.inicio, slot.fin);

              return (
                <div
                  key={dia}
                  className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-blue-200/80 dark:border-zinc-700 shadow-xs flex items-center justify-between gap-3 hover:border-blue-400 transition"
                >
                  {/* Badge del Día */}
                  <div className="flex items-center gap-2 min-w-[95px]">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                      {dia}
                    </span>
                    {hours > 0 && (
                      <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400">
                        {hours}h
                      </span>
                    )}
                  </div>

                  {/* Selectores de Hora Reloj */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-gray-400">
                        Inicio
                      </span>
                      <input
                        type="time"
                        value={slot.inicio || "07:00"}
                        onChange={(e) => handleTimeChange(dia, "inicio", e.target.value)}
                        className="px-2 py-1 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs font-mono font-bold text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <span className="text-gray-400 font-bold self-end mb-1">-</span>

                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-gray-400">
                        Fin
                      </span>
                      <input
                        type="time"
                        value={slot.fin || "13:00"}
                        onChange={(e) => handleTimeChange(dia, "fin", e.target.value)}
                        className="px-2 py-1 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs font-mono font-bold text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Botón Quitar Día */}
                  <button
                    type="button"
                    onClick={() => handleToggleDay(dia)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer self-center"
                    title={`Quitar ${dia}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Paso 4: Resumen Textual Registrado ─── */}
      <div className="pt-2 border-t border-blue-200/60 dark:border-zinc-800 space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-700 dark:text-zinc-300">
            Resumen del horario registrado:
          </label>
          <span className="text-[11px] text-gray-400 dark:text-zinc-500">
            Se guarda automáticamente
          </span>
        </div>
        <input
          type="text"
          name="horario"
          placeholder="Ej: Lunes (07:00 - 13:00), Martes (07:00 - 13:00)"
          value={value || ""}
          onChange={handleManualTextChange}
          className="w-full px-3.5 py-2 text-xs sm:text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
        />
        <p className="text-[11px] text-gray-500 dark:text-zinc-400">
          Este horario quedará visible para todos los estudiantes vinculados, el docente tutor, auditores y administradores.
        </p>
      </div>
    </div>
  );
};

export default PracticeScheduleEditor;
