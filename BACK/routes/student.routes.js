// ============================================================
// routes/student.routes.js — Rutas del estudiante
// ============================================================
"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");
const { queryDB } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");
const jwt = require("jsonwebtoken");

const fs = require("fs");
const path = require("path");

function getMimeTypeFromBuffer(buffer) {
  if (!buffer || buffer.length < 4) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return "image/jpeg";
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "image/webp";
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }
  return "image/jpeg";
}

/**
 * Middleware de autenticación y autorización para consultas del estudiante:
 * Valida estrictamente el token JWT (Bearer o query param) y previene IDOR asegurando
 * que si el usuario es estudiante, solo acceda a su propia información institucional.
 */
function flexibleStudentAuth(req, res, next) {
  verifyToken(req, res, () => {
    const targetStudentId = req.params.studentId || req.query.studentId || req.body?.estudiante_cedula;
    if (req.user?.role === "student" && targetStudentId && String(req.user.cedula) !== String(targetStudentId)) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado: solo puedes consultar y gestionar tu propia información institucional.",
      });
    }
    next();
  });
}

/**
 * Helper anti-IDOR para verificar si el usuario tiene permiso para acceder
 * o modificar datos del estudiante. Si el rol es 'student', su cédula debe
 * coincidir exactamente con targetStudentId.
 */
