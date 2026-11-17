import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { guardarSesion, rutaInicial } from "../Service/sesion";
import { API_URL } from "../Service/api";

export default function AuthCallback() {
    const navigate = useNavigate();
    const procesado = useRef(false);
    const [mensaje, setMensaje] = useState("Autenticando con GitHub...");

    useEffect(() => {
        // En React 18 StrictMode, useEffect se ejecuta 2 veces en desarrollo.
        // El código de GitHub solo se puede canjear una sola vez.
        if (procesado.current) return;
        procesado.current = true;

        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const error = params.get("error");
        const errorDesc = params.get("error_description");

        if (error) {
            console.error("GitHub OAuth error:", error, errorDesc);
            setMensaje(`Error de autorización en GitHub: ${errorDesc || error}`);
            setTimeout(() => navigate("/login"), 3500);
            return;
        }

        if (!code) {
            navigate("/login");
            return;
        }

        // Manda el code al backend para intercambiarlo por el access_token
        fetch(`${API_URL}/usuario/github/callback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (res.ok && data?.token) {
                    guardarSesion(data);
                    navigate(rutaInicial());
                } else {
                    const motivo = data?.mensaje || data?.error || `Error ${res.status}: no se pudo completar la sesión`;
                    console.error("Error devuelto por el backend:", motivo);
                    setMensaje(`Error al iniciar sesión: ${motivo}`);
                    setTimeout(() => navigate("/login"), 3500);
                }
            })
            .catch((err) => {
                console.error("Error de conexión al conectar con el backend:", err);
                setMensaje("No se pudo conectar con el servidor Backend (puerto 8081). Verifica que esté encendido.");
                setTimeout(() => navigate("/login"), 3500);
            });
    }, [navigate]);

    return (
        <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
            backgroundColor: "#080c14",
            color: "#e2e8f0",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "16px",
            padding: "20px",
            textAlign: "center"
        }}>
            {mensaje}
        </div>
    );
}
