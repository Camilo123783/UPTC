// ============================================================
// src/config/api.js — Configuración centralizada de URLs de la API
// ============================================================

/**
 * Detecta si la aplicación se está ejecutando en el entorno local del navegador
 */
const isBrowserLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168."));

/**
 * URL base del servidor backend (sin prefijo /api).
 * En desarrollo local en el navegador (localhost), se conecta al backend local (puerto 4004).
 * En producción (Vercel u otros dominios), se conecta al servidor en la nube (Render).
 */
export const BACKEND_URL = isBrowserLocalhost
  ? "http://localhost:4004"
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
