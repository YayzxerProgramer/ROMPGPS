import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get } from "../../Service/api";
import {
    eliminarMantenimiento, listarMantenimientos, registrarMantenimiento,
} from "../../Service/mantenimientoService";
import { ESTADOS_SIN_ESTIMACION, NIVELES, fechaCorta, hoyISO, km } from "./presentacion";
import { usePrediccion } from "./usePrediccion";
import "../../Styles/Mantenimiento.css";

/**
 * Área de trabajo de mantenimiento predictivo.
 * La predicción no diagnostica una avería: estima los kilómetros que faltan
 * para el próximo mantenimiento recomendado, usando la operación registrada
 * desde el último servicio y los datos GPS disponibles.
 */
export default function PanelMantenimiento({ usuarioId }) {
    const [parametros, setParametros] = useSearchParams();
    const [vehiculos, setVehiculos] = useState([]);
    const [vehiculoExterno, setVehiculoExterno] = useState(null);
    const [cargandoVehiculos, setCargandoVehiculos] = useState(true);
    const [errorVehiculos, setErrorVehiculos] = useState("");
    const [version, setVersion] = useState(0);
    const idSeleccionado = parametros.get("vehiculo");

    useEffect(() => {
        if (!usuarioId) return undefined;
        let cancelado = false;
        get(`/usuario/vehiculos/${usuarioId}`)
            .then((lista) => { if (!cancelado) { setVehiculos(lista || []); setErrorVehiculos(""); } })
            .catch((error) => { if (!cancelado) setErrorVehiculos(error.message || "No se pudieron cargar los vehículos."); })
            .finally(() => { if (!cancelado) setCargandoVehiculos(false); });
        return () => { cancelado = true; };
    }, [usuarioId]);

    useEffect(() => {
        if (!idSeleccionado || cargandoVehiculos || vehiculos.some((v) => String(v.id) === idSeleccionado)) return undefined;
        let cancelado = false;
        get(`/vehiculo/${idSeleccionado}`)
            .then((vehiculo) => { if (!cancelado) setVehiculoExterno(vehiculo); })
            .catch(() => { if (!cancelado) setVehiculoExterno(null); });
        return () => { cancelado = true; };
    }, [idSeleccionado, cargandoVehiculos, vehiculos]);

    const vehiculoSeleccionado = useMemo(() => (
        vehiculos.find((v) => String(v.id) === idSeleccionado) || vehiculoExterno || vehiculos[0] || null
    ), [vehiculos, vehiculoExterno, idSeleccionado]);

    useEffect(() => {
        if (!idSeleccionado && vehiculoSeleccionado) {
            setParametros({ seccion: "mantenimiento", vehiculo: vehiculoSeleccionado.id }, { replace: true });
        }
    }, [idSeleccionado, vehiculoSeleccionado, setParametros]);

    const elegirVehiculo = (id) => setParametros({ seccion: "mantenimiento", vehiculo: id });
    const recargar = useCallback(() => setVersion((actual) => actual + 1), []);
    const resultado = usePrediccion(vehiculoSeleccionado?.id, Boolean(vehiculoSeleccionado), version);
    const unidades = vehiculoExterno && String(vehiculoExterno.id) === idSeleccionado
        && !vehiculos.some((v) => v.id === vehiculoExterno.id)
        ? [vehiculoExterno, ...vehiculos]
        : vehiculos;

    return (
        <main className="mnt-pagina contenido-principal">
            <div className="contenido-principal__envoltorio">
                <header className="mnt-hero">
                    <div>
                        <span className="mnt-sobrelinea">Mantenimiento predictivo</span>
                        <h1>Anticipa el <em>próximo servicio</em></h1>
                        <p>Estimamos los kilómetros que le faltan a tu vehículo para su próximo mantenimiento recomendado. No es un diagnóstico de fallas ni una fecha garantizada.</p>
                    </div>
                    <div className="mnt-hero-icono" aria-hidden="true"><span className="material-symbols-outlined">precision_manufacturing</span></div>
                </header>

                <section className="mnt-explicacion" aria-label="Qué estima el modelo">
                    <Info icono="route" titulo="Qué estimamos" texto="Los kilómetros restantes hasta el siguiente mantenimiento recomendado." />
                    <Info icono="analytics" titulo="Con qué información" texto="El uso GPS desde el último servicio, el tipo de vehículo y el historial registrado." />
                    <Info icono="visibility_off" titulo="Qué no afirma" texto="No detecta daños mecánicos ni sustituye una revisión profesional." />
                </section>

                {cargandoVehiculos ? (
                    <section className="mnt-estado-pagina" aria-busy="true">Cargando tus vehículos…</section>
                ) : errorVehiculos ? (
                    <section className="mnt-estado-pagina mnt-estado-pagina--error" role="alert">{errorVehiculos}</section>
                ) : !vehiculoSeleccionado ? (
                    <section className="mnt-estado-pagina">
                        <span className="material-symbols-outlined" aria-hidden="true">directions_car</span>
                        <div><strong>Aún no hay vehículos para analizar.</strong><p>Registra una unidad y asigna un GPS para comenzar a construir su historial de uso.</p></div>
                    </section>
                ) : (
                    <>
                        <section className="mnt-selector" aria-labelledby="mnt-selector-titulo">
                            <div className="mnt-selector-cabecera"><span id="mnt-selector-titulo">Unidad que quieres consultar</span><small>{unidades.length} {unidades.length === 1 ? "unidad disponible" : "unidades disponibles"}</small></div>
                            <div className="mnt-selector-lista" role="list">
                                {unidades.map((vehiculo) => {
                                    const seleccionada = String(vehiculo.id) === String(vehiculoSeleccionado.id);
                                    return <button key={vehiculo.id} type="button" role="listitem" className={`mnt-unidad ${seleccionada ? "mnt-unidad--activa" : ""}`} onClick={() => elegirVehiculo(vehiculo.id)} aria-pressed={seleccionada}>
                                        <span className="material-symbols-outlined" aria-hidden="true">{vehiculo.tipo === "CARRO" ? "directions_car" : "two_wheeler"}</span>
                                        <span><b>{vehiculo.placa}</b><small>{vehiculo.modelo || "Unidad registrada"}</small></span>
                                    </button>;
                                })}
                            </div>
                        </section>

                        <section className="mnt-unidad-cabecera" aria-label="Vehículo seleccionado">
                            <div className="mnt-unidad-cabecera-icono"><span className="material-symbols-outlined" aria-hidden="true">{vehiculoSeleccionado.tipo === "CARRO" ? "directions_car" : "two_wheeler"}</span></div>
                            <div><span>Estimación para</span><h2>{vehiculoSeleccionado.modelo || "Vehículo"} <small>{vehiculoSeleccionado.placa}</small></h2><p>{vehiculoSeleccionado.imei ? `Equipo GPS · ${vehiculoSeleccionado.imei}` : "Equipo GPS pendiente de asignación"}</p></div>
                        </section>

                        <PanelPrediccion resultado={resultado} onRecargar={recargar} />
                        <div className="mnt-gestion-grid">
                            <FormularioRegistro idVehiculo={vehiculoSeleccionado.id} onRegistrado={recargar} />
                            <Historial idVehiculo={vehiculoSeleccionado.id} version={version} onEliminado={recargar} />
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}

function Info({ icono, titulo, texto }) {
    return <article className="mnt-info"><span className="material-symbols-outlined" aria-hidden="true">{icono}</span><div><h2>{titulo}</h2><p>{texto}</p></div></article>;
}

function PanelPrediccion({ resultado, onRecargar }) {
    const { datos, error, listo } = resultado;
    if (!listo) return <section className="mnt-prediccion mnt-prediccion--cargando" aria-busy="true"><span className="material-symbols-outlined">sync</span> Calculando la estimación con los registros disponibles…</section>;
    if (error) return <section className="mnt-prediccion mnt-prediccion--error" role="alert"><span className="material-symbols-outlined">cloud_off</span><div><b>No pudimos consultar la estimación.</b><p>{error}</p></div><button type="button" className="mnt-boton-secundario" onClick={onRecargar}>Reintentar</button></section>;
    if (datos.estado !== "OK") {
        const info = ESTADOS_SIN_ESTIMACION[datos.estado];
        return <section className="mnt-prediccion mnt-prediccion--sin"><span className="material-symbols-outlined" aria-hidden="true">{info?.icono || "help"}</span><div><span className="mnt-sobrelinea">Aún no hay una estimación</span><h2>{info?.texto || "Sin información disponible"}</h2><p>{datos.mensaje}</p></div><button type="button" className="mnt-boton-secundario" onClick={onRecargar}><span className="material-symbols-outlined">refresh</span>Actualizar</button></section>;
    }
    const nivel = NIVELES[datos.nivel] || NIVELES.BAJO;
    const recorrido = Number(datos.kmDesdeUltimoMantenimiento || 0);
    const restante = Number(datos.kmRestantes || 0);
    const avance = Math.min(100, Math.max(0, (recorrido / Math.max(1, recorrido + restante)) * 100));
    return <section className={`mnt-prediccion mnt-prediccion--${nivel.clase}`}>
        <div className="mnt-prediccion-cabecera"><div><span className="mnt-sobrelinea">Resultado de la estimación</span><h2>Faltan aproximadamente <strong>{km(datos.kmRestantes)}</strong></h2><p>antes del próximo mantenimiento recomendado para esta unidad.</p></div><span className={`mnt-nivel mnt-nivel--${nivel.clase}`}><span className="material-symbols-outlined" aria-hidden="true">{nivel.icono}</span>{nivel.titulo}</span></div>
        <div className="mnt-recorrido"><div className="mnt-recorrido-cabecera"><span>Progreso estimado del ciclo de mantenimiento</span><b>{km(recorrido)} recorridos desde el último servicio</b></div><div className="mnt-barra" role="progressbar" aria-label="Progreso estimado del ciclo de mantenimiento" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(avance)}><span style={{ width: `${avance}%` }} /></div><div className="mnt-recorrido-pie"><span>Último servicio: {fechaCorta(datos.ultimoMantenimiento)}</span><span>Meta estimada del ciclo: {km(recorrido + restante)}</span></div></div>
        <dl className="mnt-metricas">
            <div><dt>Base del fabricante</dt><dd>{km(datos.kmRestantesFabricante)} <small>restantes por intervalo estándar</small></dd></div>
            <div><dt>Uso contado por GPS</dt><dd>{km(recorrido)} <small>en {datos.diasDesdeUltimoMantenimiento} días</small></dd></div>
            <div><dt>Margen del modelo</dt><dd>{datos.errorTipicoKm != null ? `± ${km(datos.errorTipicoKm)}` : "No disponible"}<small>variación observada en sus pruebas</small></dd></div>
        </dl>
        <div className="mnt-aclaraciones">
            <p><span className="material-symbols-outlined" aria-hidden="true">tips_and_updates</span>La cifra se recalcula con el recorrido GPS registrado desde tu último mantenimiento.</p>
            {datos.datosSimulados && <p className="mnt-aviso-modelo"><span className="material-symbols-outlined" aria-hidden="true">science</span>Modelo en etapa de validación: fue entrenado con datos simulados, por eso la estimación es orientativa.</p>}
            {datos.datosIncompletos && datos.mensaje && <p className="mnt-aviso-incompleto"><span className="material-symbols-outlined" aria-hidden="true">warning</span>{datos.mensaje}</p>}
        </div>
        <button type="button" className="mnt-actualizar" onClick={onRecargar}><span className="material-symbols-outlined">refresh</span>Actualizar estimación</button>
    </section>;
}

function FormularioRegistro({ idVehiculo, onRegistrado }) {
    const [fecha, setFecha] = useState(hoyISO());
    const [tipo, setTipo] = useState("PREVENTIVO");
    const [notas, setNotas] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);
    const enviar = async (e) => { e.preventDefault(); setError(""); if (!fecha) return setError("Indica la fecha del mantenimiento."); setEnviando(true); try { await registrarMantenimiento(idVehiculo, { fecha, tipo, notas: notas.trim() || null }); setNotas(""); onRegistrado(); } catch (err) { setError(err.message || "No se pudo registrar el mantenimiento."); } finally { setEnviando(false); } };
    return <section className="mnt-tarjeta-gestion"><div className="mnt-tarjeta-cabecera"><span className="material-symbols-outlined" aria-hidden="true">build_circle</span><div><h2>Registrar mantenimiento</h2><p>Este registro reinicia el ciclo que usamos para la siguiente estimación.</p></div></div><form className="mnt-form" onSubmit={enviar} noValidate><div className="mnt-fila"><label className="mnt-campo"><span>Fecha del servicio</span><input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required /></label><label className="mnt-campo"><span>Tipo de servicio</span><select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="PREVENTIVO">Preventivo</option><option value="CORRECTIVO">Correctivo</option></select></label></div><label className="mnt-campo"><span>Notas (opcional)</span><textarea rows={3} maxLength={500} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej.: cambio de aceite, filtros y revisión general" /></label>{error && <p className="mnt-error" role="alert">{error}</p>}<button type="submit" className="mnt-boton" disabled={enviando}>{enviando ? "Guardando…" : "Guardar y recalcular"}</button></form></section>;
}

function Historial({ idVehiculo, version, onEliminado }) {
    const [consulta, setConsulta] = useState({ idVehiculo: null, historial: null, error: "" });
    const [confirmando, setConfirmando] = useState(null);
    const historial = consulta.idVehiculo === idVehiculo ? consulta.historial : null;
    const error = consulta.idVehiculo === idVehiculo ? consulta.error : "";

    useEffect(() => {
        let cancelado = false;
        listarMantenimientos(idVehiculo)
            .then((lista) => { if (!cancelado) setConsulta({ idVehiculo, historial: lista, error: "" }); })
            .catch((e) => { if (!cancelado) setConsulta({ idVehiculo, historial: null, error: e.message || "No se pudo cargar el historial." }); });
        return () => { cancelado = true; };
    }, [idVehiculo, version]);

    const eliminar = async (id) => {
        try {
            await eliminarMantenimiento(idVehiculo, id);
            setConfirmando(null);
            onEliminado();
        } catch (e) {
            setConsulta({ idVehiculo, historial, error: e.message || "No se pudo eliminar el registro." });
        }
    };
    return <section className="mnt-tarjeta-gestion"><div className="mnt-tarjeta-cabecera"><span className="material-symbols-outlined" aria-hidden="true">history</span><div><h2>Historial de servicios</h2><p>Los mantenimientos más recientes aparecen primero.</p></div></div>{error && <p className="mnt-error" role="alert">{error}</p>}{historial === null && !error && <p className="mnt-nota">Cargando historial…</p>}{historial?.length === 0 && <p className="mnt-nota">Aún no hay mantenimientos registrados.</p>}<ul className="mnt-lista">{historial?.map((m) => <li key={m.id} className="mnt-item"><div className="mnt-item-texto"><b>{fechaCorta(m.fecha)}</b><span className={`mnt-etiqueta mnt-etiqueta--${m.tipo === "CORRECTIVO" ? "correctivo" : "preventivo"}`}>{m.tipo === "CORRECTIVO" ? "Correctivo" : "Preventivo"}</span>{m.notas && <span className="mnt-item-notas">{m.notas}</span>}</div>{confirmando === m.id ? <span className="mnt-confirmar"><button type="button" className="mnt-mini mnt-mini--peligro" onClick={() => eliminar(m.id)}>Eliminar</button><button type="button" className="mnt-mini" onClick={() => setConfirmando(null)}>Cancelar</button></span> : <button type="button" className="mnt-icono" aria-label={`Eliminar mantenimiento del ${fechaCorta(m.fecha)}`} onClick={() => setConfirmando(m.id)}><span className="material-symbols-outlined" aria-hidden="true">delete</span></button>}</li>)}</ul></section>;
}
