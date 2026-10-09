// ============================================================
// BACK/migrations/migrate_v8_practica_horario.js
// Agrega la columna 'horario' (TEXT) a las tablas 'practica' e 'historial_practica'
// ============================================================
const { queryDB } = require("../config/db");

async function run() {
  try {
    console.log("Iniciando migración v8: agregando campo horario a practica...");

    // Verificar si ya existe en practica
    const colsPractica = await queryDB("SHOW COLUMNS FROM practica LIKE 'horario'");
    if (colsPractica.length === 0) {
      await queryDB("ALTER TABLE practica ADD COLUMN horario TEXT NULL AFTER descripcion");
      console.log("✓ Columna 'horario' agregada a tabla practica");
    } else {
      console.log("→ Columna 'horario' ya existe en practica");
    }

    // Verificar si ya existe en historial_practica
    const colsHistorial = await queryDB("SHOW COLUMNS FROM historial_practica LIKE 'horario'");
    if (colsHistorial.length === 0) {
      await queryDB("ALTER TABLE historial_practica ADD COLUMN horario TEXT NULL AFTER descripcion");
      console.log("✓ Columna 'horario' agregada a tabla historial_practica");
    } else {
      console.log("→ Columna 'horario' ya existe en historial_practica");
    }

    console.log("Migración v8 completada con éxito.");
    process.exit(0);
  } catch (err) {
    console.error("Error en migración v8:", err);
    process.exit(1);
  }
}

run();
