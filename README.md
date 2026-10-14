# Sistema de Gestión de Prácticas Formativas en Salud — UPTC

Plataforma web integral para la administración, supervisión clínica, evaluación mediante rúbrica, bitácora de novedades, control de asistencias y certificación de prácticas formativas de la **Facultad de Ciencias de la Salud** de la **Universidad Pedagógica y Tecnológica de Colombia (UPTC)**.

---

## 🏛️ 1. Descripción General del Sistema

El sistema centraliza el ciclo de vida completo de los estudiantes en sus campos de rotación hospitalaria y comunitaria (Medicina, Enfermería, Psicología y demás programas del área de la salud). 

Permite coordinar de forma sincronizada a cinco actores clave:
1. **Superadministrador (`superadmin`)**: Control maestro de sedes, administradores y personalización institucional (logos, fondos de login, colores institucionales).
2. **Administrador de Facultad (`admin`)**: Gestión de programas académicos, asignaturas, instituciones de salud (IPS/hospitales), servicios clínicos, docentes, estudiantes, auditores hospitalarios y reportes globales.
3. **Docente Tutor (`docente` / `docent`)**: Creación y parametrización de prácticas, selección de los 10 criterios de rúbrica, seguimiento a estudiantes, calificación cuantitativa y cualitativa, bitácora de novedades, mensajería y aprobación de certificados.
4. **Auditor Clínico (`auditor`)**: Supervisión en sede hospitalaria, registro diario de asistencia por turno/horas, evaluación de desempeño y reportes diagnósticos privados para el docente.
5. **Estudiante (`estudiante` / `student`)**: Consulta de prácticas asignadas, horarios de rotación, seguimiento de horas acumuladas, visualización de evaluaciones, bandeja de comunicación con el docente tutor y solicitud/descarga de certificados de práctica.

---

## 🛠️ 2. Arquitectura Tecnológica

El proyecto está diseñado bajo una arquitectura desacoplada cliente-servidor (SPA + API RESTful):

### Frontend (`/FRONT`)
- **Framework:** React 18 (Single Page Application).
- **Enrutamiento:** React Router DOM v6 con carga diferida (`React.lazy` / `Suspense`).
- **Estilos y UI:** Tailwind CSS v3, Iconografía Lucide React, Glassmorphism, Modo Claro/Oscuro dinámico (`ThemeContext`).
- **Generación de Documentos:** `jspdf` para generación cliente de diplomas, carnets y constancias en PDF con firmas y sellos oficiales embebidos.
- **Importación/Exportación:** `xlsx` y `papaparse` para lectura y generación de plantillas Excel (.xlsx) y CSV (.csv).
- **Seguridad Cliente:** Interceptor global sobre `fetch` que valida orígenes de confianza (`isTrustedBackend`) antes de inyectar tokens JWT Bearer.

### Backend (`/BACK`)
- **Entorno de Ejecución:** Node.js con Express.js.
- **Base de Datos:** MySQL / MariaDB mediante pool de conexiones con `mysql2/promise` (soporta transacciones ACID y zona horaria de Colombia `UTC-5`).
- **Seguridad HTTP:** `helmet` para cabeceras seguras, `cors` configurado dinámicamente para entornos de producción (Vercel) y local.
- **Autenticación y Criptografía:** Tokens JWT (`jsonwebtoken`) con expiración configurable, hash de contraseñas mediante `bcryptjs` (10 rondas), generación de códigos criptográficamente seguros con `crypto.randomInt`.
- **Mitigación de Abuso:** `express-rate-limit` con configuración diferenciada para campus universitario (evita bloqueos por NAT/IP compartida mediante `skipSuccessfulRequests`).
- **Servicio de Correo:** Doble motor de mensajería (Resend vía HTTPS puerto 443 para la nube Render + Nodemailer SMTP para desarrollo local).
- **Manejo de Archivos:** `multer` configurado con `memoryStorage()` (almacenamiento en base de datos como `LONGBLOB` y Base64, desacoplado de discos efímeros).

