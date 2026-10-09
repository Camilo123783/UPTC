// ============================================================
// sessionManager.js — Gestión de persisencia e inactividad
// ============================================================
"use strict";

export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;      // 5 minutos de inactividad
export const PROGRESS_GRACE_PERIOD_MS = 5 * 60 * 1000;  // 5 minutos tras cierre para recuperar progreso

const KEYS = {
  USER_ROLE: "userRole",
  CURRENT_PAGE: "currentPage",
  USER_DATA: "userData",
  AUTH_TOKEN: "authToken",
  LAST_ACTIVITY: "lastActivityTimestamp",
  SAVED_PROGRESS: "savedInactivityProgress",
  INACTIVITY_NOTICE: "inactivityNoticeMessage",
};

/**
 * Guarda o actualiza la sesión activa en el almacenamiento local.
 */
export const saveActiveSession = (userRole, currentPage, userData, token) => {
  if (userRole) {
    localStorage.setItem(KEYS.USER_ROLE, userRole);
    sessionStorage.setItem(KEYS.USER_ROLE, userRole);
  }
  if (currentPage) {
    localStorage.setItem(KEYS.CURRENT_PAGE, currentPage);
  }
  if (userData) {
    const strData = typeof userData === "string" ? userData : JSON.stringify(userData);
    localStorage.setItem(KEYS.USER_DATA, strData);
    sessionStorage.setItem(KEYS.USER_DATA, strData);
  }
  if (token) {
    localStorage.setItem(KEYS.AUTH_TOKEN, token);
    localStorage.setItem("token", token);
    sessionStorage.setItem(KEYS.AUTH_TOKEN, token);
    sessionStorage.setItem("token", token);
  }
  localStorage.setItem(KEYS.LAST_ACTIVITY, String(Date.now()));
};

let lastTouchTime = 0;

/**
 * Comprueba si la sesión ha expirado por inactividad (>5 min) o por token inválido/expirado.
 */
export const isSessionExpired = () => {
  const userRole = localStorage.getItem(KEYS.USER_ROLE) || sessionStorage.getItem(KEYS.USER_ROLE);
  const token = localStorage.getItem(KEYS.AUTH_TOKEN) || localStorage.getItem("token");

  if (!userRole || !token) return true;

  // 1. Verificar tiempo de inactividad
  const lastActivityStr = localStorage.getItem(KEYS.LAST_ACTIVITY);
  const now = Date.now();
  if (lastActivityStr) {
    const lastActivity = parseInt(lastActivityStr, 10);
    if (!isNaN(lastActivity) && (now - lastActivity) > INACTIVITY_TIMEOUT_MS) {
      return true;
    }
  }

  // 2. Verificar expiración del token JWT
  try {
    const base64Url = token.split(".")[1];
    if (base64Url) {
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const decoded = JSON.parse(jsonPayload);
      if (decoded && decoded.exp && decoded.exp * 1000 < now) {
        return true;
      }
    }
  } catch (e) {
    // Si falla la decodificación, no forzamos expiración solo por eso
  }

  return false;
};

/**
 * Actualiza la marca de tiempo de última interacción (con throttling de 1 segundo).
 * Si la sesión ya superó el tiempo límite de inactividad, NO actualiza la marca
 * para evitar que un toque de pantalla al desbloquear reactive erróneamente la sesión.
 */
export const touchLastActivity = () => {
  const now = Date.now();
  const lastActivityStr = localStorage.getItem(KEYS.LAST_ACTIVITY);

  if (lastActivityStr) {
    const lastActivity = parseInt(lastActivityStr, 10);
    if (!isNaN(lastActivity) && (now - lastActivity) > INACTIVITY_TIMEOUT_MS) {
      return false; // Ya está expirado
    }
  }

  if (now - lastTouchTime > 1000) {
    lastTouchTime = now;
    localStorage.setItem(KEYS.LAST_ACTIVITY, String(now));
  }
  return true;
};

/**
 * Verifica y recupera la sesión activa actual.
 */
