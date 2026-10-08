// ============================================================
// utils/certificateGenerator.js — Generador de Certificado Oficial UPTC
// Basado fielmente en el formato oficial de la Facultad de Ciencias de la Salud
// Formato: Hoja vertical A4 (210mm x 297mm)
// ============================================================
import { jsPDF } from "jspdf";
import { UPTC_LOGO_BASE64, FACULTY_SEAL_BASE64 } from "../assets/images/certificateImagesBase64";

/**
 * Función auxiliar para formatear fechas a formato largo en español:
 * Ej: "2026-02-01" -> "01 de febrero de 2026"
 */
export const formatDateEs = (dateStr, fallback = "") => {
  if (!dateStr) return fallback;
  try {
    const cleanStr = String(dateStr).trim();
    const isoMatch = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    }
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    }
  } catch (e) { }
  return String(dateStr);
};

/**
 * Formatea la nota académica:
 * Ej: 3.5 -> "3,5", 4 -> "4,0", null -> "3,5"
 */
export const formatGrade = (grade) => {
  if (grade !== null && grade !== undefined && grade !== "") {
    const num = Number(grade);
    if (!isNaN(num)) {
      return num.toFixed(1).replace(".", ",");
    }
    return String(grade);
  }
  return "3,5";
};

/**
 * Genera la narrativa y tokens estructurados para el certificado oficial UPTC
 */
