import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    eliminarMantenimiento, listarMantenimientos, registrarMantenimiento,
} from "../../Service/mantenimientoService";
import { ESTADOS_SIN_ESTIMACION, NIVELES, fechaCorta, hoyISO, km } from "./presentacion";

/** Ventana de mantenimiento: predicción, historial y formulario de registro. */
export default function MantenimientoModal({ idVehiculo, etiqueta, resultado, onCambio, onCerrar }) {
    const botonCerrar = useRef(null);
    const [historial, setHistorial] = useState(null);
    const [errorHistorial, setErrorHistorial] = useState(null);
    const [recarga, setRecarga] = useState(0);

    // Escape, bloqueo del scroll y foco inicial.
    useEffect(() => {
        const alPulsar = (e) => { if (e.key === "Escape") onCerrar(); };
        window.addEventListener("keydown", alPulsar);
        const anterior = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        botonCerrar.current?.focus();
        return () => {
            window.removeEventListener("keydown", alPulsar);
            document.body.style.overflow = anterior;
        };
    }, [onCerrar]);

    useEffect(() => {
        let cancelado = false;
        listarMantenimientos(idVehiculo)
            .then((lista) => { if (!cancelado) { setHistorial(lista); setErrorHistorial(null); } })
            .catch((e) => { if (!cancelado) setErrorHistorial(e.message); });
        return () => { cancelado = true; };
    }, [idVehiculo, recarga]);

    const tras = useCallback(() => {
        setRecarga((n) => n + 1);
        onCambio();
    }, [onCambio]);

    return createPortal(
        <div className="mnt-capa mnt-velo" onMouseDown={onCerrar}>
            <div className="mnt-modal" role="dialog" aria-modal="true" aria-label={`Mantenimiento de ${etiqueta}`}
                onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                <header className="mnt-cab">
                    <div>
                        <h2 className="mnt-titulo">Mantenimiento</h2>
                        <p className="mnt-sub">{etiqueta}</p>
                    </div>
                    <button ref={botonCerrar} type="button" className="mnt-cerrar" aria-label="Cerrar" onClick={onCerrar}>
                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </header>

                <div className="mnt-cuerpo">
                    <PanelPrediccion resultado={resultado} />
                    <FormularioRegistro idVehiculo={idVehiculo} onRegistrado={tras} />
                    <Historial idVehiculo={idVehiculo} historial={historial} error={errorHistorial} onEliminado={tras} />
                </div>
            </div>
        </div>,
        document.body,
    );
}

function PanelPrediccion({ resultado }) {
    const { datos, error, listo } = resultado;

    if (!listo) return <section className="mnt-panel" aria-busy="true"><p className="mnt-nota">Calculando predicción…</p></section>;
    if (error) return <section className="mnt-panel"><p className="mnt-error" role="alert">No se pudo consultar la predicción: {error}</p></section>;

    if (datos.estado !== "OK") {
        const info = ESTADOS_SIN_ESTIMACION[datos.estado];
        return (
            <section className="mnt-panel">
                <div className="mnt-sin">
                    <span className="material-symbols-outlined" aria-hidden="true">{info?.icono || "help"}</span>
                    <p>{datos.mensaje}</p>
                </div>
            </section>
        );
    }

    const nivel = NIVELES[datos.nivel] || NIVELES.BAJO;
    return (
        <section className="mnt-panel">
            <div className="mnt-cifra-fila">
                <div>
                    <div className="mnt-cifra">≈ {km(datos.kmRestantes)}</div>
                    <div className="mnt-cifra-leyenda">para el próximo mantenimiento</div>
                </div>
                <span className={`mnt-nivel mnt-nivel--${nivel.clase}`}>
                    <span className="material-symbols-outlined" aria-hidden="true">{nivel.icono}</span>{nivel.titulo}
                </span>
            </div>

            <dl className="mnt-datos">
                <div><dt>Último mantenimiento</dt><dd>{fechaCorta(datos.ultimoMantenimiento)}</dd></div>
                <div><dt>Recorrido desde entonces</dt><dd>{km(datos.kmDesdeUltimoMantenimiento)} · {datos.diasDesdeUltimoMantenimiento} días</dd></div>
                <div><dt>Según el fabricante</dt><dd>{km(datos.kmRestantesFabricante)}</dd></div>
                {datos.errorTipicoKm != null && (
                    <div><dt>Error medio en pruebas</dt><dd>± {km(datos.errorTipicoKm)}</dd></div>
                )}
            </dl>

            {datos.datosSimulados && (
                <p className="mnt-aviso" role="note">
                    <span className="material-symbols-outlined" aria-hidden="true">science</span>
                    Estimación de prueba: el modelo se entrenó con datos simulados, no con mantenimientos reales.
                </p>
            )}
            {datos.datosIncompletos && datos.mensaje && (
                <p className="mnt-aviso mnt-aviso--ambar" role="note">
                    <span className="material-symbols-outlined" aria-hidden="true">warning</span>{datos.mensaje}
                </p>
            )}
        </section>
    );
}

