import { useCallback, useState } from "react";
import "../../Styles/Mantenimiento.css";
import MantenimientoModal from "./MantenimientoModal";
import SemaforoMantenimiento from "./SemaforoMantenimiento";
import { usePrediccion } from "./usePrediccion";

/**
 * Punto de entrada: se coloca en cualquier vista que muestre un vehículo.
 *
 * variante="pildora"  muestra el estado (consulta la predicción al montarse).
 * variante="icono"    solo un botón (claseBoton le da el estilo de la tabla donde se use); la predicción se pide al abrir la ventana.
 *                     Es la que usa el listado del admin, para no disparar una
 *                     consulta por cada fila.
 */
export default function MantenimientoVehiculo({ idVehiculo, etiqueta, variante = "pildora", claseBoton = "mnt-icono mnt-icono--tabla" }) {
    const [abierto, setAbierto] = useState(false);
    const [version, setVersion] = useState(0);

    const resultado = usePrediccion(idVehiculo, variante === "pildora" || abierto, version);
    const cerrar = useCallback(() => setAbierto(false), []);
    const recargar = useCallback(() => setVersion((n) => n + 1), []);

    return (
        <>
            {variante === "pildora" ? (
                <SemaforoMantenimiento resultado={resultado} onClick={() => setAbierto(true)} />
            ) : (
                <button type="button" className={claseBoton} title="Mantenimiento"
                    aria-label={`Mantenimiento de ${etiqueta}`} onClick={() => setAbierto(true)}>
                    <span className="material-symbols-outlined" aria-hidden="true">build</span>
                </button>
            )}
            {abierto && (
                <MantenimientoModal idVehiculo={idVehiculo} etiqueta={etiqueta} resultado={resultado}
                    onCambio={recargar} onCerrar={cerrar} />
            )}
        </>
    );
}
