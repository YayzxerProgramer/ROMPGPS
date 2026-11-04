import { useState, useEffect, useRef } from "react";
import "../Styles/Registro.css";
import { useNavigate, Link } from "react-router-dom";
import LogoRomp from "./LogoRomp";
import { useGoogleLogin } from "@react-oauth/google";
import { guardarSesion, rutaInicial } from "../Service/sesion";
import { API_URL } from "../Service/api";
import { iniciarLoginGithub } from "../Service/GithubService";
import { TypeAnimation } from "react-type-animation";

/* La regla de movimiento reducido de Base.css solo detiene animaciones CSS.
Esta es JavaScript, así que se comprueba aquí: con "reducir movimiento"
   activado en el sistema, el titular se queda fijo. */
const MOVIMIENTO_REDUCIDO =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function FondoAtmosferico() {
    const brilloRef1 = useRef(null);
    const brilloRef2 = useRef(null);

    useEffect(() => {
        const moverBrillo = (e) => {
            const x = e.clientX / window.innerWidth;
            const y = e.clientY / window.innerHeight;
            if (brilloRef1.current)
                brilloRef1.current.style.transform = `translate(${x * 25}px, ${y * 25}px)`;
            if (brilloRef2.current)
                brilloRef2.current.style.transform = `translate(${x * -20}px, ${y * -20}px)`;
        };
        window.addEventListener("mousemove", moverBrillo);
        return () => window.removeEventListener("mousemove", moverBrillo);
    }, []);

    return (    
        <div className="fondo-atmosferico" aria-hidden="true">
            <div className="brillo-superior-izquierdo" ref={brilloRef1} />
            <div className="brillo-inferior-derecho" ref={brilloRef2} />
        </div>
    );
}

function Caracteristica({ icono, titulo, descripcion, retraso }) {
    return (
        <div className="caracteristica" style={{ animationDelay: `${retraso}s` }}>
            <div className="icono-caracteristica">
                <span className="material-symbols-outlined">{icono}</span>
            </div>
            <div className="texto-caracteristica">
                <p className="titulo-caracteristica">{titulo}</p>
                <p className="descripcion-caracteristica">{descripcion}</p>
            </div>
        </div>
    );
}

function ColumnaEditorial() {
    return (
        <section className="columna-editorial">
            <div className="logotipo">
                <LogoRomp tamano={36} className="icono-explorar" />
                <span className="nombre-marca">ROMP GPS</span>
            </div>

            <h1 className="titulo-principal">
    La precisión es <br />
    {MOVIMIENTO_REDUCIDO ? (
        <span className="titulo-acento">innegociable.</span>
    ) : (
        <>
            {/* Los lectores de pantalla leen la frase fija una sola vez,
                en lugar de oír el titular cambiando cada pocos segundos */}
            <span className="solo-lectores">innegociable.</span>
            <TypeAnimation
                sequence={[
                    "innegociable.", 2000,
                    "tu ventaja.", 2000,
                    "tu seguridad.", 2000,
                    "constante.", 2000,
                ]}
                wrapper="span"
                /* Mismos tiempos que el login */
                speed={50}
                deletionSpeed={60}
                repeat={Infinity}
                className="titulo-acento"
                aria-hidden="true"
            />
        </>
    )}
</h1>

            <p className="descripcion-editorial">
                Únete a una red de monitores de flota profesionales y navegadores
                tácticos. Accede a datos de rastreo de alta fidelidad con precisión
                submétrica y telemetría en tiempo real.
            </p>

            <div className="lista-caracteristicas">
                <Caracteristica
                    icono="satellite_alt"
                    titulo="Integración Satelital"
                    descripcion="Soporte multiconstelación para cobertura global."
                    retraso={0.9}
                />
                <Caracteristica
                    icono="security"
                    titulo="Rutas Encriptadas"
                    descripcion="Protección de telemetría extremo a extremo para tus activos."
                    retraso={1.1}
                />
            </div>
        </section>
    );
}

