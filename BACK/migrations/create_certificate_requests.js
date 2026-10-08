const { queryDB } = require("../config/db");

async function run() {
  try {
    await queryDB(`
      CREATE TABLE IF NOT EXISTS solicitud_certificado (
        id INT AUTO_INCREMENT PRIMARY KEY,
        estudiante_cedula BIGINT NOT NULL,
        docente_cedula BIGINT NULL,
        practica_id INT NOT NULL,
        tipo_certificado VARCHAR(150) NOT NULL,
        motivo VARCHAR(150) NULL,
        observaciones TEXT NULL,
        estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
        fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_respuesta DATETIME NULL,
        respuesta_docente TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("TABLE_CREATED_SUCCESS");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
