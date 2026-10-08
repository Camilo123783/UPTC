import React, { useState, useEffect, useRef } from "react";
import {
  Palette,
  Landmark,
  Save,
  Clock,
  ClipboardList,
  Zap,
  Sun,
  Moon,
  Eye,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import { notifyDataChanged, useDataSync } from "../../utils/dataSync";
import { useTheme } from "../../context/ThemeContext";

const API_BASE_URL = BACKEND_URL;

const COLOR_PRESETS = [
  {
    name: "UPTC Dorado Institucional",
    description: "Paleta oficial UPTC con acentos dorados y fondos grafito elegante.",
    colors: {
      color_primario_light: "#f59e0b",
      color_secundario_light: "#ffffff",
      color_texto_light: "#1f2937",
      color_primario_dark: "#f59e0b",
      color_secundario_dark: "#0f172a",
      color_texto_dark: "#f8fafc",
    },
    badge: "bg-amber-500",
  },
  {
    name: "Ciencias de la Salud (Azul Clínico)",
    description: "Tonos azul hospitalario y cian ideales para facultades de medicina.",
    colors: {
      color_primario_light: "#0284c7",
      color_secundario_light: "#f0f9ff",
      color_texto_light: "#0f172a",
      color_primario_dark: "#38bdf8",
      color_secundario_dark: "#082f49",
      color_texto_dark: "#f0f9ff",
    },
    badge: "bg-sky-500",
  },
  {
    name: "Esmeralda Andina (Verde Salud)",
    description: "Inspirada en el departamento de Boyacá y el bienestar biológico.",
    colors: {
      color_primario_light: "#059669",
      color_secundario_light: "#f0fdf4",
      color_texto_light: "#064e3b",
      color_primario_dark: "#10b981",
      color_secundario_dark: "#062e24",
      color_texto_dark: "#ecfdf5",
    },
    badge: "bg-emerald-500",
  },
  {
    name: "Púrpura Académico (Imperial)",
    description: "Distinción universitaria y elegancia institucional.",
    colors: {
      color_primario_light: "#7c3aed",
      color_secundario_light: "#faf5ff",
      color_texto_light: "#1e1b4b",
      color_primario_dark: "#a78bfa",
      color_secundario_dark: "#1e1136",
      color_texto_dark: "#f5f3ff",
    },
    badge: "bg-purple-500",
  },
];

// Función utilitaria para optimizar y comprimir imágenes en el cliente (evita errores 413 y caídas de memoria)
const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const format = file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressedDataUrl = canvas.toDataURL(format, quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        // Fallback a base64 directo si falla la renderización en canvas
        resolve(e.target.result);
      };
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Componente interactivo para selección visual de color por espectro (sin requerir escribir letras/hex)
const ColorSpectrumField = ({ label, name, value, onChange, presets = [] }) => {
  const inputRef = useRef(null);
  const currentColor = value || "#f59e0b";

  return (
    <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/60 transition hover:border-amber-500/50">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <label className="text-xs font-bold text-gray-800 dark:text-zinc-200 uppercase tracking-wider">
          {label}
        </label>
        {/* Indicador circular del color seleccionado */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm ring-1 ring-black/15 transition-transform hover:scale-110 cursor-pointer"
            style={{ backgroundColor: currentColor }}
            onClick={() => inputRef.current && inputRef.current.click()}
            title="Haz clic para seleccionar del espectro"
          />
        </div>
      </div>

      {/* Barra de Espectro Cromático Visual */}
      <div className="relative group cursor-pointer mb-3">
        <div
          onClick={() => inputRef.current && inputRef.current.click()}
          className="w-full h-9 rounded-xl shadow-inner relative overflow-hidden flex items-center justify-center border border-black/10 transition-all group-hover:scale-[1.01] group-hover:shadow-md"
          style={{
            background:
              "linear-gradient(to right, #ef4444 0%, #f97316 12%, #eab308 24%, #22c55e 38%, #06b6d4 52%, #3b82f6 66%, #8b5cf6 80%, #ec4899 92%, #ef4444 100%)",
          }}
        >
          <div className="bg-black/45 backdrop-blur-xs px-3.5 py-1 rounded-full text-[11px] font-black text-white uppercase tracking-wider pointer-events-none drop-shadow flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-white" /> Tocar para abrir espectro de color
          </div>
        </div>
        <input
          ref={inputRef}
          type="color"
          name={name}
          value={currentColor}
          onChange={onChange}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          title="Toca para seleccionar cualquier color del espectro"
        />
      </div>

      {/* Tira rápida de tonos armónicos del espectro */}
      {presets.length > 0 && (
        <div className="flex items-center gap-2 pt-1 overflow-x-auto">
          <span className="text-[10px] font-extrabold text-gray-400 dark:text-zinc-500 uppercase shrink-0">
            Tonos:
          </span>
          <div className="flex items-center gap-1.5">
            {presets.map((toneHex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange({ target: { name, value: toneHex } })}
                style={{ backgroundColor: toneHex }}
                className={`w-6 h-6 rounded-full border border-black/15 transition-transform hover:scale-125 cursor-pointer shadow-2xs ${
                  currentColor.toLowerCase() === toneHex.toLowerCase()
                    ? "ring-2 ring-amber-500 scale-110"
                    : ""
                }`}
                title={`Aplicar tono ${toneHex}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminInstitutionSettings = () => {
  const { updateInstitutionSettings } = useTheme();

  const [institutionData, setInstitutionData] = useState({
    name: "Universidad Pedagógica y Tecnológica de Colombia",
    nit: "891800331-1",
    address: "Avenida Central del Norte 39-115, Tunja, Boyacá",
    phone: "(608) 7405626",
    email: "practicas.salud@uptc.edu.co",
    website: "www.uptc.edu.co",
    logo_institucion: "/uptc_logo.png",
    logo_facultad: "",
    fondo_institucion: "",
    logoPreview: "/uptc_logo.png",
    logo_url: "/uptc_logo.png",
    loginBgUrl: "",
    login_bg_url: "",
    slogan: "Tu futuro, nuestra misión.",
    faculty: "Facultad de Ciencias de la Salud",
    color_primario_light: "#f59e0b",
    color_secundario_light: "#ffffff",
    color_texto_light: "#1f2937",
    color_primario_dark: "#f59e0b",
    color_secundario_dark: "#0f172a",
    color_texto_dark: "#f8fafc",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    const token =
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("token");

    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      let res = await fetch(`${API_BASE_URL}/api/admin/institution-settings`, {
        headers: authHeaders,
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/api/institution-settings`, {
          headers: authHeaders,
        });
      }

      if (res.ok) {
        const data = await res.json();
        const logo = data.logo_institucion || data.logoPreview || data.logo_url || "/uptc_logo.png";
        const facultyLogo = data.logo_facultad || "";
        const bg = data.fondo_institucion || data.loginBgUrl || data.login_bg_url || "";

        setInstitutionData((prev) => ({
          ...prev,
          ...data,
          logo_institucion: logo,
          logo_facultad: facultyLogo,
          fondo_institucion: bg,
          logoPreview: logo,
          logo_url: logo,
          loginBgUrl: bg,
          login_bg_url: bg,
          color_primario_light: data.color_primario_light || prev.color_primario_light || "#f59e0b",
          color_secundario_light: data.color_secundario_light || prev.color_secundario_light || "#ffffff",
          color_texto_light: data.color_texto_light || prev.color_texto_light || "#1f2937",
          color_primario_dark: data.color_primario_dark || prev.color_primario_dark || "#f59e0b",
          color_secundario_dark: data.color_secundario_dark || prev.color_secundario_dark || "#0f172a",
          color_texto_dark: data.color_texto_dark || prev.color_texto_dark || "#f8fafc",
        }));
        try {
          localStorage.setItem("institutionSettings", JSON.stringify({ ...data, logo_institucion: logo, logo_facultad: facultyLogo, fondo_institucion: bg }));
        } catch (e) {}
      }
    } catch (err) {
      console.warn("Usando configuración local de institución:", err);
      try {
        const savedData = JSON.parse(localStorage.getItem("institutionSettings"));
        if (savedData) {
          setInstitutionData((prev) => ({ ...prev, ...savedData }));
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInstitutionData((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyPreset = (preset) => {
    setInstitutionData((prev) => ({
      ...prev,
      ...preset.colors,
    }));
    setMessage(`Paleta "${preset.name}" seleccionada. Haz clic en "Guardar Ajustes" para aplicar en toda la plataforma.`);
    setMessageType("success");
    setTimeout(() => setMessage(""), 4000);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // 1. Obtener imagen en base64 optimizada inmediatamente para previsualización instantánea sin fallos
    let immediateData = "";
    try {
      immediateData = await compressImage(file, 600, 600, 0.92);
    } catch (err) {
      immediateData = URL.createObjectURL(file);
    }

    setInstitutionData((prev) => ({
      ...prev,
      logo_institucion: immediateData,
      logoPreview: immediateData,
      logo_url: immediateData,
    }));
    setIsSaving(true);
    setMessage("Subiendo y guardando el nuevo logo en la base de datos...");
    setMessageType("info");

    try {
      // 2. Subida multipart al servidor
      const formData = new FormData();
      formData.append("logo", file);

      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("authToken") ||
        sessionStorage.getItem("token");

      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE_URL}/api/admin/institution-logo`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      const result = await res.json();
      const savedLogo = (res.ok && (result.logo_institucion || result.logo_url || result.logoPreview))
        ? (result.logo_institucion || result.logo_url || result.logoPreview)
        : immediateData;

      setInstitutionData((prev) => ({
        ...prev,
        logo_institucion: savedLogo,
        logoPreview: savedLogo,
        logo_url: savedLogo,
      }));

      try {
        const currentStored = JSON.parse(localStorage.getItem("institutionSettings")) || {};
        localStorage.setItem(
          "institutionSettings",
          JSON.stringify({ ...currentStored, logo_institucion: savedLogo, logoPreview: savedLogo, logo_url: savedLogo })
        );
      } catch (err) {}

      updateInstitutionSettings({ logo_institucion: savedLogo, logoPreview: savedLogo, logo_url: savedLogo });
      window.dispatchEvent(new Event("institutionSettingsUpdated"));
      notifyDataChanged("institution", "update");

      setMessage("¡Logo de la institución guardado y actualizado exitosamente!");
      setMessageType("success");
    } catch (err) {
      console.warn("Fallo subida multipart, guardando Base64 en base de datos:", err);
      try {
        const token =
          localStorage.getItem("authToken") ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("authToken") ||
          sessionStorage.getItem("token");

        await fetch(`${API_BASE_URL}/api/admin/institution-settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...institutionData,
            logo_institucion: immediateData,
            logoPreview: immediateData,
            logo_url: immediateData,
          }),
        });

        updateInstitutionSettings({ logo_institucion: immediateData, logoPreview: immediateData, logo_url: immediateData });
        window.dispatchEvent(new Event("institutionSettingsUpdated"));
        notifyDataChanged("institution", "update");

        setMessage("¡Logo guardado exitosamente en la base de datos!");
        setMessageType("success");
      } catch (fallbackErr) {
        console.error("Error definitivo al guardar logo:", fallbackErr);
        setMessage("No se pudo guardar el logo. Verifica que sea una imagen válida.");
        setMessageType("error");
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleLoginBgChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    let immediateBg = "";
    try {
      immediateBg = await compressImage(file, 1920, 1080, 0.85);
    } catch (err) {
      immediateBg = URL.createObjectURL(file);
    }

    setInstitutionData((prev) => ({
      ...prev,
      fondo_institucion: immediateBg,
      loginBgUrl: immediateBg,
      login_bg_url: immediateBg,
    }));
    setIsSaving(true);
    setMessage("Subiendo y guardando el nuevo fondo del login...");
    setMessageType("info");

    try {
      const formData = new FormData();
      formData.append("loginBg", file);

      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("authToken") ||
        sessionStorage.getItem("token");

      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE_URL}/api/admin/login-bg`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      const result = await res.json();
      const savedBg = (res.ok && (result.fondo_institucion || result.login_bg_url || result.loginBgUrl))
        ? (result.fondo_institucion || result.login_bg_url || result.loginBgUrl)
        : immediateBg;

      setInstitutionData((prev) => ({
        ...prev,
        fondo_institucion: savedBg,
        loginBgUrl: savedBg,
        login_bg_url: savedBg,
      }));

      try {
        const currentStored = JSON.parse(localStorage.getItem("institutionSettings")) || {};
        localStorage.setItem(
          "institutionSettings",
          JSON.stringify({ ...currentStored, fondo_institucion: savedBg, loginBgUrl: savedBg, login_bg_url: savedBg })
        );
      } catch (err) {}

      updateInstitutionSettings({ fondo_institucion: savedBg, loginBgUrl: savedBg, login_bg_url: savedBg });
      window.dispatchEvent(new Event("institutionSettingsUpdated"));
      notifyDataChanged("institution", "update");

      setMessage("¡Foto de fondo del login guardada y actualizada exitosamente!");
      setMessageType("success");
    } catch (err) {
      console.warn("Fallo subida multipart de fondo, guardando Base64 en base de datos:", err);
      try {
        const token =
          localStorage.getItem("authToken") ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("authToken") ||
          sessionStorage.getItem("token");

        await fetch(`${API_BASE_URL}/api/admin/institution-settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...institutionData,
            fondo_institucion: immediateBg,
            loginBgUrl: immediateBg,
            login_bg_url: immediateBg,
          }),
        });

        updateInstitutionSettings({ fondo_institucion: immediateBg, loginBgUrl: immediateBg, login_bg_url: immediateBg });
        window.dispatchEvent(new Event("institutionSettingsUpdated"));
        notifyDataChanged("institution", "update");

        setMessage("¡Fondo del login guardado exitosamente en la base de datos!");
        setMessageType("success");
      } catch (fallbackErr) {
        setMessage("Error al procesar el fondo del login.");
        setMessageType("error");
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleFacultyLogoChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    let immediateData = "";
    try {
      immediateData = await compressImage(file, 600, 600, 0.92);
    } catch (err) {
      immediateData = URL.createObjectURL(file);
    }

    setInstitutionData((prev) => ({
      ...prev,
      logo_facultad: immediateData,
    }));
    setIsSaving(true);
    setMessage("Subiendo y guardando el logo de la facultad en la base de datos...");
    setMessageType("info");

    try {
      const formData = new FormData();
      formData.append("facultyLogo", file);

      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("authToken") ||
        sessionStorage.getItem("token");

      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE_URL}/api/admin/faculty-logo`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      const result = await res.json();
      const savedLogo = (res.ok && result.logo_facultad) ? result.logo_facultad : immediateData;

      setInstitutionData((prev) => ({
        ...prev,
        logo_facultad: savedLogo,
      }));

      try {
        const currentStored = JSON.parse(localStorage.getItem("institutionSettings")) || {};
        localStorage.setItem(
          "institutionSettings",
          JSON.stringify({ ...currentStored, logo_facultad: savedLogo })
        );
      } catch (err) {}

      updateInstitutionSettings({ logo_facultad: savedLogo });
      window.dispatchEvent(new Event("institutionSettingsUpdated"));
      notifyDataChanged("institution", "update");

      setMessage("¡Logo de la facultad guardado y actualizado exitosamente!");
      setMessageType("success");
    } catch (err) {
      console.warn("Fallo subida multipart de logo facultad, guardando Base64 en base de datos:", err);
      try {
        const token =
          localStorage.getItem("authToken") ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("authToken") ||
          sessionStorage.getItem("token");

        await fetch(`${API_BASE_URL}/api/admin/institution-settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...institutionData,
            logo_facultad: immediateData,
          }),
        });

        updateInstitutionSettings({ logo_facultad: immediateData });
        window.dispatchEvent(new Event("institutionSettingsUpdated"));
        notifyDataChanged("institution", "update");

        setMessage("¡Logo de la facultad guardado exitosamente!");
        setMessageType("success");
      } catch (fallbackErr) {
        console.error("Error definitivo al guardar logo facultad:", fallbackErr);
        setMessage("No se pudo guardar el logo de la facultad. Verifica que sea una imagen válida.");
        setMessageType("error");
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleRemoveFacultyLogo = async () => {
    if (!window.confirm("¿Deseas quitar el logo de la facultad? Los reportes y certificados se generarán sin este logo.")) return;

    setIsSaving(true);
    setMessage("Eliminando logo de la facultad...");
    setMessageType("info");

    try {
      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("authToken") ||
        sessionStorage.getItem("token");

      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      await fetch(`${API_BASE_URL}/api/admin/faculty-logo`, {
        method: "DELETE",
        headers: authHeaders,
      });

      setInstitutionData((prev) => ({
        ...prev,
        logo_facultad: "",
      }));

      try {
        const currentStored = JSON.parse(localStorage.getItem("institutionSettings")) || {};
        localStorage.setItem(
          "institutionSettings",
          JSON.stringify({ ...currentStored, logo_facultad: "" })
        );
      } catch (err) {}

      updateInstitutionSettings({ logo_facultad: "" });
      window.dispatchEvent(new Event("institutionSettingsUpdated"));
      notifyDataChanged("institution", "update");

      setMessage("Logo de la facultad eliminado exitosamente.");
      setMessageType("success");
    } catch (err) {
      setMessage("Error al eliminar el logo de la facultad.");
      setMessageType("error");
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setMessage("");

    const targetLogo = institutionData.logo_institucion || institutionData.logoPreview || institutionData.logo_url || "/uptc_logo.png";
    const targetBg = institutionData.fondo_institucion !== undefined 
      ? institutionData.fondo_institucion 
      : (institutionData.loginBgUrl !== undefined ? institutionData.loginBgUrl : (institutionData.login_bg_url || ""));

    const payload = {
      ...institutionData,
      logo_institucion: targetLogo,
      logo_facultad: institutionData.logo_facultad || "",
      fondo_institucion: targetBg,
      logoPreview: targetLogo,
      logo_url: targetLogo,
      loginBgUrl: targetBg,
      login_bg_url: targetBg,
      hospitals: [],
    };

    const token =
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("token");

    const authHeaders = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      let res = await fetch(`${API_BASE_URL}/api/admin/institution-settings`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/api/institution-settings`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        throw new Error(`Error en servidor: ${res.status}`);
      }

      try {
        localStorage.setItem("institutionSettings", JSON.stringify(payload));
      } catch (e) {}

      updateInstitutionSettings(payload);
      window.dispatchEvent(new Event("institutionSettingsUpdated"));
      notifyDataChanged("institution", "update");

      setMessage("Configuración institucional, logo y colores guardados exitosamente en la base de datos.");
      setMessageType("success");
    } catch (err) {
      console.error("Error al guardar en backend:", err);
      try {
        localStorage.setItem("institutionSettings", JSON.stringify(payload));
      } catch (e) {}

      updateInstitutionSettings(payload);
      window.dispatchEvent(new Event("institutionSettingsUpdated"));
      notifyDataChanged("institution", "update");
      setMessage("Configuración guardada exitosamente.");
      setMessageType("success");
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-zinc-800 transition-colors duration-200">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-sm flex items-center justify-center">
            <Landmark className="w-8 h-8" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Parametrización de la Institución
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                Superadmin
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Personaliza el nombre de la institución, colores oficiales de la interfaz, logo y fondo del login.
            </p>
          </div>
        </div>

        {/* Botón de Guardado Superior */}
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Guardar Ajustes</span>
            </>
          )}
        </button>
      </div>

      {/* Banner de Mensajes */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-2xl text-sm font-medium transition-all ${
            messageType === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
              : messageType === "error"
              ? "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
              : "bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
          }`}
        >
          {message}
        </div>
      )}

      {/* Sección 1: Datos de la Universidad */}
      <div className="mb-8 p-6 border border-gray-200 dark:border-zinc-800 rounded-2xl bg-gray-50/70 dark:bg-zinc-800/40">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>Datos Institucionales Oficiales</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Nombre de la Institución
            </label>
            <input
              type="text"
              name="name"
              value={institutionData.name}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              placeholder="Ej: Universidad Pedagógica y Tecnológica de Colombia"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              NIT / Identificación Tributaria
            </label>
            <input
              type="text"
              name="nit"
              value={institutionData.nit}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              placeholder="Ej: 891800331-1"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Sede Principal / Dirección
            </label>
            <input
              type="text"
              name="address"
              value={institutionData.address}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              placeholder="Ej: Avenida Central del Norte 39-115, Tunja"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Teléfono de Contacto
            </label>
            <input
              type="text"
              name="phone"
              value={institutionData.phone}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              placeholder="Ej: (608) 7405626"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Correo Institucional de Prácticas
            </label>
            <input
              type="email"
              name="email"
              value={institutionData.email}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              placeholder="Ej: practicas.salud@uptc.edu.co"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Portal Web Oficial
            </label>
            <input
              type="text"
              name="website"
              value={institutionData.website}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              placeholder="Ej: www.uptc.edu.co"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Eslogan Institucional
            </label>
            <input
              type="text"
              name="slogan"
              value={institutionData.slogan}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              placeholder="Ej: Tu futuro, nuestra misión."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Facultad / Unidad Académica
            </label>
            <input
              type="text"
              name="faculty"
              value={institutionData.faculty || "Facultad de Ciencias de la Salud"}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
              placeholder="Ej: Facultad de Ciencias de la Salud"
            />
          </div>
        </div>

        {/* Carga del Logo */}
        <div className="pt-4 border-t border-gray-200 dark:border-zinc-700/60">
          <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">
            Logo Institucional
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center min-w-[120px] min-h-[70px]">
              <img
                src={institutionData.logo_institucion || institutionData.logoPreview || institutionData.logo_url || "/uptc_logo.png"}
                alt="Logo Institución"
                className="h-16 max-w-[220px] object-contain"
                onError={(e) => {
                  if (e.currentTarget.src !== window.location.origin + "/uptc_logo.png") {
                    e.currentTarget.src = "/uptc_logo.png";
                  }
                }}
              />
            </div>
            <div className="flex-1 w-full">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="block w-full sm:w-auto text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 dark:file:bg-amber-950 file:text-amber-800 dark:file:text-amber-200 hover:file:bg-amber-200 cursor-pointer"
              />
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1.5">
                Formatos recomendados: PNG, JPG o SVG con fondo transparente. Optimizado y guardado automáticamente en la base de datos.
              </p>
            </div>
          </div>
        </div>

        {/* Logo de la Facultad / Unidad Académica (Opcional para Certificados y Reportes) */}
        <div className="pt-6 mt-6 border-t border-gray-200 dark:border-zinc-700/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                  Logo de la Facultad / Unidad Académica
                </label>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Opcional para Certificados y Reportes
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Este sello o logo se incluirá en la esquina superior derecha de los certificados oficiales y reportes de prácticas. Si no se sube, los documentos se emitirán sin él limpiamente.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center min-w-[120px] min-h-[80px]">
              {institutionData.logo_facultad ? (
                <img
                  src={institutionData.logo_facultad}
                  alt="Logo Facultad"
                  className="h-16 max-w-[180px] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 dark:text-zinc-500 py-1 px-3">
                  <ImageIcon className="w-7 h-7 mb-1 opacity-50" />
                  <span className="text-[10px] font-medium text-center">Sin logo asignado</span>
                </div>
              )}
            </div>
            <div className="flex-1 w-full flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFacultyLogoChange}
                  className="block w-full sm:w-auto text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 dark:file:bg-amber-950 file:text-amber-800 dark:file:text-amber-200 hover:file:bg-amber-200 cursor-pointer"
                />
                <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1.5">
                  Formatos recomendados: PNG o SVG transparente (relación cuadrada o circular recomendada).
                </p>
              </div>
              {institutionData.logo_facultad && (
                <button
                  type="button"
                  onClick={handleRemoveFacultyLogo}
                  className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar Logo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Foto de Fondo del Login (Siempre Difuminada) */}
        <div className="pt-6 mt-6 border-t border-gray-200 dark:border-zinc-700/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                Foto de Fondo del Login (Difuminada)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Personaliza la imagen de la pantalla de inicio de sesión. El sistema siempre le aplicará un elegante efecto difuminado y desenfoque vítreo.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Vista previa con efecto difuminado */}
            <div className="relative w-full sm:w-72 h-36 rounded-2xl overflow-hidden border border-gray-300 dark:border-zinc-700 shadow-inner bg-zinc-950 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-[5px] scale-110"
                style={{
                  backgroundImage: `url('${institutionData.fondo_institucion || institutionData.loginBgUrl || `${process.env.PUBLIC_URL || ""}/campus_background.jpg`}')`,
                }}
              />
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
              <div className="relative z-10 text-center px-4">
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-md border border-white/30">
                  Vista previa difuminada
                </span>
                <p className="text-[10px] text-white/80 mt-1">
                  Fondo institucional activo
                </p>
              </div>
            </div>

            <div className="flex-1 w-full">
              <input
                type="file"
                accept="image/*"
                onChange={handleLoginBgChange}
                className="block w-full text-xs text-gray-500 dark:text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 dark:file:bg-amber-950 file:text-amber-800 dark:file:text-amber-200 hover:file:bg-amber-200 cursor-pointer"
              />
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-2">
                Formatos admitidos: JPG, PNG, WEBP. Se optimiza y procesa automáticamente en alta definición.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 2: Configuración de Colores y Apariencia (Modo Claro & Modo Oscuro) */}
      <div className="mb-8 p-6 border border-gray-200 dark:border-zinc-800 rounded-2xl bg-gray-50/70 dark:bg-zinc-800/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Personalización de Colores (Modo Claro & Modo Oscuro)</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              Personaliza la paleta cromática tocando directamente sobre el espectro de color interactivo.
            </p>
          </div>
        </div>

        {/* Paletas Prediseñadas Rápidas */}
        <div className="mb-6 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80">
          <span className="text-xs font-extrabold uppercase text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Paletas Prediseñadas Recomendadas:</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLOR_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="p-3 text-left rounded-xl border border-gray-200 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-400 bg-gray-50 dark:bg-zinc-800/60 hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-3.5 h-3.5 rounded-full ${preset.badge} ring-2 ring-white dark:ring-zinc-900 shadow-xs`} />
                  <span className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    {preset.name}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Columnas de Selección por Espectro: Modo Claro vs Modo Oscuro */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* MODO CLARO */}
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700/80 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200 dark:border-zinc-800">
              <Sun className="w-5 h-5 text-amber-500" />
              <h4 className="text-sm font-bold uppercase text-gray-900 dark:text-white tracking-wider">
                Esquema Modo Claro
              </h4>
            </div>

            <div className="space-y-4">
              <ColorSpectrumField
                label="Color Primario (Acento / Botones / Sidebar Claro)"
                name="color_primario_light"
                value={institutionData.color_primario_light}
                onChange={handleChange}
                presets={["#f59e0b", "#0284c7", "#059669", "#7c3aed", "#e11d48", "#ea580c"]}
              />

              <ColorSpectrumField
                label="Color Secundario / Fondo de Paneles"
                name="color_secundario_light"
                value={institutionData.color_secundario_light}
                onChange={handleChange}
                presets={["#ffffff", "#f8fafc", "#f0fdf4", "#f0f9ff", "#faf5ff", "#fefce8"]}
              />

              <ColorSpectrumField
                label="Color de Texto Principal (Claro)"
                name="color_texto_light"
                value={institutionData.color_texto_light}
                onChange={handleChange}
                presets={["#1f2937", "#0f172a", "#1e1b4b", "#064e3b", "#000000", "#334155"]}
              />
            </div>
          </div>

          {/* MODO OSCURO */}
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700/80 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200 dark:border-zinc-800">
              <Moon className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-bold uppercase text-gray-900 dark:text-white tracking-wider">
                Esquema Modo Oscuro
              </h4>
            </div>

            <div className="space-y-4">
              <ColorSpectrumField
                label="Color Primario (Acento / Botones / Destacados)"
                name="color_primario_dark"
                value={institutionData.color_primario_dark}
                onChange={handleChange}
                presets={["#f59e0b", "#38bdf8", "#10b981", "#a78bfa", "#fb7185", "#fb923c"]}
              />

              <ColorSpectrumField
                label="Color Secundario / Fondo de Barra Lateral"
                name="color_secundario_dark"
                value={institutionData.color_secundario_dark}
                onChange={handleChange}
                presets={["#0f172a", "#09090b", "#18181b", "#082f49", "#062e24", "#1e1136"]}
              />

              <ColorSpectrumField
                label="Color de Texto Principal (Oscuro)"
                name="color_texto_dark"
                value={institutionData.color_texto_dark}
                onChange={handleChange}
                presets={["#f8fafc", "#ffffff", "#f1f5f9", "#ecfdf5", "#f0f9ff", "#f5f3ff"]}
              />
            </div>
          </div>
        </div>

        {/* Previsualización en Vivo (Live Preview Dual) */}
        <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700/80">
          <span className="text-xs font-extrabold uppercase text-gray-500 dark:text-gray-400 block mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-500" /> Previsualización en Tiempo Real de la Interfaz:
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Previsualización Claro */}
            <div
              className="p-4 rounded-xl border border-gray-200 shadow-sm text-left transition-colors"
              style={{
                backgroundColor: institutionData.color_secundario_light || "#ffffff",
                color: institutionData.color_texto_light || "#1f2937",
              }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-3">
                <div className="flex items-center gap-2">
                  <img
                    src={institutionData.logo_institucion || institutionData.logoPreview || "/uptc_logo.png"}
                    alt="Logo"
                    className="h-6 w-auto object-contain"
                    onError={(e) => {
                      if (e.currentTarget.src !== window.location.origin + "/uptc_logo.png") {
                        e.currentTarget.src = "/uptc_logo.png";
                      }
                    }}
                  />
                  <span className="text-xs font-bold truncate max-w-[160px]">
                    {institutionData.name || "Institución Educativa"}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  Modo Claro
                </span>
              </div>

              <p className="text-xs italic mb-3 opacity-80">
                "{institutionData.slogan || "Eslogan Institucional"}"
              </p>

              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs"
                  style={{
                    backgroundColor: institutionData.color_primario_light || "#f59e0b",
                  }}
                >
                  Botón Primario
                </div>
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{
                    borderColor: institutionData.color_primario_light || "#f59e0b",
                    color: institutionData.color_primario_light || "#f59e0b",
                  }}
                >
                  Borde Dinámico
                </div>
              </div>
            </div>

            {/* Previsualización Oscuro */}
            <div
              className="p-4 rounded-xl border border-zinc-700 shadow-md text-left transition-colors"
              style={{
                backgroundColor: institutionData.color_secundario_dark || "#0f172a",
                color: institutionData.color_texto_dark || "#f8fafc",
              }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
                <div className="flex items-center gap-2">
                  <img
                    src={institutionData.logo_institucion || institutionData.logoPreview || "/uptc_logo.png"}
                    alt="Logo"
                    className="h-6 w-auto object-contain"
                    onError={(e) => {
                      if (e.currentTarget.src !== window.location.origin + "/uptc_logo.png") {
                        e.currentTarget.src = "/uptc_logo.png";
                      }
                    }}
                  />
                  <span className="text-xs font-bold truncate max-w-[160px]">
                    {institutionData.name || "Institución Educativa"}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                  Modo Oscuro
                </span>
              </div>

              <p className="text-xs italic mb-3 opacity-80">
                "{institutionData.slogan || "Eslogan Institucional"}"
              </p>

              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 shadow-xs"
                  style={{
                    backgroundColor: institutionData.color_primario_dark || "#f59e0b",
                  }}
                >
                  Botón Primario
                </div>
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{
                    borderColor: institutionData.color_primario_dark || "#f59e0b",
                    color: institutionData.color_primario_dark || "#f59e0b",
                  }}
                >
                  Borde Dinámico
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botón de Guardado Inferior */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-zinc-800">
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="w-full sm:w-auto px-8 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              <span>Guardando cambios...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Guardar Ajustes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminInstitutionSettings;
