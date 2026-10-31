// ============================================================
// server.js — Punto de entrada del backend UPTC
// ============================================================
"use strict";
process.env.TZ = "America/Bogota";

// ── 1. Variables de entorno (siempre primero) ───────────────
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");

// ── 2. Módulos internos ────────────────────────────────────
const authRoutes    = require("./routes/auth.routes");
const adminRoutes   = require("./routes/admin.routes");
const studentRoutes = require("./routes/student.routes");
const docentRoutes  = require("./routes/docent.routes");
const auditorRoutes = require("./routes/auditor.routes");
const historyRoutes = require("./routes/history.routes");
const errorHandler  = require("./middleware/errorHandler");

// ── 3. Inicialización ──────────────────────────────────────
const app  = express();
app.set("trust proxy", 1); // Soporte para Render y reverse proxies
const PORT = process.env.PORT || 4004;

// ── 4. Seguridad — Helmet (headers HTTP seguros) ───────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── 5. CORS — Validación estricta de origen mediante URL parser ───
const rawFrontendUrls = [
  process.env.FRONTEND_URL || "http://localhost:3003",
  process.env.ALLOWED_ORIGIN || "",
]
  .filter(Boolean)
  .join(",");

const allowedOrigins = rawFrontendUrls
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin encabezado origin (ej: curl, health-check de Render)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.trim().replace(/\/+$/, "");
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      try {
        const parsed = new URL(normalizedOrigin);
        const hostname = parsed.hostname.toLowerCase();

        // Permitir localhost y loopback en cualquier puerto
        if (hostname === "localhost" || hostname === "127.0.0.1") {
          return callback(null, true);
        }

        // Permitir red local en entorno de desarrollo
        if (
          process.env.NODE_ENV !== "production" &&
          /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)
        ) {
          return callback(null, true);
        }

        // Permitir subdominios de Vercel si se habilita o si coincide con el proyecto configurado en FRONTEND_URL
        if (hostname.endsWith(".vercel.app")) {
          const configuredVercelHost = allowedOrigins
            .map((o) => {
              try {
                return new URL(o).hostname.toLowerCase();
              } catch (e) {
                return "";
              }
            })
            .find((h) => h.endsWith(".vercel.app"));

          if (
            process.env.ALLOW_VERCEL_PREVIEWS === "true" ||
            !configuredVercelHost ||
            hostname === configuredVercelHost ||
            hostname.startsWith(configuredVercelHost.replace(".vercel.app", ""))
          ) {
            return callback(null, true);
          }
        }
      } catch (e) {
        // URL malformada
      }

      const corsErr = new Error(`CORS bloqueado para el origen: ${origin}`);
      corsErr.statusCode = 403;
      return callback(corsErr, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const compression = require("compression");

// ── 6. Compresión HTTP (Gzip/Brotli para alto volumen) ─────
app.use(compression());

// ── 6.1 Rate Limiting — optimizado para concurrencia institucional ─────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,                  // Margen amplio para campus con NAT/proxy compartido
  skipSuccessfulRequests: true, // No penaliza accesos correctos
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiados intentos fallidos de autenticación. Por favor espera unos minutos.",
  },
});

// Rate limiter estricto para recuperación de contraseña (no omite respuestas 200 OK)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // Máximo 10 solicitudes de código OTP por ventana
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Has solicitado demasiados códigos de recuperación. Por favor espera 15 minutos antes de intentar nuevamente.",
  },
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 2500,                // 2500 peticiones por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiadas solicitudes simultáneas. Por favor intenta más tarde.",
  },
});

app.use(generalLimiter);

// ── 7. Parsers ─────────────────────────────────────────────
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ── 7.1 Archivos estáticos (uploads) ───────────────────────
const fs   = require("fs");
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(uploadsDir)
);

// ── 8. Ruta de salud (health check) ──────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 El servidor backend de UPTC está funcionando.",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── 9. Montaje de rutas ────────────────────────────────────
app.use("/api/login", authLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth", authLimiter);
app.use("/api", authRoutes);                       // /api/login, /api/auth/...
app.use("/api/admin", adminRoutes);                // /api/admin/...
app.use("/api/student", studentRoutes);            // /api/student/...
app.use("/api/docent", docentRoutes);              // /api/docent/...
app.use("/api/auditor", auditorRoutes);            // /api/auditor/...
app.use("/api/history", historyRoutes);            // /api/history/...

// ── 10. Ruta 404 — recurso no encontrado ──────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// ── 11. Manejador global de errores (siempre al final) ────
app.use(errorHandler);

// ── 12. Arranque del servidor y tareas en segundo plano ────
app.listen(PORT, () => {
  console.log("=".repeat(55));
  console.log(`🚀  Servidor UPTC corriendo en http://localhost:${PORT}`);
  console.log(`⚙️   Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐  CORS permitido para: ${allowedOrigins.join(", ")}`);
  console.log("=".repeat(55));

  // Asegurar migración de campo 'activo' en tablas de usuarios
  try {
    const { runMigration } = require("./migrations/migrate_v5_user_active_status");
    runMigration().catch((e) => console.warn("Aviso en migración v5:", e.message));
  } catch (err) {
    console.warn("Aviso al invocar migración v5:", err.message);
  }

  // Sincronización automática de prácticas (inicial y periódica cada 15 min)
  try {
    const { syncPracticeStatuses } = require("./services/practiceSync.service");
    syncPracticeStatuses().catch((e) => console.warn("Aviso en sincronización inicial de prácticas:", e.message));

    const syncInterval = setInterval(() => {
      syncPracticeStatuses().catch((e) => console.warn("Aviso en sincronización periódica de prácticas:", e.message));
    }, 15 * 60 * 1000);

    if (syncInterval.unref) {
      syncInterval.unref();
    }
  } catch (syncErr) {
    console.warn("Aviso al inicializar sincronizador de prácticas:", syncErr.message);
  }
});

// ── 13. Resiliencia del proceso ante excepciones no controladas ──
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ [CRITICAL] Promesa no manejada (Unhandled Rejection):", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ [CRITICAL] Excepción no capturada (Uncaught Exception):", error);
});
