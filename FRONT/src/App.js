import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { Toaster } from "sileo";
import "sileo/styles.css";

import AdminCertificateDesigner from "./components/Admin/AdminCertificateDesigner";
import AdminInstitutionSettings from "./components/Admin/AdminInstitutionSettings";
import AdminPractices from "./components/Admin/AdminPractices";
import AdminReports from "./components/Admin/AdminReports";
import AdminUserManagement from "./components/Admin/AdminUserManagement";

import AuditorReports from "./components/Auditor/AuditorReports";
import AuditorUserViewer from "./components/Auditor/AuditorUserViewer";
import AuditorHoursCompliance from "./components/Auditor/AuditorHoursCompliance";
import AuditorCommunication from "./components/Auditor/AuditorCommunication";

import AuthChangePassword from "./components/Auth/AuthChangePassword";
import AuthForgotPassword from "./components/Auth/AuthForgotPassword";
import AuthLogin from "./components/Auth/Login";

import DashboardHome from "./components/Dashboard/DashboardHome";
import DashboardNavBar from "./components/Dashboard/DashboardNavBar";

import DocentEvaluations from "./components/Docent/DocentEvaluations";
import DocentPractices from "./components/Docent/DocentPractices";
import DocentStudents from "./components/Docent/DocentStudents";
import DocentHoursCompliance from "./components/Docent/DocentHoursCompliance";
import DocentCertificateRequests from "./components/Docent/DocentCertificateRequests";
import DocentCommunication from "./components/Docent/DocentCommunication";
import DocentStudentCommunication from "./components/Docent/DocentStudentCommunication";
import DocentProfile from "./components/Docent/DocentProfile";

import StudentCertifications from "./components/Student/StudentCertifications";
import StudentEvaluations from "./components/Student/StudentEvaluations";
import StudentPractices from "./components/Student/StudentPractices";
import StudentProfile from "./components/Student/StudentProfile";
import StudentDocentCommunication from "./components/Student/StudentDocentCommunication";
import HistoryModule from "./components/History/HistoryModule";
import CertificateHistoryModule from "./components/History/CertificateHistoryModule";

import {
  loadActiveSession,
  saveActiveSession,
  touchLastActivity,
  performFullLogout,
  saveInactivityProgress,
  clearActiveSession,
  isSessionExpired,
} from "./utils/sessionManager";

// Mapa bidireccional entre identificadores de página y rutas URL del navegador
export const PAGE_TO_ROUTE = {
  login: "/login",
  forgotPassword: "/forgot-password",
  changePassword: "/change-password",
  dashboard: "/dashboard",
  // Estudiante
  studentProfile: "/student/profile",
  studentPractices: "/student/practices",
  studentEvaluations: "/student/evaluations",
  studentCertifications: "/student/certifications",
  studentDocentCommunication: "/student/communication",
  // Docente
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
  // Auditor
  auditorReports: "/auditor/reports",
  auditorCommunication: "/auditor/communication",
  auditorUserViewer: "/auditor/users",
  auditorHoursCompliance: "/auditor/hours-compliance",
  // Administrador
  adminUsers: "/admin/users",
  adminPractices: "/admin/practices",
  adminCertificateDesigner: "/admin/certificates",
  adminReports: "/admin/reports",
  adminInstitutionSettings: "/admin/settings",
  // Historial
  history: "/history",
  certificateHistory: "/certificate-history",
};

export const ROUTE_TO_PAGE = Object.entries(PAGE_TO_ROUTE).reduce((acc, [page, route]) => {
  acc[route] = page;
  return acc;
}, {});

