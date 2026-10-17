/**
 * Manejo de la sesión en el cliente.
 *
 * Antes el rol se descartaba: el backend lo devuelve en el login (y como claim
 * del JWT), pero el frontend solo guardaba token y usuario, así que no había
 * forma de saber si quien entraba era administrador y todo el mundo aterrizaba
 * en /panel-control.
 *
 * Ahora además se guarda el token de refresco: el access token dura 15 minutos
 * y se renueva de forma transparente desde api.js.
 */

const CLAVE_TOKEN = "token";
const CLAVE_REFRESCO = "refreshToken";
const CLAVE_USUARIO = "usuario";
const CLAVE_ROL = "rol";
const CLAVE_PLAN = "plan";

export function guardarSesion({ token, refreshToken, usuario, rol, plan }) {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, usuario);
    localStorage.setItem(CLAVE_ROL, rol || "USUARIO");

    if (plan) {
        localStorage.setItem(CLAVE_PLAN, plan);
    }

    if (refreshToken) {
        localStorage.setItem(CLAVE_REFRESCO, refreshToken);
    }
}

/** Actualiza solo los tokens tras un refresco, conservando usuario y rol. */
export function actualizarTokens({ token, refreshToken }) {
    localStorage.setItem(CLAVE_TOKEN, token);
    if (refreshToken) {
        localStorage.setItem(CLAVE_REFRESCO, refreshToken);
    }
}

export function obtenerToken() {
    return localStorage.getItem(CLAVE_TOKEN);
}

export function obtenerRefresco() {
    return localStorage.getItem(CLAVE_REFRESCO);
}

export function obtenerUsuario() {
    return localStorage.getItem(CLAVE_USUARIO);
}

export function obtenerRol() {
    return localStorage.getItem(CLAVE_ROL) || "USUARIO";
}

export function obtenerPlan() {
    return localStorage.getItem(CLAVE_PLAN) || "PERSONAL";
}

export function esAdmin() {
    const rol = obtenerRol();
    return rol === "ADMINISTRADOR" || rol === "ADMIN";
}

/** Lee la carga útil del JWT sin verificar la firma (eso es cosa del servidor). */
function leerCarga(token) {
    try {
        return JSON.parse(atob(token.split(".")[1]));
    } catch {
        return null;
    }
}

/**
 * ¿Hay sesión utilizable?
 *
 * Se considera válida si el access token no ha caducado O si existe un refresco
 * con el que renovarlo. Antes no se comprobaba nada: bastaba con que hubiera
 * algo en localStorage, así que un token caducado dejaba la interfaz pintada
 * mientras todas las peticiones fallaban en silencio.
 */
export function haySesionValida() {
    const token = obtenerToken();
    if (!token) return false;

    if (!haCaducado(token)) return true;

    // Caducado pero renovable.
    return Boolean(obtenerRefresco());
}

export function haCaducado(token, margenSegundos = 0) {
    const carga = leerCarga(token);
    if (!carga || !carga.exp) return false;
    return carga.exp * 1000 <= Date.now() + margenSegundos * 1000;
}

export function cerrarSesion() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_REFRESCO);
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_ROL);
    localStorage.removeItem(CLAVE_PLAN);
}

/** A dónde llevar al usuario tras iniciar sesión, según su rol. */
export function rutaInicial() {
    return esAdmin() ? "/admin" : "/panel-control";
}
