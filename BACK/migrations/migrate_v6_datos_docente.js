"use strict";

require("dotenv").config();
const { queryDB, pool } = require("../config/db");

async function runMigration() {
  try {
    console.log("--- Iniciando Migración v6: Creación de tabla datos_docente ---");

    await queryDB(`
      CREATE TABLE IF NOT EXISTS \`datos_docente\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`cedula_docente\` BIGINT NOT NULL UNIQUE,
        \`biografia\` TEXT DEFAULT NULL,
        \`direccion\` VARCHAR(255) DEFAULT NULL,
        \`telefono\` VARCHAR(50) DEFAULT NULL,
        \`correo_personal\` VARCHAR(180) DEFAULT NULL,
        \`nombre_familiar\` VARCHAR(180) DEFAULT NULL,
        \`telefono_familiar\` VARCHAR(50) DEFAULT NULL,
        \`foto_perfil\` LONGBLOB DEFAULT NULL,
        \`hoja_vida_digital\` LONGBLOB DEFAULT NULL,
        \`seguridad_social_eps\` LONGBLOB DEFAULT NULL,
        \`riesgos_profesionales_arl\` LONGBLOB DEFAULT NULL,
        \`copia_documento_identidad\` LONGBLOB DEFAULT NULL,
        \`copia_carnet_docente\` LONGBLOB DEFAULT NULL,
        \`carnet_vacunas\` LONGBLOB DEFAULT NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_datos_docente_cedula\` FOREIGN KEY (\`cedula_docente\`) REFERENCES \`docente\` (\`cedula\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ Tabla 'datos_docente' verificada/creada exitosamente.");
    console.log("--- Migración v6 completada exitosamente ---");
  } catch (err) {
    console.error("❌ Error en Migración v6:", err);
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

