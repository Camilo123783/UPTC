// ============================================================
// DocentFichaModal.js — Ficha Integral y Expediente Oficial del Docente
// Permite a auditores, administradores y participantes autorizados
// visualizar la información institucional, datos de contacto,
// firma oficial registrada y soportes documentales (PDF) del docente tutor.
// ============================================================
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  GraduationCap,
  Mail,
  Phone,
  Building,
  Hospital,
  ShieldCheck,
  FileText,
  User,
  CheckCircle2,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Shield,
  Eye,
  Download,
  RotateCw,
  ExternalLink,
  MapPin,
  Users,
  PenTool,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";
import DocentAvatar from "./DocentAvatar";

const DOCENT_DOC_CONFIGS = [
  {
    key: "cvDigital",
    dbColumn: "hoja_vida_digital",
    title: "Hoja de Vida Digital",
    description: "Formato institucional o estandarizado en formato PDF.",
  },
  {
    key: "socialSecurity",
    dbColumn: "seguridad_social_eps",
    title: "Seguridad Social (EPS)",
    description: "Certificado de afiliación vigente a EPS.",
  },
  {
    key: "professionalRisks",
    dbColumn: "riesgos_profesionales_arl",
    title: "Riesgos Laborales (ARL)",
    description: "Certificado de afiliación vigente a Riesgos Laborales ARL.",
  },
  {
    key: "idCopy",
    dbColumn: "copia_documento_identidad",
    title: "Documento de Identidad",
    description: "Copia legible de la cédula de ciudadanía.",
  },
  {
    key: "carnetCopy",
    dbColumn: "copia_carnet_docente",
    title: "Carnet Docente / Institucional",
    description: "Copia legible del carnet vigente de la UPTC.",
  },
  {
    key: "vaccines",
    dbColumn: "carnet_vacunas",
    title: "Carnet de Vacunas",
    description: "Esquema completo según requerimientos de salud.",
  },
];

