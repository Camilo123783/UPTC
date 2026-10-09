// ============================================================
// setupFetchInterceptor.js — Interceptor global para window.fetch
// ============================================================
import { BACKEND_URL } from "../config/api";

const originalFetch = window.fetch;

const isTrustedBackend = (inputUrl) => {
  if (!inputUrl) return false;
  const str = typeof inputUrl === "string" ? inputUrl : inputUrl.toString();
  return (
    str.startsWith("/") ||
    str.startsWith(BACKEND_URL) ||
    str.startsWith(window.location.origin)
  );
};

// Intercepta todas las llamadas nativas a fetch en la aplicación
window.fetch = async (input, init = {}) => {
  let url = "";
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input && input.url) {
    url = input.url;
  }

  // Obtener el token JWT guardado en la sesión
  const token = localStorage.getItem("authToken");

  // Solo inyectar el token si la petición va dirigida al backend institucional de confianza
  if (token && isTrustedBackend(url)) {
    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      input = new Request(input, { headers });
    } else {
      init = init ? { ...init } : {};
      const headers = new Headers(init.headers || {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      init.headers = headers;
    }
  }


  const response = await originalFetch(input, init);

  // Si el servidor responde 401 en una ruta protegida
  if (
    response.status === 401 &&
    url &&
    !url.includes("/api/login") &&
    !url.includes("/api/auth/forgot-password") &&
    !url.includes("/api/auth/verify-reset-code") &&
    !url.includes("/api/auth/reset-password")
  ) {
    console.warn(`[Auth] Error 401 en ruta protegida: ${url}`);
    const hadToken = localStorage.getItem("authToken") || localStorage.getItem("token");
    if (hadToken) {
      console.warn("[Auth] Token expirado o revocado. Limpiando credenciales y retornando al login.");
      localStorage.removeItem("authToken");
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userData");
      localStorage.removeItem("lastActivityTimestamp");
      localStorage.removeItem("currentPage");
      sessionStorage.removeItem("userRole");
      sessionStorage.removeItem("userData");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("currentPage");
      window.location.href = "/login";
    }
  }

  return response;
};

export default window.fetch;
