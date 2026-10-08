// ============================================================
// config/resetCodeStore.js — Almacenamiento temporal de códigos de verificación
// ============================================================
"use strict";

// Mapa en memoria para almacenar { identifier -> { code, expiresAt, cedula, userTable, verified } }
const codeStore = new Map();

/**
 * Almacena un código de 6 dígitos para un identificador.
 * Expiración por defecto: 10 minutos con límite de 5 intentos fallidos.
 */
function saveResetCode(identifier, code, cedula, userTable, userEmail) {
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos
  const entry = {
    code: String(code).trim(),
    expiresAt,
    cedula,
    userTable,
    userEmail,
    attempts: 0,
    verified: false,
  };

  if (identifier !== undefined && identifier !== null && String(identifier).trim() !== "") {
    codeStore.set(String(identifier).toLowerCase().trim(), entry);
  }
  if (cedula !== undefined && cedula !== null && String(cedula).trim() !== "") {
    codeStore.set(String(cedula).toLowerCase().trim(), entry);
  }
  if (userEmail !== undefined && userEmail !== null && String(userEmail).trim() !== "") {
    codeStore.set(String(userEmail).toLowerCase().trim(), entry);
  }
}

/**
 * Verifica si un código ingresado es válido para el identificador con protección anti fuerza bruta.
 */
function verifyResetCode(identifier, code) {
  const key = String(identifier || "").toLowerCase().trim();
  const entry = codeStore.get(key);

  if (!entry) {
    return { valid: false, message: "No se encontró ninguna solicitud de código para esta cuenta o ya expiró." };
  }

  if (Date.now() > entry.expiresAt) {
    clearResetCode(key);
    return { valid: false, message: "El código de verificación ha expirado (válido por 15 min). Por favor solicita uno nuevo." };
  }

  if (entry.attempts >= 5) {
    clearResetCode(key);
    return {
      valid: false,
      message: "Se superó el límite de 5 intentos fallidos. Por seguridad el código fue revocado. Solicita uno nuevo.",
    };
  }

  if (entry.code !== String(code || "").trim()) {
    entry.attempts = (entry.attempts || 0) + 1;
    const remaining = 5 - entry.attempts;

    if (remaining <= 0) {
      clearResetCode(key);
      return {
        valid: false,
        message: "Has superado el número máximo de intentos permitidos (5). El código ha sido invalidado.",
      };
    }

    return {
      valid: false,
      message: `El código ingresado es incorrecto. Intentos restantes: ${remaining}.`,
    };
  }

  // Marcar como verificado correctamente
  entry.verified = true;

  return { valid: true, entry };
}

/**
 * Obtiene la entrada verificada para proceder al cambio de clave.
 */
function getVerifiedEntry(identifier) {
  const key = String(identifier || "").toLowerCase().trim();
  const entry = codeStore.get(key);

  if (entry && entry.verified && Date.now() <= entry.expiresAt) {
    return entry;
  }
  return null;
}

/**
 * Limpia el código usado.
 */
function clearResetCode(identifier) {
  const key = String(identifier || "").toLowerCase().trim();
  const entry = codeStore.get(key);
  if (entry) {
    if (entry.cedula !== undefined && entry.cedula !== null) {
      codeStore.delete(String(entry.cedula).toLowerCase().trim());
    }
    if (entry.userEmail) {
      codeStore.delete(String(entry.userEmail).toLowerCase().trim());
    }
  }
  codeStore.delete(key);
}

module.exports = {
  saveResetCode,
  verifyResetCode,
  getVerifiedEntry,
  clearResetCode,
};
