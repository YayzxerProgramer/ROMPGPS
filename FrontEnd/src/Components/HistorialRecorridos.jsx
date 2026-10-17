import { useState, useEffect, useRef, useMemo } from "react";
import { get } from "../Service/api";
import { distancia, decimal, horaMinutos, crearMarcadorHtml, htmlPunto, encuadrar } from "./mapaUtils";

const PRESETS = [["hoy", "Hoy"], ["ayer", "Ayer"], ["7dias", "7 días"]];
const VELOCIDADES = [1, 2, 5, 10];

// Un hueco sin reportes o una parada larga separan un recorrido del siguiente.
const HUECO_MS = 10 * 60 * 1000;
const PARADA_LARGA_MS = 15 * 60 * 1000;
const MIN_KM = 0.1;

const HTML_UNIDAD = `<div style="width:34px;height:34px;border-radius:50%;background:rgba(34,197,94,0.22);display:grid;place-items:center"><div style="width:20px;height:20px;border-radius:50%;background:#22c55e;border:2.5px solid #ffffff;box-shadow:0 0 14px rgba(34,197,94,.85),0 0 0 1.5px rgba(15,18,14,.9);display:grid;place-items:center"><div style="width:5px;height:5px;border-radius:50%;background:#ffffff"></div></div></div>`;
const HTML_DESTINO = `<span class="material-symbols-outlined" style="font-size:30px;color:#b2cea8;font-variation-settings:'FILL' 1">location_on</span>`;

// Nombres de lugar ya resueltos, compartidos entre montajes de la pestaña.
const cacheLugares = new Map();

const ms = (p) => Date.parse(p.registradoEn);
const aLatLng = (p) => ({ lat: p.latitud, lng: p.longitud });

function rangoDe(preset) {
    const hasta = new Date();
    const desde = new Date();
    if (preset === "hoy") {
        desde.setHours(0, 0, 0, 0);
    } else if (preset === "ayer") {
        desde.setDate(desde.getDate() - 1);
        desde.setHours(0, 0, 0, 0);
        hasta.setDate(hasta.getDate() - 1);
        hasta.setHours(23, 59, 59, 999);
    } else {
        desde.setDate(desde.getDate() - 7);
    }
    return { desde, hasta };
}