// Obtener el identificador 'page' para que el DashboardNavBar resalte la opción correcta
export const getPageKeyFromPath = (pathname) => {
  if (ROUTE_TO_PAGE[pathname]) return ROUTE_TO_PAGE[pathname];

  if (pathname.includes("/certificate-history")) return "certificateHistory";
  if (pathname.includes("/history")) return "history";

  if (pathname.startsWith("/admin/practices")) return "adminPractices";
  if (pathname.startsWith("/admin/users")) return "adminUsers";
  if (pathname.startsWith("/admin/certificates")) return "adminCertificateDesigner";
  if (pathname.startsWith("/admin/reports")) return "adminReports";
  if (pathname.startsWith("/admin/settings")) return "adminInstitutionSettings";

  if (pathname.startsWith("/docent/practices")) return "docentPractices";
  if (pathname.startsWith("/docent/certificates")) return "docentCertificateDesigner";
  if (pathname.startsWith("/docent/reports")) return "docentReports";
  if (pathname.startsWith("/docent/certificate-requests")) return "docentCertificateRequests";
  if (pathname.startsWith("/docent/hours-compliance")) return "docentHoursCompliance";
  if (pathname.startsWith("/docent/students")) return "docentStudents";
  if (pathname.startsWith("/docent/evaluations")) return "docentEvaluations";
  if (pathname.startsWith("/docent/communication-students")) return "docentStudentCommunication";
  if (pathname.startsWith("/docent/communication")) return "docentCommunication";

  if (pathname.startsWith("/student/profile")) return "studentProfile";
  if (pathname.startsWith("/student/practices")) return "studentPractices";
  if (pathname.startsWith("/student/evaluations")) return "studentEvaluations";
  if (pathname.startsWith("/student/certifications")) return "studentCertifications";
  if (pathname.startsWith("/student/communication")) return "studentDocentCommunication";

  if (pathname.startsWith("/auditor/hours-compliance")) return "auditorHoursCompliance";
  if (pathname.startsWith("/auditor/reports")) return "auditorReports";
  if (pathname.startsWith("/auditor/users")) return "auditorUserViewer";
  if (pathname.startsWith("/auditor/communication")) return "auditorCommunication";

  if (pathname.startsWith("/change-password")) return "changePassword";
  return "dashboard";
};

