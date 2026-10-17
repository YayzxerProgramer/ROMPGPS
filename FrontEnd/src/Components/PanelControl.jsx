import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import MapaGPS from "./Mapa";
import HistorialRecorridos from "./HistorialRecorridos";
import RecomendadorRutas from "./RecomendadorRutas";
import { useGpsSocket } from "../Service/GpsDataService";
import { get, post } from "../Service/api";
import { cerrarSesion, obtenerUsuario } from "../Service/sesion";
import iconoMoto from "../assets/motorcycle.svg"
import "../Styles/PanelControl.css";

const AVATAR_RESPALDO = "https://lh3.googleusercontent.com/aida-public/AB6AXuAY2LUZy8-2hH4EHpzk3fYPcKWGWO-KFLJi026AWK5hVL8IclrSHzl6nHY3IZDOrMGLfe0y5DCDS_FbOuiQ876MODJCixKpcuhqt9IP42G9ZbNMWt3Bdr3dMicj7oIubOipTqySE4VggkfaXCfjOuO0VP9fVLkKxVRfzrtRfRQW7ZCt9glPMhZinrCn3jhl-cG33Ww0CnjKHUBe4ScbYvWaYi-tMR7xoPPQbShkWGwwFivAB0UuhNoOHFCQlvudSkPAz5W2aANPLQE";

const PESTANAS = [
    ["vivo", "En vivo", "near_me"],
    ["hist", "Historial", "history"],
    ["nav", "Navegar", "navigation"],
];

// Cantidad de reportes que alimentan la gráfica de velocidad y la calidad de señal
const MUESTRAS = 18;

function haceCuanto(fecha) {
    if (!fecha) return "Sin reportes";
    const min = Math.round((Date.now() - Date.parse(fecha)) / 60000);
    if (min < 1) return "Hace instantes";
    if (min < 60) return `Hace ${min} min`;
    if (min < 60 * 24) return `Hace ${Math.round(min / 60)} h`;
    return `Hace ${Math.round(min / 1440)} d`;
}

function leerSim(imei) {
    try {
        return localStorage.getItem(`romp:sim:${imei}`) || "";
    } catch {
        return "";
    }
}

function guardarSim(imei, telefono) {
    try {
        localStorage.setItem(`romp:sim:${imei}`, telefono);
    } catch {
        // Sin almacenamiento: se pedirá de nuevo la próxima vez.
    }
}