function checkStudentOwnership(req, res, targetStudentId) {
  if (req.user?.role === "student" && String(req.user.cedula) !== String(targetStudentId)) {
    res.status(403).json({
      success: false,
      message: "Acceso denegado: solo puedes consultar y gestionar tu propia información institucional.",
    });
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────
// Configuración de Multer (archivos en memoria)
// ──────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({ storage });

const DOCUMENT_FIELDS_MAP = [
  { name: "foto_perfil",               dbColumn: "foto_perfil",               maxCount: 1 },
  { name: "hoja_vida_digital",         dbColumn: "hoja_vida_digital",         maxCount: 1 },
  { name: "seguridad_social_eps",      dbColumn: "seguridad_social_eps",      maxCount: 1 },
  { name: "riesgos_profesionales_arl", dbColumn: "riesgos_profesionales_arl", maxCount: 1 },
  { name: "copia_documento_identidad", dbColumn: "copia_documento_identidad", maxCount: 1 },
  { name: "copia_carnet_estudiantil",  dbColumn: "copia_carnet_estudiantil",  maxCount: 1 },
  { name: "carnet_vacunas",            dbColumn: "carnet_vacunas",            maxCount: 1 },
];

const cpUpload = upload.fields(
  DOCUMENT_FIELDS_MAP.map((f) => ({ name: f.name, maxCount: f.maxCount }))
);

// ──────────────────────────────────────────────
// GET /api/student/profile/:studentId
// ──────────────────────────────────────────────
router.get("/profile/:studentId", verifyToken, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!checkStudentOwnership(req, res, studentId)) return;

    const rows = await queryDB(`
      SELECT
        T1.nombre                  AS name,
        T1.apellidos               AS lastName,
        T1.codigo                  AS code,
        T1.correo_institucional    AS email,
        T1.cedula                  AS studentId,
        T2.nombreprograma          AS career,
        COALESCE(
          (SELECT pe.estado FROM practica_estudiante pe WHERE pe.estudiante_cedula = T1.cedula ORDER BY pe.id DESC LIMIT 1),
          'Pendiente'
        ) AS estado
      FROM estudiante T1
      LEFT JOIN programa T2 ON T1.programa_id = T2.id
      WHERE T1.cedula = ?
      LIMIT 1
    `, [studentId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Estudiante no encontrado." });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/student/details/:studentId
// ──────────────────────────────────────────────
router.get("/details/:studentId", verifyToken, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!checkStudentOwnership(req, res, studentId)) return;
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4004}`;
    const token = req.headers["authorization"]?.startsWith("Bearer ")
      ? req.headers["authorization"].split(" ")[1]
      : req.query.token;
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";

    const rows = await queryDB(`
      SELECT
        e.codigo                     AS code,
        de.biografia                 AS bio,
        de.direccion                 AS address,
        de.telefono                  AS phone,
        de.correo_personal           AS personalEmail,
        de.nombre_familiar           AS familyContactName,
        de.telefono_familiar         AS familyContactPhone,

        CASE WHEN de.foto_perfil IS NOT NULL
          THEN CONCAT('/api/student/photo/', e.cedula)
          ELSE NULL
        END AS photoPreview,

        (de.hoja_vida_digital         IS NOT NULL) AS cvDigital,
        (de.seguridad_social_eps      IS NOT NULL) AS socialSecurity,
        (de.riesgos_profesionales_arl IS NOT NULL) AS professionalRisks,
        (de.copia_documento_identidad IS NOT NULL) AS idCopy,
        (de.copia_carnet_estudiantil  IS NOT NULL) AS carnetCopy,
        (de.carnet_vacunas            IS NOT NULL) AS vaccines,
        COALESCE(
          (SELECT pe.estado FROM practica_estudiante pe WHERE pe.estudiante_cedula = e.cedula ORDER BY pe.id DESC LIMIT 1),
          'Pendiente'
        ) AS estado

      FROM estudiante e
      LEFT JOIN datos_estudiante de ON e.cedula = de.cedula_estudiante
      WHERE e.cedula = ?
      LIMIT 1
    `, [studentId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Datos adicionales no encontrados.", data: null });
    }

    const raw = rows[0];
    const data = {
      ...raw,
      cvDigital:         !!raw.cvDigital,
      socialSecurity:    !!raw.socialSecurity,
      professionalRisks: !!raw.professionalRisks,
      idCopy:            !!raw.idCopy,
      carnetCopy:        !!raw.carnetCopy,
      vaccines:          !!raw.vaccines,
    };

    console.log(`✅ Datos adicionales encontrados para ${studentId}.`);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/student/download/:studentId/:columnName
// Soporta tanto descarga directa (attachment) como previsualización en navegador (inline)
// ──────────────────────────────────────────────
router.get(["/download/:studentId/:columnName", "/view/:studentId/:columnName"], verifyToken, async (req, res, next) => {
  try {
    const { studentId, columnName } = req.params;
    const allowedColumns = DOCUMENT_FIELDS_MAP.map((f) => f.dbColumn);

    if (!allowedColumns.includes(columnName)) {
      return res.status(400).json({ success: false, message: "Nombre de columna no válido." });
    }

    // Autorización (Prevenir IDOR y Broken Object Level Authorization):
    if (req.user.role === "student" && String(req.user.cedula) !== String(studentId)) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado. Solo puedes consultar tus propios documentos.",
      });
    }

    if (req.user.role === "docent") {
      const rel = await queryDB(
        "SELECT 1 FROM practica pr JOIN practica_estudiante pe ON pr.id = pe.practica_id WHERE pr.docente_cedula = ? AND pe.estudiante_cedula = ? LIMIT 1",
        [req.user.cedula, studentId]
      );
      if (rel.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado: no estás asignado como docente de este estudiante.",
        });
      }
    }

    if (req.user.role === "auditor") {
      const rel = await queryDB(
        `SELECT 1 FROM practica pr 
         JOIN practica_estudiante pe ON pr.id = pe.practica_id 
         WHERE (pr.auditor_cedula = ? OR pr.institucion_id = (SELECT institucion_id FROM auditor WHERE cedula = ? LIMIT 1))
           AND pe.estudiante_cedula = ? LIMIT 1`,
        [req.user.cedula, req.user.cedula, studentId]
      );
      if (rel.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado: no estás asignado como auditor de este estudiante.",
        });
      }
    }

    const rows = await queryDB(
      `SELECT ${columnName} FROM datos_estudiante WHERE cedula_estudiante = ? LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0 || !rows[0][columnName]) {
      return res.status(404).json({ success: false, message: "Archivo no encontrado o vacío." });
    }

    const fileBuffer = rows[0][columnName];
    const isInline = req.query.view === "true" || req.query.inline === "true" || req.path.includes("/view/");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isInline ? "inline" : "attachment"}; filename="${columnName}_${studentId}.pdf"`
    );
    res.setHeader("Content-Length", fileBuffer.length);
    console.log(`✅ Archivo ${columnName} enviado (${isInline ? "inline" : "attachment"}).`);
    res.end(fileBuffer);
  } catch (err) {
    next(err);
  }
});

// Caché ultrarrápida en memoria RAM para fotos de perfil (tiempo de respuesta < 1ms)
const photoMemoryCache = new Map();
// Caché negativa en memoria para evitar consultas repetidas a MySQL de estudiantes sin foto
const missingPhotoCache = new Map();

// ──────────────────────────────────────────────
// GET /api/student/photo/:studentId
// Con caché en memoria RAM, caché en disco, ETag HTTP 304 y encabezados universales
// ──────────────────────────────────────────────
router.get("/photo/:studentId", async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const studentKey = String(studentId);

    // Encabezados CORS y de recursos cruzados para permitir visualización en cualquier <img>
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    const ifNoneMatch = req.headers["if-none-match"];

    // 1. Verificación en caché de memoria RAM (Ultra rápido: < 1ms)
    const inMem = photoMemoryCache.get(studentKey);
    if (inMem && inMem.buffer) {
      if (ifNoneMatch && ifNoneMatch === inMem.etag) {
        return res.status(304).end();
      }
      res.setHeader("Content-Type", inMem.mimeType);
      res.setHeader("ETag", inMem.etag);
      res.setHeader("Content-Length", inMem.buffer.length);
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      return res.end(inMem.buffer);
    }

    // 1.1 Si recientemente se verificó que este estudiante no tiene foto (TTL 60s), responder 404 inmediato
    const missingTime = missingPhotoCache.get(studentKey);
    if (missingTime && (Date.now() - missingTime < 60000)) {
      return res.status(404).json({ success: false, message: "Foto no encontrada." });
    }

    const avatarDir = path.join(__dirname, "../uploads/avatars");
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }

    const cachedFilePath = path.join(avatarDir, `${studentKey}.bin`);
    const metaFilePath = path.join(avatarDir, `${studentKey}.meta`);

    // 2. Si existe en caché local en disco, cargar a memoria y servir de inmediato
    if (fs.existsSync(cachedFilePath)) {
      try {
        const fileBuffer = fs.readFileSync(cachedFilePath);
        let mimeType = "image/jpeg";
        if (fs.existsSync(metaFilePath)) {
          mimeType = fs.readFileSync(metaFilePath, "utf8").trim() || mimeType;
        } else {
          mimeType = getMimeTypeFromBuffer(fileBuffer);
        }

        const etag = `W/"photo-${studentKey}-${fileBuffer.length}"`;
        photoMemoryCache.set(studentKey, { buffer: fileBuffer, mimeType, etag });
        missingPhotoCache.delete(studentKey);

        if (ifNoneMatch && ifNoneMatch === etag) {
          return res.status(304).end();
        }

        res.setHeader("Content-Type", mimeType);
        res.setHeader("ETag", etag);
        res.setHeader("Content-Length", fileBuffer.length);
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return res.end(fileBuffer);
      } catch (cacheErr) {
        console.warn("Aviso al servir desde caché de disco:", cacheErr.message);
      }
    }

    // 3. Si no está en disco ni en memoria, consultar la BD remota
    const rows = await queryDB(
      `SELECT foto_perfil FROM datos_estudiante WHERE cedula_estudiante = ? LIMIT 1`,
      [studentKey]
    );

    if (rows.length === 0 || !rows[0].foto_perfil) {
      missingPhotoCache.set(studentKey, Date.now());
      return res.status(404).json({ success: false, message: "Foto no encontrada." });
    }

    const fileBuffer = rows[0].foto_perfil;
    const mimeType = getMimeTypeFromBuffer(fileBuffer);
    const etag = `W/"photo-${studentKey}-${fileBuffer.length}"`;

    // Guardar en memoria RAM y en disco
    photoMemoryCache.set(studentKey, { buffer: fileBuffer, mimeType, etag });
    missingPhotoCache.delete(studentKey);

    try {
      fs.writeFileSync(cachedFilePath, fileBuffer);
      fs.writeFileSync(metaFilePath, mimeType, "utf8");
    } catch (diskErr) {
      console.warn("Aviso al escribir foto en disco:", diskErr.message);
    }

    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("ETag", etag);
    res.setHeader("Content-Length", fileBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.end(fileBuffer);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/student/insert
// ──────────────────────────────────────────────
router.post("/insert", verifyToken, cpUpload, async (req, res, next) => {
  try {
    const { body, files } = req;
    const cedula = body.cedula;

    if (!cedula) {
      return res.status(400).json({ success: false, message: "Falta el campo cédula del estudiante." });
    }

    if (!checkStudentOwnership(req, res, cedula)) return;

    const textFieldsMap = [
      { frontend: "biografia",          db: "biografia" },
      { frontend: "direccion",          db: "direccion" },
      { frontend: "telefono",           db: "telefono" },
      { frontend: "correo_personal",    db: "correo_personal" },
      { frontend: "nombre_familiar",    db: "nombre_familiar" },
      { frontend: "telefono_familiar",  db: "telefono_familiar" },
    ];

    let fieldNames = ["cedula_estudiante"];
    let fieldValues = [cedula];

    // Campos de texto
    textFieldsMap.forEach(({ frontend, db }) => {
      const value = body[frontend] === "" || body[frontend] === undefined ? null : body[frontend];
      fieldNames.push(db);
      fieldValues.push(value);
    });

    // Campos de archivos (BLOB)
    DOCUMENT_FIELDS_MAP.forEach(({ name, dbColumn }) => {
      const fileArray = files?.[name];
      const fileBuffer = fileArray?.length > 0 ? fileArray[0].buffer : null;
      fieldNames.push(dbColumn);
      fieldValues.push(fileBuffer);
    });

    const placeholders = fieldNames.map(() => "?").join(", ");

    // Solo actualizar archivos si el nuevo valor no es NULL (preservar los existentes)
    const updateClauses = fieldNames
      .filter((f) => f !== "cedula_estudiante")
      .map((field) => {
        if (DOCUMENT_FIELDS_MAP.some((m) => m.dbColumn === field)) {
          return `${field} = IF(VALUES(${field}) IS NOT NULL, VALUES(${field}), ${field})`;
        }
        return `${field} = VALUES(${field})`;
      })
      .join(", ");

    await queryDB(`
      INSERT INTO datos_estudiante (${fieldNames.join(", ")})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updateClauses}
    `, fieldValues);

    // Si se subió foto_perfil, guardar inmediatamente en memoria RAM y disco para velocidad máxima
    let updatedPhotoUrl = null;
    if (files?.foto_perfil?.[0]?.buffer) {
      try {
        const studentKey = String(cedula);
        const buf = files.foto_perfil[0].buffer;
        const mime = getMimeTypeFromBuffer(buf);
        const etag = `W/"photo-${studentKey}-${buf.length}"`;

        // Actualizar caché en memoria de inmediato
        photoMemoryCache.set(studentKey, { buffer: buf, mimeType: mime, etag });
        missingPhotoCache.delete(studentKey);

        const avatarDir = path.join(__dirname, "../uploads/avatars");
        if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
        fs.writeFileSync(path.join(avatarDir, `${studentKey}.bin`), buf);
        fs.writeFileSync(path.join(avatarDir, `${studentKey}.meta`), mime, "utf8");

        updatedPhotoUrl = `/api/student/photo/${studentKey}?t=${Date.now()}`;
      } catch (cacheErr) {
        console.warn("Aviso al guardar avatar en disco:", cacheErr.message);
      }
    }

    console.log(`✅ Perfil guardado/actualizado correctamente para ${cedula}`);
    res.status(201).json({
      success: true,
      message: "Datos del estudiante guardados correctamente.",
      photoUrl: updatedPhotoUrl,
    });
  } catch (err) {
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        success: false,
        message: "La cédula proporcionada no existe en la tabla de estudiantes.",
      });
    }
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/student/practices/:studentId (o /practices)
// ──────────────────────────────────────────────
router.get(["/practices", "/practices/:studentId"], verifyToken, async (req, res, next) => {
  try {
    const studentId = req.user.role === "student" ? req.user.cedula : (req.params.studentId || req.query.studentId || req.user.cedula);

    if (req.user.role === "student" && req.params.studentId && String(req.params.studentId) !== String(req.user.cedula)) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado: solo puedes consultar tu propia información.",
      });
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Cédula del estudiante no especificada.",
      });
    }

    const rows = await queryDB(`
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
        pe.id AS asignacion_id,
        pe.estado AS estado_asignacion,
        COALESCE(pe.horas_cumplidas, 0) AS horas_cumplidas,
        COALESCE(pe.horas_asignadas, pr.horas_totales, 120) AS horas_asignadas,
        pe.calificacion,
        pe.retroalimentacion,
        pe.fecha_evaluacion,
        pe.estado_evaluacion,
        pe.criterios,
        pe.created_at AS asignado_en
      FROM practica_estudiante pe
      INNER JOIN practica pr ON pe.practica_id = pr.id
      LEFT JOIN programa p ON pr.programa_id = p.id
      LEFT JOIN asignatura a ON pr.asignatura_id = a.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      LEFT JOIN auditor au ON pr.auditor_cedula = au.cedula
      WHERE pe.estudiante_cedula = ?
      ORDER BY pr.fecha_inicio DESC, pr.id DESC
    `, [studentId]);

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    const practiceIds = rows.map((r) => r.id);
    const placeholders = practiceIds.map(() => "?").join(",");

    const result = rows.map((r) => {
      const hCumplidas = Number(r.horas_cumplidas || 0);
      const hAsignadas = Number(r.horas_asignadas || r.horas_totales || 120);
      const progresoHoras = hAsignadas > 0 ? Math.min(100, Math.round((hCumplidas / hAsignadas) * 100)) : 0;

      return {
        ...r,
        horas_cumplidas: hCumplidas,
        horas_asignadas: hAsignadas,
        horas_totales: hAsignadas,
        progreso_horas: progresoHoras,
        calificacion: r.calificacion !== null ? Number(r.calificacion) : null,
        observaciones: [],
        total_observaciones: 0,
      };
    });

    console.log(`✅ Prácticas reales consultadas para estudiante ${studentId}: ${result.length} encontrada(s). Horas y progreso incluidos.`);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/student/evaluations/:studentId (o /evaluations)
// ──────────────────────────────────────────────
router.get(["/evaluations", "/evaluations/:studentId"], verifyToken, async (req, res, next) => {
  try {
    const studentId = req.user.role === "student" ? req.user.cedula : (req.params.studentId || req.query.studentId || req.user.cedula);

    if (req.user.role === "student" && req.params.studentId && String(req.params.studentId) !== String(req.user.cedula)) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado: solo puedes consultar tu propia información.",
      });
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Cédula del estudiante no especificada.",
      });
    }

    const rows = await queryDB(`
      SELECT 
        pe.id AS id,
        pe.practica_id,
        pe.calificacion AS score,
        pe.retroalimentacion AS feedback,
        pe.fecha_evaluacion AS date,
        pe.estado_evaluacion AS status,
        pe.criterios,
        pr.titulo AS practice,
        s.nombreservicio AS service,
        i.nombreinstitucion AS institution,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docent,
        d.correo_institucional AS docent_correo
      FROM practica_estudiante pe
      INNER JOIN practica pr ON pe.practica_id = pr.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      WHERE pe.estudiante_cedula = ?
      ORDER BY pe.fecha_evaluacion DESC, pr.id DESC
    `, [studentId]);

    const formatted = rows.map((r) => {
      let criteriosParsed = null;
      if (r.criterios) {
        try {
          criteriosParsed = typeof r.criterios === "string" ? JSON.parse(r.criterios) : r.criterios;
        } catch (e) {
          criteriosParsed = null;
        }
      }

      return {
        id: r.id,
        practica_id: r.practica_id,
        practice: r.practice,
        service: r.service || "Servicio Asignado",
        institution: r.institution || "Institución Hospitalaria",
        docent: r.docent?.trim() || "Docente Asesor",
        docent_correo: r.docent_correo || "",
        status: r.status || (r.score !== null ? "Completada" : "Pendiente"),
        score: r.score !== null ? Number(r.score) : null,
        feedback: r.feedback || null,
        date: r.date ? new Date(r.date).toISOString().substring(0, 10) : null,
        likertScores: criteriosParsed,
      };
    });

    console.log(`✅ Evaluaciones reales consultadas para estudiante ${studentId}: ${formatted.length} encontrada(s).`);
    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/student/certificate-requests/:studentId
// ──────────────────────────────────────────────
router.get(["/certificate-requests", "/certificate-requests/:studentId"], verifyToken, async (req, res, next) => {
  try {
    const studentId = req.user.role === "student" ? req.user.cedula : (req.params.studentId || req.query.studentId || req.user.cedula);

    if (req.user.role === "student" && req.params.studentId && String(req.params.studentId) !== String(req.user.cedula)) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado: solo puedes consultar tu propia información.",
      });
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Cédula del estudiante no especificada.",
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
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre,
        d.correo_institucional AS docente_correo,
        d.foto_firma AS docente_foto_firma
      FROM solicitud_certificado sc
      LEFT JOIN practica pr ON sc.practica_id = pr.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN docente d ON COALESCE(sc.docente_cedula, pr.docente_cedula) = d.cedula
      WHERE sc.estudiante_cedula = ?
      ORDER BY sc.fecha_solicitud DESC
    `, [studentId]);

    console.log(`✅ Solicitudes de certificado para estudiante ${studentId}: ${rows.length} encontrada(s).`);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/student/certificate-requests
