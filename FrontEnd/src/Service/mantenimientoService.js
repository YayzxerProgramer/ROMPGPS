import { del, get, post } from "./api";

/**
 * Mantenimiento de vehículos. Todas las rutas exigen ser propietario del
 * vehículo o ADMIN; el backend responde 403 en caso contrario.
 */

/** Historial, del más reciente al más antiguo. */
export const listarMantenimientos = (idVehiculo) =>
    get(`/vehiculo/${idVehiculo}/mantenimientos`);

/** peticion: { fecha: "AAAA-MM-DD", tipo: "PREVENTIVO" | "CORRECTIVO", notas?: string } */
export const registrarMantenimiento = (idVehiculo, peticion) =>
    post(`/vehiculo/${idVehiculo}/mantenimientos`, peticion);

export const eliminarMantenimiento = (idVehiculo, idMantenimiento) =>
    del(`/vehiculo/${idVehiculo}/mantenimientos/${idMantenimiento}`);

/**
 * Predicción de km restantes. `estado` puede ser OK, SIN_MANTENIMIENTO,
 * SIN_DATOS_GPS o SERVICIO_NO_DISPONIBLE: los tres últimos NO son errores HTTP.
 */
export const obtenerPrediccion = (idVehiculo) =>
    get(`/vehiculo/${idVehiculo}/prediccion-mantenimiento`);
