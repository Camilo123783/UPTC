// ============================================================
// server.js — Punto de entrada del backend UPTC
// ============================================================
"use strict";

// ── 1. Variables de entorno (siempre primero) ───────────────
require("dotenv").config();

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
const errorHandler  = require("./middleware/errorHandler");

// ── 3. Inicialización ──────────────────────────────────────
const app  = express();
app.set("trust proxy", 1); // ✅ Soporte para Render y reverse proxies (evita advertencia de express-rate-limit)
const PORT = process.env.PORT || 4004;

// ── 4. Seguridad — Helmet (headers HTTP seguros) ───────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── 5. CORS — flexible para Vercel, Render y Desarrollo Local ───
const rawFrontendUrls = process.env.FRONTEND_URL || "http://localhost:3003";
const allowedOrigins = rawFrontendUrls.split(",").map((url) => url.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin encabezado origin (ej: Postman, curl, health-check de Render)
      if (!origin) return callback(null, true);

      // Permitir si está en la lista configurada, si es preview de Vercel o localhost
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS bloqueado para el origen: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ── 6. Rate Limiting — protección contra fuerza bruta ─────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,                  // límite amplio para desarrollo
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiados intentos de autenticación. Por favor espera unos minutos.",
  },
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000,                // 1000 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiadas solicitudes. Por favor intenta más tarde.",
  },
});

app.use(generalLimiter);

// ── 7. Parsers ─────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── 7.1 Archivos estáticos (uploads) ───────────────────────
const path = require("path");
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
// Auth limiter solo en las rutas de autenticación (login y cambio de clave)
app.use("/api/login", authLimiter);
app.use("/api/auth", authLimiter);
app.use("/api", authRoutes);                       // /api/login, /api/auth/...
app.use("/api/admin", adminRoutes);                // /api/admin/...
app.use("/api/student", studentRoutes);            // /api/student/...
app.use("/api/docent", docentRoutes);              // /api/docent/...
app.use("/api/auditor", auditorRoutes);            // /api/auditor/...

// ── 10. Ruta 404 — recurso no encontrado ──────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// ── 11. Manejador global de errores (siempre al final) ────
app.use(errorHandler);

// ── 12. Arranque del servidor ─────────────────────────────
app.listen(PORT, () => {
  console.log("=".repeat(55));
  console.log(`🚀  Servidor UPTC corriendo en http://localhost:${PORT}`);
  console.log(`⚙️   Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐  CORS permitido para: ${process.env.FRONTEND_URL}`);
  console.log("=".repeat(55));

  // Asegurar migración de campo 'activo' en tablas de usuarios
  try {
    const { runMigration } = require("./migrations/migrate_v5_user_active_status");
    runMigration().catch((e) => console.warn("Aviso en migración v5:", e.message));
  } catch (err) {
    console.warn("Aviso al invocar migración v5:", err.message);
  }
});