export default function PanelControl() {
    const navigate = useNavigate();

    const [usuarioData, setUsuarioData] = useState(null);
    const [vehiculos, setVehiculos] = useState([]);
    const [selId, setSelId] = useState(null);
    const [ultima, setUltima] = useState(null);
    const [vistosOtros, setVistosOtros] = useState({});

    const [pestana, setPestana] = useState("vivo");
    const [mapa, setMapa] = useState(null);
    const [google, setGoogle] = useState(null);
    const [siguiendo, setSiguiendo] = useState(true);
    const [navegando, setNavegando] = useState(false);
    const [capa, setCapa] = useState(null);

    const [hora, setHora] = useState("--:--:--");
    const [muestras, setMuestras] = useState([]);
    const [toast, setToast] = useState("");
    const [dialogo, setDialogo] = useState(null); // null | "corte" | "restablecer"
    const [telefonoSim, setTelefonoSim] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [errorDialogo, setErrorDialogo] = useState(null);
    const toastRef = useRef(null);

    const vehiculoSel = vehiculos.find((v) => v.id === selId)
        || vehiculos.find((v) => v.activo)
        || vehiculos[0]
        || null;
    const imei = vehiculoSel?.imei || null;
    const placa = vehiculoSel?.placa || "Unidad";
    const otros = vehiculos.filter((v) => v !== vehiculoSel);

    // Un solo WebSocket, para la unidad seleccionada
    const { position: posSocket, connected } = useGpsSocket(imei)

    // Hasta que llegue el primer mensaje en vivo se muestra la última posición guardada.
    const position = posSocket?.imei === imei ? posSocket : ultima?.imei === imei ? ultima : null;

    const velocidad = position ? position.velocidad : 0;
    const motorEncendido = Boolean(position?.acc);
    const gpsValido = Boolean(position?.gpsValido);
    const inmovilizado = Boolean(position?.corteMotor);
    const lat = position ? Number(position.latitud).toFixed(4) : "---";
    const lng = position ? Number(position.longitud).toFixed(4) : "---";

    useEffect(() => {
        const id = setInterval(() => setHora(new Date().toLocaleTimeString("es-CO", { hour12: false })), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        get(`/usuario/usuario/${obtenerUsuario()}`)
            .then(setUsuarioData)
            .catch((error) => console.error(error));
    }, []);

    useEffect(() => {
        if (!usuarioData) return;
        get(`/usuario/vehiculos/${usuarioData.id}`)
            .then((data) => setVehiculos(Array.isArray(data) ? data : []))
            .catch((error) => console.error(error));
    }, [usuarioData]);

    useEffect(() => {
        if (!imei) return;
        let vigente = true;
        get(`/gps/ultima-posicion/${imei}`)
            .then((p) => vigente && setUltima(p))
            .catch(() => vigente && setUltima(null));
        return () => { vigente = false; };
    }, [imei]);

    // Último reporte de las demás unidades, para la lista de la flota
    useEffect(() => {
        if (!otros.length) return;
        let vigente = true;
        Promise.all(otros.map((v) => get(`/gps/ultima-posicion/${v.imei}`)
            .then((p) => [v.imei, p?.registradoEn])
            .catch(() => [v.imei, null])))
            .then((pares) => vigente && setVistosOtros(Object.fromEntries(pares)));
        return () => { vigente = false; };
        // Solo cuando cambia la composición de la flota o la unidad elegida.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehiculos, imei]);

    // Cada mensaje nuevo del socket se suma a las muestras (ajuste durante el render,
    // para no encadenar un segundo render desde un efecto).
    const [ultimoMensaje, setUltimoMensaje] = useState(null);
    if (posSocket && posSocket !== ultimoMensaje) {
        setUltimoMensaje(posSocket);
        setMuestras((m) => [...m.slice(-(MUESTRAS - 1)), { v: posSocket.velocidad, valido: posSocket.gpsValido }]);
    }

    const avisar = useCallback((mensaje) => {
        clearTimeout(toastRef.current);
        setToast(mensaje);
        toastRef.current = setTimeout(() => setToast(""), 3200);
    }, []);

    useEffect(() => () => clearTimeout(toastRef.current), []);

    const alNavegar = useCallback((activo) => {
        setNavegando(activo);
        if (activo) setSiguiendo(true);
    }, []);

    const posicionLatLng = position ? { lat: Number(position.latitud), lng: Number(position.longitud) } : null;

    const cambiarPestana = (id) => {
        if (id === pestana) return;
        setPestana(id);
        setSiguiendo(id === "vivo");
        if (mapa && posicionLatLng && id !== "hist") {
            mapa.setZoom(id === "vivo" ? 16 : 14);
            mapa.panTo(posicionLatLng);
        }
    };

    const elegirVehiculo = (id) => {
        setSelId(id);
        setMuestras([]);
        setSiguiendo(true);
    };

    const recentrar = () => {
        setSiguiendo(true);
        if (mapa && posicionLatLng) {
            mapa.panTo(posicionLatLng);
            mapa.setZoom(navegando ? 17 : 16);
        }
    };

    const abrirDialogo = () => {
        setTelefonoSim(leerSim(imei));
        setErrorDialogo(null);
        setDialogo(inmovilizado ? "restablecer" : "corte");
    };

    const cerrarDialogo = useCallback(() => {
        if (!enviando) setDialogo(null);
    }, [enviando]);

    useEffect(() => {
        if (!dialogo) return;
        const alTeclear = (e) => e.key === "Escape" && cerrarDialogo();
        window.addEventListener("keydown", alTeclear);
        return () => window.removeEventListener("keydown", alTeclear);
    }, [dialogo, cerrarDialogo]);

    const enviarComando = async (e) => {
        e.preventDefault();
        const telefono = telefonoSim.trim();
        if (!telefono) {
            setErrorDialogo("Escribe el número de la SIM del GPS.");
            return;
        }
        setEnviando(true);
        setErrorDialogo(null);
        try {
            const res = await post("/gps/comando-sms", {
                imei,
                comando: dialogo === "corte" ? "CORTE_MOTOR" : "RESTAURAR_MOTOR",
                telefonoSim: telefono,
            });
            guardarSim(imei, telefono);
            setDialogo(null);
            avisar(res?.mensaje || (dialogo === "corte" ? `Orden de corte enviada a ${placa}` : `Orden de restablecer enviada a ${placa}`));
        } catch (err) {
            setErrorDialogo(err.message || "No se pudo enviar el comando.");
        } finally {
            setEnviando(false);
        }
    };

    function salir() {
        cerrarSesion();
        navigate("/login", { replace: true });
    }

    // ── Valores derivados para la vista ─────────────────────
    const enLinea = connected && Boolean(posSocket);
    const etiquetaVivo = !connected ? "Sin conexión" : navegando ? "Navegando" : inmovilizado ? "Inmovilizado" : "En vivo";
    const colorVivo = connected && !inmovilizado ? "#b2cea8" : "#c9826c";

    const estado = inmovilizado
        ? { texto: "INMOVILIZADO", clase: "peligro" }
        : enLinea
            ? { texto: "EN VIVO", clase: "acento" }
            : { texto: "OFFLINE", clase: "" };

    const calidad = muestras.length
        ? `${Math.round((muestras.filter((m) => m.valido).length / muestras.length) * 100)}%`
        : "—";
    const maxVel = Math.max(60, ...muestras.map((m) => m.v));
    const barras = Array.from({ length: MUESTRAS }, (_, k) => muestras[k - (MUESTRAS - muestras.length)]);

    const activas = vehiculos.filter((v) => v.activo).length;

    return (
        <div className="pc-raiz">
            <div className="pc-mapa">
                <MapaGPS
                    position={position}
                    siguiendo={siguiendo}
                    atenuado={pestana === "hist"}
                    onArrastre={() => setSiguiendo(false)}
                    onMapLoad={(m, g) => { setMapa(m); setGoogle(g); }}
                />
            </div>
            <div className="pc-velo" />

            {/* Aviso de última posición vista cuando el GPS está offline */}
            {!enLinea && position && (
                <div style={{
                    position: "absolute",
                    top: "80px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 20,
                    background: "rgba(21, 26, 20, 0.92)",
                    color: "#F2F5F0",
                    padding: "8px 18px",
                    borderRadius: "30px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                    fontWeight: "600",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    pointerEvents: "none"
                }}>
                    <span className="material-symbols-outlined" style={{ color: "#EF4444", fontSize: "20px" }}>wifi_off</span>
                    <span>Dispositivo desconectado — Mostrando última posición vista <strong>({haceCuanto(position.registradoEn)})</strong></span>
                </div>
            )}

            {/* ── Cabecera ── */}
            <header className="pc-cabecera">
                <div className="pc-vidrio pc-cabecera-marca">
                    <div className="pc-logo">
                        <span className="material-symbols-outlined icono-relleno">explore</span>
                        ROMP GPS
                    </div>
                    <div className="pc-separador" />
                    <div className="pc-en-vivo">
                        <span className="pc-punto" style={{ background: colorVivo }} />
                        {etiquetaVivo}
                    </div>
                    <div className="pc-reloj">{hora}</div>
                </div>

                <div className="pc-vidrio pc-cabecera-usuario">
                    <Link to="/configuracion" className="pc-boton-icono" title="Configuración" aria-label="Configuración">
                        <span className="material-symbols-outlined">settings</span>
                    </Link>
                    <div className="pc-separador" />
                    <img className="pc-avatar" alt="Perfil" src={usuarioData?.imagenUrl || AVATAR_RESPALDO} />
                    <div className="pc-usuario">
                        <span>{usuarioData?.nombre || usuarioData?.usuario || "Usuario"}</span>
                        <small>{activas} {activas === 1 ? "unidad activa" : "unidades activas"}</small>
                    </div>
                    <button className="pc-boton-salir" onClick={salir} aria-label="Cerrar sesión">
                        <span className="material-symbols-outlined" aria-hidden="true">logout</span>
                        <span className="pc-boton-salir__texto">Salir</span>
                    </button>
                </div>
            </header>

            {/* ── Barra lateral ── */}
            <aside className="pc-lateral">
                <div className="pc-pestanas" role="tablist">
                    {PESTANAS.map(([id, etiqueta, icono]) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={pestana === id}
                            className={pestana === id ? "activo" : ""}
                            onClick={() => cambiarPestana(id)}
                        >
                            <span className="material-symbols-outlined">{icono}</span>{etiqueta}
                        </button>
                    ))}
                </div>

                {pestana === "vivo" && (
                    <>
                        <div className="pc-encabezado-seccion pc-encabezado-fila pc-encabezado-flota">
                            <div>
                                <div className="pc-sobretitulo">Mi flota</div>
                                <div className="pc-titulo">Unidades</div>
                            </div>
                            <div className="pc-nota">{vehiculos.length} {vehiculos.length === 1 ? "unidad" : "unidades"}</div>
                        </div>

                        <div className="pc-cuerpo pc-cuerpo-flota">
                            {!vehiculoSel && <div className="pc-estado">Aún no tienes unidades registradas.</div>}

                            {vehiculoSel && (
                                <div className="pc-unidad">
                                    <div className="pc-unidad-cabeza">
                                        <div className="pc-unidad-identidad">
                                            <div className="pc-unidad-icono"><img src={iconoMoto} alt="" /></div>
                                            <div>
                                                <div className="pc-unidad-placa">{placa}</div>
                                                <div className="pc-nota">{vehiculoSel.modelo || "GPS GT06"}</div>
                                            </div>
                                        </div>
                                        <span className={`pc-etiqueta ${estado.clase}`}>{estado.texto}</span>
                                    </div>

                                    <div className="pc-metricas pc-metricas-3">
                                        <div className="pc-metrica">
                                            <div className="pc-metrica-etiqueta">Velocidad</div>
                                            <div className="pc-metrica-valor pc-metrica-valor-chico">{velocidad}<small> km/h</small></div>
                                        </div>
                                        <div className="pc-metrica">
                                            <div className="pc-metrica-etiqueta">Motor</div>
                                            <div className={`pc-metrica-texto ${motorEncendido ? "pc-texto-acento" : "pc-texto-peligro"}`}>
                                                {motorEncendido ? "Encendido" : "Apagado"}
                                            </div>
                                        </div>
                                        <div className="pc-metrica">
                                            <div className="pc-metrica-etiqueta">GPS</div>
                                            <div className={`pc-metrica-texto ${gpsValido ? "" : "pc-texto-peligro"}`}>{gpsValido ? "Válido" : "Sin señal"}</div>
                                        </div>
                                    </div>

                                    <div className="pc-imei">IMEI {imei}</div>

                                    <div className="pc-par-botones">
                                        <button className={`pc-boton-seguir ${siguiendo ? "activo" : ""}`} onClick={() => (siguiendo ? setSiguiendo(false) : recentrar())}>
                                            <span className="material-symbols-outlined icono-relleno">near_me</span>{siguiendo ? "Siguiendo" : "Seguir"}
                                        </button>
                                        <button className="pc-boton-peligro" onClick={abrirDialogo}>
                                            <span className="material-symbols-outlined">power_settings_new</span>{inmovilizado ? "Restablecer" : "Corte motor"}
                                        </button>
                                    </div>

                                    <div className="pc-par-botones pc-par-botones-borde">
                                        <button className="pc-boton-contorno" onClick={() => cambiarPestana("hist")}>
                                            <span className="material-symbols-outlined">history</span>Ver historial
                                        </button>
                                        <button className="pc-boton-contorno" onClick={() => cambiarPestana("nav")}>
                                            <span className="material-symbols-outlined">navigation</span>Navegar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {otros.map((v) => (
                                <button key={v.id} className="pc-unidad-otra" onClick={() => elegirVehiculo(v.id)} title={`Ver ${v.placa}`}>
                                    <div className="pc-unidad-icono pc-unidad-icono-tenue"><img src={iconoMoto} alt="" /></div>
                                    <div className="pc-fila-texto">
                                        <span className="pc-unidad-otra-placa">{v.placa}</span>
                                        <span className="pc-nota">{v.modelo}</span>
                                    </div>
                                    <div className="pc-unidad-otra-estado">
                                        <span>ÚLTIMO REPORTE</span>
                                        <small>{haceCuanto(vistosOtros[v.imei])}</small>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {pestana === "hist" && (
                    <HistorialRecorridos imei={imei} placa={placa} mapa={mapa} google={google} />
                )}

                {pestana === "nav" && (
                    <RecomendadorRutas
                        mapa={mapa}
                        google={google}
                        position={position}
                        velocidad={velocidad}
                        capa={capa}
                        onNavegando={alNavegar}
                        avisar={avisar}
                    />
                )}

                <div className="pc-lateral-pie">
                    <Link to="/configuracion"><span className="material-symbols-outlined">settings</span>Configuración</Link>
                </div>
            </aside>

            {/* ── Telemetría (solo en vivo) ── */}
            {pestana === "vivo" && (
                <section className="pc-telemetria" aria-label="Telemetría">
                    <div className="pc-telemetria-tarjeta">
                        <div className="pc-telemetria-cabeza">
                            <span>Telemetría</span>
                            <small>{enLinea ? "Tiempo real" : "Último reporte"}</small>
                        </div>
                        <div className="pc-telemetria-velocidad">
                            <div>
                                <div className="pc-velocidad-grande">{velocidad}</div>
                                <div className="pc-nota">km/h · velocidad actual</div>
                            </div>
                            <div className="pc-chispa" aria-hidden="true">
                                {barras.map((m, k) => (
                                    <div
                                        key={k}
                                        style={{
                                            height: `${m ? Math.max(4, Math.round((m.v / maxVel) * 100)) : 4}%`,
                                            background: k === MUESTRAS - 1 && m ? "#b2cea8" : "rgba(178,206,168,.28)",
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="pc-senal">
                            <div className="pc-senal-cabeza">
                                <span>Calidad de señal GPS</span>
                                <strong>{calidad}</strong>
                            </div>
                            <div className="pc-senal-barra">
                                <div style={{ width: muestras.length ? calidad : "0%" }} />
                            </div>
                        </div>
                    </div>

                    <div className="pc-coordenadas">
                        <div><small>LAT</small><span>{lat}°</span></div>
                        <div><small>LNG</small><span>{lng}°</span></div>
                        <div><small>IMEI</small><span>{imei ? imei.slice(-8) : "---"}</span></div>
                        <div><small>GPS</small><span className={gpsValido ? "pc-texto-acento" : "pc-texto-peligro"}>{gpsValido ? "ACTIVO" : "INACTIVO"}</span></div>
                    </div>
                </section>
            )}

            {/* Capa para los paneles de navegación paso a paso */}
            <div ref={setCapa} />

            {/* ── Controles del mapa ── */}
            <div className="pc-zoom">
                <button onClick={() => mapa?.setZoom(mapa.getZoom() + 1)} title="Acercar" aria-label="Acercar">
                    <span className="material-symbols-outlined">add</span>
                </button>
                <button onClick={() => mapa?.setZoom(mapa.getZoom() - 1)} title="Alejar" aria-label="Alejar">
                    <span className="material-symbols-outlined">remove</span>
                </button>
                <button className="pc-zoom-centrar" onClick={recentrar} title="Centrar en la unidad" aria-label="Centrar en la unidad">
                    <span className="material-symbols-outlined">my_location</span>
                </button>
            </div>

            {toast && (
                <div className="pc-toast" role="status">
                    <span className="material-symbols-outlined">check_circle</span>{toast}
                </div>
            )}

            {dialogo && (
                <div className="pc-fondo-dialogo" onClick={cerrarDialogo}>
                    <form
                        className="pc-dialogo"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="pc-dialogo-titulo"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={enviarComando}
                    >
                        <div className={`pc-dialogo-icono ${dialogo === "restablecer" ? "acento" : ""}`}>
                            <span className="material-symbols-outlined">power_settings_new</span>
                        </div>
                        <h2 id="pc-dialogo-titulo">
                            {dialogo === "corte" ? `¿Cortar el motor de ${placa}?` : `¿Restablecer el motor de ${placa}?`}
                        </h2>
                        <p>
                            {dialogo === "corte"
                                ? `La unidad va a ${velocidad} km/h. La orden se envía por SMS a la SIM del GPS y el vehículo quedará inmovilizado hasta que restablezcas el motor.`
                                : "La orden se envía por SMS a la SIM del GPS y el motor volverá a encender con normalidad."}
                        </p>
                        <label className="pc-campo">
                            <span>Número de la SIM del GPS</span>
                            <input
                                type="tel"
                                value={telefonoSim}
                                onChange={(e) => setTelefonoSim(e.target.value)}
                                placeholder="+57 300 000 0000"
                                autoFocus
                            />
                        </label>
                        {errorDialogo && <div className="pc-dialogo-error">{errorDialogo}</div>}
                        <div className="pc-dialogo-acciones">
                            <button type="button" className="pc-boton-secundario" onClick={cerrarDialogo} disabled={enviando}>Cancelar</button>
                            <button type="submit" className={dialogo === "corte" ? "pc-boton-confirmar-peligro" : "pc-boton-confirmar"} disabled={enviando}>
                                {enviando ? "Enviando…" : dialogo === "corte" ? "Confirmar corte" : "Restablecer motor"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