// Layout protegido con DashboardNavBar y Outlet para vistas hijas
const DashboardLayoutWrapper = ({
  userRole,
  onLogout,
  onNavigate,
}) => {
  const location = useLocation();
  const currentPageKey = useMemo(
    () => getPageKeyFromPath(location.pathname),
    [location.pathname]
  );

  return (
    <DashboardNavBar
      userRole={userRole}
      currentPage={currentPageKey}
      onLogout={onLogout}
      onNavigate={onNavigate}
    >
      <Outlet />
    </DashboardNavBar>
  );
};

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Inicializar estado del rol leyendo inmediatamente la sesión activa
  const [userRole, setUserRole] = useState(() => {
    const session = loadActiveSession();
    return session && !session.expiredDueToInactivity ? session.userRole : null;
  });

  // Adaptador de navegación compatible con cualquier llamada previa onNavigate(page)
  const handleNavigate = useCallback(
    (pageOrRoute) => {
      let targetRoute = "/dashboard";
      if (typeof pageOrRoute === "string") {
        if (PAGE_TO_ROUTE[pageOrRoute]) {
          targetRoute = PAGE_TO_ROUTE[pageOrRoute];
        } else if (pageOrRoute.startsWith("/")) {
          targetRoute = pageOrRoute;
        } else {
          targetRoute = `/${pageOrRoute}`;
        }
      }
      navigate(targetRoute);
      if (userRole) {
        saveActiveSession(userRole, targetRoute);
      }
    },
    [navigate, userRole]
  );

  // 1. Restaurar la sesión al montar el componente (F5 o navegación directa)
  useEffect(() => {
    const session = loadActiveSession();

    if (session) {
      if (session.expiredDueToInactivity) {
        setUserRole(null);
        navigate("/login", { replace: true });
      } else {
        setUserRole(session.userRole);
        // Si el usuario ingresa a la raíz "/" o a "/login" teniendo sesión activa válida:
        if (location.pathname === "/" || location.pathname === "/login") {
          const target = session.currentPage
            ? PAGE_TO_ROUTE[session.currentPage] || session.currentPage
            : "/dashboard";
          navigate(target, { replace: true });
        }
      }
    } else {
      if (
        location.pathname !== "/login" &&
        location.pathname !== "/forgot-password"
      ) {
        navigate("/login", { replace: true });
      }
    }
  }, []);

  // Guardar en la sesión la URL actual cada vez que cambia la ruta
  useEffect(() => {
    if (
      userRole &&
      location.pathname !== "/login" &&
      location.pathname !== "/forgot-password"
    ) {
      saveActiveSession(userRole, location.pathname);
    }
  }, [userRole, location.pathname]);

  // 2. Control de inactividad (5 minutos sin interacción -> Cierre automático)
  // Robusto ante suspensión de pantalla móvil, bloqueo de terminal, pestañas en segundo plano y multiventana.
  useEffect(() => {
    if (!userRole) return;

    const checkAndHandleSessionExpiration = () => {
      const session = loadActiveSession();
      if (session && session.expiredDueToInactivity) {
        saveInactivityProgress(userRole, location.pathname);
        clearActiveSession();
        setUserRole(null);
        navigate("/login", { replace: true });
        return true;
      }
      return false;
    };

    const handleUserActivity = () => {
      // Si la sesión ya superó los 5 minutos, cerrar de inmediato antes de que el toque resetee el timestamp
      if (isSessionExpired()) {
        checkAndHandleSessionExpiration();
        return;
      }
      touchLastActivity();
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
      "click",
    ];

    activityEvents.forEach((event) =>
      window.addEventListener(event, handleUserActivity, { passive: true })
    );

    // Revisar inmediatamente al volver a la pestaña, desbloquear teléfono o reactivar pantalla
    const handleDeviceWakeOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkAndHandleSessionExpiration();
      }
    };

    document.addEventListener("visibilitychange", handleDeviceWakeOrFocus);
    window.addEventListener("focus", handleDeviceWakeOrFocus);
    window.addEventListener("pageshow", handleDeviceWakeOrFocus);

    // Sincronización inmediata entre múltiples pestañas
    const handleStorageSync = (e) => {
      if (
        e.key === "authToken" ||
        e.key === "userRole" ||
        e.key === "lastActivityTimestamp"
      ) {
        checkAndHandleSessionExpiration();
      }
    };
    window.addEventListener("storage", handleStorageSync);

    // Verificación cíclica regular
    const timerInterval = setInterval(() => {
      checkAndHandleSessionExpiration();
    }, 3000);

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, handleUserActivity)
      );
      document.removeEventListener("visibilitychange", handleDeviceWakeOrFocus);
      window.removeEventListener("focus", handleDeviceWakeOrFocus);
      window.removeEventListener("pageshow", handleDeviceWakeOrFocus);
      window.removeEventListener("storage", handleStorageSync);
      clearInterval(timerInterval);
    };
  }, [userRole, location.pathname, navigate]);

  const handleLoginSuccess = (role, restoredPage, userData, token) => {
    const target = restoredPage
      ? PAGE_TO_ROUTE[restoredPage] || restoredPage
      : "/dashboard";
    setUserRole(role);
    saveActiveSession(role, target, userData, token);
    navigate(target, { replace: true });
  };

  const handleLogout = () => {
    performFullLogout();
    setUserRole(null);
    navigate("/login", { replace: true });
  };

  return (
    <Routes>
      {/* ─── Rutas Públicas ─── */}
      <Route
        path="/login"
        element={
          userRole ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthLogin
              onLoginSuccess={handleLoginSuccess}
              onNavigate={handleNavigate}
            />
          )
        }
      />
      <Route
        path="/forgot-password"
        element={
          userRole ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthForgotPassword onNavigate={handleNavigate} />
          )
        }
      />

      {/* ─── Rutas Autenticadas dentro del Layout Principal ─── */}
      <Route
        element={
          userRole ? (
            <DashboardLayoutWrapper
              userRole={userRole}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        {/* Rutas comunes para todos los roles autenticados */}
        <Route
          path="/dashboard"
          element={
            <DashboardHome userRole={userRole} onNavigate={handleNavigate} />
          }
        />
        <Route
          path="/change-password"
          element={
            <AuthChangePassword
              onNavigate={handleNavigate}
              userId="current"
              isAdminChange={false}
            />
          }
        />

        {/* ─── Módulos de Administrador ─── */}
        {/* ─── Módulos de Administrador y Super Administrador ─── */}
        {(userRole === "admin" || userRole === "superadmin") && (
          <>
            <Route
              path="/admin/users"
              element={<AdminUserManagement userRole={userRole} />}
            />
            <Route path="/admin/practices" element={<AdminPractices />} />
            <Route
              path="/admin/certificates"
              element={<AdminCertificateDesigner />}
            />
            <Route path="/admin/reports" element={<AdminReports />} />
            {userRole === "superadmin" && (
              <Route
                path="/admin/settings"
                element={<AdminInstitutionSettings />}
              />
            )}
          </>
        )}

        {/* ─── Módulos de Docente ─── */}
        {userRole === "docent" && (
          <>
            <Route path="/docent/practices" element={<DocentPractices />} />
            <Route path="/docent/certificates" element={<AdminCertificateDesigner />} />
            <Route path="/docent/reports" element={<AdminReports />} />
            <Route path="/docent/certificate-requests" element={<DocentCertificateRequests />} />
            <Route path="/docent/hours-compliance" element={<DocentHoursCompliance />} />
            <Route path="/docent/students" element={<DocentStudents />} />
            <Route
              path="/docent/evaluations"
              element={<DocentEvaluations />}
            />
            <Route
              path="/docent/communication"
              element={<DocentCommunication />}
            />
            <Route
              path="/docent/communication-students"
              element={<DocentStudentCommunication />}
            />
            <Route path="/docent/profile" element={<DocentProfile />} />
          </>
        )}

        {/* ─── Módulos de Estudiante ─── */}
        {userRole === "student" && (
          <>
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/practices" element={<StudentPractices />} />
            <Route
              path="/student/evaluations"
              element={<StudentEvaluations />}
            />
            <Route
              path="/student/certifications"
              element={<StudentCertifications />}
            />
            <Route
              path="/student/communication"
              element={<StudentDocentCommunication />}
            />
          </>
        )}

        {/* ─── Módulos de Auditor ─── */}
        {userRole === "auditor" && (
          <>
            <Route path="/auditor/hours-compliance" element={<AuditorHoursCompliance />} />
            <Route path="/auditor/reports" element={<Navigate to="/auditor/users" replace />} />
            <Route path="/auditor/users" element={<AuditorUserViewer />} />
            <Route
              path="/auditor/communication"
              element={<AuditorCommunication />}
            />
          </>
        )}

        {/* ─── Módulo Transversal de Historial (No visible para Superadmin) ─── */}
        {userRole !== "superadmin" && (
          <>
            <Route path="/history" element={<HistoryModule userRole={userRole} />} />
            <Route path="/admin/history" element={<HistoryModule userRole={userRole} />} />
            <Route path="/docent/history" element={<HistoryModule userRole={userRole} />} />
            <Route path="/student/history" element={<HistoryModule userRole={userRole} />} />

            {/* ─── Módulo Transversal de Historial de Certificados ─── */}
            <Route path="/certificate-history" element={<CertificateHistoryModule userRole={userRole} />} />
            <Route path="/admin/certificate-history" element={<CertificateHistoryModule userRole={userRole} />} />
            <Route path="/student/certificate-history" element={<CertificateHistoryModule userRole={userRole} />} />
          </>
        )}

        {/* Raíz redirige al dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Ruta no encontrada dentro de la sesión protegida */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Fallback global */}
      <Route
        path="*"
        element={<Navigate to={userRole ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
};

const ThemedToaster = () => {
  const { isDark } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={isDark ? "dark" : "light"}
      options={{
        fill: isDark ? "#18181b" : "#ffffff",
        position: "bottom-right",
        duration: 4000,
      }}
    />
  );
};

const AppWithTheme = () => (
  <ThemeProvider>
    <App />
    <ThemedToaster />
  </ThemeProvider>
);

export default AppWithTheme;