function CampoTexto({ id, etiqueta, tipo = "text", placeholder, prefijo, valor, onchange }) {
    return (
        <div className="grupo-campo">
            <label className="etiqueta-campo" htmlFor={id}>
                {etiqueta}
            </label>
            <div className="envoltorio-icono">
                {prefijo && <span className="prefijo-arroba">{prefijo}</span>}
                <input
                    className={`campo-entrada${prefijo ? " campo-con-prefijo" : ""}`}
                    id={id}
                    type={tipo}
                    placeholder={placeholder}
                    autoComplete="off"
                    value={valor}
                    onChange={onchange}
                />
            </div>
        </div>
    );
}

function CheckboxTerminos({ checked, onChange }) {
    return (
        <label className="reg-terminos">
            <div
                className={`reg-checkbox ${checked ? "reg-checkbox--checked" : ""}`}
                onClick={onChange}
            >
                {checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </div>
            <span>
                Acepto los{" "}
                <Link to="/terminos" target="_blank" rel="noopener noreferrer">términos de servicio</Link>
                {" "}y la{" "}
                <Link to="/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</Link>
                {" "}de ROMP GPS.
            </span>
        </label>
    );
}

function CampoContrasena({ contrasena, onchange }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="grupo-campo grupo-ancho-completo">
            <label className="etiqueta-campo" htmlFor="contrasena">
                Clave de Seguridad (Contraseña)
            </label>
            <div className="envoltorio-icono">
                <input
                    className="campo-entrada"
                    id="contrasena"
                    type={visible ? "text" : "password"}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    value={contrasena}
                    onChange={onchange}
                />
                <button
                    className="boton-visibilidad"
                    type="button"
                    aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setVisible((v) => !v)}
                >
                    <span className="material-symbols-outlined">
                        {visible ? "visibility_off" : "visibility"}
                    </span>
                </button>
            </div>
        </div>
    );
}

function BotonSocialGoogle({ onClick, cargando }) {
    return (
        <button className="boton-social" type="button" onClick={onClick} disabled={cargando}>
            <svg className="icono-social" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="texto-boton-social">{cargando ? "…" : "Google"}</span>
        </button>
    );
}

function BotonSocialGithub() {
    // Antes era un <button> sin onClick: el registro con GitHub no hacía nada,
    // aunque en Login.jsx el mismo flujo sí estaba cableado.
    return (
        <button className="boton-social" type="button" onClick={iniciarLoginGithub}>
            <svg className="icono-social" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.137 20.161 22 16.415 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span className="texto-boton-social">GitHub</span>
        </button>
    );
}

