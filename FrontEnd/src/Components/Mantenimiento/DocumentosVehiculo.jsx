import { useState, useEffect } from "react";
import { get, patch } from "../../Service/api";

function obtenerConfigEstado(estado, dias) {
    switch (estado) {
        case "VIGENTE":
            return {
                clase: "mnt-doc-badge--vigente",
                icono: "verified",
                texto: dias != null ? `Vigente (${dias} días)` : "Vigente",
            };
        case "POR_VENCER":
            return {
                clase: "mnt-doc-badge--por-vencer",
                icono: "warning",
                texto: dias != null ? `Vence en ${dias} días` : "Por vencer",
            };
        case "VENCIDO":
            return {
                clase: "mnt-doc-badge--vencido",
                icono: "dangerous",
                texto: dias != null ? `Vencido (${Math.abs(dias)} días)` : "Vencido",
            };
        case "NO_REGISTRADO":
        default:
            return {
                clase: "mnt-doc-badge--sin-registro",
                icono: "help_outline",
                texto: "Sin registrar",
            };
    }
}

export default function DocumentosVehiculo({ idVehiculo, onDocumentosCambiados }) {
    const [vehiculo, setVehiculo] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [mensajeExito, setMensajeExito] = useState("");

    const [fechas, setFechas] = useState({
        fechaVencimientoSoat: "",
        fechaVencimientoTecnomecanica: "",
    });

    const cargarDatos = async () => {
        try {
            setCargando(true);
            const data = await get(`/vehiculo/${idVehiculo}`);
            setVehiculo(data);
            setFechas({
                fechaVencimientoSoat: data.fechaVencimientoSoat || "",
                fechaVencimientoTecnomecanica: data.fechaVencimientoTecnomecanica || "",
            });
            setError("");
        } catch (err) {
            console.error("Error al cargar documentos del vehículo:", err);
            setError("No se pudieron cargar los datos de los documentos.");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        if (idVehiculo) {
            cargarDatos();
        }
    }, [idVehiculo]);

    const manejarCambio = (e) => {
        const { name, value } = e.target;
        setFechas((prev) => ({ ...prev, [name]: value }));
    };

    const guardarDocumentos = async (e) => {
        e.preventDefault();
        setError("");
        setMensajeExito("");
        setGuardando(true);

        try {
            await patch(`/vehiculo/${idVehiculo}/documentos`, {
                fechaVencimientoSoat: fechas.fechaVencimientoSoat || null,
                fechaVencimientoTecnomecanica: fechas.fechaVencimientoTecnomecanica || null,
            });

            setMensajeExito("Fechas de vigencia actualizadas con éxito.");
            setEditando(false);
            await cargarDatos();
            if (onDocumentosCambiados) {
                onDocumentosCambiados();
            }
        } catch (err) {
            console.error("Error al guardar documentos:", err);
            setError(err.message || "Error al actualizar las fechas.");
        } finally {
            setGuardando(false);
        }
    };

    if (cargando && !vehiculo) {
        return (
            <section className="mnt-panel">
                <p className="mnt-nota">Cargando estado de SOAT y Tecnomecánica…</p>
            </section>
        );
    }

    const soatConfig = obtenerConfigEstado(vehiculo?.estadoSoat, vehiculo?.diasParaVencerSoat);
    const tecnoConfig = obtenerConfigEstado(vehiculo?.estadoTecnomecanica, vehiculo?.diasParaVencerTecnomecanica);

    return (
        <section className="mnt-panel mnt-panel--documentos">
            <div className="mnt-doc-cabecera">
                <div className="mnt-doc-titulos">
                    <h3 className="mnt-panel-subtitulo">
                        <span className="material-symbols-outlined" aria-hidden="true">description</span>
                        Documentos y Vigencias RUNT
                    </h3>
                    <p className="mnt-doc-descripcion">
                        Supervisa y renueva el SOAT y la Revisión Técnico-Mecánica (RTM). El sistema te avisará a los 30, 15 y 5 días.
                    </p>
                </div>
                {!editando && (
                    <button
                        type="button"
                        className="mnt-btn-editar-doc"
                        onClick={() => {
                            setEditando(true);
                            setMensajeExito("");
                            setError("");
                        }}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">edit_calendar</span>
                        Actualizar fechas
                    </button>
                )}
            </div>

            {mensajeExito && (
                <div className="mnt-aviso mnt-aviso--exito" role="status">
                    <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                    {mensajeExito}
                </div>
            )}

            {error && (
                <div className="mnt-error" role="alert">
                    <span className="material-symbols-outlined" aria-hidden="true">error</span>
                    {error}
                </div>
            )}

            {!editando ? (
                <div className="mnt-doc-grid">
                    {/* Tarjeta SOAT */}
                    <div className="mnt-doc-tarjeta">
                        <div className="mnt-doc-tarjeta-cab">
                            <span className="mnt-doc-tipo">SOAT</span>
                            <span className={`mnt-doc-badge ${soatConfig.clase}`}>
                                <span className="material-symbols-outlined" aria-hidden="true">{soatConfig.icono}</span>
                                {soatConfig.texto}
                            </span>
                        </div>
                        <div className="mnt-doc-fecha-valor">
                            {vehiculo?.fechaVencimientoSoat || "No registrada"}
                        </div>
                        <div className="mnt-doc-leyenda">Seguro Obligatorio de Accidentes de Tránsito</div>
                    </div>

                    {/* Tarjeta Tecnomecánica */}
                    <div className="mnt-doc-tarjeta">
                        <div className="mnt-doc-tarjeta-cab">
                            <span className="mnt-doc-tipo">Tecnomecánica</span>
                            <span className={`mnt-doc-badge ${tecnoConfig.clase}`}>
                                <span className="material-symbols-outlined" aria-hidden="true">{tecnoConfig.icono}</span>
                                {tecnoConfig.texto}
                            </span>
                        </div>
                        <div className="mnt-doc-fecha-valor">
                            {vehiculo?.fechaVencimientoTecnomecanica || "No registrada"}
                        </div>
                        <div className="mnt-doc-leyenda">Revisión Técnico-Mecánica y Emisiones (CDA)</div>
                    </div>
                </div>
            ) : (
                <form className="mnt-doc-formulario" onSubmit={guardarDocumentos}>
                    <div className="mnt-doc-campos-fila">
                        <div className="mnt-campo">
                            <label className="mnt-etiqueta" htmlFor="doc-soat">
                                Vencimiento SOAT
                            </label>
                            <input
                                id="doc-soat"
                                name="fechaVencimientoSoat"
                                type="date"
                                className="mnt-entrada"
                                value={fechas.fechaVencimientoSoat}
                                onChange={manejarCambio}
                            />
                        </div>

                        <div className="mnt-campo">
                            <label className="mnt-etiqueta" htmlFor="doc-tecno">
                                Vencimiento Tecnomecánica
                            </label>
                            <input
                                id="doc-tecno"
                                name="fechaVencimientoTecnomecanica"
                                type="date"
                                className="mnt-entrada"
                                value={fechas.fechaVencimientoTecnomecanica}
                                onChange={manejarCambio}
                            />
                        </div>
                    </div>

                    <div className="mnt-doc-acciones">
                        <button
                            type="button"
                            className="mnt-btn-cancelar"
                            onClick={() => {
                                setEditando(false);
                                setError("");
                            }}
                            disabled={guardando}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="mnt-btn-guardar"
                            disabled={guardando}
                        >
                            {guardando ? "Guardando…" : "Guardar fechas"}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}
