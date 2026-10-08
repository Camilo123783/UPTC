// ============================================================
// config/db.js — Conexión a MySQL con mysql2/promise (Pool)
// ============================================================
"use strict";

require("dotenv").config();
const mysql = require("mysql2/promise");

// ──────────────────────────────────────────────
// Pool de conexiones usando variables de entorno
// ──────────────────────────────────────────────
// Resolver host de DB (soporta IP directa para evitar fallos de DNS CNAME en Node.js)
const dbHost = process.env.DB_HOST === "srv655.hstgr.io" ? "195.35.61.122" : (process.env.DB_HOST || "localhost");

const pool = mysql.createPool({
  host: dbHost,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: "-05:00",
  dateStrings: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 20000,
  waitForConnections: true,
  queueLimit: 0,
});

// Forzar zona horaria de Colombia (UTC-5) en cada conexión del pool
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '-05:00'");
});

/**
 * Retorna la fecha actual en hora de Colombia (UTC-5) en formato YYYY-MM-DD
 */
function getColombiaToday() {
  const d = new Date();
  const colombiaDate = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const year = colombiaDate.getUTCFullYear();
  const month = String(colombiaDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(colombiaDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


// ──────────────────────────────────────────────
// Probar la conexión al iniciar
// ──────────────────────────────────────────────
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Conexión exitosa a la base de datos MySQL (Pool activo).");
    connection.release();
  } catch (err) {
    console.error("❌ ERROR CRÍTICO: No se pudo conectar a la base de datos.");
    console.error(`   Código de error: ${err.code}`);
    console.error(`   Mensaje: ${err.message}`);
    // No cerramos el proceso; el pool reintentará automáticamente
  }
}

testConnection();

// ──────────────────────────────────────────────
// Helper: ejecutar queries con async/await
// ──────────────────────────────────────────────
/**
 * Ejecuta una consulta SQL con parámetros.
 * @param {string} sql    - Consulta SQL con placeholders `?`
 * @param {Array}  values - Valores para los placeholders
 * @returns {Promise<Array>} Filas del resultado
 */
async function queryDB(sql, values = []) {
  const [rows] = await pool.execute(sql, values);
  return rows;
}

module.exports = { pool, queryDB, getColombiaToday };