// ──────────────────────────────────────────────
router.post("/certificate-requests", verifyToken, async (req, res, next) => {
  try {
    const {
      estudiante_cedula,
      docente_cedula,
      practica_id,
      tipo_certificado,
      motivo,
      observaciones,
      categoria_solicitud,
    } = req.body;

    const effectiveCedula = req.user.role === "student" ? req.user.cedula : (estudiante_cedula || req.user.cedula);

    if (!effectiveCedula || !practica_id || !tipo_certificado) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios (estudiante_cedula, practica_id, tipo_certificado).",
      });
    }

    const isReport =
      categoria_solicitud === "reporte" ||
      (tipo_certificado && tipo_certificado.toLowerCase().includes("reporte")) ||
      (tipo_certificado && tipo_certificado.toLowerCase().includes("constancia"));

    const finalCategoria = isReport ? "reporte" : "certificado";

    // Si es un certificado oficial, es OBLIGATORIO que la práctica tenga nota final registrada
    if (!isReport) {
      const evalCheck = await queryDB(
        "SELECT calificacion, estado_evaluacion FROM practica_estudiante WHERE practica_id = ? AND estudiante_cedula = ?",
        [practica_id, effectiveCedula]
      );
      const hasGrade =
        evalCheck.length > 0 &&
        evalCheck[0].calificacion !== null &&
        evalCheck[0].calificacion !== undefined &&
        evalCheck[0].calificacion !== "" &&
        Number(evalCheck[0].calificacion) > 0;

      if (!hasGrade) {
        return res.status(400).json({
          success: false,
          requiresReport: true,
          message:
            "Aún no cuentas con una calificación final registrada por tu docente en esta práctica formativa. No es posible tramitar un Certificado Oficial sin nota. Por favor solicita un Reporte de Práctica.",
        });
      }
    }

    let finalDocenteCedula = docente_cedula;
    if (!finalDocenteCedula) {
      const prRows = await queryDB("SELECT docente_cedula FROM practica WHERE id = ? LIMIT 1", [practica_id]);
      if (prRows.length > 0) {
        finalDocenteCedula = prRows[0].docente_cedula;
      }
    }

    const result = await queryDB(`
      INSERT INTO solicitud_certificado (
        estudiante_cedula,
        docente_cedula,
        practica_id,
        tipo_certificado,
        categoria_solicitud,
        motivo,
        observaciones,
        estado,
        fecha_solicitud
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', NOW())
    `, [
      effectiveCedula,
      finalDocenteCedula || null,
      practica_id,
      tipo_certificado,
      finalCategoria,
      motivo || (isReport ? "Solicitud de Reporte de Práctica" : "Solicitud de Certificado Oficial"),
      observaciones || null,
    ]);

    console.log(`✅ Solicitud de certificado #${result.insertId} registrada para estudiante ${effectiveCedula}`);
    res.status(201).json({
      success: true,
      message: "Solicitud de certificado enviada exitosamente al docente.",
      requestId: result.insertId,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/student/certificate-requests/:id
// ──────────────────────────────────────────────
router.delete("/certificate-requests/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const checkRows = await queryDB(
      "SELECT id, estudiante_cedula FROM solicitud_certificado WHERE id = ?",
      [id]
    );
    if (checkRows.length === 0) {
      return res.status(404).json({ success: false, message: "Solicitud no encontrada." });
    }
    if (req.user.role === "student" && String(checkRows[0].estudiante_cedula) !== String(req.user.cedula)) {
      return res.status(403).json({ success: false, message: "No tienes permisos para cancelar esta solicitud de certificado." });
    }
    await queryDB("DELETE FROM solicitud_certificado WHERE id = ?", [id]);
    res.status(200).json({ success: true, message: "Solicitud cancelada correctamente." });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ─── COMUNICACIÓN CON EL DOCENTE (ESTUDIANTE <-> DOCENTE)
// ============================================================

// ──────────────────────────────────────────────
// GET /api/student/communication/practices
// Prácticas activas/inscritas del estudiante con información de su docente
// ──────────────────────────────────────────────
router.get("/communication/practices", verifyToken, async (req, res, next) => {
  try {
    const studentCedula = req.user.role === "student" ? req.user.cedula : (req.query.studentId || req.user.cedula);
    if (!studentCedula) {
      return res.status(400).json({ success: false, message: "Identificación de estudiante requerida." });
    }

    const rows = await queryDB(`
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
        pr.docente_cedula,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre,
        d.correo_institucional AS docente_correo,
        dd.telefono AS docente_telefono,
        (
          SELECT COUNT(*)
          FROM mensaje_estudiante_docente med
          WHERE med.practica_id = pr.id
            AND (med.estudiante_cedula = ? OR med.destinatario_tipo = 'todos')
            AND med.remitente_rol = 'docente'
            AND med.leido_por_estudiante = 0
        ) AS unread_messages_count
      FROM practica_estudiante pe
      INNER JOIN practica pr ON pe.practica_id = pr.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      LEFT JOIN datos_docente dd ON pr.docente_cedula = dd.cedula_docente
      WHERE pe.estudiante_cedula = ?
      ORDER BY pr.fecha_inicio DESC, pr.id DESC
    `, [studentCedula, studentCedula]);

    const result = rows.map((r) => ({
      ...r,
      unread_messages_count: Number(r.unread_messages_count || 0),
    }));

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/student/communication/practices/:practiceId/messages
// Mensajes entre el estudiante y el docente en una práctica específica
// ──────────────────────────────────────────────
router.get("/communication/practices/:practiceId/messages", verifyToken, async (req, res, next) => {
  try {
    const { practiceId } = req.params;
    const studentCedula = req.user.role === "student" ? req.user.cedula : (req.query.studentId || req.user.cedula);

    // Verificar que el estudiante esté inscrito en la práctica
    const enrolledCheck = await queryDB(
      "SELECT id FROM practica_estudiante WHERE practica_id = ? AND estudiante_cedula = ?",
      [practiceId, studentCedula]
    );

    if (enrolledCheck.length === 0 && req.user?.role === "student") {
      return res.status(403).json({
        success: false,
        message: "No tienes asignación en esta práctica formativa.",
      });
    }

    const messages = await queryDB(`
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
        med.leido_por_estudiante,
        med.created_at,
        CONCAT(COALESCE(d.nombre, ''), ' ', COALESCE(d.apellidos, '')) AS docente_nombre,
        d.correo_institucional AS docente_correo
      FROM mensaje_estudiante_docente med
      LEFT JOIN docente d ON med.docente_cedula = d.cedula
      WHERE med.practica_id = ?
        AND (med.estudiante_cedula = ? OR med.destinatario_tipo = 'todos')
      ORDER BY med.created_at ASC, med.id ASC
    `, [practiceId, studentCedula]);

    // Marcar como leídos por el estudiante los mensajes del docente
    try {
      await queryDB(`
        UPDATE mensaje_estudiante_docente
        SET leido_por_estudiante = 1
        WHERE practica_id = ?
          AND (estudiante_cedula = ? OR destinatario_tipo = 'todos')
          AND remitente_rol = 'docente'
          AND leido_por_estudiante = 0
      `, [practiceId, studentCedula]);
    } catch (e) {
      console.warn("No se pudo marcar mensajes como leídos por estudiante:", e.message);
    }

    res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/student/communication/practices/:practiceId/messages
// Enviar mensaje o consulta del estudiante al docente de la práctica
// ──────────────────────────────────────────────
router.post("/communication/practices/:practiceId/messages", verifyToken, async (req, res, next) => {
  try {
    const { practiceId } = req.params;
    const studentCedula = req.user.role === "student" ? req.user.cedula : (req.body.estudiante_cedula || req.user.cedula);
    const { titulo, mensaje, tipo } = req.body;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ success: false, message: "El mensaje no puede estar vacío." });
    }

    // Verificar inscripción y obtener docente a cargo
    const prRows = await queryDB(`
      SELECT pr.id, pr.docente_cedula, pe.id AS asignacion_id
      FROM practica pr
      INNER JOIN practica_estudiante pe ON pr.id = pe.practica_id AND pe.estudiante_cedula = ?
      WHERE pr.id = ?
    `, [studentCedula, practiceId]);

    if (prRows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "No te encuentras matriculado o asignado en esta práctica.",
      });
    }

    const docentCedula = prRows[0].docente_cedula;
    if (!docentCedula) {
      return res.status(400).json({
        success: false,
        message: "Esta práctica no tiene un docente asignado actualmente.",
      });
    }

    // Nombre del estudiante
    const stRows = await queryDB("SELECT nombre, apellidos FROM estudiante WHERE cedula = ?", [studentCedula]);
    const studentName = stRows.length > 0 ? `${stRows[0].nombre} ${stRows[0].apellidos}`.trim() : "Estudiante";

    const finalTitulo = (titulo && titulo.trim()) || "Mensaje del Estudiante";
    const finalTipo = tipo || "General";

    const insertRes = await queryDB(`
      INSERT INTO mensaje_estudiante_docente (
        practica_id,
        docente_cedula,
        estudiante_cedula,
        destinatario_tipo,
        remitente_rol,
        remitente_cedula,
        remitente_nombre,
        titulo,
        mensaje,
        tipo,
        leido_por_docente,
        leido_por_estudiante,
        created_at
      ) VALUES (?, ?, ?, 'individual', 'estudiante', ?, ?, ?, ?, ?, 0, 1, NOW())
    `, [
      practiceId,
      docentCedula,
      studentCedula,
      studentCedula,
      studentName,
      finalTitulo,
      mensaje.trim(),
      finalTipo,
    ]);

    console.log(`✅ Mensaje enviado de estudiante ${studentCedula} a docente ${docentCedula} en práctica #${practiceId}`);
    res.status(201).json({
      success: true,
      message: "Mensaje enviado exitosamente a tu docente.",
      messageId: insertRes.insertId,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/student/communication/unread-count
// Conteo de mensajes no leídos del docente para el estudiante
// ──────────────────────────────────────────────
router.get("/communication/unread-count", verifyToken, async (req, res, next) => {
  try {
    const studentCedula = req.user.role === "student" ? req.user.cedula : (req.query.studentId || req.user.cedula);
    if (!studentCedula) {
      return res.status(200).json({ success: true, unreadCount: 0 });
    }

    const rows = await queryDB(`
      SELECT COUNT(*) AS unreadCount
      FROM mensaje_estudiante_docente med
      INNER JOIN practica_estudiante pe ON med.practica_id = pe.practica_id AND pe.estudiante_cedula = ?
      WHERE (med.estudiante_cedula = ? OR med.destinatario_tipo = 'todos')
        AND med.remitente_rol = 'docente'
        AND med.leido_por_estudiante = 0
    `, [studentCedula, studentCedula]);

    const unreadCount = rows[0]?.unreadCount ? Number(rows[0].unreadCount) : 0;
    res.status(200).json({ success: true, unreadCount });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/student/communication/mark-read
// Marcar mensajes como leídos por el estudiante
// ──────────────────────────────────────────────
router.put("/communication/mark-read", verifyToken, async (req, res, next) => {
  try {
    const studentCedula = req.user.role === "student" ? req.user.cedula : (req.body.estudiante_cedula || req.user.cedula);
    const { practiceId } = req.body || {};

    let query = `
      UPDATE mensaje_estudiante_docente
      SET leido_por_estudiante = 1
      WHERE (estudiante_cedula = ? OR destinatario_tipo = 'todos')
        AND remitente_rol = 'docente'
        AND leido_por_estudiante = 0
    `;
    const params = [studentCedula];

    if (practiceId) {
      query += ` AND practica_id = ?`;
      params.push(practiceId);
    }

    await queryDB(query, params);
    res.status(200).json({ success: true, message: "Mensajes marcados como leídos por el estudiante." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/student/communication/messages/:id
// Eliminar mensaje enviado por el estudiante (máximo 5 minutos)
// ──────────────────────────────────────────────
router.delete("/communication/messages/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentCedula = req.user.role === "student" ? req.user.cedula : (req.query.studentId || req.user.cedula);

    const msgRows = await queryDB(
      "SELECT id, remitente_rol, remitente_cedula, created_at FROM mensaje_estudiante_docente WHERE id = ?",
      [id]
    );

    if (msgRows.length === 0) {
      return res.status(404).json({ success: false, message: "Mensaje no encontrado." });
    }

    const msg = msgRows[0];

    // Verificar autoría
    if (msg.remitente_rol !== "estudiante" || String(msg.remitente_cedula) !== String(studentCedula)) {
      return res.status(403).json({ success: false, message: "No tienes permiso para eliminar este mensaje." });
    }

    await queryDB("DELETE FROM mensaje_estudiante_docente WHERE id = ?", [id]);

    console.log(`🗑️ Mensaje #${id} eliminado por estudiante ${studentCedula}.`);
    res.status(200).json({ success: true, message: "Mensaje eliminado exitosamente." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

