import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FondoAurora from "./FondoAurora";
import { API_URL } from "../Service/api";
import "../Styles/RecuperarContrasena.css";

const trazo = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

function IconoCorreo({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path {...trazo} d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline {...trazo} points="22,6 12,13 2,6" />
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

function IconoCodigo({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <polyline {...trazo} points="16 18 22 12 16 6" />
            <polyline {...trazo} points="8 6 2 12 8 18" />
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

function calcularFortaleza(pass) {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
}

export default function RecuperarContrasena() {
    const navigate = useNavigate();

    // 1: Solicitar código | 2: Digitar código OTP | 3: Crear nueva clave | 4: Éxito
    const [paso, setPaso] = useState(1);
    const [identificador, setIdentificador] = useState("");
    const [codigo, setCodigo] = useState("");
    const [nuevaContrasena, setNuevaContrasena] = useState("");
    const [confirmarContrasena, setConfirmarContrasena] = useState("");
    const [mostrarPass, setMostrarPass] = useState(false);
    const [mostrarConfirmarPass, setMostrarConfirmarPass] = useState(false);

    const [cargando, setCargando] = useState(false);
    const [mensajeError, setMensajeError] = useState("");
    const [mensajeExito, setMensajeExito] = useState("");

    const fortaleza = calcularFortaleza(nuevaContrasena);
    const etiquetasFortaleza = ["", "Débil", "Aceptable", "Fuerte", "Excelente"];

    // ── Paso 1: Solicitar código OTP ─────────────────────────────
    const handleSolicitarCodigo = async (e) => {
        if (e) e.preventDefault();
        setMensajeError("");
        if (!identificador.trim()) {
            setMensajeError("Por favor ingresa tu correo electrónico o nombre de usuario");
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_URL}/usuario/recuperar-contrasena/solicitar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identificador: identificador.trim() }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || err?.mensaje || "Error al solicitar código de recuperación");
            }

            setPaso(2);
            setMensajeExito("Código de seguridad enviado. Revisa tu bandeja de entrada o carpeta de spam.");
        } catch (err) {
            setMensajeError(err.message || "Error de conexión con el servidor");
        } finally {
            setCargando(false);
        }
    };

    // ── Paso 2: Verificar únicamente el código OTP ───────────────
    const handleVerificarCodigo = async (e) => {
        e.preventDefault();
        setMensajeError("");

        const codLimpio = codigo.trim();
        if (!codLimpio || codLimpio.length !== 6) {
            setMensajeError("Ingresa el código de 6 dígitos que recibiste");
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_URL}/usuario/recuperar-contrasena/validar-codigo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identificador: identificador.trim(),
                    codigo: codLimpio,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || err?.mensaje || "El código es inválido o ha expirado");
            }

            // Código validado correctamente -> avanza al paso 3 para cambiar contraseña
            setMensajeExito("");
            setPaso(3);
        } catch (err) {
            setMensajeError(err.message || "Código inválido o expirado");
        } finally {
            setCargando(false);
        }
    };

    // ── Paso 3: Guardar nueva contraseña ─────────────────────────
    const handleRestablecer = async (e) => {
        e.preventDefault();
        setMensajeError("");

        if (nuevaContrasena.length < 6) {
            setMensajeError("La nueva contraseña debe tener al menos 6 caracteres");
            return;
        }

        if (nuevaContrasena !== confirmarContrasena) {
            setMensajeError("Las contraseñas no coinciden");
            return;
        }

        setCargando(true);
        try {
            const res = await fetch(`${API_URL}/usuario/recuperar-contrasena/restablecer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identificador: identificador.trim(),
                    codigo: codigo.trim(),
                    nuevaContrasena,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || err?.mensaje || "No se pudo restablecer la contraseña. El código pudo haber expirado.");
            }

            setPaso(4);
        } catch (err) {
            setMensajeError(err.message || "No se pudo restablecer la contraseña");
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="recuperar-page">
            <FondoAurora />

            <header className="recuperar-header">
                <div className="recuperar-header__brand">
                    <span className="material-symbols-outlined icono-marca">location_searching</span>
                    <span className="texto-marca">ROMP GPS</span>
                </div>
                <Link to="/login" className="recuperar-header__volver">
                    <span className="material-symbols-outlined">arrow_back</span>
                    Volver al login
                </Link>
            </header>

            <main className="recuperar-main">
                <div className="recuperar-card">
                    <div className="recuperar-card__badge">
                        <span className="material-symbols-outlined">lock_reset</span>
                        {paso === 1 && "Recuperación · Paso 1 de 3"}
                        {paso === 2 && "Verificación · Paso 2 de 3"}
                        {paso === 3 && "Nueva Clave · Paso 3 de 3"}
                        {paso === 4 && "Seguridad"}
                    </div>

                    {/* ── PASO 1: Ingreso de correo o usuario ── */}
                    {paso === 1 && (
                        <>
                            <h1 className="recuperar-card__titulo">Recuperar Contraseña</h1>
                            <p className="recuperar-card__subtitulo">
                                Ingresa tu correo electrónico o nombre de usuario registrado. Te enviaremos un código de seguridad para verificar tu cuenta.
                            </p>

                            <form onSubmit={handleSolicitarCodigo} className="recuperar-form">
                                <div className="recuperar-campo">
                                    <label htmlFor="identificador">Correo o Usuario</label>
                                    <div className="recuperar-campo__input-box">
                                        <IconoCorreo className="recuperar-campo__icono" />
                                        <input
                                            id="identificador"
                                            type="text"
                                            placeholder="ej. usuario@correo.com"
                                            value={identificador}
                                            onChange={(e) => setIdentificador(e.target.value)}
                                            autoFocus
                                            autoComplete="username"
                                            required
                                        />
                                    </div>
                                </div>

                                {mensajeError && (
                                    <div className="recuperar-alerta recuperar-alerta--error">
                                        <span className="material-symbols-outlined">error</span>
                                        <span>{mensajeError}</span>
                                    </div>
                                )}

                                <button type="submit" className="recuperar-btn" disabled={cargando}>
                                    {cargando ? "Enviando..." : "Enviar código de verificación"}
                                    <span className="material-symbols-outlined">send</span>
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── PASO 2: Digitar únicamente el código OTP ── */}
                    {paso === 2 && (
                        <>
                            <h1 className="recuperar-card__titulo">Ingresa el Código</h1>
                            <p className="recuperar-card__subtitulo">
                                Hemos enviado un código de 6 dígitos a <strong>{identificador}</strong>. Ingrésalo a continuación para continuar.
                            </p>

                            {mensajeExito && (
                                <div className="recuperar-alerta recuperar-alerta--exito">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <span>{mensajeExito}</span>
                                </div>
                            )}

                            <form onSubmit={handleVerificarCodigo} className="recuperar-form">
                                <div className="recuperar-campo">
                                    <label htmlFor="codigo">Código de Verificación (6 dígitos)</label>
                                    <div className="recuperar-campo__input-box recuperar-campo__input-box--codigo">
                                        <input
                                            id="codigo"
                                            type="text"
                                            placeholder="••••••"
                                            maxLength={6}
                                            value={codigo}
                                            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                                            inputMode="numeric"
                                            autoFocus
                                            autoComplete="one-time-code"
                                            required
                                        />
                                    </div>
                                </div>

                                {mensajeError && (
                                    <div className="recuperar-alerta recuperar-alerta--error">
                                        <span className="material-symbols-outlined">error</span>
                                        <span>{mensajeError}</span>
                                    </div>
                                )}

                                <button type="submit" className="recuperar-btn" disabled={cargando}>
                                    {cargando ? "Verificando..." : "Continuar"}
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>

                                <div className="recuperar-acciones-secundarias">
                                    <button
                                        type="button"
                                        className="recuperar-btn-secundario"
                                        onClick={handleSolicitarCodigo}
                                        disabled={cargando}
                                    >
                                        ¿No recibiste el código? Reenviar
                                    </button>
                                    <button
                                        type="button"
                                        className="recuperar-btn-secundario"
                                        onClick={() => { setPaso(1); setMensajeError(""); setMensajeExito(""); }}
                                        disabled={cargando}
                                    >
                                        Cambiar correo o usuario
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── PASO 3: Definir y confirmar nueva contraseña ── */}
                    {paso === 3 && (
                        <>
                            <h1 className="recuperar-card__titulo">Crea tu Nueva Contraseña</h1>
                            <p className="recuperar-card__subtitulo">
                                Código verificado con éxito. Ingresa tu nueva contraseña para proteger tu cuenta.
                            </p>

                            <form onSubmit={handleRestablecer} className="recuperar-form">
                                <div className="recuperar-campo">
                                    <label htmlFor="nuevaContrasena">Nueva Contraseña</label>
                                    <div className="recuperar-campo__input-box">
                                        <IconoCandado className="recuperar-campo__icono" />
                                        <input
                                            id="nuevaContrasena"
                                            type={mostrarPass ? "text" : "password"}
                                            placeholder="Mínimo 6 caracteres"
                                            value={nuevaContrasena}
                                            onChange={(e) => setNuevaContrasena(e.target.value)}
                                            autoFocus
                                            autoComplete="new-password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="recuperar-campo__ojo"
                                            onClick={() => setMostrarPass(!mostrarPass)}
                                            tabIndex={-1}
                                            aria-label="Alternar visibilidad de contraseña"
                                        >
                                            {mostrarPass ? <IconoOjoTachado className="recuperar-campo__icono" /> : <IconoOjo className="recuperar-campo__icono" />}
                                        </button>
                                    </div>
                                </div>

                                {nuevaContrasena.length > 0 && (
                                    <div className="fortaleza-box">
                                        <div className="fortaleza-barras">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className={`fortaleza-barra ${i <= fortaleza ? `activa activa--${fortaleza}` : ""}`}
                                                />
                                            ))}
                                        </div>
                                        <span className="fortaleza-texto">{etiquetasFortaleza[fortaleza]}</span>
                                    </div>
                                )}

                                <div className="recuperar-campo">
                                    <label htmlFor="confirmarContrasena">Confirmar Nueva Contraseña</label>
                                    <div className="recuperar-campo__input-box">
                                        <IconoCandado className="recuperar-campo__icono" />
                                        <input
                                            id="confirmarContrasena"
                                            type={mostrarConfirmarPass ? "text" : "password"}
                                            placeholder="Repite la nueva contraseña"
                                            value={confirmarContrasena}
                                            onChange={(e) => setConfirmarContrasena(e.target.value)}
                                            autoComplete="new-password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="recuperar-campo__ojo"
                                            onClick={() => setMostrarConfirmarPass(!mostrarConfirmarPass)}
                                            tabIndex={-1}
                                            aria-label="Alternar visibilidad de confirmación"
                                        >
                                            {mostrarConfirmarPass ? <IconoOjoTachado className="recuperar-campo__icono" /> : <IconoOjo className="recuperar-campo__icono" />}
                                        </button>
                                    </div>
                                </div>

                                {mensajeError && (
                                    <div className="recuperar-alerta recuperar-alerta--error">
                                        <span className="material-symbols-outlined">error</span>
                                        <span>{mensajeError}</span>
                                    </div>
                                )}

                                <button type="submit" className="recuperar-btn" disabled={cargando}>
                                    {cargando ? "Guardando..." : "Guardar nueva contraseña"}
                                    <span className="material-symbols-outlined">lock_open</span>
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── PASO 4: Éxito y confirmación ── */}
                    {paso === 4 && (
                        <div className="recuperar-exito">
                            <div className="recuperar-exito__icono">
                                <span className="material-symbols-outlined">verified</span>
                            </div>
                            <h2 className="recuperar-card__titulo">¡Contraseña Actualizada!</h2>
                            <p className="recuperar-card__subtitulo">
                                Tu contraseña ha sido cambiada exitosamente. Todas las sesiones anteriores han sido cerradas por seguridad.
                            </p>
                            <button
                                type="button"
                                className="recuperar-btn"
                                onClick={() => navigate("/login")}
                            >
                                Iniciar Sesión con tu nueva clave
                                <span className="material-symbols-outlined">login</span>
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
