import { lazy } from "react";

/**
 * Modelos que sabe mostrar el visor. Cada componente es su propio chunk: abrir
 * la Boxer no descarga el código de las otras motos ni ejecuta la precarga
 * del GPS (que vive en el módulo de GpsDevice).
 *
 * `vista` es el ángulo inicial de cámara: azimut 0 = de frente y positivo
 * hacia el lado derecho del modelo (el del escape). Son los mismos valores que
 * usan los pósters de Blender, así el cambio póster → 3D no salta.
 */
const VISTA_MOTO = { azimut: 58, elevacion: 12 };

export const MODELOS_3D = {
  "gps-device": { Componente: lazy(() => import("./GpsDevice")), vista: { azimut: 24, elevacion: 14 } },
  "boxer-ct100": { Componente: lazy(() => import("./BoxerCt100")), vista: VISTA_MOTO },
  "tvs-raider-125": { Componente: lazy(() => import("./TvsRaider125")), vista: VISTA_MOTO },
  "pulsar-200": { Componente: lazy(() => import("./Pulsar200")), vista: VISTA_MOTO },
};
