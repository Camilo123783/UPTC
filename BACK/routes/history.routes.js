// ============================================================
// routes/history.routes.js — Módulo de Historial de Prácticas Formativas
// ============================================================
"use strict";

const express = require("express");
const router = express.Router();
const { queryDB } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { syncAllFinishedAndCancelledPractices, archivePractice } = require("../services/history.service");

/**
 * GET /api/history
 * Lista las prácticas archivadas (finalizadas o canceladas).
 * - Administradores / Superadministradores: ven todas las prácticas archivadas.
 * - Docentes: ven las prácticas finalizadas o canceladas que hayan tenido asignadas.
 * - Estudiantes: ven las prácticas finalizadas o canceladas donde estuvieron vinculados.
 */
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const { role, cedula } = req.user;
    if (role === "superadmin") {
      return res.status(403).json({ success: false, message: "El rol Superadministrador no tiene acceso al módulo de historial." });
    }
    let rows = [];

    if (role === "admin") {
      rows = await queryDB(`
        SELECT 
          hp.id,
          hp.practica_id,
          hp.titulo,
          hp.periodo,
          hp.fecha_inicio,
          hp.fecha_fin,
          hp.horas_totales,
          hp.cupos,
          hp.estado,
          hp.motivo_cancelacion,
          hp.descripcion,
          hp.horario,
          hp.programa_id,
          hp.programa_nombre,
          hp.asignatura_id,
          hp.asignatura_nombre,
          hp.asignatura_codigo,
          hp.institucion_id,
          hp.institucion_nombre,
          hp.servicio_id,
          hp.servicio_nombre,
          hp.docente_cedula,
          hp.docente_nombre,
          hp.docente_correo,
          hp.auditor_cedula,
          hp.auditor_nombre,
          hp.auditor_correo,
          hp.creado_por_rol,
          hp.creador_nombre,
          hp.estudiantes_info,
          hp.asistencias_resumen,
          hp.total_estudiantes,
          hp.fecha_archivo
        FROM historial_practica hp
        ORDER BY hp.fecha_archivo DESC, hp.id DESC
      `);
    } else if (role === "docent") {
      rows = await queryDB(`
        SELECT 
          hp.id,
          hp.practica_id,
          hp.titulo,
          hp.periodo,
          hp.fecha_inicio,
          hp.fecha_fin,
          hp.horas_totales,
          hp.cupos,
          hp.estado,
          hp.motivo_cancelacion,
          hp.descripcion,
          hp.horario,
          hp.programa_id,
          hp.programa_nombre,
          hp.asignatura_id,
          hp.asignatura_nombre,
          hp.asignatura_codigo,
          hp.institucion_id,
          hp.institucion_nombre,
          hp.servicio_id,
          hp.servicio_nombre,
          hp.docente_cedula,
          hp.docente_nombre,
          hp.docente_correo,
          hp.auditor_cedula,
          hp.auditor_nombre,
          hp.auditor_correo,
          hp.creado_por_rol,
          hp.creador_nombre,
          hp.estudiantes_info,
          hp.asistencias_resumen,
          hp.total_estudiantes,
          hp.fecha_archivo
        FROM historial_practica hp
        WHERE hp.docente_cedula = ?
        ORDER BY hp.fecha_archivo DESC, hp.id DESC
      `, [cedula]);
    } else if (role === "student") {
      rows = await queryDB(`
        SELECT 
          hp.id,
          hp.practica_id,
          hp.titulo,
          hp.periodo,
          hp.fecha_inicio,
          hp.fecha_fin,
          hp.horas_totales,
          hp.cupos,
          hp.estado,
          hp.motivo_cancelacion,
          hp.descripcion,
          hp.horario,
          hp.programa_id,
          hp.programa_nombre,
          hp.asignatura_id,
          hp.asignatura_nombre,
          hp.asignatura_codigo,
          hp.institucion_id,
          hp.institucion_nombre,
          hp.servicio_id,
          hp.servicio_nombre,
          hp.docente_cedula,
          hp.docente_nombre,
          hp.docente_correo,
          hp.auditor_cedula,
          hp.auditor_nombre,
          hp.auditor_correo,
          hp.creado_por_rol,
          hp.creador_nombre,
          hp.estudiantes_info,
          hp.asistencias_resumen,
          hp.total_estudiantes,
          hp.fecha_archivo,
          hpe.calificacion AS mi_calificacion,
          hpe.estado_evaluacion AS mi_estado_evaluacion,
          hpe.horas_cumplidas AS mis_horas_cumplidas,
          hpe.horas_asignadas AS mis_horas_asignadas,
          hpe.tiene_documentos AS mis_tiene_documentos
        FROM historial_practica hp
        INNER JOIN historial_practica_estudiante hpe ON hp.id = hpe.historial_id
        WHERE hpe.estudiante_cedula = ?
        ORDER BY hp.fecha_archivo DESC, hp.id DESC
      `, [cedula]);
    } else {
      // Otros roles (ej. auditor)
      rows = await queryDB(`
        SELECT 
          hp.id,
          hp.practica_id,
          hp.titulo,
          hp.periodo,
          hp.fecha_inicio,
          hp.fecha_fin,
          hp.horas_totales,
          hp.cupos,
          hp.estado,
          hp.motivo_cancelacion,
          hp.descripcion,
          hp.programa_id,
          hp.programa_nombre,
          hp.asignatura_id,
          hp.asignatura_nombre,
          hp.asignatura_codigo,
          hp.institucion_id,
          hp.institucion_nombre,
          hp.servicio_id,
          hp.servicio_nombre,
          hp.docente_cedula,
          hp.docente_nombre,
          hp.docente_correo,
          hp.auditor_cedula,
          hp.auditor_nombre,
          hp.auditor_correo,
          hp.creado_por_rol,
          hp.creador_nombre,
          hp.estudiantes_info,
          hp.asistencias_resumen,
          hp.total_estudiantes,
          hp.fecha_archivo
        FROM historial_practica hp
        WHERE hp.auditor_cedula = ?
        ORDER BY hp.fecha_archivo DESC, hp.id DESC
      `, [cedula]);
    }

    // Parsear campos JSON serializados
    const formattedRows = rows.map((r) => {
      let parsedEstudiantes = [];
      let parsedAsistencias = null;
      try {
        parsedEstudiantes = typeof r.estudiantes_info === "string" ? JSON.parse(r.estudiantes_info) : (r.estudiantes_info || []);
      } catch (e) {
        parsedEstudiantes = [];
      }
      try {
        parsedAsistencias = typeof r.asistencias_resumen === "string" ? JSON.parse(r.asistencias_resumen) : r.asistencias_resumen;
      } catch (e) {
        parsedAsistencias = null;
      }

      // Si el rol es estudiante, podemos adjuntar los detalles específicos de ese estudiante
      let miDetalle = null;
      if (role === "student") {
        miDetalle = parsedEstudiantes.find((st) => String(st.cedula) === String(cedula)) || null;
      }

      return {
        ...r,
        estudiantes: parsedEstudiantes,
        asistencias: parsedAsistencias,
        miDetalle,
      };
    });

    res.status(200).json({
      success: true,
      total: formattedRows.length,
      data: formattedRows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/history/:id
 * Retorna el detalle completo de una práctica archivada.
 */
router.get("/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, cedula } = req.user;

    const rows = await queryDB(`
      SELECT * FROM historial_practica 
      WHERE id = ? OR practica_id = ? 
      LIMIT 1
    `, [id, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Registro histórico de práctica no encontrado.",
      });
    }

    const row = rows[0];

    // Validar autorización
    if (role === "docent" && String(row.docente_cedula) !== String(cedula)) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado. No eres el docente asignado a esta práctica archivada.",
      });
    }

    if (role === "student") {
      const studentAssigned = await queryDB(`
        SELECT 1 FROM historial_practica_estudiante 
        WHERE historial_id = ? AND estudiante_cedula = ? 
        LIMIT 1
      `, [row.id, cedula]);

      if (studentAssigned.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado. No estuviste vinculado a esta práctica formativa.",
        });
      }
    }

    let parsedEstudiantes = [];
    let parsedAsistencias = null;
    try {
      parsedEstudiantes = typeof row.estudiantes_info === "string" ? JSON.parse(row.estudiantes_info) : (row.estudiantes_info || []);
    } catch (e) {
      parsedEstudiantes = [];
    }
    try {
      parsedAsistencias = typeof row.asistencias_resumen === "string" ? JSON.parse(row.asistencias_resumen) : row.asistencias_resumen;
    } catch (e) {
      parsedAsistencias = null;
    }

    let miDetalle = null;
    if (role === "student") {
      miDetalle = parsedEstudiantes.find((st) => String(st.cedula) === String(cedula)) || null;
    }

    res.status(200).json({
      success: true,
      data: {
        ...row,
        estudiantes: parsedEstudiantes,
        asistencias: parsedAsistencias,
        miDetalle,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/history/sync
 * Sincronización manual de prácticas finalizadas/canceladas (Solo Admins).
 */
router.post("/sync", verifyToken, requireRole("admin", "superadmin"), async (req, res, next) => {
  try {
    const results = await syncAllFinishedAndCancelledPractices();
    res.status(200).json({
      success: true,
      message: "Sincronización de historial completada exitosamente.",
      results,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ── SUBMÓDULO: HISTORIAL DE CERTIFICADOS ──
// ============================================================
const crypto = require("crypto");

const generateHexId = () => {
  return crypto.randomBytes(8).toString("hex").toUpperCase();
};

/**
 * GET /api/history/certificates
 * Consulta de certificados en el historial:
 * - Estudiantes: Solo ven sus certificados vigentes (máximo 1 año desde emisión).
 * - Administradores / Superadministradores: Ven todos los certificados permanentemente (para siempre) con buscador y filtros.
 * - Docentes: Ven los certificados de las prácticas bajo su tutoría.
 */
router.get("/certificates/list", verifyToken, async (req, res, next) => {
  try {
    const { role, cedula } = req.user;
    if (role === "superadmin") {
      return res.status(403).json({ success: false, message: "El rol Superadministrador no tiene acceso al historial de certificados." });
    }
    const { q, programa, periodo, tipo, status } = req.query;

    let sql = "";
    let params = [];

    const constanciaCondition = `(hc.categoria_solicitud IS NULL OR hc.categoria_solicitud != 'constancia') AND (hc.tipo_certificado IS NULL OR hc.tipo_certificado NOT LIKE '%constancia%')`;

    if (role === "student") {
      // Estudiante: Máximo 1 año a partir de la fecha de emisión (solo certificados)
      sql = `
        SELECT 
          hc.*,
          DATEDIFF(hc.fecha_expiracion_estudiante, NOW()) AS dias_restantes,
          TIMESTAMPDIFF(DAY, hc.fecha_emision, NOW()) AS dias_desde_emision
        FROM historial_certificado hc
        WHERE hc.estudiante_cedula = ?
          AND (hc.fecha_expiracion_estudiante IS NULL OR hc.fecha_expiracion_estudiante >= NOW())
          AND ${constanciaCondition}
        ORDER BY hc.fecha_emision DESC, hc.id DESC
      `;
      params = [cedula];
    } else if (role === "admin") {
      // Administrador: Se guardan para siempre con buscador y filtros avanzados (solo certificados)
      let whereClauses = [constanciaCondition];

      if (q && q.trim()) {
        const searchTerm = `%${q.trim()}%`;
        whereClauses.push(`(
          hc.id_hex LIKE ? 
          OR hc.estudiante_nombre LIKE ? 
          OR CAST(hc.estudiante_cedula AS CHAR) LIKE ?
          OR hc.practica_titulo LIKE ?
          OR hc.programa_nombre LIKE ?
          OR hc.institucion_nombre LIKE ?
          OR hc.docente_nombre LIKE ?
          OR hc.tipo_certificado LIKE ?
        )`);
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (programa && programa !== "all" && programa !== "Todos") {
        whereClauses.push("hc.programa_nombre = ?");
        params.push(programa);
      }

      if (periodo && periodo !== "all" && periodo !== "Todos") {
        whereClauses.push("hc.periodo = ?");
        params.push(periodo);
      }

      if (tipo && tipo !== "all" && tipo !== "Todos") {
        whereClauses.push("hc.categoria_solicitud = ?");
        params.push(tipo);
      }

      if (status === "vigente") {
        whereClauses.push("(hc.fecha_expiracion_estudiante IS NULL OR hc.fecha_expiracion_estudiante >= NOW())");
      } else if (status === "expirado") {
        whereClauses.push("hc.fecha_expiracion_estudiante < NOW()");
      }

      sql = `
        SELECT 
          hc.*,
          DATEDIFF(hc.fecha_expiracion_estudiante, NOW()) AS dias_restantes,
          CASE 
            WHEN hc.fecha_expiracion_estudiante IS NULL OR hc.fecha_expiracion_estudiante >= NOW() THEN 1 
            ELSE 0 
          END AS vigente_estudiante
        FROM historial_certificado hc
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY hc.fecha_emision DESC, hc.id DESC
      `;
    } else if (role === "docent") {
      sql = `
        SELECT 
          hc.*,
          DATEDIFF(hc.fecha_expiracion_estudiante, NOW()) AS dias_restantes
        FROM historial_certificado hc
        WHERE hc.docente_cedula = ?
          AND ${constanciaCondition}
        ORDER BY hc.fecha_emision DESC, hc.id DESC
      `;
      params = [cedula];
    } else {
      // Auditor / Otros
      sql = `
        SELECT 
          hc.*,
          DATEDIFF(hc.fecha_expiracion_estudiante, NOW()) AS dias_restantes
        FROM historial_certificado hc
        WHERE ${constanciaCondition}
        ORDER BY hc.fecha_emision DESC, hc.id DESC
      `;
    }

    const rows = await queryDB(sql, params);

    // Formatear filas
    const certificates = rows.map((r) => {
      let meta = {};
      try {
        meta = typeof r.metadatos_json === "string" ? JSON.parse(r.metadatos_json) : (r.metadatos_json || {});
      } catch (e) {
        meta = {};
      }
      return {
        ...r,
        metadatos: meta,
      };
    });

    res.status(200).json({
      success: true,
      total: certificates.length,
      data: certificates,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/history/certificates/register
 * Registra o avala un certificado en el historial:
 * Valida:
 * 1. Si la práctica está cancelada: bloquea emisión.
 * 2. Si la práctica está finalizada: solo permite emisión hasta 30 días después.
 * 3. Genera identificador hexadecimal único y calcula vigencia de 1 año para estudiantes.
 */
router.post("/certificates/register", verifyToken, async (req, res, next) => {
  try {
    const {
      estudiante_cedula,
      practica_id,
      tipo_certificado,
      categoria_solicitud,
      motivo,
      horas_totales,
      calificacion,
      metadatos,
    } = req.body;

    if (!estudiante_cedula || !practica_id || !tipo_certificado) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios para registrar el certificado.",
      });
    }

    // 1. Validar estado y fecha fin de la práctica
    const practiceRows = await queryDB(`
      SELECT 
        pr.id, pr.titulo, pr.periodo, pr.fecha_inicio, pr.fecha_fin, pr.estado, pr.horas_totales,
        pr.institucion_id, i.nombreinstitucion AS institucion_nombre,
        pr.servicio_id, s.nombreservicio AS servicio_nombre,
        pr.programa_id, prog.nombreprograma AS programa_nombre,
        pr.docente_cedula, CONCAT(d.nombre, ' ', d.apellidos) AS docente_nombre
      FROM practica pr
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN programa prog ON pr.programa_id = prog.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      WHERE pr.id = ?
      LIMIT 1
    `, [practica_id]);

    if (practiceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Práctica formativa no encontrada.",
      });
    }

    const pr = practiceRows[0];

    // Regla: Práctica cancelada no permite emitir certificados ni reportes
    if (pr.estado === "Cancelada") {
      return res.status(400).json({
        success: false,
        message: "La práctica formativa está cancelada. Por normativa institucional, no se pueden emitir certificados ni constancias de prácticas canceladas.",
      });
    }

    // Regla: Práctica finalizada solo permite emitir certificados hasta 30 días después
    if (pr.estado === "Finalizada") {
      if (pr.fecha_fin) {
        const endDate = new Date(pr.fecha_fin);
        const now = new Date();
        const diffDays = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) {
          return res.status(400).json({
            success: false,
            message: `El plazo máximo de 30 días posteriores a la finalización de la práctica ha expirado (${Math.floor(diffDays)} días transcurridos desde ${pr.fecha_fin.toISOString().split("T")[0]}). Ya no es posible emitir nuevos certificados.`,
          });
        }
      }
    }

    // Obtener datos del estudiante
    const studentRows = await queryDB(`
      SELECT cedula, nombre, apellidos, codigo, correo_institucional
      FROM estudiante
      WHERE cedula = ?
      LIMIT 1
    `, [estudiante_cedula]);

    const est = studentRows[0] || {};
    const estNombre = `${est.nombre || ""} ${est.apellidos || ""}`.trim() || `Estudiante ${estudiante_cedula}`;

    // Obtener nota real de la práctica
    let finalGrade = calificacion !== undefined ? calificacion : null;
    let finalHours = horas_totales || pr.horas_totales || 120;

    const peRows = await queryDB(`
      SELECT calificacion, horas_cumplidas 
      FROM practica_estudiante 
      WHERE practica_id = ? AND estudiante_cedula = ?
      LIMIT 1
    `, [practica_id, estudiante_cedula]);

    if (peRows.length > 0) {
      if (finalGrade === null) finalGrade = peRows[0].calificacion;
      if (peRows[0].horas_cumplidas) finalHours = peRows[0].horas_cumplidas;
    }

    // Generar identificador hexadecimal único
    const idHex = generateHexId();

    const insertResult = await queryDB(`
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), ?)
    `, [
      idHex,
      estudiante_cedula,
      estNombre,
      est.codigo || null,
      est.correo_institucional || null,
      practica_id,
      pr.titulo,
      pr.programa_nombre,
      pr.institucion_nombre,
      pr.servicio_nombre,
      pr.docente_nombre,
      pr.docente_cedula,
      finalHours,
      finalGrade,
      pr.periodo,
      tipo_certificado,
      categoria_solicitud || "certificado",
      motivo || "Emisión Oficial",
      pr.fecha_inicio,
      pr.fecha_fin,
      JSON.stringify(metadatos || {}),
    ]);

    res.status(201).json({
      success: true,
      message: "Certificado archivado exitosamente en el historial.",
      certificateId: insertResult.insertId,
      id_hex: idHex,
      fecha_expiracion_estudiante: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/history/certificates/verify/:hexId
 * Consulta y verificación por código hexadecimal único
 */
router.get("/certificates/verify/:hexId", async (req, res, next) => {
  try {
    const { hexId } = req.params;
    const rows = await queryDB(`
      SELECT * FROM historial_certificado WHERE id_hex = ? LIMIT 1
    `, [hexId.toUpperCase().trim()]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Certificado no encontrado con el identificador hexadecimal proporcionado.",
      });
    }

    res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

