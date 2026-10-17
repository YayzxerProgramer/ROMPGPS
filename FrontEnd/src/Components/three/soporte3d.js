/**
 * Utilidades del visor 3D que NO importan three.js: se usan desde la landing
 * y los paneles antes de decidir si vale la pena descargar el chunk 3D.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

let webglDisponible = null;

/** ¿El navegador puede crear un contexto WebGL? (se calcula una sola vez) */
export function hayWebGL() {
  if (webglDisponible !== null) return webglDisponible;
  try {
    const lienzo = document.createElement("canvas");
    const contexto = lienzo.getContext("webgl2") || lienzo.getContext("webgl");
    webglDisponible = Boolean(contexto);
    contexto?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglDisponible = false;
  }
  return webglDisponible;
}

/** Chunk pesado del visor (three + R3F + drei). Compartido por React.lazy y la precarga. */
export const cargarVisor = () => import("./ModelViewer");

/** Precarga del modelo del GPS: su módulo llama a useGLTF.preload al evaluarse. */
export const cargarModeloGps = () => import("./models/GpsDevice");

const CONSULTA_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

function suscribirMovimiento(avisar) {
  const consulta = window.matchMedia(CONSULTA_MOVIMIENTO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

/** true si el usuario pidió reducir animaciones en su sistema. */
export function usePrefiereMovimientoReducido() {
  return useSyncExternalStore(
    suscribirMovimiento,
    () => window.matchMedia(CONSULTA_MOVIMIENTO).matches,
    () => false,
  );
}

/**
 * Observa si el elemento está cerca de la pantalla.
 * Devuelve { cerca, visible }: `cerca` se queda en true la primera vez que
 * entra en el margen (sirve para montar el canvas una sola vez) y `visible`
 * sigue el estado actual (sirve para pausar el render fuera de pantalla).
 */
export function useCercaDePantalla(ref, margen = "300px") {
  const [estado, setEstado] = useState({ cerca: false, visible: false });

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setEstado({ cerca: true, visible: true }); // eslint-disable-line react-hooks/set-state-in-effect
      return undefined;
    }
    const observador = new IntersectionObserver(
      ([entrada]) => {
        setEstado((previo) => ({
          cerca: previo.cerca || entrada.isIntersecting,
          visible: entrada.isIntersecting,
        }));
      },
      { rootMargin: margen },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [ref, margen]);

  return estado;
}

/** Ejecuta `tarea` cuando la página terminó de cargar y el navegador está ocioso. */
export function alQuedarOcioso(tarea) {
  let cancelado = false;
  let idOcioso = null;
  const programar = () => {
    if (cancelado) return;
    if ("requestIdleCallback" in window) idOcioso = window.requestIdleCallback(tarea, { timeout: 4000 });
    else idOcioso = window.setTimeout(tarea, 1500);
  };
  if (document.readyState === "complete") programar();
  else window.addEventListener("load", programar, { once: true });
  return () => {
    cancelado = true;
    window.removeEventListener("load", programar);
    if (idOcioso === null) return;
    if ("cancelIdleCallback" in window) window.cancelIdleCallback(idOcioso);
    else window.clearTimeout(idOcioso);
  };
}
