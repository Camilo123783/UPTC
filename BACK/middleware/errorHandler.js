// ============================================================
// middleware/errorHandler.js — Manejador global de errores
// ============================================================
"use strict";

/**
 * Middleware de manejo centralizado de errores de Express.
 * Debe registrarse como el ÚLTIMO middleware de la app (4 parámetros).
 *
 * - En desarrollo: incluye el stack trace completo en la respuesta.
 * - En producción: oculta detalles internos de SQL o sistema en errores 500.
 */
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === "development";

  // Manejo específico de errores de Multer (tamaño o formato de archivo)
  if (err && err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "El archivo adjunto excede el tamaño máximo permitido de 15 MB.",
      });
    }
    if (err.code === "LIMIT_FIELD_VALUE") {
      return res.status(400).json({
        success: false,
        message: "El valor del campo o archivo Base64 supera el tamaño permitido.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `Error al procesar archivo adjunto: ${err.message}`,
    });
  }

  // Código de estado: usa el del error si existe, sino 500
  const statusCode = err.statusCode || err.status || 500;

  // Log siempre en el servidor (redactando tokens sensibles en query string)
  const safeLogUrl = String(req.url || "").replace(/([?&]token=)[^&]+/gi, "$1[REDACTED]");
  console.error(`❌ [${new Date().toISOString()}] ${req.method} ${safeLogUrl}`);
  console.error(`   Status: ${statusCode}`);
  console.error(`   Mensaje: ${err.message}`);
  if (isDev && err.stack) {
    console.error(`   Stack: ${err.stack}`);
  }

  // En producción, nunca exponer mensajes internos de MySQL o del sistema en errores 500
  const safeMessage =
    statusCode >= 500 && !isDev
      ? "Error interno del servidor. Por favor intenta nuevamente más tarde."
      : err.message || "Error interno del servidor.";

  const response = {
    success: false,
    message: safeMessage,
  };

  // Solo en desarrollo se añaden detalles técnicos
  if (isDev) {
    response.stack = err.stack;
    if (err.sqlMessage) response.sqlError = err.sqlMessage;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
