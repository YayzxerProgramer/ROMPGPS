/**
 * Rutas de los modelos 3D de public/models/. Los .glb y sus pósters los
 * genera tools/blender/build.ps1.
 */

const BASE = import.meta.env.BASE_URL;

/** Id del modelo del rastreador que se muestra en la landing. */
export const MODELO_GPS = "gps-device";

/** @param {string} id */
export const urlModelo3D = (id) => `${BASE}models/${id}.glb`;

/** Render estático del modelo: póster mientras carga y respaldo sin WebGL. */
export const urlPoster3D = (id) => `${BASE}models/previews/${id}.webp`;
