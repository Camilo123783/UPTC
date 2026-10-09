// ============================================================
// services/history.service.js — Servicio de Archivo Histórico de Prácticas
// ============================================================
"use strict";

const { queryDB } = require("../config/db");

/**
 * Obtiene toda la información detallada de una práctica y sus estudiantes vinculados,
 * notas, documentos y asistencias, y la archiva de forma inmutable en historial_practica.
 *
 * @param {number|string} practiceId ID de la práctica
 * @param {string|null} overrideMotivoCancelacion Motivo si se canceló
 * @returns {Promise<object>} Registro histórico creado/actualizado
 */
async function archivePractice(practiceId, overrideMotivoCancelacion = null) {
  if (!practiceId) throw new Error("ID de práctica no proporcionado para archivar.");

  // 1. Obtener la práctica completa con información relacionada
  const pRows = await queryDB(`
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
      pr.creador_nombre
    FROM practica pr
    LEFT JOIN programa p ON pr.programa_id = p.id
    LEFT JOIN asignatura a ON pr.asignatura_id = a.id
    LEFT JOIN institucion i ON pr.institucion_id = i.id
    LEFT JOIN servicio s ON pr.servicio_id = s.id
    LEFT JOIN docente d ON pr.docente_cedula = d.cedula
    LEFT JOIN auditor au ON pr.auditor_cedula = au.cedula
    WHERE pr.id = ?
    LIMIT 1
  `, [practiceId]);

  if (pRows.length === 0) {
    throw new Error(`Práctica #${practiceId} no encontrada.`);
  }

  const practice = pRows[0];
  const finalMotivo = (overrideMotivoCancelacion && overrideMotivoCancelacion.trim()) 
    || practice.motivo_cancelacion 
    || null;

  // 2. Obtener estudiantes vinculados, notas, evaluaciones y estado de documentos
  const studentsRows = await queryDB(`
    SELECT 
      pe.id AS asignacion_id,
      pe.estudiante_cedula,
      pe.estado AS estado_asignacion,
      pe.calificacion,
      pe.retroalimentacion,
      pe.fecha_evaluacion,
      pe.estado_evaluacion,
      pe.criterios,
      pe.horas_cumplidas,
      pe.horas_asignadas,
      e.nombre,
      e.apellidos,
      e.codigo,
      CONCAT(COALESCE(e.nombre, ''), ' ', COALESCE(e.apellidos, '')) AS nombre_completo,
      e.correo_institucional,
      p.nombreprograma AS carrera,
      de.telefono,
      (de.foto_perfil IS NOT NULL) AS has_foto,
      (de.hoja_vida_digital IS NOT NULL) AS has_hv,
      (de.seguridad_social_eps IS NOT NULL) AS has_eps,
      (de.riesgos_profesionales_arl IS NOT NULL) AS has_arl,
      (de.copia_documento_identidad IS NOT NULL) AS has_id,
      (de.copia_carnet_estudiantil IS NOT NULL) AS has_carnet,
      (de.carnet_vacunas IS NOT NULL) AS has_vacunas
    FROM practica_estudiante pe
    LEFT JOIN estudiante e ON pe.estudiante_cedula = e.cedula
    LEFT JOIN programa p ON e.programa_id = p.id
    LEFT JOIN datos_estudiante de ON pe.estudiante_cedula = de.cedula_estudiante
    WHERE pe.practica_id = ?
    ORDER BY e.apellidos ASC, e.nombre ASC
  `, [practiceId]);

  // Estructurar la información de estudiantes
  const studentsData = studentsRows.map((s) => {
    let parsedCriterios = null;
    if (s.criterios) {
      try {
        parsedCriterios = typeof s.criterios === "string" ? JSON.parse(s.criterios) : s.criterios;
      } catch (e) {
        parsedCriterios = s.criterios;
      }
    }

    const docs = [
      {
        tipo: "copia_documento_identidad",
        label: "Documento de Identidad",
        vinculado: Boolean(s.has_id),
      },
      {
        tipo: "hoja_vida_digital",
        label: "Hoja de Vida Digital",
        vinculado: Boolean(s.has_hv),
      },
      {
        tipo: "seguridad_social_eps",
        label: "Seguridad Social (EPS)",
        vinculado: Boolean(s.has_eps),
      },
      {
        tipo: "riesgos_profesionales_arl",
        label: "Afiliación ARL",
        vinculado: Boolean(s.has_arl),
      },
      {
        tipo: "copia_carnet_estudiantil",
        label: "Carnet Estudiantil",
        vinculado: Boolean(s.has_carnet),
      },
      {
        tipo: "carnet_vacunas",
        label: "Carnet de Vacunación",
        vinculado: Boolean(s.has_vacunas),
      },
    ];

    const vinculadosCount = docs.filter((d) => d.vinculado).length;

    return {
      cedula: s.estudiante_cedula,
      nombre: s.nombre,
      apellidos: s.apellidos,
      nombre_completo: s.nombre_completo,
      codigo: s.codigo,
      correo_institucional: s.correo_institucional,
      carrera: s.carrera,
      telefono: s.telefono,
      calificacion: s.calificacion !== null ? Number(s.calificacion) : null,
      retroalimentacion: s.retroalimentacion || null,
      fecha_evaluacion: s.fecha_evaluacion || null,
      estado_evaluacion: s.estado_evaluacion || "Pendiente",
      criterios: parsedCriterios,
      horas_cumplidas: s.horas_cumplidas || 0,
      horas_asignadas: s.horas_asignadas || practice.horas_totales || 0,
      estado_asignacion: s.estado_asignacion || "Asignado",
      documentos: docs,
      total_documentos_vinculados: vinculadosCount,
      total_documentos_requeridos: docs.length,
    };
  });

  // 3. Resumen de asistencias si existen
  let asistenciasResumen = { total: 0, presentes: 0, tardanzas: 0, ausencias: 0 };
  try {
    const asisRows = await queryDB(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN estado = 'Presente' THEN 1 ELSE 0 END) AS presentes,
        SUM(CASE WHEN estado = 'Tardanza' THEN 1 ELSE 0 END) AS tardanzas,
        SUM(CASE WHEN estado LIKE 'Ausente%' THEN 1 ELSE 0 END) AS ausencias
      FROM asistencia_estudiante
      WHERE practica_id = ?
    `, [practiceId]);
    if (asisRows.length > 0) {
      asistenciasResumen = {
        total: Number(asisRows[0].total || 0),
        presentes: Number(asisRows[0].presentes || 0),
        tardanzas: Number(asisRows[0].tardanzas || 0),
        ausencias: Number(asisRows[0].ausencias || 0),
      };
    }
  } catch (err) {
    console.warn("Aviso al consultar asistencias de la práctica:", err.message);
  }

  // 4. Determinar estado histórico (Finalizada o Cancelada)
  const estadoHistorial = practice.estado === "Cancelada" ? "Cancelada" : "Finalizada";

  // 5. Insertar o actualizar en historial_practica
  const insertSql = `
    INSERT INTO historial_practica (
      practica_id,
      titulo,
      periodo,
      fecha_inicio,
      fecha_fin,
      horas_totales,
      cupos,
      estado,
      motivo_cancelacion,
      descripcion,
      programa_id,
      programa_nombre,
      asignatura_id,
      asignatura_nombre,
      asignatura_codigo,
      institucion_id,
      institucion_nombre,
      servicio_id,
      servicio_nombre,
      docente_cedula,
      docente_nombre,
      docente_correo,
      auditor_cedula,
      auditor_nombre,
      auditor_correo,
      creado_por_rol,
      creador_nombre,
      estudiantes_info,
      asistencias_resumen,
      total_estudiantes,
      fecha_archivo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      titulo = VALUES(titulo),
      periodo = VALUES(periodo),
      fecha_inicio = VALUES(fecha_inicio),
      fecha_fin = VALUES(fecha_fin),
      horas_totales = VALUES(horas_totales),
      cupos = VALUES(cupos),
      estado = VALUES(estado),
      motivo_cancelacion = VALUES(motivo_cancelacion),
      descripcion = VALUES(descripcion),
      programa_id = VALUES(programa_id),
      programa_nombre = VALUES(programa_nombre),
      asignatura_id = VALUES(asignatura_id),
      asignatura_nombre = VALUES(asignatura_nombre),
      asignatura_codigo = VALUES(asignatura_codigo),
      institucion_id = VALUES(institucion_id),
      institucion_nombre = VALUES(institucion_nombre),
      servicio_id = VALUES(servicio_id),
      servicio_nombre = VALUES(servicio_nombre),
      docente_cedula = VALUES(docente_cedula),
      docente_nombre = VALUES(docente_nombre),
      docente_correo = VALUES(docente_correo),
      auditor_cedula = VALUES(auditor_cedula),
      auditor_nombre = VALUES(auditor_nombre),
      auditor_correo = VALUES(auditor_correo),
      creado_por_rol = VALUES(creado_por_rol),
      creador_nombre = VALUES(creador_nombre),
      estudiantes_info = VALUES(estudiantes_info),
      asistencias_resumen = VALUES(asistencias_resumen),
      total_estudiantes = VALUES(total_estudiantes),
      fecha_archivo = NOW()
  `;

  await queryDB(insertSql, [
    practice.id,
    practice.titulo,
    practice.periodo,
    practice.fecha_inicio,
    practice.fecha_fin,
    practice.horas_totales,
    practice.cupos,
    estadoHistorial,
    finalMotivo,
    practice.descripcion,
    practice.programa_id,
    practice.programa_nombre,
    practice.asignatura_id,
    practice.asignatura_nombre,
    practice.asignatura_codigo,
    practice.institucion_id,
    practice.institucion_nombre,
    practice.servicio_id,
    practice.servicio_nombre,
    practice.docente_cedula,
    practice.docente_nombre,
    practice.docente_correo,
    practice.auditor_cedula,
    practice.auditor_nombre,
    practice.auditor_correo,
    practice.creado_por_rol,
    practice.creador_nombre,
    JSON.stringify(studentsData),
    JSON.stringify(asistenciasResumen),
    studentsData.length,
  ]);

  // Obtener el ID del registro en historial_practica
  const histRow = await queryDB(
    "SELECT id FROM historial_practica WHERE practica_id = ? LIMIT 1",
    [practice.id]
  );
  const historialId = histRow[0]?.id;

  if (historialId) {
    // 6. Poblar tabla normalizada historial_practica_estudiante
    await queryDB("DELETE FROM historial_practica_estudiante WHERE historial_id = ?", [historialId]);

    for (const st of studentsData) {
      await queryDB(`
        INSERT INTO historial_practica_estudiante (
          historial_id,
          practica_id,
          estudiante_cedula,
          estudiante_nombre,
          estudiante_codigo,
          calificacion,
          estado_evaluacion,
          horas_cumplidas,
          horas_asignadas,
          tiene_documentos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        historialId,
        practice.id,
        st.cedula,
        st.nombre_completo,
        st.codigo,
        st.calificacion,
        st.estado_evaluacion,
        st.horas_cumplidas,
        st.horas_asignadas,
        st.total_documentos_vinculados > 0 ? 1 : 0,
      ]);
    }
  }

  console.log(`📦 Práctica #${practiceId} (${practice.titulo}) archivada con éxito en el Historial.`);
  return {
    success: true,
    historialId,
    practicaId: practice.id,
    estado: estadoHistorial,
    estudiantesCount: studentsData.length,
  };
}

/**
 * Sincroniza todas las prácticas que ya están 'Finalizada' o 'Cancelada' en la BD
 * y las archiva si aún no existen o se actualizaron.
 */
async function syncAllFinishedAndCancelledPractices() {
  const rows = await queryDB(`
    SELECT id, titulo, estado, motivo_cancelacion 
    FROM practica 
    WHERE estado IN ('Finalizada', 'Cancelada')
  `);

  console.log(`🔄 Sincronizando ${rows.length} prácticas finalizadas/canceladas hacia el historial...`);
  const results = [];
  for (const row of rows) {
    try {
      const res = await archivePractice(row.id, row.motivo_cancelacion);
      results.push({ id: row.id, titulo: row.titulo, status: "ok", res });
    } catch (err) {
      console.error(`❌ Error al archivar práctica #${row.id}:`, err.message);
      results.push({ id: row.id, titulo: row.titulo, status: "error", error: err.message });
    }
  }
  return results;
}

module.exports = {
  archivePractice,
  syncAllFinishedAndCancelledPractices,
};
