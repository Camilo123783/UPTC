// ============================================================
// sessionManager.js — Gestión de persistencia e inactividad
// ============================================================
"use strict";

export const INACTIVITY_TIMEOUT_MS = 25 * 60 * 1000;     // 25 minutos de inactividad
export const INACTIVITY_WARNING_MS = 2 * 60 * 1000;      // Advertencia 2 minutos antes
export const PROGRESS_GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutos tras cierre para recuperar progreso

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
 * Escritura segura en localStorage que libera cachés pesados (como institutionSettings)
 * si la cuota de 5MB del navegador fue alcanzada, evitando errores no controlados o cierres de sesión.
 */
const safeSetLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    try {
      localStorage.removeItem("institutionSettings");
      localStorage.removeItem("uptc_cert_signature");
      if (key !== KEYS.SAVED_PROGRESS) {
        localStorage.removeItem(KEYS.SAVED_PROGRESS);
      }
      if (key !== KEYS.INACTIVITY_NOTICE) {
        localStorage.removeItem(KEYS.INACTIVITY_NOTICE);
      }
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      return false;
    }
  }
};

/**
 * Normaliza una ruta o clave de página para impedir que "/login" o "/forgot-password"
 * se guarden como página activa de la sesión autenticada.
 */
export const sanitizeSessionPage = (page, role = null) => {
  if (!page || typeof page !== "string") return "dashboard";
  const trimmed = page.trim();
  if (
    !trimmed ||
    trimmed === "/" ||
    trimmed === "login" ||
    trimmed === "/login" ||
    trimmed === "forgotPassword" ||
    trimmed === "/forgot-password"
  ) {
    return "dashboard";
  }
  if (
    role === "superadmin" &&
    (trimmed === "history" ||
      trimmed === "/history" ||
      trimmed === "/admin/history" ||
      trimmed === "certificateHistory" ||
      trimmed === "/certificate-history" ||
      trimmed === "/admin/certificate-history" ||
      trimmed.startsWith("/student") ||
      trimmed.startsWith("/docent") ||
      trimmed.startsWith("/auditor"))
  ) {
    return "dashboard";
  }
  return trimmed;
};

/**
 * Guarda o actualiza la sesión activa en el almacenamiento local y de sesión con protección contra QuotaExceededError.
 */
export const saveActiveSession = (userRole, currentPage, userData, token) => {
  try {
    if (userRole) {
      try {
        sessionStorage.setItem(KEYS.USER_ROLE, userRole);
      } catch (e) {}
      safeSetLocalStorage(KEYS.USER_ROLE, userRole);
    }
    if (currentPage) {
      const safePage = sanitizeSessionPage(currentPage, userRole);
      try {
        sessionStorage.setItem(KEYS.CURRENT_PAGE, safePage);
      } catch (e) {}
      safeSetLocalStorage(KEYS.CURRENT_PAGE, safePage);
    }
    if (userData) {
      let cleanData = userData;
      if (typeof userData === "object" && userData !== null) {
        cleanData = { ...userData };
        // Evitar saturar la cuota de 5MB de localStorage con imágenes base64 gigantes
        if (typeof cleanData.foto_perfil === "string" && cleanData.foto_perfil.length > 2000) {
          cleanData.foto_perfil = cleanData.foto_url || null;
        }
        if (typeof cleanData.foto_firma === "string" && cleanData.foto_firma.length > 2000) {
          delete cleanData.foto_firma;
        }
      }

      const strData = typeof cleanData === "string" ? cleanData : JSON.stringify(cleanData);

      try {
        sessionStorage.setItem(KEYS.USER_DATA, strData);
      } catch (e) {}

      if (!safeSetLocalStorage(KEYS.USER_DATA, strData)) {
        try {
          const minimalData = {
            id: userData.id || userData.cedula,
            cedula: userData.cedula || userData.id,
            nombre: userData.nombre,
            apellidos: userData.apellidos || userData.apellido || "",
            role: userRole || userData.role,
            correo_institucional: userData.correo_institucional || userData.email,
            foto_url: userData.foto_url || null,
            has_photo: Boolean(userData.has_photo || userData.foto_perfil),
          };
          const minStr = JSON.stringify(minimalData);
          safeSetLocalStorage(KEYS.USER_DATA, minStr);
          try {
            sessionStorage.setItem(KEYS.USER_DATA, minStr);
          } catch (e) {}
        } catch (minErr) {
          console.error("No se pudo guardar datos mínimos en localStorage:", minErr);
        }
      }
    }
    if (token) {
      try {
        sessionStorage.setItem(KEYS.AUTH_TOKEN, token);
        sessionStorage.setItem("token", token);
      } catch (e) {}
      safeSetLocalStorage(KEYS.AUTH_TOKEN, token);
      safeSetLocalStorage("token", token);
    }
    const nowStr = String(Date.now());
    try {
      sessionStorage.setItem(KEYS.LAST_ACTIVITY, nowStr);
    } catch (e) {}
    safeSetLocalStorage(KEYS.LAST_ACTIVITY, nowStr);
  } catch (err) {
    console.error("Error general en saveActiveSession:", err);
  }
};

