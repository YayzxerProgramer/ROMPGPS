import { useState, useEffect, useRef } from "react";
import "../Styles/PanelVehiculo.css";
import { del, get, post } from "../Service/api";
import MantenimientoVehiculo from "./Mantenimiento/MantenimientoVehiculo";

function TarjetaVehiculo({ vehiculo, onDelete }) {
    return (
        <article className="tarjeta-vehiculo-configuracion" role="row">
            <div className="tarjeta-vehiculo__celda-imagen tarjeta-vehiculo__imagen-envoltorio">
                <div className="avatar-vehiculo-placeholder">
                    <span className="material-symbols-outlined" style={{ fontSize: "2rem" }}>
                        {vehiculo.tipo === "MOTO" ? "motorcycle" : "directions_car"}
                    </span>
                </div>
            </div>
            <div className="tarjeta-vehiculo__celda-modelo">
                <h3 className="tarjeta-vehiculo__nombre">{vehiculo.modelo}</h3>
                <p className="tarjeta-vehiculo__serie">IMEI: {vehiculo.imei || "Sin GPS asignado"}</p>
                <MantenimientoVehiculo idVehiculo={vehiculo.id} etiqueta={`${vehiculo.modelo} · ${vehiculo.placa}`} />
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
                <button className="tarjeta-vehiculo__boton-accion" type="button" aria-label="Eliminar vehículo" onClick={() => onDelete(vehiculo.id)}>
                    <span className="material-symbols-outlined">delete</span>
                </button>
            </div>
        </article>
    );
}

const PLACA_VALIDA = /^[A-Z0-9-]{5,6}$/;

