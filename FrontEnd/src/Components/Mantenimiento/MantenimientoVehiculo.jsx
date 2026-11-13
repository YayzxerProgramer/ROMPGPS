import { useNavigate } from "react-router-dom";
import "../../Styles/Mantenimiento.css";
import SemaforoMantenimiento from "./SemaforoMantenimiento";
import { usePrediccion } from "./usePrediccion";

/**
 * Punto de entrada hacia la sección independiente de mantenimiento.
 *
 * La píldora conserva el estado resumido junto al vehículo; al activarla lleva
 * a Configuración > Mantenimiento con la unidad ya seleccionada. Así el dato
 * breve no desaparece de la lista, pero la explicación y el historial dejan
 * de vivir en una ventana superpuesta.
 */
export default function MantenimientoVehiculo({ idVehiculo, etiqueta, variante = "pildora", claseBoton = "mnt-icono mnt-icono--tabla" }) {
    const navigate = useNavigate();
    const resultado = usePrediccion(idVehiculo, variante === "pildora", 0);

    const abrirMantenimiento = () => {
        navigate(`/configuracion?seccion=mantenimiento&vehiculo=${encodeURIComponent(idVehiculo)}`);
    };

    return (
        variante === "pildora" ? (
            <SemaforoMantenimiento resultado={resultado} onClick={abrirMantenimiento} />
        ) : (
            <button type="button" className={claseBoton} title="Ver mantenimiento predictivo"
                aria-label={`Mantenimiento de ${etiqueta}`} onClick={abrirMantenimiento}>
                <span className="material-symbols-outlined" aria-hidden="true">build</span>
            </button>
        )
    );
}
