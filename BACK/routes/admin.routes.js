// ============================================================
// routes/admin.routes.js — Rutas del administrador
// ============================================================
"use strict";

const path = require("path");
const fs = require("fs");
const multer = require("multer");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { queryDB, getColombiaToday } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");

// ── Configuración de almacenamiento Multer para logos y fondos ──
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}_${uniqueSuffix}${ext}`);
  },
});

const uploadInstitutionFile = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten archivos de imagen"), false);
    }
    cb(null, true);
  },
});

// ──────────────────────────────────────────────
// Configuración compartida
// ──────────────────────────────────────────────
const ROLE_TABLES_MAP = [
  {
    tableName: "superadmin",
    roleName: "superadmin",
    dataTable: null,
    dataCedulaCol: null,
    nameCol: "nombre",
    apellidoCol: "apellidos",
    emailCol: "T1.correo_institucional",
    codigoCol: "NULL",
    progCol: "NULL",
    instCol: "NULL",
    carreraExpr: "'Superadministración UPTC'",
  },
  {
    tableName: "administrador",
    roleName: "admin",
    dataTable: null,
    dataCedulaCol: null,
    nameCol: "nombre",
    apellidoCol: "apellidos",
    emailCol: "T1.correo_institucional",
    codigoCol: "NULL",
    progCol: "NULL",
    instCol: "NULL",
    carreraExpr: "'Administración UPTC'",
  },
  {
    tableName: "auditor",
    roleName: "auditor",
    dataTable: null,
    dataCedulaCol: null,
    nameCol: "nombre",
    apellidoCol: "apellidos",
    emailCol: "T1.correo_institucional",
    codigoCol: "NULL",
    progCol: "NULL",
    instCol: "T1.institucion_id",
    carreraExpr: "(SELECT nombreinstitucion FROM institucion WHERE id = T1.institucion_id)",
  },
  {
    tableName: "docente",
    roleName: "docent",
    dataTable: "datos_docente",
    dataCedulaCol: "cedula_docente",
    nameCol: "nombre",
    apellidoCol: "apellidos",
    emailCol: "T1.correo_institucional",
    codigoCol: "NULL",
    progCol: "T1.programa_id",
    instCol: "NULL",
    carreraExpr: "(SELECT nombreprograma FROM programa WHERE id = T1.programa_id)",
  },
  {
    tableName: "estudiante",
    roleName: "student",
    dataTable: "datos_estudiante",
    dataCedulaCol: "cedula_estudiante",
    nameCol: "nombre",
    apellidoCol: "apellidos",
    emailCol: "T1.correo_institucional",
    codigoCol: "T1.codigo",
    progCol: "T1.programa_id",
    instCol: "NULL",
    carreraExpr: "(SELECT nombreprograma FROM programa WHERE id = T1.programa_id)",
  },
];

// ──────────────────────────────────────────────
// Rutas de configuración institucional (Lectura pública para Login/Branding)
// ──────────────────────────────────────────────
router.get("/institution-settings", getInstitutionSettingsHandler);

// ──────────────────────────────────────────────
// Todas las demás rutas de admin requieren autenticación y rol 'admin' o 'superadmin'
// ──────────────────────────────────────────────
router.use(verifyToken);
router.use(requireRole("admin", "superadmin"));

// Modificación de Configuración Institucional (Solo SUPERADMIN)
router.put("/institution-settings", requireRole("superadmin"), updateInstitutionSettingsHandler);
router.post("/institution-logo", requireRole("superadmin"), uploadInstitutionFile.single("logo"), uploadInstitutionLogoHandler);
router.post("/faculty-logo", requireRole("superadmin"), uploadInstitutionFile.single("facultyLogo"), uploadFacultyLogoHandler);
router.delete("/faculty-logo", requireRole("superadmin"), deleteFacultyLogoHandler);
router.post("/login-bg", requireRole("superadmin"), uploadInstitutionFile.single("loginBg"), uploadLoginBgHandler);

// ──────────────────────────────────────────────
// GET /api/admin/users/count
// ──────────────────────────────────────────────
router.get("/users/count", async (req, res, next) => {
  try {
    const [superRows, saRows, auRows, docRows, estRows] = await Promise.all([
      queryDB("SELECT COUNT(cedula) AS cnt FROM superadmin"),
      queryDB("SELECT COUNT(cedula) AS cnt FROM administrador"),
      queryDB("SELECT COUNT(cedula) AS cnt FROM auditor"),
      queryDB("SELECT COUNT(cedula) AS cnt FROM docente"),
      queryDB("SELECT COUNT(cedula) AS cnt FROM estudiante"),
    ]);

    const superadmins = Number(superRows[0]?.cnt || 0);
    const admins = Number(saRows[0]?.cnt || 0);
    const auditores = Number(auRows[0]?.cnt || 0);
    const docentes = Number(docRows[0]?.cnt || 0);
    const estudiantes = Number(estRows[0]?.cnt || 0);
    const totalCount = superadmins + admins + auditores + docentes + estudiantes;

    console.log(
      `✅ Conteo detallado de usuarios: Total=${totalCount} (Superadmins: ${superadmins}, Admins: ${admins}, Auditores: ${auditores}, Docentes: ${docentes}, Estudiantes: ${estudiantes})`
    );

    res.status(200).json({
      total_users: totalCount,
      by_role: {
        superadmin: superadmins,
        admin: admins,
        auditor: auditores,
        docent: docentes,
        student: estudiantes,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/admin/users
// ──────────────────────────────────────────────
router.get("/users", async (req, res, next) => {
  try {
    const unionQueries = ROLE_TABLES_MAP.map((roleMap) => {
      const T1 = "T1";
      const emailCol = roleMap.emailCol || `${T1}.correo_institucional`;
      const nameCol = roleMap.nameCol ? `${T1}.${roleMap.nameCol}` : `${T1}.nombre`;
      const apellidoCol = roleMap.apellidoCol ? `${T1}.${roleMap.apellidoCol}` : `${T1}.apellidos`;
      const codigoCol = roleMap.codigoCol || "NULL";

      let dataCheckSelect = `FALSE AS Tiene_Datos_Adicionales`;

      if (roleMap.dataTable) {
        dataCheckSelect = `(EXISTS(SELECT 1 FROM ${roleMap.dataTable} WHERE ${roleMap.dataCedulaCol} = ${T1}.cedula)) AS Tiene_Datos_Adicionales`;
      }

      return `(SELECT '${roleMap.roleName}' AS Rol, ${T1}.cedula AS Cédula, ${codigoCol} AS Codigo, ${nameCol} AS Nombre, ${apellidoCol} AS Apellidos, ${emailCol} AS Correo_Institucional, ${dataCheckSelect}, ${roleMap.progCol} AS programa_id, ${roleMap.instCol} AS institucion_id, ${roleMap.carreraExpr} AS Carrera, ${T1}.id AS id_user_table FROM ${roleMap.tableName} AS ${T1})`;
    }).join(" UNION ALL ");

    const rows = await queryDB(
      `SELECT * FROM (${unionQueries}) AS consolidated_users ORDER BY Rol, Nombre`
    );

    console.log(`✅ Listado de ${rows.length} usuarios enviado.`);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/admin/programas
// ──────────────────────────────────────────────
router.get("/programas", async (req, res, next) => {
  try {
    const rows = await queryDB(`
      SELECT 
        p.id, 
        p.nombreprograma,
        (SELECT COUNT(*) FROM estudiante e WHERE e.programa_id = p.id) AS total_estudiantes,
        (SELECT COUNT(*) FROM docente d WHERE d.programa_id = p.id) AS total_docentes,
        (SELECT COUNT(*) FROM asignatura a WHERE a.programa_id = p.id) AS total_asignaturas
      FROM programa p 
      ORDER BY p.nombreprograma
    `);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/admin/asignaturas
// ──────────────────────────────────────────────
router.get("/asignaturas", async (req, res, next) => {
  try {
    const rows = await queryDB(`
      SELECT
        A.codigoasignatura AS Codigo,
        A.nombreasignatura AS Nombre,
        P.nombreprograma   AS ProgramaAsociado,
        A.programa_id      AS programa_id,
        A.id               AS id_asignatura_table
      FROM asignatura AS A
      LEFT JOIN programa AS P ON A.programa_id = P.id
      ORDER BY Nombre
    `);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/admin/instituciones
// ──────────────────────────────────────────────
router.get("/instituciones", async (req, res, next) => {
  try {
    const rows = await queryDB(`
      SELECT 
        i.id, 
        i.nombreinstitucion,
        (SELECT COUNT(*) FROM servicio s WHERE s.institucion_id = i.id) AS total_servicios,
        (SELECT COUNT(*) FROM auditor au WHERE au.institucion_id = i.id) AS total_auditores
      FROM institucion i 
      ORDER BY i.nombreinstitucion
    `);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/admin/servicios
// ──────────────────────────────────────────────
router.get("/servicios", async (req, res, next) => {
  try {
    const rows = await queryDB(`
      SELECT
        S.id               AS id_servicio_table,
        S.nombreservicio   AS Nombre,
        S.institucion_id   AS institucion_id,
        I.nombreinstitucion AS InstitucionAsociada
      FROM servicio AS S
      LEFT JOIN institucion AS I ON S.institucion_id = I.id
      ORDER BY Nombre
    `);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/docente
// ──────────────────────────────────────────────
router.post("/docente", async (req, res, next) => {
  try {
    const { rol_id, cedula, password, nombre, apellidos, correo_institucional, programa_id } = req.body;

    if (!rol_id || !cedula || !password || !nombre || !apellidos || !programa_id) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios." });
    }

    if (!/^\d+$/.test(String(cedula).trim())) {
      return res.status(400).json({ success: false, message: "La cédula solo debe contener números." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await queryDB(
      `INSERT INTO docente (rol_id, cedula, password, nombre, apellidos, correo_institucional, programa_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rol_id, cedula, hashedPassword, nombre, apellidos, correo_institucional || null, programa_id]
    );

    console.log(`✅ Docente creado: ${cedula}`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Ya existe un usuario con esa cédula." });
    }
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/auditor
// ──────────────────────────────────────────────
router.post("/auditor", async (req, res, next) => {
  try {
    const { rol_id, cedula, password, nombre, apellidos, correo_institucional, institucion_id } = req.body;

    if (!rol_id || !cedula || !password || !nombre || !apellidos || !institucion_id) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios." });
    }

    if (!/^\d+$/.test(String(cedula).trim())) {
      return res.status(400).json({ success: false, message: "La cédula solo debe contener números." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await queryDB(
      `INSERT INTO auditor (rol_id, cedula, password, nombre, apellidos, correo_institucional, institucion_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rol_id, cedula, hashedPassword, nombre, apellidos, correo_institucional || null, institucion_id]
    );

    console.log(`✅ Auditor creado: ${cedula}`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Ya existe un usuario con esa cédula." });
    }
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/administrador & POST /api/admin/admin
// ──────────────────────────────────────────────
const handleCreateAdmin = async (req, res, next) => {
  try {
    const { rol_id, nombre, apellidos, cedula, password, correo_institucional } = req.body;

    if (!nombre || !apellidos || !cedula || !password) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios." });
    }

    if (!/^\d+$/.test(String(cedula).trim())) {
      return res.status(400).json({ success: false, message: "La cédula solo debe contener números." });
    }

    const effectiveRolId = rol_id || 2;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await queryDB(
      `INSERT INTO administrador (rol_id, nombre, apellidos, cedula, password, correo_institucional) VALUES (?, ?, ?, ?, ?, ?)`,
      [effectiveRolId, nombre, apellidos, cedula, hashedPassword, correo_institucional || null]
    );

    console.log(`✅ Administrador creado: ${cedula}`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Ya existe un usuario con esa cédula." });
    }
    next(err);
  }
};

router.post("/administrador", handleCreateAdmin);
router.post("/admin", handleCreateAdmin);

// ──────────────────────────────────────────────
// POST /api/admin/superadmin (Solo SUPERADMIN)
// ──────────────────────────────────────────────
router.post("/superadmin", requireRole("superadmin"), async (req, res, next) => {
  try {
    const { rol_id, nombre, apellido, apellidos, cedula, password, correo_institucional } = req.body;
    const effectiveApellido = apellidos || apellido;

    if (!nombre || !effectiveApellido || !cedula || !password) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios (cédula, nombre, apellidos, contraseña)." });
    }

    if (!/^\d+$/.test(String(cedula).trim())) {
      return res.status(400).json({ success: false, message: "La cédula solo debe contener números." });
    }

    const effectiveRolId = rol_id || 1;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await queryDB(
      `INSERT INTO superadmin (rol_id, nombre, apellidos, cedula, correo_institucional, password) VALUES (?, ?, ?, ?, ?, ?)`,
      [effectiveRolId, nombre, effectiveApellido, cedula, correo_institucional || null, hashedPassword]
    );

    console.log(`✅ Superadmin creado: ${cedula}`);
    res.status(201).json({ success: true, id: result.insertId, message: `Superadmin "${nombre} ${effectiveApellido}" creado con éxito.` });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Ya existe un usuario con esa cédula." });
    }
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/estudiante
// ──────────────────────────────────────────────
router.post("/estudiante", async (req, res, next) => {
  try {
    const { rol_id, cedula, password, nombre, apellidos, correo_institucional, programa_id, codigo } = req.body;

    if (!rol_id || !cedula || !password || !nombre || !apellidos || !programa_id) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios." });
    }

    if (!/^\d+$/.test(String(cedula).trim())) {
      return res.status(400).json({ success: false, message: "La cédula solo debe contener números." });
    }

    if (codigo && !/^\d+$/.test(String(codigo).trim())) {
      return res.status(400).json({ success: false, message: "El código estudiantil solo debe contener números." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await queryDB(
      `INSERT INTO estudiante (rol_id, cedula, codigo, password, nombre, apellidos, correo_institucional, programa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rol_id, cedula, codigo ? String(codigo).trim() : null, hashedPassword, nombre, apellidos, correo_institucional || null, programa_id]
    );

    console.log(`✅ Estudiante creado: ${cedula} (Código: ${codigo || "Sin código"})`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Ya existe un usuario con esa cédula o código." });
    }
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/programa
// ──────────────────────────────────────────────
router.post(["/programa", "/programas"], async (req, res, next) => {
  try {
    const { nombreprograma } = req.body;
    if (!nombreprograma) {
      return res.status(400).json({ success: false, message: "El campo 'nombreprograma' es obligatorio." });
    }

    const result = await queryDB(
      `INSERT INTO programa (nombreprograma) VALUES (?)`,
      [nombreprograma]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/asignatura
// ──────────────────────────────────────────────
router.post(["/asignatura", "/asignaturas"], async (req, res, next) => {
  try {
    const { codigoasignatura, nombreasignatura, programa_id } = req.body;
    if (!codigoasignatura || !nombreasignatura || !programa_id) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios." });
    }

    const result = await queryDB(
      `INSERT INTO asignatura (codigoasignatura, nombreasignatura, programa_id) VALUES (?, ?, ?)`,
      [codigoasignatura, nombreasignatura, programa_id]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/institucion
// ──────────────────────────────────────────────
router.post(["/institucion", "/instituciones"], async (req, res, next) => {
  try {
    const { nombreinstitucion } = req.body;
    if (!nombreinstitucion) {
      return res.status(400).json({ success: false, message: "El campo 'nombreinstitucion' es obligatorio." });
    }

    const result = await queryDB(
      `INSERT INTO institucion (nombreinstitucion) VALUES (?)`,
      [nombreinstitucion]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/servicio
// ──────────────────────────────────────────────
router.post(["/servicio", "/servicios"], async (req, res, next) => {
  try {
    const { nombreservicio, institucion_id } = req.body;
    if (!nombreservicio || !institucion_id) {
      return res.status(400).json({
        success: false,
        message: "El nombre del servicio y la institución son obligatorios.",
      });
    }

    const result = await queryDB(
      `INSERT INTO servicio (nombreservicio, institucion_id) VALUES (?, ?)`,
      [nombreservicio, institucion_id]
    );
    console.log(`✅ Servicio creado: ${nombreservicio} (ID: ${result.insertId})`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/admin/bulk-import
// Carga masiva mediante CSV para usuarios, programas, asignaturas, instituciones y servicios
// ──────────────────────────────────────────────
router.post("/bulk-import", verifyToken, requireRole("admin", "superadmin"), async (req, res, next) => {
  try {
    const { entityType, role: defaultRole, records } = req.body;

    if (!entityType || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Debe proporcionar el tipo de entidad ('entityType') y una lista de registros ('records').",
      });
    }

    if (defaultRole === "superadmin" && req.user?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado: solo un superadministrador puede crear o importar cuentas de superadministrador.",
      });
    }

    let defaultPasswordHash = null;
    const getDefaultHash = async () => {
      if (!defaultPasswordHash) {
        defaultPasswordHash = await bcrypt.hash("123456", 10);
      }
      return defaultPasswordHash;
    };

    // Pre-cargar catálogos para mapear nombres de programas e instituciones
    let programas = [];
    let instituciones = [];
    if (["user", "asignatura"].includes(entityType)) {
      programas = await queryDB("SELECT id, nombreprograma FROM programa");
    }
    if (["user", "servicio"].includes(entityType)) {
      instituciones = await queryDB("SELECT id, nombreinstitucion FROM institucion");
    }

    const findProgramaId = (val) => {
      if (val === undefined || val === null || String(val).trim() === "") return null;
      if (!isNaN(val) && programas.some((p) => Number(p.id) === Number(val))) {
        return Number(val);
      }
      const cleanVal = String(val).trim().toLowerCase();
      const found = programas.find(
        (p) => p.nombreprograma && p.nombreprograma.trim().toLowerCase() === cleanVal
      );
      return found ? found.id : null;
    };

    const findInstitucionId = (val) => {
      if (val === undefined || val === null || String(val).trim() === "") return null;
      if (!isNaN(val) && instituciones.some((i) => Number(i.id) === Number(val))) {
        return Number(val);
      }
      const cleanVal = String(val).trim().toLowerCase();
      const found = instituciones.find(
        (i) => i.nombreinstitucion && i.nombreinstitucion.trim().toLowerCase() === cleanVal
      );
      return found ? found.id : null;
    };

    const parseDelimitedString = (str) => {
      if (!str) return [];
      const result = [];
      let current = "";
      let inQuotes = false;
      const delimiter = str.includes(";") ? ";" : ",";

      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '"') {
          if (inQuotes && str[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result.map((s) => s.replace(/^"|"$/g, "").trim());
    };

    let importedCount = 0;
    const errors = [];

    for (let index = 0; index < records.length; index++) {
      let rec = { ...records[index] };
      const rowNumber = index + 1;

      try {
        if (entityType === "user") {
          // Si Excel agrupó toda la fila en el primer campo (cedula)
          let rawCedula = String(rec.cedula || rec.Cédula || rec.Cedula || "").trim();
          if ((rawCedula.includes(",") || rawCedula.includes(";")) && !rec.nombre && !rec.Nombre) {
            const parts = parseDelimitedString(rawCedula);
            if (parts.length >= 3) {
              rec.cedula = parts[0];
              rec.nombre = parts[1];
              rec.apellidos = parts[2];
              if (parts[3]) rec.correo_institucional = parts[3];
              if (parts[4]) rec.password = parts[4];
              if (parts[5]) {
                rec.programa = parts[5];
                rec.institucion = parts[5];
              }
            }
          }

          // Determinar rol por fila o por parámetro global
          let rawRole = (rec.rol || rec.role || rec.Rol || defaultRole || "").trim().toLowerCase();
          if (["admin", "administrador"].includes(rawRole)) rawRole = "admin";
          else if (["superadmin", "superradmin", "superrradmin", "super admin"].includes(rawRole)) rawRole = "superadmin";
          else if (["docent", "docente", "profesor"].includes(rawRole)) rawRole = "docente";
          else if (["student", "estudiante", "alumno"].includes(rawRole)) rawRole = "estudiante";
          else if (["auditor"].includes(rawRole)) rawRole = "auditor";

          if (!["admin", "superadmin", "auditor", "docente", "estudiante"].includes(rawRole)) {
            throw new Error(`Rol no válido o no especificado: '${rawRole}'`);
          }

          if (rawRole === "superadmin" && req.user?.role !== "superadmin") {
            throw new Error("Acceso denegado: solo un superadministrador puede crear o importar cuentas de superadministrador.");
          }

          const cedula = String(rec.cedula || rec.Cédula || rec.Cedula || "").trim();
          const nombre = String(rec.nombre || rec.Nombre || "").trim();
          const apellidos = String(rec.apellidos || rec.Apellidos || rec.apellido || rec.Apellido || "").trim();
          const correo = String(rec.correo_institucional || rec.correo || rec.email || rec.Email || "").trim();
          const plainPassword = String(rec.password || rec.contrasena || rec.Contraseña || "").trim();

          if (!cedula || !nombre || !apellidos) {
            throw new Error("Cédula, nombre y apellidos son campos obligatorios.");
          }

          const passwordHash = plainPassword ? await bcrypt.hash(plainPassword, 10) : await getDefaultHash();
          const rolId = rawRole === "superadmin" ? 1 : rawRole === "admin" ? 2 : rawRole === "auditor" ? 3 : rawRole === "docente" ? 4 : 5;

          if (rawRole === "docente") {
            const progVal = rec.programa_id || rec.programa || rec.Programa || rec.carrera || rec.Carrera;
            const progId = findProgramaId(progVal);
            if (!progId) {
              throw new Error(`Programa académico no encontrado: '${progVal || "vacío"}'`);
            }
            await queryDB(
              `INSERT INTO docente (rol_id, cedula, password, nombre, apellidos, correo_institucional, programa_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [rolId, cedula, passwordHash, nombre, apellidos, correo || null, progId]
            );
          } else if (rawRole === "estudiante") {
            const progVal = rec.programa_id || rec.programa || rec.Programa || rec.carrera || rec.Carrera;
            const progId = findProgramaId(progVal);
            if (!progId) {
              throw new Error(`Programa académico no encontrado: '${progVal || "vacío"}'`);
            }
            const codigo = String(rec.codigo || rec.Codigo || rec.código || rec.Código || "").trim() || null;
            await queryDB(
              `INSERT INTO estudiante (rol_id, cedula, codigo, password, nombre, apellidos, correo_institucional, programa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [rolId, cedula, codigo, passwordHash, nombre, apellidos, correo || null, progId]
            );
          } else if (rawRole === "auditor") {
            const instVal = rec.institucion_id || rec.institucion || rec.Institucion;
            const instId = findInstitucionId(instVal);
            if (!instId) {
              throw new Error(`Institución no encontrada: '${instVal || "vacía"}'`);
            }
            await queryDB(
              `INSERT INTO auditor (rol_id, cedula, password, nombre, apellidos, correo_institucional, institucion_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [rolId, cedula, passwordHash, nombre, apellidos, correo || null, instId]
            );
          } else if (rawRole === "admin") {
            await queryDB(
              `INSERT INTO administrador (rol_id, nombre, apellidos, cedula, password, correo_institucional) VALUES (?, ?, ?, ?, ?, ?)`,
              [2, nombre, apellidos, cedula, passwordHash, correo || null]
            );
          } else if (rawRole === "superadmin") {
            await queryDB(
              `INSERT INTO superadmin (rol_id, nombre, apellidos, cedula, correo_institucional, password) VALUES (?, ?, ?, ?, ?, ?)`,
              [1, nombre, apellidos, cedula, correo || null, passwordHash]
            );
          }

          importedCount++;
        } else if (entityType === "programa") {
          const nombreprograma = String(rec.nombreprograma || rec.nombre || rec.Nombre || rec.Programa || "").trim();
          if (!nombreprograma) {
            throw new Error("El nombre del programa es obligatorio.");
          }
          await queryDB(`INSERT INTO programa (nombreprograma) VALUES (?)`, [nombreprograma]);
          importedCount++;
        } else if (entityType === "asignatura") {
          const codigo = String(rec.codigoasignatura || rec.codigo || rec.Codigo || "").trim();
          const nombre = String(rec.nombreasignatura || rec.nombre || rec.Nombre || "").trim();
          const progVal = rec.programa_id || rec.programa || rec.Programa;
          const progId = findProgramaId(progVal);

          if (!codigo || !nombre || !progId) {
            throw new Error(`Código, Nombre y Programa válido son obligatorios. (Programa: '${progVal || "vacío"}')`);
          }
          await queryDB(
            `INSERT INTO asignatura (codigoasignatura, nombreasignatura, programa_id) VALUES (?, ?, ?)`,
            [codigo, nombre, progId]
          );
          importedCount++;
        } else if (entityType === "institucion") {
          const nombre = String(rec.nombreinstitucion || rec.nombre || rec.Nombre || rec.Institucion || "").trim();
          if (!nombre) {
            throw new Error("El nombre de la institución es obligatorio.");
          }
          await queryDB(`INSERT INTO institucion (nombreinstitucion) VALUES (?)`, [nombre]);
          importedCount++;
        } else if (entityType === "servicio") {
          const nombre = String(rec.nombreservicio || rec.nombre || rec.Nombre || rec.Servicio || "").trim();
          const instVal = rec.institucion_id || rec.institucion || rec.Institucion;
          const instId = findInstitucionId(instVal);

          if (!nombre || !instId) {
            throw new Error(`Nombre del servicio e Institución válida son obligatorios. (Institución: '${instVal || "vacía"}')`);
          }
          await queryDB(`INSERT INTO servicio (nombreservicio, institucion_id) VALUES (?, ?)`, [nombre, instId]);
          importedCount++;
        } else {
          throw new Error(`Tipo de entidad desconocido: '${entityType}'`);
        }
      } catch (err) {
        let errorMsg = err.message || "Error desconocido";
        if (err.code === "ER_DUP_ENTRY") {
          errorMsg = `Registro ya existente o duplicado en la base de datos (${rec.cedula || rec.codigoasignatura || rec.nombre || "clave duplicada"}).`;
        }
        errors.push({
          row: rowNumber,
          identifier: rec.cedula || rec.codigoasignatura || rec.nombreprograma || rec.nombre || `Fila ${rowNumber}`,
          message: errorMsg,
        });
      }
    }

    console.log(`📊 Importación masiva completada: ${importedCount} creados, ${errors.length} con error.`);

    res.status(200).json({
      success: true,
      importedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/admin/programas/:id
// ──────────────────────────────────────────────
router.delete(["/programas/:id", "/programa/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;

    const prog = await queryDB(`SELECT nombreprograma FROM programa WHERE id = ?`, [id]);
    if (prog.length === 0) {
      return res.status(404).json({ success: false, message: "Programa no encontrado." });
    }
    const nombreProg = prog[0].nombreprograma;

    // Verificar si tiene dependencias
    const [est] = await queryDB(`SELECT COUNT(*) AS total FROM estudiante WHERE programa_id = ?`, [id]);
    const [doc] = await queryDB(`SELECT COUNT(*) AS total FROM docente WHERE programa_id = ?`, [id]);
    const [asig] = await queryDB(`SELECT COUNT(*) AS total FROM asignatura WHERE programa_id = ?`, [id]);

    const totalEst = est?.total || 0;
    const totalDoc = doc?.total || 0;
    const totalAsig = asig?.total || 0;

    if (totalEst > 0 || totalDoc > 0 || totalAsig > 0) {
      const items = [];
      if (totalEst > 0) items.push(`${totalEst} estudiante(s)`);
      if (totalDoc > 0) items.push(`${totalDoc} docente(s)`);
      if (totalAsig > 0) items.push(`${totalAsig} asignatura(s)`);

      return res.status(409).json({
        success: false,
        hasDependencies: true,
        entityType: "Programa",
        entityName: nombreProg,
        dependencies: {
          estudiantes: totalEst,
          docentes: totalDoc,
          asignaturas: totalAsig,
        },
        message: `No se puede eliminar el programa "${nombreProg}" porque tiene elementos asociados: ${items.join(", ")}. Debes reasignar o eliminar estos elementos antes de proceder.`,
      });
    }

    await queryDB(`DELETE FROM programa WHERE id = ?`, [id]);
    console.log(`✅ Programa ${id} eliminado de la base de datos.`);
    res.status(200).json({ success: true, message: `Programa "${nombreProg}" eliminado correctamente.` });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        hasDependencies: true,
        entityType: "Programa",
        message: "No se puede eliminar este programa porque tiene registros asociados en la base de datos.",
      });
    }
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/admin/asignaturas/:id
// ──────────────────────────────────────────────
router.delete(["/asignaturas/:id", "/asignatura/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const asig = await queryDB(`SELECT nombreasignatura FROM asignatura WHERE id = ?`, [id]);
    const nombreAsig = asig[0]?.nombreasignatura || "Asignatura";

    try {
      const result = await queryDB(`DELETE FROM asignatura WHERE id = ?`, [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Asignatura no encontrada." });
      }
      console.log(`✅ Asignatura ${id} eliminada.`);
      res.status(200).json({ success: true, message: `Asignatura "${nombreAsig}" eliminada correctamente.` });
    } catch (sqlErr) {
      if (sqlErr.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
          success: false,
          hasDependencies: true,
          entityType: "Asignatura",
          entityName: nombreAsig,
          message: `No se puede eliminar la asignatura "${nombreAsig}" porque está vinculada a prácticas, rotaciones o evaluaciones académicas activas.`,
        });
      }
      throw sqlErr;
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/admin/instituciones/:id
// ──────────────────────────────────────────────
router.delete(["/instituciones/:id", "/institucion/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const inst = await queryDB(`SELECT nombreinstitucion FROM institucion WHERE id = ?`, [id]);
    if (inst.length === 0) {
      return res.status(404).json({ success: false, message: "Institución no encontrada." });
    }
    const nombreInst = inst[0].nombreinstitucion;

    // Verificar si tiene dependencias
    const [serv] = await queryDB(`SELECT COUNT(*) AS total FROM servicio WHERE institucion_id = ?`, [id]);
    const [aud] = await queryDB(`SELECT COUNT(*) AS total FROM auditor WHERE institucion_id = ?`, [id]);

    const totalServ = serv?.total || 0;
    const totalAud = aud?.total || 0;

    if (totalServ > 0 || totalAud > 0) {
      const items = [];
      if (totalServ > 0) items.push(`${totalServ} servicio(s)`);
      if (totalAud > 0) items.push(`${totalAud} auditor(es)`);

      return res.status(409).json({
        success: false,
        hasDependencies: true,
        entityType: "Institución",
        entityName: nombreInst,
        dependencies: {
          servicios: totalServ,
          auditores: totalAud,
        },
        message: `No se puede eliminar la institución "${nombreInst}" porque tiene elementos asociados: ${items.join(", ")}. Debes reasignar o eliminar estos elementos antes de proceder.`,
      });
    }

    await queryDB(`DELETE FROM institucion WHERE id = ?`, [id]);
    console.log(`✅ Institución ${id} eliminada.`);
    res.status(200).json({ success: true, message: `Institución "${nombreInst}" eliminada correctamente.` });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        hasDependencies: true,
        entityType: "Institución",
        message: "No se puede eliminar esta institución porque tiene registros asociados en la base de datos.",
      });
    }
    next(err);
  }
});

// ──────────────────────────────────────────────
// DELETE /api/admin/servicios/:id
// ──────────────────────────────────────────────
router.delete(["/servicios/:id", "/servicio/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const serv = await queryDB(`SELECT nombreservicio FROM servicio WHERE id = ?`, [id]);
    const nombreServ = serv[0]?.nombreservicio || "Servicio";

    try {
      const result = await queryDB(`DELETE FROM servicio WHERE id = ?`, [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Servicio no encontrado." });
      }
      console.log(`✅ Servicio ${id} eliminado.`);
      res.status(200).json({ success: true, message: `Servicio "${nombreServ}" eliminado correctamente.` });
    } catch (sqlErr) {
      if (sqlErr.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
          success: false,
          hasDependencies: true,
          entityType: "Servicio",
          entityName: nombreServ,
          message: `No se puede eliminar el servicio "${nombreServ}" porque está vinculado a prácticas o rotaciones activas.`,
        });
      }
      throw sqlErr;
    }
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// Resolución inequívoca de usuarios por cédula (+ rol opcional)
// ──────────────────────────────────────────────
// IMPORTANTE: Nunca usar `cedula = ? OR id = ?` cruzando tablas: la cédula de un
// usuario puede coincidir con el id autoincremental de otro usuario en otra tabla
// (ej. admin con cédula "4" vs. estudiante con id 4) y se editaría/eliminaría
// a la persona equivocada.
const USER_TABLE_BY_ROLE = {
  student: "estudiante",
  estudiante: "estudiante",
  docent: "docente",
  docente: "docente",
  auditor: "auditor",
  admin: "administrador",
  administrador: "administrador",
  superadmin: "superadmin",
};
const USER_TABLES_LOOKUP_ORDER = ["estudiante", "docente", "auditor", "administrador", "superadmin"];

async function findUserTable(identifier, roleHint) {
  const hinted = USER_TABLE_BY_ROLE[String(roleHint || "").trim().toLowerCase()];

  // Con rol conocido: buscar SOLO en esa tabla (por cédula y, como respaldo, por id).
  if (hinted) {
    const byCedula = await queryDB(`SELECT id, cedula FROM ${hinted} WHERE cedula = ? LIMIT 1`, [identifier]);
    if (byCedula.length > 0) return { table: hinted, id: byCedula[0].id, cedula: byCedula[0].cedula };
    const byId = await queryDB(`SELECT id, cedula FROM ${hinted} WHERE id = ? LIMIT 1`, [identifier]);
    if (byId.length > 0) return { table: hinted, id: byId[0].id, cedula: byId[0].cedula };
    return null;
  }

  // Sin rol: buscar únicamente por cédula en todas las tablas.
  for (const table of USER_TABLES_LOOKUP_ORDER) {
    const rows = await queryDB(`SELECT id, cedula FROM ${table} WHERE cedula = ? LIMIT 1`, [identifier]);
    if (rows.length > 0) return { table, id: rows[0].id, cedula: rows[0].cedula };
  }
  return null;
}

// ──────────────────────────────────────────────
// DELETE /api/admin/users/:id
// ──────────────────────────────────────────────
router.delete(["/users/:id", "/user/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    let deleted = false;
    let userName = `Usuario #${id}`;

    const target = await findUserTable(id, req.query.rol);
    const matchedRoles = target ? ROLE_TABLES_MAP.filter((r) => r.tableName === target.table) : [];

    for (const role of matchedRoles) {
      const apellCol = role.apellidoCol || "apellidos";
      const nameCol = role.nameCol || "nombre";
      const found = await queryDB(
        `SELECT id, cedula, ${nameCol} AS nombre, ${apellCol} AS apellidos FROM ${role.tableName} WHERE id = ?`,
        [target.id]
      );
      if (found.length > 0) {
        const userRow = found[0];
        const userCedula = userRow.cedula;
        const userId = userRow.id;
        userName = `${userRow.nombre || ""} ${userRow.apellidos || ""}`.trim() || `Usuario #${userCedula || userId}`;

        if (role.roleName === "superadmin" && req.user?.role !== "superadmin") {
          return res.status(403).json({
            success: false,
            message: "Solo un superadministrador puede eliminar cuentas con rol superadministrador.",
          });
        }

        try {
          if (role.dataTable && role.dataCedulaCol) {
            await queryDB(`DELETE FROM ${role.dataTable} WHERE ${role.dataCedulaCol} = ?`, [userCedula]);
          }
          const resDel = await queryDB(
            `DELETE FROM ${role.tableName} WHERE id = ?`,
            [userId]
          );
          if (resDel.affectedRows > 0) {
            deleted = true;
            break;
          }
        } catch (sqlErr) {
          console.error(`❌ Error SQL al eliminar usuario ${userName}:`, sqlErr);
          if (sqlErr.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
              success: false,
              hasDependencies: true,
              entityType: "Usuario",
              entityName: userName,
              message: `No se puede eliminar al usuario "${userName}" porque cuenta con registros asociados en el sistema (prácticas, evaluaciones, bitácoras o certificaciones).`,
            });
          }
          throw sqlErr;
        }
      }
    }

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    console.log(`✅ Usuario ${userName} (${id}) eliminado.`);
    res.status(200).json({ success: true, message: `Usuario "${userName}" eliminado correctamente.` });
  } catch (err) {
    next(err);
  }
});
// ──────────────────────────────────────────────
// GET /api/admin/users/:cedula — Obtener detalle completo de un usuario
// ──────────────────────────────────────────────
router.get("/users/:cedula", async (req, res, next) => {
  try {
    const target = await findUserTable(req.params.cedula, req.query.rol);
    if (!target) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    const { table, id } = target;

    // 1. Estudiante
    if (table === "estudiante") {
      const est = await queryDB(
        `SELECT e.cedula, e.codigo, e.nombre, e.apellidos, e.correo_institucional, e.programa_id,
                de.biografia, de.direccion, de.telefono, de.correo_personal, de.nombre_familiar, de.telefono_familiar
         FROM estudiante e
         LEFT JOIN datos_estudiante de ON e.cedula = de.cedula_estudiante
         WHERE e.id = ?`,
        [id]
      );
      return res.status(200).json({ success: true, role: "estudiante", user: { ...est[0], Rol: "student" } });
    }

    // 2. Docente
    if (table === "docente") {
      const doc = await queryDB(
        `SELECT cedula, nombre, apellidos, correo_institucional, programa_id FROM docente WHERE id = ?`,
        [id]
      );
      return res.status(200).json({ success: true, role: "docente", user: { ...doc[0], Rol: "docent" } });
    }

    // 3. Auditor
    if (table === "auditor") {
      const aud = await queryDB(
        `SELECT cedula, nombre, apellidos, correo_institucional, institucion_id FROM auditor WHERE id = ?`,
        [id]
      );
      return res.status(200).json({ success: true, role: "auditor", user: { ...aud[0], Rol: "auditor" } });
    }

    // 4. Administrador
    if (table === "administrador") {
      const adm = await queryDB(
        `SELECT cedula, nombre, apellidos, correo_institucional FROM administrador WHERE id = ?`,
        [id]
      );
      return res.status(200).json({ success: true, role: "admin", user: { ...adm[0], Rol: "admin" } });
    }

    // 5. Superadmin
    const sa = await queryDB(
      `SELECT cedula, nombre, apellidos, correo_institucional FROM superadmin WHERE id = ?`,
      [id]
    );
    return res.status(200).json({ success: true, role: "superadmin", user: { ...sa[0], Rol: "superadmin" } });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/admin/users/:cedula — Actualizar datos completos del usuario
// ──────────────────────────────────────────────
router.put("/users/:cedula", async (req, res, next) => {
  try {
    const { cedula } = req.params;
    const {
      nombre,
      apellidos,
      correo_institucional,
      programa_id,
      institucion_id,
      biografia,
      codigo,
      direccion,
      telefono,
      correo_personal,
      nombre_familiar,
      telefono_familiar,
    } = req.body;

    if (codigo && !/^\d+$/.test(String(codigo).trim())) {
      return res.status(400).json({ success: false, message: "El código estudiantil solo debe contener números." });
    }

    const target = await findUserTable(cedula, req.body?.rol);
    if (!target) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado para actualización." });
    }

    // Actualizar estudiante
    if (target.table === "estudiante") {
      const targetCedula = target.cedula;
      await queryDB(
        `UPDATE estudiante SET nombre = ?, apellidos = ?, codigo = ?, correo_institucional = ?, programa_id = ? WHERE cedula = ?`,
        [nombre, apellidos, codigo ? String(codigo).trim() : null, correo_institucional || null, programa_id || null, targetCedula]
      );
      // Actualizar o insertar en datos_estudiante (sin columna codigo)
      await queryDB(
        `INSERT INTO datos_estudiante (cedula_estudiante, biografia, direccion, telefono, correo_personal, nombre_familiar, telefono_familiar)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           biografia = VALUES(biografia),
           direccion = VALUES(direccion),
           telefono = VALUES(telefono),
           correo_personal = VALUES(correo_personal),
           nombre_familiar = VALUES(nombre_familiar),
           telefono_familiar = VALUES(telefono_familiar)`,
        [targetCedula, biografia || null, direccion || null, telefono || null, correo_personal || null, nombre_familiar || null, telefono_familiar || null]
      ).catch((e) => console.log("Nota al guardar datos_estudiante:", e.message));

      console.log(`✅ Estudiante ${targetCedula} actualizado.`);
      return res.status(200).json({ success: true, message: "Usuario actualizado exitosamente." });
    }

    // Actualizar docente
    if (target.table === "docente") {
      const targetCedula = target.cedula;
      await queryDB(
        `UPDATE docente SET nombre = ?, apellidos = ?, correo_institucional = ?, programa_id = ? WHERE cedula = ?`,
        [nombre, apellidos, correo_institucional || null, programa_id || null, targetCedula]
      );
      console.log(`✅ Docente ${targetCedula} actualizado.`);
      return res.status(200).json({ success: true, message: "Usuario actualizado exitosamente." });
    }

    // Actualizar auditor
    if (target.table === "auditor") {
      const targetCedula = target.cedula;
      await queryDB(
        `UPDATE auditor SET nombre = ?, apellidos = ?, correo_institucional = ?, institucion_id = ? WHERE cedula = ?`,
        [nombre, apellidos, correo_institucional || null, institucion_id || null, targetCedula]
      );
      console.log(`✅ Auditor ${targetCedula} actualizado.`);
      return res.status(200).json({ success: true, message: "Usuario actualizado exitosamente." });
    }

    // Actualizar administrador
    if (target.table === "administrador") {
      const targetCedula = target.cedula;
      await queryDB(
        `UPDATE administrador SET nombre = ?, apellidos = ?, correo_institucional = ? WHERE cedula = ?`,
        [nombre, apellidos, correo_institucional || null, targetCedula]
      );
      console.log(`✅ Administrador ${targetCedula} actualizado.`);
      return res.status(200).json({ success: true, message: "Usuario actualizado exitosamente." });
    }

    // Actualizar superadmin
    if (target.table === "superadmin") {
      if (req.user?.role !== "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Solo un superadministrador puede modificar cuentas con rol superadministrador.",
        });
      }
      const targetCedula = target.cedula;
      await queryDB(
        `UPDATE superadmin SET nombre = ?, apellidos = ?, correo_institucional = ? WHERE cedula = ?`,
        [nombre, apellidos || nombre, correo_institucional || null, targetCedula]
      );
      console.log(`✅ Superadmin ${targetCedula} actualizado.`);
      return res.status(200).json({ success: true, message: "Usuario actualizado exitosamente." });
    }

    return res.status(404).json({ success: false, message: "Usuario no encontrado para actualización." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/admin/programas/:id
// ──────────────────────────────────────────────
router.put(["/programas/:id", "/programa/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombreprograma } = req.body;
    if (!nombreprograma) {
      return res.status(400).json({ success: false, message: "Nombre del programa es obligatorio." });
    }
    const result = await queryDB(`UPDATE programa SET nombreprograma = ? WHERE id = ?`, [nombreprograma, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Programa no encontrado." });
    }
    res.status(200).json({ success: true, message: "Programa actualizado con éxito." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/admin/asignaturas/:id
// ──────────────────────────────────────────────
router.put(["/asignaturas/:id", "/asignatura/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { codigoasignatura, nombreasignatura, programa_id } = req.body;
    const result = await queryDB(
      `UPDATE asignatura SET codigoasignatura = ?, nombreasignatura = ?, programa_id = ? WHERE id = ?`,
      [codigoasignatura, nombreasignatura, programa_id || null, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Asignatura no encontrada." });
    }
    res.status(200).json({ success: true, message: "Asignatura actualizada con éxito." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/admin/instituciones/:id
// ──────────────────────────────────────────────
router.put(["/instituciones/:id", "/institucion/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombreinstitucion } = req.body;
    if (!nombreinstitucion) {
      return res.status(400).json({ success: false, message: "Nombre de la institución es obligatorio." });
    }
    const result = await queryDB(`UPDATE institucion SET nombreinstitucion = ? WHERE id = ?`, [nombreinstitucion, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Institución no encontrada." });
    }
    res.status(200).json({ success: true, message: "Institución actualizada con éxito." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// PUT /api/admin/servicios/:id
// ──────────────────────────────────────────────
router.put(["/servicios/:id", "/servicio/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombreservicio, institucion_id } = req.body;
    const result = await queryDB(
      `UPDATE servicio SET nombreservicio = ?, institucion_id = ? WHERE id = ?`,
      [nombreservicio, institucion_id || null, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Servicio no encontrado." });
    }
    res.status(200).json({ success: true, message: "Servicio actualizado con éxito." });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GESTIÓN DE PRÁCTICAS FORMATIVAS (CRUD + COUNT)
// ──────────────────────────────────────────────

// GET /api/admin/practices/count
router.get("/practices/count", async (req, res, next) => {
  try {
    const rows = await queryDB(`SELECT COUNT(*) AS total_practices FROM practica`);
    const total = rows[0]?.total_practices || 0;
    res.status(200).json({ total_practices: total });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/reports/summary
router.get("/reports/summary", async (req, res, next) => {
  try {
    const [repRows, certRows, asigRows] = await Promise.all([
      queryDB("SELECT COUNT(*) AS cnt FROM reporte_auditor").catch(() => [{ cnt: 0 }]),
      queryDB("SELECT COUNT(*) AS cnt FROM solicitud_certificado").catch(() => [{ cnt: 0 }]),
      queryDB("SELECT COUNT(*) AS cnt FROM asistencia_estudiante").catch(() => [{ cnt: 0 }]),
    ]);

    const totalInformes = Number(repRows[0]?.cnt || 0);
    const totalCertificados = Number(certRows[0]?.cnt || 0);
    const totalAsistencias = Number(asigRows[0]?.cnt || 0);
    const totalEmitidos = totalInformes + totalCertificados;

    res.status(200).json({
      success: true,
      total_informes: totalInformes,
      total_certificados: totalCertificados,
      total_asistencias: totalAsistencias,
      total_emitidos: totalEmitidos,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/practices
router.get("/practices", async (req, res, next) => {
  try {
    // Sincronizar automáticamente el ciclo de vida de las prácticas por fechas (hora Colombia UTC-5):
    const todayStr = getColombiaToday();

    // 1. Si llegó o pasó la fecha final -> 'Finalizada'
    await queryDB(`
      UPDATE practica 
      SET estado = 'Finalizada' 
      WHERE estado != 'Cancelada' 
        AND estado != 'Finalizada' 
        AND fecha_fin IS NOT NULL 
        AND ? >= fecha_fin
    `, [todayStr]);

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
        pr.creado_por_rol,
        pr.creado_por_cedula,
        pr.creador_nombre
      FROM practica pr
      LEFT JOIN programa p ON pr.programa_id = p.id
      LEFT JOIN asignatura a ON pr.asignatura_id = a.id
      LEFT JOIN institucion i ON pr.institucion_id = i.id
      LEFT JOIN servicio s ON pr.servicio_id = s.id
      LEFT JOIN docente d ON pr.docente_cedula = d.cedula
      LEFT JOIN auditor au ON pr.auditor_cedula = au.cedula
      ORDER BY pr.id DESC
    `);

    const practiceIds = rows.map((r) => r.id);
    let studentsMap = {};

    if (practiceIds.length > 0) {
      const placeholders = practiceIds.map(() => "?").join(",");
      const studentsRows = await queryDB(`
        SELECT 
          pe.practica_id,
          pe.estudiante_cedula,
          pe.estado AS estado_asignacion,
          pe.calificacion,
          pe.estado_evaluacion,
          pe.fecha_evaluacion,
          pe.retroalimentacion,
          pe.horas_cumplidas,
          pe.horas_asignadas,
          e.nombre,
          e.apellidos,
          e.correo_institucional,
          prog.nombreprograma AS carrera
        FROM practica_estudiante pe
        LEFT JOIN estudiante e ON pe.estudiante_cedula = e.cedula
        LEFT JOIN programa prog ON e.programa_id = prog.id
        WHERE pe.practica_id IN (${placeholders})
        ORDER BY e.apellidos ASC, e.nombre ASC
      `, practiceIds);

      studentsRows.forEach((st) => {
        if (!studentsMap[st.practica_id]) {
          studentsMap[st.practica_id] = [];
        }
        studentsMap[st.practica_id].push({
          cedula: String(st.estudiante_cedula),
          nombre_completo: `${st.nombre || ""} ${st.apellidos || ""}`.trim() || `Estudiante #${st.estudiante_cedula}`,
          correo: st.correo_institucional,
          carrera: st.carrera || "Medicina",
          estado: st.estado_asignacion,
          calificacion: st.calificacion !== null && st.calificacion !== undefined ? Number(st.calificacion) : null,
          estado_evaluacion: st.estado_evaluacion || (st.calificacion !== null ? "Completada" : "Pendiente"),
          fecha_evaluacion: st.fecha_evaluacion,
          retroalimentacion: st.retroalimentacion || null,
          horas_cumplidas: Number(st.horas_cumplidas || 0),
          horas_asignadas: st.horas_asignadas !== null && st.horas_asignadas !== undefined ? Number(st.horas_asignadas) : null,
        });
      });
    }

    const result = rows.map((r) => ({
      ...r,
      estudiantes: studentsMap[r.id] || [],
      total_estudiantes: (studentsMap[r.id] || []).length,
    }));

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/practices/:practiceId/students/:cedula/hours
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
      return res.status(404).json({ success: false, message: "No se encontró el estudiante asignado a esta práctica." });
    }

    console.log(`✅ Horas actualizadas para estudiante ${cedula} en práctica #${practiceId}: cumplidas=${horas_cumplidas}, asignadas=${horas_asignadas}`);
    res.status(200).json({
      success: true,
      message: "Horas actualizadas correctamente.",
      practica_id: practiceId,
      estudiante_cedula: cedula,
      horas_cumplidas: horas_cumplidas !== undefined ? Number(horas_cumplidas) : undefined,
      horas_asignadas: horas_asignadas !== undefined ? Number(horas_asignadas) : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/practices
router.post(["/practices", "/practice"], async (req, res, next) => {
  try {
    const {
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
      estudiantes,
    } = req.body;

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ success: false, message: "El título de la práctica es obligatorio." });
    }

    if (!programa_id) {
      return res.status(400).json({ success: false, message: "El programa académico es obligatorio para crear la práctica." });
    }

    // Validar que la asignatura pertenezca al programa (si se especifica)
    if (programa_id && asignatura_id) {
      const asigCheck = await queryDB(
        `SELECT id, programa_id FROM asignatura WHERE id = ? LIMIT 1`,
        [asignatura_id]
      );
      if (asigCheck.length > 0 && asigCheck[0].programa_id && Number(asigCheck[0].programa_id) !== Number(programa_id)) {
        return res.status(400).json({
          success: false,
          message: "La asignatura seleccionada no pertenece al programa académico seleccionado.",
        });
      }
    }

    // Validar que el docente pertenezca al programa (si se especifica)
    if (programa_id && docente_cedula) {
      const docCheck = await queryDB(
        `SELECT cedula, programa_id FROM docente WHERE cedula = ? LIMIT 1`,
        [docente_cedula]
      );
      if (docCheck.length > 0 && docCheck[0].programa_id && Number(docCheck[0].programa_id) !== Number(programa_id)) {
        return res.status(400).json({
          success: false,
          message: "El docente seleccionado no pertenece al programa académico seleccionado.",
        });
      }
    }

    // Validar que todos los estudiantes pertenezcan al programa
    if (programa_id && Array.isArray(estudiantes) && estudiantes.length > 0) {
      const cedulas = estudiantes
        .map((item) => (typeof item === "object" ? item.cedula || item.estudiante_cedula : item))
        .filter(Boolean);
      if (cedulas.length > 0) {
        const ph = cedulas.map(() => "?").join(",");
        const invalidStudents = await queryDB(
          `SELECT e.cedula, e.nombre, e.apellidos, e.programa_id, p.nombreprograma
           FROM estudiante e
           LEFT JOIN programa p ON e.programa_id = p.id
           WHERE e.cedula IN (${ph}) AND (e.programa_id IS NULL OR e.programa_id != ?)`,
          [...cedulas, programa_id]
        );
        if (invalidStudents.length > 0) {
          const names = invalidStudents.map((s) => `${s.nombre} ${s.apellidos} (${s.cedula})`).join(", ");
          return res.status(400).json({
            success: false,
            message: `Los siguientes estudiantes no pertenecen al programa seleccionado: ${names}`,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)
    `, [
      titulo.trim(),
      programa_id || null,
      asignatura_id || null,
      institucion_id || null,
      servicio_id || null,
      docente_cedula || null,
      auditor_cedula || null,
      periodo || '2024-1',
      fecha_inicio || null,
      fecha_fin || null,
      horas_totales ? parseInt(horas_totales, 10) : 120,
      cupos ? parseInt(cupos, 10) : 10,
      finalEstado,
      descripcion || null,
      req.user?.cedula || null,
      req.user?.name || req.user?.nombre ? `${req.user.name || req.user.nombre} (Admin)` : 'Administrador UPTC'
    ]);

    const practicaId = insertResult.insertId;

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

    console.log(`✅ Práctica #${practicaId} "${titulo}" creada con éxito.`);
    res.status(201).json({
      success: true,
      message: `Práctica "${titulo}" creada con éxito.`,
      practica_id: practicaId,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/practices/:id
router.put(["/practices/:id", "/practice/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
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
      estudiantes,
    } = req.body;

    const existing = await queryDB(`SELECT id, programa_id FROM practica WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Práctica no encontrada." });
    }

    const effectiveProgramaId = programa_id || existing[0].programa_id;

    // Validar que la asignatura pertenezca al programa (si se especifica)
    if (effectiveProgramaId && asignatura_id) {
      const asigCheck = await queryDB(
        `SELECT id, programa_id FROM asignatura WHERE id = ? LIMIT 1`,
        [asignatura_id]
      );
      if (asigCheck.length > 0 && asigCheck[0].programa_id && Number(asigCheck[0].programa_id) !== Number(effectiveProgramaId)) {
        return res.status(400).json({
          success: false,
          message: "La asignatura seleccionada no pertenece al programa académico de la práctica.",
        });
      }
    }

    // Validar que el docente pertenezca al programa (si se especifica)
    if (effectiveProgramaId && docente_cedula) {
      const docCheck = await queryDB(
        `SELECT cedula, programa_id FROM docente WHERE cedula = ? LIMIT 1`,
        [docente_cedula]
      );
      if (docCheck.length > 0 && docCheck[0].programa_id && Number(docCheck[0].programa_id) !== Number(effectiveProgramaId)) {
        return res.status(400).json({
          success: false,
          message: "El docente seleccionado no pertenece al programa académico de la práctica.",
        });
      }
    }

    // Validar que todos los estudiantes pertenezcan al programa
    if (effectiveProgramaId && Array.isArray(estudiantes) && estudiantes.length > 0) {
      const cedulas = estudiantes
        .map((item) => (typeof item === "object" ? item.cedula || item.estudiante_cedula : item))
        .filter(Boolean);
      if (cedulas.length > 0) {
        const ph = cedulas.map(() => "?").join(",");
        const invalidStudents = await queryDB(
          `SELECT e.cedula, e.nombre, e.apellidos, e.programa_id, p.nombreprograma
           FROM estudiante e
           LEFT JOIN programa p ON e.programa_id = p.id
           WHERE e.cedula IN (${ph}) AND (e.programa_id IS NULL OR e.programa_id != ?)`,
          [...cedulas, effectiveProgramaId]
        );
        if (invalidStudents.length > 0) {
          const names = invalidStudents.map((s) => `${s.nombre} ${s.apellidos} (${s.cedula})`).join(", ");
          return res.status(400).json({
            success: false,
            message: `Los siguientes estudiantes no pertenecen al programa seleccionado: ${names}`,
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

    await queryDB(`
      UPDATE practica SET
        titulo = COALESCE(?, titulo),
        programa_id = ?,
        asignatura_id = ?,
        institucion_id = ?,
        servicio_id = ?,
        docente_cedula = ?,
        auditor_cedula = ?,
        periodo = COALESCE(?, periodo),
        fecha_inicio = ?,
        fecha_fin = ?,
        horas_totales = COALESCE(?, horas_totales),
        cupos = COALESCE(?, cupos),
        estado = COALESCE(?, estado),
        descripcion = ?
      WHERE id = ?
    `, [
      titulo || null,
      programa_id || null,
      asignatura_id || null,
      institucion_id || null,
      servicio_id || null,
      docente_cedula || null,
      auditor_cedula || null,
      periodo || null,
      fecha_inicio || null,
      fecha_fin || null,
      horas_totales ? parseInt(horas_totales, 10) : null,
      cupos ? parseInt(cupos, 10) : null,
      finalEstado || null,
      descripcion || null,
      id,
    ]);

    if (Array.isArray(estudiantes)) {
      await queryDB(`DELETE FROM practica_estudiante WHERE practica_id = ?`, [id]);
      for (const item of estudiantes) {
        const cedula = typeof item === "object" ? item.cedula : item;
        if (cedula) {
          await queryDB(`
            INSERT IGNORE INTO practica_estudiante (practica_id, estudiante_cedula, estado)
            VALUES (?, ?, 'Asignado')
          `, [id, cedula]);
        }
      }
    }

    console.log(`✅ Práctica #${id} actualizada.`);
    res.status(200).json({ success: true, message: "Práctica actualizada con éxito." });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/practices/:id
router.delete(["/practices/:id", "/practice/:id"], async (req, res, next) => {
  try {
    const { id } = req.params;
    const pract = await queryDB(`SELECT titulo FROM practica WHERE id = ?`, [id]);
    if (pract.length === 0) {
      return res.status(404).json({ success: false, message: "Práctica no encontrada." });
    }
    const titulo = pract[0].titulo;

    await queryDB(`DELETE FROM practica_estudiante WHERE practica_id = ?`, [id]);
    await queryDB(`DELETE FROM practica WHERE id = ?`, [id]);

    console.log(`✅ Práctica #${id} "${titulo}" eliminada.`);
    res.status(200).json({ success: true, message: `Práctica "${titulo}" eliminada correctamente.` });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// Configuración Institucional Centralizada (tabla institucion_educativa)
// ──────────────────────────────────────────────
async function initInstitutionTable() {
  try {
    await queryDB(`
      CREATE TABLE IF NOT EXISTS institucion_educativa (
        id INT AUTO_INCREMENT PRIMARY KEY,
        superadmin_id BIGINT NULL,
        nombre VARCHAR(255) DEFAULT 'Facultad Ciencias de la Salud',
        nit VARCHAR(50) DEFAULT '891800331-1',
        direccion VARCHAR(255) DEFAULT 'Avenida Central del Norte 39-115, Tunja, Boyacá',
        telefono VARCHAR(50) DEFAULT '(608) 7405626',
        correo VARCHAR(150) DEFAULT 'practicas.salud@uptc.edu.co',
        sitio_web VARCHAR(150) DEFAULT 'www.uptc.edu.co',
        eslogan VARCHAR(255) DEFAULT 'Gestor de Prácticas',
        facultad VARCHAR(255) DEFAULT 'Facultad de Ciencias de la Salud',
        logo_institucion LONGTEXT NULL,
        logo_url LONGTEXT NULL,
        fondo_institucion LONGTEXT NULL,
        login_bg_url LONGTEXT NULL,
        color_primario_light VARCHAR(30) DEFAULT '#f59e0b',
        color_secundario_light VARCHAR(30) DEFAULT '#ffffff',
        color_texto_light VARCHAR(30) DEFAULT '#1f2937',
        color_primario_dark VARCHAR(30) DEFAULT '#0f172a',
        color_secundario_dark VARCHAR(30) DEFAULT '#000000',
        color_texto_dark VARCHAR(30) DEFAULT '#f8fafc',
        centros_salud LONGTEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await queryDB("ALTER TABLE institucion_educativa MODIFY COLUMN logo_institucion LONGTEXT NULL");
      await queryDB("ALTER TABLE institucion_educativa MODIFY COLUMN logo_url LONGTEXT NULL");
      await queryDB("ALTER TABLE institucion_educativa MODIFY COLUMN fondo_institucion LONGTEXT NULL");
      await queryDB("ALTER TABLE institucion_educativa MODIFY COLUMN login_bg_url LONGTEXT NULL");
      try {
        await queryDB("ALTER TABLE institucion_educativa MODIFY COLUMN logo_facultad LONGTEXT NULL");
      } catch (e) {
        try {
          await queryDB("ALTER TABLE institucion_educativa ADD COLUMN logo_facultad LONGTEXT NULL");
        } catch (err2) {}
      }
    } catch (e) {}
  } catch (err) {
    console.warn("⚠️ Aviso al inicializar tabla institucion_educativa:", err.message);
  }
}
initInstitutionTable();

function resolveAssetUrl(rawUrl, fallbackUrl = "") {
  if (!rawUrl) return fallbackUrl;
  let url = String(rawUrl).trim();
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http://") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
    url = url.replace("http://", "https://");
  }
  if (url.includes("/uploads/")) {
    const filename = url.split("/uploads/").pop();
    const diskPath = path.join(__dirname, "../uploads", filename);
    if (!fs.existsSync(diskPath)) {
      return fallbackUrl;
    }
  }
  return url;
}

async function getInstitutionSettingsHandler(req, res) {
  try {
    const rows = await queryDB("SELECT * FROM institucion_educativa ORDER BY id DESC LIMIT 1");
    if (rows.length > 0) {
      const row = rows[0];
      let hospitals = [];
      try {
        hospitals = typeof row.centros_salud === "string" ? JSON.parse(row.centros_salud) : (row.centros_salud || []);
      } catch (e) {}

      const defaultLogo = "/images/uptc.png";
      const rawLogo = row.logo_institucion || row.logo_url || "";
      const rawLoginBg = row.fondo_institucion || row.login_bg_url || "";
      const rawFacultyLogo = row.logo_facultad || "";

      const finalLogo = resolveAssetUrl(rawLogo, defaultLogo) || defaultLogo;
      const finalLoginBg = resolveAssetUrl(rawLoginBg, "");
      const finalFacultyLogo = resolveAssetUrl(rawFacultyLogo, "");

      return res.status(200).json({
        id: row.id,
        superadmin_id: row.superadmin_id,
        name: row.nombre || "Universidad Pedagógica y Tecnológica de Colombia",
        nombre: row.nombre || "Universidad Pedagógica y Tecnológica de Colombia",
        nit: row.nit || "891800331-1",
        address: row.direccion || "Avenida Central del Norte 39-115, Tunja, Boyacá",
        phone: row.telefono || "(608) 7405626",
        email: row.correo || "practicas.salud@uptc.edu.co",
        website: row.sitio_web || "www.uptc.edu.co",
        slogan: row.eslogan || "Tu futuro, nuestra misión.",
        eslogan: row.eslogan || "Tu futuro, nuestra misión.",
        faculty: row.facultad || "Facultad de Ciencias de la Salud",
        facultad: row.facultad || "Facultad de Ciencias de la Salud",
        director_nombre: row.director_nombre || row.representante || "Dirección de Escuela",
        representante: row.director_nombre || row.representante || "Dirección de Escuela",
        logo_institucion: finalLogo,
        logo_facultad: finalFacultyLogo,
        fondo_institucion: finalLoginBg,
        logoPreview: finalLogo,
        logo_url: finalLogo,
        loginBgUrl: finalLoginBg,
        login_bg_url: finalLoginBg,
        color_primario_light: row.color_primario_light || "#f59e0b",
        color_secundario_light: row.color_secundario_light || "#ffffff",
        color_texto_light: row.color_texto_light || "#1f2937",
        color_primario_dark: row.color_primario_dark || "#0f172a",
        color_secundario_dark: row.color_secundario_dark || "#000000",
        color_texto_dark: row.color_texto_dark || "#f8fafc",
        hospitals,
      });
    }

    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      return res.status(200).json(data);
    }

    const defaultLogo = "/images/uptc.png";
    return res.status(200).json({
      name: "Universidad Pedagógica y Tecnológica de Colombia",
      nit: "891800331-1",
      address: "Avenida Central del Norte 39-115, Tunja, Boyacá",
      phone: "(608) 7405626",
      email: "practicas.salud@uptc.edu.co",
      website: "www.uptc.edu.co",
      slogan: "Tu futuro, nuestra misión.",
      faculty: "Facultad de Ciencias de la Salud",
      logo_institucion: defaultLogo,
      logo_facultad: "",
      fondo_institucion: "",
      logoPreview: defaultLogo,
      logo_url: defaultLogo,
      loginBgUrl: "",
      login_bg_url: "",
      color_primario_light: "#f59e0b",
      color_secundario_light: "#ffffff",
      color_texto_light: "#1f2937",
      color_primario_dark: "#0f172a",
      color_secundario_dark: "#000000",
      color_texto_dark: "#f8fafc",
      hospitals: [],
    });
  } catch (err) {
    console.error("Error al leer institucion_educativa:", err);
    res.status(500).json({ success: false, message: "Error al leer configuración institucional." });
  }
}

async function updateInstitutionSettingsHandler(req, res) {
  try {
    const data = req.body;
    const {
      name,
      nit,
      address,
      phone,
      email,
      website,
      slogan,
      faculty,
      logo_institucion,
      logo_facultad,
      fondo_institucion,
      logoPreview,
      logo_url,
      loginBgUrl,
      login_bg_url,
      color_primario_light,
      color_secundario_light,
      color_texto_light,
      color_primario_dark,
      color_secundario_dark,
      color_texto_dark,
      hospitals,
    } = data;

    const existing = await queryDB("SELECT id, superadmin_id, logo_institucion, logo_url, logo_facultad, fondo_institucion, login_bg_url FROM institucion_educativa ORDER BY id DESC LIMIT 1");

    // Validar si viene un nuevo logo válido (no vacío ni null)
    const rawLogo = (typeof logo_institucion === "string" && logo_institucion.trim() !== "")
      ? logo_institucion.trim()
      : (typeof logoPreview === "string" && logoPreview.trim() !== ""
          ? logoPreview.trim()
          : (typeof logo_url === "string" && logo_url.trim() !== "" ? logo_url.trim() : null));

    // Validar si viene un nuevo fondo válido (no vacío ni null)
    const rawBg = (typeof fondo_institucion === "string" && fondo_institucion.trim() !== "")
      ? fondo_institucion.trim()
      : (typeof loginBgUrl === "string" && loginBgUrl.trim() !== ""
          ? loginBgUrl.trim()
          : (typeof login_bg_url === "string" && login_bg_url.trim() !== "" ? login_bg_url.trim() : null));

    // Manejar logo de facultad (si se envía explícitamente "" o null, se elimina; si no viene en body, conservar existente)
    const targetFacultyLogo = logo_facultad !== undefined
      ? (logo_facultad && String(logo_facultad).trim() !== "" ? String(logo_facultad).trim() : null)
      : (existing.length > 0 ? (existing[0].logo_facultad || null) : null);

    // Si no viene nuevo logo/fondo, conservar el ya guardado en la base de datos (NUNCA borrarlo ni volver a predeterminado)
    const targetLogo = rawLogo || (existing.length > 0 ? (existing[0].logo_institucion || existing[0].logo_url) : null);
    const targetLoginBg = rawBg || (existing.length > 0 ? (existing[0].fondo_institucion || existing[0].login_bg_url) : null);

    const jsonHospitals = JSON.stringify(hospitals || []);

    if (existing.length > 0) {
      await queryDB(
        `UPDATE institucion_educativa SET
          nombre = COALESCE(?, nombre),
          nit = COALESCE(?, nit),
          direccion = COALESCE(?, direccion),
          telefono = COALESCE(?, telefono),
          correo = COALESCE(?, correo),
          sitio_web = COALESCE(?, sitio_web),
          eslogan = COALESCE(?, eslogan),
          facultad = COALESCE(?, facultad),
          logo_institucion = COALESCE(?, logo_institucion),
          logo_url = COALESCE(?, logo_url),
          logo_facultad = ?,
          fondo_institucion = COALESCE(?, fondo_institucion),
          login_bg_url = COALESCE(?, login_bg_url),
          color_primario_light = COALESCE(?, color_primario_light),
          color_secundario_light = COALESCE(?, color_secundario_light),
          color_texto_light = COALESCE(?, color_texto_light),
          color_primario_dark = COALESCE(?, color_primario_dark),
          color_secundario_dark = COALESCE(?, color_secundario_dark),
          color_texto_dark = COALESCE(?, color_texto_dark),
          centros_salud = ?
        WHERE id = ?`,
        [
          name || null,
          nit || null,
          address || null,
          phone || null,
          email || null,
          website || null,
          slogan || null,
          faculty || null,
          targetLogo,
          targetLogo,
          targetFacultyLogo,
          targetLoginBg,
          targetLoginBg,
          color_primario_light || null,
          color_secundario_light || null,
          color_texto_light || null,
          color_primario_dark || null,
          color_secundario_dark || null,
          color_texto_dark || null,
          jsonHospitals,
          existing[0].id,
        ]
      );
    } else {
      const sa = await queryDB("SELECT id FROM superadmin LIMIT 1");
      const saId = sa.length > 0 ? sa[0].id : null;
      await queryDB(
        `INSERT INTO institucion_educativa (
          superadmin_id, nombre, nit, direccion, telefono, correo, sitio_web, eslogan, facultad,
          logo_institucion, logo_url, logo_facultad, fondo_institucion, login_bg_url,
          color_primario_light, color_secundario_light, color_texto_light,
          color_primario_dark, color_secundario_dark, color_texto_dark, centros_salud
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saId,
          name || "Universidad Pedagógica y Tecnológica de Colombia",
          nit || "891800331-1",
          address || "Avenida Central del Norte 39-115, Tunja, Boyacá",
          phone || "(608) 7405626",
          email || "practicas.salud@uptc.edu.co",
          website || "www.uptc.edu.co",
          slogan || "Tu futuro, nuestra misión.",
          faculty || "Facultad de Ciencias de la Salud",
          targetLogo,
          targetLogo,
          targetFacultyLogo,
          targetLoginBg,
          targetLoginBg,
          color_primario_light || "#f59e0b",
          color_secundario_light || "#ffffff",
          color_texto_light || "#1f2937",
          color_primario_dark || "#0f172a",
          color_secundario_dark || "#000000",
          color_texto_dark || "#f8fafc",
          jsonHospitals,
        ]
      );
    }

    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {}

    console.log("✅ Configuración institucional guardada en BD institucion_educativa.");
    return res.status(200).json({
      success: true,
      message: "Configuración institucional guardada exitosamente en la base de datos.",
      data: {
        ...data,
        logo_institucion: targetLogo,
        logo_facultad: targetFacultyLogo || "",
        fondo_institucion: targetLoginBg,
        logoPreview: targetLogo,
        logo_url: targetLogo,
        loginBgUrl: targetLoginBg,
        login_bg_url: targetLoginBg,
      },
    });
  } catch (err) {
    console.error("Error al guardar institucion_educativa:", err);
    res.status(500).json({ success: false, message: "Error al guardar configuración institucional." });
  }
}

async function uploadInstitutionLogoHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se proporcionó ningún archivo de imagen." });
    }

    const mime = req.file.mimetype || "image/png";
    const base64Data = fs.readFileSync(req.file.path).toString("base64");
    const fullUrl = `data:${mime};base64,${base64Data}`;

    const existing = await queryDB("SELECT id FROM institucion_educativa ORDER BY id DESC LIMIT 1");
    if (existing.length > 0) {
      await queryDB("UPDATE institucion_educativa SET logo_institucion = ?, logo_url = ? WHERE id = ?", [fullUrl, fullUrl, existing[0].id]);
    } else {
      await queryDB("INSERT INTO institucion_educativa (nombre, logo_institucion, logo_url) VALUES ('Universidad Pedagógica y Tecnológica de Colombia', ?, ?)", [fullUrl, fullUrl]);
    }

    console.log(`✅ Logo institucional subido y guardado exitosamente como Base64`);
    return res.status(200).json({
      success: true,
      logo_institucion: fullUrl,
      logo_url: fullUrl,
      logoPreview: fullUrl,
      message: "Logo institucional actualizado con éxito.",
    });
  } catch (err) {
    console.error("Error al subir logo institucional:", err);
    return res.status(500).json({ success: false, message: "Error al procesar el logo en el servidor." });
  }
}

async function uploadFacultyLogoHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se proporcionó ningún archivo de imagen para el logo de la facultad." });
    }

    const mime = req.file.mimetype || "image/png";
    const base64Data = fs.readFileSync(req.file.path).toString("base64");
    const fullUrl = `data:${mime};base64,${base64Data}`;

    const existing = await queryDB("SELECT id FROM institucion_educativa ORDER BY id DESC LIMIT 1");
    if (existing.length > 0) {
      await queryDB("UPDATE institucion_educativa SET logo_facultad = ? WHERE id = ?", [fullUrl, existing[0].id]);
    } else {
      await queryDB("INSERT INTO institucion_educativa (nombre, logo_facultad) VALUES ('Universidad Pedagógica y Tecnológica de Colombia', ?)", [fullUrl]);
    }

    console.log(`✅ Logo de facultad subido y guardado exitosamente como Base64`);
    return res.status(200).json({
      success: true,
      logo_facultad: fullUrl,
      message: "Logo de la facultad actualizado con éxito.",
    });
  } catch (err) {
    console.error("Error al subir logo de la facultad:", err);
    return res.status(500).json({ success: false, message: "Error al procesar el logo de la facultad." });
  }
}

async function deleteFacultyLogoHandler(req, res) {
  try {
    const existing = await queryDB("SELECT id FROM institucion_educativa ORDER BY id DESC LIMIT 1");
    if (existing.length > 0) {
      await queryDB("UPDATE institucion_educativa SET logo_facultad = NULL WHERE id = ?", [existing[0].id]);
    }
    console.log(`✅ Logo de facultad eliminado exitosamente.`);
    return res.status(200).json({
      success: true,
      message: "Logo de la facultad eliminado con éxito.",
    });
  } catch (err) {
    console.error("Error al eliminar logo de facultad:", err);
    return res.status(500).json({ success: false, message: "Error al eliminar el logo de la facultad." });
  }
}

async function uploadLoginBgHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se proporcionó ninguna imagen de fondo." });
    }

    const mime = req.file.mimetype || "image/jpeg";
    const base64Data = fs.readFileSync(req.file.path).toString("base64");
    const fullUrl = `data:${mime};base64,${base64Data}`;

    const existing = await queryDB("SELECT id FROM institucion_educativa ORDER BY id DESC LIMIT 1");
    if (existing.length > 0) {
      await queryDB("UPDATE institucion_educativa SET fondo_institucion = ?, login_bg_url = ? WHERE id = ?", [fullUrl, fullUrl, existing[0].id]);
    } else {
      await queryDB("INSERT INTO institucion_educativa (nombre, fondo_institucion, login_bg_url) VALUES ('Universidad Pedagógica y Tecnológica de Colombia', ?, ?)", [fullUrl, fullUrl]);
    }

    console.log(`✅ Fondo del login subido y guardado exitosamente como Base64`);
    return res.status(200).json({
      success: true,
      fondo_institucion: fullUrl,
      login_bg_url: fullUrl,
      loginBgUrl: fullUrl,
      message: "Fondo del login actualizado con éxito.",
    });
  } catch (err) {
    console.error("Error al subir fondo del login:", err);
    return res.status(500).json({ success: false, message: "Error al procesar la imagen de fondo." });
  }
}

module.exports = router;
module.exports.getInstitutionSettingsHandler = getInstitutionSettingsHandler;
module.exports.updateInstitutionSettingsHandler = updateInstitutionSettingsHandler;
module.exports.uploadInstitutionLogoHandler = uploadInstitutionLogoHandler;
module.exports.uploadFacultyLogoHandler = uploadFacultyLogoHandler;
module.exports.deleteFacultyLogoHandler = deleteFacultyLogoHandler;
module.exports.uploadLoginBgHandler = uploadLoginBgHandler;
module.exports.uploadInstitutionFile = uploadInstitutionFile;
