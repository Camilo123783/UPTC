import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { BACKEND_URL } from '../../config/api';

const AuthLayout = ({ children, title }) => {
  const { isDark, toggleTheme } = useTheme();

  const [bgUrl, setBgUrl] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("institutionSettings"));
      return saved?.fondo_institucion || saved?.loginBgUrl || saved?.login_bg_url || "";
    } catch (e) {
      return "";
    }
  });

  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("institutionSettings"));
      return saved?.logo_institucion || saved?.logoPreview || saved?.logo_url || "";
    } catch (e) {
      return "";
    }
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/admin/institution-settings`);
        if (res.ok) {
          const data = await res.json();
          const bg = data.fondo_institucion || data.loginBgUrl || data.login_bg_url;
          const logo = data.logo_institucion || data.logoPreview || data.logo_url;
          if (bg) setBgUrl(bg);
          if (logo) setLogoUrl(logo);
          try {
            const current = JSON.parse(localStorage.getItem("institutionSettings") || "{}");
            localStorage.setItem("institutionSettings", JSON.stringify({ ...current, ...data }));
          } catch (e) {}
        }
      } catch (e) {
        // Silent fallback to local assets
      }
    };
    fetchSettings();
  }, []);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none">
      {/* Fondo con imagen dinámica y doble fallback */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105 transition-transform duration-1000 ease-out"
        style={{
          backgroundImage: bgUrl
            ? `url('${bgUrl}')`
            : `url('${process.env.PUBLIC_URL || ""}/campus_background.jpg')`,
        }}
      />

      {/* Capa de superposición con gradiente atmosférico */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isDark
            ? "bg-gradient-to-br from-black/85 via-zinc-950/80 to-blue-950/85 backdrop-blur-[6px]"
            : "bg-gradient-to-br from-slate-900/60 via-blue-950/50 to-indigo-950/70 backdrop-blur-[4px]"
        }`}
      />

      {/* Botón de alternar modo oscuro / claro */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Cambiar tema"
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-md bg-white/20 dark:bg-black/40 border border-white/30 dark:border-zinc-700/60 text-white hover:bg-white/30 dark:hover:bg-black/60 transition shadow-lg text-xs font-semibold cursor-pointer"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-200" />
              <span className="hidden sm:inline">Modo Oscuro</span>
            </>
          )}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/60 dark:border-zinc-800/80 text-gray-900 dark:text-white transition-all duration-300">
        {/* Logo Institucional */}
        <div className="flex justify-center mb-4">
          <img
            src={logoUrl || `${process.env.PUBLIC_URL || ""}/images/uptc.png`}
            alt="Logo Institucional"
            className="h-14 sm:h-16 w-auto object-contain drop-shadow"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = `${process.env.PUBLIC_URL || ""}/images/uptc.png`;
            }}
          />
        </div>

        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-center text-gray-900 dark:text-white mb-6">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;