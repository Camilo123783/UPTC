// ============================================================
// BACK/migrations/migrate_v11_rubrica.js
// Agrega 'rubrica_criterios' a 'practica' e 'historial_practica'
// y 'criterios_rubrica' a 'reporte_auditor'
// ============================================================
const { queryDB } = require("../config/db");

async function run() {
  try {
    console.log("Iniciando migración v11: agregando campos de rúbrica...");

    // 1. practica.rubrica_criterios
    const colsPractica = await queryDB("SHOW COLUMNS FROM practica LIKE 'rubrica_criterios'");
    if (colsPractica.length === 0) {
      await queryDB("ALTER TABLE practica ADD COLUMN rubrica_criterios LONGTEXT NULL AFTER horario");
      console.log("✓ Columna 'rubrica_criterios' agregada a tabla practica");
    } else {
      console.log("→ Columna 'rubrica_criterios' ya existe en practica");
    }

    // 2. historial_practica.rubrica_criterios
    const colsHistorial = await queryDB("SHOW COLUMNS FROM historial_practica LIKE 'rubrica_criterios'");
    if (colsHistorial.length === 0) {
      await queryDB("ALTER TABLE historial_practica ADD COLUMN rubrica_criterios LONGTEXT NULL AFTER horario");
      console.log("✓ Columna 'rubrica_criterios' agregada a tabla historial_practica");
    } else {
      console.log("→ Columna 'rubrica_criterios' ya existe en historial_practica");
    }

    // 3. reporte_auditor.criterios_rubrica
    const colsAuditor = await queryDB("SHOW COLUMNS FROM reporte_auditor LIKE 'criterios_rubrica'");
    if (colsAuditor.length === 0) {
      await queryDB("ALTER TABLE reporte_auditor ADD COLUMN criterios_rubrica LONGTEXT NULL AFTER puntualidad_asistencia");
      console.log("✓ Columna 'criterios_rubrica' agregada a tabla reporte_auditor");
    } else {
      console.log("→ Columna 'criterios_rubrica' ya existe en reporte_auditor");
    }

    console.log("✅ Migración v11 completada con éxito.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error en migración v11:", err);
    process.exit(1);
  }
}

run();
