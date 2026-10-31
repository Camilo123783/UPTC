import React, { createContext, useContext, useState, useEffect } from "react";

import { BACKEND_URL } from "../config/api";

const ThemeContext = createContext();

/**
 * Compacta la configuración institucional antes de guardarla en localStorage
 * para evitar que imágenes Base64 duplicadas o mayores a 250KB agoten la cuota de 5MB
 * del navegador y bloqueen el inicio de sesión.
 */
export const compactInstitutionSettingsForStorage = (settings) => {
  if (!settings || typeof settings !== "object") return settings;
  const compact = { ...settings };
  const MAX_BASE64_LEN = 250000;

  // Eliminar duplicados redundantes de imágenes en el almacenamiento local
  delete compact.logoPreview;
  delete compact.logo_url;
  delete compact.loginBgUrl;
  delete compact.login_bg_url;

  for (const key of ["logo_institucion", "logo_facultad", "fondo_institucion"]) {
    if (
      typeof compact[key] === "string" &&
      compact[key].startsWith("data:") &&
      compact[key].length > MAX_BASE64_LEN
    ) {
      delete compact[key];
    }
  }
  return compact;
};

export const applyInstitutionColors = (settings, currentTheme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDarkMode = currentTheme === "dark";

  const primary = isDarkMode
    ? settings?.color_primario_dark || "#f59e0b"
    : settings?.color_primario_light || "#f59e0b";
  const secondary = isDarkMode
    ? settings?.color_secundario_dark &&
      settings?.color_secundario_dark !== "#0f172a"
      ? settings.color_secundario_dark
      : "#000000"
    : settings?.color_secundario_light || "#ffffff";
  const text = isDarkMode
    ? settings?.color_texto_dark || "#f8fafc"
    : settings?.color_texto_light || "#1f2937";

  root.style.setProperty("--color-institution-primary", primary);
  root.style.setProperty("--color-institution-secondary", secondary);
  root.style.setProperty("--color-institution-text", text);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem("appTheme");
      if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
      }
    } catch (e) {}
    return "dark"; // Por defecto modo oscuro como en la vista actual
  });

  const [institutionSettings, setInstitutionSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("institutionSettings")) || null;
    } catch (e) {
      return null;
    }
  });

  // Cargar configuración institucional actualizada desde el backend al montar
  useEffect(() => {
    const fetchInstitutionSettings = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/institution-settings`);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.name || data.nombre)) {
            setInstitutionSettings(data);
            applyInstitutionColors(data, theme);
            try {
              const compact = compactInstitutionSettingsForStorage(data);
              localStorage.setItem("institutionSettings", JSON.stringify(compact));
              window.dispatchEvent(new Event("institutionSettingsUpdated"));
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn(
          "No se pudo cargar la configuración institucional desde backend:",
          e,
        );
      }
    };
    fetchInstitutionSettings();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("appTheme", theme);
    } catch (e) {}
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
    }

    applyInstitutionColors(institutionSettings, theme);
  }, [theme, institutionSettings]);

  // Escuchar cambios en la configuración institucional
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("institutionSettings"));
        if (saved) {
          setInstitutionSettings((prev) => ({ ...(prev || {}), ...saved }));
          applyInstitutionColors(saved, theme);
        }
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("institutionSettingsUpdated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "institutionSettingsUpdated",
        handleStorageChange,
      );
    };
  }, [theme]);

  const updateInstitutionSettings = (newSettings) => {
    setInstitutionSettings((prev) => {
      const merged = { ...(prev || {}), ...(newSettings || {}) };
      applyInstitutionColors(merged, theme);
      try {
        const compact = compactInstitutionSettingsForStorage(merged);
        localStorage.setItem("institutionSettings", JSON.stringify(compact));
        window.dispatchEvent(new Event("institutionSettingsUpdated"));
      } catch (e) {}
      return merged;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark,
        institutionSettings,
        updateInstitutionSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
      isDark: true,
      institutionSettings: null,
      updateInstitutionSettings: () => {},
    };
  }
  return context;
};

export default ThemeContext;
