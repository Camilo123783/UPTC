import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import {
  FileSpreadsheet,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  X,
  Upload
} from "lucide-react";
import { BACKEND_URL } from "../../config/api";

const ENTITY_LABELS = {
  user: "Usuarios",
  programa: "Programas Académicos",
  asignatura: "Asignaturas",
  institucion: "Instituciones",
  servicio: "Servicios de Práctica",
};

const ROLE_LABELS = {
  admin: "Administrador",
  superadmin: "Super Admin",
  estudiante: "Estudiante",
  docente: "Docente",
  auditor: "Auditor",
};

const EXPECTED_HEADERS_BY_TYPE = {
  user_admin: ["cedula", "nombre", "apellidos", "correo_institucional", "password"],
  user_superadmin: ["cedula", "nombre", "apellidos", "correo_institucional", "password"],
  user_estudiante: ["cedula", "nombre", "apellidos", "correo_institucional", "password", "programa"],
  user_docente: ["cedula", "nombre", "apellidos", "correo_institucional", "password", "programa"],
  user_auditor: ["cedula", "nombre", "apellidos", "correo_institucional", "password", "institucion"],
  programa: ["nombreprograma"],
  asignatura: ["codigoasignatura", "nombreasignatura", "programa"],
  institucion: ["nombreinstitucion"],
  servicio: ["nombreservicio", "institucion"],
};

