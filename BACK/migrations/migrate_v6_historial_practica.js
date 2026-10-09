// ============================================================
// BACK/migrations/migrate_v6_historial_practica.js
// Migración: Crear tablas de historial y campo motivo_cancelacion
// ============================================================
"use strict";

require("dotenv").config();
const { queryDB, pool } = require("../config/db");
const { syncAllFinishedAndCancelledPractices } = require("../services/history.service");

async function runMigration() {
  try {
    console.log("--- Iniciando Migración v6: Historial de Prácticas y Cancelación ---");

    // 1. Agregar columna motivo_cancelacion a la tabla practica si no existe
    const columns = await queryDB("SHOW COLUMNS FROM practica");
    const hasMotivo = columns.some((c) => c.Field === "motivo_cancelacion");
    if (!hasMotivo) {
      await queryDB("ALTER TABLE practica ADD COLUMN motivo_cancelacion TEXT NULL AFTER estado");
      console.log("✅ Columna 'motivo_cancelacion' agregada a la tabla 'practica'.");
    } else {
      console.log("ℹ️ Columna 'motivo_cancelacion' ya existe en 'practica'.");
    }

    // 2. Crear tabla principal historial_practica
    await queryDB(`
      CREATE TABLE IF NOT EXISTS historial_practica (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        practica_id INT(11) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        periodo VARCHAR(50) NULL,
        fecha_inicio DATE NULL,
        fecha_fin DATE NULL,
        horas_totales INT(11) NULL,
        cupos INT(11) NULL,
        estado ENUM('Finalizada', 'Cancelada') NOT NULL,
        motivo_cancelacion TEXT NULL,
        descripcion TEXT NULL,
        programa_id BIGINT(20) UNSIGNED NULL,
        programa_nombre VARCHAR(255) NULL,
        asignatura_id BIGINT(20) UNSIGNED NULL,
        asignatura_nombre VARCHAR(255) NULL,
        asignatura_codigo VARCHAR(100) NULL,
        institucion_id INT(10) UNSIGNED NULL,
        institucion_nombre VARCHAR(255) NULL,
        servicio_id INT(10) UNSIGNED NULL,
        servicio_nombre VARCHAR(255) NULL,
        docente_cedula BIGINT(20) NULL,
        docente_nombre VARCHAR(255) NULL,
        docente_correo VARCHAR(255) NULL,
        auditor_cedula BIGINT(20) NULL,
        auditor_nombre VARCHAR(255) NULL,
        auditor_correo VARCHAR(255) NULL,
        creado_por_rol VARCHAR(50) NULL,
        creador_nombre VARCHAR(255) NULL,
        estudiantes_info LONGTEXT NOT NULL,
        asistencias_resumen LONGTEXT NULL,
        total_estudiantes INT(11) DEFAULT 0,
        fecha_archivo TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_historial_practica (practica_id),
        KEY idx_historial_docente (docente_cedula),
        KEY idx_historial_estado (estado),
        KEY idx_historial_periodo (periodo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Tabla 'historial_practica' verificada/creada.");

    // 3. Crear tabla normalizada historial_practica_estudiante
    await queryDB(`
      CREATE TABLE IF NOT EXISTS historial_practica_estudiante (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        historial_id INT(11) NOT NULL,
        practica_id INT(11) NOT NULL,
        estudiante_cedula BIGINT(20) UNSIGNED NOT NULL,
        estudiante_nombre VARCHAR(255) NULL,
        estudiante_codigo VARCHAR(100) NULL,
        calificacion DECIMAL(3,1) NULL,
        estado_evaluacion VARCHAR(50) NULL,
        horas_cumplidas INT(11) DEFAULT 0,
        horas_asignadas INT(11) NULL,
        tiene_documentos TINYINT(1) DEFAULT 0,
        INDEX idx_hpe_historial (historial_id),
        INDEX idx_hpe_practica (practica_id),
        INDEX idx_hpe_estudiante (estudiante_cedula),
        CONSTRAINT fk_hpe_historial FOREIGN KEY (historial_id) REFERENCES historial_practica (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Tabla 'historial_practica_estudiante' verificada/creada.");

    // 4. Si hay prácticas ya canceladas o finalizadas, archivarlas de inmediato
    await syncAllFinishedAndCancelledPractices();

    console.log("🎉 --- Migración v6 completada exitosamente ---");
    await pool.end();
  } catch (err) {
    console.error("❌ Error ejecutando migración v6:", err);
    process.exit(1);
  }
}

runMigration();
