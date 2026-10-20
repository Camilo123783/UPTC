// ============================================================
// services/practiceSync.service.js
// Sincronización automática de estados de prácticas según fechas
// ============================================================
"use strict";

const { queryDB, getColombiaToday } = require("../config/db");
const { archivePractice } = require("./history.service");

/**
 * Determina el estado de una práctica en base a sus fechas y la fecha actual en Colombia.
 * Reglas de ciclo de vida del estado:
 * 1. 'Cancelada' se mantiene inmutable (requiere reactivación manual explícita).
 * 2. Si la fecha final ya venció estrictamente (ayer o antes: todayStr > fecha_fin) -> 'Finalizada'.
 * 3. Si la fecha de inicio ya llegó y no ha vencido (todayStr >= fecha_inicio && todayStr <= fecha_fin) -> 'Activa'.
 * 4. Si la fecha de inicio aún no ha llegado (todayStr < fecha_inicio) -> 'Planificada'.
 *
 * @param {string|null} fIni Fecha de inicio (YYYY-MM-DD)
 * @param {string|null} fFin Fecha de fin (YYYY-MM-DD)
 * @param {string} estadoActual Estado actual ('Planificada' | 'Activa' | 'Finalizada' | 'Cancelada')
 * @returns {string} Nuevo estado calculado
 */
function calculatePracticeStatus(fIni, fFin, estadoActual = "Planificada") {
  if (estadoActual === "Cancelada") return "Cancelada";

  const todayStr = getColombiaToday();
  const iniStr = fIni ? String(fIni).substring(0, 10) : "";
  const finStr = fFin ? String(fFin).substring(0, 10) : "";

  // 1. Finalizada: la fecha de fin ya transcurrió por completo (ayer o antes)
  // En el día de fecha_fin la práctica permanece Activa todo el día hasta las 23:59:59
  if (finStr && todayStr > finStr) {
    return "Finalizada";
  }

  // 2. Activa: ya comenzó y no ha vencido
  if (iniStr && todayStr >= iniStr) {
    if (!finStr || todayStr <= finStr) {
      return "Activa";
    }
  }

  // 3. Planificada: la fecha de inicio es estrictamente futura
  if (iniStr && todayStr < iniStr) {
    return "Planificada";
  }

  return estadoActual || "Planificada";
}

/**
 * Sincroniza en la base de datos el estado de todas las prácticas según la fecha actual.
 * Aplica para vistas de Estudiante, Docente, Auditor y Administrador.
 */
let lastSyncTimestamp = 0;
async function syncPracticeStatuses(force = false) {
  if (!force && Date.now() - lastSyncTimestamp < 60000) return;
  lastSyncTimestamp = Date.now();
  try {
    const todayStr = getColombiaToday();

    // 1. Prácticas cuya fecha final ya pasó estrictamente -> 'Finalizada'
    const newlyFinished = await queryDB(`
      SELECT id FROM practica 
      WHERE estado != 'Cancelada' 
        AND estado != 'Finalizada' 
        AND fecha_fin IS NOT NULL 
        AND ? > fecha_fin
    `, [todayStr]);

    if (newlyFinished.length > 0) {
      await queryDB(`
        UPDATE practica 
        SET estado = 'Finalizada' 
        WHERE estado != 'Cancelada' 
          AND estado != 'Finalizada' 
          AND fecha_fin IS NOT NULL 
          AND ? > fecha_fin
      `, [todayStr]);

      for (const nf of newlyFinished) {
        try {
          await archivePractice(nf.id);
        } catch (e) {
          console.error(`Error archivando práctica #${nf.id}:`, e.message);
        }
      }
    }

    // 2. Prácticas que deben estar 'Activa' (llegó la fecha de inicio y no ha vencido la fecha de fin)
    // Se incluye a aquellas que estaban erróneamente en 'Finalizada' o 'Planificada'
    const newlyActive = await queryDB(`
      SELECT id FROM practica 
      WHERE estado != 'Cancelada' 
        AND estado != 'Activa' 
        AND fecha_inicio IS NOT NULL 
        AND ? >= fecha_inicio 
        AND (fecha_fin IS NULL OR ? <= fecha_fin)
    `, [todayStr, todayStr]);

    if (newlyActive.length > 0) {
      await queryDB(`
        UPDATE practica 
        SET estado = 'Activa' 
        WHERE estado != 'Cancelada' 
          AND estado != 'Activa' 
          AND fecha_inicio IS NOT NULL 
          AND ? >= fecha_inicio 
          AND (fecha_fin IS NULL OR ? <= fecha_fin)
      `, [todayStr, todayStr]);

      // Si habían sido archivadas prematuramente a historial_practica, eliminarlas del historial
      const activeIds = newlyActive.map((p) => p.id);
      if (activeIds.length > 0) {
        const placeholders = activeIds.map(() => "?").join(",");
        await queryDB(
          `DELETE FROM historial_practica WHERE practica_id IN (${placeholders})`,
          activeIds
        );
      }
    }

    // 3. Prácticas cuya fecha de inicio es futura -> 'Planificada'
    const newlyPlanned = await queryDB(`
      SELECT id FROM practica 
      WHERE estado != 'Cancelada' 
        AND estado != 'Planificada' 
        AND fecha_inicio IS NOT NULL 
        AND ? < fecha_inicio
    `, [todayStr]);

    if (newlyPlanned.length > 0) {
      await queryDB(`
        UPDATE practica 
        SET estado = 'Planificada' 
        WHERE estado != 'Cancelada' 
          AND estado != 'Planificada' 
          AND fecha_inicio IS NOT NULL 
          AND ? < fecha_inicio
      `, [todayStr]);

      const plannedIds = newlyPlanned.map((p) => p.id);
      if (plannedIds.length > 0) {
        const placeholders = plannedIds.map(() => "?").join(",");
        await queryDB(
          `DELETE FROM historial_practica WHERE practica_id IN (${placeholders})`,
          plannedIds
        );
      }
    }
  } catch (err) {
    console.error("Error sincronizando estados de prácticas:", err.message);
  }
}

module.exports = {
  syncPracticeStatuses,
  calculatePracticeStatus,
};
