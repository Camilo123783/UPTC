// /src/utils/useAuth.js
import { useState, useEffect, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "./axiosConfig";

const TOKEN_KEY = "authToken"; // Clave para guardar el token en localStorage
const USERDATA_KEY = "userData"; // Clave usada en sessionStorage

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserFromToken = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const storedData = sessionStorage.getItem(USERDATA_KEY);
    let sessionUser = null;

    // Si existe info en sessionStorage, úsala como respaldo
    if (storedData) {
      try {
        sessionUser = JSON.parse(storedData);
      } catch {
        sessionUser = null;
      }
    }

    if (token) {
      try {
        const decoded = jwtDecode(token);

        // Verificar expiración
        if (decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        } else {
          // Armamos el usuario con prioridad:
          // 1. Datos del token
          // 2. Datos de sessionStorage (respaldo)
          setUser({
            id: decoded.id || decoded.cedula || sessionUser?.cedula || null,
            cedula: decoded.cedula || decoded.id || sessionUser?.cedula || null,
            name: decoded.name || decoded.nombre || sessionUser?.nombre || "",
            apellidos: decoded.apellidos || sessionUser?.apellidos || "",
            email: decoded.email || sessionUser?.email || "",
            role: decoded.role || sessionUser?.role || "student",
          });
        }
      } catch (error) {
        console.error("Error decodificando el token:", error);
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    } else if (sessionUser) {
      // Si no hay token pero sí datos en sesión
      setUser({
        id: sessionUser.cedula || null,
        cedula: sessionUser.cedula || null,
        name: sessionUser.nombre || "",
        apellidos: sessionUser.apellidos || "",
        email: sessionUser.email || "",
        role: sessionUser.role || "student",
      });
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUserFromToken();
  }, [loadUserFromToken]);

  // Cerrar sesión
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USERDATA_KEY);
    setUser(null);
  };

  // Helpers
  const hasRole = (requiredRole) => user?.role === requiredRole;

  // Exportar todo lo necesario
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
    hasRole,
    isAdmin: hasRole("admin") || hasRole("superadmin"),
    isSuperAdmin: hasRole("superadmin"),
    isSuperadmin: hasRole("superadmin"),
    isStudent: hasRole("student"),
    isDocent: hasRole("docent"),
    isAuditor: hasRole("auditor"),
  };
};