function FormularioRegistro() {
    const [enviado, setEnviado] = useState(false);
    const navigate = useNavigate();

    const [nombre, setNombre] = useState("");
    const [apellido, setApellido] = useState("");
    const [usuario, setUsuario] = useState("");
    const [correo, setCorreo] = useState("");
    const [telefono, setTelefono] = useState("");
    const [contrasena, setContrasena] = useState("");
    const [terminos, setTerminos] = useState(false);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);
    const [cargandoGoogle, setCargandoGoogle] = useState(false);

    function validar() {
    if (!nombre || !apellido || !telefono || !usuario || !correo || !contrasena) {
        setError("Complete todos los campos.");
        return false;
    }

    if (!terminos) {
        setError("Debes aceptar los términos de servicio y la política de privacidad.");
        return false;
    }

    return true;
}

    const manejarEnvio = async (e) => {
        e.preventDefault();
        setError("");
        if (!validar()) return;

        setCargando(true);
        const payload = { nombre, apellido, usuario, correo, telefono, contrasena, rol: "USUARIO", activo: true };

        try {
            const res = await fetch(`${API_URL}/usuario`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Error al crear cuenta");
            }

            setEnviado(true);
            setTimeout(() => navigate("/login"), 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };


    const loginConGoogle = useGoogleLogin({
        onSuccess: async (respuestaGoogle) => {
            setCargandoGoogle(true);
            setError("");
            try {
                const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                    headers: { Authorization: `Bearer ${respuestaGoogle.access_token}` },
                });

                if (!infoRes.ok) throw new Error("No se pudo obtener información de Google");

                const infoGoogle = await infoRes.json();

                const backendRes = await fetch(`${API_URL}/usuario/google`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tokenGoogle: respuestaGoogle.access_token,
                        correo: infoGoogle.email,
                        usuario: infoGoogle.name,
                        nombre: infoGoogle.given_name,
                        apellido: infoGoogle.family_name,
                        imagenUrl: infoGoogle.picture,
                        sub: infoGoogle.sub,
                    }),
                });

                if (!backendRes.ok) {
                    const data = await backendRes.json();
                    throw new Error(data.error || "Error al autenticar con Google");
                }

                const data = await backendRes.json();
                guardarSesion(data);
                navigate(rutaInicial());

            } catch (err) {
                setError(err.message);
            } finally {
                setCargandoGoogle(false);
            }
        },
        onError: () => setError("Error al conectar con Google. Intente nuevamente."),
    });

    return (
        <section className="columna-formulario">
            <div className="panel-vidrio">
                <div className="encabezado-formulario">
                    <h2 className="titulo-formulario">Crear Cuenta</h2>
                    <p className="subtitulo-formulario">
                    </p>
                </div>

                <form className="formulario-registro" onSubmit={manejarEnvio}>
                    <CampoTexto id="nombre" etiqueta="Nombre" placeholder="Juan"
                        valor={nombre} onchange={(e) => setNombre(e.target.value)} />
                    <CampoTexto id="apellido" etiqueta="Apellido" placeholder="Pérez"
                        valor={apellido} onchange={(e) => setApellido(e.target.value)} />

                    <div className="grupo-ancho-completo">
                        <CampoTexto id="telefono" etiqueta="Teléfono" placeholder="+57 300 000 0000"
                            valor={telefono} onchange={(e) => setTelefono(e.target.value)} />
                    </div>
                    <div className="grupo-ancho-completo">
                        <CampoTexto id="correo" etiqueta="Correo Electrónico" tipo="email"
                            placeholder="juan.perez@empresa.com"
                            valor={correo} onchange={(e) => setCorreo(e.target.value)} />
                    </div>
                    <div className="grupo-ancho-completo">
                        <CampoTexto id="usuario" etiqueta="Usuario" placeholder="navegador_01"
                            prefijo="@" valor={usuario} onchange={(e) => setUsuario(e.target.value)} />
                    </div>

                    <CampoContrasena contrasena={contrasena} onchange={(e) => setContrasena(e.target.value)} />

                    {error && <p className="mensaje-error grupo-ancho-completo">{error}</p>}

                    <CheckboxTerminos checked={terminos} onChange={() => setTerminos(!terminos)} />

                    <div className="grupo-campo grupo-ancho-completo grupo-boton">
                        <button
                            className={`boton-principal${enviado ? " boton-exito" : ""}`}
                            type="submit"
                            disabled={cargando || !terminos}
                        >
                            {cargando ? "Procesando..." : enviado ? "✓ Despliegue Iniciado" : "Registrar"}
                        </button>
                    </div>
                </form>

                <div className="divisor">
                    <div className="linea-divisor" />
                    <span className="texto-divisor">O continúa con</span>
                    <div className="linea-divisor" />
                </div>

                <div className="botones-sociales">
                    <BotonSocialGoogle onClick={loginConGoogle} cargando={cargandoGoogle} />
                    <BotonSocialGithub />
                </div>

                <div className="pie-formulario">
                    <p className="texto-pie">
                        ¿Ya tienes acceso?{" "}
                        <a className="enlace-inicio-sesion" href="/login">
                            Volver al inicio de sesión
                        </a>
                    </p>
                </div>
            </div>
        </section>
    );
}

function EstadoSistema() {
    const [coords] = useState({ lat: "42.3601° N", lon: "71.0589° O" });

    return (
        <div className="estado-sistema" aria-hidden="true">
            <span className="texto-estado-titulo">Estado del Sistema: Listo</span>
            <div className="indicador-coordenadas">
                <div className="punto-pulsante" />
                <span className="texto-coordenadas">
                    {coords.lat}, {coords.lon}
                </span>
            </div>
        </div>
    );
}

function Registro() {
    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            <div className="pagina-romp">
                <Link to="/" className="enlace-volver-registro">
                    <span aria-hidden="true">←</span> Volver al inicio
                </Link>
                <FondoAtmosferico />
                <main className="contenedor-principal-registro">
                    <ColumnaEditorial />
                    <FormularioRegistro />
                </main>
                <EstadoSistema />
                <div className="texto-lateral-decorativo" aria-hidden="true">
                    <span className="texto-protocolo">
                    </span>
                </div>
            </div>
        </>
    );
}

export default Registro;