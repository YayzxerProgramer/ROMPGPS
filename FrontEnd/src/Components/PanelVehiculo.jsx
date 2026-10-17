import { useState, useEffect, useRef } from "react";
import "../Styles/PanelVehiculo.css";
import { API_URL } from "../Service/api";
import VistaVehiculo3D, { MiniaturaVehiculo, SugerenciasModelo3D } from "./three/VistaVehiculo3D";
import { resolverModeloVehiculo } from "../config/vehicleModels";


function TarjetaVehiculo({ vehiculo, onDelete, abierto3D, onAlternar3D }) {
    const con3D = Boolean(resolverModeloVehiculo(vehiculo.modelo));
    const idPanel = `vista3d-${vehiculo.id}`;
    return (
        <>
        <article className="tarjeta-vehiculo-configuracion" role="row">
            {/* Miniatura estática (póster del modelo o silueta): ningún canvas por fila */}
            <div className="tarjeta-vehiculo__celda-imagen tarjeta-vehiculo__imagen-envoltorio">
                <MiniaturaVehiculo modelo={vehiculo.modelo} tipo={vehiculo.tipo} />
            </div>
            <div className="tarjeta-vehiculo__celda-modelo">
                <h3 className="tarjeta-vehiculo__nombre">{vehiculo.modelo}</h3>
                <p className="tarjeta-vehiculo__serie">IMEI: {vehiculo.imei}</p>
            </div>
            <div className="tarjeta-vehiculo__celda-tipo">
                <span className="tarjeta-vehiculo__tipo-etiqueta">
                    <span className="material-symbols-outlined" aria-hidden="true">
                        {vehiculo.tipo === "MOTO" ? "motorcycle" : "directions_car"}
                    </span>
                    {vehiculo.tipo}
                </span>
            </div>
            <div className="tarjeta-vehiculo__celda-placa">
                <span className="tarjeta-vehiculo__placa">{vehiculo.placa}</span>
            </div>
            <div className="tarjeta-vehiculo__celda-estado">
                <div className="tarjeta-vehiculo__estado">
                    <span className={`tarjeta-vehiculo__indicador tarjeta-vehiculo__indicador--${vehiculo.activo ? "activo" : "offline"}`} aria-hidden="true" />
                    <span className={`tarjeta-vehiculo__texto-estado tarjeta-vehiculo__texto-estado--${vehiculo.activo ? "activo" : "offline"}`}>
                        {vehiculo.activo ? "Activo" : "Inactivo"}
                    </span>
                </div>
            </div>
            <div className="tarjeta-vehiculo__celda-acciones tarjeta-vehiculo__acciones">
                {con3D && (
                    <button
                        className={`tarjeta-vehiculo__boton-accion ${abierto3D ? "tarjeta-vehiculo__boton-accion--activo" : ""}`}
                        type="button"
                        aria-label={abierto3D ? "Ocultar vista 3D" : "Ver en 3D"}
                        title={abierto3D ? "Ocultar vista 3D" : "Ver en 3D"}
                        aria-expanded={abierto3D}
                        aria-controls={idPanel}
                        onClick={() => onAlternar3D(vehiculo.id)}
                    >
                        <span className="material-symbols-outlined">view_in_ar</span>
                    </button>
                )}
                <button className="tarjeta-vehiculo__boton-accion" type="button" aria-label="Eliminar vehículo" onClick={() => onDelete(vehiculo.id)}>
                    <span className="material-symbols-outlined">delete</span>
                </button>
            </div>
        </article>
        {con3D && abierto3D && (
            <div className="tarjeta-vehiculo__panel-3d" id={idPanel}>
                <VistaVehiculo3D modelo={vehiculo.modelo} tipo={vehiculo.tipo} />
            </div>
        )}
        </>
    );
}

