// ============================================================
// routes/docent.routes.js — Rutas del docente
// ============================================================
"use strict";

const express = require("express");
const router = express.Router();
const { queryDB, getColombiaToday } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { archivePractice } = require("../services/history.service");

// Todas las rutas de docente requieren autenticación con token JWT y rol 'docent', 'admin' o 'superadmin'
router.use(verifyToken);
router.use(requireRole("docent", "admin", "superadmin"));

/**
 * Helper para obtener el docentId legítimo:
 * Si el usuario es docente, se fuerza a su propia cédula del JWT para evitar IDOR.
 */
function getEffectiveDocentId(req) {
  if (req.user?.role === "docent") {
    return req.user.cedula;
  }
  return req.params.docentId || req.query.docentId || req.user?.cedula;
}

// ──────────────────────────────────────────────
// GET /api/docent/profile
// Obtener información institucional del docente, su foto de perfil y su firma digital
// ──────────────────────────────────────────────
router.get("/profile", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    if (!docentId) {
      return res.status(400).json({ success: false, message: "Cédula del docente no especificada." });
    }
    const rows = await queryDB(
      `SELECT d.id, d.cedula, d.nombre, d.apellidos, d.correo_institucional, 
              d.foto_perfil, d.foto_firma, p.nombreprograma 
       FROM docente d 
       LEFT JOIN programa p ON d.programa_id = p.id 
       WHERE d.cedula = ? LIMIT 1`,
      [docentId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Docente no encontrado." });
    }
    const doc = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: doc.id,
        cedula: doc.cedula,
        nombre: doc.nombre,
        apellidos: doc.apellidos,
        nombre_completo: `${doc.nombre} ${doc.apellidos}`.trim(),
        correo_institucional: doc.correo_institucional,
        programa: doc.nombreprograma || "Facultad de Ciencias de la Salud",
        foto_perfil: doc.foto_perfil || null,
        foto_firma: doc.foto_firma || null,
        has_signature: Boolean(doc.foto_firma),
        has_photo: Boolean(doc.foto_perfil),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/docent/profile
// Actualizar únicamente foto de perfil y/o foto de la firma
// ──────────────────────────────────────────────
router.put("/profile", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    if (!docentId) {
      return res.status(400).json({ success: false, message: "Cédula del docente no especificada." });
    }
    const { foto_perfil, foto_firma } = req.body;

    const updates = [];
    const values = [];

    if (foto_perfil !== undefined) {
      updates.push("foto_perfil = ?");
      values.push(foto_perfil);
    }
    if (foto_firma !== undefined) {
      updates.push("foto_firma = ?");
      values.push(foto_firma);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No se proporcionaron campos para actualizar.",
      });
    }

    values.push(docentId);
    await queryDB(`UPDATE docente SET ${updates.join(", ")} WHERE cedula = ?`, values);

    return res.status(200).json({
      success: true,
      message: "Datos del perfil docente y firma actualizados exitosamente.",
      has_signature: foto_firma ? true : undefined,
      has_photo: foto_perfil ? true : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/pending-documents-count
// Conteo de solicitudes de certificados/reportes pendientes de aprobación por el docente
// ──────────────────────────────────────────────
router.get("/pending-documents-count", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    if (!docentId) {
      return res.status(200).json({ success: true, pendingCount: 0 });
    }
    const rows = await queryDB(
      `SELECT COUNT(DISTINCT sc.id) AS pendingCount 
       FROM solicitud_certificado sc
       JOIN practica p ON sc.practica_id = p.id
       WHERE (sc.docente_cedula = ? OR p.docente_cedula = ?)
         AND sc.estado = 'Pendiente'`,
      [docentId, docentId]
    );
    const pendingCount = rows[0]?.pendingCount || 0;
    return res.status(200).json({ success: true, pendingCount: Number(pendingCount) });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/practices/:docentId (o /practices)
// ──────────────────────────────────────────────
router.get(["/practices", "/practices/:docentId"], async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);

    if (!docentId) {
      return res.status(400).json({
        success: false,
        message: "Cédula del docente no especificada.",
      });
    }

    // Sincronizar automáticamente el ciclo de vida de las prácticas por fechas (hora Colombia UTC-5):
    const todayStr = getColombiaToday();

    // 1. Si llegó o pasó la fecha final -> 'Finalizada'
    const newlyFinished = await queryDB(`
      SELECT id FROM practica 
      WHERE estado != 'Cancelada' 
        AND estado != 'Finalizada' 
        AND fecha_fin IS NOT NULL 
        AND ? >= fecha_fin
    `, [todayStr]);

    if (newlyFinished.length > 0) {
      await queryDB(`
        UPDATE practica 
        SET estado = 'Finalizada' 
        WHERE estado != 'Cancelada' 
          AND estado != 'Finalizada' 
          AND fecha_fin IS NOT NULL 
          AND ? >= fecha_fin
      `, [todayStr]);

      for (const nf of newlyFinished) {
        try {
          await archivePractice(nf.id);
        } catch (e) {
          console.error(`Error archivando práctica #${nf.id}:`, e.message);
        }
      }
    }

    // 2. Si llegó la fecha de inicio y no ha terminado -> 'Activa'
    await queryDB(`
      UPDATE practica 
      SET estado = 'Activa' 
      WHERE estado = 'Planificada' 
        AND fecha_inicio IS NOT NULL 
        AND ? >= fecha_inicio 
        AND (fecha_fin IS NULL OR ? < fecha_fin)
    `, [todayStr, todayStr]);

    // 3. Si la fecha de inicio aún no ha llegado (es futura) -> 'Planificada'
    await queryDB(`
      UPDATE practica 
      SET estado = 'Planificada' 
      WHERE estado = 'Activa' 
        AND fecha_inicio IS NOT NULL 
        AND ? < fecha_inicio
    `, [todayStr]);

    // 1. Obtener todas las prácticas asignadas a este docente
    const practices = await queryDB(`
      SELECT 
        pr.id,
        pr.titulo,
        pr.periodo,
        pr.fecha_inicio,
        pr.fecha_fin,
        pr.horas_totales,
        pr.cupos,
        pr.estado,
        pr.motivo_cancelacion,
        pr.descripcion,
        pr.created_at,
        pr.programa_id,
        p.nombreprograma AS programa_nombre,
        pr.asignatura_id,
        a.nombreasignatura AS asignatura_nombre,
        a.codigoasignatura AS asignatura_codigo,
        pr.institucion_id,
        i.nombreinstitucion AS institucion_nombre,
        pr.servicio_id,
        s.nombreservicio AS servicio_nombre,
        pr.docente_cedula,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre,
        d.correo_institucional AS docente_correo,
        pr.auditor_cedula,
        CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')) AS auditor_nombre,
        au.correo_institucional AS auditor_correo,
        pr.creado_por_rol,
        pr.creado_por_cedula,
        pr.creador_nombre,
        (
          SELECT COUNT(*)
          FROM observacion_practica op
          WHERE op.practica_id = pr.id
            AND op.autor_rol = 'auditor'
            AND op.leido = 0
        ) AS unread_messages_count
      FROM practica pr
      LEFT JOIN programa p ON pr.programa_id = p.id
      LEFT JOIN asignatura a ON pr.asignatura_id = a.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      LEFT JOIN auditor au ON pr.auditor_cedula = au.cedula
      WHERE pr.docente_cedula = ?
      ORDER BY pr.fecha_inicio DESC, pr.id DESC
    `, [docentId]);

    if (practices.length === 0) {
      return res.status(200).json([]);
    }

    const practiceIds = practices.map((p) => p.id);
    const placeholders = practiceIds.map(() => "?").join(",");

    // 2. Obtener los estudiantes asignados a estas prácticas
    const studentsRows = await queryDB(`
      SELECT 
        pe.id AS asignacion_id,
        pe.practica_id,
        pe.estudiante_cedula,
        pe.estado AS estado_asignacion,
        pe.calificacion,
        pe.retroalimentacion,
        pe.fecha_evaluacion,
        pe.estado_evaluacion,
        pe.criterios,
        pe.horas_cumplidas,
        pe.horas_asignadas,
        pe.created_at AS asignado_en,
        e.nombre,
        e.apellidos,
        e.codigo,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS nombre_completo,
        e.correo_institucional,
        p.nombreprograma AS carrera,
        de.telefono,
        de.correo_personal,
        de.biografia,
        (de.foto_perfil IS NOT NULL) AS tiene_foto,
        (de.hoja_vida_digital IS NOT NULL) AS has_cv,
        (de.seguridad_social_eps IS NOT NULL) AS has_eps,
        (de.riesgos_profesionales_arl IS NOT NULL) AS has_arl,
        (de.copia_documento_identidad IS NOT NULL) AS has_id,
        (de.copia_carnet_estudiantil IS NOT NULL) AS has_carnet,
        (de.carnet_vacunas IS NOT NULL) AS has_vaccines
      FROM practica_estudiante pe
      LEFT JOIN estudiante e ON pe.estudiante_cedula = e.cedula
      LEFT JOIN programa p ON e.programa_id = p.id
      LEFT JOIN datos_estudiante de ON pe.estudiante_cedula = de.cedula_estudiante
      WHERE pe.practica_id IN (${placeholders})
      ORDER BY e.apellidos ASC, e.nombre ASC
    `, practiceIds);

    const studentsMap = {};
    studentsRows.forEach((st) => {
      if (!studentsMap[st.practica_id]) {
        studentsMap[st.practica_id] = [];
      }

      let criteriosParsed = null;
      if (st.criterios) {
        try {
          criteriosParsed = typeof st.criterios === "string" ? JSON.parse(st.criterios) : st.criterios;
        } catch (e) {
          criteriosParsed = null;
        }
      }

      studentsMap[st.practica_id].push({
        id: st.estudiante_cedula,
        cedula: String(st.estudiante_cedula),
        codigo: st.codigo || null,
        nombre: st.nombre,
        apellidos: st.apellidos,
        nombre_completo: st.nombre_completo.trim() || `Estudiante #${st.estudiante_cedula}`,
        correo: st.correo_institucional,
        carrera: st.carrera,
        telefono: st.telefono || null,
        correo_personal: st.correo_personal || null,
        biografia: st.biografia || null,
        tiene_foto: !!st.tiene_foto,
        foto_url: st.tiene_foto ? `/api/student/photo/${st.estudiante_cedula}` : null,
        has_cv: !!st.has_cv,
        has_eps: !!st.has_eps,
        has_arl: !!st.has_arl,
        has_id: !!st.has_id,
        has_carnet: !!st.has_carnet,
        has_vaccines: !!st.has_vaccines,
        docs_count: [st.has_cv, st.has_eps, st.has_arl, st.has_id, st.has_carnet, st.has_vaccines].filter(Boolean).length,
        estado: st.estado_asignacion === "Activo" ? "Activo" : "Pendiente",
        estado_asignacion: st.estado_asignacion === "Activo" ? "Activo" : "Pendiente",
        calificacion: st.calificacion !== null ? Number(st.calificacion) : null,
        score: st.calificacion !== null ? Number(st.calificacion) : null,
        retroalimentacion: st.retroalimentacion || null,
        feedback: st.retroalimentacion || null,
        fecha_evaluacion: st.fecha_evaluacion,
        estado_evaluacion: st.estado_evaluacion || (st.calificacion !== null ? "Completada" : "Pendiente"),
        evaluationStatus: st.estado_evaluacion || (st.calificacion !== null ? "Completada" : "Pendiente"),
        criterios: criteriosParsed,
        likertScores: criteriosParsed,
        asignado_en: st.asignado_en,
        horas_cumplidas: Number(st.horas_cumplidas || 0),
        horas_asignadas: st.horas_asignadas !== null && st.horas_asignadas !== undefined ? Number(st.horas_asignadas) : null,
      });
    });

    // 3. Obtener las observaciones registradas para estas prácticas
    const observationsRows = await queryDB(`
      SELECT 
        o.id,
        o.practica_id,
        o.autor_rol,
        o.autor_cedula,
        o.autor_nombre,
        o.docente_cedula,
        o.auditor_cedula,
        o.admin_cedula,
        o.estudiante_cedula,
        o.titulo,
        o.observacion,
        o.tipo,
        o.created_at,
        COALESCE(
          NULLIF(o.autor_nombre, ''),
          IF(o.autor_rol = 'auditor', CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')), CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, ''))),
          IF(o.autor_rol = 'auditor', 'Auditor Clínico', 'Docente')
        ) AS autor_display_nombre,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre,
        CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')) AS auditor_nombre,
        au.correo_institucional AS auditor_correo,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre
      FROM observacion_practica o
      LEFT JOIN docente d ON o.docente_cedula = d.cedula
      LEFT JOIN auditor au ON (o.auditor_cedula = au.cedula OR (o.autor_rol = 'auditor' AND o.autor_cedula = au.cedula))
      LEFT JOIN estudiante e ON o.estudiante_cedula = e.cedula
      WHERE o.practica_id IN (${placeholders})
      ORDER BY o.created_at DESC
    `, practiceIds);

    const observationsMap = {};
    observationsRows.forEach((obs) => {
      if (!observationsMap[obs.practica_id]) {
        observationsMap[obs.practica_id] = [];
      }
      observationsMap[obs.practica_id].push({
        id: obs.id,
        practica_id: obs.practica_id,
        autor_rol: obs.autor_rol || "docente",
        autor_cedula: obs.autor_cedula || obs.docente_cedula,
        autor_nombre: obs.autor_display_nombre?.trim() || `Autor #${obs.autor_cedula || obs.docente_cedula}`,
        docente_cedula: obs.docente_cedula,
        docente_nombre: obs.docente_nombre?.trim() || `Docente #${obs.docente_cedula || obs.autor_cedula}`,
        auditor_cedula: obs.auditor_cedula,
        auditor_nombre: obs.auditor_nombre?.trim() || null,
        auditor_correo: obs.auditor_correo || null,
        estudiante_cedula: obs.estudiante_cedula,
        estudiante_nombre: obs.estudiante_cedula ? (obs.estudiante_nombre?.trim() || `Estudiante #${obs.estudiante_cedula}`) : null,
        es_general: !obs.estudiante_cedula,
        titulo: obs.titulo,
        observacion: obs.observacion,
        tipo: obs.tipo || "General",
        created_at: obs.created_at,
      });
    });

    // 4. Consolidar la respuesta
    const result = practices.map((pr) => {
      const fFin = pr.fecha_fin ? String(pr.fecha_fin).substring(0, 10) : null;
      let diasRestantes = null;
      let alertaCierre = false;

      if (fFin && (pr.estado === "Activa" || pr.estado === "En Curso")) {
        const diffTime = new Date(fFin + "T23:59:59-05:00") - new Date(todayStr + "T00:00:00-05:00");
        diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diasRestantes >= 0 && diasRestantes <= 7) {
          alertaCierre = true;
        }
      }

      return {
        ...pr,
        dias_restantes: diasRestantes,
        alerta_cierre: alertaCierre,
        estudiantes: studentsMap[pr.id] || [],
        total_estudiantes: (studentsMap[pr.id] || []).length,
        observaciones: observationsMap[pr.id] || [],
        total_observaciones: (observationsMap[pr.id] || []).length,
      };
    });

    console.log(`✅ Prácticas consultadas para docente ${docentId}: ${result.length} encontrada(s).`);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/docent/practices/:practiceId/observations
// ──────────────────────────────────────────────
router.post("/practices/:practiceId/observations", async (req, res, next) => {
  try {
    const { practiceId } = req.params;
    const { docente_cedula, estudiante_cedula, titulo, observacion, tipo } = req.body;

    const authorCedula = docente_cedula || req.user?.cedula;

    if (!authorCedula) {
      return res.status(400).json({
        success: false,
        message: "No se identificó la cédula del docente autor de la observación.",
      });
    }

    if (!observacion || !observacion.trim()) {
      return res.status(400).json({
        success: false,
        message: "El texto de la observación es obligatorio.",
      });
    }

    // Verificar que la práctica exista
    const practCheck = await queryDB(`SELECT id, titulo FROM practica WHERE id = ?`, [practiceId]);
    if (practCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Práctica no encontrada.",
      });
    }

    // Resolver datos del autor (docente, auditor o admin)
    let autorRol = "docente";
    let autorNombre = null;
    let docenteCedula = authorCedula;
    let auditorCedula = null;
    let adminCedula = null;

    const docRows = await queryDB("SELECT nombre, apellidos FROM docente WHERE cedula = ? LIMIT 1", [authorCedula]);
    if (docRows.length > 0) {
      autorNombre = `${docRows[0].nombre || ""} ${docRows[0].apellidos || ""}`.trim();
    } else {
      const audRows = await queryDB("SELECT nombre, apellidos FROM auditor WHERE cedula = ? LIMIT 1", [authorCedula]);
      if (audRows.length > 0) {
        autorRol = "auditor";
        docenteCedula = null;
        auditorCedula = authorCedula;
        autorNombre = `${audRows[0].nombre || ""} ${audRows[0].apellidos || ""}`.trim();
      } else {
        const admRows = await queryDB("SELECT nombre, apellidos FROM administrador WHERE cedula = ? LIMIT 1", [authorCedula]);
        if (admRows.length > 0) {
          autorRol = "admin";
          docenteCedula = null;
          adminCedula = authorCedula;
          autorNombre = `${admRows[0].nombre || ""} ${admRows[0].apellidos || ""}`.trim();
        } else {
          const saRows = await queryDB("SELECT nombre, apellidos FROM superadmin WHERE cedula = ? LIMIT 1", [authorCedula]);
          if (saRows.length > 0) {
            autorRol = "superadmin";
            docenteCedula = null;
            autorNombre = `${saRows[0].nombre || ""} ${saRows[0].apellidos || ""}`.trim();
          }
        }
      }
    }

    const insertResult = await queryDB(`
      INSERT INTO observacion_practica (
        practica_id,
        autor_rol,
        autor_cedula,
        autor_nombre,
        docente_cedula,
        auditor_cedula,
        admin_cedula,
        estudiante_cedula,
        titulo,
        observacion,
        tipo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      practiceId,
      autorRol,
      authorCedula,
      autorNombre,
      docenteCedula,
      auditorCedula,
      adminCedula,
      estudiante_cedula || null,
      titulo ? titulo.trim() : null,
      observacion.trim(),
      tipo || "General",
    ]);

    const newObsId = insertResult.insertId;

    // Consultar la observación recién creada para retornarla con nombres
    const rows = await queryDB(`
      SELECT 
        o.id,
        o.practica_id,
        o.autor_rol,
        o.autor_cedula,
        o.autor_nombre,
        o.docente_cedula,
        o.auditor_cedula,
        o.admin_cedula,
        o.estudiante_cedula,
        o.titulo,
        o.observacion,
        o.tipo,
        o.created_at,
        COALESCE(NULLIF(o.autor_nombre, ''), CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, ''))) AS docente_nombre,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre
      FROM observacion_practica o
      LEFT JOIN docente d ON o.docente_cedula = d.cedula
      LEFT JOIN estudiante e ON o.estudiante_cedula = e.cedula
      WHERE o.id = ?
    `, [newObsId]);

    const createdObs = rows[0] ? {
      id: rows[0].id,
      practica_id: rows[0].practica_id,
      autor_rol: rows[0].autor_rol || autorRol,
      autor_cedula: rows[0].autor_cedula || authorCedula,
      autor_nombre: rows[0].autor_nombre || autorNombre,
      docente_cedula: rows[0].docente_cedula,
      docente_nombre: rows[0].docente_nombre?.trim() || autorNombre || `Docente #${authorCedula}`,
      estudiante_cedula: rows[0].estudiante_cedula,
      estudiante_nombre: rows[0].estudiante_cedula ? (rows[0].estudiante_nombre?.trim() || `Estudiante #${rows[0].estudiante_cedula}`) : null,
      es_general: !rows[0].estudiante_cedula,
      titulo: rows[0].titulo,
      observacion: rows[0].observacion,
      tipo: rows[0].tipo,
      created_at: rows[0].created_at,
    } : null;

    console.log(`✅ Observación #${newObsId} creada para la práctica #${practiceId} por ${autorRol} ${authorCedula}.`);
    res.status(201).json({
      success: true,
      message: "Observación guardada con éxito.",
      data: createdObs,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/docent/observations/:id
// ──────────────────────────────────────────────
router.delete("/observations/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await queryDB(`SELECT id, practica_id FROM observacion_practica WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Observación no encontrada.",
      });
    }

    await queryDB(`DELETE FROM observacion_practica WHERE id = ?`, [id]);

    console.log(`✅ Observación #${id} eliminada.`);
    res.status(200).json({
      success: true,
      message: "Observación eliminada correctamente.",
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/catalogs (Catálogos para creación de prácticas)
// ──────────────────────────────────────────────
router.get("/catalogs", async (req, res, next) => {
  try {
    const docentCedula = getEffectiveDocentId(req) || req.query.docente_cedula;
    let docentProgramaId = null;
    let docentProgramaNombre = null;

    if (docentCedula) {
      const docRows = await queryDB(
        `SELECT d.programa_id, p.nombreprograma 
         FROM docente d 
         LEFT JOIN programa p ON d.programa_id = p.id 
         WHERE d.cedula = ? LIMIT 1`,
        [docentCedula]
      );
      if (docRows.length > 0 && docRows[0].programa_id) {
        docentProgramaId = docRows[0].programa_id;
        docentProgramaNombre = docRows[0].nombreprograma;
      }
    }

    const programasQuery = docentProgramaId
      ? queryDB(
          `SELECT 
            id, 
            nombreprograma, 
            nombreprograma AS Nombre, 
            nombreprograma AS nombre 
          FROM programa 
          WHERE id = ?
          ORDER BY nombreprograma`,
          [docentProgramaId]
        )
      : queryDB(`
          SELECT 
            id, 
            nombreprograma, 
            nombreprograma AS Nombre, 
            nombreprograma AS nombre 
          FROM programa 
          ORDER BY nombreprograma
        `);

    const asignaturasQuery = docentProgramaId
      ? queryDB(
          `SELECT 
            id, 
            id AS id_asignatura_table,
            codigoasignatura, 
            codigoasignatura AS Codigo,
            codigoasignatura AS codigo,
            nombreasignatura, 
            nombreasignatura AS Nombre,
            nombreasignatura AS nombre,
            programa_id,
            programa_id AS Programa_id
          FROM asignatura 
          WHERE programa_id = ?
          ORDER BY nombreasignatura`,
          [docentProgramaId]
        )
      : queryDB(`
          SELECT 
            id, 
            id AS id_asignatura_table,
            codigoasignatura, 
            codigoasignatura AS Codigo,
            codigoasignatura AS codigo,
            nombreasignatura, 
            nombreasignatura AS Nombre,
            nombreasignatura AS nombre,
            programa_id,
            programa_id AS Programa_id
          FROM asignatura 
          ORDER BY nombreasignatura
        `);

    const estudiantesQuery = docentProgramaId
      ? queryDB(
          `SELECT 
            e.cedula,
            e.cedula AS Cédula,
            e.nombre,
            e.nombre AS Nombre,
            e.apellidos,
            e.apellidos AS Apellidos,
            CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS nombre_completo,
            e.correo_institucional,
            e.correo_institucional AS correo,
            e.correo_institucional AS Correo,
            e.programa_id,
            p.nombreprograma AS carrera,
            p.nombreprograma AS Carrera
          FROM estudiante e
          LEFT JOIN programa p ON e.programa_id = p.id
          WHERE e.programa_id = ?
          ORDER BY e.apellidos ASC, e.nombre ASC`,
          [docentProgramaId]
        )
      : queryDB(`
          SELECT 
            e.cedula,
            e.cedula AS Cédula,
            e.nombre,
            e.nombre AS Nombre,
            e.apellidos,
            e.apellidos AS Apellidos,
            CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS nombre_completo,
            e.correo_institucional,
            e.correo_institucional AS correo,
            e.correo_institucional AS Correo,
            e.programa_id,
            p.nombreprograma AS carrera,
            p.nombreprograma AS Carrera
          FROM estudiante e
          LEFT JOIN programa p ON e.programa_id = p.id
          ORDER BY e.apellidos ASC, e.nombre ASC
        `);

    const [programas, asignaturas, instituciones, servicios, estudiantes, auditores] = await Promise.all([
      programasQuery,
      asignaturasQuery,
      queryDB(`
        SELECT 
          id, 
          nombreinstitucion, 
          nombreinstitucion AS Nombre, 
          nombreinstitucion AS nombre
        FROM institucion 
        ORDER BY nombreinstitucion
      `),
      queryDB(`
        SELECT 
          id, 
          id AS id_servicio_table,
          nombreservicio, 
          nombreservicio AS Nombre, 
          nombreservicio AS nombre,
          institucion_id,
          institucion_id AS Institucion_id
        FROM servicio 
        ORDER BY nombreservicio
      `),
      estudiantesQuery,
      queryDB(`
        SELECT 
          cedula,
          cedula AS Cédula,
          nombre,
          nombre AS Nombre,
          apellidos,
          apellidos AS Apellidos,
          CONCAT(COALESCE(nombre, ''), ' ', COALESCE(apellidos, '')) AS nombre_completo,
          correo_institucional,
          correo_institucional AS correo,
          institucion_id,
          institucion_id AS Institucion_id
        FROM auditor
        ORDER BY nombre ASC
      `),
    ]);

    res.status(200).json({
      programas,
      asignaturas,
      instituciones,
      servicios,
      estudiantes,
      auditores,
      docent_programa_id: docentProgramaId,
      docent_programa_nombre: docentProgramaNombre,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/docent/practices/:id (Editar Práctica Formativa)
// ──────────────────────────────────────────────
// PUT /api/docent/practices/:id (Editar Práctica Formativa)
// ──────────────────────────────────────────────
router.put(["/practices/:id", "/practice/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      titulo,
      programa_id,
      asignatura_id,
      institucion_id,
      servicio_id,
      auditor_cedula,
      periodo,
      fecha_inicio,
      fecha_fin,
      horas_totales,
      cupos,
      estado,
      descripcion,
      estudiantes,
    } = req.body;

    const docentCedula = req.body.docente_cedula || req.user?.cedula;

    const existing = await queryDB(`SELECT id, estado, docente_cedula, programa_id FROM practica WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Práctica formativa no encontrada." });
    }

    // Una práctica ya finalizada o cancelada no puede ser modificada
    if (existing[0].estado === "Finalizada" || existing[0].estado === "Cancelada") {
      return res.status(400).json({
        success: false,
        message: "Esta práctica ya se encuentra finalizada o cancelada y no admite modificaciones. Toda su información ha sido archivada de forma inmutable en el Historial.",
      });
    }

    // Obtener información académica del docente
    let effectiveProgramaId = programa_id;
    if (docentCedula) {
      const docRows = await queryDB(
        `SELECT d.cedula, d.programa_id, p.nombreprograma 
         FROM docente d 
         LEFT JOIN programa p ON d.programa_id = p.id 
         WHERE d.cedula = ? LIMIT 1`,
        [docentCedula]
      );
      if (docRows.length > 0 && docRows[0].programa_id) {
        const docentProgramaId = docRows[0].programa_id;
        const docentProgramaNombre = docRows[0].nombreprograma || "Asignado";

        if (programa_id && Number(programa_id) !== Number(docentProgramaId)) {
          return res.status(403).json({
            success: false,
            message: `Acceso restringido: Solo puedes gestionar prácticas para tu programa académico (${docentProgramaNombre}).`,
          });
        }
        effectiveProgramaId = docentProgramaId;
      }
    }

    // Validar que la asignatura pertenezca al programa académico
    if (effectiveProgramaId && asignatura_id) {
      const asigRows = await queryDB(
        `SELECT id, programa_id, nombreasignatura FROM asignatura WHERE id = ? LIMIT 1`,
        [asignatura_id]
      );
      if (asigRows.length > 0 && asigRows[0].programa_id && Number(asigRows[0].programa_id) !== Number(effectiveProgramaId)) {
        return res.status(403).json({
          success: false,
          message: `La asignatura seleccionada no pertenece a tu programa académico.`,
        });
      }
    }

    // Validar que los estudiantes asignados pertenezcan exclusivamente al programa del docente
    if (Array.isArray(estudiantes) && estudiantes.length > 0 && effectiveProgramaId) {
      const checkCedulas = estudiantes
        .map((item) => String(typeof item === "object" ? item.cedula || item.Cédula : item))
        .filter(Boolean);

      if (checkCedulas.length > 0) {
        const ph = checkCedulas.map(() => "?").join(",");
        const invalidStudents = await queryDB(
          `SELECT e.cedula, e.nombre, e.apellidos, e.programa_id, p.nombreprograma 
           FROM estudiante e 
           LEFT JOIN programa p ON e.programa_id = p.id 
           WHERE e.cedula IN (${ph}) AND (e.programa_id IS NULL OR e.programa_id != ?)`,
          [...checkCedulas, effectiveProgramaId]
        );
        if (invalidStudents.length > 0) {
          const names = invalidStudents
            .map((s) => `${s.nombre} ${s.apellidos} (${s.nombreprograma || "Sin programa"})`)
            .join(", ");
          return res.status(403).json({
            success: false,
            message: `No puedes asignar estudiantes de otros programas académicos: ${names}.`,
          });
        }
      }
    }

    // Determinar ciclo de vida del estado según fechas (hora Colombia):
    const todayStr = getColombiaToday();
    const fFin = fecha_fin ? (typeof fecha_fin === "string" ? fecha_fin.substring(0, 10) : "") : "";
    const fIni = fecha_inicio ? (typeof fecha_inicio === "string" ? fecha_inicio.substring(0, 10) : "") : "";

    let finalEstado = estado;
    let finalMotivo = req.body.motivo_cancelacion || null;

    if (finalEstado === "Cancelada") {
      if (!finalMotivo || !finalMotivo.trim()) {
        return res.status(400).json({
          success: false,
          message: "Es obligatorio argumentar y especificar el motivo por el cual se cancela la práctica formativa.",
        });
      }
      finalMotivo = finalMotivo.trim();
    } else {
      if (fFin && todayStr >= fFin) {
        finalEstado = "Finalizada";
      } else if (fIni && todayStr < fIni) {
        finalEstado = "Planificada";
      } else if (fIni && todayStr >= fIni) {
        finalEstado = "Activa";
      }
    }

    await queryDB(`
      UPDATE practica SET
        titulo = COALESCE(?, titulo),
        programa_id = ?,
        asignatura_id = ?,
        institucion_id = ?,
        servicio_id = ?,
        auditor_cedula = ?,
        periodo = COALESCE(?, periodo),
        fecha_inicio = ?,
        fecha_fin = ?,
        horas_totales = COALESCE(?, horas_totales),
        cupos = COALESCE(?, cupos),
        estado = COALESCE(?, estado),
        motivo_cancelacion = ?,
        descripcion = ?
      WHERE id = ?
    `, [
      titulo || null,
      effectiveProgramaId || null,
      asignatura_id || null,
      institucion_id || null,
      servicio_id || null,
      auditor_cedula || null,
      periodo || null,
      fecha_inicio || null,
      fecha_fin || null,
      horas_totales ? parseInt(horas_totales, 10) : null,
      cupos ? parseInt(cupos, 10) : null,
      finalEstado || null,
      finalMotivo || null,
      descripcion || null,
      id,
    ]);

    if (Array.isArray(estudiantes)) {
      const newCedulas = estudiantes
        .map((item) => String(typeof item === "object" ? item.cedula || item.Cédula : item))
        .filter(Boolean);

      if (newCedulas.length > 0) {
        const ph = newCedulas.map(() => "?").join(",");
        await queryDB(
          `DELETE FROM practica_estudiante WHERE practica_id = ? AND estudiante_cedula NOT IN (${ph})`,
          [id, ...newCedulas]
        );
        for (const ced of newCedulas) {
          await queryDB(
            `INSERT INTO practica_estudiante (practica_id, estudiante_cedula, estado)
             VALUES (?, ?, 'Asignado')
             ON DUPLICATE KEY UPDATE estado = VALUES(estado)`,
            [id, ced]
          );
        }
      } else {
        await queryDB(`DELETE FROM practica_estudiante WHERE practica_id = ?`, [id]);
      }
    }

    // Si la práctica quedó Finalizada o Cancelada, archivar inmediatamente en el Historial
    if (finalEstado === "Finalizada" || finalEstado === "Cancelada") {
      try {
        await archivePractice(id, finalMotivo);
      } catch (archErr) {
        console.error(`Error archivando práctica #${id} tras actualización docente:`, archErr.message);
      }
    }

    console.log(`✅ Práctica #${id} "${titulo}" actualizada por Docente.`);
    res.status(200).json({ success: true, message: "Práctica formativa actualizada con éxito." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/docent/practices (Crear Práctica Formativa por Docente)
// ──────────────────────────────────────────────
router.post(["/practices", "/practice"], async (req, res, next) => {
  try {
    const {
      titulo,
      programa_id,
      asignatura_id,
      institucion_id,
      servicio_id,
      auditor_cedula,
      periodo,
      fecha_inicio,
      fecha_fin,
      horas_totales,
      cupos,
      estado,
      descripcion,
      estudiantes,
    } = req.body;

    const docentCedula = req.body.docente_cedula || req.user?.cedula;

    if (!docentCedula) {
      return res.status(400).json({
        success: false,
        message: "No se identificó la cédula del docente responsable.",
      });
    }

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({
        success: false,
        message: "El título de la práctica es obligatorio.",
      });
    }

    // Obtener información académica del docente
    const docRows = await queryDB(
      `SELECT d.cedula, d.programa_id, 
              CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS nombre_completo,
              p.nombreprograma 
       FROM docente d 
       LEFT JOIN programa p ON d.programa_id = p.id 
       WHERE d.cedula = ? LIMIT 1`,
      [docentCedula]
    );
    const docentData = docRows[0];
    const docentProgramaId = docentData?.programa_id;
    const docentProgramaNombre = docentData?.nombreprograma || "Asignado";
    const docentName = docentData?.nombre_completo?.trim() || (req.user?.nombre ? `${req.user.nombre} (Docente)` : `Docente #${docentCedula}`);

    let effectiveProgramaId = programa_id;
    // Si el docente está vinculado a un programa, restringir estrictamente a ese programa
    if (docentProgramaId) {
      if (programa_id && Number(programa_id) !== Number(docentProgramaId)) {
        return res.status(403).json({
          success: false,
          message: `Acceso restringido: Solo puedes crear prácticas para tu programa académico asignado (${docentProgramaNombre}).`,
        });
      }
      effectiveProgramaId = docentProgramaId;
    }

    // Validar que la asignatura pertenezca al programa académico del docente
    if (effectiveProgramaId && asignatura_id) {
      const asigRows = await queryDB(
        `SELECT id, programa_id, nombreasignatura FROM asignatura WHERE id = ? LIMIT 1`,
        [asignatura_id]
      );
      if (asigRows.length > 0 && asigRows[0].programa_id && Number(asigRows[0].programa_id) !== Number(effectiveProgramaId)) {
        return res.status(403).json({
          success: false,
          message: `La asignatura seleccionada no pertenece a tu programa académico.`,
        });
      }
    }

    // Validar que los estudiantes asignados pertenezcan exclusivamente al programa académico del docente
    if (Array.isArray(estudiantes) && estudiantes.length > 0 && effectiveProgramaId) {
      const checkCedulas = estudiantes
        .map((item) => String(typeof item === "object" ? item.cedula || item.Cédula : item))
        .filter(Boolean);

      if (checkCedulas.length > 0) {
        const ph = checkCedulas.map(() => "?").join(",");
        const invalidStudents = await queryDB(
          `SELECT e.cedula, e.nombre, e.apellidos, e.programa_id, p.nombreprograma 
           FROM estudiante e 
           LEFT JOIN programa p ON e.programa_id = p.id 
           WHERE e.cedula IN (${ph}) AND (e.programa_id IS NULL OR e.programa_id != ?)`,
          [...checkCedulas, effectiveProgramaId]
        );
        if (invalidStudents.length > 0) {
          const names = invalidStudents
            .map((s) => `${s.nombre} ${s.apellidos} (${s.nombreprograma || "Sin programa"})`)
            .join(", ");
          return res.status(403).json({
            success: false,
            message: `No puedes asignar estudiantes de otros programas académicos: ${names}.`,
          });
        }
      }
    }

    // Determinar ciclo de vida del estado según fechas (hora Colombia):
    const todayStr = getColombiaToday();
    const fFin = fecha_fin ? (typeof fecha_fin === "string" ? fecha_fin.substring(0, 10) : "") : "";
    const fIni = fecha_inicio ? (typeof fecha_inicio === "string" ? fecha_inicio.substring(0, 10) : "") : "";

    let finalEstado = estado || 'Planificada';
    if (finalEstado !== "Cancelada") {
      if (fFin && todayStr >= fFin) {
        finalEstado = "Finalizada";
      } else if (fIni && todayStr < fIni) {
        finalEstado = "Planificada";
      } else if (fIni && todayStr >= fIni) {
        finalEstado = "Activa";
      }
    }

    const insertResult = await queryDB(`
      INSERT INTO practica (
        titulo,
        programa_id,
        asignatura_id,
        institucion_id,
        servicio_id,
        docente_cedula,
        auditor_cedula,
        periodo,
        fecha_inicio,
        fecha_fin,
        horas_totales,
        cupos,
        estado,
        descripcion,
        creado_por_rol,
        creado_por_cedula,
        creador_nombre
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'docent', ?, ?)
    `, [
      titulo.trim(),
      effectiveProgramaId || null,
      asignatura_id || null,
      institucion_id || null,
      servicio_id || null,
      docentCedula,
      auditor_cedula || null,
      periodo || "2024-1",
      fecha_inicio || null,
      fecha_fin || null,
      horas_totales ? parseInt(horas_totales, 10) : 120,
      cupos ? parseInt(cupos, 10) : 10,
      finalEstado,
      descripcion || null,
      docentCedula,
      docentName,
    ]);

    const practicaId = insertResult.insertId;

    // Asignar los estudiantes seleccionados a practica_estudiante
    if (Array.isArray(estudiantes) && estudiantes.length > 0) {
      for (const item of estudiantes) {
        const cedula = typeof item === "object" ? item.cedula : item;
        if (cedula) {
          await queryDB(`
            INSERT IGNORE INTO practica_estudiante (practica_id, estudiante_cedula, estado)
            VALUES (?, ?, 'Asignado')
          `, [practicaId, cedula]);
        }
      }
    }

    console.log(`✅ Práctica #${practicaId} "${titulo}" creada por Docente ${docentName} (C.C. ${docentCedula}).`);
    res.status(201).json({
      success: true,
      message: `Práctica "${titulo}" creada con éxito.`,
      practica_id: practicaId,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/students (Listado Real de Estudiantes para el Docente)
// ──────────────────────────────────────────────
router.get(["/students", "/students/:docentId"], async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);

    if (!docentId) {
      return res.status(400).json({
        success: false,
        message: "Cédula del docente no especificada.",
      });
    }

    // Verificar si el docente pertenece a un programa académico
    const docRows = await queryDB(
      "SELECT programa_id FROM docente WHERE cedula = ? LIMIT 1",
      [docentId]
    );
    const docentProgramaId = docRows[0]?.programa_id || null;

    const rows = await queryDB(`
      SELECT 
        pe.id AS asignacion_id,
        pe.practica_id,
        pe.estudiante_cedula,
        pe.estado AS estado_asignacion,
        pe.calificacion,
        pe.retroalimentacion,
        pe.fecha_evaluacion,
        pe.estado_evaluacion,
        pe.criterios,
        pe.horas_cumplidas,
        pe.horas_asignadas,
        e.cedula,
        e.codigo,
        e.nombre,
        e.apellidos,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS nombre_completo,
        e.correo_institucional,
        p.nombreprograma AS carrera,
        de.telefono,
        de.correo_personal,
        de.biografia,
        (de.foto_perfil IS NOT NULL) AS tiene_foto,
        (de.hoja_vida_digital IS NOT NULL) AS has_cv,
        (de.seguridad_social_eps IS NOT NULL) AS has_eps,
        (de.riesgos_profesionales_arl IS NOT NULL) AS has_arl,
        (de.copia_documento_identidad IS NOT NULL) AS has_id,
        (de.copia_carnet_estudiantil IS NOT NULL) AS has_carnet,
        (de.carnet_vacunas IS NOT NULL) AS has_vaccines,
        pr.titulo AS practica_titulo,
        pr.estado AS practica_estado,
        pr.periodo,
        pr.fecha_inicio,
        pr.fecha_fin,
        pr.horas_totales,
        s.nombreservicio,
        i.nombreinstitucion,
        ra.id AS report_id,
        ra.nota_sugerida,
        ra.concepto AS report_concepto,
        ra.observaciones AS report_observaciones,
        ra.fecha_reporte,
        ra.conocimiento_teorico,
        ra.habilidades_practicas,
        ra.actitud_etica,
        ra.comunicacion_equipo,
        ra.puntualidad_asistencia,
        CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')) AS auditor_nombre
      FROM practica pr
      INNER JOIN practica_estudiante pe ON pr.id = pe.practica_id
      INNER JOIN estudiante e ON pe.estudiante_cedula = e.cedula
      LEFT JOIN programa p ON e.programa_id = p.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN datos_estudiante de ON pe.estudiante_cedula = de.cedula_estudiante
      LEFT JOIN reporte_auditor ra ON ra.practica_id = pe.practica_id AND ra.estudiante_cedula = pe.estudiante_cedula
      LEFT JOIN auditor au ON ra.auditor_cedula = au.cedula
      WHERE (pr.docente_cedula = ? OR pr.creado_por_cedula = ?)
        ${docentProgramaId ? "AND (e.programa_id = ? OR e.programa_id IS NULL)" : ""}
      ORDER BY pr.id DESC, e.apellidos ASC
    `, docentProgramaId ? [docentId, docentId, docentProgramaId] : [docentId, docentId]);

    const studentList = rows.map((r) => {
      let criteriosParsed = null;
      if (r.criterios) {
        try {
          criteriosParsed = typeof r.criterios === "string" ? JSON.parse(r.criterios) : r.criterios;
        } catch (e) {
          criteriosParsed = null;
        }
      }

      const totalAsignadas = r.horas_asignadas !== null && r.horas_asignadas !== undefined
        ? Number(r.horas_asignadas)
        : (r.horas_totales ? Number(r.horas_totales) : 120);

      const auditorReport = r.report_id ? {
        id: r.report_id,
        nota_sugerida: Number(r.nota_sugerida),
        concepto: r.report_concepto,
        observaciones: r.report_observaciones,
        fecha: r.fecha_reporte,
        auditor_nombre: r.auditor_nombre || "Auditor Clínico",
        likert: {
          knowledge: Number(r.conocimiento_teorico || 4),
          skills: Number(r.habilidades_practicas || 4),
          attitude: Number(r.actitud_etica || 5),
          communication: Number(r.comunicacion_equipo || 4),
        }
      } : null;

      return {
        id: String(r.cedula),
        name: r.nombre || `Estudiante #${r.cedula}`,
        lastName: r.apellidos || "",
        fullName: r.nombre_completo.trim() || `Estudiante #${r.cedula}`,
        cedula: String(r.cedula),
        codigo: r.codigo || null,
        email: r.correo_institucional || `estudiante${r.cedula}@uptc.edu.co`,
        career: r.carrera || "Salud",
        telefono: r.telefono || null,
        correo_personal: r.correo_personal || null,
        biografia: r.biografia || null,
        tiene_foto: !!r.tiene_foto,
        foto_url: r.tiene_foto ? `/api/student/photo/${r.cedula}` : null,
        has_cv: !!r.has_cv,
        has_eps: !!r.has_eps,
        has_arl: !!r.has_arl,
        has_id: !!r.has_id,
        has_carnet: !!r.has_carnet,
        has_vaccines: !!r.has_vaccines,
        docs_count: [r.has_cv, r.has_eps, r.has_arl, r.has_id, r.has_carnet, r.has_vaccines].filter(Boolean).length,
        estado: r.estado_asignacion === "Activo" ? "Activo" : "Pendiente",
        estado_asignacion: r.estado_asignacion === "Activo" ? "Activo" : "Pendiente",
        service: r.nombreservicio || "Servicio Asignado",
        hospital: r.nombreinstitucion || "Institución Hospitalaria",
        practiceName: r.practica_titulo,
        practiceId: r.practica_id,
        subject: r.nombreservicio || "Práctica Formativa",
        rotation: r.nombreservicio || "Rotación Clínica",
        evaluationStatus: r.estado_evaluacion || (r.calificacion !== null ? "Completada" : "Pendiente"),
        score: r.calificacion !== null ? Number(r.calificacion) : null,
        feedback: r.retroalimentacion || null,
        evaluationDate: r.fecha_evaluacion ? new Date(r.fecha_evaluacion).toISOString().substring(0, 10) : null,
        practiceStartDate: r.fecha_inicio ? new Date(r.fecha_inicio).toISOString().substring(0, 10) : "2024-02-01",
        practiceEndDate: r.fecha_fin ? new Date(r.fecha_fin).toISOString().substring(0, 10) : "2024-06-30",
        practiceStatus: r.practica_estado || "Activa",
        likertScores: criteriosParsed || (auditorReport ? auditorReport.likert : null),
        auditorReport,
        horas_cumplidas: Number(r.horas_cumplidas || 0),
        horas_asignadas: totalAsignadas,
        horas_totales: totalAsignadas,
      };
    });

    console.log(`✅ Estudiantes reales consultados para docente ${docentId}: ${studentList.length} encontrado(s).`);
    res.status(200).json(studentList);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/docent/practices/:practiceId/students/:cedula/hours
// ──────────────────────────────────────────────
router.put("/practices/:practiceId/students/:cedula/hours", async (req, res, next) => {
  try {
    const { practiceId, cedula } = req.params;
    const { horas_cumplidas, horas_asignadas } = req.body;

    const prCheck = await queryDB("SELECT estado FROM practica WHERE id = ? LIMIT 1", [practiceId]);
    if (prCheck.length > 0 && (prCheck[0].estado === "Finalizada" || prCheck[0].estado === "Cancelada")) {
      return res.status(400).json({
        success: false,
        message: "No se pueden modificar horas en una práctica finalizada o cancelada. El historial está congelado.",
      });
    }

    const updates = [];
    const params = [];

    if (horas_cumplidas !== undefined && horas_cumplidas !== null) {
      updates.push("horas_cumplidas = ?");
      params.push(Math.max(0, parseInt(horas_cumplidas, 10) || 0));
    }

    if (horas_asignadas !== undefined && horas_asignadas !== null) {
      updates.push("horas_asignadas = ?");
      params.push(Math.max(1, parseInt(horas_asignadas, 10) || 0));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No se enviaron horas para actualizar." });
    }

    params.push(practiceId, cedula);

    const updateResult = await queryDB(
      `UPDATE practica_estudiante SET ${updates.join(", ")} WHERE practica_id = ? AND estudiante_cedula = ?`,
      params
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Estudiante no encontrado en esta práctica." });
    }

    res.status(200).json({
      success: true,
      message: "Horas actualizadas correctamente por el docente.",
      practica_id: practiceId,
      estudiante_cedula: cedula,
      horas_cumplidas: horas_cumplidas !== undefined ? Number(horas_cumplidas) : undefined,
      horas_asignadas: horas_asignadas !== undefined ? Number(horas_asignadas) : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/docent/practices/:practiceId/students/:cedula/add-hours
// ──────────────────────────────────────────────
router.post("/practices/:practiceId/students/:cedula/add-hours", async (req, res, next) => {
  try {
    const { practiceId, cedula } = req.params;
    const { deltaHours } = req.body;

    const prCheck = await queryDB("SELECT estado FROM practica WHERE id = ? LIMIT 1", [practiceId]);
    if (prCheck.length > 0 && (prCheck[0].estado === "Finalizada" || prCheck[0].estado === "Cancelada")) {
      return res.status(400).json({
        success: false,
        message: "No se pueden modificar horas en una práctica finalizada o cancelada. El historial está congelado.",
      });
    }

    const added = parseInt(deltaHours, 10);
    if (isNaN(added) || added === 0) {
      return res.status(400).json({ success: false, message: "Valor de horas a añadir inválido." });
    }

    await queryDB(
      `UPDATE practica_estudiante 
       SET horas_cumplidas = GREATEST(0, horas_cumplidas + ?)
       WHERE practica_id = ? AND estudiante_cedula = ?`,
      [added, practiceId, cedula]
    );

    const updatedRows = await queryDB(
      `SELECT horas_cumplidas, horas_asignadas FROM practica_estudiante WHERE practica_id = ? AND estudiante_cedula = ?`,
      [practiceId, cedula]
    );

    res.status(200).json({
      success: true,
      message: `Se sumaron ${added} horas de práctica con éxito.`,
      horas_cumplidas: updatedRows[0]?.horas_cumplidas || 0,
      horas_asignadas: updatedRows[0]?.horas_asignadas || null,
    });
  } catch (err) {
    next(err);
  }
});


// ──────────────────────────────────────────────
// POST /api/docent/evaluations (Registrar o Actualizar Calificación Real 0.0 - 5.0)
// ──────────────────────────────────────────────
router.post(["/evaluations", "/students/evaluate"], async (req, res, next) => {
  try {
    const {
      practica_id,
      estudiante_cedula,
      calificacion,
      retroalimentacion,
      criterios,
    } = req.body;

    if (!practica_id || !estudiante_cedula) {
      return res.status(400).json({
        success: false,
        message: "Se requiere ID de la práctica y cédula del estudiante.",
      });
    }

    const prCheck = await queryDB("SELECT estado FROM practica WHERE id = ? LIMIT 1", [practica_id]);
    if (prCheck.length > 0 && (prCheck[0].estado === "Finalizada" || prCheck[0].estado === "Cancelada")) {
      return res.status(400).json({
        success: false,
        message: "No se pueden modificar calificaciones en una práctica finalizada o cancelada. El historial está congelado.",
      });
    }

    let numScore = parseFloat(calificacion);
    if (isNaN(numScore) && criterios && typeof criterios === "object") {
      const vals = [criterios.knowledge, criterios.skills, criterios.attitude, criterios.communication]
        .map(Number)
        .filter((n) => !isNaN(n));
      if (vals.length > 0) {
        numScore = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
    }

    if (numScore === null || isNaN(numScore) || numScore < 0.0 || numScore > 5.0) {
      return res.status(400).json({
        success: false,
        message: "La calificación debe ser un valor numérico entre 0.0 y 5.0 (escala colombiana / UPTC).",
      });
    }

    // Redondear a 1 decimal
    const roundedScore = Math.round(numScore * 10) / 10;

    const criteriosJson = criterios ? JSON.stringify(criterios) : null;

    // Actualizar registro en practica_estudiante
    const updateResult = await queryDB(`
      UPDATE practica_estudiante
      SET 
        calificacion = ?,
        retroalimentacion = ?,
        fecha_evaluacion = NOW(),
        estado_evaluacion = 'Completada',
        criterios = ?
      WHERE practica_id = ? AND estudiante_cedula = ?
    `, [
      roundedScore,
      retroalimentacion ? retroalimentacion.trim() : "Evaluación de desempeño clínico completada satisfactoriamente.",
      criteriosJson,
      practica_id,
      estudiante_cedula,
    ]);

    if (updateResult.affectedRows === 0) {
      // Intentar insertar si no estaba previamente asignado
      await queryDB(`
        INSERT INTO practica_estudiante (practica_id, estudiante_cedula, estado, calificacion, retroalimentacion, fecha_evaluacion, estado_evaluacion, criterios)
        VALUES (?, ?, 'Asignado', ?, ?, NOW(), 'Completada', ?)
      `, [
        practica_id,
        estudiante_cedula,
        roundedScore,
        retroalimentacion ? retroalimentacion.trim() : "Evaluación de desempeño clínico completada satisfactoriamente.",
        criteriosJson,
      ]);
    }

    console.log(`✅ Calificación ${roundedScore}/5.0 guardada para estudiante ${estudiante_cedula} en práctica #${practica_id}.`);

    res.status(200).json({
      success: true,
      message: `Calificación de ${roundedScore.toFixed(1)} / 5.0 registrada con éxito.`,
      score: roundedScore,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/dashboard-stats (Estadísticas Reales del Docente)
// ──────────────────────────────────────────────
router.get(["/dashboard-stats", "/dashboard-stats/:docentId"], async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);

    if (!docentId) {
      return res.status(400).json({
        success: false,
        message: "Cédula del docente no especificada.",
      });
    }

    // 1. Prácticas a cargo
    const practicesRows = await queryDB(`
      SELECT id, titulo, estado, fecha_fin
      FROM practica
      WHERE docente_cedula = ? OR creado_por_cedula = ?
    `, [docentId, docentId]);

    const totalPractices = practicesRows.length;
    const activePractices = practicesRows.filter((p) => p.estado === "Activa" || p.estado === "En Curso").length;
    const practiceIds = practicesRows.map((p) => p.id);

    // Detección de prácticas que finalizan en 7 días o menos
    const todayStr = getColombiaToday();
    const closingSoon = [];
    practicesRows.forEach((p) => {
      if ((p.estado === "Activa" || p.estado === "En Curso") && p.fecha_fin) {
        const fFin = String(p.fecha_fin).substring(0, 10);
        const diffTime = new Date(fFin + "T23:59:59-05:00") - new Date(todayStr + "T00:00:00-05:00");
        const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (dias >= 0 && dias <= 7) {
          closingSoon.push({
            id: p.id,
            titulo: p.titulo,
            dias_restantes: dias,
            fecha_fin: fFin,
          });
        }
      }
    });

    let totalStudents = 0;
    let pendingEvaluations = 0;
    let completedEvaluations = 0;
    let tasks = [];

    // Alertas prioritarias de prácticas por finalizar (7 días)
    closingSoon.forEach((cs) => {
      const diasTxt = cs.dias_restantes === 0 ? "finaliza hoy" : cs.dias_restantes === 1 ? "finaliza mañana" : `finaliza en ${cs.dias_restantes} días`;
      tasks.push(`⏰ Cierre Próximo: "${cs.titulo}" (${diasTxt}). Registra notas y horas antes del cierre definitivo.`);
    });

    if (practiceIds.length > 0) {
      const ph = practiceIds.map(() => "?").join(",");
      const studentRows = await queryDB(`
        SELECT 
          pe.practica_id,
          pe.estudiante_cedula,
          pe.calificacion,
          pe.estado_evaluacion,
          pr.titulo AS practica_titulo,
          CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre
        FROM practica_estudiante pe
        INNER JOIN practica pr ON pe.practica_id = pr.id
        LEFT JOIN estudiante e ON pe.estudiante_cedula = e.cedula
        WHERE pe.practica_id IN (${ph})
      `, practiceIds);

      // Cédulas únicas de estudiantes
      const uniqueStudents = new Set(studentRows.map((r) => String(r.estudiante_cedula)));
      totalStudents = uniqueStudents.size;

      studentRows.forEach((r) => {
        if (r.calificacion !== null || r.estado_evaluacion === "Completada") {
          completedEvaluations++;
        } else {
          pendingEvaluations++;
          if (tasks.length < 6) {
            tasks.push(`Evaluar a ${r.estudiante_nombre?.trim() || "Estudiante"} en "${r.practica_titulo}".`);
          }
        }
      });
    }

    // 3. Solicitudes de certificados pendientes dirigidas a este docente
    let pendingCertificates = 0;
    try {
      const certRows = await queryDB(`
        SELECT 
          sc.id,
          sc.tipo_certificado,
          pr.titulo AS practica_titulo,
          CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre
        FROM solicitud_certificado sc
        LEFT JOIN practica pr ON sc.practica_id = pr.id
        LEFT JOIN estudiante e ON sc.estudiante_cedula = e.cedula
        WHERE sc.docente_cedula = ? AND sc.estado = 'Pendiente'
        ORDER BY sc.fecha_solicitud DESC
      `, [docentId]);
      pendingCertificates = certRows.length;
      certRows.forEach((cr) => {
        tasks.unshift(`Revisar solicitud de certificado (${cr.tipo_certificado}) de ${cr.estudiante_nombre?.trim() || "Estudiante"} para "${cr.practica_titulo || "Práctica"}".`);
      });
    } catch (e) {
      console.warn("Error leyendo solicitudes de certificado en dashboard-stats:", e.message);
    }

    if (tasks.length === 0) {
      if (totalPractices === 0) {
        tasks.push("No tienes prácticas clínicas asignadas actualmente.");
      } else if (totalStudents === 0) {
        tasks.push("Asignar estudiantes a tus prácticas formativas.");
      } else {
        tasks.push("¡Excelente! Todas las evaluaciones formativas están al día.");
        tasks.push("Revisar observaciones periódicas de tus estudiantes.");
      }
    }

    res.status(200).json({
      success: true,
      totalPractices,
      activePractices,
      totalStudents,
      pendingEvaluations,
      completedEvaluations,
      pendingCertificates,
      endingSoonCount: closingSoon.length,
      closingSoonPractices: closingSoon,
      tasks,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/certificate-requests/:docentId (o /certificate-requests)
// ──────────────────────────────────────────────
router.get(["/certificate-requests", "/certificate-requests/:docentId"], async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);

    if (!docentId) {
      return res.status(400).json({
        success: false,
        message: "Cédula del docente no especificada.",
      });
    }

    const rows = await queryDB(`
      SELECT 
        sc.id,
        sc.estudiante_cedula,
        sc.docente_cedula,
        sc.practica_id,
        sc.tipo_certificado,
        sc.categoria_solicitud,
        sc.motivo,
        sc.observaciones,
        sc.estado,
        sc.fecha_solicitud,
        sc.fecha_respuesta,
        sc.respuesta_docente,
        pr.titulo AS practica_titulo,
        pr.periodo AS practica_periodo,
        pr.horas_totales,
        s.nombreservicio AS servicio_nombre,
        i.nombreinstitucion AS institucion_nombre,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre,
        e.correo_institucional AS estudiante_correo,
        prog.nombreprograma AS estudiante_carrera,
        pe.calificacion AS estudiante_calificacion,
        d.foto_firma AS docente_foto_firma
      FROM solicitud_certificado sc
      LEFT JOIN practica pr ON sc.practica_id = pr.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN estudiante e ON sc.estudiante_cedula = e.cedula
      LEFT JOIN programa prog ON e.programa_id = prog.id
      LEFT JOIN practica_estudiante pe ON pe.practica_id = sc.practica_id AND pe.estudiante_cedula = sc.estudiante_cedula
      LEFT JOIN docente d ON d.cedula = sc.docente_cedula OR d.cedula = pr.docente_cedula
      WHERE sc.docente_cedula = ? OR pr.docente_cedula = ?
      ORDER BY sc.fecha_solicitud DESC
    `, [docentId, docentId]);

    console.log(`✅ Solicitudes de certificado para docente ${docentId}: ${rows.length} encontrada(s).`);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT/POST /api/docent/certificate-requests/:id/respond
// ──────────────────────────────────────────────
const handleRespondRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado, respuesta_docente } = req.body;

    if (!estado || (estado !== "Aprobado" && estado !== "Rechazado")) {
      return res.status(400).json({
        success: false,
        message: "El estado debe ser 'Aprobado' o 'Rechazado'.",
      });
    }

    // Verificar permisos: si el usuario es docente, debe tener asignada la solicitud o la práctica
    if (req.user?.role === "docent") {
      const checkReq = await queryDB(`
        SELECT sc.id 
        FROM solicitud_certificado sc
        LEFT JOIN practica pr ON sc.practica_id = pr.id
        WHERE sc.id = ? AND (sc.docente_cedula = ? OR pr.docente_cedula = ?)
      `, [id, req.user.cedula, req.user.cedula]);

      if (checkReq.length === 0) {
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para responder a esta solicitud de certificado (no está asignada a tu cargo).",
        });
      }
    }

    await queryDB(`
      UPDATE solicitud_certificado
      SET estado = ?, respuesta_docente = ?, fecha_respuesta = NOW()
      WHERE id = ?
    `, [estado, respuesta_docente || null, id]);

    console.log(`✅ Solicitud #${id} actualizada por el docente a estado: ${estado}`);
    res.status(200).json({
      success: true,
      message: `Solicitud de certificado ${estado === "Aprobado" ? "aprobada" : "rechazada"} exitosamente.`,
    });
  } catch (err) {
    next(err);
  }
};

router.put("/certificate-requests/:id/respond", handleRespondRequest);
router.post("/certificate-requests/:id/respond", handleRespondRequest);

// ──────────────────────────────────────────────
// GET /api/docent/practices/:practiceId/messages
// Mensajes entre docente y auditor de una práctica formativa
// ──────────────────────────────────────────────
router.get("/practices/:practiceId/messages", async (req, res, next) => {
  try {
    const { practiceId } = req.params;
    const docentId = getEffectiveDocentId(req);

    // Verificar pertenencia si es docente
    if (req.user?.role === "docent") {
      const prCheck = await queryDB(
        "SELECT id FROM practica WHERE id = ? AND docente_cedula = ?",
        [practiceId, docentId]
      );
      if (prCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para ver los mensajes de esta práctica.",
        });
      }
    }

    const rows = await queryDB(`
      SELECT 
        op.id,
        op.practica_id,
        op.autor_rol,
        op.autor_cedula,
        op.autor_nombre,
        op.docente_cedula,
        op.auditor_cedula,
        op.estudiante_cedula,
        op.titulo,
        op.observacion AS mensaje,
        op.tipo,
        op.created_at,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre,
        COALESCE(
          NULLIF(op.autor_nombre, ''),
          IF(op.autor_rol = 'auditor', CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')), CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, ''))),
          IF(op.autor_rol = 'auditor', 'Auditor Clínico', 'Docente')
        ) AS autor_display_nombre,
        CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')) AS auditor_nombre,
        au.correo_institucional AS auditor_correo
      FROM observacion_practica op
      LEFT JOIN estudiante e ON op.estudiante_cedula = e.cedula
      LEFT JOIN auditor au ON (op.auditor_cedula = au.cedula OR (op.autor_rol = 'auditor' AND op.autor_cedula = au.cedula))
      LEFT JOIN docente d ON op.docente_cedula = d.cedula
      WHERE op.practica_id = ?
      ORDER BY op.created_at ASC, op.id ASC
    `, [practiceId]);

    // Marcar automáticamente como leídos los mensajes del auditor para esta práctica
    try {
      await queryDB(`
        UPDATE observacion_practica 
        SET leido = 1 
        WHERE practica_id = ? 
          AND autor_rol = 'auditor' 
          AND leido = 0
      `, [practiceId]);
    } catch (e) {
      console.warn("No se pudo marcar mensajes como leídos:", e.message);
    }

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/docent/practices/:practiceId/messages
// Enviar mensaje o respuesta del docente al auditor de la práctica
// ──────────────────────────────────────────────
router.post("/practices/:practiceId/messages", async (req, res, next) => {
  try {
    const { practiceId } = req.params;
    const docentId = getEffectiveDocentId(req);
    const { mensaje, titulo, tipo, estudiante_cedula } = req.body;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    // Datos de la práctica y su auditor asignado
    const prRows = await queryDB(`
      SELECT pr.id, pr.titulo, pr.docente_cedula, pr.auditor_cedula, pr.institucion_id,
             au.cedula AS inst_auditor_cedula
      FROM practica pr
      LEFT JOIN auditor au ON pr.institucion_id = au.institucion_id
      WHERE pr.id = ?
    `, [practiceId]);

    if (prRows.length === 0) {
      return res.status(404).json({ success: false, message: "Práctica no encontrada." });
    }

    const pr = prRows[0];
    if (req.user?.role === "docent" && String(pr.docente_cedula) !== String(docentId)) {
      return res.status(403).json({ success: false, message: "No eres el docente a cargo de esta práctica." });
    }

    const auditorCedula = pr.auditor_cedula || pr.inst_auditor_cedula || null;

    // Nombre del docente
    const docRows = await queryDB("SELECT nombre, apellidos FROM docente WHERE cedula = ?", [docentId]);
    const docName = docRows.length > 0 ? `${docRows[0].nombre} ${docRows[0].apellidos}`.trim() : "Docente";

    const finalTitulo = (titulo && titulo.trim()) || "Mensaje del Docente";
    const finalTipo = tipo || "General";

    const insertRes = await queryDB(`
      INSERT INTO observacion_practica 
        (practica_id, autor_rol, autor_cedula, autor_nombre, docente_cedula, auditor_cedula, estudiante_cedula, titulo, observacion, tipo, created_at)
      VALUES (?, 'docente', ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      practiceId,
      docentId,
      docName,
      docentId,
      auditorCedula,
      estudiante_cedula || null,
      finalTitulo,
      mensaje.trim(),
      finalTipo,
    ]);

    console.log(`✅ Mensaje enviado de docente ${docentId} a auditor ${auditorCedula} en práctica #${practiceId}`);
    res.status(201).json({
      success: true,
      message: "Mensaje enviado exitosamente al auditor.",
      messageId: insertRes.insertId,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/docent/practices/:practiceId/messages/:messageId
// Eliminar mensaje enviado por el docente al auditor (límite 5 minutos)
// ──────────────────────────────────────────────
router.delete(["/practices/:practiceId/messages/:messageId", "/messages/:messageId"], async (req, res, next) => {
  try {
    const messageId = req.params.messageId;
    const docentId = getEffectiveDocentId(req);

    const msgRows = await queryDB(
      "SELECT id, autor_rol, autor_cedula, created_at FROM observacion_practica WHERE id = ?",
      [messageId]
    );

    if (msgRows.length === 0) {
      return res.status(404).json({ success: false, message: "Mensaje no encontrado." });
    }

    const msg = msgRows[0];

    // Verificar que fue enviado por el docente
    if (req.user?.role === "docent" && (msg.autor_rol !== "docente" || String(msg.autor_cedula) !== String(docentId))) {
      return res.status(403).json({ success: false, message: "No tienes permiso para eliminar este mensaje." });
    }

    await queryDB("DELETE FROM observacion_practica WHERE id = ?", [messageId]);

    console.log(`🗑️ Mensaje #${messageId} eliminado por docente ${docentId}.`);
    res.status(200).json({ success: true, message: "Mensaje eliminado exitosamente." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/all-messages
// Historial consolidado de mensajes recibidos de auditores y enviados por el docente
// ──────────────────────────────────────────────
router.get("/all-messages", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);

    const rows = await queryDB(`
      SELECT 
        op.id,
        op.practica_id,
        pr.titulo AS practica_titulo,
        pr.institucion_id,
        i.nombreinstitucion AS institucion_nombre,
        op.autor_rol,
        op.autor_cedula,
        op.autor_nombre,
        op.docente_cedula,
        op.auditor_cedula,
        op.titulo,
        op.observacion AS mensaje,
        op.tipo,
        op.estudiante_cedula,
        op.created_at,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre,
        COALESCE(
          NULLIF(op.autor_nombre, ''),
          IF(op.autor_rol = 'auditor', CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')), CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, ''))),
          IF(op.autor_rol = 'auditor', 'Auditor Clínico', 'Docente')
        ) AS autor_display_nombre,
        CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')) AS auditor_nombre,
        au.correo_institucional AS auditor_correo
      FROM observacion_practica op
      INNER JOIN practica pr ON op.practica_id = pr.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN estudiante e ON op.estudiante_cedula = e.cedula
      LEFT JOIN auditor au ON (op.auditor_cedula = au.cedula OR (op.autor_rol = 'auditor' AND op.autor_cedula = au.cedula))
      LEFT JOIN docente d ON op.docente_cedula = d.cedula
      WHERE pr.docente_cedula = ? OR op.docente_cedula = ?
      ORDER BY op.created_at DESC
    `, [docentId, docentId]);

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/unread-messages-count
// Conteo estricto de mensajes no leídos enviados por el auditor al docente
// ──────────────────────────────────────────────
router.get(["/unread-messages-count", "/unread-messages-count/:docentId"], async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    if (!docentId) {
      return res.status(200).json({ success: true, unreadCount: 0 });
    }

    const rows = await queryDB(`
      SELECT COUNT(*) AS unreadCount
      FROM observacion_practica op
      INNER JOIN practica pr ON op.practica_id = pr.id
      WHERE (pr.docente_cedula = ? OR op.docente_cedula = ?)
        AND op.autor_rol = 'auditor'
        AND op.leido = 0
    `, [docentId, docentId]);

    const unreadCount = rows[0]?.unreadCount ? Number(rows[0].unreadCount) : 0;
    res.status(200).json({ success: true, unreadCount });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/docent/mark-messages-read
// Marcar mensajes como leídos
// ──────────────────────────────────────────────
router.put("/mark-messages-read", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    const { practiceId } = req.body || {};

    if (practiceId) {
      await queryDB(`
        UPDATE observacion_practica 
        SET leido = 1 
        WHERE practica_id = ? 
          AND autor_rol = 'auditor' 
          AND leido = 0
      `, [practiceId]);
    } else {
      await queryDB(`
        UPDATE observacion_practica op
        INNER JOIN practica pr ON op.practica_id = pr.id
        SET op.leido = 1
        WHERE (pr.docente_cedula = ? OR op.docente_cedula = ?)
          AND op.autor_rol = 'auditor'
          AND op.leido = 0
      `, [docentId, docentId]);
    }

    res.status(200).json({ success: true, message: "Mensajes marcados como leídos." });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ─── COMUNICACIÓN CON ESTUDIANTES (DOCENTE -> ESTUDIANTES) ──
// ============================================================

// ──────────────────────────────────────────────
// GET /api/docent/student-communication/practices
// Prácticas asignadas con lista de estudiantes y conteo de no leídos
// ──────────────────────────────────────────────
router.get("/student-communication/practices", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    if (!docentId) {
      return res.status(400).json({ success: false, message: "Cédula de docente requerida." });
    }

    const practices = await queryDB(`
      SELECT 
        pr.id,
        pr.titulo,
        pr.estado,
        pr.periodo,
        pr.fecha_inicio,
        pr.fecha_fin,
        pr.institucion_id,
        i.nombreinstitucion AS institucion_nombre,
        pr.servicio_id,
        s.nombreservicio AS servicio_nombre,
        (
          SELECT COUNT(*)
          FROM mensaje_estudiante_docente med
          WHERE med.practica_id = pr.id
            AND med.remitente_rol = 'estudiante'
            AND med.leido_por_docente = 0
        ) AS unread_messages_count
      FROM practica pr
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      WHERE pr.docente_cedula = ?
      ORDER BY pr.fecha_inicio DESC, pr.id DESC
    `, [docentId]);

    if (practices.length === 0) {
      return res.status(200).json([]);
    }

    const practiceIds = practices.map((p) => p.id);
    const placeholders = practiceIds.map(() => "?").join(",");

    const studentsRows = await queryDB(`
      SELECT 
        pe.practica_id,
        pe.estudiante_cedula,
        e.nombre,
        e.apellidos,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS nombre_completo,
        e.codigo,
        e.correo_institucional,
        de.telefono,
        (
          SELECT COUNT(*)
          FROM mensaje_estudiante_docente med
          WHERE med.practica_id = pe.practica_id
            AND med.estudiante_cedula = pe.estudiante_cedula
            AND med.remitente_rol = 'estudiante'
            AND med.leido_por_docente = 0
        ) AS unread_student_messages_count
      FROM practica_estudiante pe
      INNER JOIN estudiante e ON pe.estudiante_cedula = e.cedula
      LEFT JOIN datos_estudiante de ON pe.estudiante_cedula = de.cedula_estudiante
      WHERE pe.practica_id IN (${placeholders})
      ORDER BY e.apellidos ASC, e.nombre ASC
    `, practiceIds);

    const studentsMap = {};
    studentsRows.forEach((st) => {
      if (!studentsMap[st.practica_id]) studentsMap[st.practica_id] = [];
      studentsMap[st.practica_id].push({
        cedula: String(st.estudiante_cedula),
        nombre: st.nombre,
        apellidos: st.apellidos,
        nombre_completo: st.nombre_completo,
        codigo: st.codigo || null,
        correo_institucional: st.correo_institucional || "",
        telefono: st.telefono || "",
        unread_count: Number(st.unread_student_messages_count || 0),
      });
    });

    const result = practices.map((pr) => ({
      ...pr,
      unread_messages_count: Number(pr.unread_messages_count || 0),
      estudiantes: studentsMap[pr.id] || [],
      total_estudiantes: (studentsMap[pr.id] || []).length,
    }));

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/student-communication/practices/:practiceId/messages
// Mensajes de una práctica entre docente y estudiantes
// ──────────────────────────────────────────────
router.get("/student-communication/practices/:practiceId/messages", async (req, res, next) => {
  try {
    const { practiceId } = req.params;
    const { studentCedula } = req.query;
    const docentId = getEffectiveDocentId(req);

    if (req.user?.role === "docent") {
      const prCheck = await queryDB(
        "SELECT id FROM practica WHERE id = ? AND docente_cedula = ?",
        [practiceId, docentId]
      );
      if (prCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para ver los mensajes de esta práctica.",
        });
      }
    }

    let query = `
      SELECT 
        med.id,
        med.practica_id,
        med.docente_cedula,
        med.estudiante_cedula,
        med.destinatario_tipo,
        med.grupo_envio_id,
        med.remitente_rol,
        med.remitente_cedula,
        med.remitente_nombre,
        med.titulo,
        med.mensaje,
        med.tipo,
        med.leido_por_docente,
        med.leido_por_estudiante,
        med.created_at,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre_completo,
        e.codigo AS estudiante_codigo,
        e.correo_institucional AS estudiante_correo
      FROM mensaje_estudiante_docente med
      LEFT JOIN estudiante e ON med.estudiante_cedula = e.cedula
      WHERE med.practica_id = ?
    `;
    const params = [practiceId];

    if (studentCedula && studentCedula !== "all") {
      query += ` AND (med.estudiante_cedula = ? OR med.destinatario_tipo = 'todos')`;
      params.push(studentCedula);
    }

    query += ` ORDER BY med.created_at ASC, med.id ASC`;

    const rows = await queryDB(query, params);

    // Marcar como leídos por el docente los mensajes de estudiantes
    try {
      if (studentCedula && studentCedula !== "all") {
        await queryDB(`
          UPDATE mensaje_estudiante_docente
          SET leido_por_docente = 1
          WHERE practica_id = ?
            AND estudiante_cedula = ?
            AND remitente_rol = 'estudiante'
            AND leido_por_docente = 0
        `, [practiceId, studentCedula]);
      } else {
        await queryDB(`
          UPDATE mensaje_estudiante_docente
          SET leido_por_docente = 1
          WHERE practica_id = ?
            AND remitente_rol = 'estudiante'
            AND leido_por_docente = 0
        `, [practiceId]);
      }
    } catch (e) {
      console.warn("No se pudo marcar mensajes de estudiantes como leídos:", e.message);
    }

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/docent/student-communication/practices/:practiceId/messages
// Enviar mensaje del docente a un estudiante, múltiples o a todos
// ──────────────────────────────────────────────
router.post("/student-communication/practices/:practiceId/messages", async (req, res, next) => {
  try {
    const { practiceId } = req.params;
    const docentId = getEffectiveDocentId(req);
    const {
      destinatario_tipo, // 'todos' | 'seleccionados' | 'individual'
      estudiante_cedulas, // array de cédulas o un solo string/number
      titulo,
      mensaje,
      tipo,
    } = req.body;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    // Verificar que la práctica pertenezca al docente
    const prRows = await queryDB("SELECT id, docente_cedula FROM practica WHERE id = ?", [practiceId]);
    if (prRows.length === 0) {
      return res.status(404).json({ success: false, message: "Práctica no encontrada." });
    }
    if (req.user?.role === "docent" && String(prRows[0].docente_cedula) !== String(docentId)) {
      return res.status(403).json({ success: false, message: "No eres el docente a cargo de esta práctica." });
    }

    // Nombre del docente
    const docRows = await queryDB("SELECT nombre, apellidos FROM docente WHERE cedula = ?", [docentId]);
    const docName = docRows.length > 0 ? `${docRows[0].nombre} ${docRows[0].apellidos}`.trim() : "Docente";

    const finalTitulo = (titulo && titulo.trim()) || "Comunicado del Docente";
    const finalTipo = tipo || "General";
    const grupoEnvioId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let targetCedulas = [];

    if (destinatario_tipo === "todos") {
      // Obtener todos los estudiantes de la práctica
      const enrolled = await queryDB(
        "SELECT estudiante_cedula FROM practica_estudiante WHERE practica_id = ?",
        [practiceId]
      );
      targetCedulas = enrolled.map((r) => String(r.estudiante_cedula));
    } else if (Array.isArray(estudiante_cedulas) && estudiante_cedulas.length > 0) {
      targetCedulas = estudiante_cedulas.map((c) => String(c)).filter(Boolean);
    } else if (req.body.estudiante_cedula) {
      targetCedulas = [String(req.body.estudiante_cedula)];
    }

    if (targetCedulas.length === 0 && destinatario_tipo !== "todos") {
      return res.status(400).json({
        success: false,
        message: "Debes seleccionar al menos un estudiante destinatario.",
      });
    }

    let insertedCount = 0;

    if (destinatario_tipo === "todos") {
      // Caso difusión general a toda la práctica: insertar exactamente 1 registro con estudiante_cedula = NULL
      await queryDB(`
        INSERT INTO mensaje_estudiante_docente (
          practica_id,
          docente_cedula,
          estudiante_cedula,
          destinatario_tipo,
          grupo_envio_id,
          remitente_rol,
          remitente_cedula,
          remitente_nombre,
          titulo,
          mensaje,
          tipo,
          leido_por_docente,
          leido_por_estudiante,
          created_at
        ) VALUES (?, ?, NULL, 'todos', ?, 'docente', ?, ?, ?, ?, ?, 1, 0, NOW())
      `, [
        practiceId,
        docentId,
        grupoEnvioId,
        docentId,
        docName,
        finalTitulo,
        mensaje.trim(),
        finalTipo,
      ]);
      insertedCount = 1;
    } else if (targetCedulas.length > 0) {
      // Caso estudiantes seleccionados: insertar 1 registro por cada estudiante destinatario
      for (const stCedula of targetCedulas) {
        await queryDB(`
          INSERT INTO mensaje_estudiante_docente (
            practica_id,
            docente_cedula,
            estudiante_cedula,
            destinatario_tipo,
            grupo_envio_id,
            remitente_rol,
            remitente_cedula,
            remitente_nombre,
            titulo,
            mensaje,
            tipo,
            leido_por_docente,
            leido_por_estudiante,
            created_at
          ) VALUES (?, ?, ?, 'individual', ?, 'docente', ?, ?, ?, ?, ?, 1, 0, NOW())
        `, [
          practiceId,
          docentId,
          stCedula,
          grupoEnvioId,
          docentId,
          docName,
          finalTitulo,
          mensaje.trim(),
          finalTipo,
        ]);
        insertedCount++;
      }
    }

    console.log(`✅ Mensaje docente enviado en práctica #${practiceId} (${destinatario_tipo})`);
    res.status(201).json({
      success: true,
      message: destinatario_tipo === "todos"
        ? "Comunicado general enviado exitosamente a toda la práctica."
        : `Mensaje enviado exitosamente a ${insertedCount} estudiante(s).`,
      count: insertedCount,
      grupoEnvioId,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/docent/student-communication/messages/:id
// Eliminar mensaje enviado por el docente (máximo 5 minutos)
// ──────────────────────────────────────────────
router.delete("/student-communication/messages/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const docentId = getEffectiveDocentId(req);

    const msgRows = await queryDB(
      "SELECT id, remitente_rol, remitente_cedula, grupo_envio_id, created_at FROM mensaje_estudiante_docente WHERE id = ?",
      [id]
    );

    if (msgRows.length === 0) {
      return res.status(404).json({ success: false, message: "Mensaje no encontrado." });
    }

    const msg = msgRows[0];

    // Verificar autoría si es docente
    if (req.user?.role === "docent" && (msg.remitente_rol !== "docente" || String(msg.remitente_cedula) !== String(docentId))) {
      return res.status(403).json({ success: false, message: "No tienes permiso para eliminar este mensaje." });
    }

    if (msg.grupo_envio_id) {
      await queryDB("DELETE FROM mensaje_estudiante_docente WHERE grupo_envio_id = ?", [msg.grupo_envio_id]);
    } else {
      await queryDB("DELETE FROM mensaje_estudiante_docente WHERE id = ?", [id]);
    }

    console.log(`🗑️ Mensaje #${id} eliminado por docente ${docentId}.`);
    res.status(200).json({ success: true, message: "Mensaje eliminado exitosamente." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/docent/student-communication/unread-count
// Conteo de mensajes no leídos provenientes de estudiantes para este docente
// ──────────────────────────────────────────────
router.get("/student-communication/unread-count", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    if (!docentId) {
      return res.status(200).json({ success: true, unreadCount: 0 });
    }

    const rows = await queryDB(`
      SELECT COUNT(*) AS unreadCount
      FROM mensaje_estudiante_docente med
      INNER JOIN practica pr ON med.practica_id = pr.id
      WHERE (pr.docente_cedula = ? OR med.docente_cedula = ?)
        AND med.remitente_rol = 'estudiante'
        AND med.leido_por_docente = 0
    `, [docentId, docentId]);

    const unreadCount = rows[0]?.unreadCount ? Number(rows[0].unreadCount) : 0;
    res.status(200).json({ success: true, unreadCount });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/docent/student-communication/mark-read
// Marcar mensajes de estudiantes como leídos
// ──────────────────────────────────────────────
router.put("/student-communication/mark-read", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    const { practiceId, studentCedula } = req.body || {};

    let query = `
      UPDATE mensaje_estudiante_docente med
      INNER JOIN practica pr ON med.practica_id = pr.id
      SET med.leido_por_docente = 1
      WHERE (pr.docente_cedula = ? OR med.docente_cedula = ?)
        AND med.remitente_rol = 'estudiante'
        AND med.leido_por_docente = 0
    `;
    const params = [docentId, docentId];

    if (practiceId) {
      query += ` AND med.practica_id = ?`;
      params.push(practiceId);
    }
    if (studentCedula && studentCedula !== "all") {
      query += ` AND med.estudiante_cedula = ?`;
      params.push(studentCedula);
    }

    await queryDB(query, params);
    res.status(200).json({ success: true, message: "Mensajes marcados como leídos por el docente." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/docent/practices/:practiceId/students/:cedula/validate
// Validar documentos del estudiante y actualizar estado ('Activo' o 'Pendiente')
// ──────────────────────────────────────────────
router.post("/practices/:practiceId/students/:cedula/validate", async (req, res, next) => {
  try {
    const docentId = getEffectiveDocentId(req);
    const { practiceId, cedula } = req.params;
    const { estado } = req.body;

    const validState = estado === "Activo" ? "Activo" : "Pendiente";

    // Verificar permisos del docente en la práctica
    if (req.user?.role === "docent") {
      const prCheck = await queryDB(
        "SELECT id FROM practica WHERE id = ? AND docente_cedula = ? LIMIT 1",
        [practiceId, docentId]
      );
      if (prCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para validar estudiantes en esta práctica.",
        });
      }
    }

    const result = await queryDB(
      "UPDATE practica_estudiante SET estado = ? WHERE practica_id = ? AND estudiante_cedula = ?",
      [validState, practiceId, cedula]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontró la vinculación del estudiante en esta práctica.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `El estudiante ha sido marcado como ${validState} exitosamente.`,
      estado: validState,
      practica_id: practiceId,
      estudiante_cedula: cedula,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;



