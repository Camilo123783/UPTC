// ============================================================
// src/config/api.js — Configuración centralizada de URLs de la API
// ============================================================

/**
 * Detecta si la aplicación se está ejecutando en el entorno local del navegador
 */
const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

const isLocalOrLanHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.startsWith("192.168.") ||
  hostname.startsWith("10.") ||
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

/**
 * URL base del servidor backend (sin prefijo /api).
 * En desarrollo local o red LAN móvil (192.168.x.x / 10.x.x.x), usa el mismo host en el puerto 4004.
 * En producción (Vercel u otros dominios), se conecta al servidor en la nube (Render).
 */
export const BACKEND_URL = isLocalOrLanHost
  ? `http://${hostname}:4004`
  : (process.env.REACT_APP_BACKEND_URL || "https://uptc.onrender.com");

/**
 * URL base para los endpoints de la API (/api).
 */
export const API_URL = `${BACKEND_URL}/api`;

const apiConfig = {
  BACKEND_URL,
  API_URL,
};

export default apiConfig;