function ModalRegistro({ visible, onCerrar, onRegistrado, usuarioId, token }) {
    const [formulario, setFormulario] = useState({
        modelo: "",
        placa: "",
        tipo: "MOTO",
        imei: "",
    });
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        const manejarTeclado = (e) => { if (e.key === "Escape" && visible) onCerrar(); };
        document.addEventListener("keydown", manejarTeclado);
        return () => document.removeEventListener("keydown", manejarTeclado);
    }, [visible, onCerrar]);

    useEffect(() => {
        document.body.style.overflow = visible ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [visible]);

    // Limpiar al abrir. Es sincronización deliberada con una prop: al abrir el
    // modal el formulario debe quedar vacío, no conservar lo del intento anterior.
    useEffect(() => {
        if (!visible) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormulario({ modelo: "", placa: "", tipo: "MOTO", imei: "" });
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError("");
    }, [visible]);

    const manejarCambio = (e) =>
        setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    // Los atajos rellenan el nombre completo y, como son motos, el tipo.
    const elegirModelo3D = (modelo) =>
        setFormulario((prev) => ({ ...prev, modelo: modelo.nombre, tipo: modelo.tipo }));

    const manejarConfirmar = async () => {
        setError("");

        if (!formulario.modelo.trim()) return setError("El modelo es obligatorio.");
        if (!formulario.placa.trim()) return setError("La placa es obligatoria.");


        setCargando(true);
        try {
            const payload = {
                modelo: formulario.modelo.trim(),
                placa: formulario.placa.trim().toUpperCase(),
                tipo: formulario.tipo,
                imei: formulario.imei.trim() || null,
                id_usuario: usuarioId,
                activo: true,
            };

            const res = await fetch(`${API_URL}/vehiculo`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Error al registrar el vehículo.");
                return;
            }

            onRegistrado();
            onCerrar();
        } catch (e) {
            setError("Error de conexión con el servidor.");
        } finally {
            setCargando(false);
        }
    };

    if (!visible) return null;



    return (
        <div className="modal-fondo modal-fondo--visible" role="dialog" aria-modal="true"
            aria-labelledby="modal-titulo-heading"
            onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="modal-contenido">
                <div className="modal-cabecera">
                    <div>
                        <h2 className="modal-titulo" id="modal-titulo-heading">Nuevo Vehículo</h2>
                        <p className="modal-subtitulo">Registra una nueva unidad en tu flota.</p>
                    </div>
                    <button className="modal-boton-cerrar" type="button" onClick={onCerrar} aria-label="Cerrar modal">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="formulario">

                    {/* Vista previa 3D en vivo según el modelo escrito */}
                    <VistaVehiculo3D modelo={formulario.modelo} tipo={formulario.tipo} />

                    {/* Modelo */}
                    <div className="formulario__grupo">
                        <label className="formulario__etiqueta" htmlFor="campo-modelo">
                            Modelo del Vehículo
                        </label>
                        <input
                            className="formulario__campo"
                            id="campo-modelo"
                            name="modelo"
                            type="text"
                            placeholder="Ej: Bajaj Boxer CT 100 o Toyota Hilux 2022"
                            autoComplete="off"
                            maxLength={60}
                            value={formulario.modelo}
                            onChange={manejarCambio}
                        />
                        <SugerenciasModelo3D valor={formulario.modelo} onElegir={elegirModelo3D} />
                    </div>

                    {/* Placa e IMEI */}
                    <div className="formulario__fila">
                        <div className="formulario__grupo">
                            <label className="formulario__etiqueta" htmlFor="campo-placa">
                                Placa
                            </label>
                            <input
                                className="formulario__campo"
                                id="campo-placa"
                                name="placa"
                                type="text"
                                placeholder="ABC123"
                                autoComplete="off"
                                value={formulario.placa}
                                onChange={manejarCambio}
                            />
                        </div>

                        <div className="formulario__grupo">
                            <label className="formulario__etiqueta" htmlFor="campo-imei">
                                IMEI del GPS (Opcional)
                            </label>
                            <input
                                className="formulario__campo"
                                id="campo-imei"
                                name="imei"
                                type="text"
                                placeholder="Ej: 123456789012345"
                                autoComplete="off"
                                value={formulario.imei}
                                onChange={manejarCambio}
                            />
                        </div>
                    </div>

                    {/* Tipo */}
                    <div className="formulario__grupo">
                        <label className="formulario__etiqueta" htmlFor="campo-tipo">
                            Tipo de Vehículo
                        </label>
                        <select
                            className="formulario__campo formulario__select"
                            id="campo-tipo"
                            name="tipo"
                            value={formulario.tipo}
                            onChange={manejarCambio}
                        >
                            <option value="CARRO">🚗 Carro</option>
                            <option value="MOTO">🏍️ Moto</option>
                        </select>
                    </div>

                    {/* Error */}
                    {error && (
                        <p style={{ color: "#f87171", fontSize: "0.85rem", margin: "0" }}>
                            ⚠️ {error}
                        </p>
                    )}

                    <div className="formulario__pie">
                        <button
                            className="formulario__boton-confirmar"
                            type="button"
                            onClick={manejarConfirmar}
                            disabled={cargando}
                        >
                            {cargando ? "Registrando..." : "Confirmar Registro"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PanelVehiculo() {
    const [vehiculos, setVehiculos] = useState([]);
    const [usuarioId, setUsuarioId] = useState(null);
    const [cargando, setCargando] = useState(true);
    const usuario = localStorage.getItem("usuario");
    const token = localStorage.getItem("token");
    const [modalVisible, setModalVisible] = useState(false);
    const [vehiculoEditando, setVehiculoEditando] = useState(null);
    // Un solo visor 3D abierto en la lista: un único canvas por vista.
    const [abierto3D, setAbierto3D] = useState(null);
    const orbePrimarioRef = useRef(null);
    const orbeSecundarioRef = useRef(null);

    const cargarVehiculos = (id) => {
        fetch(`${API_URL}/usuario/vehiculos/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setVehiculos(data);
                setCargando(false);
            })
            .catch((error) => {
                console.error("Error cargando vehículos:", error);
                setCargando(false);
            });
    };


    const eliminarVehiculo = async (id) => {
        try {
            const res = await fetch(`${API_URL}/vehiculo/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) throw new Error("Error eliminando");
            cargarVehiculos(usuarioId);

        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (!usuario || !token) return;

        fetch(`${API_URL}/usuario/usuario/${usuario}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setUsuarioId(data.id);
                cargarVehiculos(data.id);
            })
            .catch((error) => {
                console.error("Error obteniendo usuario:", error);
                setCargando(false);
            });
    }, []);

    useEffect(() => {
        const manejarMouse = (e) => {
            const x = e.clientX / window.innerWidth;
            const y = e.clientY / window.innerHeight;
            if (orbePrimarioRef.current)
                orbePrimarioRef.current.style.transform = `translate(${x * 15}px, ${y * 15}px)`;
            if (orbeSecundarioRef.current)
                orbeSecundarioRef.current.style.transform = `translate(${x * 30}px, ${y * 30}px)`;
        };
        document.addEventListener("mousemove", manejarMouse);
        return () => document.removeEventListener("mousemove", manejarMouse);
    }, []);

    return (
        <main className="contenido-principal">
            <div className="contenido-principal__envoltorio">
                <section className="encabezado-dashboard" aria-labelledby="titulo-dashboard">
                    <div className="encabezado-dashboard__info">
                        <span className="encabezado-dashboard__etiqueta">Panel de telemetría</span>
                        <h1 className="encabezado-dashboard__titulo" id="titulo-dashboard">
                            Gestión de <span className="encabezado-dashboard__titulo--acento">Unidades</span>
                        </h1>
                        <p className="encabezado-dashboard__descripcion">
                            Supervise y registre dispositivos GPS de alta precisión en su flota.
                            Visualice el estado en tiempo real de cada activo configurado.
                        </p>
                    </div>
                    <div className="encabezado-dashboard__acciones">
                        <button className="encabezado-dashboard__boton-registrar" type="button"
                            onClick={() => { setAbierto3D(null); setModalVisible(true); }} aria-haspopup="dialog">
                            <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>
                            Registrar Nuevo Vehículo
                        </button>
                        <div className="encabezado-dashboard__insignias">
                            <span className="insignia insignia--activo">
                                Activos: {vehiculos.filter(v => v.activo).length}
                            </span>
                            <span className="insignia insignia--mantenimiento">
                                Inactivos: {vehiculos.filter(v => !v.activo).length}
                            </span>
                        </div>
                    </div>
                </section>

                <section aria-label="Lista de vehículos registrados">
                    <div className="lista-vehiculos-configuracion">
                        <div className="lista-vehiculos__cabecera" role="row" aria-hidden="true">
                            <div className="lista-vehiculos__col-imagen">Tipo</div>
                            <div className="lista-vehiculos__col-modelo">Modelo / IMEI</div>
                            <div className="lista-vehiculos__col-tipo">Categoría</div>
                            <div className="lista-vehiculos__col-placa">Placa</div>
                            <div className="lista-vehiculos__col-estado">Estado</div>
                            <div className="lista-vehiculos__col-acciones">Acciones</div>
                        </div>

                        {cargando ? (
                            <p style={{ padding: "1rem", color: "var(--color-texto-secundario)" }}>
                                Cargando vehículos...
                            </p>
                        ) : vehiculos.length === 0 ? (
                            <div className="lista-vehiculos__vacio">
                                <span className="material-symbols-outlined" aria-hidden="true">directions_car</span>
                                <p>Aún no tienes vehículos registrados.</p>
                                <small>Usa «Registrar Nuevo Vehículo» para añadir el primero.</small>
                            </div>
                        ) : (
                            vehiculos.map((v) => (
                                <TarjetaVehiculo
                                    key={v.id}
                                    vehiculo={v}
                                    onDelete={eliminarVehiculo}
                                    abierto3D={abierto3D === v.id}
                                    onAlternar3D={(id) => setAbierto3D((actual) => (actual === id ? null : id))}
                                />
                            ))
                        )}
                    </div>
                </section>
            </div>

            <ModalRegistro
                visible={modalVisible}
                onCerrar={() => setModalVisible(false)}
                onRegistrado={() => cargarVehiculos(usuarioId)}
                usuarioId={usuarioId}
                token={token}
            />

            <div className="telemetria-decorativa" aria-hidden="true">
                <span className="telemetria-decorativa__estado">Sistema: Listo</span>
                <div className="telemetria-decorativa__coordenadas">
                    <div className="telemetria-decorativa__punto" />
                    <span className="telemetria-decorativa__texto">10.4236° N, 75.5478° O</span>
                </div>
            </div>
        </main>
    );
}