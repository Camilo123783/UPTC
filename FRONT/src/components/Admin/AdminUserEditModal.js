import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Edit3, X, RefreshCw, FileText, Key, Eye, EyeOff, Sparkles } from "lucide-react";
import { BACKEND_URL } from "../../config/api";

const API_BASE_URL = BACKEND_URL;

const AdminUserEditModal = ({
  user,
  programas = [],
  instituciones = [],
  onClose,
  onSave,
  userRole: propUserRole,
}) => {
  const currentRole =
    propUserRole ||
    localStorage.getItem("userRole") ||
    sessionStorage.getItem("userRole") ||
    "";

  const [formData, setFormData] = useState({
    cedula: user?.Cédula || user?.cedula || "",
    nombre: user?.Nombre || user?.nombre || "",
    apellidos: user?.Apellidos || user?.apellidos || "",
    correo_institucional:
      user?.Correo_Institucional || user?.correo_institucional || "",
    rol: (user?.Rol || user?.rol || "").toLowerCase(),
    activo:
      user?.Activo !== undefined && user?.Activo !== null
        ? Number(user.Activo) === 1
        : user?.activo !== undefined
        ? !!user.activo
        : true,
    programa_id: user?.programa_id != null ? String(user.programa_id) : "",
    institucion_id: user?.institucion_id != null ? String(user.institucion_id) : "",
    biografia: user?.biografia || "",
    codigo: user?.codigo || "",
    direccion: user?.direccion || "",
    telefono: user?.telefono || "",
    correo_personal: user?.correo_personal || "",
    nombre_familiar: user?.nombre_familiar || "",
    telefono_familiar: user?.telefono_familiar || "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para Restablecimiento Administrativo de Contraseña
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPasswordForUser, setNewPasswordForUser] = useState("");
  const [showNewPasswordForUser, setShowNewPasswordForUser] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    const cedulaToFetch = user?.Cédula || user?.cedula;
    if (!cedulaToFetch) return;

    const fetchFullDetails = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("authToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const roleHint = encodeURIComponent((user?.Rol || user?.rol || "").toLowerCase());
        const res = await fetch(
          `${API_BASE_URL}/api/admin/users/${encodeURIComponent(cedulaToFetch)}?rol=${roleHint}`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setFormData((prev) => ({
              ...prev,
              ...data.user,
              cedula: data.user.cedula || prev.cedula,
              nombre: data.user.nombre || prev.nombre,
              apellidos: data.user.apellidos || prev.apellidos,
              correo_institucional:
                data.user.correo_institucional || prev.correo_institucional,
              activo:
                data.user.activo !== undefined && data.user.activo !== null
                  ? Number(data.user.activo) === 1
                  : prev.activo,
              programa_id:
                data.user.programa_id != null
                  ? String(data.user.programa_id)
                  : prev.programa_id,
              institucion_id:
                data.user.institucion_id != null
                  ? String(data.user.institucion_id)
                  : prev.institucion_id,
              biografia: data.user.biografia || prev.biografia,
              codigo: data.user.codigo || prev.codigo,
              direccion: data.user.direccion || prev.direccion,
              telefono: data.user.telefono || prev.telefono,
              correo_personal: data.user.correo_personal || prev.correo_personal,
              nombre_familiar: data.user.nombre_familiar || prev.nombre_familiar,
              telefono_familiar: data.user.telefono_familiar || prev.telefono_familiar,
            }));
          }
        }
      } catch (err) {
        console.error("Error al cargar detalles completos del usuario:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFullDetails();
  }, [user]);

  const handleNumericKeyDown = (e) => {
    const allowedKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];

    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
      return;
    }

    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (["codigo", "telefono", "telefono_familiar"].includes(name)) {
      setFormData((prev) => ({ ...prev, [name]: value.replace(/\D/g, "") }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isStudent && formData.codigo && !/^\d+$/.test(String(formData.codigo).trim())) {
      toast.error("El código estudiantil solo debe contener números.");
      return;
    }
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
  };

  const handleAdminResetPassword = async () => {
    if (!newPasswordForUser || newPasswordForUser.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setIsResettingPassword(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          cedula: formData.cedula,
          newPassword: newPasswordForUser,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success(
          `Contraseña de ${formData.nombre || "usuario"} actualizada con éxito.`
        );
        setNewPasswordForUser("");
        setResetPasswordOpen(false);
      } else {
        toast.error(data.message || "Error al actualizar la contraseña.");
      }
    } catch (err) {
      console.error("Error al restablecer contraseña:", err);
      toast.error(`Error de red: ${err.message}`);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const isStudent = ["student", "estudiante"].includes(formData.rol);
  const isDocent = ["docent", "docente"].includes(formData.rol);
  const isAuditor = ["auditor"].includes(formData.rol);

  const getRoleLabel = (role) => {
    const r = String(role || "").toLowerCase();
    if (r === "student" || r === "estudiante") return "Estudiante";
    if (r === "docent" || r === "docente") return "Docente";
    if (r === "auditor") return "Auditor";
    if (r === "superadmin") return "Super Admin";
    if (r === "admin" || r === "administrador") return "Administrador";
    return role || "N/A";
  };

  const inputClass =
    "border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 p-2.5 rounded-xl w-full focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all";

  const modalContent = (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[99999] overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-7 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-gray-100 dark:border-zinc-800 transition-colors">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Editar Usuario</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              Cédula: <span className="font-semibold text-gray-700 dark:text-zinc-200">{formData.cedula}</span> | Rol:{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">{getRoleLabel(formData.rol)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 p-2 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-blue-600 dark:text-blue-400 font-semibold animate-pulse flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" /> Cargando información del usuario...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* --- DATOS BÁSICOS --- */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                Datos Básicos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Cédula (No editable)
                  </label>
                  <input
                    type="text"
                    value={formData.cedula}
                    disabled
                    className="border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800/40 text-gray-500 dark:text-zinc-400 p-2.5 rounded-xl w-full cursor-not-allowed text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    name="apellidos"
                    value={formData.apellidos}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Correo Institucional
                  </label>
                  <input
                    type="email"
                    name="correo_institucional"
                    value={formData.correo_institucional}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* --- CONTROL DE ESTADO (ACTIVO / DESACTIVADO) --- */}
              <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-700/80 bg-gray-50/70 dark:bg-zinc-800/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-200">
                      Estado de la Cuenta
                    </label>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {formData.rol === "superadmin"
                        ? "El superadministrador siempre permanece activo en la plataforma."
                        : (formData.rol === "admin" || formData.rol === "administrador") && currentRole !== "superadmin"
                        ? "Solo un superadministrador puede activar o desactivar cuentas de administradores."
                        : "Si el usuario está desactivado, el sistema impedirá su ingreso mostrando el correo del administrador."}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {formData.rol === "superadmin" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Siempre activo
                      </span>
                    ) : (formData.rol === "admin" || formData.rol === "administrador") && currentRole !== "superadmin" ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-2xs ${
                          formData.activo
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${formData.activo ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {formData.activo ? "Activo" : "Desactivado"}
                      </span>
                    ) : (
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!formData.activo}
                          onChange={(e) => setFormData((prev) => ({ ...prev, activo: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-emerald-600"></div>
                        <span className="ml-2.5 text-xs font-bold text-gray-800 dark:text-zinc-200">
                          {formData.activo ? "Activo" : "Desactivado"}
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* --- ASIGNACIÓN DE PROGRAMA / INSTITUCIÓN --- */}
            {(isStudent || isDocent || isAuditor) && (
              <div>
                <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                  Vinculación Académica / Institucional
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(isStudent || isDocent) && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                        Programa Académico
                      </label>
                      <select
                        name="programa_id"
                        value={formData.programa_id != null ? String(formData.programa_id) : ""}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="">Seleccionar Programa...</option>
                        {programas.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.nombreprograma}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isAuditor && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                        Institución Asociada
                      </label>
                      <select
                        name="institucion_id"
                        value={formData.institucion_id != null ? String(formData.institucion_id) : ""}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="">Seleccionar Institución...</option>
                        {instituciones.map((i) => (
                          <option key={i.id} value={String(i.id)}>
                            {i.nombreinstitucion}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- DATOS ADICIONALES (Estudiantes) --- */}
            {isStudent && (
              <div>
                <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Datos Adicionales del Estudiante</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                      Código Estudiantil
                    </label>
                    <input
                      type="text"
                      name="codigo"
                      value={formData.codigo || ""}
                      onChange={handleChange}
                      onKeyDown={handleNumericKeyDown}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Ej: 202110293 (Solo números)"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                      Teléfono / Celular
                    </label>
                    <input
                      type="text"
                      name="telefono"
                      value={formData.telefono || ""}
                      onChange={handleChange}
                      onKeyDown={handleNumericKeyDown}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Ej: 3101234567"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                      Correo Personal
                    </label>
                    <input
                      type="email"
                      name="correo_personal"
                      value={formData.correo_personal || ""}
                      onChange={handleChange}
                      placeholder="correo@gmail.com"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                      Dirección Residencial
                    </label>
                    <input
                      type="text"
                      name="direccion"
                      value={formData.direccion || ""}
                      onChange={handleChange}
                      placeholder="Calle 12 # 34 - 56"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                      Contacto de Emergencia (Familiar)
                    </label>
                    <input
                      type="text"
                      name="nombre_familiar"
                      value={formData.nombre_familiar || ""}
                      onChange={handleChange}
                      placeholder="Nombre del familiar"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                      Teléfono de Emergencia
                    </label>
                    <input
                      type="text"
                      name="telefono_familiar"
                      value={formData.telefono_familiar || ""}
                      onChange={handleChange}
                      onKeyDown={handleNumericKeyDown}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Teléfono del familiar"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Biografía / Perfil
                  </label>
                  <textarea
                    name="biografia"
                    rows="2"
                    value={formData.biografia || ""}
                    onChange={handleChange}
                    placeholder="Descripción o perfil del estudiante..."
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            )}

            {/* --- SECCIÓN ADMINISTRATIVA: RESTABLECER CONTRASEÑA --- */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                      Restablecer Contraseña del Usuario
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      Asigna una nueva clave sin requerir la contraseña anterior.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResetPasswordOpen(!resetPasswordOpen)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  {resetPasswordOpen ? "Ocultar" : "Cambiar Clave"}
                </button>
              </div>

              {resetPasswordOpen && (
                <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-800/30 space-y-3 animate-in fade-in duration-200">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showNewPasswordForUser ? "text" : "password"}
                        value={newPasswordForUser}
                        onChange={(e) => setNewPasswordForUser(e.target.value)}
                        placeholder="Nueva contraseña temporal (ej: Uptc2024*)"
                        className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPasswordForUser(!showNewPasswordForUser)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-400 p-1 text-sm cursor-pointer"
                        title={showNewPasswordForUser ? "Ocultar" : "Mostrar"}
                      >
                        {showNewPasswordForUser ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const randomPass =
                          "Uptc" + Math.floor(1000 + Math.random() * 9000) + "*";
                        setNewPasswordForUser(randomPass);
                        setShowNewPasswordForUser(true);
                      }}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 whitespace-nowrap cursor-pointer transition shadow-sm flex items-center gap-1.5"
                      title="Generar clave aleatoria segura"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generar</span>
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!newPasswordForUser || isResettingPassword}
                      onClick={handleAdminResetPassword}
                      className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 transition shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      {isResettingPassword ? "Aplicando..." : "Aplicar Nueva Clave"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* --- BOTONES DE ACCIÓN --- */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 border-t border-gray-100 dark:border-zinc-800 pt-5 sm:pt-6">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-6 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 transition-colors cursor-pointer text-center"
              >
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export default AdminUserEditModal;
