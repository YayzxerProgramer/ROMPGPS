import { ESTADOS_SIN_ESTIMACION, NIVELES, km } from "./presentacion";

/**
 * Píldora de estado. El color nunca va solo: lleva icono y texto, para que se
 * entienda también sin distinguir colores.
 */
export default function SemaforoMantenimiento({ resultado, onClick }) {
    const { datos, error, listo } = resultado;

    let clase = "neutro";
    let icono = "hourglass_empty";
    let texto = "Calculando…";

    if (listo && error) {
        icono = "cloud_off";
        texto = "No se pudo consultar";
    } else if (datos?.estado === "OK") {
        const nivel = NIVELES[datos.nivel] || NIVELES.BAJO;
        clase = nivel.clase;
        icono = nivel.icono;
        texto = `${nivel.titulo} · ≈ ${km(datos.kmRestantes)}`;
    } else if (datos) {
        const info = ESTADOS_SIN_ESTIMACION[datos.estado];
        icono = info?.icono || "help";
        texto = info?.texto || "Sin información";
    }

    return (
        <button type="button" className={`mnt-pildora mnt-pildora--${clase}`} onClick={onClick}
            aria-label={`Mantenimiento: ${texto}. Abrir detalle`}>
            <span className="material-symbols-outlined" aria-hidden="true">{icono}</span>
            {texto}
        </button>
    );
}
