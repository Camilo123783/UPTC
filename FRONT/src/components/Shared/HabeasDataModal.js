// ============================================================
// src/components/Shared/HabeasDataModal.js
// Modal obligatorio de Tratamiento de Datos Personales y Habeas Data
// Conforme a la Ley Estatutaria 1581 de 2012 y Decreto 1377 de 2013
// ============================================================
import React, { useState } from "react";
import { ShieldCheck, FileText, CheckCircle2, AlertCircle, Building2, Lock } from "lucide-react";
import { BACKEND_URL } from "../../config/api";

const HabeasDataModal = ({ isOpen, onAccept, userName = "" }) => {
  const [accepted, setAccepted] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setHasScrolledToEnd(true);
    }
  };

  const handleConfirm = async () => {
    if (!accepted) return;
    setLoading(true);
    try {
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");

      await fetch(`${BACKEND_URL}/api/auth/accept-terms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
      }).catch((e) => console.warn("Aviso al guardar términos en backend:", e));
    } catch (err) {
      console.warn("Aviso términos:", err);
    } finally {
      setLoading(false);
      if (onAccept) onAccept();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera del Modal */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 dark:from-blue-900 dark:via-indigo-950 dark:to-zinc-900 p-5 sm:p-6 text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-blue-200" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/25 text-blue-100 border border-blue-400/30 mb-1">
              <Lock className="w-3 h-3" /> Protección de Datos Personales
            </span>
            <h2 className="text-lg sm:text-xl font-bold leading-tight truncate">
              Autorización de Tratamiento y Habeas Data
            </h2>
            <p className="text-xs text-blue-100/90 flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
              Universidad Pedagógica y Tecnológica de Colombia (UPTC)
            </p>
          </div>
        </div>

        {/* Bienvenida personalizada */}
        {userName && (
          <div className="px-6 py-2.5 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200">
            Estimado(a) <strong>{userName}</strong>, para acceder al sistema es requisito legal aceptar los términos de manejo de información.
          </div>
        )}

        {/* Cuerpo del Texto Legal con Scroll */}
        <div
          onScroll={handleScroll}
          className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-gray-700 dark:text-zinc-300 leading-relaxed text-justify max-h-[46vh] border-b border-gray-100 dark:border-zinc-800"
        >
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p>
              En cumplimiento de la <strong>Ley Estatutaria 1581 de 2012</strong> y su <strong>Decreto Reglamentario 1377 de 2013</strong> de la República de Colombia, te informamos sobre el tratamiento que la UPTC da a tus datos personales.
            </p>
          </div>

          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            1. Responsable del Tratamiento
          </h3>
          <p>
            La <strong>Universidad Pedagógica y Tecnológica de Colombia (UPTC)</strong>, institución de educación superior de carácter público, a través de la Facultad de Ciencias de la Salud y los Administradores del Sistema de Gestión de Prácticas Formativas, actuará como Responsable del tratamiento de sus datos personales.
          </p>

          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            2. Finalidad del Tratamiento de Datos
          </h3>
          <p>
            Los datos personales, académicos y de contacto suministrados en esta plataforma serán recolectados, almacenados, procesados y administrados exclusivamente para los siguientes fines institucionales:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Planificación, asignación, seguimiento y evaluación de prácticas y rotaciones formativas clínicas y comunitarias.</li>
            <li>Validación de requisitos normativos y habilitación hospitalaria (soportes EPS, ARL, carnets de vacunación y documentos de identidad).</li>
            <li>Generación y firma digital de actas, constancias de cumplimiento de horas y certificaciones oficiales.</li>
            <li>Contacto directo en situaciones de emergencia médica o administrativa durante el desarrollo de las prácticas.</li>
            <li>Auditoría, control de asistencia y rendición de cuentas ante instituciones de salud y entes de acreditación.</li>
          </ul>

          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            3. Facultades de los Administradores
          </h3>
          <p>
            Al marcar la casilla inferior, usted <strong>autoriza expresamente a los administradores del sistema y coordinadores de práctica</strong> a consultar, cotejar, verificar la autenticidad y gestionar su información y documentos anexos para cumplir con las funciones académicas e institucionales estipuladas.
          </p>

          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            4. Derechos del Titular (Habeas Data)
          </h3>
          <p>
            Usted tiene derecho a conocer, actualizar y rectificar sus datos personales, así como a solicitar prueba de esta autorización o formular consultas mediante el correo institucional del administrador: <strong>enfermeriauptc2026@gmail.com</strong>.
          </p>
        </div>

        {/* Sección de Aceptación con Checkbox Obligatorio */}
        <div className="p-5 sm:p-6 bg-gray-50/80 dark:bg-zinc-900/90 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer flex-shrink-0"
            />
            <span className="text-xs sm:text-sm text-gray-800 dark:text-zinc-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors leading-snug">
              He leído, comprendo y <strong>acepto la Política de Tratamiento de Datos Personales y Habeas Data</strong>. Autorizo de manera previa, libre, expresa e informada a los administradores del sistema a tratar y gestionar mi información para los fines académicos e institucionales descritos.
            </span>
          </label>

          {/* Botón de Confirmación */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-gray-500 dark:text-zinc-400">
              * La aceptación es obligatoria en el primer inicio de sesión para habilitar el uso de la plataforma.
            </span>
            <button
              type="button"
              disabled={!accepted}
              onClick={handleConfirm}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
                accepted
                  ? "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                  : "bg-gray-300 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 cursor-not-allowed border border-gray-300 dark:border-zinc-700"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Aceptar y Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HabeasDataModal;
