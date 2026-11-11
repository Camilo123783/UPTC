// ============================================================
// config/resetCodeStore.js — Almacenamiento temporal de códigos de verificación
// ============================================================
"use strict";

const crypto = require("crypto");

// Mapa en memoria para almacenar { identifier -> { code, expiresAt, cedula, userTable, verified } }
const codeStore = new Map();
const MAX_CODE_STORE_SIZE = 5000;

/**
 * Almacena un código de 6 dígitos para un identificador.
 * Expiración por defecto: 15 minutos con límite de 5 intentos fallidos.
 */
function saveResetCode(identifier, code, cedula, userTable, userEmail) {
  if (codeStore.size >= MAX_CODE_STORE_SIZE) {
    const now = Date.now();
    for (const [k, v] of codeStore.entries()) {
      if (now > v.expiresAt) codeStore.delete(k);
    }
    while (codeStore.size >= MAX_CODE_STORE_SIZE) {
      const oldestKey = codeStore.keys().next().value;
      if (!oldestKey) break;
      codeStore.delete(oldestKey);
    }
  }
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos
  const cleanIdentifier = identifier !== undefined && identifier !== null ? String(identifier).toLowerCase().trim() : "";
  const cleanCedula = cedula !== undefined && cedula !== null ? String(cedula).toLowerCase().trim() : "";
  const cleanEmail = userEmail !== undefined && userEmail !== null ? String(userEmail).toLowerCase().trim() : "";

  const entry = {
    code: String(code).trim(),
    expiresAt,
    identifier: cleanIdentifier,
    cedula,
    userTable,
    userEmail,
    attempts: 0,
    verified: false,
  };

  if (cleanIdentifier) codeStore.set(cleanIdentifier, entry);
  if (cleanCedula) codeStore.set(cleanCedula, entry);
  if (cleanEmail) codeStore.set(cleanEmail, entry);
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

  const expectedBuf = Buffer.from(String(entry.code || "").trim(), "utf8");
  const candidateBuf = Buffer.from(String(code || "").trim(), "utf8");
  const codesMatch =
    expectedBuf.length > 0 &&
    expectedBuf.length === candidateBuf.length &&
    crypto.timingSafeEqual(expectedBuf, candidateBuf);

  if (!codesMatch) {
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
 * Limpia el código usado en todas las llaves asociadas.
 */
function clearResetCode(identifier) {
  const key = String(identifier || "").toLowerCase().trim();
  const entry = codeStore.get(key);
  if (entry) {
    if (entry.identifier) codeStore.delete(String(entry.identifier).toLowerCase().trim());
    if (entry.cedula !== undefined && entry.cedula !== null) {
      codeStore.delete(String(entry.cedula).toLowerCase().trim());
    }
    if (entry.userEmail) {
      codeStore.delete(String(entry.userEmail).toLowerCase().trim());
    }
    for (const [k, v] of codeStore.entries()) {
      if (v === entry) {
        codeStore.delete(k);
      }
    }
  }
  codeStore.delete(key);
}

// Limpieza automática periódica de entradas expiradas (cada 5 minutos)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of codeStore.entries()) {
    if (now > entry.expiresAt) {
      codeStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

module.exports = {
  saveResetCode,
  verifyResetCode,
  getVerifiedEntry,
  clearResetCode,
};
