import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import { obtenerUsuario, obtenerToken, cerrarSesion } from "../Service/sesion";
import { get, patch, urlWebSocket } from "../Service/api";
import FondoAurora from "./FondoAurora";
import MapaFlota from "./Admin/MapaFlota";
import AdminClientes from "./Admin/AdminClientes";
import AdminUnidades from "./Admin/AdminUnidades";
import AdminAnalitica from "./Admin/AdminAnalitica";
import AdminVentas from "./Admin/AdminVentas";
import AdminCuenta from "./Admin/AdminCuenta";
import { FormVehiculo } from "./Admin/AdminFormularios";
import { InsigniaEstado, Modal, ProveedorAvisos, Segmentos } from "./Admin/AdminUI";
import { useAvisar } from "./Admin/avisos";
import {
  ESTADOS, aPosicion, estadoDe, fecha,
  haceCuanto, iniciales, numero, query,
} from "./Admin/adminUtils";

import "../Styles/DashBoard.css";

const NAV = [
  { id: "dashboard", label: "Resumen", icon: "dashboard" },
  { id: "fleet", label: "Monitor de flota", icon: "radar" },
  { id: "clients", label: "Clientes", icon: "group" },
  { id: "gps", label: "Unidades GPS", icon: "satellite_alt" },
  { id: "sales", label: "Ventas", icon: "payments" },
  { id: "analytics", label: "Analítica", icon: "monitoring" },
];

const SECCIONES = new Set([...NAV.map((n) => n.id), "cuenta"]);

const PLACEHOLDER = {
  dashboard: "Buscar placa, modelo o IMEI…",
  fleet: "Filtrar unidades del monitor…",
  clients: "Buscar nombre, usuario o correo…",
  gps: "Buscar placa, modelo o IMEI…",
  sales: "Buscar referencia, cliente o plan…",
};

/** Unidades que sigue el monitor: las más recientes del inventario. */
const TAMANO_FLOTA = 50;

const FILTRO_MONITOR = [
  { valor: "", etiqueta: "Todas" },
  { valor: "marcha", etiqueta: "En marcha" },
  { valor: "detenido", etiqueta: "Detenidas" },
  { valor: "sin", etiqueta: "Sin datos" },
];

export default function Dashboard() {
  return (
    <ProveedorAvisos>
      <PanelAdmin />
    </ProveedorAvisos>
  );
}

