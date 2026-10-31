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

const ROLE_TO_TABLE = {
  superadmin: "superadmin",
  admin: "administrador",
  administrador: "administrador",
  auditor: "auditor",
  docent: "docente",
  docente: "docente",
  student: "estudiante",
  estudiante: "estudiante",
};

// ──────────────────────────────────────────────
// Helper: verificación resiliente de contraseña
// Soporta bcrypt estándar, texto plano y funciones hash comunes (SHA-512, SHA-256, MD5, SHA-1).
// Si el valor almacenado ya es un hash bcrypt ($2a$, $2b$, $2y$), NUNCA se compara en texto plano
// (evita ataques Pass-the-Hash y corrupción del hash).
// ──────────────────────────────────────────────
async function verifyAndMigratePassword(tableName, user, inputPassword) {
  if (!user || user.password === undefined || user.password === null) return false;
  const pwdStr = String(inputPassword);
  const stored = String(user.password);
  const trimmedStored = stored.trim();

  // Si ya es un hash bcrypt válido ($2a$, $2b$, $2y$), solo aceptar bcrypt.compare
  const isBcryptStored = /^\$2[aby]\$\d{2}\$/.test(trimmedStored);
  if (isBcryptStored) {
    return await bcrypt.compare(pwdStr, trimmedStored).catch(() => false);
  }

  let isMatch = false;

  // 1. Comparación en texto plano (solo cuando no es un hash bcrypt)
  if (stored === pwdStr || trimmedStored === pwdStr.trim()) {
    isMatch = true;
  }

  // 2. Comparación con hashes de phpMyAdmin / MySQL (SHA-512, SHA-256, MD5, SHA-1)
  if (!isMatch && /^[a-fA-F0-9]{32,128}$/.test(trimmedStored)) {
    const lowerStored = trimmedStored.toLowerCase();
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

  // Si coincidió con texto plano o función hash legada, migrar a hash seguro bcrypt de 10 rondas
  if (isMatch) {
    try {
      const newHash = await bcrypt.hash(pwdStr, 10);
      if (user.id !== undefined && user.id !== null) {
        await queryDB(`UPDATE ${tableName} SET password = ? WHERE id = ?`, [newHash, user.id]);
      } else {
        await queryDB(`UPDATE ${tableName} SET password = ? WHERE cedula = ?`, [newHash, user.cedula]);
      }
      console.log(`✅ [AUTH] Contraseña de usuario cedula=${user.cedula} (${tableName}) migrada automáticamente a hash bcrypt.`);
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
  const cleanCedula = String(cedula).trim();
  const rows = await queryDB(
    `SELECT * FROM ${tableName} WHERE cedula = ? LIMIT 1`,
    [cleanCedula]
  );

  if (rows.length === 0) return null;

  const user = rows[0];
  const isMatch = await verifyAndMigratePassword(tableName, user, password);

  if (!isMatch) return null;

  // El superadministrador siempre estará activo. A los demás roles se les valida el campo activo.
  if (roleName !== "superadmin") {
    const isUserActive =
      user.activo === undefined || user.activo === null || Number(user.activo) === 1;
    if (!isUserActive) {
      return {
        isDeactivated: true,
        role: roleName,
        cedula: user.cedula,
        nombre: user.nombre,
      };
    }
  }

  // Nunca devolver el hash de la contraseña
  delete user.password;

  // Optimización crítica de payload para login ultrarrápido y evitar QuotaExceededError en el frontend:
  // Si el usuario tiene foto_perfil o foto_firma en base64 de varios megabytes,
  // se reemplaza por la URL del endpoint y un indicador booleano.
  if (user.foto_perfil) {
    user.has_photo = true;
    user.foto_url =
      roleName === "docent"
        ? `/api/docent/photo/${user.cedula}`
        : roleName === "student"
        ? `/api/student/photo/${user.cedula}`
        : null;
    delete user.foto_perfil;
  }
  if (user.foto_firma) {
    user.has_signature = true;
    delete user.foto_firma;
  }

  if (!user.apellidos && user.apellido) {
    user.apellidos = user.apellido;
  }

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
    let deactivatedUser = null;

    for (const roleMap of ROLE_TABLES_MAP) {
      const authResult = await authenticateUser(
        roleMap.tableName,
        cedula,
        password,
        roleMap.roleName
      );
      if (authResult) {
        if (authResult.isDeactivated) {
          if (!deactivatedUser) deactivatedUser = authResult;
        } else {
          authenticatedUser = authResult;
          break;
        }
      }
    }

    if (!authenticatedUser && deactivatedUser) {
      return res.status(403).json({
        success: false,
        isDeactivated: true,
        message:
          'Usuario desactivado, por favor comunicarse con el administrador al correo "enfermeriauptc2026@gmail.com"',
      });
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
        id: authenticatedUser.id,
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

    const isEmail = isValidEmail(identifier);
    const isNumericCedula = /^\d+$/.test(identifier);

    let foundUser = null;
    let foundRole = "";
    let userTableName = "";
    let programaOrInstitucion = "No especificado";

    // Buscar siguiendo el mismo orden jerárquico de ROLE_TABLES_MAP:
    // 1. superadmin -> 2. administrador -> 3. auditor -> 4. docente -> 5. estudiante

    // 1. Buscar en superadmin
    {
      const sqlSuper = isEmail
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

    // 2. Buscar en administrador
    if (!foundUser) {
      const sqlAdmin = isEmail
        ? `SELECT * FROM administrador WHERE correo_institucional = ? LIMIT 1`
        : `SELECT * FROM administrador WHERE cedula = ? OR correo_institucional = ? LIMIT 1`;
      const adminParams = isEmail ? [identifier] : [identifier, identifier];
      const admins = await queryDB(sqlAdmin, adminParams);
      if (admins.length > 0) {
        foundUser = admins[0];
        foundRole = "Administrador";
        userTableName = "administrador";
        programaOrInstitucion = "Administración UPTC";
      }
    }

    // 3. Buscar en auditor (con institucion)
    if (!foundUser) {
      const sqlAuditor = isEmail
        ? `SELECT a.*, i.nombreinstitucion FROM auditor a LEFT JOIN institucion i ON a.institucion_id = i.id WHERE a.correo_institucional = ? LIMIT 1`
        : isNumericCedula
        ? `SELECT a.*, i.nombreinstitucion FROM auditor a LEFT JOIN institucion i ON a.institucion_id = i.id WHERE a.cedula = ? OR a.correo_institucional = ? LIMIT 1`
        : `SELECT a.*, i.nombreinstitucion FROM auditor a LEFT JOIN institucion i ON a.institucion_id = i.id WHERE a.correo_institucional = ? LIMIT 1`;

      const paramsAuditor = isEmail ? [identifier] : isNumericCedula ? [identifier, identifier] : [identifier];
      const auditores = await queryDB(sqlAuditor, paramsAuditor);
      if (auditores.length > 0) {
        foundUser = auditores[0];
        foundRole = "Auditor";
        userTableName = "auditor";
        programaOrInstitucion = foundUser.nombreinstitucion || "Institución no asignada";
      }
    }

    // 4. Buscar en docente (con programa)
    if (!foundUser) {
      const sqlDocente = isEmail
        ? `SELECT d.*, p.nombreprograma FROM docente d LEFT JOIN programa p ON d.programa_id = p.id WHERE d.correo_institucional = ? LIMIT 1`
        : isNumericCedula
        ? `SELECT d.*, p.nombreprograma FROM docente d LEFT JOIN programa p ON d.programa_id = p.id WHERE d.cedula = ? OR d.correo_institucional = ? LIMIT 1`
        : `SELECT d.*, p.nombreprograma FROM docente d LEFT JOIN programa p ON d.programa_id = p.id WHERE d.correo_institucional = ? LIMIT 1`;

      const paramsDocente = isEmail ? [identifier] : isNumericCedula ? [identifier, identifier] : [identifier];
      const docentes = await queryDB(sqlDocente, paramsDocente);
      if (docentes.length > 0) {
        foundUser = docentes[0];
        foundRole = "Docente";
        userTableName = "docente";
        programaOrInstitucion = foundUser.nombreprograma || "Programa no asignado";
      }
    }

    // 5. Buscar en estudiante (con programa y datos_estudiante)
    if (!foundUser) {
      const sqlEstudiante = isEmail
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
    }

    if (!foundUser) {
      return res.status(404).json({
        success: false,
        message: "El correo o la cédula ingresada no pertenece a ningún usuario registrado.",
      });
    }

    if (foundRole !== "Super Administrador") {
      const isUserActive =
        foundUser.activo === undefined || foundUser.activo === null || Number(foundUser.activo) === 1;
      if (!isUserActive) {
        return res.status(403).json({
          success: false,
          isDeactivated: true,
          message:
            'Usuario desactivado, por favor comunicarse con el administrador al correo "enfermeriauptc2026@gmail.com"',
        });
      }
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

    // Enviar correo automático con el código al correo del usuario
    const fullName = `${foundUser.nombre || ""} ${foundUser.apellidos || ""}`.trim();
    let userEmailResult = { success: false };
    try {
      const emailPromise = sendUserVerificationCodeEmail({
        recipientEmail: targetEmail,
        fullName,
        code,
      });

      userEmailResult = await Promise.race([
        emailPromise,
        new Promise((resolve) => setTimeout(() => resolve({ success: true, method: "dispatching" }), 5000)),
      ]);
    } catch (sendErr) {
      console.warn("⚠️ Excepción al enviar correo:", sendErr.message);
      userEmailResult = { success: false, error: sendErr.message };
    }

    if (!userEmailResult || userEmailResult.success === false) {
      clearResetCode(identifier);
      return res.status(500).json({
        success: false,
        message: "No fue posible enviar el código de verificación al correo registrado en este momento. Por favor verifica la configuración de correo o intenta nuevamente.",
      });
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

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "La nueva contraseña debe tener al menos 6 caracteres.",
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

    // Eliminar el código usado en todas las llaves asociadas
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
    const { cedula, currentPassword, newPassword, rol } = req.body;

    if (!cedula || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos obligatorios (cédula o nueva contraseña).",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "La nueva contraseña debe tener al menos 6 caracteres.",
      });
    }

    // Extraer usuario autenticado desde JWT si está presente
    let decodedToken = null;
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        decodedToken = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
      } catch (e) {
        decodedToken = null;
      }
    }

    const isSelfTarget =
      decodedToken &&
      decodedToken.cedula &&
      String(decodedToken.cedula).trim() === String(cedula).trim();

    // Determinar tabla objetivo priorizando rol explícito o rol del token propio
    const hintedRole = rol || (isSelfTarget ? decodedToken.role : null);
    const hintedTable = hintedRole ? ROLE_TO_TABLE[String(hintedRole).trim().toLowerCase()] : null;

    let userFound = null;
    let userTable = null;

    if (hintedTable) {
      const rows = await queryDB(`SELECT * FROM ${hintedTable} WHERE cedula = ? LIMIT 1`, [cedula]);
      if (rows.length > 0) {
        userFound = rows[0];
        userTable = hintedTable;
      }
    }

    if (!userFound) {
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
    }

    if (!userFound) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado.",
      });
    }

    // Validar permisos de quién solicita el cambio
    const callerRole = decodedToken?.role || null;
    const isCallerSuperadmin = callerRole === "superadmin";
    const isCallerAdmin = callerRole === "admin" || callerRole === "administrador";

    if (decodedToken && !isCallerSuperadmin && !isCallerAdmin && !isSelfTarget) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado: solo puedes cambiar la contraseña de tu propia cuenta.",
      });
    }

    // Jerarquía estricta: un admin normal NUNCA puede modificar la contraseña de un superadmin ni de otro admin
    if (!isCallerSuperadmin) {
      if (userTable === "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado: solo un superadministrador puede cambiar la contraseña de una cuenta superadministrador.",
        });
      }
      if (userTable === "administrador" && !isSelfTarget) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado: solo un superadministrador puede cambiar la contraseña de otro administrador.",
        });
      }
    }

    // Determinar si es un reseteo administrativo sobre un tercero (sin currentPassword)
    const isAdminResettingOtherUser =
      (isCallerSuperadmin || isCallerAdmin) &&
      !isSelfTarget &&
      (currentPassword === undefined || currentPassword === null || String(currentPassword) === "");

    if (!isAdminResettingOtherUser) {
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

    console.log(`✅ Contraseña actualizada para usuario ${cedula} (${userTable})`);
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
