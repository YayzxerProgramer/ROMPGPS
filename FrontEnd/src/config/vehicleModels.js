/**
 * Mapeo centralizado entre el texto libre del campo "modelo" de un vehículo
 * y los modelos 3D disponibles en public/models/.
 *
 * El backend guarda `modelo` como texto libre (máx. 60 caracteres, sin marca
 * separada), así que la resolución se hace aquí: se normaliza el texto
 * (minúsculas, sin tildes, sin espacios ni guiones) y se busca un alias
 * contenido en él. "Bajaj Boxer CT-100 2022" → "bajajboxerct1002022", que
 * contiene "boxer" → boxer-ct100.
 *
 * Los .glb y sus pósters los genera tools/blender/build.ps1.
 */

const BASE = import.meta.env.BASE_URL;

/** Id del modelo del rastreador que se muestra en la landing. */
export const MODELO_GPS = "gps-device";

/**
 * @typedef {object} ModeloVehiculo
 * @property {string} id        nombre del .glb sin extensión
 * @property {string} nombre    nombre comercial completo
 * @property {string} corto     etiqueta breve para chips y listas
 * @property {"MOTO"|"CARRO"} tipo
 * @property {string[]} alias   fragmentos ya normalizados que identifican el modelo
 * @property {string[]} excluir fragmentos que descartan la coincidencia
 */

/** @type {ModeloVehiculo[]} */
export const MODELOS_VEHICULO = [
  {
    id: "boxer-ct100",
    nombre: "Bajaj Boxer CT 100",
    corto: "Boxer CT 100",
    tipo: "MOTO",
    alias: ["boxer", "ct100"],
    excluir: [],
  },
  {
    id: "tvs-raider-125",
    nombre: "TVS Raider 125",
    corto: "Raider 125",
    tipo: "MOTO",
    alias: ["raider"],
    // La Suzuki Raider es otra moto: sin esto mostraría la TVS.
    excluir: ["suzuki"],
  },
  {
    id: "pulsar-200",
    nombre: "Bajaj Pulsar NS 200",
    corto: "Pulsar NS 200",
    tipo: "MOTO",
    // Solo la 200: "Pulsar 150" o "Pulsar 220" son motos distintas y deben
    // caer en el respaldo genérico, no en este modelo.
    alias: ["pulsar200", "pulsarns200", "ns200"],
    excluir: [],
  },
];

/**
 * Minúsculas, sin tildes y solo letras/números: "Bóxer CT-100" → "boxerct100".
 * @param {string} texto
 */
export function normalizarTexto(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Modelo 3D que corresponde al texto del vehículo, o null si no hay.
 * @param {string} texto
 * @returns {ModeloVehiculo | null}
 */
export function resolverModeloVehiculo(texto) {
  const normalizado = normalizarTexto(texto);
  if (normalizado.length < 3) return null;
  return (
    MODELOS_VEHICULO.find(
      (m) => !m.excluir.some((e) => normalizado.includes(e)) && m.alias.some((a) => normalizado.includes(a)),
    ) ?? null
  );
}

/** @param {string} id */
export const urlModelo3D = (id) => `${BASE}models/${id}.glb`;

/** Render estático del modelo: póster mientras carga, respaldo sin WebGL y miniatura. */
export const urlPoster3D = (id) => `${BASE}models/previews/${id}.webp`;
