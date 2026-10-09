// ============================================================
// BACK/migrations/migrate_v5_user_active_status.js
// Migración: Columna 'activo' en tablas de usuarios
// ============================================================
"use strict";

require("dotenv").config();
const { queryDB, pool } = require("../config/db");

async function runMigration() {
  try {
    console.log("--- Iniciando Migración v5: Estado activo de usuarios ---");

    const tables = ["administrador", "auditor", "docente", "estudiante"];
    for (const t of tables) {
      const cols = await queryDB(`SHOW COLUMNS FROM \`${t}\``);
      if (!cols.some((c) => c.Field === "activo")) {
        await queryDB(`ALTER TABLE \`${t}\` ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1`);
        console.log(`✅ Columna 'activo' agregada a tabla '${t}'.`);
      } else {
        console.log(`ℹ️ Columna 'activo' ya existe en tabla '${t}'.`);
      }
    }

    console.log("--- Migración v5 completada exitosamente ---");
  } catch (err) {
    console.error("❌ Error en Migración v5:", err);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMigration };
