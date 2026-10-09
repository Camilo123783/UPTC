import { sileo } from "sileo";

/**
 * Adaptador universal de notificaciones con Sileo
 * Reemplaza react-toastify en toda la plataforma proporcionando
 * animaciones físicas fluidas, badges e iconos nativos.
 */
const resolveToastOpts = (options = {}) => {
  const isDark =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("dark") ||
      localStorage.getItem("theme") === "dark");
  return {
    position: options.position || "bottom-right",
    fill: options.fill || (isDark ? "#18181b" : "#ffffff"),
    ...options,
  };
};

export const toast = (msg, options = {}) => {
  const resolved = resolveToastOpts(options);
  if (typeof msg === "object" && msg !== null) {
    return sileo.show({
      title: msg.title || msg.message || "Notificación",
      description: msg.description,
      duration: options.autoClose || options.duration || 4000,
      ...resolved,
    });
  }
  return sileo.show({
    title: String(msg),
    duration: options.autoClose || options.duration || 4000,
    ...resolved,
  });
};

toast.success = (msg, options = {}) => {
  const isObj = typeof msg === "object" && msg !== null;
  const resolved = resolveToastOpts(options);
  return sileo.success({
    title: isObj ? (msg.title || msg.message || "Operación exitosa") : String(msg),
    description: isObj ? msg.description : options.description,
    duration: options.autoClose || options.duration || 4000,
    ...resolved,
  });
};

toast.error = (msg, options = {}) => {
  const isObj = typeof msg === "object" && msg !== null;
  const resolved = resolveToastOpts(options);
  return sileo.error({
    title: isObj ? (msg.title || msg.message || "Ha ocurrido un error") : String(msg),
    description: isObj ? msg.description : options.description,
    duration: options.autoClose || options.duration || 5000,
    ...resolved,
  });
};

toast.info = (msg, options = {}) => {
  const isObj = typeof msg === "object" && msg !== null;
  const resolved = resolveToastOpts(options);
  return sileo.info({
    title: isObj ? (msg.title || msg.message || "Información") : String(msg),
    description: isObj ? msg.description : options.description,
    duration: options.autoClose || options.duration || 4000,
    ...resolved,
  });
};

toast.warning = (msg, options = {}) => {
  const isObj = typeof msg === "object" && msg !== null;
  const resolved = resolveToastOpts(options);
  return sileo.warning({
    title: isObj ? (msg.title || msg.message || "Atención") : String(msg),
    description: isObj ? msg.description : options.description,
    duration: options.autoClose || options.duration || 4500,
    ...resolved,
  });
};

toast.warn = toast.warning;

toast.dismiss = (id) => sileo.dismiss(id);
toast.clear = (position) => sileo.clear(position);
toast.promise = (promise, opts) => sileo.promise(promise, opts);

export { sileo };
export default toast;
