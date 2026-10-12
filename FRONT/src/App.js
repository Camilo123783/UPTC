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

import { Clock } from "lucide-react";

// Módulos críticos inmediatos (Carga directa)
import AuthChangePassword from "./components/Auth/AuthChangePassword";
import AuthForgotPassword from "./components/Auth/AuthForgotPassword";
import AuthLogin from "./components/Auth/Login";
import DashboardHome from "./components/Dashboard/DashboardHome";
import DashboardNavBar from "./components/Dashboard/DashboardNavBar";

// Carga diferida inteligente (Code Splitting con React.lazy para optimizar rendimiento)
const AdminCertificateDesigner = React.lazy(() => import("./components/Admin/AdminCertificateDesigner"));
const AdminInstitutionSettings = React.lazy(() => import("./components/Admin/AdminInstitutionSettings"));
const AdminPractices = React.lazy(() => import("./components/Admin/AdminPractices"));
const AdminReports = React.lazy(() => import("./components/Admin/AdminReports"));
const AdminUserManagement = React.lazy(() => import("./components/Admin/AdminUserManagement"));

const AuditorReports = React.lazy(() => import("./components/Auditor/AuditorReports"));
const AuditorUserViewer = React.lazy(() => import("./components/Auditor/AuditorUserViewer"));
const AuditorHoursCompliance = React.lazy(() => import("./components/Auditor/AuditorHoursCompliance"));
const AuditorCommunication = React.lazy(() => import("./components/Auditor/AuditorCommunication"));

const DocentEvaluations = React.lazy(() => import("./components/Docent/DocentEvaluations"));
const DocentPractices = React.lazy(() => import("./components/Docent/DocentPractices"));
const DocentStudents = React.lazy(() => import("./components/Docent/DocentStudents"));
const DocentHoursCompliance = React.lazy(() => import("./components/Docent/DocentHoursCompliance"));
const DocentCertificateRequests = React.lazy(() => import("./components/Docent/DocentCertificateRequests"));
const DocentCommunication = React.lazy(() => import("./components/Docent/DocentCommunication"));
const DocentStudentCommunication = React.lazy(() => import("./components/Docent/DocentStudentCommunication"));
const DocentProfile = React.lazy(() => import("./components/Docent/DocentProfile"));

const StudentCertifications = React.lazy(() => import("./components/Student/StudentCertifications"));
const StudentEvaluations = React.lazy(() => import("./components/Student/StudentEvaluations"));
const StudentPractices = React.lazy(() => import("./components/Student/StudentPractices"));
const StudentProfile = React.lazy(() => import("./components/Student/StudentProfile"));
const StudentDocentCommunication = React.lazy(() => import("./components/Student/StudentDocentCommunication"));

const HistoryModule = React.lazy(() => import("./components/History/HistoryModule"));
const CertificateHistoryModule = React.lazy(() => import("./components/History/CertificateHistoryModule"));

import {
  loadActiveSession,
  saveActiveSession,
  touchLastActivity,
  performFullLogout,
  saveInactivityProgress,
  clearActiveSession,
  isSessionExpired,
  INACTIVITY_WARNING_MS,
  getInactivityRemainingMs,
  resetInactivityTimer,
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
  if (pathname.startsWith("/docent/profile")) return "docentProfile";

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

// Obtener el título descriptivo para la pestaña y el menú de navegación/devolver del navegador
export const getPageTitle = (pathname, userRole) => {
  if (!pathname) return "Gestor de Prácticas - UPTC";

  // Historial
  if (pathname.includes("/certificate-history")) {
    return "Historial de Certificados - Gestor de Prácticas";
  }
  if (pathname.includes("/history")) {
    return "Historial de Prácticas - Gestor de Prácticas";
  }

  // Rutas Administrador
  if (pathname.startsWith("/admin/users")) {
    return "Gestión de Usuarios - Gestor de Prácticas";
  }
  if (pathname.startsWith("/admin/practices")) {
    return "Gestión de Prácticas - Gestor de Prácticas";
  }
  if (pathname.startsWith("/admin/certificates")) {
    return "Diseñar Certificados - Gestor de Prácticas";
  }
  if (pathname.startsWith("/admin/reports")) {
    return "Reportes y Constancias - Gestor de Prácticas";
  }
  if (pathname.startsWith("/admin/settings")) {
    return "Configuración Institucional - Gestor de Prácticas";
  }

  // Rutas Docente
  if (pathname.startsWith("/docent/practices")) {
    return "Mis Prácticas - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/students")) {
    return "Estudiantes a Cargo - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/hours-compliance")) {
    return "Cumplimiento de Horas - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/certificate-requests")) {
    return "Solicitud de Certificados - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/certificates")) {
    return "Diseñar Certificados - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/reports")) {
    return "Reportes y Constancias - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/evaluations")) {
    return "Evaluaciones Formativas - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/communication-students")) {
    return "Comunicación con el Estudiante - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/communication")) {
    return "Comunicación con el Auditor - Gestor de Prácticas";
  }
  if (pathname.startsWith("/docent/profile")) {
    return "Mi Perfil - Gestor de Prácticas";
  }

  // Rutas Estudiante
  if (pathname.startsWith("/student/profile")) {
    return "Mi Perfil - Gestor de Prácticas";
  }
  if (pathname.startsWith("/student/practices")) {
    return "Mis Prácticas - Gestor de Prácticas";
  }
  if (pathname.startsWith("/student/evaluations")) {
    return "Evaluaciones - Gestor de Prácticas";
  }
  if (pathname.startsWith("/student/certifications")) {
    return "Solicitud de Certificados - Gestor de Prácticas";
  }
  if (pathname.startsWith("/student/communication")) {
    return "Comunicación con el Docente - Gestor de Prácticas";
  }

  // Rutas Auditor
  if (pathname.startsWith("/auditor/hours-compliance")) {
    return "Cumplimiento de Horas - Gestor de Prácticas";
  }
  if (pathname.startsWith("/auditor/users")) {
    return "Visualizar Usuarios - Gestor de Prácticas";
  }
  if (pathname.startsWith("/auditor/reports")) {
    return "Reportes y Auditoría - Gestor de Prácticas";
  }
  if (pathname.startsWith("/auditor/communication")) {
    return "Comunicación con el Docente - Gestor de Prácticas";
  }

  // Rutas de Autenticación
  if (pathname.startsWith("/login")) {
    return "Iniciar Sesión - Gestor de Prácticas";
  }
  if (pathname.startsWith("/forgot-password")) {
    return "Recuperar Contraseña - Gestor de Prácticas";
  }
  if (pathname.startsWith("/change-password")) {
    return "Cambiar Contraseña - Gestor de Prácticas";
  }

  // Dashboard
  if (pathname.startsWith("/dashboard") || pathname === "/") {
    return "Dashboard - Gestor de Prácticas";
  }

  return "Gestor de Prácticas - UPTC";
};