---

## 📂 3. Estructura del Repositorio

```text
UPTC-PRACTICA/
├── README.md                      # Documentación maestra del proyecto
├── package.json                   # Scripts de orquestación concurrentes de la raíz
├── jsconfig.json                  # Mapeo de rutas de JavaScript
├── docs/                          # Scripts SQL y documentación técnica
│   └── database_schema_update.sql # Script de estructuración y normalización de BD
├── BACK/                          # Servidor Backend (Node.js + Express)
│   ├── server.js                  # Punto de entrada principal y configuración de middlewares
│   ├── package.json               # Dependencias del backend
│   ├── config/
│   │   ├── db.js                  # Pool de conexiones MySQL y transacciones ACID
│   │   ├── mailer.js              # Integración de correos Resend / Nodemailer
│   │   ├── resetCodeStore.js      # Almacén en memoria con límite anti-fuerza bruta para OTP
│   │   └── institutionSettings.json
│   ├── middleware/
│   │   ├── auth.js                # Verificación de JWT y roles (verifyToken, requireRole)
│   │   └── errorHandler.js        # Manejador global centralizado de excepciones
│   ├── routes/
│   │   ├── admin.routes.js        # CRUD catálogos, usuarios, importación masiva y prácticas
│   │   ├── docent.routes.js       # Calificación, rúbrica, asistencia, solicitudes y mensajería
│   │   ├── student.routes.js      # Perfil, carga de 6 documentos legales, prácticas y notas
│   │   ├── auditor.routes.js      # Registro hospitalario de asistencia y evaluaciones
│   │   ├── auth.routes.js         # Login, recuperación de clave con OTP y branding institucional
│   │   └── history.routes.js      # Histórico de prácticas archivadas y verificación de certificados
│   ├── services/
│   │   └── history.service.js     # Lógica de archivado y sincronización histórica
│   ├── utils/
│   │   └── evaluationRubric.js    # Definición de los 25 criterios y escalas de calificación
│   └── migrations/                # Scripts de evolución incremental de la base de datos
└── FRONT/                         # Aplicación Cliente (React)
    ├── package.json               # Dependencias del frontend
    ├── tailwind.config.js         # Configuración del motor de diseño Tailwind
    ├── vercel.json                # Configuración de reescritura para Single Page App en Vercel
    ├── public/                    # Archivos estáticos HTML y favicon
    └── src/
        ├── App.js                 # Enrutador principal y control de sesión
        ├── index.js               # Renderizado del DOM de React
        ├── styles.css             # Estilos globales y utilidades personalizadas
        ├── assets/                # Logos institucionales y sellos oficiales en Base64
        ├── components/
        │   ├── Admin/             # Módulos de administración, catálogos e importación CSV/Excel
        │   ├── Docent/            # Gestión docente, rúbricas de evaluación y certificados
        │   ├── Student/           # Vista del estudiante, certificados y 6 PDFs reglamentarios
        │   ├── Auditor/           # Formularios de asistencia y reportes de auditoría clínica
        │   ├── Auth/              # Vistas de Login, Olvido de contraseña y Cambio de clave
        │   ├── Dashboard/         # Barra de navegación adaptable por rol y paneles resumen
        │   ├── History/           # Módulos de consulta de rotaciones y certificados archivados
        │   └── Shared/            # Componentes reutilizables (Rúbrica, Horarios, Ficha, Skeletons)
        ├── context/               # Proveedor de tema claro/oscuro (ThemeContext)
        ├── config/                # Endpoint del backend (api.js)
        └── utils/                 # Utilidades cliente (generadores PDF, toast, axios, auth)
```

---

## 👥 4. Matriz de Roles y Funcionalidades

