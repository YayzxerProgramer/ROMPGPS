import { useState, useEffect } from "react";
import "../Styles/CambiarContrasena.css";
import FondoAurora from "./FondoAurora";
import { useNavigate } from "react-router-dom";
import { API_URL, fetchConSesion } from "../Service/api";

function RadarDecorativo() {
    return (
        <div className="radar-decorativo" aria-hidden="true">
            <svg
                className="radar-decorativo__svg"
                viewBox="0 0 800 800"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle cx="400" cy="400" fill="none" r="350" stroke="currentColor" strokeDasharray="10 10" strokeWidth="0.5" />
                <circle cx="400" cy="400" fill="none" r="250" stroke="currentColor" strokeWidth="0.5" />
                <path d="M50,400 L750,400 M400,50 L400,750" opacity="0.5" stroke="currentColor" strokeWidth="0.5" />
                <g fill="none" stroke="currentColor" strokeWidth="0.2">
                    <circle cx="400" cy="400" r="150" />
                    <circle cx="400" cy="400" r="100" />
                    <circle cx="400" cy="400" r="300" />
                </g>
                <g opacity="0.3" stroke="currentColor" strokeWidth="0.5">
                    <path d="M150,150 L650,650 M150,650 L650,150" />
                </g>
            </svg>
        </div>
    );
}

/* ─────────────────────────────────────────────
   SUBCOMPONENTE: Indicador de Fortaleza
───────────────────────────────────────────── */
function IndicadorFortaleza({ nivel }) {
    const etiquetas = ["", "Débil", "Medio", "Fuerte", "Muy fuerte"];

    return (
        <div className="indicador-fortaleza">
            {[0, 1, 2, 3].map((i) => (
                <div
                    key={i}
                    className={`indicador-fortaleza__barra ${i < nivel
                        ? "indicador-fortaleza__barra--activa"
                        : "indicador-fortaleza__barra--inactiva"
                        }`}
                />
            ))}
            {nivel > 0 && (
                <span className="indicador-fortaleza__etiqueta">{etiquetas[nivel]}</span>
            )}
        </div>
    );
}

function CampoContrasena({
    id,
    etiqueta,
    valor,
    onChange,
    placeholder,
    mostrarFortaleza,
    nivelFortaleza
}) {
    const [enfocado, setEnfocado] = useState(false);
    const [mostrar, setMostrar] = useState(false);

    return (
        <div className="campo-contrasena">
            <label
                className={`campo-contrasena__etiqueta ${enfocado ? "campo-contrasena__etiqueta--activa" : ""}`}
                htmlFor={id}
            >
                {etiqueta}
            </label>

            <div className="campo-contrasena__envoltorio">
                <input
                    className="campo-contrasena__input"
                    id={id}
                    name={id}
                    type={mostrar ? "text" : "password"}
                    placeholder={placeholder}
                    autoComplete="off"
                    value={valor}
                    onChange={onChange}
                    onFocus={() => setEnfocado(true)}
                    onBlur={() => setEnfocado(false)}
                />

                {/* BOTÓN OJO */}
                <button
                    type="button"
                    className="campo-contrasena__toggle"
                    onClick={() => setMostrar(!mostrar)}
                    tabIndex={-1}
                >
                    <span className="material-symbols-outlined">
                        {mostrar ? "visibility_off" : "visibility"}
                    </span>
                </button>
            </div>

            {mostrarFortaleza && valor.length > 0 && (
                <IndicadorFortaleza nivel={nivelFortaleza} />
            )}
        </div>
    );
}


function calcularFortaleza(contrasena) {
    if (!contrasena) return 0;
    let puntos = 0;
    if (contrasena.length >= 8) puntos++;
    if (contrasena.length >= 12) puntos++;
    if (/[A-Z]/.test(contrasena) && /[0-9]/.test(contrasena)) puntos++;
    if (/[^A-Za-z0-9]/.test(contrasena)) puntos++;
    return Math.min(puntos, 4);
}


