/** Textos y formatos compartidos por la píldora y la ventana de mantenimiento. */

export const NIVELES = {
    ALTO: { icono: "error", titulo: "Urgente", clase: "alto" },
    MEDIO: { icono: "schedule", titulo: "Próximo", clase: "medio" },
    BAJO: { icono: "check_circle", titulo: "Al día", clase: "bajo" },
};

export const ESTADOS_SIN_ESTIMACION = {
    SIN_MANTENIMIENTO: { icono: "add_circle", texto: "Registrar mantenimiento" },
    SIN_DATOS_GPS: { icono: "location_off", texto: "Sin datos GPS" },
    SERVICIO_NO_DISPONIBLE: { icono: "cloud_off", texto: "Predicción no disponible" },
};

/** Redondea a la decena: una cifra como "637 km" aparenta una precisión que el modelo no tiene. */
export const km = (valor) =>
    `${new Intl.NumberFormat("es-CO").format(Math.round(valor / 10) * 10)} km`;

/** "2026-09-01" -> "1 sep 2026", sin pasar por Date(UTC) para no correr el día por la zona horaria. */
export function fechaCorta(iso) {
    if (!iso) return "";
    const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(a, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** Fecha de hoy en la zona del navegador, como AAAA-MM-DD (para el atributo max del input). */
export function hoyISO() {
    const f = new Date();
    const dos = (n) => String(n).padStart(2, "0");
    return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
}
