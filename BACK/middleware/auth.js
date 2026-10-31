// ============================================================
// middleware/auth.js — Verificación de JWT
// ============================================================
"use strict";

const jwt = require("jsonwebtoken");
const { queryDB } = require("../config/db");

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

// Caché ligera en memoria para validar estado activo sin sobrecargar MySQL (TTL: 15s)
const userStatusCache = new Map();
const USER_STATUS_TTL_MS = 15 * 1000;

function invalidateUserAuthCache(cedula) {
  if (!cedula) {
    userStatusCache.clear();
    return;
  }
  const cleanCedula = String(cedula).trim();
  for (const key of userStatusCache.keys()) {
    if (key.endsWith(`:${cleanCedula}`)) {
      userStatusCache.delete(key);
    }
  }
}

async function checkUserActiveInDB(role, cedula) {
  const table = ROLE_TO_TABLE[String(role || "").trim().toLowerCase()];
  if (!table || !cedula) return { exists: false, active: false };

  const cleanCedula = String(cedula).trim();
  const cacheKey = `${table}:${cleanCedula}`;
  const now = Date.now();
  const cached = userStatusCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let rows = [];
  if (table === "superadmin") {
    rows = await queryDB(`SELECT id, 1 AS activo FROM superadmin WHERE cedula = ? LIMIT 1`, [cleanCedula]);
  } else {
    try {
      rows = await queryDB(`SELECT id, COALESCE(activo, 1) AS activo FROM ${table} WHERE cedula = ? LIMIT 1`, [cleanCedula]);
    } catch (err) {
      if (err && err.code === "ER_BAD_FIELD_ERROR") {
        rows = await queryDB(`SELECT id, 1 AS activo FROM ${table} WHERE cedula = ? LIMIT 1`, [cleanCedula]);
      } else {
        throw err;
      }
    }
  }

  const value =
    rows.length === 0
      ? { exists: false, active: false }
      : { exists: true, active: Number(rows[0].activo) === 1 };

  if (userStatusCache.size > 1000) {
    const oldestKey = userStatusCache.keys().next().value;
    if (oldestKey) userStatusCache.delete(oldestKey);
  }
  userStatusCache.set(cacheKey, { value, expiresAt: now + USER_STATUS_TTL_MS });
  return value;
}

/**
 * Middleware que verifica el token JWT en el header Authorization.
 * Formato esperado: Authorization: Bearer <token>
 *
 * Si el token es válido y la cuenta sigue activa en BD, adjunta el payload a `req.user` y llama a `next()`.
 * Si no, responde con 401.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Acceso no autorizado. Token de autenticación requerido.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const status = await checkUserActiveInDB(decoded.role, decoded.cedula);
    if (!status.exists || !status.active) {
      return res.status(401).json({
        success: false,
        message: "Tu cuenta ha sido desactivada o ya no se encuentra disponible. Contacta al administrador.",
      });
    }
    req.user = decoded; // { cedula, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError" || err.name === "NotBeforeError") {
      const message =
        err.name === "TokenExpiredError"
          ? "El token ha expirado. Inicia sesión nuevamente."
          : "Token inválido o malformado.";

      return res.status(401).json({ success: false, message });
    }
    return next(err);
  }
}

/**
 * Middleware que restringe el acceso a un rol específico.
 * Debe usarse DESPUÉS de verifyToken.
 *
 * @param {...string} roles - Roles permitidos (ej: "admin", "docent")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Acceso prohibido. No tienes permisos para esta acción.",
      });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole, invalidateUserAuthCache };