let lastTouchTime = 0;

/**
 * Comprueba si la sesión ha expirado por inactividad (>25 min) o por token inválido/expirado.
 */
export const isSessionExpired = () => {
  const userRole =
    localStorage.getItem(KEYS.USER_ROLE) || sessionStorage.getItem(KEYS.USER_ROLE);
  const token =
    localStorage.getItem(KEYS.AUTH_TOKEN) ||
    sessionStorage.getItem(KEYS.AUTH_TOKEN) ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  if (!userRole || !token) return true;

  // 1. Verificar tiempo de inactividad
  const lastActivityStr =
    localStorage.getItem(KEYS.LAST_ACTIVITY) ||
    sessionStorage.getItem(KEYS.LAST_ACTIVITY);
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
  const lastActivityStr =
    localStorage.getItem(KEYS.LAST_ACTIVITY) ||
    sessionStorage.getItem(KEYS.LAST_ACTIVITY);

  if (lastActivityStr) {
    const lastActivity = parseInt(lastActivityStr, 10);
    if (!isNaN(lastActivity) && (now - lastActivity) > INACTIVITY_TIMEOUT_MS) {
      return false; // Ya está expirado
    }
  }

  if (now - lastTouchTime > 1000) {
    lastTouchTime = now;
    const nowStr = String(now);
    try {
      sessionStorage.setItem(KEYS.LAST_ACTIVITY, nowStr);
    } catch (e) {}
    safeSetLocalStorage(KEYS.LAST_ACTIVITY, nowStr);
  }
  return true;
};

/**
 * Retorna los milisegundos restantes antes de que la sesión expire por inactividad.
 */
export const getInactivityRemainingMs = () => {
  const lastActivityStr =
    localStorage.getItem(KEYS.LAST_ACTIVITY) ||
    sessionStorage.getItem(KEYS.LAST_ACTIVITY);
  if (!lastActivityStr) return INACTIVITY_TIMEOUT_MS;
  const lastActivity = parseInt(lastActivityStr, 10);
  if (isNaN(lastActivity)) return INACTIVITY_TIMEOUT_MS;
  const elapsed = Date.now() - lastActivity;
  return Math.max(0, INACTIVITY_TIMEOUT_MS - elapsed);
};

/**
 * Renueva y reinicia el temporizador de inactividad de forma forzada.
 */
export const resetInactivityTimer = () => {
  const now = Date.now();
  lastTouchTime = now;
  const nowStr = String(now);
  try {
    sessionStorage.setItem(KEYS.LAST_ACTIVITY, nowStr);
  } catch (e) {}
  safeSetLocalStorage(KEYS.LAST_ACTIVITY, nowStr);
};

/**
 * Verifica y recupera la sesión activa actual.
 */
