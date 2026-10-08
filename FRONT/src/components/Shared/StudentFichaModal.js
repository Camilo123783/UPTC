import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mail,
  Phone,
  Building,
  Hospital,
  GraduationCap,
  Clock,
  Award,
  Calendar,
  ShieldCheck,
  FileText,
  User,
  CheckCircle2,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  UserCheck,
  Shield,
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import StudentAvatar from "./StudentAvatar";

/**
 * Modal Profesional de Ficha Integral del Estudiante:
 * Muestra la fotografía oficial del estudiante con fallback a letra inicial,
 * visor de fotografía ampliada (lightbox/zoom) para verificar identidad completa,
 * expediente académico, datos de contacto, rotación clínica, avance de horas y notas.
 */
const StudentFichaModal = ({
  isOpen,
  onClose,
  student,
  practiceInfo = {},
  role = "docent",
  onPrimaryAction,
  primaryActionLabel,
}) => {
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [zoomImageError, setZoomImageError] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsPhotoZoomed(false);
      setZoomScale(1);
      setRotation(0);
      setZoomImageError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isPhotoZoomed) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsPhotoZoomed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPhotoZoomed]);

  if (!isOpen || !student) return null;

  const cedula = String(student.cedula || student.id || "");
  const nombre = student.fullName || student.nombre_completo || `${student.nombre || ""} ${student.apellidos || ""}`.trim() || `Estudiante #${cedula}`;
  const codigo = student.codigo || null;
  const carrera = student.career || student.carrera || student.programa_nombre || "Área de la Salud";
  const correoInst = student.email || student.correo || student.correo_institucional || null;
  const correoPersonal = student.correo_personal || null;
  const telefono = student.telefono || null;
  const biografia = student.biografia || null;

  // Práctica
  const practicaTitulo = student.practiceName || student.practica_titulo || practiceInfo.titulo || "Práctica Formativa";
  const hospital = student.hospital || student.institucion_nombre || practiceInfo.institucion_nombre || "Centro Hospitalario";
  const servicio = student.service || student.servicio_nombre || practiceInfo.servicio_nombre || "Servicio Clínico";
  const docenteNombre = student.docente_nombre || practiceInfo.docente_nombre || null;
  const auditorNombre = student.auditor_nombre || practiceInfo.auditor_nombre || null;

  // Horas
  const horasCumplidas = Number(student.horas_cumplidas || 0);
  const horasAsignadas = Number(student.horas_asignadas || practiceInfo.horas_totales || 120);
  const pctHoras = Math.min(100, Math.round((horasCumplidas / (horasAsignadas || 1)) * 100));

  // Evaluación
  const calificacion = student.score !== undefined && student.score !== null ? Number(student.score) : (student.calificacion !== null && student.calificacion !== undefined ? Number(student.calificacion) : null);
  const feedback = student.feedback || student.retroalimentacion || null;
  const notaSugerida = student.nota_sugerida !== null && student.nota_sugerida !== undefined ? Number(student.nota_sugerida) : null;
  const conceptoAuditor = student.concepto || student.report_concepto || null;

  const token = typeof window !== "undefined" ? (localStorage.getItem("authToken") || sessionStorage.getItem("authToken")) : null;
  const photoUrl = `${BACKEND_URL}/api/student/photo/${cedula}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-200 dark:border-zinc-800 my-8 overflow-hidden transform transition-all flex flex-col">
        {/* Cabecera con degradado institucional */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            aria-label="Cerrar ficha"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* Foto de Perfil del Estudiante con opción interactiva para ampliar */}
            <div className="relative group flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setRotation(0);
                  setZoomImageError(false);
                  setIsPhotoZoomed(true);
                }}
                className="relative block rounded-full focus:outline-none focus:ring-4 focus:ring-amber-400/50 cursor-pointer transition-transform group-hover:scale-105"
                title="Haz clic para ver la fotografía completa y verificar identidad"
              >
                <StudentAvatar
                  cedula={cedula}
                  name={nombre}
                  size="3xl"
                  className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-amber-400 shadow-xl"
                  fallbackBg="bg-blue-950 text-amber-300 text-2xl font-black"
                />
                <span
                  className="absolute bottom-0 right-0 p-1 bg-amber-400 text-slate-950 rounded-full shadow-md z-10"
                  title="Estudiante UPTC"
                >
                  <GraduationCap className="w-4 h-4" />
                </span>

                {/* Overlay hover con lupa */}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px]">
                  <ZoomIn className="w-6 h-6 text-white drop-shadow-md" />
                </div>
              </button>

              {/* Botón directo de ampliación debajo de la foto */}
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setRotation(0);
                  setZoomImageError(false);
                  setIsPhotoZoomed(true);
                }}
                className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md transition flex items-center gap-1 whitespace-nowrap cursor-pointer z-20 border border-amber-500/30"
                title="Ampliar y verificar fotografía completa"
              >
                <ZoomIn className="w-3 h-3" />
                <span>Ampliar</span>
              </button>
            </div>

            <div className="min-w-0 flex-1 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono tracking-wider shadow-sm">
                  C.C. {cedula}
                </span>
                {codigo && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white font-mono">
                    Cód. {codigo}
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white truncate leading-tight">
                {nombre}
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 font-medium truncate mt-0.5">
                {carrera}
              </p>
            </div>
          </div>
        </div>

        {/* Cuerpo de la Ficha */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Biografía / Presentación si existe */}
          {biografia && (
            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-950 dark:text-blue-200">
              <p className="font-bold text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Perfil y Presentación
              </p>
              <p className="italic leading-relaxed">{biografia}</p>
            </div>
          )}

          {/* Información de Contacto */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-2.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-500" />
              Canales de Contacto
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-gray-500 dark:text-zinc-400">Institucional</span>
                  <a href={`mailto:${correoInst}`} className="font-semibold text-gray-900 dark:text-white truncate block hover:underline">
                    {correoInst || "No registrado"}
                  </a>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-gray-500 dark:text-zinc-400">Teléfono / WhatsApp</span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate block">
                    {telefono || "No registrado"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Marco Clínico y Práctica */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-2.5 flex items-center gap-1.5">
              <Hospital className="w-3.5 h-3.5 text-amber-500" />
              Centro de Práctica y Rotación
            </h4>
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-200/60 dark:border-zinc-700/60">
                <span className="text-gray-500 dark:text-zinc-400">Práctica:</span>
                <span className="font-bold text-gray-900 dark:text-white text-right truncate ml-2">
                  {practicaTitulo}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-200/60 dark:border-zinc-700/60">
                <span className="text-gray-500 dark:text-zinc-400">Institución / Sede:</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right truncate ml-2">
                  {hospital}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-200/60 dark:border-zinc-700/60">
                <span className="text-gray-500 dark:text-zinc-400">Servicio Clínico:</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right truncate ml-2">
                  {servicio}
                </span>
              </div>
              {docenteNombre && (
                <div className="flex items-center justify-between py-1 border-b border-gray-200/60 dark:border-zinc-700/60">
                  <span className="text-gray-500 dark:text-zinc-400">Docente Supervisor:</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400 text-right truncate ml-2 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 inline-block" /> {docenteNombre}
                  </span>
                </div>
              )}
              {auditorNombre && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-500 dark:text-zinc-400">Auditor Hospitalario:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-right truncate ml-2 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 inline-block" /> {auditorNombre}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Horas de Práctica y Cumplimiento */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Cumplimiento de Horas
              </h4>
              <span className="text-xs font-black text-gray-900 dark:text-white">
                {horasCumplidas}h / {horasAsignadas}h ({pctHoras}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  pctHoras >= 100
                    ? "bg-emerald-500"
                    : pctHoras >= 50
                    ? "bg-blue-600"
                    : "bg-amber-500"
                }`}
                style={{ width: `${pctHoras}%` }}
              />
            </div>
          </div>

          {/* Calificación y Retroalimentación */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/60 dark:from-zinc-800/80 dark:to-zinc-800/40 border border-gray-200 dark:border-zinc-700 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                Calificación Oficial Docente:
              </span>
              <span className="text-base font-black">
                {calificacion !== null ? (
                  <span className={calificacion >= 3.0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    {calificacion.toFixed(1)} / 5.0
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold text-xs">
                    Pendiente por calificar
                  </span>
                )}
              </span>
            </div>

            {feedback && (
              <div className="pt-2 border-t border-gray-200 dark:border-zinc-700">
                <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 block mb-0.5">
                  Retroalimentación del Docente:
                </span>
                <p className="italic text-gray-800 dark:text-zinc-200">"{feedback}"</p>
              </div>
            )}

            {notaSugerida !== null && (
              <div className="pt-2 border-t border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Concepto Sugerido por Auditor:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {notaSugerida.toFixed(1)} {conceptoAuditor ? `(${conceptoAuditor})` : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer con botones de acción */}
        <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-2.5 bg-gray-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-white font-bold rounded-xl text-xs hover:bg-gray-300 dark:hover:bg-zinc-700 transition cursor-pointer"
          >
            Cerrar Ficha
          </button>

          {onPrimaryAction && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onPrimaryAction(student);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>{primaryActionLabel || "Gestionar Estudiante"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Modal de Fotografía Oficial Ampliada (Lightbox / Zoom Completo) ─── */}
      {isPhotoZoomed && (
        <div
          className="fixed inset-0 z-[100000] flex flex-col items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPhotoZoomed(false);
          }}
        >
          {/* Barra superior de controles */}
          <div className="w-full max-w-4xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white mb-3 px-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Verificación de Identidad Oficial
              </span>
              <h4 className="text-base sm:text-lg font-black truncate text-white">
                {nombre} · <span className="font-mono text-gray-300">C.C. {cedula}</span>
              </h4>
            </div>

            {/* Botonera de herramientas */}
            <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700/80 p-1.5 rounded-2xl shadow-xl flex-shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))))}
                className="p-2 rounded-xl hover:bg-zinc-800 text-gray-300 hover:text-white transition cursor-pointer"
                title="Reducir zoom (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono font-bold px-2 py-0.5 text-amber-300 min-w-[42px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(3, Number((s + 0.25).toFixed(2))))}
                className="p-2 rounded-xl hover:bg-zinc-800 text-gray-300 hover:text-white transition cursor-pointer"
                title="Aumentar zoom (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-zinc-700 mx-1" />

              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-gray-300 hover:text-white transition cursor-pointer"
                title="Rotar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setRotation(0);
                }}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg hover:bg-zinc-800 text-gray-400 hover:text-white transition cursor-pointer"
                title="Restablecer tamaño original (100%)"
              >
                100%
              </button>

              <div className="w-px h-5 bg-zinc-700 mx-1" />

              <a
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl hover:bg-zinc-800 text-gray-300 hover:text-white transition cursor-pointer"
                title="Abrir imagen en nueva pestaña"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => setIsPhotoZoomed(false)}
                className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition cursor-pointer ml-1"
                title="Cerrar ampliación (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contenedor central con la foto completa */}
          <div className="relative w-full max-w-4xl flex-1 flex items-center justify-center p-3 overflow-hidden rounded-3xl bg-zinc-950/80 border border-zinc-800 shadow-2xl">
            {!zoomImageError ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                <img
                  src={photoUrl}
                  alt={`Fotografía oficial completa de ${nombre}`}
                  className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-200 select-none border border-zinc-800/80"
                  style={{
                    transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                  }}
                  onError={() => setZoomImageError(true)}
                  draggable={false}
                />
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 max-w-md">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-2xl font-black flex items-center justify-center mx-auto mb-3">
                  {nombre.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-bold text-white mb-1">
                  No se pudo cargar la imagen original
                </p>
                <p className="text-xs text-gray-400">
                  Es posible que el estudiante aún no haya registrado una fotografía en su perfil institucional.
                </p>
              </div>
            )}
          </div>

          {/* Pie con indicaciones */}
          <div className="mt-3 flex items-center justify-between w-full max-w-4xl px-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5 text-[11px] text-gray-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Fotografía oficial completa sin recortes para verificación de identidad y documentos.</span>
            </span>
            <button
              type="button"
              onClick={() => setIsPhotoZoomed(false)}
              className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition cursor-pointer flex-shrink-0 ml-2"
            >
              Cerrar Ampliación
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export default StudentFichaModal;
