// ============================================================
// middleware/auth.js — Verificación de JWT
// ============================================================
"use strict";

const jwt = require("jsonwebtoken");

/**
 * Middleware que verifica el token JWT en el header Authorization.
 * Formato esperado: Authorization: Bearer <token>
 *
 * Si el token es válido, adjunta el payload a `req.user` y llama a `next()`.
 * Si no, responde con 401.
 */
function verifyToken(req, res, next) {
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
    req.user = decoded; // { cedula, role, iat, exp }
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "El token ha expirado. Inicia sesión nuevamente."
        : "Token inválido o malformado.";

    return res.status(401).json({ success: false, message });
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

module.exports = { verifyToken, requireRole };
