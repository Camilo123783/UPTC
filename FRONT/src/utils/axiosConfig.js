// /src/utils/axiosConfig.js
import axios from "axios";
import { API_URL, BACKEND_URL } from "../config/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor que se ejecuta antes de CADA solicitud
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken"); // Usar la misma clave que en useAuth.js
    if (token) {
      // Añade el token en el formato estándar "Bearer Token"
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export { API_URL, BACKEND_URL };
export default api;
