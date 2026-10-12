// ============================================================
// BACK/migrations/migrate_v9_indexes.js
// Optimización de rendimiento en base de datos: Creación segura de índices
// en tablas de alta concurrencia (práctica, estudiantes, evaluaciones, historial)
// ============================================================
"use strict";

const { queryDB } = require("../config/db");

async function createIndexIfNotExists(table, indexName, columns) {
  try {
    const existing = await queryDB(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
    if (existing.length === 0) {
      await queryDB(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`);
      console.log(`✓ Índice '${indexName}' creado en tabla '${table}' (${columns})`);
    } else {
      console.log(`→ Índice '${indexName}' ya existe en tabla '${table}'`);
    }
  } catch (err) {
    console.warn(`⚠ Aviso al procesar índice '${indexName}' en '${table}':`, err.message);
  }
}

async function run() {
  try {
    console.log("🚀 Iniciando migración v9: Creación de índices para alto rendimiento...");

    // 1. Índices en 'practica'
    await createIndexIfNotExists("practica", "idx_practica_docente_estado", "`docente_cedula`, `estado`");
    await createIndexIfNotExists("practica", "idx_practica_auditor_estado", "`auditor_cedula`, `estado`");
    await createIndexIfNotExists("practica", "idx_practica_periodo", "`periodo`");

    // 2. Índices en 'practica_estudiante'
    await createIndexIfNotExists("practica_estudiante", "idx_pe_practica_estudiante", "`practica_id`, `estudiante_cedula`");
    await createIndexIfNotExists("practica_estudiante", "idx_pe_estudiante_cedula", "`estudiante_cedula`");

    // 3. Índices en 'reporte_auditor'
    await createIndexIfNotExists("reporte_auditor", "idx_ra_practica_estudiante", "`practica_id`, `estudiante_cedula`");

    // 4. Índices en 'historial_practica'
    await createIndexIfNotExists("historial_practica", "idx_hp_docente_cedula", "`docente_cedula`");
    await createIndexIfNotExists("historial_practica", "idx_hp_auditor_cedula", "`auditor_cedula`");
    await createIndexIfNotExists("historial_practica", "idx_hp_periodo", "`periodo`");

    // 5. Índices en 'historial_practica_estudiante'
    await createIndexIfNotExists("historial_practica_estudiante", "idx_hpe_historial_id", "`historial_id`");
    await createIndexIfNotExists("historial_practica_estudiante", "idx_hpe_estudiante_cedula", "`estudiante_cedula`");

    console.log("✅ Migración v9 completada exitosamente.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error en migración v9:", err);
    process.exit(1);
  }
}

run();