| Módulo / Funcionalidad | Superadmin | Admin | Docente | Auditor | Estudiante |
|---|:---:|:---:|:---:|:---:|:---:|
| **Personalización Institucional (Logos, Fondo Login)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Creación/Importación de Administradores** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Gestión de Programas, Asignaturas, Hospitales** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Importación Masiva Excel (Estudiantes, Docentes, Auditores)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Creación de Prácticas y Elección de 10 Criterios** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Edición de Horarios de Rotación** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Calificación mediante Rúbrica y Aprobación de Certificados** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Registro Hospitalario de Asistencia / Turnos** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Reportes Clínicos Hospitalarios (Privados)** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Subida de 6 Documentos Clínicos (EPS, ARL, Vacunas)** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Solicitud y Descarga de Certificados** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Mensajería Interna Estudiante ↔ Docente** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Consulta Histórica de Prácticas Finalizadas** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Verificación Pública de Certificados por QR / Código Hexadecimal** | 🌐 Público | 🌐 Público | 🌐 Público | 🌐 Público | 🌐 Público |

---

## 📊 5. Modelo de Datos y las 23 Tablas del Sistema

El esquema relacional cuenta con 23 tablas activas:

1. **`superadmin`**: Usuarios con control supremo del sistema.
2. **`administrador`**: Administradores de facultad y gestores de catálogo.
3. **`rol`**: Catálogo normalizado de los 5 roles (`superadmin`, `admin`, `docente`, `auditor`, `estudiante`).
4. **`programa`**: Carreras y pregrados (Medicina, Enfermería, etc.).
5. **`asignatura`**: Materias asociadas a cada programa.
6. **`institucion`**: Clínicas, hospitales e IPS en convenio docente-asistencial.
7. **`servicio`**: Especialidades y áreas hospitalarias (UCI, Urgencias, Pediatría, etc.).
8. **`docente`**: Cuentas institucionales de profesores tutores.
9. **`datos_docente`**: Teléfono, especialidad y firma digital del docente.
10. **`estudiante`**: Cuentas de alumnos con su código estudiantil y cédula.
11. **`datos_estudiante`**: Almacena en `LONGBLOB` los 6 documentos reglamentarios del estudiante (Hoja de vida, EPS, ARL, Cédula, Carnet estudiantil, Carnet de vacunas) y foto de perfil.
12. **`auditor`**: Supervisores de campo en las instituciones de salud.
13. **`practica`**: Rotaciones clínicas activas (cupos, fechas, horarios detallados y los 10 criterios de rúbrica seleccionados).
14. **`practica_estudiante`**: Matrícula de cada estudiante en una práctica, horas acumuladas, nota definitiva (0.0 a 5.0) y JSON con desglose de la rúbrica.
15. **`asistencia_estudiante`**: Registro diario de turnos asistidos o faltas con fecha y horas.
16. **`reporte_auditor`**: Evaluaciones hospitalarias registradas por el auditor (exclusivas para el tutor docente).
17. **`observacion_practica`**: Bitácora de incidencias, llamados de atención y notas entre roles.
18. **`mensaje_estudiante_docente`**: Canal de mensajería interna y retroalimentación académica.
19. **`solicitud_certificado`**: Trámite operativo previo entre el alumno y el docente.
20. **`historial_certificado`**: **Instantánea histórica inmutable** de certificados expedidos. Guarda el snapshot congelado con un código hexadecimal criptográfico único (`id_hex`) de 16 caracteres. Garantiza que si un estudiante o práctica se modifica o archiva años después, su certificado oficial jamás se alterará ni se perderá.
21. **`historial_practica`**: Repositorio de prácticas archivadas de semestres anteriores.
22. **`historial_practica_estudiante`**: Registro histórico de notas y horas de alumnos en prácticas archivadas.
23. **`institucion_educativa`**: Configuración institucional (UPTC, NIT, dirección, logos en Base64 y fondo de pantalla).

---

## 🎯 6. Rúbrica de Evaluación Clínica