export const formatCertificateNarrative = ({
  practiceName = "",
  serviceName = "",
  institution = "",
  docentName = "",
  auditorName = "",
  hours = 144,
  period = "2026-2",
  startDate = "",
  endDate = "",
  grade = null,
} = {}) => {
  const clean = (str) => (str || "").replace(/["“”'«»]/g, "").trim();

  const cleanInst = clean(institution) || "Hospital Universitario San Rafael de Tunja";
  // Nombre real asignado a la práctica (Prioridad al título oficial)
  const cleanPractice = clean(practiceName) || clean(serviceName) || "Práctica Formativa";

  // Servicio asistencial / especialidad médica
  const rawService = clean(serviceName);
  const cleanService = rawService.toLowerCase().startsWith("servicio de ")
    ? rawService.substring(12).trim()
    : rawService;

  const cleanDocent = clean(docentName) || "Docente UPTC";
  const cleanAuditor = clean(auditorName) || "Auditor(a) de Calidad Asistencial";
  const cleanPeriod = clean(period) || "2026-2";

  const defaultStart = cleanPeriod.endsWith("-2") ? "01 de agosto de 2026" : "01 de febrero de 2026";
  const defaultEnd = cleanPeriod.endsWith("-2") ? "30 de noviembre de 2026" : "30 de mayo de 2026";

  const formattedStartDate = formatDateEs(startDate, defaultStart);
  const formattedEndDate = formatDateEs(endDate, defaultEnd);
  const gradeStr = formatGrade(grade);

  // Determinar si hay un servicio clínico específico y distinto al nombre de la práctica
  const hasDistinctService = Boolean(
    cleanService &&
    cleanService.toLowerCase() !== cleanPractice.toLowerCase() &&
    !cleanPractice.toLowerCase().includes(cleanService.toLowerCase())
  );

  let fullText = "";
  let tokens = [];

  if (hasDistinctService) {
    fullText = `Cumplió con éxito la práctica ${cleanPractice} realizada en el(la) ${cleanInst} en el servicio de ${cleanService} con una intensidad horaria de ${hours} horas iniciando el ${formattedStartDate} y finalizando el ${formattedEndDate} del periodo ${cleanPeriod}.`;
    tokens = [
      { text: "Cumplió con éxito la práctica ", bold: false },
      { text: cleanPractice, bold: true },
      { text: " realizada en el(la) ", bold: false },
      { text: cleanInst, bold: true },
      { text: " en el servicio de ", bold: false },
      { text: cleanService, bold: true },
      { text: " con una intensidad horaria de ", bold: false },
      { text: `${hours} horas`, bold: true },
      { text: " iniciando el ", bold: false },
      { text: formattedStartDate, bold: true },
      { text: " y finalizando el ", bold: false },
      { text: formattedEndDate, bold: true },
      { text: " del periodo ", bold: false },
      { text: `${cleanPeriod}.`, bold: true },
    ];
  } else {
    fullText = `Cumplió con éxito la práctica ${cleanPractice} realizada en el(la) ${cleanInst} con una intensidad horaria de ${hours} horas iniciando el ${formattedStartDate} y finalizando el ${formattedEndDate} del periodo ${cleanPeriod}.`;
    tokens = [
      { text: "Cumplió con éxito la práctica ", bold: false },
      { text: cleanPractice, bold: true },
      { text: " realizada en el(la) ", bold: false },
      { text: cleanInst, bold: true },
      { text: " con una intensidad horaria de ", bold: false },
      { text: `${hours} horas`, bold: true },
      { text: " iniciando el ", bold: false },
      { text: formattedStartDate, bold: true },
      { text: " y finalizando el ", bold: false },
      { text: formattedEndDate, bold: true },
      { text: " del periodo ", bold: false },
      { text: `${cleanPeriod}.`, bold: true },
    ];
  }

  return {
    fullText,
    tokens,
    cleanInst,
    cleanService: cleanService || cleanPractice,
    hours,
    cleanHours: hours,
    cleanPeriod,
    formattedStartDate,
    formattedEndDate,
    gradeStr,
    serviceClause: cleanService ? `en el servicio de ${cleanService}` : "",
    instClause: `en el(la) ${cleanInst}`,
    docentClause: `del docente ${cleanDocent}`,
    auditorClause: `del auditor asistencial ${cleanAuditor}`,
    cleanPractice,
    cleanDocent,
    cleanAuditor,
  };
};

/**
 * Dibuja un párrafo centrado palabra por palabra en jsPDF respetando palabras normales y en negrita
 */
const renderCenteredFormattedParagraph = (
  doc,
  tokens,
  centerX,
  startY,
  maxWidth,
  lineHeight = 7.2
) => {
  // 1. Dividir tokens en palabras con estado de negrita
  const words = [];
  tokens.forEach((tok) => {
    const raw = tok.text || "";
    const parts = raw.split(" ");
    parts.forEach((p) => {
      if (p.length > 0) {
        words.push({ text: p, bold: Boolean(tok.bold) });
      }
    });
  });

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  const spaceWidth = doc.getTextWidth(" ");

  // 2. Agrupar palabras en líneas que no superen maxWidth
  const lines = [];
  let curLine = [];
  let curWidth = 0;

  words.forEach((w) => {
    doc.setFont("times", w.bold ? "bold" : "normal");
    const wWidth = doc.getTextWidth(w.text);
    const needed = curLine.length === 0 ? wWidth : curWidth + spaceWidth + wWidth;

    if (needed <= maxWidth) {
      curLine.push({ ...w, width: wWidth });
      curWidth = needed;
    } else {
      if (curLine.length > 0) {
        lines.push({ words: curLine, width: curWidth });
      }
      curLine = [{ ...w, width: wWidth }];
      curWidth = wWidth;
    }
  });

  if (curLine.length > 0) {
    lines.push({ words: curLine, width: curWidth });
  }

  // 3. Dibujar cada línea centrada horizontalmente
  let y = startY;
  lines.forEach((line) => {
    let x = centerX - line.width / 2;
    line.words.forEach((w) => {
      doc.setFont("times", w.bold ? "bold" : "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(w.text, x, y);
      x += w.width + spaceWidth;
    });
    y += lineHeight;
  });

  return y;
};

/**
 * Genera el Certificado Académico Oficial en formato A4 Vertical (210mm x 297mm)
 */
export const generateProfessionalCertificate = (cert = {}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // ── 1. Fondo blanco pulcro ──
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // ── 2. Doble marco institucional dorado y sobrio ──
  doc.setDrawColor(217, 119, 6); // Amber-600
  doc.setLineWidth(0.7);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  doc.setDrawColor(180, 83, 9); // Amber-700
  doc.setLineWidth(0.3);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Adornos esquineros
  const drawCorner = (x, y, dx, dy) => {
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.5);
    doc.line(x, y, x + dx * 4, y);
    doc.line(x, y, x, y + dy * 4);
  };
  drawCorner(14, 14, 1, 1);
  drawCorner(pageWidth - 14, 14, -1, 1);
  drawCorner(14, pageHeight - 14, 1, -1);
  drawCorner(pageWidth - 14, pageHeight - 14, -1, -1);

  // ── Obtener Parametrización Institucional Actual ──
  let instSettings = cert.institutionSettings;
  if (!instSettings) {
    try {
      instSettings = JSON.parse(localStorage.getItem("institutionSettings")) || {};
    } catch (e) {
      instSettings = {};
    }
  }

  const institutionName = (instSettings.name || cert.institutionName || "Universidad Pedagógica y Tecnológica de Colombia").toUpperCase();
  const facultyName = instSettings.faculty || cert.faculty || "Facultad de Ciencias de la Salud";
  const mainLogo = instSettings.logo_institucion || instSettings.logoPreview || instSettings.logo_url || null;
  const facultyLogo = instSettings.logo_facultad || cert.facultyLogo || null;

  // ── 3. Logos en el encabezado ──
  // Logo Institucional a la izquierda
  let usedMainLogo = false;
  if (mainLogo && (mainLogo.startsWith("data:image/") || mainLogo.startsWith("http"))) {
    try {
      const format = mainLogo.includes("image/jpeg") || mainLogo.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(mainLogo, format, 16, 15, 34, 17);
      usedMainLogo = true;
    } catch (e) {
      console.warn("Fallo al incrustar logo principal dinámico, usando fallback UPTC:", e);
    }
  }
  if (!usedMainLogo) {
    try {
      doc.addImage(UPTC_LOGO_BASE64, "PNG", 16, 15, 34, 17);
    } catch (e) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("UPTC", 18, 24);
    }
  }

  // Sello / Logo Facultad a la derecha:
  // IMPORTANTE: Solo se imprime si se subió el logo de facultad en la parametrización institucional
  if (facultyLogo && (facultyLogo.startsWith("data:image/") || facultyLogo.startsWith("http"))) {
    try {
      const format = facultyLogo.includes("image/jpeg") || facultyLogo.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(facultyLogo, format, pageWidth - 39, 14, 23, 23);
    } catch (e) {
      console.warn("Fallo al incrustar logo de facultad dinámico en el certificado:", e);
    }
  }

  // ── 4. Encabezado Central Universitario Completo ──
  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(
    institutionName,
    pageWidth / 2,
    42,
    { align: "center", maxWidth: 140 }
  );

  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85); // Slate-700
  doc.text(facultyName, pageWidth / 2, 49, { align: "center", maxWidth: 140 });

  // Línea decorativa dorada horizontal
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.4);
  doc.line(55, 54, pageWidth - 55, 54);

  // ── 5. Frase de Presentación / Información (Centrada) ──
  let curY = 67;
  const rawCareer = cert.career || "";
  const cleanCareer = rawCareer
    .replace(/^programa\s+(de\s+)?/i, "")
    .replace(/["“”'«»]/g, "")
    .trim();
  const introPhrase = cleanCareer
    ? `Informa que el(la) estudiante del programa ${cleanCareer}:`
    : "Informa que el(la) estudiante:";

  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(introPhrase, pageWidth / 2, curY, { align: "center", maxWidth: 165 });

  // ── 6. Nombre del Estudiante (Destacado en Negrita, Mayúsculas y Centrado) ──
  curY = 85;
  const rawStudentName = cert.studentName || "Nombre del Estudiante";
  const studentName = rawStudentName.replace(/["“”'«»]/g, "");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(2, 6, 23); // Slate-950
  doc.text(studentName.toUpperCase(), pageWidth / 2, curY, { align: "center" });

  // Documento de Identificación (Centrado y en negrita)
  curY = 94;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85); // Slate-700
  const cedulaStr = cert.cedula ? `C.C. ${cert.cedula}` : "Identificación institucional";
  doc.text(cedulaStr, pageWidth / 2, curY, { align: "center" });

  // ── 7. Cuerpo Narrativo del Certificado (Todos los textos centrados y los items en negrita) ──
  curY = 117;
  const narrativeData = formatCertificateNarrative(cert);

  const endParagraphY = renderCenteredFormattedParagraph(
    doc,
    narrativeData.tokens,
    pageWidth / 2,
    curY,
    160,
    7.5
  );

  // ── 8. Nota Académica (En negrita y centrada) ──
  curY = endParagraphY + 13;
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`Nota (${narrativeData.gradeStr})`, pageWidth / 2, curY, { align: "center" });

  // ── 9. Ciudad y Fecha de Expedición (Centrada) ──
  curY += 15;
  const rawDate = cert.date || "Tunja, 14 de mayo de 2026";
  const cleanDate = rawDate.replace(/["“”'«»]/g, "");
  const cityDate = cleanDate.toLowerCase().startsWith("tunja") ? cleanDate : `Tunja, ${cleanDate}`;
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text(cityDate, pageWidth / 2, curY, { align: "center" });

  // ── 10. Sección de Firma Oficial Centrada ──
  const sigY = 228;
  const sigWidth = 75;
  const sigStartX = (pageWidth - sigWidth) / 2;

  // Si se subió foto/imagen de la firma real, incrustarla directamente arriba de la línea
  const isDummyPixel =
    typeof cert.signatureImage === "string" &&
    (cert.signatureImage.length < 300 ||
      cert.signatureImage.includes("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"));

  if (cert.signatureImage && !isDummyPixel) {
    try {
      doc.addImage(cert.signatureImage, "PNG", pageWidth / 2 - 25, sigY - 20, 50, 19);
    } catch (err) {
      console.warn("Reintentando firma como JPEG:", err);
      try {
        doc.addImage(cert.signatureImage, "JPEG", pageWidth / 2 - 25, sigY - 20, 50, 19);
      } catch (err2) {
        console.error("Error al incrustar firma en PDF:", err2);
      }
    }
  }

  // Línea horizontal de firma
  doc.setDrawColor(100, 116, 139); // Slate-500
  doc.setLineWidth(0.45);
  doc.line(sigStartX, sigY, sigStartX + sigWidth, sigY);

  // Nombre y cargo oficial bajo la línea (centrados y en negrita)
  const signerName = cert.directorName || cert.deanName || "?????";
  const signerRole = cert.directorRole || "Coordinador(a) de Práctica";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(signerName, pageWidth / 2, sigY + 6, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(signerRole, pageWidth / 2, sigY + 11, { align: "center" });

  // ── 12. Descargar archivo PDF ──
  const safeName = studentName.replace(/\s+/g, "_");
  const filename = `Certificado_Oficial_UPTC_${safeName}.pdf`;
  doc.save(filename);
};

export default generateProfessionalCertificate;
