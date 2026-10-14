# Sistema de Gestión de Prácticas Formativas en Salud — UPTC

Sistema integral de gestión, supervisión, auditoría y certificación de prácticas formativas y rotaciones clínicas para la **Facultad de Ciencias de la Salud de la Universidad Pedagógica y Tecnológica de Colombia (UPTC)**.

---

## 🏛️ Arquitectura del Proyecto

El sistema está estructurado como un monorepositorio con separación clara entre backend y frontend:

```
UPTC-PRACTICA/
├── BACK/                         # Servidor Backend (Node.js + Express)
│   ├── config/                   # Conexión a Base de Datos MySQL y SMTP
│   ├── middleware/               # Autenticación JWT, RBAC y Manejo de Errores
│   ├── migrations/               # Scripts de migración y esquema de base de datos
│   ├── routes/                   # Controladores y Endpoints de API REST
│   │   ├── admin.routes.js       # Administración de usuarios, sedes y configuración
│   │   ├── auditor.routes.js     # Seguimiento y auditoría hospitalaria en sitio
│   │   ├── auth.routes.js        # Autenticación, JWT y recuperación segura
│   │   ├── docent.routes.js      # Prácticas, evaluaciones y rúbricas docentes
│   │   ├── history.routes.js     # Archivo histórico y verificación de certificados
│   │   └── student.routes.js     # Consulta de rotaciones, calificaciones y documentos
│   ├── services/                 # Servicios (sincronización automática de prácticas, archivo)
│   ├── uploads/                  # Directorio de almacenamiento de assets y documentos
│   └── server.js                 # Punto de entrada del servidor Express
│
├── FRONT/                        # Aplicación Frontend (React 18 + TailwindCSS)
│   ├── public/                   # Plantillas HTML, logos y recursos estáticos
│   └── src/
│       ├── assets/               # Assets institucionales y Base64 de alta fidelidad
│       ├── components/           # Módulos por rol institucional
│       │   ├── Admin/            # Gestión de usuarios, prácticas y diseño de certificados
│       │   ├── Auditor/          # Rúbricas clínicas, asistencia y comunicación
│       │   ├── Auth/             # Inicio de sesión, layouts y recuperación
│       │   ├── Dashboard/        # Navbar reactivo, perfiles y navegación
│       │   ├── Docent/           # Calificación formativa, estudiantes a cargo
│       │   ├── History/          # Histórico permanente y validación de certificados
│       │   ├── Shared/           # Componentes compartidos, avatares y modales
│       │   └── Student/          # Ficha integral, horas y solicitud de certificados
│       ├── context/              # Contexto global (Tema Claro/Oscuro)
│       └── utils/                # Generadores PDF, gestión de sesiones y API client
│
└── package.json                  # Scripts de desarrollo concurrente
```

---

## 🚀 Requisitos Previos

- **Node.js**: v18.0.0 o superior (recomendado v19+ o v20 LTS).
- **npm**: v9.0.0 o superior.
- **MySQL**: Servidor MySQL 5.7+ o 8.0+ accesible.

---

## 📦 Instalación

1. Clona el repositorio e ingresa al directorio raíz:
   ```bash
   cd UPTC-PRACTICA
   ```

2. Instala todas las dependencias (raíz, backend y frontend):
   ```bash
   npm run install:all
   ```

---

## ⚙️ Configuración de Variables de Entorno

### Backend (`BACK/.env`)
Crea o verifica el archivo `BACK/.env` con los siguientes parámetros:
```env
NODE_ENV=development
PORT=4004
BACKEND_URL=http://localhost:4004
FRONTEND_URL=http://localhost:3003

# Conexión Base de Datos MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=u241712700_Practica
DB_CONNECTION_LIMIT=30
DB_CONNECT_TIMEOUT=20000

# Seguridad JWT
JWT_SECRET=tu_clave_secreta_jwt_super_segura
JWT_EXPIRES_IN=8h

# Notificaciones y Recuperación de Contraseña
ADMIN_EMAIL=enfermeriauptc2026@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_password_de_aplicacion
```

### Frontend (`FRONT/.env`)
Verifica el archivo `FRONT/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:4004
REACT_APP_API_URL=http://localhost:4004/api
```

---

## 🏃 Modo de Desarrollo

Para ejecutar backend y frontend simultáneamente con recarga automática:
```bash
npm run dev
```

O para ejecutarlos de forma independiente:
- **Solo Backend**: `npm run dev:back` (escuchando en http://localhost:4004)
- **Solo Frontend**: `npm run dev:front` (sirviendo en http://localhost:3003)

---

## 🏗️ Construcción para Producción

Para compilar el frontend optimizado para despliegue:
```bash
npm run build:front
```

---

## 🛡️ Características de Seguridad y Resiliencia

- **Control de Acceso Basado en Roles (RBAC)**: Autorización estricta por roles (`superadmin`, `admin`, `docent`, `student`, `auditor`).
- **Protección Anti-IDOR**: Restricción de acceso para que los estudiantes únicamente puedan consultar sus propios datos, rotaciones y documentos.
- **Generación Criptográfica Segura**: Códigos de verificación y recuperación generados mediante `crypto.randomInt`.
- **CORS & Headers HTTP Seguros**: Configuración de `helmet` y políticas de recursos de origen cruzado (`cross-origin`).
- **Auditoría y Trazabilidad**: Verificación pública de certificados y constancias mediante identificador único hexadecimal.
- **Sincronización Automática de Ciclo de Vida**: Las prácticas transicionan de `Planificada` a `Activa` y `Finalizada` automáticamente según las fechas del calendario nacional (UTC-5).