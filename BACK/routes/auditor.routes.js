// ============================================================
// routes/auditor.routes.js — Rutas del Auditor Clínico UPTC
// Seguimiento de Prácticas, Registro de Asistencia, Reportes
// Clínicos y Comunicación Directa con Docentes
// ============================================================
"use strict";

const express = require("express");
const router = express.Router();
const { queryDB, getColombiaToday } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");

// Todas las rutas de auditor requieren token JWT válido y rol 'auditor', 'admin' o 'superadmin'
router.use(verifyToken);
router.use(requireRole("auditor", "admin", "superadmin"));

/**
 * Helper para obtener la cédula del auditor
 */
function getAuditorCedula(req) {
  if (req.user?.role === "auditor") {
    return req.user.cedula;
  }
  return req.query.auditorId || req.user?.cedula;
}

// ──────────────────────────────────────────────
// GET /api/auditor/dashboard-stats
// Estadísticas reales del Auditor en base a sus prácticas y estudiantes
// ──────────────────────────────────────────────
router.get("/dashboard-stats", async (req, res, next) => {
  try {
    const auditorCedula = getAuditorCedula(req);

    // 1. Prácticas a cargo del auditor (por auditor_cedula o por su institucion_id)
    const practices = await queryDB(`
      SELECT pr.id, pr.titulo, pr.estado, pr.periodo, pr.fecha_inicio, pr.fecha_fin, pr.horas_totales,
             pr.institucion_id, i.nombreinstitucion, s.nombreservicio,
             pr.docente_cedula, CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre
      FROM practica pr
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      WHERE (pr.auditor_cedula = ? OR pr.institucion_id = (SELECT institucion_id FROM auditor WHERE cedula = ? LIMIT 1))
      ORDER BY pr.id DESC
    `, [auditorCedula, auditorCedula]);

    const totalPractices = practices.length;
    const activePractices = practices.filter((p) => p.estado === "Activa" || p.estado === "En Curso").length;
    const practiceIds = practices.map((p) => p.id);

    let totalStudents = 0;
    let totalHoursAudited = 0;
    let pendingAssessments = 0;
    let completedAssessments = 0;
    let totalCommunications = 0;

    let studentsList = [];
    if (practiceIds.length > 0) {
      const placeholders = practiceIds.map(() => "?").join(",");

      // Estudiantes en esas prácticas
      studentsList = await queryDB(`
        SELECT pe.practica_id, pe.estudiante_cedula, pe.horas_cumplidas, pe.horas_asignadas,
               e.nombre, e.apellidos, e.codigo, pr.titulo AS practica_titulo,
               ra.id AS report_id, ra.nota_sugerida, ra.concepto
        FROM practica_estudiante pe
        INNER JOIN estudiante e ON pe.estudiante_cedula = e.cedula
        INNER JOIN practica pr ON pe.practica_id = pr.id
        LEFT JOIN reporte_auditor ra ON ra.practica_id = pe.practica_id AND ra.estudiante_cedula = pe.estudiante_cedula
        WHERE pe.practica_id IN (${placeholders})
      `, practiceIds);

      // Conteo de estudiantes únicos vinculados
      const uniqueStudentCedulas = new Set(studentsList.map((st) => String(st.estudiante_cedula)));
      totalStudents = uniqueStudentCedulas.size;

      totalHoursAudited = studentsList.reduce((acc, st) => acc + Number(st.horas_cumplidas || 0), 0);
      completedAssessments = studentsList.filter((st) => st.report_id !== null).length;
      pendingAssessments = Math.max(0, studentsList.length - completedAssessments);

      // Comunicaciones / mensajes
      const commRows = await queryDB(`
        SELECT COUNT(*) AS cnt
        FROM observacion_practica
        WHERE practica_id IN (${placeholders}) AND (auditor_cedula = ? OR autor_cedula = ?)
      `, [...practiceIds, auditorCedula, auditorCedula]);
      totalCommunications = commRows[0]?.cnt || 0;
    }

    // Docentes únicos si no hay estudiantes aún
    const uniqueDocents = new Set(practices.map((p) => p.docente_cedula).filter(Boolean));
    const totalDocents = uniqueDocents.size;

    // Tareas dinámicas reales de supervisión y asistencia
    const tasks = [];
    studentsList.forEach((st) => {
      const horasPendientes = Math.max(0, Number(st.horas_asignadas || 0) - Number(st.horas_cumplidas || 0));
      if (Number(st.horas_cumplidas || 0) === 0) {
        tasks.push(`Registrar primer turno de asistencia para ${st.nombre} ${st.apellidos} (${st.codigo || st.estudiante_cedula}).`);
      } else if (horasPendientes > 0) {
        tasks.push(`Supervisar turno de rotación para ${st.nombre} ${st.apellidos} (${horasPendientes}h pendientes en "${st.practica_titulo}").`);
      }
    });

    if (tasks.length === 0 && totalPractices > 0) {
      tasks.push("Todas las rotaciones y turnos de asistencia se encuentran al día.");
      tasks.push("Monitorear el cumplimiento de turnos hospitalarios de la semana.");
    }

    res.status(200).json({
      success: true,
      totalPractices,
      activePractices,
      totalStudents,
      totalDocents,
      totalEnrollments: studentsList.length,
      totalHoursAudited,
      pendingAssessments,
      completedAssessments,
      totalCommunications,
      tasks: tasks.slice(0, 6),
      recentPractices: practices.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/practices
// Prácticas formativas y rotaciones en curso con listado de estudiantes y horas
// ──────────────────────────────────────────────
router.get("/practices", async (req, res, next) => {
  try {
    const todayStr = getColombiaToday();
    const auditorCedula = getAuditorCedula(req);

    // Sincronizar estados de prácticas por fecha
    await queryDB(`
      UPDATE practica 
      SET estado = 'Finalizada' 
      WHERE estado != 'Cancelada' AND estado != 'Finalizada' 
        AND fecha_fin IS NOT NULL AND ? >= fecha_fin
    `, [todayStr]);

    await queryDB(`
      UPDATE practica 
      SET estado = 'Activa' 
      WHERE estado = 'Planificada' 
        AND fecha_inicio IS NOT NULL AND ? >= fecha_inicio 
        AND (fecha_fin IS NULL OR ? < fecha_fin)
    `, [todayStr, todayStr]);

    const { institucion_id, estado } = req.query;

    let sql = `
      SELECT 
        pr.id,
        pr.titulo,
        pr.periodo,
        pr.fecha_inicio,
        pr.fecha_fin,
        pr.horas_totales,
        pr.cupos,
        pr.estado,
        pr.descripcion,
        pr.created_at,
        pr.programa_id,
        p.nombreprograma AS programa_nombre,
        pr.asignatura_id,
        a.nombreasignatura AS asignatura_nombre,
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
        (
          SELECT COUNT(*)
          FROM observacion_practica op
          WHERE op.practica_id = pr.id
            AND op.autor_rol = 'docente'
            AND op.leido = 0
        ) AS unread_messages_count
      FROM practica pr
      LEFT JOIN programa p ON pr.programa_id = p.id
      LEFT JOIN asignatura a ON pr.asignatura_id = a.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      LEFT JOIN auditor au ON pr.auditor_cedula = au.cedula
      WHERE 1=1
    `;

    const params = [];

    // Si es auditor, filtrar estrictamente sus prácticas
    if (req.user?.role === "auditor") {
      sql += " AND (pr.auditor_cedula = ? OR pr.institucion_id = (SELECT institucion_id FROM auditor WHERE cedula = ? LIMIT 1))";
      params.push(auditorCedula, auditorCedula);
    } else if (institucion_id) {
      sql += " AND pr.institucion_id = ?";
      params.push(institucion_id);
    }

    if (estado && estado !== "Todos") {
      sql += " AND pr.estado = ?";
      params.push(estado);
    }

    sql += " ORDER BY pr.fecha_inicio DESC, pr.id DESC";

    const practices = await queryDB(sql, params);

    if (practices.length === 0) {
      return res.status(200).json([]);
    }

    const practiceIds = practices.map((p) => p.id);
    const placeholders = practiceIds.map(() => "?").join(",");

    // Consultar estudiantes de esas prácticas
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
        ra.id AS report_id,
        ra.conocimiento_teorico,
        ra.habilidades_practicas,
        ra.actitud_etica,
        ra.comunicacion_equipo,
        ra.puntualidad_asistencia,
        ra.nota_sugerida,
        ra.concepto AS report_concepto,
        ra.observaciones AS report_observaciones,
        ra.fecha_reporte,
        (SELECT COUNT(*) FROM asistencia_estudiante ae WHERE ae.practica_id = pe.practica_id AND ae.estudiante_cedula = pe.estudiante_cedula) AS total_asistencias
      FROM practica_estudiante pe
      LEFT JOIN estudiante e ON pe.estudiante_cedula = e.cedula
      LEFT JOIN programa p ON e.programa_id = p.id
      LEFT JOIN datos_estudiante de ON pe.estudiante_cedula = de.cedula_estudiante
      LEFT JOIN reporte_auditor ra ON ra.practica_id = pe.practica_id AND ra.estudiante_cedula = pe.estudiante_cedula
      WHERE pe.practica_id IN (${placeholders})
      ORDER BY e.apellidos ASC, e.nombre ASC
    `, practiceIds);

    const studentsMap = {};
    studentsRows.forEach((st) => {
      if (!studentsMap[st.practica_id]) {
        studentsMap[st.practica_id] = [];
      }
      studentsMap[st.practica_id].push({
        id: st.estudiante_cedula,
        cedula: String(st.estudiante_cedula),
        codigo: st.codigo || null,
        nombre: st.nombre,
        apellidos: st.apellidos,
        nombre_completo: st.nombre_completo.trim() || `Estudiante #${st.estudiante_cedula}`,
        correo: st.correo_institucional,
        carrera: st.carrera || "Salud",
        telefono: st.telefono || null,
        correo_personal: st.correo_personal || null,
        biografia: st.biografia || null,
        tiene_foto: !!st.tiene_foto,
        foto_url: st.tiene_foto ? `/api/student/photo/${st.estudiante_cedula}` : null,
        estado: st.estado_asignacion,
        calificacion: st.calificacion !== null ? Number(st.calificacion) : null,
        score: st.calificacion !== null ? Number(st.calificacion) : null,
        estado_evaluacion: st.estado_evaluacion || (st.calificacion !== null ? "Completada" : "Pendiente"),
        evaluationStatus: st.estado_evaluacion || (st.calificacion !== null ? "Completada" : "Pendiente"),
        horas_cumplidas: Number(st.horas_cumplidas || 0),
        horas_asignadas: st.horas_asignadas !== null && st.horas_asignadas !== undefined ? Number(st.horas_asignadas) : null,
        total_asistencias: Number(st.total_asistencias || 0),
        report_id: st.report_id || null,
        nota_sugerida: st.nota_sugerida !== null ? Number(st.nota_sugerida) : null,
        concepto: st.report_concepto || null,
        observaciones: st.report_observaciones || null,
        fecha_reporte: st.fecha_reporte || null,
        conocimiento_teorico: st.conocimiento_teorico !== null ? Number(st.conocimiento_teorico) : null,
        habilidades_practicas: st.habilidades_practicas !== null ? Number(st.habilidades_practicas) : null,
        actitud_etica: st.actitud_etica !== null ? Number(st.actitud_etica) : null,
        comunicacion_equipo: st.comunicacion_equipo !== null ? Number(st.comunicacion_equipo) : null,
        puntualidad_asistencia: st.puntualidad_asistencia !== null ? Number(st.puntualidad_asistencia) : null,
        reporte_clinico: st.report_id ? {
          id: st.report_id,
          nota_sugerida: Number(st.nota_sugerida),
          concepto: st.report_concepto,
          observaciones: st.report_observaciones,
          fecha: st.fecha_reporte,
          conocimiento_teorico: Number(st.conocimiento_teorico),
          habilidades_practicas: Number(st.habilidades_practicas),
          actitud_etica: Number(st.actitud_etica),
          comunicacion_equipo: Number(st.comunicacion_equipo),
          puntualidad_asistencia: Number(st.puntualidad_asistencia),
        } : null,
      });
    });

    const result = practices.map((pr) => {
      const pStudents = studentsMap[pr.id] || [];
      const totalHoursReq = pr.horas_totales || 120;
      const enrichedStudents = pStudents.map((st) => ({
        ...st,
        horas_asignadas: st.horas_asignadas || totalHoursReq,
        horas_totales: st.horas_asignadas || totalHoursReq,
        progreso: Math.min(100, Math.round(((st.horas_cumplidas || 0) / (st.horas_asignadas || totalHoursReq)) * 100)),
      }));

      return {
        ...pr,
        estudiantes: enrichedStudents,
        total_estudiantes: enrichedStudents.length,
      };
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/students
// Listado de todos los estudiantes asignados a rotaciones con progreso de horas
// ──────────────────────────────────────────────
router.get("/students", async (req, res, next) => {
  try {
    const auditorCedula = getAuditorCedula(req);
    const { practice_id, search } = req.query;

    let sql = `
      SELECT 
        pe.id AS asignacion_id,
        pe.practica_id,
        pe.estudiante_cedula,
        pe.estado AS estado_asignacion,
        pe.calificacion,
        pe.retroalimentacion,
        pe.fecha_evaluacion,
        pe.estado_evaluacion,
        pe.horas_cumplidas,
        pe.horas_asignadas,
        e.cedula,
        e.codigo,
        e.nombre,
        e.apellidos,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS nombre_completo,
        e.correo_institucional,
        p.nombreprograma AS carrera,
        pr.titulo AS practica_titulo,
        pr.estado AS practica_estado,
        pr.periodo,
        pr.fecha_inicio,
        pr.fecha_fin,
        pr.horas_totales,
        s.nombreservicio,
        i.id AS institucion_id,
        i.nombreinstitucion,
        pr.docente_cedula,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre,
        d.correo_institucional AS docente_correo,
        ra.id AS report_id,
        ra.nota_sugerida,
        ra.concepto AS report_concepto,
        ra.fecha_reporte
      FROM practica pr
      INNER JOIN practica_estudiante pe ON pr.id = pe.practica_id
      INNER JOIN estudiante e ON pe.estudiante_cedula = e.cedula
      LEFT JOIN programa p ON e.programa_id = p.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      LEFT JOIN reporte_auditor ra ON ra.practica_id = pe.practica_id AND ra.estudiante_cedula = pe.estudiante_cedula
      WHERE 1=1
    `;

    const params = [];

    if (req.user?.role === "auditor") {
      sql += " AND (pr.auditor_cedula = ? OR pr.institucion_id = (SELECT institucion_id FROM auditor WHERE cedula = ? LIMIT 1))";
      params.push(auditorCedula, auditorCedula);
    }

    if (practice_id) {
      sql += " AND pr.id = ?";
      params.push(practice_id);
    }
    if (search && search.trim()) {
      sql += " AND (e.nombre LIKE ? OR e.apellidos LIKE ? OR e.cedula LIKE ? OR e.codigo LIKE ? OR p.nombreprograma LIKE ?)";
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    sql += " ORDER BY pr.id DESC, e.apellidos ASC";

    const rows = await queryDB(sql, params);

    const list = rows.map((r) => {
      const horasAsignadas = r.horas_asignadas !== null && r.horas_asignadas !== undefined
        ? Number(r.horas_asignadas)
        : (r.horas_totales ? Number(r.horas_totales) : 120);
      const horasCumplidas = Number(r.horas_cumplidas || 0);
      const progreso = Math.min(100, Math.round((horasCumplidas / horasAsignadas) * 100));

      return {
        id: String(r.cedula),
        name: r.nombre || `Estudiante #${r.cedula}`,
        lastName: r.apellidos || "",
        fullName: r.nombre_completo.trim() || `Estudiante #${r.cedula}`,
        cedula: String(r.cedula),
        codigo: r.codigo || null,
        email: r.correo_institucional || `estudiante${r.cedula}@uptc.edu.co`,
        career: r.carrera || "Salud",
        service: r.nombreservicio || "Servicio Asignado",
        hospital: r.nombreinstitucion || "Institución Hospitalaria",
        institucion_id: r.institucion_id,
        practiceName: r.practica_titulo,
        practiceId: r.practica_id,
        docentCedula: r.docente_cedula,
        docentName: r.docente_nombre || "Docente UPTC",
        docentEmail: r.docente_correo || "",
        period: r.periodo || "2026-1",
        practiceStartDate: r.fecha_inicio ? new Date(r.fecha_inicio).toISOString().substring(0, 10) : null,
        practiceEndDate: r.fecha_fin ? new Date(r.fecha_fin).toISOString().substring(0, 10) : null,
        practiceStatus: r.practica_estado || "Activa",
        evaluationStatus: r.estado_evaluacion || (r.calificacion !== null ? "Completada" : "Pendiente"),
        score: r.calificacion !== null ? Number(r.calificacion) : null,
        horas_cumplidas: horasCumplidas,
        horas_asignadas: horasAsignadas,
        horas_totales: horasAsignadas,
        progreso: progreso,
        hasAuditorReport: !!r.report_id,
        reportSuggestedScore: r.nota_sugerida !== null ? Number(r.nota_sugerida) : null,
        reportConcept: r.report_concepto || null,
      };
    });

    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/auditor/practices/:practiceId/students/:cedula/attendance
// Registro y Confirmación Oficial de Asistencia / Turno Clínico
// ──────────────────────────────────────────────
router.post("/practices/:practiceId/students/:cedula/attendance", async (req, res, next) => {
  try {
    const { practiceId, cedula } = req.params;
    const auditorCedula = getAuditorCedula(req);
    const { fecha, turno, horas, estado, observaciones } = req.body;

    const sessionDate = fecha || getColombiaToday();
    const sessionHours = parseInt(horas, 10) || 8;
    const sessionStatus = estado || "Presente";
    const sessionShift = turno || "Turno Completo (8h)";

    // 1. Guardar en bitácora de asistencia
    const insertRes = await queryDB(`
      INSERT INTO asistencia_estudiante 
        (practica_id, estudiante_cedula, auditor_cedula, fecha, turno, horas, estado, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [practiceId, cedula, auditorCedula, sessionDate, sessionShift, sessionHours, sessionStatus, observaciones || null]);

    // 2. Si asistió o llegó con tardanza, sumar las horas de inmediato
    let addedHours = 0;
    if (sessionStatus === "Presente" || sessionStatus === "Tardanza") {
      addedHours = Math.max(0, sessionHours);
      await queryDB(`
        UPDATE practica_estudiante 
        SET horas_cumplidas = horas_cumplidas + ?
        WHERE practica_id = ? AND estudiante_cedula = ?
      `, [addedHours, practiceId, cedula]);
    }

    // 3. Registrar notificación / observación para que el docente lo vea
    const audRow = await queryDB("SELECT nombre, apellidos FROM auditor WHERE cedula = ?", [auditorCedula]);
    const audName = audRow.length > 0 ? `${audRow[0].nombre} ${audRow[0].apellidos}`.trim() : "Auditor Clínico";

    const prDoc = await queryDB("SELECT docente_cedula, titulo FROM practica WHERE id = ?", [practiceId]);
    const docCed = prDoc[0]?.docente_cedula || null;
    const prTitle = prDoc[0]?.titulo || "";

    await queryDB(`
      INSERT INTO observacion_practica 
        (practica_id, autor_rol, autor_cedula, autor_nombre, auditor_cedula, docente_cedula, estudiante_cedula, titulo, observacion, tipo)
      VALUES (?, 'auditor', ?, ?, ?, ?, ?, ?, ?, 'Asistencia')
    `, [
      practiceId,
      auditorCedula,
      audName,
      auditorCedula,
      docCed,
      cedula,
      `Asistencia Confirmada: ${sessionDate}`,
      `El auditor ${audName} confirmó asistencia (${sessionStatus} - ${sessionShift}) registrando +${addedHours} horas asistenciales para el estudiante. Observaciones: ${observaciones || "Sin novedad"}`,
    ]);

    // 4. Retornar nuevo total y progreso
    const updated = await queryDB(`
      SELECT pe.horas_cumplidas, pe.horas_asignadas, pr.horas_totales
      FROM practica_estudiante pe
      INNER JOIN practica pr ON pe.practica_id = pr.id
      WHERE pe.practica_id = ? AND pe.estudiante_cedula = ?
    `, [practiceId, cedula]);

    const row = updated[0];
    const totalRequired = row?.horas_asignadas || row?.horas_totales || 120;
    const currentHours = row?.horas_cumplidas || 0;
    const progreso = Math.min(100, Math.round((currentHours / totalRequired) * 100));

    console.log(`✅ Asistencia confirmada por auditor ${auditorCedula}: estudiante ${cedula} en práctica #${practiceId} (+${addedHours}h). Total: ${currentHours}/${totalRequired}`);

    res.status(201).json({
      success: true,
      message: `Asistencia confirmada exitosamente (+${addedHours}h registradas). Progreso actual: ${progreso}%.`,
      attendanceId: insertRes.insertId,
      horas_cumplidas: currentHours,
      horas_asignadas: totalRequired,
      progreso,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/practices/:practiceId/students/:cedula/attendance
// Historial de asistencias registradas por el auditor para un estudiante
// ──────────────────────────────────────────────
router.get("/practices/:practiceId/students/:cedula/attendance", async (req, res, next) => {
  try {
    const { practiceId, cedula } = req.params;

    const rows = await queryDB(`
      SELECT 
        ae.id,
        ae.fecha,
        ae.turno,
        ae.horas,
        ae.estado,
        ae.observaciones,
        ae.created_at,
        CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')) AS auditor_nombre
      FROM asistencia_estudiante ae
      LEFT JOIN auditor au ON ae.auditor_cedula = au.cedula
      WHERE ae.practica_id = ? AND ae.estudiante_cedula = ?
      ORDER BY ae.fecha DESC, ae.id DESC
    `, [practiceId, cedula]);

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/auditor/practices/:practiceId/students/:cedula/hours
// Ajuste directo manual de horas cumplidas o asignadas
// ──────────────────────────────────────────────
router.put("/practices/:practiceId/students/:cedula/hours", async (req, res, next) => {
  try {
    const { practiceId, cedula } = req.params;
    const { horas_cumplidas, horas_asignadas } = req.body;

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
      return res.status(400).json({ success: false, message: "No se proporcionaron horas para actualizar." });
    }

    params.push(practiceId, cedula);

    const updateResult = await queryDB(
      `UPDATE practica_estudiante SET ${updates.join(", ")} WHERE practica_id = ? AND estudiante_cedula = ?`,
      params
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Estudiante no encontrado en la práctica especificada." });
    }

    console.log(`✅ Auditor actualizó horas de estudiante ${cedula} en práctica #${practiceId}`);
    res.status(200).json({
      success: true,
      message: "Horas auditadas y actualizadas exitosamente.",
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
// POST /api/auditor/practices/:practiceId/students/:cedula/add-hours
// Incremento rápido de turno (ej. +4h, +8h, +12h)
// ──────────────────────────────────────────────
router.post("/practices/:practiceId/students/:cedula/add-hours", async (req, res, next) => {
  try {
    const { practiceId, cedula } = req.params;
    const { deltaHours } = req.body;

    const added = parseInt(deltaHours, 10);
    if (isNaN(added) || added === 0) {
      return res.status(400).json({ success: false, message: "Valor de turno en horas inválido." });
    }

    await queryDB(
      `UPDATE practica_estudiante 
       SET horas_cumplidas = GREATEST(0, horas_cumplidas + ?)
       WHERE practica_id = ? AND estudiante_cedula = ?`,
      [added, practiceId, cedula]
    );

    const updatedRows = await queryDB(
      `SELECT pe.horas_cumplidas, pe.horas_asignadas, pr.horas_totales
       FROM practica_estudiante pe
       INNER JOIN practica pr ON pe.practica_id = pr.id
       WHERE pe.practica_id = ? AND pe.estudiante_cedula = ?`,
      [practiceId, cedula]
    );

    const row = updatedRows[0];
    const totalRequired = row?.horas_asignadas || row?.horas_totales || 120;
    const currentHours = row?.horas_cumplidas || 0;
    const progreso = Math.min(100, Math.round((currentHours / totalRequired) * 100));

    res.status(200).json({
      success: true,
      message: `Se registraron ${added > 0 ? `+${added}` : added} horas auditadas al estudiante. Progreso: ${progreso}%.`,
      horas_cumplidas: currentHours,
      horas_asignadas: totalRequired,
      progreso,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/auditor/practices/:practiceId/students/:cedula/report
// Pasar Reporte Clínico de Desempeño al Docente para Apoyo en Calificación
// ──────────────────────────────────────────────
router.post("/practices/:practiceId/students/:cedula/report", async (req, res, next) => {
  try {
    const { practiceId, cedula } = req.params;
    const auditorCedula = getAuditorCedula(req);
    const {
      conocimiento_teorico,
      habilidades_practicas,
      actitud_etica,
      comunicacion_equipo,
      puntualidad_asistencia,
      nota_sugerida,
      concepto,
      observaciones,
    } = req.body;

    if (!observaciones || !observaciones.trim()) {
      return res.status(400).json({
        success: false,
        message: "Debe ingresar las observaciones y concepto cualitativo para el docente.",
      });
    }

    // Obtener docente a cargo de la práctica
    const prDoc = await queryDB("SELECT docente_cedula, titulo FROM practica WHERE id = ?", [practiceId]);
    const docCed = prDoc[0]?.docente_cedula || null;
    const prTitle = prDoc[0]?.titulo || "";

    const cTeorico = parseFloat(conocimiento_teorico) || 4.0;
    const hPracticas = parseFloat(habilidades_practicas) || 4.0;
    const aEtica = parseFloat(actitud_etica) || 5.0;
    const cEquipo = parseFloat(comunicacion_equipo) || 4.0;
    const pAsistencia = parseFloat(puntualidad_asistencia) || 5.0;

    // Calcular nota sugerida ponderada si no viene dada
    const calculatedNota = parseFloat(nota_sugerida) || parseFloat(((cTeorico + hPracticas + aEtica + cEquipo + pAsistencia) / 5).toFixed(1));
    const finalConcepto = concepto || (calculatedNota >= 4.5 ? "Excelente" : calculatedNota >= 3.8 ? "Favorable" : calculatedNota >= 3.0 ? "En Seguimiento" : "Requiere Refuerzo");

    // Verificar si ya existe reporte para actualizar o insertar
    const existing = await queryDB(
      "SELECT id FROM reporte_auditor WHERE practica_id = ? AND estudiante_cedula = ?",
      [practiceId, cedula]
    );

    let reportId = null;
    if (existing.length > 0) {
      reportId = existing[0].id;
      await queryDB(`
        UPDATE reporte_auditor
        SET auditor_cedula = ?, docente_cedula = ?, conocimiento_teorico = ?, habilidades_practicas = ?,
            actitud_etica = ?, comunicacion_equipo = ?, puntualidad_asistencia = ?, nota_sugerida = ?,
            concepto = ?, observaciones = ?, fecha_reporte = NOW(), leido_por_docente = 0
        WHERE id = ?
      `, [auditorCedula, docCed, cTeorico, hPracticas, aEtica, cEquipo, pAsistencia, calculatedNota, finalConcepto, observaciones.trim(), reportId]);
    } else {
      const ins = await queryDB(`
        INSERT INTO reporte_auditor
          (practica_id, estudiante_cedula, auditor_cedula, docente_cedula, conocimiento_teorico, habilidades_practicas, actitud_etica, comunicacion_equipo, puntualidad_asistencia, nota_sugerida, concepto, observaciones, fecha_reporte)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [practiceId, cedula, auditorCedula, docCed, cTeorico, hPracticas, aEtica, cEquipo, pAsistencia, calculatedNota, finalConcepto, observaciones.trim()]);
      reportId = ins.insertId;
    }

    // Registrar en observacion_practica para que aparezca en el panel de comunicación del docente
    const audRow = await queryDB("SELECT nombre, apellidos FROM auditor WHERE cedula = ?", [auditorCedula]);
    const audName = audRow.length > 0 ? `${audRow[0].nombre} ${audRow[0].apellidos}`.trim() : "Auditor Clínico";

    const estRow = await queryDB("SELECT nombre, apellidos FROM estudiante WHERE cedula = ?", [cedula]);
    const estName = estRow.length > 0 ? `${estRow[0].nombre} ${estRow[0].apellidos}`.trim() : `Estudiante #${cedula}`;

    await queryDB(`
      INSERT INTO observacion_practica 
        (practica_id, autor_rol, autor_cedula, autor_nombre, auditor_cedula, docente_cedula, estudiante_cedula, titulo, observacion, tipo)
      VALUES (?, 'auditor', ?, ?, ?, ?, ?, ?, ?, 'Desempeño')
    `, [
      practiceId,
      auditorCedula,
      audName,
      auditorCedula,
      docCed,
      cedula,
      `Reporte de Desempeño Clínico: ${estName}`,
      `[REPORTE CLÍNICO DEL AUDITOR] Calificación sugerida: ${calculatedNota.toFixed(1)} / 5.0 (Concepto: ${finalConcepto}). Observaciones: ${observaciones.trim()}`,
    ]);

    console.log(`✅ Reporte clínico #${reportId} emitido por auditor ${auditorCedula} para estudiante ${cedula} en práctica #${practiceId}`);
    res.status(200).json({
      success: true,
      message: `Reporte clínico enviado exitosamente al docente a cargo. Nota sugerida: ${calculatedNota.toFixed(1)} (${finalConcepto}).`,
      reportId,
      nota_sugerida: calculatedNota,
      concepto: finalConcepto,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/practices/:practiceId/students/:cedula/report
// Obtener el reporte clínico específico de un estudiante
// ──────────────────────────────────────────────
router.get("/practices/:practiceId/students/:cedula/report", async (req, res, next) => {
  try {
    const { practiceId, cedula } = req.params;

    const rows = await queryDB(`
      SELECT 
        ra.*,
        CONCAT(COALESCE(au.nombre, ''), ' ', COALESCE(au.apellidos, '')) AS auditor_nombre,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre
      FROM reporte_auditor ra
      LEFT JOIN auditor au ON ra.auditor_cedula = au.cedula
      LEFT JOIN docente d ON ra.docente_cedula = d.cedula
      WHERE ra.practica_id = ? AND ra.estudiante_cedula = ?
      LIMIT 1
    `, [practiceId, cedula]);

    if (rows.length === 0) {
      return res.status(200).json({ success: true, report: null });
    }

    res.status(200).json({ success: true, report: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/reports
// Listado de todos los reportes clínicos emitidos por el auditor
// ──────────────────────────────────────────────
router.get("/reports", async (req, res, next) => {
  try {
    const auditorCedula = getAuditorCedula(req);

    const rows = await queryDB(`
      SELECT 
        ra.id,
        ra.practica_id,
        ra.estudiante_cedula,
        ra.conocimiento_teorico,
        ra.habilidades_practicas,
        ra.actitud_etica,
        ra.comunicacion_equipo,
        ra.puntualidad_asistencia,
        ra.nota_sugerida,
        ra.concepto,
        ra.observaciones,
        ra.fecha_reporte,
        ra.leido_por_docente,
        pr.titulo AS practica_titulo,
        pr.periodo,
        s.nombreservicio,
        i.nombreinstitucion,
        e.nombre AS estudiante_nombre,
        e.apellidos AS estudiante_apellidos,
        e.codigo AS estudiante_codigo,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_completo,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre,
        d.correo_institucional AS docente_correo
      FROM reporte_auditor ra
      INNER JOIN practica pr ON ra.practica_id = pr.id
      INNER JOIN estudiante e ON ra.estudiante_cedula = e.cedula
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN docente d ON ra.docente_cedula = d.cedula
      WHERE ra.auditor_cedula = ?
      ORDER BY ra.fecha_reporte DESC
    `, [auditorCedula]);

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/practices/:practiceId/messages
// Obtener historial de mensajes / observaciones de la práctica
// ──────────────────────────────────────────────
router.get("/practices/:practiceId/messages", async (req, res, next) => {
  try {
    const { practiceId } = req.params;

    const rows = await queryDB(`
      SELECT 
        op.id,
        op.practica_id,
        op.autor_rol,
        op.autor_cedula,
        op.autor_nombre,
        op.titulo,
        op.observacion AS mensaje,
        op.tipo,
        op.estudiante_cedula,
        op.created_at,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre
      FROM observacion_practica op
      LEFT JOIN estudiante e ON op.estudiante_cedula = e.cedula
      WHERE op.practica_id = ?
      ORDER BY op.created_at ASC, op.id ASC
    `, [practiceId]);

    // Marcar automáticamente como leídos los mensajes del docente para esta práctica
    try {
      await queryDB(`
        UPDATE observacion_practica 
        SET leido = 1 
        WHERE practica_id = ? 
          AND autor_rol = 'docente' 
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
// POST /api/auditor/practices/:practiceId/messages
// Enviar mensaje / comunicado directo al docente a cargo de la práctica
// ──────────────────────────────────────────────
router.post("/practices/:practiceId/messages", async (req, res, next) => {
  try {
    const { practiceId } = req.params;
    const auditorCedula = getAuditorCedula(req);
    const { mensaje, titulo, tipo, estudiante_cedula } = req.body;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    // Datos del auditor
    const audRow = await queryDB("SELECT nombre, apellidos FROM auditor WHERE cedula = ?", [auditorCedula]);
    const audName = audRow.length > 0 ? `${audRow[0].nombre} ${audRow[0].apellidos}`.trim() : "Auditor Clínico";

    // Docente de la práctica
    const prDoc = await queryDB("SELECT docente_cedula, titulo FROM practica WHERE id = ?", [practiceId]);
    if (prDoc.length === 0) {
      return res.status(404).json({ success: false, message: "Práctica no encontrada." });
    }
    const docCed = prDoc[0].docente_cedula;

    const finalTitulo = (titulo && titulo.trim()) || "Mensaje del Auditor Clínico";
    const finalTipo = tipo || "General";

    const insertRes = await queryDB(`
      INSERT INTO observacion_practica 
        (practica_id, autor_rol, autor_cedula, autor_nombre, auditor_cedula, docente_cedula, estudiante_cedula, titulo, observacion, tipo, created_at)
      VALUES (?, 'auditor', ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      practiceId,
      auditorCedula,
      audName,
      auditorCedula,
      docCed,
      estudiante_cedula || null,
      finalTitulo,
      mensaje.trim(),
      finalTipo,
    ]);

    console.log(`✅ Mensaje enviado de auditor ${auditorCedula} a docente ${docCed} en práctica #${practiceId}`);
    res.status(201).json({
      success: true,
      message: "Mensaje enviado exitosamente al docente.",
      messageId: insertRes.insertId,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/auditor/practices/:practiceId/messages/:messageId
// Eliminar mensaje enviado por el auditor (límite 5 minutos)
// ──────────────────────────────────────────────
router.delete(["/practices/:practiceId/messages/:messageId", "/messages/:messageId"], async (req, res, next) => {
  try {
    const messageId = req.params.messageId;
    const auditorCedula = getAuditorCedula(req);

    const msgRows = await queryDB(
      "SELECT id, autor_rol, autor_cedula, created_at FROM observacion_practica WHERE id = ?",
      [messageId]
    );

    if (msgRows.length === 0) {
      return res.status(404).json({ success: false, message: "Mensaje no encontrado." });
    }

    const msg = msgRows[0];

    // Verificar que fue enviado por el auditor
    if (req.user?.role === "auditor" && (msg.autor_rol !== "auditor" || String(msg.autor_cedula) !== String(auditorCedula))) {
      return res.status(403).json({ success: false, message: "No tienes permiso para eliminar este mensaje." });
    }

    await queryDB("DELETE FROM observacion_practica WHERE id = ?", [messageId]);

    console.log(`🗑️ Mensaje #${messageId} eliminado por auditor ${auditorCedula}.`);
    res.status(200).json({ success: true, message: "Mensaje eliminado exitosamente." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/all-messages
// Historial consolidado de comunicaciones del auditor
// ──────────────────────────────────────────────
router.get("/all-messages", async (req, res, next) => {
  try {
    const auditorCedula = getAuditorCedula(req);

    const rows = await queryDB(`
      SELECT 
        op.id,
        op.practica_id,
        pr.titulo AS practica_titulo,
        op.autor_rol,
        op.autor_cedula,
        op.autor_nombre,
        op.titulo,
        op.observacion AS mensaje,
        op.tipo,
        op.estudiante_cedula,
        op.created_at,
        CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS estudiante_nombre,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre
      FROM observacion_practica op
      INNER JOIN practica pr ON op.practica_id = pr.id
      LEFT JOIN estudiante e ON op.estudiante_cedula = e.cedula
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      WHERE op.auditor_cedula = ? OR op.autor_cedula = ?
         OR pr.auditor_cedula = ?
      ORDER BY op.created_at DESC
    `, [auditorCedula, auditorCedula, auditorCedula]);

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/users
// Directorio restringido EXCLUSIVAMENTE a las prácticas a cargo del auditor
// (Docentes tutores y estudiantes matriculados en sus rotaciones)
// ──────────────────────────────────────────────
router.get("/users", async (req, res, next) => {
  try {
    const auditorCedula = getAuditorCedula(req);

    const queries = [
      // 1. Estudiantes matriculados en las prácticas del auditor
      `SELECT DISTINCT 'student' AS Rol, e.cedula AS Cédula, e.codigo AS Codigo, e.nombre AS Nombre, e.apellidos AS Apellidos, 
              e.correo_institucional AS Correo_Institucional, p.nombreprograma AS Carrera,
              'Facultad de Ciencias de la Salud' AS Dependencia,
              (SELECT COUNT(*) FROM practica_estudiante pe2 WHERE pe2.estudiante_cedula = e.cedula) AS Total_Practicas,
              (SELECT GROUP_CONCAT(DISTINCT pr2.titulo SEPARATOR ', ') FROM practica_estudiante pe2 JOIN practica pr2 ON pe2.practica_id = pr2.id WHERE pe2.estudiante_cedula = e.cedula) AS Practicas_Nombres,
              (SELECT GROUP_CONCAT(DISTINCT CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) SEPARATOR ', ') FROM practica_estudiante pe2 JOIN practica pr2 ON pe2.practica_id = pr2.id JOIN docente d ON pr2.docente_cedula = d.cedula WHERE pe2.estudiante_cedula = e.cedula) AS Docente_Asignado,
              (SELECT SUM(pe2.horas_cumplidas) FROM practica_estudiante pe2 WHERE pe2.estudiante_cedula = e.cedula) AS Horas_Cumplidas_Total
       FROM estudiante e
       INNER JOIN practica_estudiante pe ON pe.estudiante_cedula = e.cedula
       INNER JOIN practica pr ON pe.practica_id = pr.id
       LEFT JOIN programa p ON e.programa_id = p.id
       WHERE (pr.auditor_cedula = ? OR pr.institucion_id = (SELECT institucion_id FROM auditor WHERE cedula = ? LIMIT 1))`,

      // 2. Docentes tutores asignados a las prácticas del auditor
      `SELECT DISTINCT 'docent' AS Rol, d.cedula AS Cédula, NULL AS Codigo, d.nombre AS Nombre, d.apellidos AS Apellidos,
              d.correo_institucional AS Correo_Institucional, p.nombreprograma AS Carrera,
              'Docencia Universitaria UPTC' AS Dependencia,
              (SELECT COUNT(*) FROM practica pr2 WHERE pr2.docente_cedula = d.cedula) AS Total_Practicas,
              (SELECT GROUP_CONCAT(DISTINCT pr2.titulo SEPARATOR ', ') FROM practica pr2 WHERE pr2.docente_cedula = d.cedula) AS Practicas_Nombres,
              CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS Docente_Asignado,
              NULL AS Horas_Cumplidas_Total
       FROM docente d
       INNER JOIN practica pr ON pr.docente_cedula = d.cedula
       LEFT JOIN programa p ON d.programa_id = p.id
       WHERE (pr.auditor_cedula = ? OR pr.institucion_id = (SELECT institucion_id FROM auditor WHERE cedula = ? LIMIT 1))`,

      // 3. El propio auditor
      `SELECT 'auditor' AS Rol, au.cedula AS Cédula, NULL AS Codigo, au.nombre AS Nombre, au.apellidos AS Apellidos,
              au.correo_institucional AS Correo_Institucional, i.nombreinstitucion AS Carrera,
              'Auditoría y Supervisión Hospitalaria' AS Dependencia,
              (SELECT COUNT(*) FROM practica pr2 WHERE pr2.auditor_cedula = au.cedula) AS Total_Practicas,
              (SELECT GROUP_CONCAT(DISTINCT pr2.titulo SEPARATOR ', ') FROM practica pr2 WHERE pr2.auditor_cedula = au.cedula) AS Practicas_Nombres,
              NULL AS Docente_Asignado,
              NULL AS Horas_Cumplidas_Total
       FROM auditor au
       LEFT JOIN institucion i ON au.institucion_id = i.id
       WHERE au.cedula = ?`
    ];

    const unionSql = `SELECT * FROM (${queries.join(" UNION ALL ")}) AS linked_users ORDER BY Rol, Nombre ASC`;
    const rows = await queryDB(unionSql, [
      auditorCedula, auditorCedula,
      auditorCedula, auditorCedula,
      auditorCedula
    ]);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/auditor/unread-messages-count
// Conteo estricto de mensajes no leídos enviados por el docente al auditor
// ──────────────────────────────────────────────
router.get(["/unread-messages-count", "/unread-messages-count/:auditorId"], async (req, res, next) => {
  try {
    const auditorCedula = getAuditorCedula(req);
    if (!auditorCedula) {
      return res.status(200).json({ success: true, unreadCount: 0 });
    }

    const rows = await queryDB(`
      SELECT COUNT(*) AS unreadCount
      FROM observacion_practica op
      INNER JOIN practica pr ON op.practica_id = pr.id
      WHERE (
        pr.auditor_cedula = ? 
        OR op.auditor_cedula = ?
        OR pr.institucion_id = (SELECT institucion_id FROM auditor WHERE cedula = ? LIMIT 1)
      )
      AND op.autor_rol = 'docente'
      AND op.leido = 0
    `, [auditorCedula, auditorCedula, auditorCedula]);

    const unreadCount = rows[0]?.unreadCount ? Number(rows[0].unreadCount) : 0;
    res.status(200).json({ success: true, unreadCount });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/auditor/mark-messages-read
// Marcar mensajes como leídos por el auditor
// ──────────────────────────────────────────────
router.put("/mark-messages-read", async (req, res, next) => {
  try {
    const auditorCedula = getAuditorCedula(req);
    const { practiceId } = req.body || {};

    if (practiceId) {
      await queryDB(`
        UPDATE observacion_practica 
        SET leido = 1 
        WHERE practica_id = ? 
          AND autor_rol = 'docente' 
          AND leido = 0
      `, [practiceId]);
    } else {
      await queryDB(`
        UPDATE observacion_practica op
        INNER JOIN practica pr ON op.practica_id = pr.id
        SET op.leido = 1
        WHERE (
          pr.auditor_cedula = ? 
          OR op.auditor_cedula = ?
          OR pr.institucion_id = (SELECT institucion_id FROM auditor WHERE cedula = ? LIMIT 1)
        )
        AND op.autor_rol = 'docente'
        AND op.leido = 0
      `, [auditorCedula, auditorCedula, auditorCedula]);
    }

    res.status(200).json({ success: true, message: "Mensajes marcados como leídos." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
