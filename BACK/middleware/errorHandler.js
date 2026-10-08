// ============================================================
// middleware/errorHandler.js — Manejador global de errores
// ============================================================
"use strict";

/**
 * Middleware de manejo centralizado de errores de Express.
 * Debe registrarse como el ÚLTIMO middleware de la app (4 parámetros).
 *
 * - En desarrollo: incluye el stack trace completo en la respuesta.
 * - En producción: solo devuelve un mensaje genérico seguro.
 */
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === "development";

  // Código de estado: usa el del error si existe, sino 500
  const statusCode = err.statusCode || err.status || 500;

  // Log siempre en el servidor
  console.error(`❌ [${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.error(`   Status: ${statusCode}`);
  console.error(`   Mensaje: ${err.message}`);
  if (isDev && err.stack) {
    console.error(`   Stack: ${err.stack}`);
  }

  // Respuesta al cliente
  const response = {
    success: false,
    message: err.message || "Error interno del servidor.",
  };

  // Solo en desarrollo se añaden detalles técnicos
  if (isDev) {
    response.stack = err.stack;
    if (err.sqlMessage) response.sqlError = err.sqlMessage;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
