// ============================================================
// utils/reportGenerator.js — Generador Real de CSV, Excel y PDF
// ============================================================
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { UPTC_LOGO_BASE64, FACULTY_SEAL_BASE64 } from "../assets/images/certificateImagesBase64";
import toast from "./toast";

/**
 * Función auxiliar para descargar un Blob generado en el navegador.
 */
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Genera y descarga un archivo CSV con formato estándar RFC 4180.
 */
export const generateCsv = (data, filename = "reporte.csv") => {
  if (!data || data.length === 0) {
    toast.warn("No hay datos para exportar a CSV.");
    return;
  }

  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const finalName = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    downloadBlob(blob, finalName);
  } catch (err) {
    console.error("Error al exportar CSV:", err);
    // Fallback nativo
    const headers = Object.keys(data[0]);
    const rows = [headers.join(",")];
    for (const row of data) {
      rows.push(
        headers
          .map((h) => `"${("" + (row[h] ?? "")).replace(/"/g, '""')}"`)
          .join(",")
      );
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
  }
};

/**
 * Genera y descarga un archivo Excel genuino en formato binario (.xlsx)
 * usando SheetJS (XLSX). Totalmente compatible con MS Excel, LibreOffice y Google Sheets.
 */
export const generateXls = (data, filename = "reporte.xlsx") => {
  if (!data || data.length === 0) {
    toast.warn("No hay datos para exportar a Excel.");
    return;
  }

  try {
    let finalName = filename;
    if (!finalName.endsWith(".xlsx") && !finalName.endsWith(".xls")) {
      finalName = `${finalName}.xlsx`;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Ajustar ancho automático de columnas
    const colWidths = [];
    if (data.length > 0) {
      Object.keys(data[0]).forEach((key) => {
        let maxLen = key.length;
        data.forEach((row) => {
          const val = row[key];
          if (val !== null && val !== undefined) {
            maxLen = Math.max(maxLen, String(val).length);
          }
        });
        colWidths.push({ wch: Math.min(Math.max(maxLen + 3, 10), 50) });
      });
      worksheet["!cols"] = colWidths;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte UPTC");

    XLSX.writeFile(workbook, finalName);
  } catch (err) {
    console.error("Error al generar archivo Excel con XLSX:", err);
    toast.error("Ocurrió un error al generar el archivo Excel.");
  }
};

/**
 * Genera y descarga un PDF oficial y estructurado usando jsPDF con membrete UPTC.
 */
export const generatePdf = (data, filename = "reporte.pdf") => {
  if (!data || data.length === 0) {
    toast.warn("No hay datos para generar el PDF.");
    return;
  }

  try {
    const finalName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    // Obtener parametrización institucional actual
    let instSettings = {};
    try {
      instSettings = JSON.parse(localStorage.getItem("institutionSettings")) || {};
    } catch (e) {}

    const institutionName = (instSettings.name || instSettings.nombre || "Universidad Pedagógica y Tecnológica de Colombia").toUpperCase();
    const facultyName = instSettings.faculty || instSettings.facultad || "Facultad de Ciencias de la Salud";
    const slogan = instSettings.slogan || instSettings.eslogan || "Sistema Oficial de Prácticas Formativas";

    // Franja Superior Slate UPTC
    doc.setFillColor(30, 41, 59); // #1E293B
    doc.rect(0, 0, pageWidth, 28, "F");

    // Franja Dorada Institucional UPTC
    doc.setFillColor(234, 179, 8); // #EAB308
    doc.rect(0, 26, pageWidth, 2.5, "F");

    // Texto Encabezado
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(
      institutionName,
      pageWidth / 2,
      12,
      { align: "center", maxWidth: pageWidth - 20 }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(
      `${facultyName} · ${slogan}`,
      pageWidth / 2,
      18,
      { align: "center", maxWidth: pageWidth - 20 }
    );

    currentY = 38;

    // Título del Documento
    const rawTitle =
      data[0]["Título"] ||
      finalName.replace(/\.pdf$/i, "").replace(/_/g, " ");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(String(rawTitle).toUpperCase(), 14, currentY);
    currentY += 5.5;

    // Metadatos de Emisión
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const dateStr = new Date().toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.text(`Fecha y hora de emisión: ${dateStr}`, 14, currentY);
    currentY += 7;

    // Línea divisoria
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, currentY, pageWidth - 14, currentY);
    currentY += 8;

    // Renderizar cada registro
    data.forEach((row, idx) => {
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }

      // Banda de registro
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, currentY, pageWidth - 28, 6.5, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Item #${idx + 1}`, 17, currentY + 4.5);
      currentY += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      for (const [key, val] of Object.entries(row)) {
        if (
          [
            "Logo de la Institución",
            "Título",
            "Nombre de la Institución",
            "Eslogan de la Institución",
          ].includes(key)
        ) {
          continue;
        }

        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text(`${key}:`, 18, currentY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        const displayVal =
          val !== null && val !== undefined ? String(val) : "N/A";
        const splitVal = doc.splitTextToSize(displayVal, pageWidth - 70);
        doc.text(splitVal, 62, currentY);

        currentY += Math.max(4.5, splitVal.length * 4.2);
      }

      currentY += 4;
    });

    // Paginación en pie de página
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${i} de ${totalPages} · UPTC Tunja, Boyacá · Documento Oficial Generado Automáticamente`,
        pageWidth / 2,
        290,
        { align: "center" }
      );
    }

    doc.save(finalName);
  } catch (err) {
    console.error("Error al generar PDF:", err);
    toast.error("Ocurrió un error al generar el PDF.");
  }
};

/**
 * Generador RTF compatible.
 */
export const generateRtf = (data, filename = "reporte.rtf") => {
  if (!data || data.length === 0) {
    toast.warn("No hay datos para generar el RTF.");
    return;
  }

  const rtfContent =
    `{\\rtf1\\ansi\\deff0\n` +
    `{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\n` +
    `\\pard\\sa200\\sl276\\slmult1\\f0\\fs24\n` +
    `\\b Reporte Generado: ${filename}\\b0\\par\n` +
    `\\par\n` +
    `\\b Datos:\\b0\\par\n` +
    data.map((row) => `{\\pard ${JSON.stringify(row)}\\par}`).join("\n") +
    `\n}`;

  const blob = new Blob([rtfContent], { type: "application/rtf;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".rtf") ? filename : `${filename}.rtf`);
};

/**
 * Genera la Constancia Oficial de Práctica Formativa Vigente / En Curso en formato PDF
 * Basada en las directrices académicas oficiales de la Facultad de Ciencias de la Salud de la UPTC.
 */
export const generateConstanciaPracticaVigente = (constancia = {}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2; // 174 mm

  // 1. Fondo blanco pulcro
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // 2. Franja superior dorada UPTC
  doc.setFillColor(245, 185, 20); // UPTC Gold
  doc.rect(0, 0, pageWidth, 5.5, "F");
  doc.setFillColor(180, 115, 10);
  doc.rect(0, 5.5, pageWidth, 0.8, "F");

  // Obtener Parametrización Institucional Actual
  let instSettings = constancia.institutionSettings;
  if (!instSettings) {
    try {
      instSettings = JSON.parse(localStorage.getItem("institutionSettings")) || {};
    } catch (e) {
      instSettings = {};
    }
  }

  const institutionName = (instSettings.name || instSettings.nombre || constancia.institutionName || "Universidad Pedagógica y Tecnológica de Colombia").toUpperCase();
  const facultyName = instSettings.faculty || instSettings.facultad || constancia.faculty || "Facultad de Ciencias de la Salud";
  const mainLogo = instSettings.logo_institucion || instSettings.logoPreview || instSettings.logo_url || null;
  const facultyLogo = instSettings.logo_facultad || constancia.facultyLogo || null;

  // 3. Logos institucionales
  // Logo Principal a la izquierda
  let usedMainLogo = false;
  if (mainLogo && (mainLogo.startsWith("data:image/") || mainLogo.startsWith("http"))) {
    try {
      const format = mainLogo.includes("image/jpeg") || mainLogo.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(mainLogo, format, margin, 11, 32, 16);
      usedMainLogo = true;
    } catch (e) {
      console.warn("Fallo al incrustar logo principal dinámico en constancia:", e);
    }
  }
  if (!usedMainLogo) {
    try {
      doc.addImage(UPTC_LOGO_BASE64, "PNG", margin, 11, 32, 16);
    } catch (e) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("UPTC", margin, 21);
    }
  }

  // Logo de Facultad a la derecha: Solo si está configurado en la parametrización
  if (facultyLogo && (facultyLogo.startsWith("data:image/") || facultyLogo.startsWith("http"))) {
    try {
      const format = facultyLogo.includes("image/jpeg") || facultyLogo.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(facultyLogo, format, pageWidth - margin - 20, 9, 20, 20);
    } catch (e) {
      console.warn("Fallo al incrustar logo de facultad en constancia:", e);
    }
  }

  // 4. Membrete oficial central
  let curY = 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(institutionName, pageWidth / 2, curY, { align: "center", maxWidth: 140 });

  curY += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(facultyName, pageWidth / 2, curY, { align: "center", maxWidth: 140 });

  const rawProgram = constancia.practiceProgram || constancia.programName || constancia.studentCareer || "";
  const cleanProgram = rawProgram
    .replace(/^programa\s+(de\s+)?/i, "")
    .replace(/["“”'«»]/g, "")
    .trim() || "Medicina";

  curY += 4.5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Programa de ${cleanProgram}`, pageWidth / 2, curY, { align: "center" });

  // 5. Línea divisoria elegante
  curY += 5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, curY, pageWidth - margin, curY);

  // 6. Título Principal (Sin número de radicado)
  curY += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("CONSTANCIA DE PRÁCTICA FORMATIVA VIGENTE", pageWidth / 2, curY, { align: "center" });

  // 7. Badge Centrado: ESTADO: VIGENTE / EN CURSO
  curY += 3.5;
  const badgeW = 62;
  const badgeH = 5.5;
  const badgeX = (pageWidth - badgeW) / 2;
  doc.setFillColor(209, 250, 229); // emerald-100 (#d1fae5)
  doc.setDrawColor(110, 231, 183); // emerald-300 (#6ee7b7)
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, curY, badgeW, badgeH, 2.7, 2.7, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70); // emerald-800 (#065f46)
  doc.text("ESTADO: VIGENTE / EN CURSO", pageWidth / 2, curY + 3.8, { align: "center" });

  curY += badgeH + 6;

  // 8. Párrafo Certificatorio Introductorio
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const introText = `La Dirección del programa de ${cleanProgram} de la ${facultyName} de la ${institutionName}, hace constar que el(la) estudiante:`;
  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  doc.text(splitIntro, margin, curY);
  curY += splitIntro.length * 4.5 + 3;

  // 9. Recuadro del Estudiante (Destacado e idéntico a la vista previa)
  const studentBoxH = 17;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, curY, contentWidth, studentBoxH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text((constancia.studentName || "Nombre del Estudiante").toUpperCase(), margin + 5, curY + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`C.C. ${constancia.studentCedula || "N/A"}`, margin + 5, curY + 12.5);

  curY += studentBoxH + 5;

  // 10. Párrafo de vinculación
  const bodyText = "Se encuentra formalmente vinculado(a) y en desarrollo activo de su rotación académica en la siguiente práctica formativa supervisada:";
  const splitBody = doc.splitTextToSize(bodyText, contentWidth);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(splitBody, margin, curY);
  curY += splitBody.length * 4.5 + 4;

  // 11. TABLA ESTRUCTURADA DE DATOS DE LA PRÁCTICA (7 Parámetros idénticos a la vista previa)
  const tableX = margin;
  const tableW = contentWidth;
  const col1W = 64;
  const col2W = tableW - col1W;
  const rowHeight = 7;

  const totalHrs = constancia.totalHours || 120;
  const accHrs = constancia.accumulatedHours !== undefined && constancia.accumulatedHours !== null
    ? constancia.accumulatedHours
    : 0;

  // Encabezado de la tabla
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(tableX, curY, tableW, 6.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Parámetro", tableX + 3.5, curY + 4.5);

  doc.setTextColor(15, 23, 42);
  doc.text("Detalle de la Rotación", tableX + col1W + 3.5, curY + 4.5);

  curY += 6.5;

  const rows = [
    ["Práctica / Asignatura:", constancia.practiceName || constancia.serviceName || "Práctica Formativa", false, "default", "bold"],
    ["Institución / IPS:", constancia.institutionName || "Hospital Universitario San Rafael", true, "default", "normal"],
    ["Docente:", constancia.docentName || "Docente UPTC", false, "default", "normal"],
    ["Periodo Académico:", constancia.period || "2026-1", true, "default", "normal"],
    ["Horas Totales Programadas:", `${totalHrs} Horas`, false, "default", "bold"],
    ["Horas Realizadas a la Fecha:", `${accHrs} Horas Ejecutadas`, true, "blue", "bold"],
    ["Estado de Vigencia:", "ACTIVA / EN CURSO", false, "green", "bold"],
  ];

  rows.forEach(([label, val, isBg, colorType, fontType]) => {
    doc.setFillColor(isBg ? 248 : 255, isBg ? 250 : 255, isBg ? 252 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(tableX, curY, tableW, rowHeight, "FD");

    // Columna 1
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(label, tableX + 3.5, curY + 4.8);

    // Columna 2
    doc.setFont("helvetica", fontType);
    doc.setFontSize(8);
    if (colorType === "blue") {
      doc.setTextColor(29, 78, 216); // blue-700 (#1d4ed8)
    } else if (colorType === "green") {
      doc.setTextColor(5, 150, 105); // emerald-600 (#059669)
    } else {
      doc.setTextColor(15, 23, 42);
    }
    const valText = doc.splitTextToSize(String(val), col2W - 6);
    doc.text(valText[0] || "", tableX + col1W + 3.5, curY + 4.8);

    curY += rowHeight;
  });

  curY += 6;

  // 12. Párrafo de Expedición
  const issueDateStr = constancia.issueDate || `Tunja, ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Se expide la presente a solicitud del interesado en ${issueDateStr}.`, margin, curY);

  curY += 22;

  // 13. Dos Firmas Oficiales: Director(a) de Escuela y Docente
  const sigY = curY;
  const sigColW = 60;
  const sigGap = 35;
  const startSigX = margin + (contentWidth - (sigColW * 2 + sigGap)) / 2;

  const signatures = [
    {
      name: constancia.directorName || "?????",
      role: constancia.directorRole || "Director(a) de Escuela",
      signatureImage: constancia.directorSignature || null,
    },
    {
      name: constancia.docentName || "Docente UPTC",
      role: "Docente",
      signatureImage: constancia.docentSignature || null,
    },
  ];

  signatures.forEach((sig, idx) => {
    const sx = startSigX + idx * (sigColW + sigGap);

    // Si se adjuntó foto de la firma, incrustarla arriba de la línea
    if (sig.signatureImage) {
      try {
        doc.addImage(sig.signatureImage, "PNG", sx + (sigColW - 38) / 2, sigY - 14, 38, 12);
      } catch (err) {
        try {
          doc.addImage(sig.signatureImage, "JPEG", sx + (sigColW - 38) / 2, sigY - 14, 38, 12);
        } catch (e2) {}
      }
    }

    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.4);
    doc.line(sx, sigY, sx + sigColW, sigY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.name, sx + sigColW / 2, sigY + 5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(sig.role, sx + sigColW / 2, sigY + 9, { align: "center" });
  });

  // 14. Sin letras grises en el pie de página (eliminadas a solicitud)

  const safeName = (constancia.studentName || "Estudiante").replace(/\s+/g, "_");
  const filename = `Constancia_Practica_Vigente_${safeName}.pdf`;
  doc.save(filename);
};
