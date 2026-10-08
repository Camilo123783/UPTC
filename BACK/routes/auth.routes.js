// ============================================================
// routes/auth.routes.js — Autenticación y gestión de sesión
// ============================================================
"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { queryDB } = require("../config/db");
const {
  sendUserVerificationCodeEmail,
  sendAdminForgotPasswordNotification,
} = require("../config/mailer");
const {
  saveResetCode,
  verifyResetCode,
  clearResetCode,
} = require("../config/resetCodeStore");

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

// ──────────────────────────────────────────────
// Mapeo de roles a tablas de BD
// ──────────────────────────────────────────────
const ROLE_TABLES_MAP = [
  { tableName: "superadmin", roleName: "superadmin" },
  { tableName: "administrador", roleName: "admin" },
  { tableName: "auditor", roleName: "auditor" },
  { tableName: "docente", roleName: "docent" },
  { tableName: "estudiante", roleName: "student" },
];

// ──────────────────────────────────────────────
// Helper: verificación resiliente de contraseña
// Soporta bcrypt estándar, texto plano y funciones hash comunes (SHA-512, SHA-256, MD5, SHA-1).
// Si coincide por cualquier método no-bcrypt, se auto-migra de inmediato a hash seguro bcrypt en MySQL.
// ──────────────────────────────────────────────
async function verifyAndMigratePassword(tableName, user, inputPassword) {
  if (!user || user.password === undefined || user.password === null) return false;
  const pwdStr = String(inputPassword);
  const stored = String(user.password);

  // 1. Verificación estándar con bcrypt
  let isMatch = await bcrypt.compare(pwdStr, stored).catch(() => false);
  if (isMatch) return true;

  // 2. Comparación en texto plano (ej. escrito directamente en la base de datos)
  if (stored === pwdStr || stored.trim() === pwdStr.trim()) {
    isMatch = true;
  }

  // 3. Comparación con hashes de phpMyAdmin / MySQL (SHA-512, SHA-256, MD5, SHA-1)
  if (!isMatch && stored.length >= 32) {
    const lowerStored = stored.toLowerCase().trim();
    const sha512 = crypto.createHash("sha512").update(pwdStr).digest("hex").toLowerCase();
    const sha256 = crypto.createHash("sha256").update(pwdStr).digest("hex").toLowerCase();
    const md5 = crypto.createHash("md5").update(pwdStr).digest("hex").toLowerCase();
    const sha1 = crypto.createHash("sha1").update(pwdStr).digest("hex").toLowerCase();

    if (
      lowerStored === sha512 ||
      lowerStored === sha256 ||
      lowerStored === md5 ||
      lowerStored === sha1
    ) {
      isMatch = true;
    }
  }

  // Si coincidió con texto plano o función hash, migrar a hash seguro bcrypt de 10 rondas
  if (isMatch) {
    try {
      const newHash = await bcrypt.hash(pwdStr, 10);
      await queryDB(`UPDATE ${tableName} SET password = ? WHERE id = ?`, [newHash, user.id]);
      console.log(`✅ [AUTH] Contraseña de usuario id=${user.id} (${tableName}) migrada automáticamente a hash bcrypt.`);
    } catch (migErr) {
      console.error("⚠️ [AUTH] Error al migrar hash a bcrypt:", migErr.message);
    }
    return true;
  }

  return false;
}

// ──────────────────────────────────────────────
// Helper: buscar y autenticar en una tabla
// ──────────────────────────────────────────────
async function authenticateUser(tableName, cedula, password, roleName) {
  const rows = await queryDB(
    `SELECT * FROM ${tableName} WHERE cedula = ? LIMIT 1`,
    [cedula]
  );

  if (rows.length === 0) return null;

  const user = rows[0];
  const isMatch = await verifyAndMigratePassword(tableName, user, password);

  if (!isMatch) return null;

  // Nunca devolver el hash de la contraseña
  delete user.password;
  return { ...user, role: roleName };
}

