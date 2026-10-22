// ============================================================
// routes.js — Mapeo centralizado de páginas y rutas del sistema
// ============================================================
"use strict";

/**
 * Mapa de identificadores de página (claves usadas en navegación interna)
 * a rutas URL absolutas del navegador.
 */
export const PAGE_TO_ROUTE = {
  login: "/login",
  forgotPassword: "/forgot-password",
  changePassword: "/change-password",
  dashboard: "/dashboard",

  // Rutas Estudiante
  studentProfile: "/student/profile",
  studentPractices: "/student/practices",
  studentEvaluations: "/student/evaluations",
  studentCertifications: "/student/certifications",
  studentDocentCommunication: "/student/communication",

  // Rutas Docente
  docentPractices: "/docent/practices",
  docentCertificateDesigner: "/docent/certificates",
  docentReports: "/docent/reports",
  docentCertificateRequests: "/docent/certificate-requests",
  docentStudents: "/docent/students",
  docentEvaluations: "/docent/evaluations",
  docentHoursCompliance: "/docent/hours-compliance",
  docentCommunication: "/docent/communication",
  docentStudentCommunication: "/docent/communication-students",
  docentProfile: "/docent/profile",

  // Rutas Auditor
  auditorReports: "/auditor/reports",
  auditorCommunication: "/auditor/communication",
  auditorUserViewer: "/auditor/users",
  auditorHoursCompliance: "/auditor/hours-compliance",

  // Rutas Administrador y Superadmin
  adminUsers: "/admin/users",
  adminPractices: "/admin/practices",
  adminCertificateDesigner: "/admin/certificates",
  adminReports: "/admin/reports",
  adminInstitutionSettings: "/admin/settings",

  // Módulos Transversales de Historial
  history: "/history",
  certificateHistory: "/certificate-history",
};

/**
 * Mapa inverso: de ruta URL a identificador de página.
 */
export const ROUTE_TO_PAGE = Object.entries(PAGE_TO_ROUTE).reduce(
  (acc, [page, route]) => {
    acc[route] = page;
    return acc;
  },
  {}
);

// Alias adicionales de rutas para páginas transversales
ROUTE_TO_PAGE["/admin/history"] = "history";
ROUTE_TO_PAGE["/docent/history"] = "history";
ROUTE_TO_PAGE["/student/history"] = "history";
ROUTE_TO_PAGE["/admin/certificate-history"] = "certificateHistory";
ROUTE_TO_PAGE["/student/certificate-history"] = "certificateHistory";

/**
 * Obtiene la ruta URL normalizada correspondiente a partir de un identificador de página o ruta.
 * Siempre garantiza una ruta absoluta que comienza con "/".
 */
export const getRouteForPage = (pageOrRoute) => {
  if (!pageOrRoute) return "/dashboard";
  if (PAGE_TO_ROUTE[pageOrRoute]) return PAGE_TO_ROUTE[pageOrRoute];
  if (typeof pageOrRoute === "string") {
    if (pageOrRoute.startsWith("/")) return pageOrRoute;
    return `/${pageOrRoute}`;
  }
  return "/dashboard";
};
