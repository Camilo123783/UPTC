import { sileo } from "sileo";

/**
 * Adaptador universal de notificaciones con Sileo
 * Reemplaza react-toastify en toda la plataforma proporcionando
 * animaciones físicas fluidas, badges e iconos nativos.
 */
export const toast = (msg, options = {}) => {
  if (typeof msg === "object" && msg !== null) {
    return sileo.show({
      title: msg.title || msg.message || "Notificación",
      description: msg.description,
      duration: options.autoClose || options.duration || 4000,
      ...options,
    });
  }
  return sileo.show({
    title: String(msg),
    duration: options.autoClose || options.duration || 4000,
    ...options,
  });
};

toast.success = (msg, options = {}) => {
  const isObj = typeof msg === "object" && msg !== null;
  return sileo.success({
    title: isObj ? (msg.title || msg.message || "Operación exitosa") : String(msg),
    description: isObj ? msg.description : options.description,
    duration: options.autoClose || options.duration || 4000,
    ...options,
  });
};

toast.error = (msg, options = {}) => {
  const isObj = typeof msg === "object" && msg !== null;
  return sileo.error({
    title: isObj ? (msg.title || msg.message || "Ha ocurrido un error") : String(msg),
    description: isObj ? msg.description : options.description,
    duration: options.autoClose || options.duration || 5000,
    ...options,
  });
};

toast.info = (msg, options = {}) => {
  const isObj = typeof msg === "object" && msg !== null;
  return sileo.info({
    title: isObj ? (msg.title || msg.message || "Información") : String(msg),
    description: isObj ? msg.description : options.description,
    duration: options.autoClose || options.duration || 4000,
    ...options,
  });
};

toast.warning = (msg, options = {}) => {
  const isObj = typeof msg === "object" && msg !== null;
  return sileo.warning({
    title: isObj ? (msg.title || msg.message || "Atención") : String(msg),
    description: isObj ? msg.description : options.description,
    duration: options.autoClose || options.duration || 4500,
    ...options,
  });
};

toast.warn = toast.warning;

toast.dismiss = (id) => sileo.dismiss(id);
toast.clear = (position) => sileo.clear(position);
toast.promise = (promise, opts) => sileo.promise(promise, opts);

export { sileo };
export default toast;