// ──────────────────────────────────────────────
// POST /api/login
// ──────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { cedula, password } = req.body;

    if (
      cedula === undefined ||
      cedula === null ||
      String(cedula).trim() === "" ||
      password === undefined ||
      password === null ||
      String(password).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Debe ingresar su cédula y contraseña.",
      });
    }

    // Buscar en todas las tablas de roles
    let authenticatedUser = null;
    for (const roleMap of ROLE_TABLES_MAP) {
      authenticatedUser = await authenticateUser(
        roleMap.tableName,
        cedula,
        password,
        roleMap.roleName
      );
      if (authenticatedUser) break;
    }

    if (!authenticatedUser) {
      return res.status(401).json({
        success: false,
        message: "Cédula o contraseña incorrectos.",
      });
    }

    // ✅ Generar JWT real
    const token = jwt.sign(
      {
        cedula: authenticatedUser.cedula,
        role: authenticatedUser.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login exitoso.",
      user: authenticatedUser,
      role: authenticatedUser.role,
      token,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/forgot-password (Genera y envía código de 6 dígitos)
// ──────────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const rawInput =
      req.body.identifier !== undefined && req.body.identifier !== null && String(req.body.identifier).trim() !== ""
        ? req.body.identifier
        : req.body.cedula !== undefined && req.body.cedula !== null && String(req.body.cedula).trim() !== ""
        ? req.body.cedula
        : req.body.email;
    const identifier = rawInput !== undefined && rawInput !== null ? String(rawInput).trim() : "";

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Por favor proporciona tu correo electrónico o número de cédula.",
      });
    }

    const isValidEmail = (str) =>
      typeof str === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());

    // ⚠️ Estas dos variables eran usadas más abajo pero no estaban
    // declaradas en el archivo original — sin ellas, la ruta lanzaba
    // un error antes de llegar a enviar el correo.
    const isEmail = isValidEmail(identifier);
    const isNumericCedula = /^\d+$/.test(identifier);

    let foundUser = null;
    let foundRole = "";
    let userTableName = "";
    let programaOrInstitucion = "No especificado";

    // 1. Buscar en estudiante (con programa y datos_estudiante)
    let sqlEstudiante = isEmail
      ? `SELECT e.*, p.nombreprograma, de.correo_personal 
         FROM estudiante e 
         LEFT JOIN programa p ON e.programa_id = p.id 
         LEFT JOIN datos_estudiante de ON e.cedula = de.cedula_estudiante 
         WHERE e.correo_institucional = ? OR de.correo_personal = ? 
         LIMIT 1`
      : isNumericCedula
        ? `SELECT e.*, p.nombreprograma, de.correo_personal 
         FROM estudiante e 
         LEFT JOIN programa p ON e.programa_id = p.id 
         LEFT JOIN datos_estudiante de ON e.cedula = de.cedula_estudiante 
         WHERE e.cedula = ? 
         LIMIT 1`
        : `SELECT e.*, p.nombreprograma, de.correo_personal 
         FROM estudiante e 
         LEFT JOIN programa p ON e.programa_id = p.id 
         LEFT JOIN datos_estudiante de ON e.cedula = de.cedula_estudiante 
         WHERE e.correo_institucional = ? OR de.correo_personal = ? 
         LIMIT 1`;

    const paramsEstudiante = isEmail
      ? [identifier, identifier]
      : isNumericCedula
        ? [identifier]
        : [identifier, identifier];
    const estudiantes = await queryDB(sqlEstudiante, paramsEstudiante);

    if (estudiantes.length > 0) {
      foundUser = estudiantes[0];
      foundRole = "Estudiante";
      userTableName = "estudiante";
      programaOrInstitucion = foundUser.nombreprograma || "Programa no asignado";
    }

    // 2. Buscar en docente (con programa)
    if (!foundUser) {
      let sqlDocente = isEmail
        ? `SELECT d.*, p.nombreprograma FROM docente d LEFT JOIN programa p ON d.programa_id = p.id WHERE d.correo_institucional = ? LIMIT 1`
        : isNumericCedula
          ? `SELECT d.*, p.nombreprograma FROM docente d LEFT JOIN programa p ON d.programa_id = p.id WHERE d.cedula = ? OR d.correo_institucional = ? LIMIT 1`
          : `SELECT d.*, p.nombreprograma FROM docente d LEFT JOIN programa p ON d.programa_id = p.id WHERE d.correo_institucional = ? LIMIT 1`;

      const docentes = await queryDB(sqlDocente, [identifier, identifier]);
      if (docentes.length > 0) {
        foundUser = docentes[0];
        foundRole = "Docente";
        userTableName = "docente";
        programaOrInstitucion = foundUser.nombreprograma || "Programa no asignado";
      }
    }

    // 3. Buscar en auditor (con institucion)
    if (!foundUser) {
      let sqlAuditor = isEmail
        ? `SELECT a.*, i.nombreinstitucion FROM auditor a LEFT JOIN institucion i ON a.institucion_id = i.id WHERE a.correo_institucional = ? LIMIT 1`
        : isNumericCedula
          ? `SELECT a.*, i.nombreinstitucion FROM auditor a LEFT JOIN institucion i ON a.institucion_id = i.id WHERE a.cedula = ? OR a.correo_institucional = ? LIMIT 1`
          : `SELECT a.*, i.nombreinstitucion FROM auditor a LEFT JOIN institucion i ON a.institucion_id = i.id WHERE a.correo_institucional = ? LIMIT 1`;

      const auditores = await queryDB(sqlAuditor, [identifier, identifier]);
      if (auditores.length > 0) {
        foundUser = auditores[0];
        foundRole = "Auditor";
        userTableName = "auditor";
        programaOrInstitucion = foundUser.nombreinstitucion || "Institución no asignada";
      }
    }

    // 4. Buscar en administrador y superadmin
    if (!foundUser) {
      let sqlAdmin = isEmail
        ? `SELECT * FROM administrador WHERE correo_institucional = ? LIMIT 1`
        : `SELECT * FROM administrador WHERE cedula = ? OR correo_institucional = ? LIMIT 1`;
      const adminParams = isEmail ? [identifier] : [identifier, identifier];
      const admins = await queryDB(sqlAdmin, adminParams);

      if (admins.length > 0) {
        foundUser = admins[0];
        foundRole = "Administrador";
        userTableName = "administrador";
        programaOrInstitucion = "Administración UPTC";
      } else {
        let sqlSuper = isEmail
          ? `SELECT * FROM superadmin WHERE correo_institucional = ? LIMIT 1`
          : `SELECT * FROM superadmin WHERE cedula = ? OR correo_institucional = ? LIMIT 1`;
        const superParams = isEmail ? [identifier] : [identifier, identifier];
        const superadmins = await queryDB(sqlSuper, superParams);

        if (superadmins.length > 0) {
          foundUser = superadmins[0];
          foundRole = "Super Administrador";
          userTableName = "superadmin";
          programaOrInstitucion = "Administración General UPTC";
        }
      }
    }

    if (!foundUser) {
      return res.status(404).json({
        success: false,
        message: "El correo o la cédula ingresada no pertenece a ningún usuario registrado.",
      });
    }

    // Determinar a qué dirección válida de correo enviar la clave
    let targetEmail = null;
    if (isValidEmail(foundUser.correo_institucional)) {
      targetEmail = foundUser.correo_institucional.trim();
    } else if (isValidEmail(foundUser.correo_personal)) {
      targetEmail = foundUser.correo_personal.trim();
    } else if (isEmail && isValidEmail(identifier)) {
      targetEmail = identifier.trim();
    }

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: `El usuario (${foundUser.nombre || "Usuario"}, Cédula: ${foundUser.cedula}) no tiene registrado un correo electrónico válido (ejemplo: usuario@gmail.com). Por favor actualiza su correo en su perfil.`,
      });
    }

    // Generar código aleatorio criptográficamente seguro de 6 dígitos
    const code = crypto.randomInt(100000, 1000000).toString();

    // Guardar código temporalmente en la tienda en memoria (expira en 15 min)
    saveResetCode(identifier, code, foundUser.cedula, userTableName, targetEmail);

    // Intentar enviar correo automático con el código al correo del usuario (máx 2.5s antes de responder para fluidez total)
    const fullName = `${foundUser.nombre || ""} ${foundUser.apellidos || ""}`.trim();
    let userEmailResult = { success: true };
    try {
      const emailPromise = sendUserVerificationCodeEmail({
        recipientEmail: targetEmail,
        fullName,
        code,
      });

      userEmailResult = await Promise.race([
        emailPromise,
        new Promise((resolve) => setTimeout(() => resolve({ success: true, method: "dispatching" }), 2500)),
      ]);
    } catch (sendErr) {
      console.warn("⚠️ Excepción al enviar correo:", sendErr.message);
    }

    // Enviar copia administrativa de respaldo en segundo plano si es posible
    setImmediate(async () => {
      try {
        await sendAdminForgotPasswordNotification({
          userInfo: foundUser,
          role: foundRole,
          programaOrInstitucion,
          requestEmail: targetEmail,
          code,
        });
      } catch (e) {}
    });

    // Enmascarar el correo para privacidad (ej. j***z@gmail.com)
    const emailParts = targetEmail.split("@");
    const maskedEmail = emailParts[0].substring(0, 2) + "***@" + (emailParts[1] || "");

    console.log(`✅ Solicitud de código de verificación procesada para ${maskedEmail}`);
    return res.status(200).json({
      success: true,
      message: `Se ha enviado un código de verificación de 6 dígitos al correo ${maskedEmail}. Revisa tu bandeja de entrada o spam.`,
      targetEmail: maskedEmail,
      identifier,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/verify-reset-code (Valida el código de 6 dígitos)
// ──────────────────────────────────────────────
router.post("/auth/verify-reset-code", async (req, res, next) => {
  try {
    const { identifier, code } = req.body;

    if (!identifier || !code) {
      return res.status(400).json({
        success: false,
        message: "Por favor ingresa tu identificador y el código de 6 dígitos.",
      });
    }

    const result = verifyResetCode(identifier, code);
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Código verificado exitosamente. Ingresa tu nueva contraseña.",
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/reset-password (Establece la nueva clave en la BD)
// ──────────────────────────────────────────────
router.post("/auth/reset-password", async (req, res, next) => {
  try {
    const { identifier, code, newPassword } = req.body;

    if (!identifier || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos obligatorios para restablecer la contraseña.",
      });
    }

    // Verificar que el código es válido
    const verifyResult = verifyResetCode(identifier, code);
    if (!verifyResult.valid) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message,
      });
    }

    const entry = verifyResult.entry;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la clave en la tabla MySQL del usuario
    await queryDB(
      `UPDATE ${entry.userTable} SET password = ? WHERE cedula = ?`,
      [hashedPassword, entry.cedula]
    );

    // Eliminar el código usado
    clearResetCode(identifier);

    console.log(`✅ Contraseña actualizada con éxito en DB para cédula ${entry.cedula} (${entry.userTable})`);

    return res.status(200).json({
      success: true,
      message: "¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tu nueva clave.",
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/change-password
// ──────────────────────────────────────────────
router.post("/auth/change-password", async (req, res, next) => {
  try {
    const { cedula, currentPassword, newPassword } = req.body;

    if (!cedula || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos obligatorios (cédula o nueva contraseña).",
      });
    }

    // 1. Buscar el usuario en todas las tablas
    let userFound = null;
    let userTable = null;

    for (const roleMap of ROLE_TABLES_MAP) {
      const rows = await queryDB(
        `SELECT * FROM ${roleMap.tableName} WHERE cedula = ? LIMIT 1`,
        [cedula]
      );
      if (rows.length > 0) {
        userFound = rows[0];
        userTable = roleMap.tableName;
        break;
      }
    }

    if (!userFound) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado.",
      });
    }

    // 2. Verificar contraseña actual (estrictamente requerida salvo admin autenticado)
    let isAdmin = false;
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        if (decoded.role === "admin" || decoded.role === "superadmin") {
          isAdmin = true;
        }
      } catch (e) {
        // Token inválido, continuar como no-admin
      }
    }

    if (!isAdmin) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Se requiere la contraseña actual para realizar el cambio.",
        });
      }

      const isMatch = await verifyAndMigratePassword(userTable, userFound, currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Contraseña actual incorrecta.",
        });
      }
    }

    // 3. Hashear la nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 4. Actualizar en la BD
    await queryDB(
      `UPDATE ${userTable} SET password = ? WHERE cedula = ?`,
      [hashedNewPassword, cedula]
    );

    console.log(`✅ Contraseña actualizada para usuario ${cedula}`);
    return res.status(200).json({
      success: true,
      message: "Contraseña cambiada con éxito.",
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// GET /api/institution-settings (Público de solo lectura para login y branding)
// ──────────────────────────────────────────────

router.get("/institution-settings", async (req, res) => {
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

      const finalLogo = resolveAssetUrl(rawLogo, defaultLogo) || defaultLogo;
      const finalLoginBg = resolveAssetUrl(rawLoginBg, "");

      return res.status(200).json({
        id: row.id,
        superadmin_id: row.superadmin_id,
        name: row.nombre || "Universidad Pedagógica y Tecnológica de Colombia",
        nit: row.nit || "891800331-1",
        address: row.direccion || "Avenida Central del Norte 39-115, Tunja, Boyacá",
        phone: row.telefono || "(608) 7405626",
        email: row.correo || "practicas.salud@uptc.edu.co",
        website: row.sitio_web || "www.uptc.edu.co",
        slogan: row.eslogan || "Tu futuro, nuestra misión.",
        faculty: row.facultad || "Facultad de Ciencias de la Salud",
        logo_institucion: finalLogo,
        logo_facultad: row.logo_facultad || "",
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
    res.status(500).json({ success: false, message: "Error al leer configuración institucional." });
  }
});

module.exports = router;