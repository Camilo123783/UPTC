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
    let rows = [];

    if (role === "admin" || role === "superadmin") {
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

module.exports = router;