const AdminCsvImportModal = ({
  isOpen,
  onClose,
  initialEntityType = "user",
  initialRole = "",
  programas = [],
  instituciones = [],
  onSuccess,
  userRole,
}) => {
  const [entityType, setEntityType] = useState(initialEntityType);
  const [role, setRole] = useState(initialRole || (userRole === "superadmin" ? "admin" : "estudiante"));
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setEntityType(initialEntityType || "user");
      setRole(initialRole || "estudiante");
      setFile(null);
      setParsedData([]);
      setHeaders([]);
      setImportResult(null);
    }
  }, [isOpen, initialEntityType, initialRole]);

  if (!isOpen) return null;

  const currentKey = entityType === "user" ? `user_${role}` : entityType;
  const defaultHeaders = EXPECTED_HEADERS_BY_TYPE[currentKey] || ["cedula", "nombre", "apellidos"];

  // ──────────────────────────────────────────────
  // Normalizador de llaves y desempaquetador inteligente
  // ──────────────────────────────────────────────
  const normalizeKey = (k) => {
    if (!k) return "";
    let clean = String(k).trim().toLowerCase();
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quitar tildes
    if (["cedula", "identificacion", "documento"].includes(clean)) return "cedula";
    if (clean === "nombre") return "nombre";
    if (["apellidos", "apellido"].includes(clean)) return "apellidos";
    if (["correo", "correo_institucional", "email", "correo electronico"].includes(clean)) return "correo_institucional";
    if (["password", "contrasena", "clave"].includes(clean)) return "password";
    if (["programa", "carrera", "programa_academico", "programa_id"].includes(clean)) return "programa";
    if (["institucion", "institucion_id"].includes(clean)) return "institucion";
    if (["servicio", "nombreservicio", "nombre_servicio"].includes(clean)) return "nombreservicio";
    if (["codigo", "codigoasignatura", "codigo_asignatura"].includes(clean)) return "codigoasignatura";
    if (["nombreasignatura", "nombre_asignatura"].includes(clean)) return "nombreasignatura";
    if (["nombreinstitucion", "nombre_institucion"].includes(clean)) return "nombreinstitucion";
    if (["nombreprograma", "nombre_programa"].includes(clean)) return "nombreprograma";
    return clean;
  };

  const unpackRowIfNeeded = (rawRow, targetHeaders) => {
    // Normalizar nombres de columnas existentes
    const normalized = {};
    for (const [key, val] of Object.entries(rawRow)) {
      normalized[normalizeKey(key)] = typeof val === "string" ? val.trim() : val;
    }

    // Verificar si los campos clave ya están separados correctamente
    if (entityType === "user" && normalized.cedula && normalized.nombre && normalized.apellidos) {
      if (!String(normalized.cedula).includes(",") && !String(normalized.cedula).includes(";")) {
        return normalized;
      }
    }

    // Si Excel agrupó toda la línea en una sola celda (ej. cedula o columna 1)
    const values = Object.values(rawRow).filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    const bundledCandidate = values.find((v) => {
      const str = String(v);
      return (str.includes(",") || str.includes(";")) && str.length > 10;
    });

    if (bundledCandidate) {
      const parsed = Papa.parse(String(bundledCandidate).trim(), { skipEmptyLines: true });
      if (parsed.data && parsed.data[0] && parsed.data[0].length > 1) {
        const parts = parsed.data[0].map((p) => (typeof p === "string" ? p.replace(/^"|"$/g, "").trim() : p));
        const unpacked = {};
        targetHeaders.forEach((headerName, idx) => {
          if (parts[idx] !== undefined) {
            unpacked[headerName] = parts[idx];
          }
        });
        const res = unpacked;
        if (entityType === "user") {
          if (res.cedula) res.cedula = String(res.cedula).replace(/\D/g, "");
          if (res.codigo) res.codigo = String(res.codigo).replace(/\D/g, "");
        }
        return res;
      }
    }

    if (entityType === "user") {
      if (normalized.cedula) normalized.cedula = String(normalized.cedula).replace(/\D/g, "");
      if (normalized.codigo) normalized.codigo = String(normalized.codigo).replace(/\D/g, "");
    }
    return normalized;
  };

  // ──────────────────────────────────────────────
  // Generador de plantillas (Excel .xlsx y CSV .csv)
  // ──────────────────────────────────────────────
  const getTemplateData = () => {
    const sampleProgram = programas[0]?.nombreprograma || "Ingeniería de Sistemas";
    const sampleInst = instituciones[0]?.nombreinstitucion || "Hospital San Rafael";

    let headersList = [];
    let sampleRows = [];

    if (entityType === "user") {
      if (role === "estudiante") {
        headersList = ["cedula", "nombre", "apellidos", "correo_institucional", "password", "programa"];
        sampleRows = [
          ["1002345678", "Carlos Andrés", "Pérez Gómez", "carlos.perez@uptc.edu.co", "123456", sampleProgram],
          ["1003456789", "Laura Sofia", "Mendoza Vega", "laura.mendoza@uptc.edu.co", "123456", sampleProgram],
        ];
      } else if (role === "docente") {
        headersList = ["cedula", "nombre", "apellidos", "correo_institucional", "password", "programa"];
        sampleRows = [
          ["1098765432", "María Fernanda", "Rodríguez Silva", "maria.rodriguez@uptc.edu.co", "123456", sampleProgram],
          ["1087654321", "Jorge Alberto", "Martínez Díaz", "jorge.martinez@uptc.edu.co", "123456", sampleProgram],
        ];
      } else if (role === "auditor") {
        headersList = ["cedula", "nombre", "apellidos", "correo_institucional", "password", "institucion"];
        sampleRows = [
          ["1011223344", "Pedro José", "González Morales", "pedro.gonzalez@hospital.com", "123456", sampleInst],
          ["1022334455", "Diana Marcela", "Castillo Ruiz", "diana.castillo@salud.gov.co", "123456", sampleInst],
        ];
      } else if (role === "admin") {
        headersList = ["cedula", "nombre", "apellidos", "correo_institucional", "password"];
        sampleRows = [
          ["1099887766", "Carlos Alberto", "Pérez Ramos", "carlos.perez@uptc.edu.co", "123456"],
          ["1088776655", "Elena Patricia", "Díaz Castro", "elena.diaz@uptc.edu.co", "123456"],
        ];
      } else if (role === "superadmin") {
        headersList = ["cedula", "nombre", "apellidos", "correo_institucional", "password"];
        sampleRows = [
          ["1099887766", "Ana Milena", "Gómez López", "ana.gomez@uptc.edu.co", "123456"],
          ["1088776655", "Felipe Andrés", "Vargas Torres", "felipe.vargas@uptc.edu.co", "123456"],
        ];
      }
    } else if (entityType === "programa") {
      headersList = ["nombreprograma"];
      sampleRows = [["Ingeniería Electrónica"], ["Licenciatura en Matemáticas"], ["Medicina"]];
    } else if (entityType === "asignatura") {
      headersList = ["codigoasignatura", "nombreasignatura", "programa"];
      sampleRows = [
        ["SIS-301", "Bases de Datos I", sampleProgram],
        ["SIS-302", "Ingeniería de Software II", sampleProgram],
      ];
    } else if (entityType === "institucion") {
      headersList = ["nombreinstitucion"];
      sampleRows = [["Clínica de los Andes"], ["Hospital Regional de Duitama"], ["E.S.E. Santiago de Tunja"]];
    } else if (entityType === "servicio") {
      headersList = ["nombreservicio", "institucion"];
      sampleRows = [
        ["Urgencias Pediátricas", sampleInst],
        ["Consulta Externa", sampleInst],
        ["Hospitalización General", sampleInst],
      ];
    }

    return { headersList, sampleRows };
  };

  // Descargar Plantilla en formato Excel (.xlsx) nativo
  const handleDownloadExcel = () => {
    const { headersList, sampleRows } = getTemplateData();
    const dataWithHeaders = [headersList, ...sampleRows];

    const ws = XLSX.utils.aoa_to_sheet(dataWithHeaders);
    // Ajustar ancho de columnas automáticamente
    ws["!cols"] = headersList.map((h) => ({ wch: Math.max(h.length + 5, 20) }));

    const wb = XLSX.utils.book_new();
    const sheetName = entityType === "user" ? ROLE_LABELS[role] || "Usuarios" : ENTITY_LABELS[entityType] || "Datos";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = `plantilla_${entityType}${entityType === "user" ? `_${role}` : ""}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.info("Plantilla Excel (.xlsx) descargada con columnas listas.");
  };

  // Descargar Plantilla en CSV con separador punto y coma (;) para Excel en Español
  const handleDownloadCsv = () => {
    const { headersList, sampleRows } = getTemplateData();
    const delimiter = ";";
    let csvContent = headersList.join(delimiter) + "\n";
    sampleRows.forEach((row) => {
      csvContent += row.map((val) => `"${val}"`).join(delimiter) + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plantilla_${entityType}${entityType === "user" ? `_${role}` : ""}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.info("Plantilla CSV descargada exitosamente.");
  };

  // ──────────────────────────────────────────────
  // Procesamiento unificado de archivos (.xlsx, .xls, .csv)
  // ──────────────────────────────────────────────
  const processFile = (uploadedFile) => {
    if (!uploadedFile) return;

    const fileName = uploadedFile.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCsv = fileName.endsWith(".csv") || fileName.endsWith(".txt");

    if (!isExcel && !isCsv) {
      toast.error("Formato no soportado. Seleccione un archivo Excel (.xlsx, .xls) o CSV (.csv).");
      return;
    }

    setFile(uploadedFile);
    setImportResult(null);

    const targetHeaders = EXPECTED_HEADERS_BY_TYPE[currentKey] || defaultHeaders;

    if (isExcel) {
      // Leer con SheetJS (XLSX)
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

          if (rawRows.length === 0) {
            toast.warning("El archivo Excel está vacío.");
            setParsedData([]);
            setHeaders([]);
            return;
          }

          const processed = rawRows.map((r) => unpackRowIfNeeded(r, targetHeaders));
          setParsedData(processed);
          setHeaders(targetHeaders);
          toast.success(`${processed.length} fila(s) cargada(s) correctamente desde Excel.`);
        } catch (err) {
          toast.error(`Error al leer archivo Excel: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(uploadedFile);
    } else {
      // Leer con PapaParse
      Papa.parse(uploadedFile, {
        header: true,
        skipEmptyLines: "greedy",
        dynamicTyping: false,
        complete: (results) => {
          if (results.errors && results.errors.length > 0 && results.data.length === 0) {
            toast.error("Error al leer el archivo CSV.");
            return;
          }

          const cleanRows = results.data.filter((row) =>
            Object.values(row).some((val) => val !== undefined && val !== null && String(val).trim() !== "")
          );

          if (cleanRows.length === 0) {
            toast.warning("El archivo CSV no contiene registros con datos.");
            setParsedData([]);
            setHeaders([]);
            return;
          }

          // Desempaquetar filas si Excel agrupó las columnas
          const processed = cleanRows.map((r) => unpackRowIfNeeded(r, targetHeaders));

          setParsedData(processed);
          setHeaders(targetHeaders);
          toast.success(`${processed.length} fila(s) cargada(s) y procesadas correctamente.`);
        },
        error: (err) => {
          toast.error(`Error al analizar el CSV: ${err.message}`);
        },
      });
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) processFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // ──────────────────────────────────────────────
  // Envío al backend
  // ──────────────────────────────────────────────
  const handleUploadToBackend = async () => {
    if (parsedData.length === 0) {
      toast.error("No hay registros para importar. Cargue un archivo primero.");
      return;
    }

    setIsProcessing(true);
    setImportResult(null);

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token");
      const headersReq = { "Content-Type": "application/json" };
      if (token) headersReq["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${BACKEND_URL}/api/admin/bulk-import`, {
        method: "POST",
        headers: headersReq,
        body: JSON.stringify({
          entityType,
          role: entityType === "user" ? role : undefined,
          records: parsedData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Error durante la importación.");
      }

      setImportResult(result);

      if (result.importedCount > 0) {
        toast.success(`${result.importedCount} registro(s) importado(s) exitosamente.`);
        if (onSuccess) onSuccess();
      }

      if (result.failedCount > 0) {
        toast.warn(`${result.failedCount} registro(s) no se pudieron importar.`);
      }
    } catch (err) {
      toast.error(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsProcessing(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[92vh]">
        {/* Cabecera del Modal */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/80 dark:bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                Carga Masiva desde Excel / CSV
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Soporta archivos directos de Excel (.xlsx, .xls) y archivos delimitados (.csv)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-800 dark:text-zinc-200 text-sm">
          {/* Fila de Configuración: Tipo de Entidad y Rol */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-zinc-900/40 border border-gray-200/80 dark:border-zinc-800">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 mb-1.5">
                Tipo de Entidad a Crear:
              </label>
              <select
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value);
                  setParsedData([]);
                  setHeaders([]);
                  setFile(null);
                  setImportResult(null);
                }}
                disabled={userRole === "superadmin"}
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {userRole === "superadmin" ? (
                  <option value="user">Administradores y Superadmins</option>
                ) : (
                  <>
                    <option value="user">Usuarios (Docente, Estudiante, Auditor)</option>
                    <option value="programa">Programas Académicos</option>
                    <option value="asignatura">Asignaturas</option>
                    <option value="institucion">Instituciones</option>
                    <option value="servicio">Servicios de Práctica</option>
                  </>
                )}
              </select>
            </div>

            {entityType === "user" ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400 mb-1.5">
                  Rol del Usuario a Cargar:
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setParsedData([]);
                    setHeaders([]);
                    setFile(null);
                    setImportResult(null);
                  }}
                  className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {userRole === "superadmin" ? (
                    <>
                      <option value="admin">Administrador</option>
                      <option value="superadmin">Super Admin</option>
                    </>
                  ) : (
                    <>
                      <option value="docente">Docente</option>
                      <option value="estudiante">Estudiante</option>
                      <option value="auditor">Auditor</option>
                    </>
                  )}
                </select>
              </div>
            ) : (
              <div className="flex items-center">
                <p className="text-xs text-gray-500 dark:text-zinc-400 italic inline-flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Los registros importados quedarán vinculados automáticamente en el catálogo correspondiente.</span>
                </p>
              </div>
            )}
          </div>

          {/* Botones de Descarga de Plantilla */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 gap-3">
            <div>
              <p className="font-bold text-blue-900 dark:text-blue-300 text-sm">
                Descarga la plantilla con columnas oficiales
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Selecciona tu formato preferido para{" "}
                <span className="font-extrabold">
                  {entityType === "user" ? ROLE_LABELS[role] || "Usuario" : ENTITY_LABELS[entityType]}
                </span>
                :
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition shadow-md flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Descargar libro de Excel (.xlsx) con columnas separadas listas"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Plantilla Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition shadow-md flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Descargar archivo CSV (; punto y coma) compatible con Excel en Español"
              >
                <FileText className="w-4 h-4" />
                <span>Plantilla CSV (;)</span>
              </button>
            </div>
          </div>

          {/* Zona de Carga de Archivo (Drag & Drop) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center ${
              isDragging
                ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40"
                : "border-gray-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-zinc-500 bg-gray-50/50 dark:bg-zinc-900/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <UploadCloud className="w-12 h-12 text-blue-500 mb-3" />
            {file ? (
              <div className="space-y-1">
                <p className="font-black text-base text-gray-900 dark:text-white">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Tamaño: {(file.size / 1024).toFixed(1)} KB — Haz clic aquí para seleccionar otro archivo
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-bold text-gray-800 dark:text-zinc-200">
                  Arrastra y suelta tu archivo Excel (.xlsx) o CSV aquí, o{" "}
                  <span className="text-blue-600 dark:text-blue-400 underline">haz clic para examinar</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  Formatos compatibles: .xlsx, .xls, .csv (separado por comas o punto y coma)
                </p>
              </div>
            )}
          </div>

          {/* Tabla de Previsualización */}
          {parsedData.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400">
                  Previsualización de Datos ({parsedData.length} registros detectados):
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{parsedData.length} fila(s) listas</span>
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-zinc-800 max-h-56">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 sticky top-0 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 border-b border-gray-200 dark:border-zinc-700 w-12 text-center">#</th>
                      {headers.map((h, i) => (
                        <th key={i} className="p-2.5 border-b border-gray-200 dark:border-zinc-700">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {parsedData.slice(0, 8).map((row, rIndex) => (
                      <tr key={rIndex} className="hover:bg-gray-50/80 dark:hover:bg-zinc-800/50">
                        <td className="p-2.5 font-mono text-center text-gray-400">{rIndex + 1}</td>
                        {headers.map((h, cIndex) => (
                          <td key={cIndex} className="p-2.5 truncate max-w-[180px]">
                            {row[h] !== undefined && row[h] !== null ? String(row[h]) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 8 && (
                <p className="text-[11px] text-gray-400 dark:text-zinc-500 italic text-right">
                  Mostrando las primeras 8 filas de {parsedData.length} registros totales.
                </p>
              )}
            </div>
          )}

          {/* Resumen de Resultados de la Importación */}
          {importResult && (
            <div
              className={`p-4 rounded-2xl border ${
                importResult.failedCount === 0
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
              }`}
            >
              <div className="flex items-center space-x-2 font-bold mb-2">
                {importResult.failedCount === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <span>
                  Resultados: {importResult.importedCount} importado(s) exitosamente,{" "}
                  {importResult.failedCount} fallido(s).
                </span>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto text-xs bg-white/70 dark:bg-black/30 p-2.5 rounded-xl">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="text-red-600 dark:text-red-400 flex items-start space-x-1">
                      <span className="font-bold">Fila {err.row} ({err.identifier}):</span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del Modal con Acciones */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end space-x-3 bg-gray-50/80 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-200/80 dark:hover:bg-zinc-800 transition text-sm cursor-pointer"
          >
            {importResult ? "Cerrar" : "Cancelar"}
          </button>
          <button
            type="button"
            disabled={parsedData.length === 0 || isProcessing}
            onClick={handleUploadToBackend}
            className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Importar {parsedData.length > 0 ? `${parsedData.length} Registros` : "Datos"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
};

export default AdminCsvImportModal;
