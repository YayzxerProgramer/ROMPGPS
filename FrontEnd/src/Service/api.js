import {
    obtenerToken,
    obtenerRefresco,
    actualizarTokens,
    cerrarSesion,
    haCaducado,
} from "./sesion";

/**
 * Cliente HTTP único de la aplicación.
 *
 * QUÉ RESUELVE:
 *
 * 1. URL BASE. Había 14 llamadas con "http://localhost:8081" escrito a mano en
 *    9 archivos: desplegar obligaba a editarlos uno a uno. Ahora sale de
 *    VITE_API_URL.
 *
 * 2. CABECERA DE AUTORIZACIÓN. Se repetía a mano en 11 sitios.
 *
 * 3. MANEJO DEL 401. Ningún .then() comprobaba res.ok, así que ante un 401 la
 *    llamada a res.json() fallaba y el componente se quedaba en blanco para
 *    siempre, sin mensaje y sin volver al login.
 *
 * 4. RENOVACIÓN DE SESIÓN. El access token dura 15 minutos. Aquí se renueva de
 *    forma transparente con el token de refresco antes de que caduque, y si aun
 *    así llega un 401 se reintenta una vez tras refrescar.
 */

export const API_URL = import.meta.env.VITE_API_URL;

/** Margen para renovar antes de que caduque y evitar 401 por carrera. */
const MARGEN_RENOVACION_SEGUNDOS = 30;

/** Una sola renovación en vuelo: si llegan varias peticiones a la vez,
 *  todas esperan a la misma promesa en lugar de disparar N refrescos. */
let refrescoEnCurso = null;

/** Se avisa a la aplicación cuando la sesión muere, para redirigir al login. */
const suscriptoresSesionCaducada = new Set();

export function alCaducarSesion(callback) {
    suscriptoresSesionCaducada.add(callback);
    return () => suscriptoresSesionCaducada.delete(callback);
}

function anunciarSesionCaducada() {
    cerrarSesion();
    suscriptoresSesionCaducada.forEach((cb) => cb());
}

async function refrescarSesion() {
    const refreshToken = obtenerRefresco();
    if (!refreshToken) return false;

    if (!refrescoEnCurso) {
        refrescoEnCurso = fetch(`${API_URL}/usuario/refrescar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        })
            .then(async (res) => {
                if (!res.ok) return false;
                const datos = await res.json();
                actualizarTokens(datos);
                return true;
            })
            .catch(() => false)
            .finally(() => {
                refrescoEnCurso = null;
            });
    }

    return refrescoEnCurso;
}

/**
 * Como fetch(url, opciones), pero con la sesión al día: renueva el token si
 * está por caducar y reintenta una vez si llega un 401. Devuelve la Response
 * cruda, para el código que ya comprueba res.ok por su cuenta.
 */
export async function fetchConSesion(url, opciones = {}) {
    const token = obtenerToken();
    if (token && haCaducado(token, MARGEN_RENOVACION_SEGUNDOS)) {
        await refrescarSesion();
    }

    const conToken = () => ({
        ...opciones,
        headers: { ...opciones.headers, Authorization: `Bearer ${obtenerToken()}` },
    });

    let respuesta = await fetch(url, conToken());
    if (respuesta.status === 401) {
        if (await refrescarSesion()) {
            respuesta = await fetch(url, conToken());
        } else {
            anunciarSesionCaducada();
        }
    }
    return respuesta;
}

/**
 * Petición autenticada.
 *
 * @param {string} ruta      ruta relativa, p. ej. "/usuario/login"
 * @param {object} opciones  method, body (objeto, se serializa solo), headers,
 *                           y `sinAuth: true` para endpoints públicos
 * @returns el cuerpo ya parseado, o null si la respuesta es 204
 * @throws  Error con `.estado` y `.datos` si la respuesta no es correcta
 */
export async function api(ruta, opciones = {}) {
    const { sinAuth = false, body, headers = {}, ...resto } = opciones;

    if (!sinAuth) {
        const token = obtenerToken();
        // Renovar de forma proactiva evita el 401 y el reintento.
        if (token && haCaducado(token, MARGEN_RENOVACION_SEGUNDOS)) {
            const ok = await refrescarSesion();
            if (!ok) {
                anunciarSesionCaducada();
                throw crearError(401, { error: "Sesión expirada" });
            }
        }
    }

    let respuesta = await ejecutar(ruta, { ...resto, body, headers, sinAuth });

    // Reintento único: el token pudo caducar justo entre la comprobación y el envío.
    if (respuesta.status === 401 && !sinAuth) {
        const ok = await refrescarSesion();
        if (ok) {
            respuesta = await ejecutar(ruta, { ...resto, body, headers, sinAuth });
        } else {
            anunciarSesionCaducada();
        }
    }

    return interpretar(respuesta);
}

function ejecutar(ruta, { body, headers, sinAuth, ...resto }) {
    const cabeceras = { ...headers };

    if (body !== undefined && !(body instanceof FormData)) {
        cabeceras["Content-Type"] = "application/json";
    }
    if (!sinAuth) {
        const token = obtenerToken();
        if (token) {
            cabeceras.Authorization = `Bearer ${token}`;
        }
    }

    return fetch(`${API_URL}${ruta}`, {
        ...resto,
        headers: cabeceras,
        body: body === undefined
            ? undefined
            : body instanceof FormData
                ? body
                : JSON.stringify(body),
    });
}

async function interpretar(respuesta) {
    if (respuesta.status === 204) return null;

    const texto = await respuesta.text();
    const datos = texto ? seguroJson(texto) : null;

    if (!respuesta.ok) {
        // El backend responde con un formato de error único: { estado, error, ruta, campos }
        throw crearError(respuesta.status, datos);
    }
    return datos;
}

function seguroJson(texto) {
    try {
        return JSON.parse(texto);
    } catch {
        return { error: texto };
    }
}

function crearError(estado, datos) {
    const error = new Error(datos?.error || `Error ${estado}`);
    error.estado = estado;
    error.datos = datos;
    // Errores de validación campo a campo, si los hay.
    error.campos = datos?.campos || null;
    return error;
}

// Atajos, para que los componentes no repitan el método.
export const get = (ruta, opciones) => api(ruta, { ...opciones, method: "GET" });
export const post = (ruta, body, opciones) => api(ruta, { ...opciones, method: "POST", body });
export const put = (ruta, body, opciones) => api(ruta, { ...opciones, method: "PUT", body });
export const patch = (ruta, body, opciones) => api(ruta, { ...opciones, method: "PATCH", body });
export const del = (ruta, opciones) => api(ruta, { ...opciones, method: "DELETE" });

/** URL del WebSocket, derivada de la misma base para no duplicar configuración. */
export function urlWebSocket() {
    return API_URL.replace(/^http/, "ws") + "/ws-gps";
}