function PanelAdmin() {
  const navigate = useNavigate();
  const avisar = useAvisar();
  const usuario = obtenerUsuario() || "ADMIN";

  // La sección vive en la URL: atrás/adelante y recargar mantienen el sitio.
  const [params, setParams] = useSearchParams();
  const seccion = SECCIONES.has(params.get("s")) ? params.get("s") : "dashboard";
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [panel, setPanel] = useState(null); // "avisos" | "ayuda"
  const [registrando, setRegistrando] = useState(false);
  const [pendiente, setPendiente] = useState(null);

  const [resumen, setResumen] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [posiciones, setPosiciones] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState("ahora");
  const [seleccion, setSeleccion] = useState(null);
  const [filtroMonitor, setFiltroMonitor] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());

  const buscadorRef = useRef(null);
  const tablaRef = useRef(null);

  const ir = (id, extra = null) => {
    setParams(id === "dashboard" ? {} : { s: id });
    setMenuAbierto(false);
    setPanel(null);
    setBusqueda("");
    setPendiente(extra);
  };

  // El buscador solo filtra la flota en Resumen y Monitor; Clientes y Unidades
  // lo leen por su cuenta.
  const filtroFlota = seccion === "dashboard" || seccion === "fleet" ? busqueda : "";

  /**
   * Cada petición falla por separado. Antes iban en un único Promise.all: un
   * 500 en cualquiera dejaba todo el panel a cero.
   */
  const cargar = useCallback(async (texto = "") => {
    setCargando(true);
    setError(null);
    const [rResumen, rVehiculos] = await Promise.allSettled([
      get("/admin/resumen"),
      get(`/admin/vehiculos${query({ busqueda: texto, tamano: TAMANO_FLOTA })}`),
    ]);
    const fallos = [];
    if (rResumen.status === "fulfilled") setResumen(rResumen.value);
    else fallos.push(`Resumen: ${rResumen.reason.message}`);

    if (rVehiculos.status === "fulfilled") {
      const lista = rVehiculos.value.contenido;
      setVehiculos(lista);
      const posIniciales = {};
      lista.forEach((v) => {
        if (v.imei && v.ultimaPosicion) {
          posIniciales[v.imei] = v.ultimaPosicion;
        }
      });
      setPosiciones((prev) => ({ ...posIniciales, ...prev }));
    } else {
      fallos.push(`Vehículos: ${rVehiculos.reason.message}`);
    }

    setError(fallos.length ? fallos.join(" · ") : null);
    setActualizado(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }));
    setCargando(false);
  }, []);

  // Carga inicial y buscador en un solo efecto: la espera de 400 ms evita una
  // petición por tecla y al montar dispara igualmente la primera carga.
  useEffect(() => {
    const id = setTimeout(() => cargar(filtroFlota), 400);
    return () => clearTimeout(id);
  }, [filtroFlota, cargar]);

  // Reloj para los "hace X s" y para que una unidad deje de figurar en marcha
  // cuando deja de reportar.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // "/" enfoca el buscador, como en la mayoría de paneles.
  useEffect(() => {
    const alPulsar = (e) => {
      const escribiendo = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if (e.key === "/" && !escribiendo && buscadorRef.current) {
        e.preventDefault();
        buscadorRef.current.focus();
      }
      if (e.key === "Escape") setPanel((p) => (p === "avisos" ? null : p));
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  // Posiciones en vivo. Un solo cliente STOMP para toda la flota visible; el
  // backend deja a un ADMIN suscribirse a cualquier IMEI.
  const imeis = useMemo(
    () => vehiculos.filter((v) => v.imei).map((v) => v.imei).sort().join(","),
    [vehiculos]);

  useEffect(() => {
    const token = obtenerToken();
    if (!imeis || !token) return;

    const client = new Client({
      brokerURL: urlWebSocket(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        imeis.split(",").forEach((imei) => {
          client.subscribe(`/socket/gps/${imei}`, (mensaje) => {
            try {
              const pos = aPosicion(JSON.parse(mensaje.body));
              if (pos) setPosiciones((prev) => ({ ...prev, [imei]: pos }));
            } catch {
              // Trama ilegible: se ignora y se espera la siguiente.
            }
          });
        });
      },
    });
    client.activate();
    return () => {
      client.deactivate();
    };
  }, [imeis]);

  const flota = useMemo(() => vehiculos.map((v) => {
    const duenno = v.propietario;
    const pos = (v.imei && posiciones[v.imei]) || v.ultimaPosicion || null;
    const estado = (posiciones[v.imei] ? estadoDe(v, pos, ahora) : v.estado) || "sin";
    return {
      ...v,
      pos,
      duenno,
      propietario: v.nombrePropietario || "Sin asignar",
      estado,
    };
  }), [vehiculos, posiciones, ahora]);

  const conteo = useMemo(() => {
    const c = { marcha: 0, detenido: 0, sin: 0, nogps: 0, off: 0 };
    flota.forEach((v) => { c[v.estado] += 1; });
    return c;
  }, [flota]);

  const elegir = useCallback((id) => {
    setSeleccion((actual) => (id === null || actual === id ? null : id));
  }, []);

  /** "Ubicar" desde Unidades: si la unidad no está en el monitor, se añade. */
  const ubicar = async (id) => {
    ir("fleet");
    if (!vehiculos.some((v) => v.id === id)) {
      try {
        const v = await get(`/admin/vehiculos/${id}`);
        setVehiculos((prev) => [v, ...prev]);
        if (v.imei && v.ultimaPosicion) {
          setPosiciones((prev) => ({ ...prev, [v.imei]: v.ultimaPosicion }));
        }
      } catch (e) {
        avisar(e.message, "error");
        return;
      }
    }
    setSeleccion(id);
  };

  const manejarCerrarSesion = () => {
    cerrarSesion();
    navigate("/login", { replace: true });
  };

  const alternarEstadoVehiculo = async (v) => {
    try {
      await patch(`/admin/vehiculos/${v.id}/estado`);
      avisar(v.activo ? `${v.placa} desactivado` : `${v.placa} activado`);
      cargar(filtroFlota);
    } catch (e) {
      avisar(e.message, "error");
    }
  };

  const exportarCsv = () => {
    const cabecera = "imei,placa,modelo,tipo,activo,propietario,creadoEn";
    const filas = flota.map((v) =>
      [v.imei || "", v.placa, v.modelo, v.tipo, v.activo, `"${v.propietario}"`, v.creadoEn].join(","));
    const csv = [cabecera, ...filas].join("\n");

    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    enlace.download = `vehiculos-${new Date().toISOString().slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  const total = resumen?.totalVehiculos ?? 0;
  const conImei = resumen?.vehiculosConImei ?? 0;
  const cobertura = total ? Math.round((conImei / total) * 100) : 0;
  const pctActivos = resumen?.totalUsuarios
    ? Math.round((resumen.usuariosActivos / resumen.totalUsuarios) * 100)
    : 0;
  const sinDuenno = resumen?.vehiculosSinDuenno ?? 0;
  const sinGps = Math.max(0, total - conImei);
  const usuariosInactivos = resumen ? resumen.totalUsuarios - resumen.usuariosActivos : 0;

  const alertas = [
    error && { icono: "error", tono: "peligro", texto: "Algunos datos no se pudieron cargar", detalle: error, accion: () => cargar(filtroFlota), boton: "Reintentar" },
    sinDuenno > 0 && { icono: "link_off", texto: `${numero(sinDuenno)} vehículos sin propietario`, detalle: "Vincúlalos a un cliente", accion: () => ir("gps"), boton: "Revisar" },
    sinGps > 0 && { icono: "satellite_alt", tono: "ambar", texto: `${numero(sinGps)} vehículos sin equipo GPS`, detalle: "No pueden reportar posición", accion: () => ir("gps"), boton: "Revisar" },
    conteo.sin > 0 && { icono: "signal_disconnected", texto: `${numero(conteo.sin)} unidades sin reportar`, detalle: "En el monitor de flota", accion: () => ir("fleet"), boton: "Ver" },
    usuariosInactivos > 0 && { icono: "person_off", texto: `${numero(usuariosInactivos)} cuentas inactivas`, detalle: "Sin acceso al sistema", accion: () => ir("clients"), boton: "Ver" },
  ].filter(Boolean);

  const gestion = [
    { icon: "group", titulo: "Registro de clientes", desc: "Altas, roles y acceso de usuarios", accion: () => ir("clients", { alta: true }) },
    { icon: "inventory_2", titulo: "Inventario de equipos", desc: "Equipos GT06 y vehículos", accion: () => ir("gps") },
    { icon: "link", titulo: "Vincular vehículo y usuario", desc: "Asignar equipos a propietarios", accion: () => ir("gps", { dialogo: { tipo: "vincular" } }) },
  ];

  const tituloSeccion = seccion === "cuenta" ? "Mi cuenta" : NAV.find((n) => n.id === seccion)?.label;
  const conBuscador = Boolean(PLACEHOLDER[seccion]);
  const limpiarPendiente = useCallback(() => setPendiente(null), []);
  const monitorizadas = flota.filter((v) => !filtroMonitor || v.estado === filtroMonitor);

  return (
    <div className="adm">
      <FondoAurora />
      {menuAbierto && <div className="adm-velo" onClick={() => setMenuAbierto(false)} />}

      <aside className={`adm-lateral ${menuAbierto ? "abierto" : ""}`}>
        <button className="adm-marca" onClick={() => ir("dashboard")}>
          <span className="adm-marca-icono"><span className="material-symbols-outlined">explore</span></span>ROMP GPS
        </button>
        <div className="adm-lateral-titulo">Administración</div>
        <nav className="adm-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`adm-nav-item ${seccion === n.id ? "activo" : ""}`}
              aria-current={seccion === n.id ? "page" : undefined}
              onClick={() => ir(n.id)}
            >
              <span className="material-symbols-outlined">{n.icon}</span>{n.label}
              {n.id === "fleet" && conteo.marcha > 0 && <span className="adm-nav-contador">{conteo.marcha}</span>}
            </button>
          ))}
        </nav>
        <div className="adm-lateral-pie">
          <button className="adm-btn-registrar" onClick={() => { setRegistrando(true); setMenuAbierto(false); }}>
            <span className="material-symbols-outlined">add</span>Registrar equipo
          </button>
          <button className={`adm-lateral-link ${seccion === "cuenta" ? "activo" : ""}`} onClick={() => ir("cuenta")}>
            <span className="material-symbols-outlined">person</span>Mi perfil
          </button>
          <button className="adm-lateral-link adm-lateral-link--salir" onClick={manejarCerrarSesion}>
            <span className="material-symbols-outlined">logout</span>Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="adm-cuerpo">
        <header className="adm-cabecera">
          <button className="adm-icono-btn adm-menu-btn" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}>
            <span className="material-symbols-outlined">menu</span>
          </button>
          {conBuscador ? (
            <label className="adm-buscador">
              <span className="material-symbols-outlined">search</span>
              <input
                ref={buscadorRef}
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={PLACEHOLDER[seccion]}
                aria-label={PLACEHOLDER[seccion]}
              />
              <kbd className="adm-tecla">/</kbd>
            </label>
          ) : (
            <div className="adm-miga">
              <span>Administración</span>
              <span className="material-symbols-outlined">chevron_right</span>
              <b>{tituloSeccion}</b>
            </div>
          )}
          <div className="adm-cabecera-der">
            <div className="adm-desplegable">
              <button
                className={`adm-icono-btn ${panel === "avisos" ? "activo" : ""}`}
                title="Notificaciones"
                aria-expanded={panel === "avisos"}
                onClick={() => setPanel((p) => (p === "avisos" ? null : "avisos"))}
              >
                <span className="material-symbols-outlined">notifications</span>
                {alertas.length > 0 && <span className="adm-icono-punto">{alertas.length}</span>}
              </button>
              {panel === "avisos" && (
                <>
                  <div className="adm-desplegable-velo" onClick={() => setPanel(null)} />
                  <div className="adm-avisos-panel" role="dialog" aria-label="Notificaciones">
                    <div className="adm-avisos-cab">
                      <b>Notificaciones</b>
                      <span>{alertas.length ? `${alertas.length} ${alertas.length === 1 ? "pendiente" : "pendientes"}` : "Todo en orden"}</span>
                    </div>
                    {alertas.length === 0 && (
                      <div className="adm-avisos-vacio">
                        <span className="material-symbols-outlined">task_alt</span>
                        No hay nada que requiera tu atención.
                      </div>
                    )}
                    {alertas.map((a) => (
                      <div key={a.texto} className={`adm-alerta ${a.tono ? `adm-alerta--${a.tono}` : ""}`}>
                        <span className="adm-alerta-icono"><span className="material-symbols-outlined">{a.icono}</span></span>
                        <span className="adm-celda-doble">
                          <b>{a.texto}</b>
                          <span>{a.detalle}</span>
                        </span>
                        <button className="adm-btn-fila" onClick={() => { setPanel(null); a.accion(); }}>{a.boton}</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button className={`adm-icono-btn adm-ocultar-movil ${seccion === "cuenta" ? "activo" : ""}`} title="Configuración de la cuenta" onClick={() => ir("cuenta")}>
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button className="adm-icono-btn adm-ocultar-movil" title="Ayuda" onClick={() => setPanel("ayuda")}>
              <span className="material-symbols-outlined">help</span>
            </button>
            <div className="adm-separador" />
            <button className="adm-sesion-btn" onClick={() => ir("cuenta")} title="Mi cuenta">
              <span className="adm-sesion">
                <span className="adm-sesion-nombre">{usuario.toUpperCase()}</span>
                <span className="adm-sesion-estado">ADMINISTRADOR</span>
              </span>
              <span className="adm-avatar">{usuario.charAt(0).toUpperCase()}</span>
            </button>
          </div>
        </header>

        <main className="adm-principal">
          <div className="adm-contenido" key={seccion}>
            {seccion === "dashboard" && (
              <>
                <div className="adm-encabezado">
                  <div>
                    <div className="adm-encabezado-meta">
                      <span className="adm-en-vivo"><span className="adm-en-vivo-punto" />SISTEMA EN VIVO</span>
                      <span className="adm-encabezado-nota">{numero(total)} vehículos bajo gestión</span>
                    </div>
                    <h1 className="adm-titulo">Centro de <em>mando</em></h1>
                    <p className="adm-subtitulo">Administración de usuarios, vehículos y dispositivos GPS.</p>
                  </div>
                  <button className="adm-btn-secundario" onClick={() => cargar(filtroFlota)} disabled={cargando}>
                    <span className={`material-symbols-outlined ${cargando ? "adm-girando" : ""}`}>refresh</span>
                    {cargando ? "Cargando…" : `Recargar · ${actualizado}`}
                  </button>
                </div>

                {error && (
                  <div className="adm-error" role="alert">
                    <span className="material-symbols-outlined">error</span>{error}
                    <button className="adm-enlace adm-error-accion" onClick={() => cargar(filtroFlota)}>REINTENTAR</button>
                  </div>
                )}

                <div className="adm-stats">
                  <button className="adm-stat" onClick={() => ir("clients")}>
                    <div className="adm-stat-cab"><span>USUARIOS</span><span className="material-symbols-outlined">group</span></div>
                    <div className="adm-stat-valor">{numero(resumen?.totalUsuarios)}</div>
                    <div className="adm-stat-sub"><b>{numero(resumen?.usuariosActivos)} activos</b> · {pctActivos}%</div>
                    <div className="adm-progreso"><div style={{ width: `${pctActivos}%` }} /></div>
                  </button>
                  <button className="adm-stat" onClick={() => ir("gps")}>
                    <div className="adm-stat-cab"><span>VEHÍCULOS</span><span className="material-symbols-outlined">two_wheeler</span></div>
                    <div className="adm-stat-valor">{numero(total)}</div>
                    <div className="adm-stat-sub"><b>{numero(sinDuenno)}</b> sin asignar</div>
                  </button>
                  <button className="adm-stat" onClick={() => ir("analytics")}>
                    <div className="adm-stat-cab"><span>CON GPS</span><span className="material-symbols-outlined">satellite_alt</span></div>
                    <div className="adm-stat-valor">{cobertura}<small>%</small></div>
                    <div className="adm-senal">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span key={i} className={i < Math.round((cobertura / 100) * 5) ? "on" : ""} />
                      ))}
                      <span className="adm-senal-texto">{numero(conImei)} equipos</span>
                    </div>
                  </button>
                  <button className="adm-stat" onClick={() => ir("clients")}>
                    <div className="adm-stat-cab"><span>ADMINISTRADORES</span><span className="material-symbols-outlined">shield_person</span></div>
                    <div className="adm-stat-valor">{String(resumen?.administradores ?? 0).padStart(2, "0")}</div>
                    <div className="adm-stat-sub">Con acceso al panel</div>
                  </button>
                </div>

                <div className="adm-fila">
                  <MapaFlota flota={flota} conteo={conteo} seleccion={seleccion} onElegir={elegir} ahora={ahora} />

                  <div className="adm-columna">
                    <div className="adm-tarjeta">
                      <div className="adm-etiqueta">ESTADO DE LA FLOTA</div>
                      <div className="adm-flota">
                        <div><b>{numero(conImei)}</b><span>Equipos instalados</span></div>
                        <div><b>{cobertura}<small>%</small></b><span>Cobertura</span></div>
                        <div><b>{numero(sinDuenno)}</b><span>Sin asignar</span></div>
                      </div>
                      <div className="adm-flota-pie">
                        <span>GT06 · puerto 9000 TCP</span><span>/socket/gps/{"{imei}"}</span>
                      </div>
                    </div>

                    <div className="adm-tarjeta adm-gestion">
                      <div className="adm-etiqueta">GESTIÓN</div>
                      {gestion.map((m) => (
                        <button key={m.titulo} className="adm-gestion-item" onClick={m.accion}>
                          <span className="adm-gestion-icono"><span className="material-symbols-outlined">{m.icon}</span></span>
                          <span className="adm-gestion-texto">
                            <b>{m.titulo}</b>
                            <span>{m.desc}</span>
                          </span>
                          <span className="material-symbols-outlined adm-gestion-flecha">chevron_right</span>
                        </button>
                      ))}
                    </div>

                    <div className="adm-tarjeta adm-inventario">
                      <div className="adm-inventario-titulo">Inventario sin asignar</div>
                      <p>Hay {numero(sinDuenno)} vehículos sin propietario y {numero(sinGps)} sin equipo GPS.</p>
                      <button className="adm-enlace" onClick={() => ir("gps")}>
                        REVISAR INVENTARIO<span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="adm-tabla-tarjeta" ref={tablaRef}>
                  <div className="adm-tabla-cab">
                    <div>
                      <div className="adm-tabla-titulo">Vehículos registrados</div>
                      <div className="adm-tabla-sub">Últimos vehículos dados de alta. Pulsa una fila para ubicarla en el mapa.</div>
                    </div>
                    <div className="adm-encabezado-acciones">
                      <button className="adm-btn-secundario" onClick={exportarCsv} disabled={vehiculos.length === 0}>
                        <span className="material-symbols-outlined">download</span>Exportar CSV
                      </button>
                      <button className="adm-btn-secundario" onClick={() => ir("gps")}>
                        Ver inventario<span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                  <TablaFlota
                    flota={flota.slice(0, 12)}
                    cargando={cargando}
                    busqueda={busqueda}
                    seleccion={seleccion}
                    onElegir={elegir}
                    onAlternar={alternarEstadoVehiculo}
                  />
                </div>
              </>
            )}

            {seccion === "fleet" && (
              <>
                <div className="adm-encabezado">
                  <div>
                    <div className="adm-encabezado-meta">
                      <span className="adm-en-vivo"><span className="adm-en-vivo-punto" />EN VIVO</span>
                      <span className="adm-encabezado-nota">{flota.length} unidades monitorizadas</span>
                    </div>
                    <h1 className="adm-titulo">Monitor de <em>flota</em></h1>
                    <p className="adm-subtitulo">Posición en tiempo real de las unidades más recientes.</p>
                  </div>
                  <button className="adm-btn-secundario" onClick={() => cargar(filtroFlota)} disabled={cargando}>
                    <span className={`material-symbols-outlined ${cargando ? "adm-girando" : ""}`}>refresh</span>
                    {cargando ? "Cargando…" : `Recargar · ${actualizado}`}
                  </button>
                </div>
                <div className="adm-monitor">
                  <MapaFlota flota={flota} conteo={conteo} seleccion={seleccion} onElegir={elegir} ahora={ahora} grande />
                  <div className="adm-tarjeta adm-monitor-lista">
                    <Segmentos opciones={FILTRO_MONITOR} valor={filtroMonitor} onCambiar={setFiltroMonitor} pequeno />
                    <div className="adm-monitor-scroll">
                      {monitorizadas.length === 0 && (
                        <div className="adm-tabla-vacia">{cargando ? "Cargando…" : "Ninguna unidad en este estado"}</div>
                      )}
                      {monitorizadas.map((v) => (
                        <button
                          key={v.id}
                          className={`adm-unidad ${seleccion === v.id ? "seleccionada" : ""}`}
                          onClick={() => elegir(v.id)}
                          disabled={!v.pos}
                          title={v.pos ? "Ubicar en el mapa" : "Esta unidad aún no ha reportado posición"}
                        >
                          <span className={`adm-unidad-punto adm-unidad-punto--${v.estado}`} />
                          <span className="adm-celda-doble">
                            <b>{v.placa}</b>
                            <span>{v.propietario}</span>
                          </span>
                          <span className="adm-unidad-der">
                            <span className={`adm-tono--${v.estado}`}>{ESTADOS[v.estado]}</span>
                            <span>{v.pos ? `${v.pos.vel} km/h · ${haceCuanto(v.pos.fecha, ahora)}` : "—"}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {seccion === "clients" && (
              <AdminClientes
                busqueda={busqueda}
                abrirAlta={Boolean(pendiente?.alta)}
                onAltaAbierta={limpiarPendiente}
                onCambio={() => cargar(filtroFlota)}
              />
            )}

            {seccion === "gps" && (
              <AdminUnidades
                busqueda={busqueda}
                dialogoInicial={pendiente?.dialogo || null}
                onDialogoAbierto={limpiarPendiente}
                onCambio={() => cargar(filtroFlota)}
                onUbicar={ubicar}
              />
            )}

            {seccion === "sales" && (
              <AdminVentas busqueda={busqueda} />
            )}

            {seccion === "analytics" && (
              <AdminAnalitica resumen={resumen} conteoEstados={conteo} totalMonitorizadas={flota.length} />
            )}

            {seccion === "cuenta" && <AdminCuenta />}

            <div className="adm-pie">© {new Date().getFullYear()} ROMP GPS TELEMETRY SYSTEMS</div>
          </div>
        </main>
      </div>

      {registrando && (
        <FormVehiculo
          onCerrar={() => setRegistrando(false)}
          onGuardado={(_, mensaje) => { avisar(mensaje); cargar(filtroFlota); }}
        />
      )}

      {panel === "ayuda" && <Ayuda onCerrar={() => setPanel(null)} />}
    </div>
  );
}

function TablaFlota({ flota, cargando, busqueda, seleccion, onElegir, onAlternar }) {
  return (
    <div className="adm-tabla-scroll">
      <div className="adm-tabla">
        <div className="adm-tabla-fila adm-tabla-fila--cab">
          <span>PLACA / IMEI</span><span>PROPIETARIO</span><span>MODELO</span><span>ESTADO</span><span>ALTA</span><span className="der">ACCIONES</span>
        </div>

        {cargando && flota.length === 0 && <div className="adm-tabla-vacia">Cargando…</div>}

        {!cargando && flota.length === 0 && (
          <div className="adm-tabla-vacia">
            {busqueda ? "Sin resultados para la búsqueda" : "Todavía no hay vehículos registrados"}
          </div>
        )}

        {flota.map((v) => (
          <div
            key={v.id}
            className={`adm-tabla-fila ${seleccion === v.id ? "seleccionada" : ""}`}
            onClick={() => onElegir(v.id)}
          >
            <div>
              <div className="adm-placa">{v.placa}</div>
              <div className={`adm-imei ${v.imei ? "" : "adm-tono--nogps"}`}>{v.imei || "SIN GPS"}</div>
            </div>
            <div className="adm-propietario">
              <span className="adm-iniciales">{v.duenno ? iniciales(v.propietario) : "—"}</span>
              <span className={`adm-propietario-nombre ${v.duenno ? "" : "adm-tenue"}`}>{v.propietario}</span>
            </div>
            <div className="adm-modelo">{v.modelo} · {v.tipo}</div>
            <div><InsigniaEstado estado={v.estado} texto={ESTADOS[v.estado]} /></div>
            <div className="adm-alta">{fecha(v.creadoEn)}</div>
            <div className="der">
              <button
                className="adm-btn-fila"
                onClick={(e) => { e.stopPropagation(); onAlternar(v); }}
              >
                {v.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ayuda({ onCerrar }) {
  const secciones = [
    ["dashboard", "Resumen", "Cifras clave, mapa en vivo y accesos rápidos de gestión."],
    ["radar", "Monitor de flota", "Mapa a pantalla completa con la lista de unidades y su estado."],
    ["group", "Clientes", "Crear usuarios, cambiar su rol, restablecer contraseñas y desactivar cuentas."],
    ["satellite_alt", "Unidades GPS", "Registrar equipos GT06, editarlos y vincularlos a un propietario."],
    ["monitoring", "Analítica", "Cobertura GPS, distribución de roles y estado de las unidades."],
  ];
  return (
    <Modal titulo="Ayuda del panel" subtitulo="Qué hay en cada sección" icono="help" onCerrar={onCerrar} ancho={560}>
      <div className="adm-ayuda">
        {secciones.map(([icono, titulo, texto]) => (
          <div key={titulo} className="adm-ayuda-item">
            <span className="adm-gestion-icono"><span className="material-symbols-outlined">{icono}</span></span>
            <span className="adm-gestion-texto"><b>{titulo}</b><span>{texto}</span></span>
          </div>
        ))}
      </div>
      <div className="adm-etiqueta adm-ficha-separador">ESTADOS DE UNA UNIDAD</div>
      <div className="adm-ayuda-estados">
        <InsigniaEstado estado="marcha" texto={ESTADOS.marcha} /> <span>Velocidad &gt; 0 y reportó hace menos de 5 min.</span>
        <InsigniaEstado estado="detenido" texto={ESTADOS.detenido} /> <span>Reporta, pero está quieta.</span>
        <InsigniaEstado estado="sin" texto={ESTADOS.sin} /> <span>Tiene equipo pero nunca ha enviado posición.</span>
        <InsigniaEstado estado="nogps" texto={ESTADOS.nogps} /> <span>No tiene IMEI asignado.</span>
        <InsigniaEstado estado="off" texto={ESTADOS.off} /> <span>Rastreo desactivado por un administrador.</span>
      </div>
      <div className="adm-etiqueta adm-ficha-separador">ATAJOS</div>
      <p className="adm-modal-texto"><kbd className="adm-tecla">/</kbd> enfoca el buscador · <kbd className="adm-tecla">Esc</kbd> cierra ventanas.</p>
    </Modal>
  );
}
