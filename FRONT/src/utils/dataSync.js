// ============================================================
// src/utils/dataSync.js — Sincronización de datos reactiva y global
// ============================================================
import { useEffect, useRef } from "react";

export const DATA_SYNC_EVENT = "uptc:data-changed";

/**
 * Notifica a todos los componentes suscriptos que un dato cambió
 * (creación, edición o eliminación de cualquier entidad).
 * Funciona tanto en la pestaña actual como en pestañas secundarias (vía localStorage).
 * 
 * @param {string} entity - Tipo de entidad (e.g. 'users', 'programas', 'instituciones', 'servicios', 'asignaturas')
 * @param {string} action - Acción realizada (e.g. 'delete', 'create', 'update')
 * @param {object} [extra]  - Metadatos opcionales
 */
export const notifyDataChanged = (entity = "general", action = "update", extra = {}) => {
  const payload = { entity, action, timestamp: Date.now(), ...extra };

  // 1. Notificación en la misma ventana
  window.dispatchEvent(new CustomEvent(DATA_SYNC_EVENT, { detail: payload }));

  // 2. Notificación entre pestañas del navegador mediante evento storage
  try {
    localStorage.setItem("uptc_last_data_sync", JSON.stringify(payload));
  } catch (err) {
    // Silencioso en caso de restricciones de almacenamiento
  }
};

/**
 * Hook de React para reaccionar inmediatamente a cualquier cambio de datos.
 * Llama a `onSyncCallback` cada vez que se emita un evento de cambio
 * o cuando la ventana vuelva a tomar foco.
 * 
 * @param {Function} onSyncCallback - Función asíncrona o síncrona a ejecutar al detectar cambios
 * @param {Array}    deps           - Dependencias adicionales opcionales
 */
export const useDataSync = (onSyncCallback, deps = []) => {
  const callbackRef = useRef(onSyncCallback);

  useEffect(() => {
    callbackRef.current = onSyncCallback;
  }, [onSyncCallback]);

  useEffect(() => {
    let isMounted = true;

    const triggerRefresh = () => {
      if (isMounted && typeof callbackRef.current === "function") {
        callbackRef.current();
      }
    };

    const handleCustomEvent = () => {
      triggerRefresh();
    };

    const handleStorageEvent = (e) => {
      if (e.key === "uptc_last_data_sync") {
        triggerRefresh();
      }
    };

    const handleWindowFocus = () => {
      triggerRefresh();
    };

    window.addEventListener(DATA_SYNC_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      window.removeEventListener(DATA_SYNC_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, deps);
};

export default {
  notifyDataChanged,
  useDataSync,
  DATA_SYNC_EVENT,
};