export default function ConfiguracionSeguridad() {
    const [formulario, setFormulario] = useState({
        claveActual: "",
        nuevaClave: "",
        confirmarClave: "",
    });
    const navigate = useNavigate();
    const [contrasena, setContrasena] = useState("");
    const usuario = localStorage.getItem("usuario");
    const [usuarioData, setUsuarioData] = useState(null);
    const [modalExito, setModalExito] = useState(false);

    useEffect(() => {
        fetchConSesion(`${API_URL}/usuario/usuario/${usuario}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
        })
            .then((res) => res.json())
            .then((data) => setUsuarioData(data))
            .catch((error) => console.error("Error al obtener la contraseña:", error));
    }, []);

    async function actualizarContrasena(claveActual, nuevaClave) {
        try {
            const res = await fetchConSesion(
                `${API_URL}/usuario/contrasena/${usuarioData.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    // El backend exige la contraseña actual para que un cambio de
                    // contraseña no baste con tener un token: antes cualquier
                    // cuenta autenticada podía apoderarse de cualquier otra.
                    body: JSON.stringify({
                        contrasenaActual: claveActual,
                        nuevaContrasena: nuevaClave,
                    }),
                }
            );

            if (!res.ok) {
                const detalle = await res.json().catch(() => null);
                throw new Error(detalle?.error || "Error al actualizar contraseña");
            }

            setModalExito(true);

            setTimeout(() => {
                navigate("/configuracion");
            }, 2000);

        } catch (error) {
            console.error(error);
            alert(error.message || "No se pudo actualizar la contraseña");
        }
    }


    const manejarCambio = (e) =>
        setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const manejarEnvio = (e) => {
        e.preventDefault();

        if (!formulario.claveActual) {
            alert("Debes ingresar tu contraseña actual.");
            return;
        }

        if (formulario.nuevaClave !== formulario.confirmarClave) {
            alert("Las claves no coinciden.");
            return;
        }

        if (formulario.nuevaClave.length < 8) {
            alert("La nueva contraseña debe tener al menos 8 caracteres.");
            return;
        }

        actualizarContrasena(formulario.claveActual, formulario.nuevaClave);
    };

    const manejarCancelar = () => {
        setFormulario({ claveActual: "", nuevaClave: "", confirmarClave: "" });
    };

    const nivelFortaleza = calcularFortaleza(formulario.nuevaClave);

    return (
        <>
            {/* Mismo fondo que /admin y /configuracion */}
            <FondoAurora />

            {/* ── Página principal ── */}
            <main className="pagina-seguridad">
                <div className="pagina-seguridad__envoltorio">
                    <div className="tarjeta-posicionador">

                        {/* Radar de fondo */}
                        <RadarDecorativo />

                        {/* Tarjeta Central */}
                        <div className="tarjeta-seguridad">

                            {/* Decoraciones internas */}
                            <div className="tarjeta-seguridad__icono-decorativo" aria-hidden="true">
                                <span className="material-symbols-outlined">encrypted</span>
                            </div>
                            <div className="tarjeta-seguridad__texto-tecnico" aria-hidden="true">
                                ENCRYPTION_STRENGTH: AES-256<br />
                                SECURE_TUNNEL: ACTIVE<br />
                                AUTH_LATENCY: 12ms
                            </div>

                            {/* Formulario */}
                            <form className="formulario-seguridad" onSubmit={manejarEnvio} noValidate>

                                {/* Encabezado */}
                                <div className="formulario-seguridad__encabezado">
                                    <h2 className="formulario-seguridad__titulo">Cambio de contraseña</h2>
                                    <p className="formulario-seguridad__subtitulo">Acceso autorizado solamente</p>
                                </div>

                                {/* Campos */}
                                <div className="formulario-seguridad__campos">
                                    <CampoContrasena
                                        id="claveActual"
                                        etiqueta="Contraseña actual"
                                        valor={formulario.claveActual}
                                        onChange={manejarCambio}
                                        placeholder="Ingresa tu contraseña actual"
                                        mostrarFortaleza={false}
                                        nivelFortaleza={0}
                                    />
                                    <CampoContrasena
                                        id="nuevaClave"
                                        etiqueta="Nueva contraseña"
                                        valor={formulario.nuevaClave}
                                        onChange={manejarCambio}
                                        placeholder="Ingresa la nueva contraseña"
                                        mostrarFortaleza={true}
                                        nivelFortaleza={nivelFortaleza}
                                    />
                                    <CampoContrasena
                                        id="confirmarClave"
                                        etiqueta="Confirmar contraseña "
                                        valor={formulario.confirmarClave}
                                        onChange={manejarCambio}
                                        placeholder="Repita la nueva contraseña para confirmar"
                                        mostrarFortaleza={false}
                                        nivelFortaleza={0}
                                    />
                                </div>

                                <div className="formulario-seguridad__acciones">
                                    <button className="boton-actualizar" type="submit">
                                        Cambiar contraseña
                                    </button>
                                    <button
                                        className="boton-cancelar"
                                        type="button"
                                        onClick={manejarCancelar}
                                    >
                                        Cancelar
                                    </button>
                                </div>

                            </form>
                        </div>

                    </div>
                </div >
            </main >
            {modalExito && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <span className="material-symbols-outlined modal-icon">
                            check_circle
                        </span>

                        <h3>Contraseña actualizada</h3>
                        <p>Serás redirigido al panel de usuario...</p>
                    </div>
                </div>
            )}
        </>
    );
}