// Fallback animado durante la carga diferida de vistas (Code Splitting)
const RouteLoadingFallback = () => (
  <div className="w-full h-full p-6 space-y-6 animate-pulse select-none">
    <div className="h-20 w-full rounded-3xl bg-gray-100 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/50" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div className="h-28 rounded-2xl bg-gray-100 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/50" />
      <div className="h-28 rounded-2xl bg-gray-100 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/50" />
      <div className="h-28 rounded-2xl bg-gray-100 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/50" />
    </div>
    <div className="h-72 w-full rounded-3xl bg-gray-100 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/50" />
  </div>
);

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
      <React.Suspense fallback={<RouteLoadingFallback />}>
        <Outlet />
      </React.Suspense>
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

  // Estado para modal preventivo de inactividad (countdown en segundos cuando quedan <= 2 min)
  const [inactivityWarningSeconds, setInactivityWarningSeconds] = useState(null);

  const handleKeepSessionActive = useCallback(() => {
    resetInactivityTimer();
    setInactivityWarningSeconds(null);
  }, []);

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

  // Actualizar document.title dinámicamente con el nombre exacto de la sección actual
  // para que el historial y el botón de devolver del navegador muestren dónde estaba el usuario
  useEffect(() => {
    const title = getPageTitle(location.pathname, userRole);
    document.title = title;
  }, [location.pathname, userRole]);

  // 2. Control de inactividad (25 minutos con advertencia preventiva a los 23 minutos)
  // Robusto ante suspensión de pantalla móvil, bloqueo de terminal, pestañas en segundo plano y multiventana.
  useEffect(() => {
    if (!userRole) return;

    const checkAndHandleSessionExpiration = () => {
      if (isSessionExpired()) {
        setInactivityWarningSeconds(null);
        saveInactivityProgress(userRole, location.pathname);
        clearActiveSession();
        setUserRole(null);
        navigate("/login", { replace: true });
        return true;
      }

      // Advertencia preventiva en los últimos 2 minutos
      const remainingMs = getInactivityRemainingMs();
      if (remainingMs <= INACTIVITY_WARNING_MS && remainingMs > 0) {
        setInactivityWarningSeconds(Math.ceil(remainingMs / 1000));
      } else {
        setInactivityWarningSeconds(null);
      }
      return false;
    };

    const handleUserActivity = () => {
      if (isSessionExpired()) {
        checkAndHandleSessionExpiration();
        return;
      }
      touchLastActivity();
      const remainingMs = getInactivityRemainingMs();
      if (remainingMs > INACTIVITY_WARNING_MS) {
        setInactivityWarningSeconds(null);
      }
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
    <>
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

      {/* ─── Modal Preventivo de Advertencia de Inactividad ─── */}
      {inactivityWarningSeconds !== null && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
          <div className="bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-600/60 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 animate-pulse text-amber-500" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">
              ¿Sigues ahí? Tu sesión está por expirar
            </h3>
            <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2">
              Por seguridad institucional, tu sesión se cerrará automáticamente en:
            </p>
            <div className="text-3xl font-mono font-black text-amber-500 my-4 tracking-wider">
              {Math.floor(inactivityWarningSeconds / 60)}:
              {String(inactivityWarningSeconds % 60).padStart(2, "0")}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-500 mb-5">
              Haz clic en "Continuar trabajando" para renovar tu sesión y no perder ningún avance.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-zinc-300 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Cerrar Sesión
              </button>
              <button
                type="button"
                onClick={handleKeepSessionActive}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                Continuar trabajando
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
