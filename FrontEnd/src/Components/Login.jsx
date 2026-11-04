import "../Styles/Login.css";
import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { TypeAnimation } from 'react-type-animation';
import { Link } from "react-router-dom";
import EnlacesLegales from "./EnlacesLegales";
import LogoRomp from "./LogoRomp";
import { useGoogleLogin } from "@react-oauth/google";
import { iniciarLoginGithub } from "../Service/GithubService";
import { guardarSesion, rutaInicial } from "../Service/sesion";
import { API_URL } from "../Service/api";

/* ── Iconos ───────────────────────────────────────────────────
   Todos en SVG con `currentColor` y el mismo grosor de trazo.
   Antes se mezclaban emojis (🔑 📱 💬), que se dibujan con la
   fuente del sistema y rompen la paleta, con caracteres sueltos
   como `*` y `•` que no significaban nada.
   ─────────────────────────────────────────────────────────── */

const trazo = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

function IconoUsuario({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path {...trazo} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle {...trazo} cx="12" cy="7" r="4" />
        </svg>
    );
}

function IconoCandado({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <rect {...trazo} x="3" y="11" width="18" height="11" rx="2" />
            <path {...trazo} d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

function IconoTelefono({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <rect {...trazo} x="5" y="2" width="14" height="20" rx="2" />
            <path {...trazo} d="M12 18h.01" />
        </svg>
    );
}

function IconoCorreo({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <rect {...trazo} x="3" y="4" width="18" height="16" rx="2" />
            <path {...trazo} d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    );
}

function IconoMensaje({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path {...trazo} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function IconoAlerta({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <circle {...trazo} cx="12" cy="12" r="10" />
            <path {...trazo} d="M12 8v4M12 16h.01" />
        </svg>
    );
}

function IconoOjo({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path {...trazo} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle {...trazo} cx="12" cy="12" r="3" />
        </svg>
    );
}

function IconoOjoTachado({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path {...trazo} d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
        </svg>
    );
}

function IconoGoogle() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="boton-social__icono" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09" /><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23" /><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93z" /><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53" /></svg>
    );
}

function IconoGitHub() {
    return (
        <svg className="boton-social__icono" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
    );
}

/* ── Columna informativa ──────────────────────────────────── */

function CajaEstadistica({ valor, etiqueta }) {
    return (
        <div className="caja-estadistica">
            <h3>{valor}</h3>
            <span>{etiqueta}</span>
        </div>
    );
}

function InfoSesion() {
    return (
        <div className="info-sesion">
            <span className="info-sesion__etiqueta">Acceso seguro</span>

            <h1>
                Precisión en cada <br />
                <TypeAnimation
                    sequence={['Coordenada', 2000, 'Kilómetro', 2000, 'Ruta', 2000, 'Viaje', 2000]}
                    wrapper="span"
                    /* speed 1 era la MÁS LENTA de la escala 1–99 */
                    speed={50}
                    deletionSpeed={60}
                    className="info-sesion__animado"
                    repeat={Infinity}
                />
            </h1>

            <p className="info-sesion__descripcion">
                Accede a tu centro de mando de ROMP GPS. Gestiona flotas,
                monitorea activos en tiempo real y analiza la telemetría con
                exactitud milimétrica.
            </p>

            <div className="estadisticas-sesion">
                <CajaEstadistica valor="12ms" etiqueta="Latencia" />
                <div className="estadisticas-sesion__divisor" />
                <CajaEstadistica valor="99.9%" etiqueta="Disponibilidad" />
            </div>
        </div>
    );
}

/* ── Campo de entrada ─────────────────────────────────────── */

function CampoEntrada({
    id, tipo, etiqueta, placeholder, Icono, botonAyuda,
    entrada, fun, error, autoComplete, inputMode, maxLength,
    conOjo = false,
}) {
    const [visible, setVisible] = useState(false);

    // Con el ojo activado, el campo de contraseña pasa a texto normal
    const tipoReal = conOjo && visible ? "text" : tipo;

    return (
        <div className="grupo-campo">
            {botonAyuda ? (
                <div className="grupo-campo__fila">
                    <label className="grupo-campo__etiqueta" htmlFor={id}>{etiqueta}</label>
                    <button
                        type="button"
                        className="grupo-campo__boton-ayuda"
                        onClick={botonAyuda.onClick}
                    >
                        {botonAyuda.texto}
                    </button>
                </div>
            ) : (
                <label className="grupo-campo__etiqueta" htmlFor={id}>{etiqueta}</label>
            )}

            <div className="caja-entrada">
                <input
                    id={id}
                    name={id}
                    type={tipoReal}
                    placeholder={placeholder}
                    className={[
                        "caja-entrada__input",
                        conOjo ? "caja-entrada__input--con-ojo" : "",
                        error ? "caja-entrada__input--error" : "",
                    ].join(" ")}
                    value={entrada}
                    onChange={fun}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    maxLength={maxLength}
                    aria-invalid={error || undefined}
                />
                <span className="caja-entrada__icono">
                    <Icono />
                </span>

                {conOjo && (
                    <button
                        type="button"
                        className="caja-entrada__ojo"
                        onClick={() => setVisible((v) => !v)}
                        /* Evita que el campo pierda el foco al pulsar el ojo:
                           así se puede seguir escribiendo sin volver a hacer clic */
                        onMouseDown={(e) => e.preventDefault()}
                        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                        aria-pressed={visible}
                        aria-controls={id}
                    >
                        {visible ? <IconoOjoTachado /> : <IconoOjo />}
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── Chip de Identificador Actual ─────────────────────────── */

function ChipIdentificador({ identificador, onCambiar }) {
    return (
        <div className="tarjeta-identificador-actual">
            <div className="tarjeta-identificador-actual__info">
                <IconoUsuario className="tarjeta-identificador-actual__icono" />
                <span className="tarjeta-identificador-actual__texto">{identificador}</span>
            </div>
            <button
                type="button"
                className="tarjeta-identificador-actual__cambiar"
                onClick={onCambiar}
                aria-label="Cambiar usuario, correo o teléfono"
            >
                Cambiar
            </button>
        </div>
    );
}

/* ── Formulario ───────────────────────────────────────────── */

function FormularioSesion() {
    const navigate = useNavigate();

    // Flujo por pasos: "identificador" -> "password" | "menu_metodos" | "sms_otp" | "email_otp"
    const [pasoLogin, setPasoLogin] = useState("identificador");
    const [identificador, setIdentificador] = useState("");
    const [contrasena, setContrasena] = useState("");

    const [codigoSms, setCodigoSms] = useState("");
    const [destinoSms, setDestinoSms] = useState("");

    const [codigoEmail, setCodigoEmail] = useState("");
    const [destinoEmail, setDestinoEmail] = useState("");

    const [cargandoAuth, setCargandoAuth] = useState(false);
    const [cargandoMetodo, setCargandoMetodo] = useState(false);
    const [cargandoGoogle, setCargandoGoogle] = useState(false);

    // ── Estado 2FA ──
    const [desafio2FA, setDesafio2FA] = useState(null); // { ticket2FA, canal2FA, destino2FA, usuario }
    const [codigo2FA, setCodigo2FA] = useState("");
    const [cargando2FA, setCargando2FA] = useState(false);
    const [cambiandoCanal, setCambiandoCanal] = useState(false);

    const [mensajeError, setMensajeError] = useState("");
    const [campoError, setCampoError] = useState(null);

    const cargando = cargandoAuth || cargandoMetodo || cargandoGoogle;

    function limpiarError() {
        setMensajeError("");
        setCampoError(null);
    }

    /* ───── PASO 1: CONTINUAR CON IDENTIFICADOR ───── */
    function continuarIdentificador(e) {
        if (e) e.preventDefault();
        if (!identificador.trim()) {
            setCampoError("identificador");
            setMensajeError("Ingresa tu usuario, correo o teléfono");
            return;
        }
        limpiarError();
        setPasoLogin("password");
    }

    /* ───── PASO 2: LOGIN CON CONTRASEÑA ───── */
    async function autenticarPassword(e) {
        if (e) e.preventDefault();
        if (!contrasena) {
            setCampoError("contrasena");
            setMensajeError("Ingresa tu contraseña");
            return;
        }

        setCargandoAuth(true);
        limpiarError();

        try {
            const res = await fetch(`${API_URL}/usuario/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario: identificador.trim(), contrasena }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(res.status === 401
                    ? "Usuario o contraseña incorrectos"
                    : (errorData?.error || errorData?.mensaje || "No pudimos iniciar sesión"));
            }

            const data = await res.json();
            if (data.requiere2FA) {
                setDesafio2FA({
                    ticket2FA: data.ticket2FA,
                    canal2FA: data.canal2FA,
                    destino2FA: data.destino2FA,
                    usuario: data.usuario,
                });
                setCodigo2FA("");
                return;
            }
            guardarSesion(data);
            navigate(rutaInicial());
        } catch (err) {
            console.error(err);
            setCampoError("contrasena");
            setMensajeError(
                err instanceof TypeError
                    ? "No pudimos conectar con el servidor. Revisa tu conexión."
                    : err.message
            );
        } finally {
            setCargandoAuth(false);
        }
    }

    /* ───── OTRAS FORMAS: SOLICITAR Y VERIFICAR EMAIL OTP ───── */
    async function solicitarOtpEmail() {
        setCargandoMetodo(true);
        limpiarError();

        try {
            const res = await fetch(`${API_URL}/usuario/email/solicitar-codigo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identificador: identificador.trim() }),
            });

            const data = await res.json();
            if (!res.ok || !data.exito) {
                throw new Error(data.mensaje || data.error || "No se pudo enviar el correo de acceso");
            }
            setDestinoEmail(data.destino || identificador);
            setCodigoEmail("");
            setPasoLogin("email_otp");
        } catch (err) {
            setMensajeError(err.message || "Error al solicitar código por correo");
        } finally {
            setCargandoMetodo(false);
        }
    }

    async function verificarOtpEmail(e) {
        if (e) e.preventDefault();
        if (!codigoEmail.trim() || codigoEmail.trim().length !== 6) {
            setCampoError("codigo_email");
            setMensajeError("Ingresa el código de 6 dígitos enviado a tu correo");
            return;
        }

        setCargandoAuth(true);
        limpiarError();

        try {
            const res = await fetch(`${API_URL}/usuario/email/verificar-codigo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identificador: identificador.trim(), codigo: codigoEmail.trim() }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || data.mensaje || "Código de correo inválido");
            }

            if (data.requiere2FA) {
                setDesafio2FA({
                    ticket2FA: data.ticket2FA,
                    canal2FA: data.canal2FA,
                    destino2FA: data.destino2FA,
                    usuario: data.usuario,
                });
                setCodigo2FA("");
                return;
            }

            guardarSesion(data);
            navigate(rutaInicial());
        } catch (err) {
            setCampoError("codigo_email");
            setMensajeError(err.message || "Código inválido o expirado");
        } finally {
            setCargandoAuth(false);
        }
    }

    /* ───── OTRAS FORMAS: SOLICITAR Y VERIFICAR SMS OTP ───── */
    async function solicitarOtpSms() {
        setCargandoMetodo(true);
        limpiarError();

        try {
            const res = await fetch(`${API_URL}/usuario/sms/solicitar-codigo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identificador: identificador.trim() }),
            });

            const data = await res.json();
            if (!res.ok || !data.exito) {
                throw new Error(data.mensaje || data.error || "No se pudo enviar el SMS con el código");
            }
            setDestinoSms(data.destino || identificador);
            setCodigoSms("");
            setPasoLogin("sms_otp");
        } catch (err) {
            setMensajeError(err.message || "Error al solicitar código por SMS");
        } finally {
            setCargandoMetodo(false);
        }
    }

    async function verificarOtpSms(e) {
        if (e) e.preventDefault();
        if (!codigoSms.trim() || codigoSms.trim().length !== 6) {
            setCampoError("codigo_sms");
            setMensajeError("Ingresa el código de 6 dígitos que recibiste por SMS");
            return;
        }

        setCargandoAuth(true);
        limpiarError();

        try {
            const res = await fetch(`${API_URL}/usuario/sms/verificar-codigo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identificador: identificador.trim(), codigo: codigoSms.trim() }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || data.mensaje || "Código inválido");
            }

            if (data.requiere2FA) {
                setDesafio2FA({
                    ticket2FA: data.ticket2FA,
                    canal2FA: data.canal2FA,
                    destino2FA: data.destino2FA,
                    usuario: data.usuario,
                });
                setCodigo2FA("");
                return;
            }

            guardarSesion(data);
            navigate(rutaInicial());
        } catch (err) {
            setCampoError("codigo_sms");
            setMensajeError(err.message || "Código inválido o expirado");
        } finally {
            setCargandoAuth(false);
        }
    }

    /* ───── DESAFÍO 2FA ───── */
    async function verificar2faLogin() {
        if (!codigo2FA.trim() || codigo2FA.trim().length !== 6) {
            setCampoError("codigo2fa");
            setMensajeError("Ingresa el código de 6 dígitos");
            return;
        }

        setCargando2FA(true);
        limpiarError();

        try {
            const res = await fetch(`${API_URL}/usuario/login/verificar-2fa`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticket2FA: desafio2FA.ticket2FA,
                    codigo: codigo2FA.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || data.mensaje || "Código de verificación incorrecto");
            }

            guardarSesion(data);
            navigate(rutaInicial());
        } catch (err) {
            setCampoError("codigo2fa");
            setMensajeError(err.message || "Error al verificar código 2FA");
        } finally {
            setCargando2FA(false);
        }
    }

    async function cambiarCanal2fa(nuevoCanal) {
        if (!desafio2FA?.ticket2FA || cambiandoCanal) return;
        setCambiandoCanal(true);
        limpiarError();

        try {
            const res = await fetch(`${API_URL}/usuario/login/cambiar-canal-2fa`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticket2FA: desafio2FA.ticket2FA,
                    nuevoCanal: nuevoCanal,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || data.mensaje || "No se pudo cambiar de canal");
            }

            setDesafio2FA({
                ticket2FA: data.ticket2FA,
                canal2FA: data.canal2FA,
                destino2FA: data.destino2FA,
                usuario: data.usuario,
            });
            setCodigo2FA("");
        } catch (err) {
            setMensajeError(err.message || "Error al cambiar de canal");
        } finally {
            setCambiandoCanal(false);
        }
    }

    /* ───── GOOGLE ───── */
    const loginConGoogle = useGoogleLogin({
        onSuccess: async (respuestaGoogle) => {
            setCargandoGoogle(true);
            limpiarError();
            try {
                const infoRes = await fetch(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    { headers: { Authorization: `Bearer ${respuestaGoogle.access_token}` } }
                );
                if (!infoRes.ok) throw new Error("No se pudo obtener información de Google");
                const infoGoogle = await infoRes.json();

                const backendRes = await fetch(`${API_URL}/usuario/google`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tokenGoogle: respuestaGoogle.access_token,
                        correo: infoGoogle.email,
                        nombre: infoGoogle.name,
                        imagenUrl: infoGoogle.picture,
                        sub: infoGoogle.sub,
                    }),
                });

                if (!backendRes.ok) {
                    const data = await backendRes.json();
                    throw new Error(data.error || "Error al autenticar con Google");
                }

                const data = await backendRes.json();
                if (data.requiere2FA) {
                    setDesafio2FA({
                        ticket2FA: data.ticket2FA,
                        canal2FA: data.canal2FA,
                        destino2FA: data.destino2FA,
                        usuario: data.usuario,
                    });
                    setCodigo2FA("");
                    return;
                }
                guardarSesion(data);
                navigate(rutaInicial());
            } catch (err) {
                console.error(err);
                setMensajeError(err.message || "Error al iniciar sesión con Google");
            } finally {
                setCargandoGoogle(false);
            }
        },
        onError: () => setMensajeError("Fallo en la autenticación con Google"),
    });

    if (desafio2FA) {
        return (
            <div className="formulario-sesion-wrapper">
                <div className="bloque-2fa-card">
                    <div className="insignia-2fa">
                        <span className="material-symbols-outlined">security</span>
                        Seguridad 2FA
                    </div>
                    <h2 className="titulo-2fa">Verificación en Dos Pasos</h2>
                    <p className="desc-2fa">
                        Hemos enviado un código de 6 dígitos a <strong>{desafio2FA.destino2FA}</strong> por <strong>{desafio2FA.canal2FA}</strong>.
                    </p>

                    <form onSubmit={(e) => { e.preventDefault(); verificar2faLogin(); }}>
                        <CampoEntrada
                            id="codigo-2fa"
                            tipo="text"
                            etiqueta="Código de 6 dígitos"
                            placeholder="123456"
                            Icono={IconoMensaje}
                            entrada={codigo2FA}
                            fun={(e) => { setCodigo2FA(e.target.value.replace(/\D/g, "")); limpiarError(); }}
                            error={campoError === "codigo2fa"}
                            autoComplete="one-time-code"
                            inputMode="numeric"
                            maxLength={6}
                        />

                        {mensajeError && (
                            <div className="alerta-error" role="alert" style={{ marginTop: '12px' }}>
                                <IconoAlerta className="alerta-error__icono" />
                                <span>{mensajeError}</span>
                            </div>
                        )}

                        <button type="submit" className="boton-sesion" disabled={cargando2FA} style={{ marginTop: '20px' }}>
                            {cargando2FA ? "Verificando..." : "Verificar e Ingresar"}
                            {!cargando2FA && <span className="boton-sesion__flecha">→</span>}
                        </button>
                    </form>

                    <div className="opciones-canal-2fa">
                        <p className="texto-ayuda-canal">¿No recibiste el código? Intentar por:</p>
                        <div className="botones-canales-alternos">
                            {["CORREO", "SMS", "WHATSAPP"].map((canal) => (
                                <button
                                    key={canal}
                                    type="button"
                                    className={`btn-canal-alt ${desafio2FA.canal2FA === canal ? 'activo' : ''}`}
                                    onClick={() => cambiarCanal2fa(canal)}
                                    disabled={cambiandoCanal || desafio2FA.canal2FA === canal}
                                >
                                    {canal === "CORREO" && <span className="material-symbols-outlined icono-btn-canal">mail</span>}
                                    {canal === "SMS" && <span className="material-symbols-outlined icono-btn-canal">sms</span>}
                                    {canal === "WHATSAPP" && <span className="material-symbols-outlined icono-btn-canal">chat</span>}
                                    {canal}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="btn-volver-login"
                        onClick={() => { setDesafio2FA(null); setCodigo2FA(""); limpiarError(); }}
                    >
                        ← Volver a ingresar usuario y contraseña
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="formulario-sesion-wrapper">

            {/* ── PASO 1: IDENTIFICADOR (Usuario, Correo o Teléfono) ── */}
            {pasoLogin === "identificador" && (
                <form className="formulario-sesion" onSubmit={continuarIdentificador} noValidate>
                    <CampoEntrada
                        id="identificador"
                        tipo="text"
                        etiqueta="Usuario, correo o teléfono"
                        placeholder="Tu usuario, correo o teléfono"
                        Icono={IconoUsuario}
                        entrada={identificador}
                        fun={(e) => { setIdentificador(e.target.value); limpiarError(); }}
                        error={campoError === "identificador"}
                        autoComplete="username"
                    />

                    {mensajeError && (
                        <div className="alerta-error" role="alert">
                            <IconoAlerta className="alerta-error__icono" />
                            <span>{mensajeError}</span>
                        </div>
                    )}

                    <button type="submit" className="boton-sesion" disabled={cargando}>
                        Continuar
                        <span className="boton-sesion__flecha">→</span>
                    </button>

                    <SeparadorOAuth />

                    <BotonesSociales
                        loginConGoogle={loginConGoogle}
                        cargandoGoogle={cargandoGoogle}
                        deshabilitado={cargando}
                    />
                </form>
            )}

            {/* ── PASO 2: CONTRASEÑA ── */}
            {pasoLogin === "password" && (
                <form className="formulario-sesion" onSubmit={autenticarPassword} noValidate>
                    <ChipIdentificador
                        identificador={identificador}
                        onCambiar={() => { setPasoLogin("identificador"); limpiarError(); }}
                    />

                    <CampoEntrada
                        id="contrasena"
                        tipo="password"
                        etiqueta="Contraseña"
                        placeholder="••••••••"
                        Icono={IconoCandado}
                        entrada={contrasena}
                        fun={(e) => { setContrasena(e.target.value); limpiarError(); }}
                        error={campoError === "contrasena"}
                        autoComplete="current-password"
                        conOjo
                        botonAyuda={{
                            texto: "¿Olvidaste tu contraseña?",
                            onClick: () => navigate("/recuperar-contrasena"),
                        }}
                    />

                    {mensajeError && (
                        <div className="alerta-error" role="alert">
                            <IconoAlerta className="alerta-error__icono" />
                            <span>{mensajeError}</span>
                        </div>
                    )}

                    <button type="submit" className="boton-sesion" disabled={cargando}>
                        {cargandoAuth
                            ? <span className="boton-sesion__spinner" aria-hidden="true" />
                            : null}
                        {cargandoAuth ? "Iniciando sesión..." : "Iniciar Sesión"}
                        {!cargandoAuth && <span className="boton-sesion__flecha">→</span>}
                    </button>

                    {/* Mensaje de otras formas de iniciar sesión directamente abajo de la contraseña */}
                    <div className="bloque-otras-formas">
                        <button
                            type="button"
                            className="boton-otras-formas"
                            onClick={() => { setPasoLogin("menu_metodos"); limpiarError(); }}
                        >
                            Otras formas de iniciar sesión
                        </button>
                    </div>

                    <SeparadorOAuth />

                    <BotonesSociales
                        loginConGoogle={loginConGoogle}
                        cargandoGoogle={cargandoGoogle}
                        deshabilitado={cargando}
                    />
                </form>
            )}

            {/* ── PASO 3: MENÚ DE OTRAS FORMAS DE INICIAR SESIÓN ── */}
            {pasoLogin === "menu_metodos" && (
                <div className="formulario-sesion">
                    <ChipIdentificador
                        identificador={identificador}
                        onCambiar={() => { setPasoLogin("identificador"); limpiarError(); }}
                    />

                    <div className="encabezado-otras-formas">
                        <h3 className="titulo-otras-formas">Otras formas de iniciar sesión</h3>
                        <p className="desc-otras-formas">
                            Selecciona cómo prefieres identificarte para ingresar a tu cuenta:
                        </p>
                    </div>

                    {mensajeError && (
                        <div className="alerta-error" role="alert">
                            <IconoAlerta className="alerta-error__icono" />
                            <span>{mensajeError}</span>
                        </div>
                    )}

                    <div className="menu-metodos-login">
                        {/* Opción 1: Contraseña */}
                        <button
                            type="button"
                            className="opcion-metodo-card"
                            onClick={() => { setPasoLogin("password"); limpiarError(); }}
                        >
                            <div className="opcion-metodo-card__icono">
                                <IconoCandado className="opcion-metodo-svg" />
                            </div>
                            <div className="opcion-metodo-card__info">
                                <span className="opcion-metodo-card__titulo">Contraseña</span>
                                <span className="opcion-metodo-card__desc">Ingresa usando tu clave personal</span>
                            </div>
                            <span className="opcion-metodo-card__flecha">›</span>
                        </button>

                        {/* Opción 2: Correo */}
                        <button
                            type="button"
                            className="opcion-metodo-card"
                            onClick={solicitarOtpEmail}
                            disabled={cargandoMetodo}
                        >
                            <div className="opcion-metodo-card__icono">
                                <IconoCorreo className="opcion-metodo-svg" />
                            </div>
                            <div className="opcion-metodo-card__info">
                                <span className="opcion-metodo-card__titulo">Correo electrónico</span>
                                <span className="opcion-metodo-card__desc">Recibe un código temporal en tu bandeja de entrada</span>
                            </div>
                            {cargandoMetodo ? (
                                <span className="boton-sesion__spinner" style={{ width: 14, height: 14 }} />
                            ) : (
                                <span className="opcion-metodo-card__flecha">›</span>
                            )}
                        </button>

                        {/* Opción 3: Teléfono */}
                        <button
                            type="button"
                            className="opcion-metodo-card"
                            onClick={solicitarOtpSms}
                            disabled={cargandoMetodo}
                        >
                            <div className="opcion-metodo-card__icono">
                                <IconoTelefono className="opcion-metodo-svg" />
                            </div>
                            <div className="opcion-metodo-card__info">
                                <span className="opcion-metodo-card__titulo">Teléfono (SMS)</span>
                                <span className="opcion-metodo-card__desc">Recibe un código temporal por mensaje de texto</span>
                            </div>
                            {cargandoMetodo ? (
                                <span className="boton-sesion__spinner" style={{ width: 14, height: 14 }} />
                            ) : (
                                <span className="opcion-metodo-card__flecha">›</span>
                            )}
                        </button>
                    </div>

                    <button
                        type="button"
                        className="btn-volver-opciones"
                        onClick={() => { setPasoLogin("password"); limpiarError(); }}
                    >
                        ← Volver a ingresar contraseña
                    </button>
                </div>
            )}

            {/* ── PASO 4: CÓDIGO SMS ── */}
            {pasoLogin === "sms_otp" && (
                <form className="formulario-sesion" onSubmit={verificarOtpSms} noValidate>
                    <div className="encabezado-otras-formas">
                        <div className="insignia-metodo-otp">
                            <IconoTelefono className="insignia-metodo-otp__icono" />
                            Código por SMS
                        </div>
                        <h3 className="titulo-otras-formas">Verificación por Mensaje</h3>
                        <p className="desc-otras-formas">
                            Hemos enviado un código de 6 dígitos al número <strong>{destinoSms || identificador}</strong>.
                        </p>
                    </div>

                    <CampoEntrada
                        id="codigo-sms"
                        tipo="text"
                        etiqueta="Código de 6 dígitos"
                        placeholder="123456"
                        Icono={IconoMensaje}
                        entrada={codigoSms}
                        fun={(e) => { setCodigoSms(e.target.value.replace(/\D/g, "")); limpiarError(); }}
                        error={campoError === "codigo_sms"}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={6}
                    />

                    {mensajeError && (
                        <div className="alerta-error" role="alert">
                            <IconoAlerta className="alerta-error__icono" />
                            <span>{mensajeError}</span>
                        </div>
                    )}

                    <button type="submit" className="boton-sesion" disabled={cargando}>
                        {cargandoAuth
                            ? <span className="boton-sesion__spinner" aria-hidden="true" />
                            : null}
                        {cargandoAuth ? "Verificando..." : "Verificar e Ingresar"}
                        {!cargandoAuth && <span className="boton-sesion__flecha">→</span>}
                    </button>

                    <div className="enlaces-pie-otp">
                        <button
                            type="button"
                            className="btn-reenlace-otp"
                            onClick={solicitarOtpSms}
                            disabled={cargandoMetodo}
                        >
                            {cargandoMetodo ? "Reenviando..." : "¿No recibiste el SMS? Reenviar código"}
                        </button>
                        <button
                            type="button"
                            className="btn-cambiar-metodo-otp"
                            onClick={() => { setPasoLogin("menu_metodos"); limpiarError(); }}
                        >
                            Probar otra forma de iniciar sesión
                        </button>
                    </div>
                </form>
            )}

            {/* ── PASO 5: CÓDIGO EMAIL ── */}
            {pasoLogin === "email_otp" && (
                <form className="formulario-sesion" onSubmit={verificarOtpEmail} noValidate>
                    <div className="encabezado-otras-formas">
                        <div className="insignia-metodo-otp">
                            <IconoCorreo className="insignia-metodo-otp__icono" />
                            Código por Correo
                        </div>
                        <h3 className="titulo-otras-formas">Verificación por Correo</h3>
                        <p className="desc-otras-formas">
                            Hemos enviado un código de 6 dígitos al correo <strong>{destinoEmail || identificador}</strong>.
                        </p>
                    </div>

                    <CampoEntrada
                        id="codigo-email"
                        tipo="text"
                        etiqueta="Código de 6 dígitos"
                        placeholder="123456"
                        Icono={IconoMensaje}
                        entrada={codigoEmail}
                        fun={(e) => { setCodigoEmail(e.target.value.replace(/\D/g, "")); limpiarError(); }}
                        error={campoError === "codigo_email"}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={6}
                    />

                    {mensajeError && (
                        <div className="alerta-error" role="alert">
                            <IconoAlerta className="alerta-error__icono" />
                            <span>{mensajeError}</span>
                        </div>
                    )}

                    <button type="submit" className="boton-sesion" disabled={cargando}>
                        {cargandoAuth
                            ? <span className="boton-sesion__spinner" aria-hidden="true" />
                            : null}
                        {cargandoAuth ? "Verificando..." : "Verificar e Ingresar"}
                        {!cargandoAuth && <span className="boton-sesion__flecha">→</span>}
                    </button>

                    <div className="enlaces-pie-otp">
                        <button
                            type="button"
                            className="btn-reenlace-otp"
                            onClick={solicitarOtpEmail}
                            disabled={cargandoMetodo}
                        >
                            {cargandoMetodo ? "Reenviando..." : "¿No recibiste el correo? Reenviar código"}
                        </button>
                        <button
                            type="button"
                            className="btn-cambiar-metodo-otp"
                            onClick={() => { setPasoLogin("menu_metodos"); limpiarError(); }}
                        >
                            Probar otra forma de iniciar sesión
                        </button>
                    </div>
                </form>
            )}

        </div>
    );
}

function BotonesSociales({ loginConGoogle, cargandoGoogle, deshabilitado }) {
    return (
        <div className="botones-sociales">
            <button
                type="button"
                className="boton-social boton-social--google"
                onClick={() => loginConGoogle()}
                disabled={deshabilitado}
            >
                <IconoGoogle />
                <span>{cargandoGoogle ? "Conectando..." : "Google"}</span>
            </button>

            <button
                type="button"
                className="boton-social boton-social--github"
                onClick={iniciarLoginGithub}
                disabled={deshabilitado}
            >
                <IconoGitHub />
                <span>GitHub</span>
            </button>
        </div>
    );
}

function SeparadorOAuth() {
    return (
        <div className="separador-oauth">
            <span className="separador-oauth__linea" />
            <span className="separador-oauth__texto">O continúa con</span>
            <span className="separador-oauth__linea" />
        </div>
    );
}

function TarjetaSesion() {
    return (
        <div className="tarjeta-sesion">
            {/* Cartagena, igual que el centro por defecto de Mapa.jsx.
                Antes estaban las coordenadas de Nueva York. */}
            <div className="ancla-hud">LAT: 10.4236° N | LON: 75.5478° W</div>

            <div className="encabezado-tarjeta">
                <h2>Área de Clientes</h2>
                <p>Ingresa tus datos para entrar a tu cuenta.</p>
            </div>

            <FormularioSesion />

            <div className="pie-tarjeta">
                <p>
                    ¿Aún no tienes cuenta?{" "}
                    <Link to="/registro">Regístrate aquí</Link>
                </p>
            </div>
        </div>
    );
}

/* Solo "Seguridad de Datos" tiene una página propia; los otros dos son
   informativos y se muestran como texto en vez de enlaces a "#". */
const ENLACES_INFERIORES = [
    { texto: "Soporte 24/7" },
    { texto: "Seguridad de Datos", to: "/privacidad" },
    { texto: "Estado del Sistema" },
];

function EnlacesInferiores() {
    return (
        <div className="enlaces-inferiores">
            {ENLACES_INFERIORES.map(({ texto, to }, i) => (
                <span key={texto} className="enlaces-inferiores__grupo">
                    {to
                        ? <Link to={to} className="enlaces-inferiores__item">{texto}</Link>
                        : <span className="enlaces-inferiores__item">{texto}</span>}
                    {i < ENLACES_INFERIORES.length - 1 && (
                        <span className="enlaces-inferiores__separador">•</span>
                    )}
                </span>
            ))}
        </div>
    );
}

function SeccionSesion() {
    return (
        <section className="pagina-sesion">
            <div className="circulo-fondo circulo-fondo-1" />
            <div className="circulo-fondo circulo-fondo-2" />

            <div className="contenedor-sesion">
                <InfoSesion />
                <TarjetaSesion />
            </div>

            <EnlacesInferiores />
        </section>
    );
}

function EncabezadoSesion() {
    return (
        <header className="barra-encabezado-sesion">
            <div className="marca-sesion">
                <LogoRomp tamano={26} className="icono-marca" />
                <span className="texto-marca">ROMP GPS</span>
            </div>

            <Link to="/" className="enlace-inicio">
                <span className="enlace-inicio__flecha">←</span>
                Volver al Inicio
            </Link>
        </header>
    );
}

function PiePagina() {
    return (
        <footer className="barra-pie-sesion">
            <div className="marca-pie">ROMP GPS</div>
            <p className="derechos-pie">© {new Date().getFullYear()} ROMP GPS. Navegación de precisión.</p>
            <nav className="navegacion-pie">
                <EnlacesLegales />
            </nav>
        </footer>
    );
}

export default function LoginPage() {
    return (
        <>
            <EncabezadoSesion />
            <SeccionSesion />
            <PiePagina />
        </>
    );
}