export const loadActiveSession = () => {
  const userRole = localStorage.getItem(KEYS.USER_ROLE) || sessionStorage.getItem(KEYS.USER_ROLE);
  const currentPage = localStorage.getItem(KEYS.CURRENT_PAGE);
  const lastActivityStr = localStorage.getItem(KEYS.LAST_ACTIVITY);
  const token = localStorage.getItem(KEYS.AUTH_TOKEN) || localStorage.getItem("token");

  if (!userRole || !token) {
    if (userRole && !token) {
      clearActiveSession();
    }
    return null;
  }

  const now = Date.now();
  const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : now;
  const elapsed = now - lastActivity;

  // Si superó los 5 minutos de inactividad
  if (elapsed > INACTIVITY_TIMEOUT_MS) {
    saveInactivityProgress(userRole, currentPage);
    clearActiveSession();
    return { expiredDueToInactivity: true };
  }

  // Verificar si el token JWT expiró
  try {
    const base64Url = token.split(".")[1];
    if (base64Url) {
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const decoded = JSON.parse(jsonPayload);
      if (decoded && decoded.exp && decoded.exp * 1000 < now) {
        saveInactivityProgress(userRole, currentPage);
        clearActiveSession();
        return { expiredDueToInactivity: true, expiredDueToToken: true };
      }
    }
  } catch (e) {}

  return {
    userRole,
    currentPage: currentPage || "dashboard",
    expiredDueToInactivity: false,
  };
};

/**
 * Guarda el progreso actual durante la ventana de 5 minutos post-cierre por inactividad.
 */
export const saveInactivityProgress = (userRole, currentPage) => {
  if (!userRole) return;
  const userDataStr = localStorage.getItem(KEYS.USER_DATA) || sessionStorage.getItem(KEYS.USER_DATA);

  const progress = {
    userRole,
    currentPage: currentPage || "dashboard",
    userData: userDataStr ? JSON.parse(userDataStr) : null,
    logoutTimestamp: Date.now(),
  };

  localStorage.setItem(KEYS.SAVED_PROGRESS, JSON.stringify(progress));
  localStorage.setItem(
    KEYS.INACTIVITY_NOTICE,
    "La sesión se cerró automáticamente por 5 minutos de inactividad. Tu progreso estará disponible por 5 minutos si vuelves a ingresar."
  );
};

/**
 * Consulta si existe un progreso guardado reciente (dentro de los 5 min tras el cierre).
 */
export const getSavedProgress = () => {
  const progressStr = localStorage.getItem(KEYS.SAVED_PROGRESS);
  if (!progressStr) return null;

  try {
    const progress = JSON.parse(progressStr);
    const elapsedSinceLogout = Date.now() - progress.logoutTimestamp;

    if (elapsedSinceLogout <= PROGRESS_GRACE_PERIOD_MS) {
      const remainingMs = PROGRESS_GRACE_PERIOD_MS - elapsedSinceLogout;
      return {
        ...progress,
        remainingMs,
        remainingMinutes: Math.ceil(remainingMs / 60000),
        isValid: true,
      };
    } else {
      // Han pasado más de 5 minutos tras el cierre -> El progreso expira definitivamente
      clearSavedProgress();
      return null;
    }
  } catch {
    clearSavedProgress();
    return null;
  }
};

/**
 * Borra cualquier progreso guardado.
 */
export const clearSavedProgress = () => {
  localStorage.removeItem(KEYS.SAVED_PROGRESS);
  localStorage.removeItem(KEYS.INACTIVITY_NOTICE);
};

/**
 * Borra la sesión activa completamente en localStorage y sessionStorage.
 */
export const clearActiveSession = () => {
  localStorage.removeItem(KEYS.USER_ROLE);
  localStorage.removeItem(KEYS.CURRENT_PAGE);
  localStorage.removeItem(KEYS.AUTH_TOKEN);
  localStorage.removeItem("token");
  localStorage.removeItem(KEYS.LAST_ACTIVITY);
  localStorage.removeItem(KEYS.USER_DATA);
  sessionStorage.removeItem(KEYS.USER_ROLE);
  sessionStorage.removeItem(KEYS.USER_DATA);
  sessionStorage.removeItem(KEYS.AUTH_TOKEN);
  sessionStorage.removeItem("token");
  sessionStorage.removeItem(KEYS.CURRENT_PAGE);
};

/**
 * Cierre de sesión manual voluntario (borra todo).
 */
export const performFullLogout = () => {
  clearActiveSession();
  clearSavedProgress();
};
