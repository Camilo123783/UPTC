// ============================================================
// BACK/migrations/migrate_v4_student_docent_messages.js
// Migración v4: Comunicación Directa Docente - Estudiante UPTC
// ============================================================
"use strict";

require("dotenv").config();
const { queryDB, pool } = require("../config/db");

async function runStudentDocentMigration() {
  try {
    console.log("--- Iniciando Migración v4: Comunicación Docente - Estudiante ---");

    await queryDB(`
      CREATE TABLE IF NOT EXISTS mensaje_estudiante_docente (
        id INT(11) NOT NULL AUTO_INCREMENT,
        practica_id INT(11) NOT NULL,
        docente_cedula BIGINT(20) NOT NULL,
        estudiante_cedula BIGINT(20) UNSIGNED NULL,
        destinatario_tipo ENUM('individual', 'todos', 'seleccionados') NOT NULL DEFAULT 'individual',
        grupo_envio_id VARCHAR(64) NULL,
        remitente_rol ENUM('docente', 'estudiante') NOT NULL,
        remitente_cedula BIGINT(20) NOT NULL,
        remitente_nombre VARCHAR(255) NULL,
        titulo VARCHAR(255) NULL,
        mensaje TEXT NOT NULL,
        tipo VARCHAR(50) NOT NULL DEFAULT 'General',
        leido_por_docente TINYINT(1) NOT NULL DEFAULT 0,
        leido_por_estudiante TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_med_practica (practica_id),
        KEY idx_med_docente (docente_cedula),
        KEY idx_med_estudiante (estudiante_cedula),
        KEY idx_med_remitente (remitente_cedula),
        KEY idx_med_grupo (grupo_envio_id),
        KEY idx_med_unread_doc (docente_cedula, leido_por_docente),
        KEY idx_med_unread_est (estudiante_cedula, leido_por_estudiante),
        CONSTRAINT fk_med_practica FOREIGN KEY (practica_id) REFERENCES practica (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_med_docente FOREIGN KEY (docente_cedula) REFERENCES docente (cedula) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_med_estudiante FOREIGN KEY (estudiante_cedula) REFERENCES estudiante (cedula) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ Tabla 'mensaje_estudiante_docente' creada o verificada exitosamente.");
    console.log("🎉 --- Migración v4 completada con éxito ---");
    await pool.end();
  } catch (err) {
    console.error("❌ Error ejecutando migración v4:", err);
    process.exit(1);
  }
}

runStudentDocentMigration();