export const loadActiveSession = () => {
  const userRole =
    localStorage.getItem(KEYS.USER_ROLE) || sessionStorage.getItem(KEYS.USER_ROLE);
  const rawPage =
    localStorage.getItem(KEYS.CURRENT_PAGE) ||
    sessionStorage.getItem(KEYS.CURRENT_PAGE);
  const currentPage = sanitizeSessionPage(rawPage, userRole);
  const lastActivityStr =
    localStorage.getItem(KEYS.LAST_ACTIVITY) ||
    sessionStorage.getItem(KEYS.LAST_ACTIVITY);
  const token =
    localStorage.getItem(KEYS.AUTH_TOKEN) ||
    sessionStorage.getItem(KEYS.AUTH_TOKEN) ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  if (!userRole || !token) {
    if (userRole && !token) {
      clearActiveSession();
    }
    return null;
  }

  const now = Date.now();
  const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : now;
  const elapsed = now - lastActivity;

  // Si superó los 25 minutos de inactividad
  if (!isNaN(lastActivity) && elapsed > INACTIVITY_TIMEOUT_MS) {
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

  // Sincronizar hacia sessionStorage y localStorage para mantener coherencia entre pestañas
  try {
    if (userRole) {
      if (!sessionStorage.getItem(KEYS.USER_ROLE)) sessionStorage.setItem(KEYS.USER_ROLE, userRole);
      if (!localStorage.getItem(KEYS.USER_ROLE)) safeSetLocalStorage(KEYS.USER_ROLE, userRole);
    }
    if (token) {
      if (!sessionStorage.getItem(KEYS.AUTH_TOKEN)) sessionStorage.setItem(KEYS.AUTH_TOKEN, token);
      if (!sessionStorage.getItem("token")) sessionStorage.setItem("token", token);
      if (!localStorage.getItem(KEYS.AUTH_TOKEN)) safeSetLocalStorage(KEYS.AUTH_TOKEN, token);
      if (!localStorage.getItem("token")) safeSetLocalStorage("token", token);
    }
    const userDataStr =
      localStorage.getItem(KEYS.USER_DATA) || sessionStorage.getItem(KEYS.USER_DATA);
    if (userDataStr && !sessionStorage.getItem(KEYS.USER_DATA)) {
      sessionStorage.setItem(KEYS.USER_DATA, userDataStr);
    }
    if (currentPage && !sessionStorage.getItem(KEYS.CURRENT_PAGE)) {
      sessionStorage.setItem(KEYS.CURRENT_PAGE, currentPage);
    }
  } catch (e) {}

  return {
    userRole,
    currentPage: currentPage || "dashboard",
    expiredDueToInactivity: false,
  };
};

/**
 * Guarda el progreso actual durante la ventana de 15 minutos post-cierre por inactividad.
 */
export const saveInactivityProgress = (userRole, currentPage) => {
  if (!userRole) return;
  try {
    const userDataStr =
      localStorage.getItem(KEYS.USER_DATA) || sessionStorage.getItem(KEYS.USER_DATA);
    let parsedUser = null;
    if (userDataStr) {
      try {
        parsedUser = JSON.parse(userDataStr);
      } catch (e) {}
    }

    const progress = {
      userRole,
      currentPage: sanitizeSessionPage(currentPage, userRole),
      userData: parsedUser,
      logoutTimestamp: Date.now(),
    };

    safeSetLocalStorage(KEYS.SAVED_PROGRESS, JSON.stringify(progress));
    safeSetLocalStorage(
      KEYS.INACTIVITY_NOTICE,
      "La sesión se cerró automáticamente por 25 minutos de inactividad. Tu progreso estará disponible por 15 minutos si vuelves a ingresar."
    );
  } catch (e) {}
};

/**
 * Consulta si existe un progreso guardado reciente (dentro de los 15 min tras el cierre).
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
        currentPage: sanitizeSessionPage(progress.currentPage, progress.userRole),
        remainingMs,
        remainingMinutes: Math.ceil(remainingMs / 60000),
        isValid: true,
      };
    } else {
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
  try {
    localStorage.removeItem(KEYS.SAVED_PROGRESS);
    localStorage.removeItem(KEYS.INACTIVITY_NOTICE);
  } catch (e) {}
};

/**
 * Borra la sesión activa completamente en localStorage y sessionStorage.
 */
export const clearActiveSession = () => {
  try {
    localStorage.removeItem(KEYS.USER_ROLE);
    localStorage.removeItem(KEYS.CURRENT_PAGE);
    localStorage.removeItem(KEYS.AUTH_TOKEN);
    localStorage.removeItem("token");
    localStorage.removeItem(KEYS.LAST_ACTIVITY);
    localStorage.removeItem(KEYS.USER_DATA);
  } catch (e) {}
  try {
    sessionStorage.removeItem(KEYS.USER_ROLE);
    sessionStorage.removeItem(KEYS.USER_DATA);
    sessionStorage.removeItem(KEYS.AUTH_TOKEN);
    sessionStorage.removeItem("token");
    sessionStorage.removeItem(KEYS.CURRENT_PAGE);
    sessionStorage.removeItem(KEYS.LAST_ACTIVITY);
  } catch (e) {}
};

/**
 * Cierre de sesión manual voluntario (borra todo).
 */
export const performFullLogout = () => {
  clearActiveSession();
  clearSavedProgress();
};
