import { useEffect, useState } from "react";
import { obtenerPrediccion } from "../../Service/mantenimientoService";

/**
 * Carga la predicción. `version` fuerza una recarga (p. ej. tras registrar un
 * mantenimiento). Mientras recarga conserva el dato anterior, para que la
 * interfaz no parpadee. Si `activo` es false no consulta nada.
 */
export function usePrediccion(idVehiculo, activo, version) {
    const [resultado, setResultado] = useState({ datos: null, error: null, listo: false });

    useEffect(() => {
        if (!activo) return undefined;
        let cancelado = false;
        obtenerPrediccion(idVehiculo)
            .then((datos) => { if (!cancelado) setResultado({ datos, error: null, listo: true }); })
            .catch((e) => { if (!cancelado) setResultado({ datos: null, error: e.message, listo: true }); });
        return () => { cancelado = true; };
    }, [idVehiculo, activo, version]);

    return resultado;
}
