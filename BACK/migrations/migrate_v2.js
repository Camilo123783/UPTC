// ============================================================
// BACK/migrations/migrate_v2.js — Normalización de BD UPTC
// ============================================================
"use strict";

require("dotenv").config();
const { queryDB, pool } = require("../config/db");

async function helperDropFK(tableName, constraintName) {
  try {
    const fks = await queryDB(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND CONSTRAINT_NAME = ? 
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `, [tableName, constraintName]);

    if (fks.length > 0) {
      await queryDB(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``);
      console.log(`  ↪ Drop FK '${constraintName}' en '${tableName}' OK`);
    }
  } catch (err) {
    console.warn(`  ⚠️ Aviso al eliminar FK '${constraintName}' en '${tableName}':`, err.message);
  }
}

async function runMigration() {
  try {
    console.log("--- Iniciando Migración v2 de Base de Datos ---");

    // 1. Corregir rol id = 1 a 'superadmin'
    await queryDB("UPDATE rol SET rol = 'superadmin' WHERE id = 1");
    console.log("✅ rol id 1 actualizado a 'superadmin'");

    // 2. Renombrar superadmin.apellido a apellidos si existe
    const saCols = await queryDB("SHOW COLUMNS FROM superadmin");
    const hasApellido = saCols.some((c) => c.Field === "apellido");
    if (hasApellido) {
      await queryDB("ALTER TABLE superadmin CHANGE COLUMN apellido apellidos VARCHAR(255) NOT NULL");
      console.log("✅ superadmin.apellido renombrado a 'apellidos'");
    } else {
      console.log("ℹ️ superadmin ya tiene columna 'apellidos'");
    }

    // 3. Normalizar cédulas a BIGINT(20)
    console.log("🔄 Desactivando FKs temporalmente y desvinculando constraints...");
    await helperDropFK("observacion_practica", "fk_obs_admin");
    await helperDropFK("observacion_practica", "fk_obs_auditor");
    await helperDropFK("observacion_practica", "fk_obs_docente");
    await helperDropFK("datos_docente", "fk_datosD_docente");

    await queryDB("SET FOREIGN_KEY_CHECKS = 0");

    // administrador
    console.log("🔄 Modificando columnas a BIGINT(20)...");
    await queryDB("ALTER TABLE administrador MODIFY COLUMN cedula BIGINT(20) NOT NULL");
    await queryDB("ALTER TABLE observacion_practica MODIFY COLUMN admin_cedula BIGINT(20) NULL");
    console.log("  ✅ administrador.cedula y observacion_practica.admin_cedula -> BIGINT(20)");

    // auditor
    await queryDB("ALTER TABLE auditor MODIFY COLUMN cedula BIGINT(20) NOT NULL");
    await queryDB("ALTER TABLE observacion_practica MODIFY COLUMN auditor_cedula BIGINT(20) NULL");
    await queryDB("ALTER TABLE practica MODIFY COLUMN auditor_cedula BIGINT(20) NULL");
    console.log("  ✅ auditor.cedula, observacion_practica.auditor_cedula, practica.auditor_cedula -> BIGINT(20)");

    // docente
    await queryDB("ALTER TABLE docente MODIFY COLUMN cedula BIGINT(20) NOT NULL");
    await queryDB("ALTER TABLE datos_docente MODIFY COLUMN cedula_docente BIGINT(20) NOT NULL");
    await queryDB("ALTER TABLE observacion_practica MODIFY COLUMN docente_cedula BIGINT(20) NULL");
    await queryDB("ALTER TABLE practica MODIFY COLUMN docente_cedula BIGINT(20) NULL");
    console.log("  ✅ docente.cedula y sus referencias -> BIGINT(20)");

    // Recrear las FKs eliminadas
    console.log("🔄 Re-aplicando Foreign Keys normalizadas...");
    await queryDB(`
      ALTER TABLE observacion_practica 
      ADD CONSTRAINT fk_obs_admin 
      FOREIGN KEY (admin_cedula) REFERENCES administrador (cedula) 
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryDB(`
      ALTER TABLE observacion_practica 
      ADD CONSTRAINT fk_obs_auditor 
      FOREIGN KEY (auditor_cedula) REFERENCES auditor (cedula) 
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryDB(`
      ALTER TABLE observacion_practica 
      ADD CONSTRAINT fk_obs_docente 
      FOREIGN KEY (docente_cedula) REFERENCES docente (cedula) 
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryDB(`
      ALTER TABLE datos_docente 
      ADD CONSTRAINT fk_datosD_docente 
      FOREIGN KEY (cedula_docente) REFERENCES docente (cedula) 
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    console.log("  ✅ FKs de observacion_practica y datos_docente re-establecidas");

    await queryDB("SET FOREIGN_KEY_CHECKS = 1");

    // 4. Claves foráneas e índices para solicitud_certificado
    console.log("🔄 Verificando e indexando solicitud_certificado...");

    // Corregir tipos para que coincidan con las tablas foráneas
    // estudiante.cedula es BIGINT(20) UNSIGNED
    await queryDB("ALTER TABLE solicitud_certificado MODIFY COLUMN estudiante_cedula BIGINT(20) UNSIGNED NOT NULL");
    await queryDB("ALTER TABLE solicitud_certificado MODIFY COLUMN docente_cedula BIGINT(20) NULL");
    await queryDB("ALTER TABLE solicitud_certificado MODIFY COLUMN practica_id INT(11) NOT NULL");

    // Limpiar inconsistencias de pruebas en practica_id
    await queryDB("UPDATE solicitud_certificado SET practica_id = 10 WHERE practica_id NOT IN (SELECT id FROM practica)");

    const scIndexes = await queryDB("SHOW INDEX FROM solicitud_certificado");
    const indexNames = scIndexes.map((i) => i.Key_name);

    if (!indexNames.includes("idx_sc_estudiante")) {
      await queryDB("ALTER TABLE solicitud_certificado ADD KEY idx_sc_estudiante (estudiante_cedula)");
    }
    if (!indexNames.includes("idx_sc_docente")) {
      await queryDB("ALTER TABLE solicitud_certificado ADD KEY idx_sc_docente (docente_cedula)");
    }
    if (!indexNames.includes("idx_sc_practica")) {
      await queryDB("ALTER TABLE solicitud_certificado ADD KEY idx_sc_practica (practica_id)");
    }
    console.log("  ✅ Índices creados en solicitud_certificado");

    // Verificar si ya existen FKs antes de añadirlas
    const fks = await queryDB(
      "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solicitud_certificado' AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
    );
    const fkNames = fks.map((f) => f.CONSTRAINT_NAME);

    if (!fkNames.includes("fk_sc_estudiante")) {
      await queryDB(
        "ALTER TABLE solicitud_certificado ADD CONSTRAINT fk_sc_estudiante FOREIGN KEY (estudiante_cedula) REFERENCES estudiante (cedula) ON DELETE CASCADE ON UPDATE CASCADE"
      );
      console.log("  ✅ FK fk_sc_estudiante añadida");
    }
    if (!fkNames.includes("fk_sc_practica")) {
      await queryDB(
        "ALTER TABLE solicitud_certificado ADD CONSTRAINT fk_sc_practica FOREIGN KEY (practica_id) REFERENCES practica (id) ON DELETE CASCADE ON UPDATE CASCADE"
      );
      console.log("  ✅ FK fk_sc_practica añadida");
    }
    if (!fkNames.includes("fk_sc_docente")) {
      await queryDB(
        "ALTER TABLE solicitud_certificado ADD CONSTRAINT fk_sc_docente FOREIGN KEY (docente_cedula) REFERENCES docente (cedula) ON DELETE SET NULL ON UPDATE CASCADE"
      );
      console.log("  ✅ FK fk_sc_docente añadida");
    }

    console.log("🎉 --- Migración v2 completada con éxito ---");
    await pool.end();
  } catch (err) {
    console.error("❌ Error ejecutando migración:", err);
    process.exit(1);
  }
}

runMigration();