El sistema incorpora un banco de **25 criterios de competencias clínicas, actitudinales y éticas**. Al crear o editar una práctica, el docente o administrador selecciona exactamente **10 criterios**, los cuales determinan la evaluación del estudiante:

- **Escala de Desempeño:**
  - `Siempre`: **0.5 pts**
  - `Casi siempre`: **0.4 pts**
  - `En ocasiones`: **0.3 pts**
  - `Rara vez`: **0.2 pts**
  - `No cumple`: **0.1 pts**
- **Calificación Definitiva:** La sumatoria exacta de los 10 criterios seleccionados produce la nota final en escala oficial colombiana de **1.0 a 5.0** (o 0.0 si el estudiante no completó requisitos).

---

## 🚀 7. Guía de Puesta en Marcha Local

### Prerrequisitos
- Node.js versión 18 o superior.
- Servidor MySQL activo (local mediante XAMPP/WAMP o remoto).

### 1. Clonar e Instalar Dependencias
```bash
# Instalar dependencias raíz y submódulos
npm run install:all
```

### 2. Configurar Variables de Entorno

**Backend (`/BACK/.env`):**
```env
PORT=4004
NODE_ENV=development
FRONTEND_URL=http://localhost:3003

# Conexión a Base de Datos MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=u241712700_Practica
DB_CONNECTION_LIMIT=30
DB_CONNECT_TIMEOUT=20000

# Seguridad JWT
JWT_SECRET=tu_secreto_criptografico_seguro
JWT_EXPIRES_IN=8h

# Envío de Correos (Resend y/o SMTP)
RESEND_API_KEY=re_tu_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_clave_de_aplicacion
```

**Frontend (`/FRONT/.env`):**
```env
REACT_APP_BACKEND_URL=http://localhost:4004
PORT=3003
```

### 3. Ejecución en Desarrollo
```bash
# Ejecutar Backend y Frontend en simultáneo desde la raíz:
npm run dev

# O de forma independiente:
npm run dev:back   # Levanta Express en http://localhost:4004
npm run dev:front  # Levanta React en http://localhost:3003
```

---

## 🌐 8. Despliegue en Producción

- **Frontend:** Diseñado para **Vercel**. El archivo `FRONT/vercel.json` incluye las reglas de reescritura para gestionar el enrutamiento del lado del cliente (`/* -> /index.html`).
- **Backend:** Listo para contenedores en **Render / Railway / VPS**. Compatible con proxies reversos (`app.set("trust proxy", 1)`).
- **Assets Desacoplados:** Los logos institucionales predeterminados se encuentran integrados en Base64, evitando errores de compilación por rutas relativas o sistemas de archivos efímeros en la nube.

---

## 🔒 9. Seguridad y Mejores Prácticas Implementadas

1. **Prevención de SQL Injection:** 100% de las consultas a la base de datos se ejecutan de forma parametrizada a través de `mysql2/promise`.
2. **Defensa contra IDOR:** Los endpoints sensibles de estudiantes y docentes fuerzan la cédula del usuario contenida en el token JWT verificado, impidiendo la manipulación de identificadores ajenos.
3. **Control Estricto de Privilegios Verticales:** Solo usuarios con rol `superadmin` pueden crear o importar masivamente cuentas con rol `admin` o `superadmin`.
4. **Almacenamiento Seguro de Contraseñas:** Encriptación unidireccional obligatoria con `bcryptjs` de 10 rondas; migración automática de credenciales legadas en texto plano al primer inicio de sesión.
5. **Rate Limiting Contextual:** Protección de las rutas de inicio de sesión contra ataques de fuerza bruta (`authLimiter`), sin penalizar a usuarios legítimos dentro de la misma subred universitaria (`skipSuccessfulRequests: true`).
6. **Tokens OTP Efímeros:** Códigos de recuperación de contraseña de 6 dígitos generados mediante `crypto.randomInt`, con caducidad estricta de 15 minutos y revocación automática tras 5 intentos fallidos.