function etiquetaDia(fecha) {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return "Hoy";
    if (d.toDateString() === ayer.toDateString()) return "Ayer";
    const texto = d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" }).replace(".", "");
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * El backend devuelve todos los puntos del rango; aquí se parten en
 * recorridos usando los huecos sin reportes y las paradas largas.
 */
function separarRecorridos(puntos, paradas) {
    const recorridos = [];
    let actual = [];
    let quietoDesde = -1;

    const cerrar = () => {
        let ini = 0;
        let fin = actual.length - 1;
        while (ini < fin && actual[ini].velocidad <= 1) ini++;
        while (fin > ini && actual[fin].velocidad <= 1) fin--;
        const tramo = actual.slice(Math.max(0, ini - 1), fin + 2);
        actual = [];
        quietoDesde = -1;
        if (tramo.length < 2) return;

        let metros = 0;
        let vmax = 0;
        for (let k = 1; k < tramo.length; k++) {
            metros += distancia(aLatLng(tramo[k - 1]), aLatLng(tramo[k]));
            vmax = Math.max(vmax, tramo[k].velocidad);
        }
        if (metros / 1000 < MIN_KM) return;

        const t0 = ms(tramo[0]);
        const t1 = ms(tramo[tramo.length - 1]);
        recorridos.push({
            id: `${t0}`,
            puntos: tramo,
            inicio: t0,
            fin: t1,
            km: metros / 1000,
            min: Math.max(1, Math.round((t1 - t0) / 60000)),
            vmax,
            paradas: (paradas || []).filter((p) => {
                const t = Date.parse(p.inicio);
                return t >= t0 && t <= t1;
            }),
        });
    };

    puntos.forEach((p) => {
        const anterior = actual[actual.length - 1];
        if (anterior && ms(p) - ms(anterior) > HUECO_MS) cerrar();
        actual.push(p);

        if (p.velocidad > 1) {
            quietoDesde = -1;
        } else if (quietoDesde < 0) {
            quietoDesde = actual.length - 1;
        } else if (ms(p) - ms(actual[quietoDesde]) > PARADA_LARGA_MS) {
            cerrar();
            actual = [p];
            quietoDesde = 0;
        }
    });
    cerrar();

    return recorridos.reverse(); // más reciente primero
}

function nombreDeLugar(resultado) {
    const tipos = ["neighborhood", "sublocality_level_1", "sublocality", "route", "locality"];
    for (const tipo of tipos) {
        const c = resultado.address_components.find((x) => x.types.includes(tipo));
        if (c) return c.short_name;
    }
    return null;
}

function geocodificar(geocoder, punto) {
    const clave = `${punto.lat.toFixed(3)},${punto.lng.toFixed(3)}`;
    if (cacheLugares.has(clave)) return Promise.resolve(cacheLugares.get(clave));
    return geocoder.geocode({ location: punto })
        .then(({ results }) => {
            const nombre = results[0] ? nombreDeLugar(results[0]) : null;
            cacheLugares.set(clave, nombre);
            return nombre;
        })
        .catch(() => null);
}

export default function HistorialRecorridos({ imei, placa, mapa, google }) {
    const [preset, setPreset] = useState("hoy");
    const [cargando, setCargando] = useState(Boolean(imei));
    const [error, setError] = useState(null);
    const [recorridos, setRecorridos] = useState([]);
    const [lugares, setLugares] = useState({});

    const [selId, setSelId] = useState(null);
    const [indice, setIndice] = useState(0);
    const [reproduciendo, setReproduciendo] = useState(false);
    const [velocidad, setVelocidad] = useState(2);

    const progresoRef = useRef(null);
    const marcadorRef = useRef(null);

    const seleccionado = recorridos.find((r) => r.id === selId) || null;
    const maximo = seleccionado ? seleccionado.puntos.length - 1 : 0;

    // Consulta del rango cada vez que cambia el preset o la unidad
    useEffect(() => {
        if (!imei) return;
        let vigente = true;
        const { desde, hasta } = rangoDe(preset);

        get(`/gps/historial-analizado/${imei}?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`)
            .then((res) => {
                if (!vigente) return;
                const lista = separarRecorridos(res?.puntos || [], res?.paradas);
                setRecorridos(lista);
                if (!lista.length) setError("No hay recorridos en este periodo.");
            })
            .catch((err) => vigente && setError(err.message || "Error al consultar el historial"))
            .finally(() => vigente && setCargando(false));

        return () => { vigente = false; };
    }, [imei, preset]);

    // Nombres de origen y destino (Geocoding), uno a uno para no saturar la API
    useEffect(() => {
        if (!google || !recorridos.length) return;
        let vigente = true;
        const geocoder = new google.maps.Geocoder();

        (async () => {
            for (const r of recorridos.slice(0, 15)) {
                const desde = await geocodificar(geocoder, aLatLng(r.puntos[0]));
                const hasta = await geocodificar(geocoder, aLatLng(r.puntos[r.puntos.length - 1]));
                if (!vigente) return;
                if (desde || hasta) {
                    setLugares((prev) => ({ ...prev, [r.id]: `${desde || "Inicio"} → ${hasta || "Destino"}` }));
                }
            }
        })();

        return () => { vigente = false; };
    }, [google, recorridos]);

    // Dibujo del recorrido seleccionado
    useEffect(() => {
        if (!seleccionado || !mapa || !google) return;
        const ruta = seleccionado.puntos.map(aLatLng);
        const capas = [];
        const linea = (opciones) => {
            const l = new google.maps.Polyline({ path: ruta, map: mapa, clickable: false, ...opciones });
            capas.push(l);
            return l;
        };

        linea({ strokeColor: "#0f120e", strokeOpacity: 0.85, strokeWeight: 10 });
        linea({ strokeColor: "#b2cea8", strokeOpacity: 0.35, strokeWeight: 5 });
        progresoRef.current = linea({ path: ruta.slice(0, 2), strokeColor: "#b2cea8", strokeOpacity: 1, strokeWeight: 5 });

        capas.push(crearMarcadorHtml(google, { mapa, posicion: ruta[0], html: htmlPunto("#b2cea8", 14), ancho: 14, alto: 14 }));
        capas.push(crearMarcadorHtml(google, { mapa, posicion: ruta[ruta.length - 1], html: HTML_DESTINO, ancho: 30, alto: 30, anclaY: 28 }));
        seleccionado.paradas.forEach((p) => {
            capas.push(crearMarcadorHtml(google, { mapa, posicion: aLatLng(p), html: htmlPunto("#c9826c", 12), ancho: 12, alto: 12 }));
        });
        marcadorRef.current = crearMarcadorHtml(google, { mapa, posicion: ruta[0], html: HTML_UNIDAD, ancho: 34, alto: 34, zIndex: 9 });
        capas.push(marcadorRef.current);

        encuadrar(google, mapa, ruta);

        return () => {
            capas.forEach((c) => c.setMap(null));
            progresoRef.current = null;
            marcadorRef.current = null;
        };
    }, [seleccionado, mapa, google]);

    // Posición del reproductor sobre el mapa
    useEffect(() => {
        if (!seleccionado || !marcadorRef.current) return;
        const ruta = seleccionado.puntos.map(aLatLng);
        const i = Math.min(indice, ruta.length - 1);
        marcadorRef.current.setPosition(ruta[i]);
        progresoRef.current?.setPath(ruta.slice(0, Math.max(2, i + 1)));
    }, [indice, seleccionado]);

    // Reproducción: se detiene sola al llegar al final del recorrido
    const enReproduccion = reproduciendo && indice < maximo;

    useEffect(() => {
        if (!enReproduccion) return;
        const id = setInterval(() => setIndice((i) => Math.min(i + velocidad, maximo)), 90);
        return () => clearInterval(id);
    }, [enReproduccion, velocidad, maximo]);

    const elegirPreset = (id) => {
        if (id === preset) return;
        setReproduciendo(false);
        setCargando(true);
        setError(null);
        setRecorridos([]);
        setSelId(null);
        setPreset(id);
    };

    const elegirRecorrido = (id) => {
        setReproduciendo(false);
        setIndice(0);
        setSelId(id);
    };

    const alternarReproduccion = () => {
        if (!enReproduccion && indice >= maximo) setIndice(0);
        setReproduciendo(!enReproduccion);
    };

    const resumen = useMemo(() => {
        const km = recorridos.reduce((a, r) => a + r.km, 0);
        return `${recorridos.length} ${recorridos.length === 1 ? "recorrido" : "recorridos"} · ${decimal(km)} km`;
    }, [recorridos]);

    const punto = seleccionado?.puntos[Math.min(indice, maximo)];

    return (
        <div className="pc-cuerpo">
            <div className="pc-encabezado-seccion pc-encabezado-fila">
                <div>
                    <div className="pc-sobretitulo">Recorridos · {placa || "Unidad"}</div>
                    <div className="pc-titulo">Historial</div>
                </div>
                {!cargando && recorridos.length > 0 && <div className="pc-nota">{resumen}</div>}
            </div>

            <div className="pc-segmentado" role="group" aria-label="Periodo">
                {PRESETS.map(([id, etiqueta]) => (
                    <button
                        key={id}
                        className={`pc-segmento ${preset === id ? "activo" : ""}`}
                        aria-pressed={preset === id}
                        onClick={() => elegirPreset(id)}
                    >
                        {etiqueta}
                    </button>
                ))}
            </div>

            {cargando && <div className="pc-estado">Cargando recorridos…</div>}
            {!cargando && error && <div className="pc-estado">{error}</div>}

            <div className="pc-lista">
                {recorridos.map((r) => (
                    <button
                        key={r.id}
                        className={`pc-fila-tarjeta ${selId === r.id ? "activo" : ""}`}
                        onClick={() => elegirRecorrido(r.id)}
                    >
                        <span className="pc-icono-caja"><span className="material-symbols-outlined">route</span></span>
                        <span className="pc-fila-texto">
                            <span className="pc-fila-meta">
                                <span>{etiquetaDia(r.inicio)}</span>{horaMinutos(r.inicio)} – {horaMinutos(r.fin)}
                            </span>
                            <span className="pc-fila-titulo">{lugares[r.id] || `Recorrido de ${decimal(r.km)} km`}</span>
                        </span>
                        <span className="pc-fila-cifras">
                            <span className="pc-cifra">{decimal(r.km)}<small> km</small></span>
                            <span className="pc-nota">{r.min} min</span>
                        </span>
                    </button>
                ))}
            </div>

            {seleccionado && (
                <>
                    <div className="pc-metricas pc-metricas-2">
                        <div className="pc-metrica"><div className="pc-metrica-etiqueta">Distancia</div><div className="pc-metrica-valor">{decimal(seleccionado.km)} km</div></div>
                        <div className="pc-metrica"><div className="pc-metrica-etiqueta">Duración</div><div className="pc-metrica-valor">{seleccionado.min} min</div></div>
                        <div className="pc-metrica"><div className="pc-metrica-etiqueta">Vel. máxima</div><div className="pc-metrica-valor">{seleccionado.vmax} km/h</div></div>
                        <div className="pc-metrica"><div className="pc-metrica-etiqueta">Paradas</div><div className="pc-metrica-valor pc-texto-peligro">{seleccionado.paradas.length}</div></div>
                    </div>

                    <div className="pc-reproductor">
                        <div className="pc-reproductor-controles">
                            <div className="pc-fila-botones">
                                <button className="pc-boton-redondo primario" onClick={alternarReproduccion} aria-label={enReproduccion ? "Pausar" : "Reproducir"}>
                                    <span className="material-symbols-outlined icono-relleno">{enReproduccion ? "pause" : "play_arrow"}</span>
                                </button>
                                <button className="pc-boton-redondo" onClick={() => { setReproduciendo(false); setIndice(0); }} aria-label="Reiniciar">
                                    <span className="material-symbols-outlined">replay</span>
                                </button>
                            </div>
                            <div className="pc-velocidades" role="group" aria-label="Velocidad de reproducción">
                                {VELOCIDADES.map((v) => (
                                    <button key={v} className={velocidad === v ? "activo" : ""} aria-pressed={velocidad === v} onClick={() => setVelocidad(v)}>
                                        {v}x
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={maximo}
                            value={Math.min(indice, maximo)}
                            onChange={(e) => { setReproduciendo(false); setIndice(Number(e.target.value)); }}
                            aria-label="Posición en el recorrido"
                            className="pc-deslizador"
                        />
                        <div className="pc-reproductor-pie">
                            <span>{punto ? new Date(punto.registradoEn).toLocaleTimeString("es-CO", { hour12: false }) : "--:--"}</span>
                            <span>{punto ? punto.velocidad : 0} km/h</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
