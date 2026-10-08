import React from "react";
import {
  Crown,
  Briefcase,
  GraduationCap,
  UserCheck,
  Search,
  Shield,
  Users,
  BookOpen,
  Building2,
  Pill,
  Wrench,
  FileText,
  ArrowLeft,
  FileSpreadsheet,
} from "lucide-react";

// ─── Utilidad para renderizar iconos de Lucide (forwardRef) o elementos JSX de forma segura ───
const renderSafeIcon = (IconCmp, className = "") => {
  if (!IconCmp) return null;
  if (React.isValidElement(IconCmp)) return IconCmp;
  if (typeof IconCmp === "function" || (typeof IconCmp === "object" && IconCmp.$$typeof)) {
    return React.createElement(IconCmp, { className });
  }
  return null;
};

export const SUPERADMIN_ROLES = [
  {
    value: "superadmin",
    label: "Super Admin",
    color: "bg-gradient-to-r from-amber-600 to-amber-700",
    icon: Crown,
  },
  {
    value: "admin",
    label: "Administrador",
    color: "bg-gradient-to-r from-purple-700 to-indigo-700",
    icon: Briefcase,
  },
];

export const ADMIN_ROLES = [
  {
    value: "estudiante",
    label: "Estudiante",
    color: "bg-gradient-to-r from-violet-600 to-purple-600",
    icon: GraduationCap,
  },
  {
    value: "docente",
    label: "Docente",
    color: "bg-gradient-to-r from-emerald-600 to-teal-600",
    icon: UserCheck,
  },
  {
    value: "auditor",
    label: "Auditor",
    color: "bg-gradient-to-r from-blue-600 to-cyan-600",
    icon: Search,
  },
  {
    value: "admin",
    label: "Administrador",
    color: "bg-gradient-to-r from-purple-700 to-indigo-700",
    icon: Shield,
  },
];

export const SUPERADMIN_CREATION_CARDS = [
  { value: "user", label: "Crear Usuario", icon: Users, color: "bg-blue-600 hover:bg-blue-700" },
];

export const DEFAULT_ROLES = SUPERADMIN_ROLES;

export const DEFAULT_CREATION_CARDS = [
  { value: "user", label: "Crear Usuario", icon: Users, color: "bg-blue-600 hover:bg-blue-700" },
  {
    value: "programa",
    label: "Crear Programa",
    icon: GraduationCap,
    color: "bg-emerald-600 hover:bg-emerald-700",
  },
  {
    value: "asignatura",
    label: "Crear Asignatura",
    icon: BookOpen,
    color: "bg-purple-600 hover:bg-purple-700",
  },
  {
    value: "institucion_servicio",
    label: "Instituciones / Servicios",
    icon: Building2,
    color: "bg-cyan-600 hover:bg-cyan-700",
  },
];

