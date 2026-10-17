/** Una unidad con velocidad que no reporta en este tiempo deja de estar "en marcha". */
export const MS_EN_MARCHA = 5 * 60 * 1000;

export const ESTADOS = {
  marcha: "EN MARCHA",
  detenido: "DETENIDO",
  sin: "SIN DATOS",
  nogps: "SIN GPS",
  off: "INACTIVO",
};

export const ROLES = {
  ADMINISTRADOR: "Administrador",
  USUARIO: "Cliente",
  VIEWER: "Solo lectura",
};

export const PLANES = {
  PERSONAL: "Personal (Moto / Auto)",
  PRO: "Flotas & Negocios Pro",
  ENTERPRISE: "Empresarial Custom",
};

export const formatoMoneda = (valor) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor || 0);

/** Normaliza una trama GPSData del backend. */
export function aPosicion(d) {
  if (!d || d.latitud == null || d.longitud == null) return null;
  const fecha = d.registradoEn || d.creadosEn;
  return {
    lat: Number(d.latitud),
    lng: Number(d.longitud),
    vel: Number(d.velocidad) || 0,
    fecha: fecha ? new Date(fecha).getTime() : Date.now(),
  };
}

export function estadoDe(v, pos, ahora) {
  if (!v.imei) return "nogps";
  if (!v.activo) return "off";
  if (!pos) return "sin";
  return pos.vel > 0 && ahora - pos.fecha < MS_EN_MARCHA ? "marcha" : "detenido";
}

export function haceCuanto(fecha, ahora) {
  const s = Math.max(0, Math.round((ahora - fecha) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

export function iniciales(nombre) {
  return (nombre || "?").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** Nombre del propietario de un vehículo, distinguiendo "sin dueño" de "no se pudo cargar". */
export function nombrePropietario(idUsuario, u) {
  if (!idUsuario) return "Sin asignar";
  return u ? nombreCompleto(u) : "Propietario no disponible";
}

export function nombreCompleto(u) {
  if (!u) return "Sin asignar";
  return `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario;
}

export const numero = (valor) => (valor ?? 0).toLocaleString("es-CO");

/** "1 cuenta", "3 cuentas". */
export const contar = (n, singular, plural = `${singular}s`) => `${numero(n)} ${n === 1 ? singular : plural}`;

export const fecha = (valor) => (valor ? new Date(valor).toLocaleDateString("es-CO") : "—");

/**
 * La información de propietarios y telemetría GPS ahora se resuelve y enriquece
 * directamente en el Backend (AdminVehiculoService) en una sola consulta.
 * Se conserva esta función como no-op para compatibilidad de imports existentes.
 */
export function olvidarPropietario() {
  // Sin efecto: la caché en cliente fue eliminada.
}

/** Mensaje de error del backend, con los errores de validación campo a campo. */
export function errorDeFormulario(e) {
  return { general: e.campos ? null : e.message || "No se pudo guardar", campos: e.campos || {} };
}

/** Construye la query string ignorando los valores vacíos. */
export function query(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}