const DocentFichaModal = ({
  isOpen,
  onClose,
  docent,
  practiceInfo = {},
}) => {
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [details, setDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token")
      : null;

  useEffect(() => {
    if (!isOpen || !docent) {
      setDetails(null);
      return;
    }

    const docentCedula = String(docent.cedula || docent.id || "");
    if (!docentCedula) return;

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    setIsLoadingDetails(true);
    let isCancelled = false;

    fetch(`${BACKEND_URL}/api/docent/details/${docentCedula}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((resData) => {
        if (isCancelled || !resData?.data) return;
        setDetails(resData.data);
      })
      .catch((err) => {
        console.warn("Aviso al consultar detalles del docente:", err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingDetails(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, docent]);

  useEffect(() => {
    if (!isOpen) {
      setIsPhotoZoomed(false);
      setZoomScale(1);
      setRotation(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isPhotoZoomed) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsPhotoZoomed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPhotoZoomed]);

  if (!isOpen || !docent) return null;

  const cedula = String(docent.cedula || docent.id || "");
  const nombre =
    details?.fullName ||
    details?.nombre_completo ||
    docent.fullName ||
    docent.nombre_completo ||
    docent.nombre ||
    `Docente #${cedula}`;
  const carrera = details?.career || docent.programa || docent.programa_nombre || "Facultad de Ciencias de la Salud";
  const correoInst = details?.email || docent.correo || docent.correo_institucional || null;
  const correoPersonal = details?.personalEmail || docent.correo_personal || null;
  const telefono = details?.phone || docent.telefono || null;
  const direccion = details?.address || docent.direccion || null;
  const biografia = details?.bio || docent.biografia || null;
  const especialidad = details?.especialidad || docent.especialidad || null;
  const nombreFamiliar = details?.familyContactName || docent.nombre_familiar || null;
  const telefonoFamiliar = details?.familyContactPhone || docent.telefono_familiar || null;

  const practicaTitulo = docent.practica_titulo || practiceInfo.titulo || null;
  const hospital = docent.institucion_nombre || practiceInfo.institucion_nombre || null;
  const servicio = docent.servicio_nombre || practiceInfo.servicio_nombre || null;

  const photoUrl = `${BACKEND_URL}/api/docent/photo/${cedula}`;
  const hasSignature = details?.has_signature || Boolean(docent.foto_firma || docent.has_signature);

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-200 dark:border-zinc-800 my-8 overflow-hidden transform transition-all flex flex-col">
        {/* Cabecera institucional con degradado morado / índigo */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-950 text-white flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            aria-label="Cerrar ficha"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* Foto de perfil del docente con opción de zoom */}
            <div className="relative group flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setRotation(0);
                  setIsPhotoZoomed(true);
                }}
                className="relative block rounded-full focus:outline-none focus:ring-4 focus:ring-purple-400/50 cursor-pointer transition-transform group-hover:scale-105"
                title="Ampliar fotografía del docente"
              >
                <DocentAvatar
                  cedula={cedula}
                  name={nombre}
                  size="3xl"
                  className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-purple-400 shadow-xl"
                  fallbackBg="bg-purple-950 text-purple-200 text-2xl font-black"
                />
                <span
                  className="absolute bottom-0 right-0 p-1 bg-purple-400 text-slate-950 rounded-full shadow-md z-10"
                  title="Docente UPTC"
                >
                  <GraduationCap className="w-4 h-4" />
                </span>

                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px]">
                  <ZoomIn className="w-6 h-6 text-white drop-shadow-md" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setRotation(0);
                  setIsPhotoZoomed(true);
                }}
                className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-purple-400 hover:bg-purple-300 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md transition flex items-center gap-1 whitespace-nowrap cursor-pointer z-20 border border-purple-500/30"
              >
                <ZoomIn className="w-3 h-3" />
                <span>Ampliar</span>
              </button>
            </div>

            <div className="min-w-0 flex-1 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-400 text-slate-950 font-mono tracking-wider shadow-sm">
                  C.C. {cedula}
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                  Docente Tutor UPTC
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white truncate leading-tight">
                {nombre}
              </h3>
              <p className="text-xs sm:text-sm text-purple-100 font-medium truncate mt-0.5">
                {carrera}
              </p>
            </div>
          </div>
        </div>

        {/* Cuerpo del expediente */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Biografía / Perfil profesional */}
          {biografia && (
            <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40 text-xs text-purple-950 dark:text-purple-200">
              <p className="font-bold text-[11px] uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Perfil Académico y Profesional
              </p>
              <p className="italic leading-relaxed">{biografia}</p>
            </div>
          )}

          {/* Especialidad si existe */}
          {especialidad && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 flex items-center gap-2 text-xs">
              <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-gray-500 dark:text-zinc-400">Especialidad Clínica:</span>
              <span className="font-bold text-gray-900 dark:text-white">{especialidad}</span>
            </div>
          )}

          {/* Información de Contacto */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-2.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-purple-500" />
              Canales de Contacto y Residencia
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-gray-500 dark:text-zinc-400">Correo Institucional</span>
                  <a href={`mailto:${correoInst}`} className="font-semibold text-gray-900 dark:text-white truncate block hover:underline">
                    {correoInst || "No registrado"}
                  </a>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-gray-500 dark:text-zinc-400">Teléfono / Celular</span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate block">
                    {telefono || "No registrado"}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-gray-500 dark:text-zinc-400">Correo Personal</span>
                  {correoPersonal ? (
                    <a href={`mailto:${correoPersonal}`} className="font-semibold text-gray-900 dark:text-white truncate block hover:underline">
                      {correoPersonal}
                    </a>
                  ) : (
                    <span className="font-semibold text-gray-900 dark:text-white truncate block">No registrado</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-gray-500 dark:text-zinc-400">Dirección Residencial</span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate block" title={direccion || ""}>
                    {direccion || "No registrada"}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 flex items-center gap-2.5">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-gray-500 dark:text-zinc-400">Contacto de Emergencia / Familiar</span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate block">
                    {nombreFamiliar || "No registrado"}
                    {telefonoFamiliar ? ` · Tel: ${telefonoFamiliar}` : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contexto de la práctica si está disponible */}
          {(practicaTitulo || hospital) && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-2.5 flex items-center gap-1.5">
                <Hospital className="w-3.5 h-3.5 text-purple-500" />
                Rotación Clínica Asignada
              </h4>
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 space-y-2 text-xs">
                {practicaTitulo && (
                  <div className="flex items-center justify-between py-1 border-b border-gray-200/60 dark:border-zinc-700/60">
                    <span className="text-gray-500 dark:text-zinc-400">Práctica:</span>
                    <span className="font-bold text-gray-900 dark:text-white text-right truncate ml-2">
                      {practicaTitulo}
                    </span>
                  </div>
                )}
                {hospital && (
                  <div className="flex items-center justify-between py-1 border-b border-gray-200/60 dark:border-zinc-700/60">
                    <span className="text-gray-500 dark:text-zinc-400">Institución / Hospital:</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-right truncate ml-2">
                      {hospital}
                    </span>
                  </div>
                )}
                {servicio && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500 dark:text-zinc-400">Servicio Clínico:</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-right truncate ml-2">
                      {servicio}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estado de Firma Digital Oficial */}
          <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Firma Digital Oficial</p>
                <p className="text-gray-500 dark:text-zinc-400 text-[11px]">
                  {hasSignature
                    ? "Registrada y autorizada para avalar rotaciones y certificados"
                    : "Pendiente por registrar"}
                </p>
              </div>
            </div>
            {hasSignature ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> Registrada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <AlertCircle className="w-3.5 h-3.5" /> Sin firma
              </span>
            )}
          </div>

          {/* Soportes Documentales (PDF) del Docente */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-500" />
                Soportes Documentales Oficiales (PDF)
              </h4>
            </div>

            <div className="space-y-2">
              {DOCENT_DOC_CONFIGS.map((doc) => {
                const isLoaded = Boolean(details && details[doc.key]);
                const viewUrl = `${BACKEND_URL}/api/docent/view/${cedula}/${doc.dbColumn}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
                const downloadUrl = `${BACKEND_URL}/api/docent/download/${cedula}/${doc.dbColumn}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

                return (
                  <div
                    key={doc.key}
                    className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`p-1.5 rounded-lg shrink-0 ${isLoaded ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-gray-200 text-gray-400 dark:bg-zinc-700 dark:text-zinc-500"}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 dark:text-white truncate">{doc.title}</p>
                        <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">{doc.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isLoaded ? (
                        <>
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:hover:bg-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </a>
                          <a
                            href={downloadUrl}
                            download
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 transition shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500 px-2 py-1 rounded bg-gray-100 dark:bg-zinc-800">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="p-4 bg-gray-50 dark:bg-zinc-800/80 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-white transition cursor-pointer"
          >
            Cerrar Expediente
          </button>
        </div>
      </div>

      {/* Lightbox para ampliar fotografía */}
      {isPhotoZoomed && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
        >
          <div className="relative max-w-lg w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => setIsPhotoZoomed(false)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="overflow-hidden rounded-3xl border-4 border-purple-400 shadow-2xl bg-zinc-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={photoUrl}
                alt={nombre}
                style={{
                  transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease-out",
                }}
                className="max-w-full max-h-[70vh] object-contain select-none"
              />
            </div>

            <div className="flex items-center gap-3 mt-4 bg-zinc-900/90 text-white px-4 py-2 rounded-full border border-zinc-700 shadow-xl text-xs">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.25))}
                className="p-1 hover:text-purple-400 transition"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px]">{Math.round(zoomScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(3, s + 0.25))}
                className="p-1 hover:text-purple-400 transition"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-zinc-600">|</span>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1 hover:text-purple-400 transition"
                title="Girar"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export default DocentFichaModal;

