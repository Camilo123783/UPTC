import React from "react";
import { Link } from "react-router-dom";
import { getRouteForPage } from "../../config/routes";

/**
 * RouteLink — Enlace universal con soporte nativo para nueva pestaña y nueva ventana
 *
 * Renderiza una etiqueta <a> nativa de HTML con href absoluto y válido.
 * Permite que el usuario:
 * 1. Dé clic derecho y vea el menú completo del navegador:
 *    - "Abrir enlace en una nueva pestaña"
 *    - "Abrir enlace en una nueva ventana"
 *    - "Abrir enlace en ventana privada"
 *    - "Copiar dirección del enlace"
 * 2. Use la rueda del ratón (clic central) o Ctrl+Clic / Cmd+Clic para abrir en nueva pestaña directamente.
 * 3. Al hacer clic izquierdo normal (sin teclas modificadoras): Navega de forma instantánea como SPA sin recarga total.
 */
const RouteLink = React.forwardRef(
  (
    {
      to,
      onClick,
      className = "",
      style,
      children,
      target,
      rel,
      replace = false,
      title,
      ...rest
    },
    ref
  ) => {
    const href = getRouteForPage(to);

    const handleClick = (e) => {
      // Si el clic es con botón central (rueda) o con teclas modificadoras (Ctrl, Meta, Shift, Alt),
      // dejamos que el navegador gestione nativamente la nueva pestaña/ventana.
      if (
        e.button !== 0 ||
        e.metaKey ||
        e.altKey ||
        e.ctrlKey ||
        e.shiftKey
      ) {
        if (onClick) {
          try {
            onClick(e);
          } catch (err) {}
        }
        return;
      }

      if (onClick) {
        onClick(e);
      }
    };

    return (
      <Link
        ref={ref}
        to={href}
        onClick={handleClick}
        className={`no-underline text-inherit cursor-pointer select-none ${className}`}
        style={style}
        target={target}
        rel={target === "_blank" ? (rel || "noopener noreferrer") : rel}
        replace={replace}
        title={title}
        {...rest}
      >
        {children}
      </Link>
    );
  }
);

RouteLink.displayName = "RouteLink";

export default RouteLink;
