# 🏥 Sistema de Gestión de Prácticas Formativas en Salud — UPTC

> **Universidad Pedagógica y Tecnológica de Colombia**  
> Facultad de Ciencias de la Salud — Escuela de Enfermería / Medicina  
> Plataforma Fullstack para la gestión clínica, seguimiento de rotaciones, control de horas, evaluaciones y emisión de certificados.

---

## 📌 Tabla de Contenidos
1. [Descripción del Proyecto](#-descripción-del-proyecto)
2. [Estructura del Proyecto](#-estructura-del-proyecto)
3. [Desarrollo Local](#-desarrollo-local)
4. [Despliegue en Producción (Vercel + Render + MySQL)](#-despliegue-en-producción-vercel--render--mysql)
   - [Paso 1: Base de Datos (MySQL Remoto)](#paso-1-base-de-datos-mysql-remoto)
   - [Paso 2: Despliegue del Backend en Render](#paso-2-despliegue-del-backend-en-render)
   - [Paso 3: Despliegue del Frontend en Vercel](#paso-3-despliegue-del-frontend-en-vercel)
5. [Variables de Entorno](#-variables-de-entorno)
6. [Seguridad y Buenas Prácticas](#-seguridad-y-buenas-prácticas)

---

## 📖 Descripción del Proyecto

Sistema institucional diseñado para modernizar y digitalizar el ciclo de vida de las prácticas formativas y profesionales en el área de la salud de la UPTC:
- **Administrador:** Parametrización de programas, asignaturas, entidades hospitalarias, servicios, docentes y estudiantes.
- **Docente:** Supervisión clínica, registro de horas, evaluación formativa y retroalimentación directa.
- **Estudiante:** Consulta de rotaciones, cumplimiento en tiempo real de horas, calificaciones y solicitud de certificados.
- **Auditor:** Verificación externa de asistencia, consulta de rotaciones y generación de informes de calidad.

---

## 📂 Estructura del Proyecto

```text
UPTC-PRACTICA/
├── BACK/                         # API REST (Node.js + Express + MySQL)
│   ├── config/                   # Conexión DB pool, Mailer SMTP, configuraciones
│   ├── middleware/               # Autenticación JWT y manejo centralizado de errores
│   ├── migrations/               # Migraciones de base de datos
│   ├── routes/                   # Rutas: admin, auditor, auth, docent, student
│   ├── uploads/                  # Directorio local de subidas (.gitkeep)
│   ├── .env.example              # Plantilla de variables de entorno para Render
│   ├── package.json              # Dependencias y scripts del backend
│   └── server.js                 # Punto de entrada Express
│
├── FRONT/                        # Cliente Web SPA (React 18 + Tailwind CSS)
│   ├── public/                   # Recursos estáticos públicos
│   ├── src/
│   │   ├── assets/               # Logos oficiales UPTC y plantillas
│   │   ├── components/           # Componentes organizados por Rol (Admin, Docent, etc.)
│   │   ├── config/api.js         # Configuración centralizada de URLs de la API
│   │   ├── context/              # Contextos globales (ThemeContext)
│   │   ├── utils/                # Utilidades de sesión, PDF, Excel y auth
│   │   ├── App.js                # Enrutador principal de la aplicación
│   │   └── index.js              # Punto de entrada de React
│   ├── .env.example              # Plantilla de variables para Vercel
│   ├── vercel.json               # Configuración de reescrituras para React Router SPA
│   └── package.json              # Dependencias y scripts del frontend
│
├── docs/
│   └── database_schema_update.sql# Script DDL de base de datos MySQL
│
├── .gitignore                    # Reglas de exclusión para GitHub (secretos, cachés, etc.)
├── package.json                  # Script raíz para arrancar ambos servicios en simultáneo
└── README.md                     # Guía maestra del proyecto
```

---

## 💻 Desarrollo Local

### 1. Clonar e Instalar
```bash
git clone https://github.com/tu-usuario/UPTC-PRACTICA.git
cd UPTC-PRACTICA

# Instalar dependencias en BACK y FRONT con un solo comando
npm run install:all
```

### 2. Configurar Variables de Entorno Locales
- En `BACK/`: Copia `.env.example` a `.env` y coloca tus credenciales locales o remotas de MySQL.
- En `FRONT/`: Copia `.env.example` a `.env` con `REACT_APP_BACKEND_URL=http://localhost:4004`.

### 3. Ejecutar
```bash
npm run dev
```
- Backend disponible en: `http://localhost:4004`
- Frontend disponible en: `http://localhost:3003`

---

## 🚀 Despliegue en Producción (Vercel + Render + MySQL)

### Paso 1: Base de Datos (MySQL Remoto)
Si utilizas **Hostinger** (o cualquier proveedor MySQL externo):
1. Ingresa a tu panel de control de Hostinger (**hPanel**) -> **Bases de Datos** -> **MySQL Remoto**.
2. En el campo **IP**, ingresa `%` (comodín) para permitir conexiones seguras desde Render (cuyas IPs son dinámicas).
3. Asegúrate de haber importado el archivo [`docs/database_schema_update.sql`](docs/database_schema_update.sql).

---

### Paso 2: Despliegue del Backend en Render

1. Ve a [Render.com](https://render.com) e inicia sesión.
2. Crea un nuevo **Web Service** y conecta tu repositorio de GitHub.
3. Configura los siguientes campos:
   - **Name:** `uptc` (para que Render genere `https://uptc.onrender.com`).
   - **Root Directory:** `BACK`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
4. En la sección **Environment Variables**, añade:
   | Variable | Valor |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` *(Render lo asigna automáticamente)* |
   | `FRONTEND_URL` | `https://tu-frontend.vercel.app` *(Tu dominio en Vercel)* |
   | `DB_HOST` | `srv655.hstgr.io` *(Host de tu MySQL)* |
   | `DB_USER` | `tu_usuario_mysql` |
   | `DB_PASSWORD` | `tu_password_mysql` |
   | `DB_NAME` | `tu_base_de_datos` |
   | `DB_CONNECTION_LIMIT` | `10` |
   | `DB_CONNECT_TIMEOUT` | `20000` |
   | `JWT_SECRET` | *(Clave secreta segura de 64 caracteres)* |
   | `JWT_EXPIRES_IN` | `8h` |
   | `ADMIN_EMAIL` | `tu_correo_notificaciones@uptc.edu.co` |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | `tu_correo_remitente@gmail.com` |
   | `SMTP_PASS` | `tu_contraseña_de_aplicacion_gmail` |
5. Haz clic en **Deploy Web Service**.
6. Copia la URL pública generada por Render (ejemplo: `https://uptc.onrender.com`).

---

### Paso 3: Despliegue del Frontend en Vercel

1. Ve a [Vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add New...** -> **Project** e importa el repositorio.
3. En la configuración del proyecto (**Project Settings**):
   - **Framework Preset:** `Create React App`
   - **Root Directory:** Haz clic en *Edit* y selecciona **`FRONT`**.
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
4. En **Environment Variables**, agrega:
   | Variable | Valor |
   | :--- | :--- |
   | `REACT_APP_BACKEND_URL` | `https://uptc.onrender.com` *(URL de tu backend en Render)* |
   | `REACT_APP_API_URL` | `https://uptc.onrender.com/api` |
5. Haz clic en **Deploy**.
6. El archivo [`FRONT/vercel.json`](FRONT/vercel.json) configurará automáticamente las reescrituras de URL para que la navegación con React Router funcione al recargar cualquier página.
7. Una vez desplegado, copia la URL de Vercel (ejemplo: `https://uptc-practica.vercel.app`) y actualiza la variable `FRONTEND_URL` en Render para asegurar la sincronización CORS.

---

## 🛡️ Seguridad y Buenas Prácticas

- **Ningún secreto en el repositorio:** Los archivos `.env` reales están excluidos en `.gitignore` y nunca se suben a GitHub.
- **Sin archivos innecesarios:** Directorios de caché (`.agent/`, `__pycache__/`, `node_modules/`, `build/`, `docs/security/`) no forman parte del control de versiones.
- **Protección CORS:** El backend en Render autoriza automáticamente peticiones provenientes del dominio de Vercel.
- **Persistencia de subidas:** En despliegues sin disco persistente, el backend crea la carpeta `uploads/` de forma preventiva para asegurar la disponibilidad del servicio.
#   U P T C  
 #   U P T C  
 