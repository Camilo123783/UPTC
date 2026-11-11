// ============================================================
// migrations/migrate_v7_primer_ingreso.js
// Tabla de auditoría para control de Primer Inicio de Sesión
// (Aceptación de Habeas Data y Cambio de Contraseña Inicial)
// ============================================================
"use strict";

const { queryDB } = require("../config/db");

async function runMigration() {
  console.log("--- Iniciando Migración v7: Tabla usuario_primer_ingreso ---");
  try {
    await queryDB(`
      CREATE TABLE IF NOT EXISTS usuario_primer_ingreso (
        cedula BIGINT NOT NULL PRIMARY KEY,
        terminos_aceptados TINYINT(1) NOT NULL DEFAULT 0,
        fecha_terminos DATETIME NULL,
        clave_cambiada TINYINT(1) NOT NULL DEFAULT 0,
        fecha_clave DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Tabla 'usuario_primer_ingreso' verificada/creada exitosamente.");
    console.log("--- Migración v7 completada exitosamente ---");
  } catch (err) {
    console.error("❌ Error en Migración v7:", err.message);
  }
}

module.exports = { runMigration };