export const UserCreationSection = ({
  newEntity,
  setNewEntity,
  handleTypeChange,
  handleInputChange,
  handleAddEntity,
  goBackStep,
  isCreating,
  setIsCsvModalOpen,
  programas = [],
  instituciones = [],
  roles = DEFAULT_ROLES,
  creationCards = DEFAULT_CREATION_CARDS,
}) => {
  const renderRoleButtons = () => (
    <div
      className={`grid grid-cols-1 ${
        roles.length === 2
          ? "sm:grid-cols-2 max-w-xl mx-auto"
          : "sm:grid-cols-2 lg:grid-cols-4"
      } gap-4 mb-6`}
    >
      {roles.map((role) => {
        const Icon = role.icon;
        return (
          <button
            key={role.value}
            type="button"
            onClick={() => setNewEntity({ ...newEntity, role: role.value })}
            className={`p-5 rounded-2xl shadow-md text-white font-semibold ${
              role.color
            } hover:scale-105 transition-all flex flex-col items-center justify-center min-h-[100px] border border-white/10 ${
              newEntity.role === role.value ? "ring-4 ring-blue-400 scale-105" : ""
            }`}
          >
            <div className="mb-2">
              {renderSafeIcon(Icon, "w-8 h-8")}
            </div>
            <div className="text-lg font-bold text-center">{role.label}</div>
          </button>
        );
      })}
    </div>
  );

  const inputClass =
    "border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 p-3 rounded-xl w-full text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm";

  const handleNumericKeyDown = (e) => {
    // Permitir teclas de control y navegación
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

    // Bloquear cualquier carácter que no sea un número del 0 al 9
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleNumericPaste = (e) => {
    e.preventDefault();
    const pasteData = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    const numericData = pasteData.replace(/\D/g, "");
    if (!numericData) return;

    const target = e.target;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const current = newEntity[target.name] || "";
    const updated = (current.slice(0, start) + numericData + current.slice(end)).replace(/\D/g, "");

    handleInputChange({
      target: {
        name: target.name,
        value: updated,
      },
    });
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    if (name === "cedula" || name === "codigo") {
      const numericValue = value.replace(/\D/g, "");
      handleInputChange({
        ...e,
        target: {
          ...e.target,
          name,
          value: numericValue,
        },
      });
      return;
    }
    handleInputChange(e);
  };

  const renderInputs = () => {
    const input = (name, placeholder, type = "text") => {
      const isNumeric = name === "cedula" || name === "codigo";
      return (
        <input
          type={type}
          name={name}
          placeholder={isNumeric ? `${placeholder} (Solo números)` : placeholder}
          value={newEntity[name] || ""}
          onChange={handleFieldChange}
          onKeyDown={isNumeric ? handleNumericKeyDown : undefined}
          onPaste={isNumeric ? handleNumericPaste : undefined}
          inputMode={isNumeric ? "numeric" : undefined}
          pattern={isNumeric ? "[0-9]*" : undefined}
          title={isNumeric ? "Solo se permiten números (sin letras ni caracteres especiales)" : undefined}
          className={inputClass}
        />
      );
    };

    if (newEntity.type === "user") {
      if (!newEntity.role) return renderRoleButtons();
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("cedula", "Cédula")}
          {newEntity.role === "estudiante" && input("codigo", "Código Estudiantil")}
          {input("nombre", "Nombre")}
          {input("apellidos", "Apellidos")}
          {input("correo", "Correo Institucional", "email")}
          {input("password", "Contraseña", "password")}

          {/* Select de Programa - Común para varios roles */}
          {["docente", "estudiante"].includes(newEntity.role) && (
            <select
              name="programaId"
              value={newEntity.programaId || ""}
              onChange={handleInputChange}
              className={inputClass}
            >
              <option value="">Seleccionar Programa...</option>
              {programas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreprograma}
                </option>
              ))}
            </select>
          )}

          {/* Select de Institución - Solo para Auditor */}
          {newEntity.role === "auditor" && (
            <select
              name="institucionId"
              value={newEntity.institucionId || ""}
              onChange={handleInputChange}
              className={inputClass}
            >
              <option value="">Seleccionar Institución...</option>
              {instituciones.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombreinstitucion}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }

    if (newEntity.type === "programa") {
      return input("nombrePrograma", "Nombre del Programa");
    }

    if (newEntity.type === "asignatura") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input("codigoAsignatura", "Código")}
          {input("nombreAsignatura", "Nombre")}
          <select
            name="programaId"
            value={newEntity.programaId || ""}
            onChange={handleInputChange}
            className={inputClass}
          >
            <option value="">Programa Asociado...</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombreprograma}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (newEntity.type === "institucion_servicio") {
      if (!newEntity.subType) {
        return (
          <div className="flex flex-col sm:flex-row gap-6 justify-center my-6">
            <button
              type="button"
              onClick={() =>
                setNewEntity({ ...newEntity, subType: "institucion" })
              }
              className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-10 py-6 rounded-2xl font-bold text-xl hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3 border border-white/10"
            >
              <Building2 className="w-8 h-8" /> Crear Institución
            </button>
            <button
              type="button"
              onClick={() =>
                setNewEntity({ ...newEntity, subType: "servicio" })
              }
              className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white px-10 py-6 rounded-2xl font-bold text-xl hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3 border border-white/10"
            >
              <Pill className="w-8 h-8" /> Crear Servicio
            </button>
          </div>
        );
      }
      if (newEntity.subType === "institucion") {
        return input("nombreInstitucion", "Nombre de la Institución");
      }
      if (newEntity.subType === "servicio") {
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {input("nombreServicio", "Nombre del Servicio")}
            <select
              name="institucionId"
              value={newEntity.institucionId || ""}
              onChange={handleInputChange}
              className={inputClass}
            >
              <option value="">Seleccionar Institución...</option>
              {instituciones.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombreinstitucion}
                </option>
              ))}
            </select>
          </div>
        );
      }
    }

    return null;
  };

  const getHeaderTitle = () => {
    if (!newEntity.type) {
      return creationCards.length === 1
        ? "Panel de Gestión de Administradores"
        : "Panel de Gestión Administrativa";
    }
    if (newEntity.type === "user") {
      if (!newEntity.role) return "NUEVO USUARIO (SELECCIONAR ROL)";
      return `NUEVO USUARIO: ${newEntity.role.toUpperCase()}`;
    }
    if (newEntity.type === "programa") return "NUEVO PROGRAMA";
    if (newEntity.type === "asignatura") return "NUEVA ASIGNATURA";
    if (newEntity.type === "institucion_servicio") {
      if (newEntity.subType === "institucion") return "NUEVA INSTITUCIÓN";
      if (newEntity.subType === "servicio") return "NUEVO SERVICIO";
      return "NUEVA INSTITUCIÓN / SERVICIO";
    }
    return "Panel de Creación";
  };

  return (
    <div className="mb-10 p-6 sm:p-8 border border-gray-100 dark:border-zinc-800 rounded-3xl shadow-2xl bg-white dark:bg-zinc-900 transition-colors">
      <h2 className="text-2xl sm:text-3xl font-extrabold mb-8 text-gray-900 dark:text-white text-center tracking-tight flex items-center justify-center gap-2">
        <Wrench className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        {getHeaderTitle()}
      </h2>

      {/* --- LÍNEA HORIZONTAL DE BOTONES --- */}
      {!newEntity.type && (
        <div
          className={`grid grid-cols-1 ${
            creationCards.length === 1
              ? "max-w-sm mx-auto"
              : "sm:grid-cols-2 lg:grid-cols-4"
          } gap-4`}
        >
          {creationCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => handleTypeChange(card.value)}
                className={`${card.color} text-white p-5 rounded-2xl font-bold text-base hover:scale-[1.03] transition-all shadow-md flex flex-col items-center justify-center min-h-[100px] border border-white/10`}
              >
                <span className="mb-2">
                  {renderSafeIcon(Icon, "w-8 h-8")}
                </span>
                <span className="text-center leading-tight">{card.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* --- Formulario Dinámico --- */}
      {newEntity.type && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddEntity();
          }}
          className="mt-4 space-y-6 animate-in fade-in duration-300"
        >
          {renderInputs()}

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={goBackStep}
              className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" /> Volver
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="bg-blue-900 hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-800 text-white px-10 py-3 rounded-xl font-bold text-base sm:text-lg shadow-lg disabled:opacity-50 transition-all cursor-pointer active:scale-95"
            >
              {isCreating
                ? "Procesando..."
                : newEntity.type === "user"
                ? "CREAR USUARIO"
                : "CREAR REGISTRO"}
            </button>
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold text-base shadow-lg transition-all hover:scale-[1.02] flex items-center gap-2 cursor-pointer border border-emerald-500/30 active:scale-95"
              title="Cargar archivo CSV de Excel para creación masiva"
            >
              <FileSpreadsheet className="w-5 h-5" /> Cargar CSV / Excel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
export default UserCreationSection;
