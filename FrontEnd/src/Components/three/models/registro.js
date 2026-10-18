import { lazy } from "react";

/**
 * Modelos que sabe mostrar el visor. Cada componente es su propio chunk.
 *
 * `vista` es el ángulo inicial de cámara: azimut 0 = de frente y positivo
 * hacia el lado derecho del modelo. Son los mismos valores que usa el póster
 * de Blender, así el cambio póster → 3D no salta.
 */
export const MODELOS_3D = {
  "gps-device": { Componente: lazy(() => import("./GpsDevice")), vista: { azimut: 24, elevacion: 14 } },
};
