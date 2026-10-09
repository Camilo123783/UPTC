// ============================================================
// BACK/migrations/migrate_v7_historial_certificados.js
// Tabla para archivo histórico de certificados emitidos con
// identificador hexadecimal único, vigencia de 1 año para estudiantes
// y permanencia indefinida para administración.
// ============================================================
const { queryDB } = require("../config/db");
const crypto = require("crypto");

const generateHexId = () => {
  return crypto.randomBytes(8).toString("hex").toUpperCase();
};

async function run() {
  try {
    console.log("Iniciando migración v7: historial_certificado...");

    await queryDB(`
      CREATE TABLE IF NOT EXISTS historial_certificado (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_hex VARCHAR(32) NOT NULL UNIQUE,
        estudiante_cedula BIGINT NOT NULL,
        estudiante_nombre VARCHAR(255) NOT NULL,
        estudiante_codigo VARCHAR(100) NULL,
        estudiante_correo VARCHAR(255) NULL,
        practica_id INT NOT NULL,
        practica_titulo VARCHAR(255) NOT NULL,
        programa_nombre VARCHAR(255) NULL,
        institucion_nombre VARCHAR(255) NULL,
        servicio_nombre VARCHAR(255) NULL,
        docente_nombre VARCHAR(255) NULL,
        docente_cedula BIGINT NULL,
        horas_totales INT DEFAULT 0,
        calificacion DECIMAL(3,1) NULL,
        periodo VARCHAR(50) NULL,
        tipo_certificado VARCHAR(255) NOT NULL,
        categoria_solicitud VARCHAR(50) DEFAULT 'certificado',
        motivo VARCHAR(255) NULL,
        fecha_inicio DATE NULL,
        fecha_fin DATE NULL,
        fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_expiracion_estudiante DATETIME NULL,
        metadatos_json LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_hex (id_hex),
        INDEX idx_estudiante (estudiante_cedula),
        INDEX idx_practica (practica_id),
        INDEX idx_fecha_emision (fecha_emision)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ Tabla historial_certificado verificada/creada exitosamente.");

    // Poblar certificados existentes desde solicitud_certificado con estado 'Aprobado'
    const approvedRequests = await queryDB(`
      SELECT sc.*, 
             pr.titulo AS practica_titulo,
             pr.periodo AS practica_periodo,
             pr.horas_totales AS practica_horas,
             pr.fecha_inicio AS practica_fecha_inicio,
             pr.fecha_fin AS practica_fecha_fin,
             pr.institucion_id,
             i.nombreinstitucion AS institucion_nombre,
             s.nombreservicio AS servicio_nombre,
             prog.nombreprograma AS programa_nombre,
             pe.calificacion AS estudiante_calificacion,
             pe.horas_cumplidas AS estudiante_horas_cumplidas,
             e.nombre AS e_nombre,
             e.apellidos AS e_apellidos,
             e.codigo AS e_codigo,
             e.correo_institucional AS e_correo,
             d.nombre AS d_nombre,
             d.apellidos AS d_apellidos
      FROM solicitud_certificado sc
      LEFT JOIN practica pr ON sc.practica_id = pr.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN programa prog ON pr.programa_id = prog.id
      LEFT JOIN practica_estudiante pe ON sc.practica_id = pe.practica_id AND sc.estudiante_cedula = pe.estudiante_cedula
      LEFT JOIN estudiante e ON sc.estudiante_cedula = e.cedula
      LEFT JOIN docente d ON (sc.docente_cedula = d.cedula OR pr.docente_cedula = d.cedula)
      WHERE sc.estado = 'Aprobado'
    `);

    console.log(`Encontradas ${approvedRequests.length} solicitudes aprobadas para migrar a historial_certificado.`);

    for (const req of approvedRequests) {
      // Verificar si ya existe registrado
      const existing = await queryDB(
        "SELECT id FROM historial_certificado WHERE estudiante_cedula = ? AND practica_id = ? AND tipo_certificado = ?",
        [req.estudiante_cedula, req.practica_id, req.tipo_certificado]
      );

      if (existing.length === 0) {
        const idHex = generateHexId();
        const estNombre = `${req.e_nombre || ""} ${req.e_apellidos || ""}`.trim() || `Estudiante #${req.estudiante_cedula}`;
        const docNombre = `${req.d_nombre || ""} ${req.d_apellidos || ""}`.trim() || "Docente Tutor UPTC";
        const emisionDate = req.fecha_respuesta || req.fecha_solicitud || new Date();

        await queryDB(`
          INSERT INTO historial_certificado (
            id_hex,
            estudiante_cedula,
            estudiante_nombre,
            estudiante_codigo,
            estudiante_correo,
            practica_id,
            practica_titulo,
            programa_nombre,
            institucion_nombre,
            servicio_nombre,
            docente_nombre,
            docente_cedula,
            horas_totales,
            calificacion,
            periodo,
            tipo_certificado,
            categoria_solicitud,
            motivo,
            fecha_inicio,
            fecha_fin,
            fecha_emision,
            fecha_expiracion_estudiante,
            metadatos_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL 1 YEAR), ?)
        `, [
          idHex,
          req.estudiante_cedula,
          estNombre,
          req.e_codigo || null,
          req.e_correo || null,
          req.practica_id,
          req.practica_titulo || "Práctica Formativa",
          req.programa_nombre || "Medicina",
          req.institucion_nombre || "Hospital Universitario San Rafael de Tunja",
          req.servicio_nombre || "Servicio Clínico",
          docNombre,
          req.docente_cedula || null,
          req.estudiante_horas_cumplidas || req.practica_horas || 120,
          req.estudiante_calificacion || null,
          req.practica_periodo || "2026-1",
          req.tipo_certificado,
          req.categoria_solicitud || "certificado",
          req.motivo || "Certificado Oficial UPTC",
          req.practica_fecha_inicio || null,
          req.practica_fecha_fin || null,
          emisionDate,
          emisionDate,
          JSON.stringify({
            solicitud_id: req.id,
            respuesta_docente: req.respuesta_docente,
            origen: "migracion_inicial"
          })
        ]);
        console.log(`✓ Certificado migrado: ${idHex} para estudiante ${req.estudiante_cedula}`);
      }
    }

    console.log("Migración v7 completada con éxito.");
    process.exit(0);
  } catch (err) {
    console.error("Error en migración v7:", err);
    process.exit(1);
  }
}

run();