function ModalRegistro({ visible, onCerrar, onRegistrado, usuarioId }) {
    const [formulario, setFormulario] = useState({
        modelo: "",
        placa: "",
        tipo: "MOTO",
    });
    const [errores, setErrores] = useState({});
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

    // Limpiar al abrir.
    useEffect(() => {
        if (!visible) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormulario({ modelo: "", placa: "", tipo: "MOTO" });
        setErrores({});
        setError("");
    }, [visible]);

    const manejarCambio = (e) => {
        const { name, value } = e.target;
        setFormulario((prev) => ({ ...prev, [name]: name === "placa" ? value.toUpperCase() : value }));
        setErrores((prev) => ({ ...prev, [name]: undefined }));
    };

    const validar = () => {
        const encontrados = {};
        if (!formulario.modelo.trim()) encontrados.modelo = "El modelo es obligatorio.";
        const placa = formulario.placa.trim();
        if (!placa) encontrados.placa = "La placa es obligatoria.";
        else if (!PLACA_VALIDA.test(placa)) encontrados.placa = "La placa debe tener 5 o 6 letras, números o guion.";
        return encontrados;
    };

    const manejarConfirmar = async (e) => {
        e.preventDefault();
        setError("");

        const encontrados = validar();
        setErrores(encontrados);
        if (Object.keys(encontrados).length) return;

        if (!usuarioId) {
            setError("No pudimos cargar tu cuenta. Recarga la página e inténtalo de nuevo.");
            return;
        }

        setCargando(true);
        try {
            await post("/vehiculo", {
                modelo: formulario.modelo.trim(),
                placa: formulario.placa.trim(),
                tipo: formulario.tipo,
                id_usuario: usuarioId,
                activo: true,
            });
            onRegistrado();
            onCerrar();
        } catch (err) {
            if (err.campos) setErrores(err.campos);
            setError(
                err.campos ? "Revisa los campos marcados."
                    : err instanceof TypeError ? "No pudimos conectar con el servidor. Revisa tu conexión."
                        : err.message || "No se pudo registrar el vehículo."
            );
        } finally {
            setCargando(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="modal-fondo modal-fondo--visible" role="dialog" aria-modal="true"
            aria-labelledby="modal-registro-titulo"
            onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="modal-contenido">
                <div className="modal-cabecera">
                    <div>
                        <h2 className="modal-titulo" id="modal-registro-titulo">Registrar vehículo</h2>
                        <p className="modal-subtitulo">Agrega una unidad a tu cuenta.</p>
                    </div>
                    <button className="modal-boton-cerrar" type="button" onClick={onCerrar} aria-label="Cerrar">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form className="formulario" onSubmit={manejarConfirmar} noValidate>
                    <div className="formulario__grupo">
                        <label className="formulario__etiqueta" htmlFor="campo-modelo">Modelo</label>
                        <input
                            className="formulario__campo"
                            id="campo-modelo"
                            name="modelo"
                            type="text"
                            placeholder="Ej: Yamaha MT-03"
                            autoComplete="off"
                            maxLength={60}
                            value={formulario.modelo}
                            onChange={manejarCambio}
                            aria-invalid={Boolean(errores.modelo)}
                            aria-describedby={errores.modelo ? "error-modelo" : undefined}
                            autoFocus
                        />
                        {errores.modelo && <p className="formulario__error-campo" id="error-modelo">{errores.modelo}</p>}
                    </div>

                    <div className="formulario__grupo">
                        <label className="formulario__etiqueta" htmlFor="campo-placa">Placa</label>
                        <input
                            className="formulario__campo formulario__campo--placa"
                            id="campo-placa"
                            name="placa"
                            type="text"
                            placeholder="ABC123"
                            autoComplete="off"
                            autoCapitalize="characters"
                            maxLength={6}
                            value={formulario.placa}
                            onChange={manejarCambio}
                            aria-invalid={Boolean(errores.placa)}
                            aria-describedby={errores.placa ? "error-placa" : undefined}
                        />
                        {errores.placa && <p className="formulario__error-campo" id="error-placa">{errores.placa}</p>}
                    </div>

                    <div className="formulario__grupo">
                        <label className="formulario__etiqueta" htmlFor="campo-tipo">Tipo de vehículo</label>
                        <select
                            className="formulario__campo formulario__select"
                            id="campo-tipo"
                            name="tipo"
                            value={formulario.tipo}
                            onChange={manejarCambio}
                        >
                            <option value="MOTO">Moto</option>
                            <option value="CARRO">Carro</option>
                        </select>
                    </div>

                    <div className="formulario__aviso">
                        <span className="material-symbols-outlined" aria-hidden="true">info</span>
                        <span>
                            El <strong>equipo GPS</strong> lo asigna un administrador. Mientras tanto, tu vehículo
                            aparecerá como «GPS pendiente».
                        </span>
                    </div>

                    {error && (
                        <p className="formulario__error" role="alert">
                            <span className="material-symbols-outlined" aria-hidden="true">error</span>
                            {error}
                        </p>
                    )}

                    <div className="formulario__pie">
                        <button className="formulario__boton-confirmar" type="submit" disabled={cargando}>
                            {cargando ? "Registrando…" : "Registrar vehículo"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function PanelVehiculo() {
    const [vehiculos, setVehiculos] = useState([]);
    const [usuarioId, setUsuarioId] = useState(null);
    const [cargando, setCargando] = useState(true);
    const usuario = localStorage.getItem("usuario");
    const [modalVisible, setModalVisible] = useState(false);
    const orbePrimarioRef = useRef(null);
    const orbeSecundarioRef = useRef(null);

    const cargarVehiculos = (id) =>
        get(`/usuario/vehiculos/${id}`)
            .then((data) => setVehiculos(data || []))
            .catch((error) => console.error("Error cargando vehículos:", error))
            .finally(() => setCargando(false));

    const eliminarVehiculo = async (id) => {
        try {
            await del(`/vehiculo/${id}`);
            cargarVehiculos(usuarioId);

        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (!usuario) return;

        get(`/usuario/usuario/${usuario}`)
            .then((data) => {
                setUsuarioId(data.id);
                return cargarVehiculos(data.id);
            })
            .catch((error) => {
                console.error("Error obteniendo usuario:", error);
                setCargando(false);
            });
    },);

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
                            Registra y supervisa los vehículos de tu flota.
                            Consulta el estado de cada uno en tiempo real.
                        </p>
                    </div>
                    <div className="encabezado-dashboard__acciones">
                        <button className="encabezado-dashboard__boton-registrar" type="button"
                            onClick={() => setModalVisible(true)} aria-haspopup="dialog">
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
                                <TarjetaVehiculo key={v.id} vehiculo={v} onDelete={eliminarVehiculo} />
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
