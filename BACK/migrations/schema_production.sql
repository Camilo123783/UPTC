-- ============================================================
-- migrations/schema_production.sql
-- Script Consolidado e Idempotente de Esquema e Índices de Producción (MySQL 8+)
-- Universidad Pedagógica y Tecnológica de Colombia (UPTC)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tablas de Catálogos Institucionales y Académicos
CREATE TABLE IF NOT EXISTS `programa` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombreprograma` VARCHAR(180) NOT NULL,
  `facultad` VARCHAR(180) DEFAULT 'Facultad de Ciencias de la Salud',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asignatura` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombreasignatura` VARCHAR(180) NOT NULL,
  `codigoasignatura` VARCHAR(60) DEFAULT NULL,
  `programa_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_asignatura_programa` FOREIGN KEY (`programa_id`) REFERENCES `programa` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `institucion` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombreinstitucion` VARCHAR(220) NOT NULL,
  `ciudad` VARCHAR(120) DEFAULT NULL,
  `direccion` VARCHAR(255) DEFAULT NULL,
  `telefono` VARCHAR(60) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `servicio` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombreservicio` VARCHAR(180) NOT NULL,
  `institucion_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_servicio_institucion` FOREIGN KEY (`institucion_id`) REFERENCES `institucion` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tablas de Roles y Usuarios
CREATE TABLE IF NOT EXISTS `superadmin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cedula` BIGINT NOT NULL UNIQUE,
  `nombre` VARCHAR(120) NOT NULL,
  `apellidos` VARCHAR(120) NOT NULL,
  `correo_institucional` VARCHAR(180) NOT NULL UNIQUE,
  `contrasena` VARCHAR(255) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `administrador` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cedula` BIGINT NOT NULL UNIQUE,
  `nombre` VARCHAR(120) NOT NULL,
  `apellidos` VARCHAR(120) NOT NULL,
  `correo_institucional` VARCHAR(180) NOT NULL UNIQUE,
  `contrasena` VARCHAR(255) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `docente` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cedula` BIGINT NOT NULL UNIQUE,
  `nombre` VARCHAR(120) NOT NULL,
  `apellidos` VARCHAR(120) NOT NULL,
  `correo_institucional` VARCHAR(180) NOT NULL UNIQUE,
  `contrasena` VARCHAR(255) NOT NULL,
  `programa_id` INT DEFAULT NULL,
  `telefono` VARCHAR(50) DEFAULT NULL,
  `especialidad` VARCHAR(180) DEFAULT NULL,
  `biografia` TEXT DEFAULT NULL,
  `foto_perfil` LONGTEXT DEFAULT NULL,
  `foto_firma` LONGTEXT DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_docente_programa` FOREIGN KEY (`programa_id`) REFERENCES `programa` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auditor` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cedula` BIGINT NOT NULL UNIQUE,
  `nombre` VARCHAR(120) NOT NULL,
  `apellidos` VARCHAR(120) NOT NULL,
  `correo_institucional` VARCHAR(180) NOT NULL UNIQUE,
  `contrasena` VARCHAR(255) NOT NULL,
  `institucion_id` INT DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_auditor_institucion` FOREIGN KEY (`institucion_id`) REFERENCES `institucion` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudiante` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cedula` BIGINT NOT NULL UNIQUE,
  `nombre` VARCHAR(120) NOT NULL,
  `apellidos` VARCHAR(120) NOT NULL,
  `codigo` VARCHAR(50) DEFAULT NULL,
  `correo_institucional` VARCHAR(180) NOT NULL UNIQUE,
  `contrasena` VARCHAR(255) NOT NULL,
  `programa_id` INT DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_estudiante_programa` FOREIGN KEY (`programa_id`) REFERENCES `programa` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `datos_estudiante` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cedula_estudiante` BIGINT NOT NULL UNIQUE,
  `biografia` TEXT DEFAULT NULL,
  `direccion` VARCHAR(255) DEFAULT NULL,
  `telefono` VARCHAR(50) DEFAULT NULL,
  `correo_personal` VARCHAR(180) DEFAULT NULL,
  `nombre_familiar` VARCHAR(180) DEFAULT NULL,
  `telefono_familiar` VARCHAR(50) DEFAULT NULL,
  `foto_perfil` LONGBLOB DEFAULT NULL,
  `hoja_vida_digital` LONGBLOB DEFAULT NULL,
  `seguridad_social_eps` LONGBLOB DEFAULT NULL,
  `riesgos_profesionales_arl` LONGBLOB DEFAULT NULL,
  `copia_documento_identidad` LONGBLOB DEFAULT NULL,
  `copia_carnet_estudiantil` LONGBLOB DEFAULT NULL,
  `carnet_vacunas` LONGBLOB DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_datos_estudiante_cedula` FOREIGN KEY (`cedula_estudiante`) REFERENCES `estudiante` (`cedula`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `datos_docente` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cedula_docente` BIGINT NOT NULL UNIQUE,
  `biografia` TEXT DEFAULT NULL,
  `direccion` VARCHAR(255) DEFAULT NULL,
  `telefono` VARCHAR(50) DEFAULT NULL,
  `correo_personal` VARCHAR(180) DEFAULT NULL,
  `nombre_familiar` VARCHAR(180) DEFAULT NULL,
  `telefono_familiar` VARCHAR(50) DEFAULT NULL,
  `foto_perfil` LONGBLOB DEFAULT NULL,
  `foto_firma` LONGBLOB DEFAULT NULL,
  `hoja_vida_digital` LONGBLOB DEFAULT NULL,
  `seguridad_social_eps` LONGBLOB DEFAULT NULL,
  `riesgos_profesionales_arl` LONGBLOB DEFAULT NULL,
  `copia_documento_identidad` LONGBLOB DEFAULT NULL,
  `copia_carnet_docente` LONGBLOB DEFAULT NULL,
  `carnet_vacunas` LONGBLOB DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_datos_docente_cedula` (`cedula_docente`),
  CONSTRAINT `fk_datos_docente_cedula` FOREIGN KEY (`cedula_docente`) REFERENCES `docente` (`cedula`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Prácticas Formativas y Asignaciones
CREATE TABLE IF NOT EXISTS `practica` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `titulo` VARCHAR(220) NOT NULL,
  `programa_id` INT DEFAULT NULL,
  `asignatura_id` INT DEFAULT NULL,
  `institucion_id` INT NOT NULL,
  `servicio_id` INT DEFAULT NULL,
  `docente_cedula` BIGINT DEFAULT NULL,
  `auditor_cedula` BIGINT DEFAULT NULL,
  `periodo` VARCHAR(30) NOT NULL,
  `fecha_inicio` DATE DEFAULT NULL,
  `fecha_fin` DATE DEFAULT NULL,
  `horas_totales` INT NOT NULL DEFAULT 120,
  `cupos` INT NOT NULL DEFAULT 10,
  `estado` VARCHAR(40) NOT NULL DEFAULT 'Activa',
  `motivo_cancelacion` TEXT DEFAULT NULL,
  `descripcion` TEXT DEFAULT NULL,
  `horario` JSON DEFAULT NULL,
  `rubrica_criterios` JSON DEFAULT NULL,
  `creado_por_cedula` BIGINT DEFAULT NULL,
  `creado_por_rol` VARCHAR(40) DEFAULT 'admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_practica_estado_fechas` (`estado`, `fecha_inicio`, `fecha_fin`),
  INDEX `idx_practica_docente` (`docente_cedula`),
  INDEX `idx_practica_auditor` (`auditor_cedula`),
  INDEX `idx_practica_institucion` (`institucion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `practica_estudiante` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `practica_id` INT NOT NULL,
  `estudiante_cedula` BIGINT NOT NULL,
  `estado` VARCHAR(40) NOT NULL DEFAULT 'Asignado',
  `horas_cumplidas` INT NOT NULL DEFAULT 0,
  `horas_asignadas` INT NOT NULL DEFAULT 120,
  `calificacion` DECIMAL(3,1) DEFAULT NULL,
  `retroalimentacion` TEXT DEFAULT NULL,
  `fecha_evaluacion` DATE DEFAULT NULL,
  `estado_evaluacion` VARCHAR(40) DEFAULT 'Pendiente',
  `criterios` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_practica_estudiante` (`practica_id`, `estudiante_cedula`),
  INDEX `idx_pe_estudiante` (`estudiante_cedula`),
  CONSTRAINT `fk_pe_practica` FOREIGN KEY (`practica_id`) REFERENCES `practica` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Seguimiento Clínico, Asistencias, Evaluaciones y Mensajería
CREATE TABLE IF NOT EXISTS `asistencia_estudiante` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `practica_id` INT NOT NULL,
  `estudiante_cedula` BIGINT NOT NULL,
  `auditor_cedula` BIGINT DEFAULT NULL,
  `fecha` DATE NOT NULL,
  `asistio` TINYINT(1) NOT NULL DEFAULT 1,
  `horas` INT NOT NULL DEFAULT 8,
  `observacion` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_asistencia_diaria` (`practica_id`, `estudiante_cedula`, `fecha`),
  INDEX `idx_asistencia_practica` (`practica_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reporte_auditor` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `practica_id` INT NOT NULL,
  `estudiante_cedula` BIGINT NOT NULL,
  `auditor_cedula` BIGINT NOT NULL,
  `conocimiento_teorico` INT DEFAULT 5,
  `habilidades_practicas` INT DEFAULT 5,
  `actitud_etica` INT DEFAULT 5,
  `comunicacion_equipo` INT DEFAULT 5,
  `puntualidad_asistencia` INT DEFAULT 5,
  `criterios_rubrica` JSON DEFAULT NULL,
  `nota_sugerida` DECIMAL(3,1) DEFAULT NULL,
  `concepto` VARCHAR(80) DEFAULT 'Favorable',
  `observaciones` TEXT DEFAULT NULL,
  `fecha_reporte` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_reporte_auditor` (`practica_id`, `estudiante_cedula`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `observacion_practica` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `practica_id` INT NOT NULL,
  `autor_cedula` BIGINT DEFAULT NULL,
  `autor_rol` VARCHAR(40) NOT NULL DEFAULT 'docente',
  `autor_nombre` VARCHAR(180) DEFAULT NULL,
  `estudiante_cedula` BIGINT DEFAULT NULL,
  `tipo` VARCHAR(60) DEFAULT 'Seguimiento',
  `observacion` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_obs_practica` (`practica_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mensaje_practica` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `practica_id` INT NOT NULL,
  `docente_cedula` BIGINT DEFAULT NULL,
  `auditor_cedula` BIGINT DEFAULT NULL,
  `remitente_rol` VARCHAR(40) NOT NULL,
  `remitente_cedula` BIGINT NOT NULL,
  `remitente_nombre` VARCHAR(180) DEFAULT NULL,
  `estudiante_cedula` BIGINT DEFAULT NULL,
  `estudiante_nombre` VARCHAR(180) DEFAULT NULL,
  `titulo` VARCHAR(220) DEFAULT NULL,
  `mensaje` TEXT NOT NULL,
  `tipo` VARCHAR(60) DEFAULT 'Seguimiento',
  `leido_por_docente` TINYINT(1) NOT NULL DEFAULT 0,
  `leido_por_auditor` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_mp_practica_leido` (`practica_id`, `remitente_rol`, `leido_por_docente`, `leido_por_auditor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mensaje_estudiante_docente` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `practica_id` INT NOT NULL,
  `docente_cedula` BIGINT NOT NULL,
  `estudiante_cedula` BIGINT DEFAULT NULL,
  `destinatario_tipo` VARCHAR(30) NOT NULL DEFAULT 'individual',
  `grupo_envio_id` VARCHAR(80) DEFAULT NULL,
  `remitente_rol` VARCHAR(30) NOT NULL,
  `remitente_cedula` BIGINT NOT NULL,
  `remitente_nombre` VARCHAR(180) DEFAULT NULL,
  `titulo` VARCHAR(220) DEFAULT NULL,
  `mensaje` TEXT NOT NULL,
  `tipo` VARCHAR(60) DEFAULT 'General',
  `leido_por_docente` TINYINT(1) NOT NULL DEFAULT 0,
  `leido_por_estudiante` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_med_practica_estudiante` (`practica_id`, `estudiante_cedula`, `leido_por_estudiante`),
  INDEX `idx_med_docente_leido` (`docente_cedula`, `remitente_rol`, `leido_por_docente`),
  INDEX `idx_med_grupo_envio` (`grupo_envio_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Solicitudes de Certificación e Historiales
CREATE TABLE IF NOT EXISTS `solicitud_certificado` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `estudiante_cedula` BIGINT NOT NULL,
  `docente_cedula` BIGINT DEFAULT NULL,
  `practica_id` INT NOT NULL,
  `tipo_certificado` VARCHAR(180) NOT NULL,
  `categoria_solicitud` VARCHAR(40) NOT NULL DEFAULT 'certificado',
  `motivo` VARCHAR(255) DEFAULT NULL,
  `observaciones` TEXT DEFAULT NULL,
  `estado` VARCHAR(40) NOT NULL DEFAULT 'Pendiente',
  `respuesta_docente` TEXT DEFAULT NULL,
  `fecha_solicitud` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `fecha_respuesta` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_sc_estudiante` (`estudiante_cedula`, `estado`),
  INDEX `idx_sc_docente` (`docente_cedula`, `estado`),
  INDEX `idx_sc_practica` (`practica_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `historial_practica` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `practica_id` INT NOT NULL UNIQUE,
  `titulo` VARCHAR(220) NOT NULL,
  `periodo` VARCHAR(30) DEFAULT NULL,
  `fecha_inicio` DATE DEFAULT NULL,
  `fecha_fin` DATE DEFAULT NULL,
  `horas_totales` INT DEFAULT 120,
  `cupos` INT DEFAULT 10,
  `estado` VARCHAR(40) NOT NULL,
  `motivo_cancelacion` TEXT DEFAULT NULL,
  `descripcion` TEXT DEFAULT NULL,
  `horario` JSON DEFAULT NULL,
  `programa_id` INT DEFAULT NULL,
  `programa_nombre` VARCHAR(180) DEFAULT NULL,
  `asignatura_id` INT DEFAULT NULL,
  `asignatura_nombre` VARCHAR(180) DEFAULT NULL,
  `asignatura_codigo` VARCHAR(60) DEFAULT NULL,
  `institucion_id` INT DEFAULT NULL,
  `institucion_nombre` VARCHAR(220) DEFAULT NULL,
  `servicio_id` INT DEFAULT NULL,
  `servicio_nombre` VARCHAR(180) DEFAULT NULL,
  `docente_cedula` BIGINT DEFAULT NULL,
  `docente_nombre` VARCHAR(220) DEFAULT NULL,
  `docente_correo` VARCHAR(180) DEFAULT NULL,
  `auditor_cedula` BIGINT DEFAULT NULL,
  `auditor_nombre` VARCHAR(220) DEFAULT NULL,
  `auditor_correo` VARCHAR(180) DEFAULT NULL,
  `creado_por_rol` VARCHAR(40) DEFAULT NULL,
  `creador_nombre` VARCHAR(220) DEFAULT NULL,
  `estudiantes_info` LONGTEXT DEFAULT NULL,
  `asistencias_resumen` LONGTEXT DEFAULT NULL,
  `total_estudiantes` INT DEFAULT 0,
  `fecha_archivo` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hp_docente` (`docente_cedula`),
  INDEX `idx_hp_auditor` (`auditor_cedula`),
  INDEX `idx_hp_institucion` (`institucion_id`),
  INDEX `idx_hp_estado_periodo` (`estado`, `periodo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `historial_practica_estudiante` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `historial_id` INT NOT NULL,
  `practica_id` INT NOT NULL,
  `estudiante_cedula` BIGINT NOT NULL,
  `estudiante_nombre` VARCHAR(220) DEFAULT NULL,
  `estudiante_codigo` VARCHAR(60) DEFAULT NULL,
  `estudiante_correo` VARCHAR(180) DEFAULT NULL,
  `calificacion` DECIMAL(3,1) DEFAULT NULL,
  `estado_evaluacion` VARCHAR(40) DEFAULT NULL,
  `horas_cumplidas` INT DEFAULT 0,
  `horas_asignadas` INT DEFAULT 120,
  `tiene_documentos` TINYINT(1) DEFAULT 0,
  UNIQUE KEY `uk_hpe_historial_est` (`historial_id`, `estudiante_cedula`),
  INDEX `idx_hpe_estudiante` (`estudiante_cedula`),
  INDEX `idx_hpe_practica` (`practica_id`),
  CONSTRAINT `fk_hpe_historial` FOREIGN KEY (`historial_id`) REFERENCES `historial_practica` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `historial_certificado` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `id_hex` VARCHAR(40) NOT NULL UNIQUE,
  `solicitud_id` INT DEFAULT NULL,
  `estudiante_cedula` BIGINT NOT NULL,
  `estudiante_nombre` VARCHAR(220) NOT NULL,
  `estudiante_codigo` VARCHAR(60) DEFAULT NULL,
  `estudiante_correo` VARCHAR(180) DEFAULT NULL,
  `practica_id` INT DEFAULT NULL,
  `practica_titulo` VARCHAR(220) DEFAULT NULL,
  `programa_nombre` VARCHAR(180) DEFAULT NULL,
  `institucion_nombre` VARCHAR(220) DEFAULT NULL,
  `servicio_nombre` VARCHAR(180) DEFAULT NULL,
  `docente_nombre` VARCHAR(220) DEFAULT NULL,
  `docente_cedula` BIGINT DEFAULT NULL,
  `horas_totales` INT DEFAULT 120,
  `calificacion` DECIMAL(3,1) DEFAULT NULL,
  `periodo` VARCHAR(30) DEFAULT NULL,
  `tipo_certificado` VARCHAR(180) DEFAULT NULL,
  `categoria_solicitud` VARCHAR(40) DEFAULT 'certificado',
  `motivo` VARCHAR(255) DEFAULT NULL,
  `fecha_inicio` DATE DEFAULT NULL,
  `fecha_fin` DATE DEFAULT NULL,
  `fecha_emision` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `fecha_expiracion_estudiante` TIMESTAMP NULL DEFAULT NULL,
  `metadatos_json` LONGTEXT DEFAULT NULL,
  INDEX `idx_hc_estudiante_vigencia` (`estudiante_cedula`, `fecha_expiracion_estudiante`),
  INDEX `idx_hc_docente` (`docente_cedula`),
  INDEX `idx_hc_practica` (`practica_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

