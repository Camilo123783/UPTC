// ============================================================
// BACK/migrations/migrate_v3_auditor.js — Tablas para Auditor Clínico
// ============================================================
"use strict";

require("dotenv").config();
const { queryDB, pool } = require("../config/db");

async function runAuditorMigration() {
  try {
    console.log("--- Iniciando Migración v3: Tablas del Auditor Clínico ---");

    // 1. Tabla de Registro de Asistencia Diaria / Turnos
    await queryDB(`
      CREATE TABLE IF NOT EXISTS asistencia_estudiante (
        id INT(11) NOT NULL AUTO_INCREMENT,
        practica_id INT(11) NOT NULL,
        estudiante_cedula BIGINT(20) UNSIGNED NOT NULL,
        auditor_cedula BIGINT(20) NOT NULL,
        fecha DATE NOT NULL,
        turno VARCHAR(50) NOT NULL DEFAULT 'Turno Completo (8h)',
        horas INT(11) NOT NULL DEFAULT 8,
        estado ENUM('Presente', 'Tardanza', 'Ausente Justificado', 'Ausente Injustificado') NOT NULL DEFAULT 'Presente',
        observaciones VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_asist_practica (practica_id),
        KEY idx_asist_estudiante (estudiante_cedula),
        KEY idx_asist_auditor (auditor_cedula),
        CONSTRAINT fk_asist_practica FOREIGN KEY (practica_id) REFERENCES practica (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_asist_estudiante FOREIGN KEY (estudiante_cedula) REFERENCES estudiante (cedula) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_asist_auditor FOREIGN KEY (auditor_cedula) REFERENCES auditor (cedula) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Tabla 'asistencia_estudiante' creada/verificada.");

    // 2. Tabla de Reporte Clínico del Auditor al Docente
    await queryDB(`
      CREATE TABLE IF NOT EXISTS reporte_auditor (
        id INT(11) NOT NULL AUTO_INCREMENT,
        practica_id INT(11) NOT NULL,
        estudiante_cedula BIGINT(20) UNSIGNED NOT NULL,
        auditor_cedula BIGINT(20) NOT NULL,
        docente_cedula BIGINT(20) NULL,
        conocimiento_teorico DECIMAL(3,1) NOT NULL DEFAULT 4.0,
        habilidades_practicas DECIMAL(3,1) NOT NULL DEFAULT 4.0,
        actitud_etica DECIMAL(3,1) NOT NULL DEFAULT 5.0,
        comunicacion_equipo DECIMAL(3,1) NOT NULL DEFAULT 4.0,
        puntualidad_asistencia DECIMAL(3,1) NOT NULL DEFAULT 5.0,
        nota_sugerida DECIMAL(3,1) NOT NULL DEFAULT 4.4,
        concepto ENUM('Excelente', 'Favorable', 'En Seguimiento', 'Requiere Refuerzo') NOT NULL DEFAULT 'Favorable',
        observaciones TEXT NOT NULL,
        fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
        leido_por_docente TINYINT(1) DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_rep_practica (practica_id),
        KEY idx_rep_estudiante (estudiante_cedula),
        KEY idx_rep_auditor (auditor_cedula),
        KEY idx_rep_docente (docente_cedula),
        CONSTRAINT fk_rep_practica FOREIGN KEY (practica_id) REFERENCES practica (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_rep_estudiante FOREIGN KEY (estudiante_cedula) REFERENCES estudiante (cedula) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_rep_auditor FOREIGN KEY (auditor_cedula) REFERENCES auditor (cedula) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_rep_docente FOREIGN KEY (docente_cedula) REFERENCES docente (cedula) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Tabla 'reporte_auditor' creada/verificada.");

    console.log("🎉 --- Migración v3 de Auditor completada con éxito ---");
    await pool.end();
  } catch (err) {
    console.error("❌ Error ejecutando migración v3 auditor:", err);
    process.exit(1);
  }
}

runAuditorMigration();
