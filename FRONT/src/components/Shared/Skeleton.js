// FRONT/src/components/Shared/Skeleton.js
// ============================================================
// SISTEMA MODULAR DE SKELETON SCREEN (UPTC DOCENCIA SERVICIO)
// Marcadores de posición visuales de alta fidelidad con animación
// shimmer para prevenir cambios de diseño acumulados (CLS) y dar
// retroalimentación de carga instantánea en todo el programa.
// ============================================================
import React from "react";

/**
 * Bloque elemental de Skeleton con soporte para modo claro y oscuro
 */
export const Skeleton = ({
  className = "",
  variant = "rounded",
  width,
  height,
  style = {},
  ...props
}) => {
  const variantClasses = {
    text: "rounded-md h-4 my-1",
    circular: "rounded-full aspect-square",
    rectangular: "rounded-none",
    rounded: "rounded-xl",
    pill: "rounded-full",
  }[variant] || "rounded-xl";

  const inlineStyles = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...style,
  };

  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer select-none pointer-events-none ${variantClasses} ${className}`}
      style={inlineStyles}
      {...props}
    />
  );
};

/**
 * Bloque de texto con varias líneas de diferente longitud
 */
export const SkeletonText = ({ lines = 3, className = "", lastLineWidth = "60%" }) => (
  <div className={`space-y-2 py-1 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={`w-full ${i === lines - 1 ? `!w-[${lastLineWidth}]` : ""}`}
        style={i === lines - 1 ? { width: lastLineWidth } : {}}
      />
    ))}
  </div>
);

/**
 * Skeleton para avatar o foto circular de usuario
 */
export const SkeletonAvatar = ({ size = "md", className = "" }) => {
  const sizeClasses = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
    xl: "w-20 h-20",
  }[size] || "w-10 h-10";

  return <Skeleton variant="circular" className={`${sizeClasses} ${className}`} />;
};

/**
 * Skeleton para tarjetas de métricas o indicadores numéricos superiores
 */
export const SkeletonStatsRow = ({ count = 4, className = "" }) => (
  <div
    className={`grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-${count} gap-4 ${className}`}
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 flex items-center justify-between"
      >
        <div className="space-y-2 flex-1 mr-3">
          <Skeleton className="w-20 h-3" />
          <Skeleton className="w-14 h-7" />
          <Skeleton className="w-28 h-2.5" />
        </div>
        <Skeleton variant="rounded" className="w-10 h-10 shrink-0" />
      </div>
    ))}
  </div>
);

/**
 * Skeleton individual de tarjeta de práctica o certificación
 */
export const SkeletonCard = ({ className = "" }) => (
  <div
    className={`p-5 rounded-3xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-between space-y-4 ${className}`}
    aria-hidden="true"
  >
    <div>
      {/* Cabecera: Badge + Período */}
      <div className="flex items-center justify-between mb-3">
        <Skeleton variant="pill" className="w-24 h-5" />
        <Skeleton variant="rounded" className="w-16 h-4" />
      </div>

      {/* Título de la práctica / certificado */}
      <Skeleton className="w-3/4 h-6 mb-2" />
      <Skeleton className="w-1/2 h-3.5 mb-4" />

      {/* Metadatos (institución, tutor, fechas) */}
      <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" className="w-4 h-4 shrink-0" />
          <Skeleton className="w-3/5 h-3" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" className="w-4 h-4 shrink-0" />
          <Skeleton className="w-4/5 h-3" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" className="w-4 h-4 shrink-0" />
          <Skeleton className="w-1/2 h-3" />
        </div>
      </div>
    </div>

    {/* Pie de tarjeta: progreso y botón */}
    <div className="pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between">
      <Skeleton className="w-24 h-3.5" />
      <Skeleton variant="pill" className="w-28 h-8" />
    </div>
  </div>
);

/**
 * Grid completo de tarjetas skeleton (para Historial, Prácticas, Certificados)
 */