function FormularioRegistro({ idVehiculo, onRegistrado }) {
    const [fecha, setFecha] = useState(hoyISO());
    const [tipo, setTipo] = useState("PREVENTIVO");
    const [notas, setNotas] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const enviar = async (e) => {
        e.preventDefault();
        setError("");
        if (!fecha) return setError("Indica la fecha del mantenimiento.");
        setEnviando(true);
        try {
            await registrarMantenimiento(idVehiculo, { fecha, tipo, notas: notas.trim() || null });
            setNotas("");
            onRegistrado();
        } catch (err) {
            setError(err.message || "No se pudo registrar el mantenimiento.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <form className="mnt-form" onSubmit={enviar} noValidate>
            <h3 className="mnt-seccion">Registrar mantenimiento</h3>
            <div className="mnt-fila">
                <label className="mnt-campo">
                    <span>Fecha</span>
                    <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required />
                </label>
                <label className="mnt-campo">
                    <span>Tipo</span>
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                        <option value="PREVENTIVO">Preventivo</option>
                        <option value="CORRECTIVO">Correctivo</option>
                    </select>
                </label>
            </div>
            <label className="mnt-campo">
                <span>Notas (opcional)</span>
                <textarea rows={2} maxLength={500} value={notas} onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ej.: cambio de aceite y filtro" />
            </label>
            {error && <p className="mnt-error" role="alert">{error}</p>}
            <button type="submit" className="mnt-boton" disabled={enviando}>
                {enviando ? "Guardando…" : "Guardar mantenimiento"}
            </button>
        </form>
    );
}

function Historial({ idVehiculo, historial, error, onEliminado }) {
    const [confirmando, setConfirmando] = useState(null);
    const [fallo, setFallo] = useState("");

    const eliminar = async (id) => {
        setFallo("");
        try {
            await eliminarMantenimiento(idVehiculo, id);
            setConfirmando(null);
            onEliminado();
        } catch (e) {
            setFallo(e.message || "No se pudo eliminar.");
        }
    };

    return (
        <section>
            <h3 className="mnt-seccion">Historial</h3>
            {error && <p className="mnt-error" role="alert">{error}</p>}
            {fallo && <p className="mnt-error" role="alert">{fallo}</p>}
            {!error && historial === null && <p className="mnt-nota">Cargando…</p>}
            {historial?.length === 0 && <p className="mnt-nota">Aún no hay mantenimientos registrados.</p>}
            <ul className="mnt-lista">
                {historial?.map((m) => (
                    <li key={m.id} className="mnt-item">
                        <div className="mnt-item-texto">
                            <b>{fechaCorta(m.fecha)}</b>
                            <span className={`mnt-etiqueta mnt-etiqueta--${m.tipo === "CORRECTIVO" ? "correctivo" : "preventivo"}`}>
                                {m.tipo === "CORRECTIVO" ? "Correctivo" : "Preventivo"}
                            </span>
                            {m.notas && <span className="mnt-item-notas">{m.notas}</span>}
                        </div>
                        {confirmando === m.id ? (
                            <span className="mnt-confirmar">
                                <button type="button" className="mnt-mini mnt-mini--peligro" onClick={() => eliminar(m.id)}>Eliminar</button>
                                <button type="button" className="mnt-mini" onClick={() => setConfirmando(null)}>Cancelar</button>
                            </span>
                        ) : (
                            <button type="button" className="mnt-icono" aria-label={`Eliminar mantenimiento del ${fechaCorta(m.fecha)}`}
                                onClick={() => setConfirmando(m.id)}>
                                <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
