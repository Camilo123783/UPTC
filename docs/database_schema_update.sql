-- =====================================================================
-- ESTRUCTURACIÓN FINAL DE BASE DE DATOS UPTC-PRACTICA
-- =====================================================================

-- 1. TABLA administrador (antes llamada admin / superadmin)
-- ---------------------------------------------------------------------
-- RENAME TABLE `admin` TO `administrador`;
-- Actualizar rol_id = 2 (el rol 'admin' tiene id = 2 en la tabla rol)
UPDATE `administrador` SET `rol_id` = 2 WHERE `rol_id` = 1;
ALTER TABLE `administrador` ADD UNIQUE KEY IF NOT EXISTS `uq_admin_cedula` (`cedula`);


-- 2. TABLA superadmin (antes superrradmin)
-- ---------------------------------------------------------------------
-- RENAME TABLE `superrradmin` TO `superadmin`;
CREATE TABLE IF NOT EXISTS `superadmin` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `rol_id` int(11) NOT NULL DEFAULT 1,
  `nombre` varchar(255) NOT NULL,
  `apellido` varchar(255) NOT NULL,
  `cedula` bigint(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_superadmin_cedula` (`cedula`),
  KEY `fk_superadmin_rol` (`rol_id`),
  CONSTRAINT `fk_superadmin_rol` FOREIGN KEY (`rol_id`) REFERENCES `rol` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. ASOCIACIÓN DE practica_estudiante CON estudiante
-- ---------------------------------------------------------------------
ALTER TABLE `practica_estudiante`
  ADD CONSTRAINT `fk_pe_estudiante`
  FOREIGN KEY (`estudiante_cedula`) REFERENCES `estudiante` (`cedula`)
  ON DELETE CASCADE ON UPDATE CASCADE;


-- 4. ASOCIACIÓN DE observacion_practica CON SU AUTOR
-- ---------------------------------------------------------------------
ALTER TABLE `auditor` ADD UNIQUE KEY IF NOT EXISTS `uq_auditor_cedula` (`cedula`);

ALTER TABLE `observacion_practica`
  MODIFY COLUMN `docente_cedula` int(10) unsigned DEFAULT NULL,
  MODIFY COLUMN `estudiante_cedula` bigint(20) unsigned DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `autor_rol` varchar(50) NOT NULL DEFAULT 'docente' AFTER `id`,
  ADD COLUMN IF NOT EXISTS `autor_cedula` bigint(20) NOT NULL DEFAULT 0 AFTER `autor_rol`,
  ADD COLUMN IF NOT EXISTS `autor_nombre` varchar(255) DEFAULT NULL AFTER `autor_cedula`,
  ADD COLUMN IF NOT EXISTS `auditor_cedula` int(11) DEFAULT NULL AFTER `docente_cedula`,
  ADD COLUMN IF NOT EXISTS `admin_cedula` int(11) DEFAULT NULL AFTER `auditor_cedula`;

ALTER TABLE `observacion_practica`
  ADD CONSTRAINT `fk_obs_practica`
    FOREIGN KEY (`practica_id`) REFERENCES `practica` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_obs_estudiante`
    FOREIGN KEY (`estudiante_cedula`) REFERENCES `estudiante` (`cedula`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_obs_docente`
    FOREIGN KEY (`docente_cedula`) REFERENCES `docente` (`cedula`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_obs_auditor`
    FOREIGN KEY (`auditor_cedula`) REFERENCES `auditor` (`cedula`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_obs_admin`
    FOREIGN KEY (`admin_cedula`) REFERENCES `administrador` (`cedula`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. MIGRACIÓN DE CAMPO CODIGO: estudiante Y datos_estudiante
-- ---------------------------------------------------------------------
-- Agregar campo codigo institucional directamente a la tabla estudiante:
ALTER TABLE `estudiante` ADD COLUMN IF NOT EXISTS `codigo` VARCHAR(50) NULL AFTER `apellidos`;

-- Migrar datos preexistentes si los hubiera:
UPDATE `estudiante` e
INNER JOIN `datos_estudiante` de ON e.cedula = de.cedula_estudiante
SET e.codigo = de.codigo
WHERE de.codigo IS NOT NULL AND de.codigo != '';

-- Eliminar campo codigo de datos_estudiante:
ALTER TABLE `datos_estudiante` DROP COLUMN IF EXISTS `codigo`;


-- 6. NORMALIZACIÓN DE ROLES, CÉDULAS (BIGINT) Y SOLICITUD_CERTIFICADO
-- ---------------------------------------------------------------------
-- Corregir typo en tabla rol:
UPDATE `rol` SET `rol` = 'superadmin' WHERE `id` = 1;

-- Normalizar columnas superadmin:
ALTER TABLE `superadmin` CHANGE COLUMN `apellido` `apellidos` VARCHAR(255) NOT NULL;

-- Normalización de Cédulas a BIGINT(20):
ALTER TABLE `administrador` MODIFY COLUMN `cedula` BIGINT(20) NOT NULL;
ALTER TABLE `auditor` MODIFY COLUMN `cedula` BIGINT(20) NOT NULL;
ALTER TABLE `docente` MODIFY COLUMN `cedula` BIGINT(20) NOT NULL;
ALTER TABLE `datos_docente` MODIFY COLUMN `cedula_docente` BIGINT(20) NOT NULL;

-- Integridad referencial en solicitud_certificado:
ALTER TABLE `solicitud_certificado` MODIFY COLUMN `estudiante_cedula` BIGINT(20) UNSIGNED NOT NULL;
ALTER TABLE `solicitud_certificado` MODIFY COLUMN `docente_cedula` BIGINT(20) NULL;
ALTER TABLE `solicitud_certificado` MODIFY COLUMN `practica_id` INT(11) NOT NULL;

ALTER TABLE `solicitud_certificado`
  ADD CONSTRAINT `fk_sc_estudiante` FOREIGN KEY (`estudiante_cedula`) REFERENCES `estudiante` (`cedula`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sc_practica` FOREIGN KEY (`practica_id`) REFERENCES `practica` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sc_docente` FOREIGN KEY (`docente_cedula`) REFERENCES `docente` (`cedula`) ON DELETE SET NULL ON UPDATE CASCADE;