export const SkeletonCardGrid = ({ count = 6, cols = 3, className = "" }) => {
  const gridColsClass =
    cols === 4
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      : cols === 2
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid ${gridColsClass} gap-5 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

/**
 * Skeleton para tablas de datos (Usuarios, Cumplimiento, Asistencias)
 */
export const SkeletonTable = ({ rows = 6, cols = 5, className = "" }) => (
  <div
    className={`w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${className}`}
    aria-hidden="true"
  >
    {/* Cabecera de la tabla */}
    <div className="flex items-center gap-4 px-6 py-4 bg-gray-50/80 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${
            i === 0 ? "w-1/4" : i === 1 ? "w-1/5" : i === cols - 1 ? "w-16 ml-auto" : "w-1/6"
          }`}
        />
      ))}
    </div>

    {/* Filas animadas */}
    <div className="divide-y divide-gray-100 dark:divide-zinc-800/60">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-4 px-6 py-4">
          {/* Columna 1: Usuario con Avatar */}
          <div className="flex items-center gap-3 w-1/4">
            <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="w-4/5 h-3.5" />
              <Skeleton className="w-1/2 h-2.5" />
            </div>
          </div>

          {/* Columnas intermedias */}
          {Array.from({ length: cols - 2 }).map((_, colIdx) => (
            <div key={colIdx} className="w-1/6">
              <Skeleton
                className={`h-3.5 ${
                  colIdx % 2 === 0 ? "w-3/4" : "w-1/2"
                }`}
              />
            </div>
          ))}

          {/* Columna de acciones */}
          <div className="ml-auto flex items-center gap-2">
            <Skeleton variant="rounded" className="w-7 h-7" />
            <Skeleton variant="rounded" className="w-7 h-7" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Skeleton para pantalla completa de Dashboard (Docente, Auditor, Admin)
 */
export const SkeletonDashboard = ({ role = "docent", className = "" }) => (
  <div className={`space-y-6 ${className}`} aria-hidden="true">
    {/* Encabezado del Dashboard */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="w-48 h-8" />
        <Skeleton className="w-72 h-4" />
      </div>
      <Skeleton variant="pill" className="w-32 h-8" />
    </div>

    {/* Fila de Accesos Directos Principales */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="w-28 h-3.5" />
            <Skeleton variant="rounded" className="w-9 h-9" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="w-16 h-9" />
            <Skeleton className="w-36 h-3" />
          </div>
          <div className="pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex justify-between items-center">
            <Skeleton className="w-28 h-3" />
            <Skeleton className="w-4 h-3" />
          </div>
        </div>
      ))}
    </div>

    {/* Segunda fila: 2 Columnas (Pendientes + Rotaciones) */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
      <div className="lg:col-span-2 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="w-44 h-5" />
          <Skeleton variant="pill" className="w-20 h-5" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, j) => (
            <div
              key={j}
              className="p-4 rounded-xl border border-gray-100 dark:border-zinc-800/60 flex items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <Skeleton className="w-1/3 h-3.5" />
                <Skeleton className="w-3/4 h-3" />
              </div>
              <Skeleton variant="rounded" className="w-24 h-7 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
        <Skeleton className="w-36 h-5" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, k) => (
            <div
              key={k}
              className="p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800/60 space-y-2"
            >
              <div className="flex justify-between">
                <Skeleton className="w-24 h-3" />
                <Skeleton variant="pill" className="w-12 h-4" />
              </div>
              <Skeleton className="w-3/4 h-2.5" />
              <Skeleton className="w-full h-1.5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/**
 * Skeleton para pantalla de Perfil de Usuario
 */
export const SkeletonProfile = ({ className = "" }) => (
  <div className={`space-y-6 ${className}`} aria-hidden="true">
    {/* Cabecera de Perfil */}
    <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-6">
      <Skeleton variant="circular" className="w-24 h-24 shrink-0" />
      <div className="space-y-2.5 text-center sm:text-left flex-1">
        <Skeleton className="w-48 h-6 mx-auto sm:mx-0" />
        <Skeleton className="w-32 h-4 mx-auto sm:mx-0" />
        <Skeleton variant="pill" className="w-24 h-5 mx-auto sm:mx-0" />
      </div>
    </div>

    {/* Formulario en dos columnas */}
    <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 space-y-6">
      <Skeleton className="w-40 h-5" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="w-28 h-3.5" />
            <Skeleton variant="rounded" className="w-full h-11" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Skeleton para paneles de comunicación / chat
 */
export const SkeletonChat = ({ className = "" }) => (
  <div
    className={`h-[560px] rounded-3xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden ${className}`}
    aria-hidden="true"
  >
    {/* Barra superior de conversación */}
    <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="space-y-1.5">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-20 h-2.5" />
        </div>
      </div>
      <Skeleton variant="rounded" className="w-8 h-8" />
    </div>

    {/* Burbujas de mensajes */}
    <div className="flex-1 p-6 space-y-4 overflow-y-hidden">
      <div className="flex items-start gap-2.5 max-w-[65%]">
        <Skeleton variant="circular" className="w-7 h-7 shrink-0" />
        <Skeleton variant="rounded" className="w-64 h-16 rounded-tl-none" />
      </div>

      <div className="flex items-start gap-2.5 max-w-[65%] ml-auto justify-end">
        <Skeleton variant="rounded" className="w-56 h-12 rounded-tr-none" />
      </div>

      <div className="flex items-start gap-2.5 max-w-[65%]">
        <Skeleton variant="circular" className="w-7 h-7 shrink-0" />
        <Skeleton variant="rounded" className="w-72 h-20 rounded-tl-none" />
      </div>

      <div className="flex items-start gap-2.5 max-w-[65%] ml-auto justify-end">
        <Skeleton variant="rounded" className="w-48 h-10 rounded-tr-none" />
      </div>
    </div>

    {/* Input inferior */}
    <div className="p-4 border-t border-gray-200 dark:border-zinc-800 flex items-center gap-3">
      <Skeleton variant="rounded" className="flex-1 h-11" />
      <Skeleton variant="rounded" className="w-11 h-11 shrink-0" />
    </div>
  </div>
);

export default Skeleton;
