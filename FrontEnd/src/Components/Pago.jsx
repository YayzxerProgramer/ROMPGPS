import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_URL } from "../Service/api";
import "../Styles/Pago.css";

const PLANES = {
    personal: { nombre: "Plan Básico", precio: 229000, periodo: "/mes" },
    pro: { nombre: "Plan Garantía", precio: 289000, periodo: "/mes" },
    enterprise: { nombre: "Plan Premium", precio: 339000, periodo: "/mes" },
};
const formatoCOP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});
export default function Pago() {
    const [params] = useSearchParams();
    const planId = params.get("plan")?.toLowerCase();
    const anual = params.get("periodo")?.toUpperCase() === "ANUAL";
    const plan = PLANES[planId];
    const monto = plan ? (anual ? Math.round(plan.precio * 12 * 0.8) : plan.precio) : 0;
    const [estado, setEstado] = useState(() => params.get("id")
        ? { tipo: "pendiente", texto: "Wompi recibió tu solicitud. Estamos esperando la confirmación final del pago." }
        : null);
    const [cargando, setCargando] = useState(false);

    const iniciarPago = async () => {
        if (!plan || cargando) return;
        setCargando(true);
        setEstado(null);
        try {
            const periodo = anual ? "ANUAL" : "MENSUAL";
            const response = await fetch(`${API_URL}/pagos/checkout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan: planId, periodo }),
            });
            const checkout = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(checkout?.error || "No pudimos preparar el pago. Verifica la configuración del backend.");
            }

            const query = new URLSearchParams({
                "public-key": checkout.publicKey,
                currency: "COP",
                "amount-in-cents": String(checkout.montoCentavos),
                reference: checkout.referencia,
                "signature:integrity": checkout.firmaIntegridad,
            });

            // Wompi solo permite redirigir después del pago a una URL del sitio
            // registrado. localhost no es un dominio de producción válido y
            // provocaba que CloudFront devolviera 403 antes de mostrar el checkout.
            const esOrigenLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
            if (!esOrigenLocal && window.location.protocol === "https:") {
                query.set(
                    "redirect-url",
                    `${window.location.origin}/pago?plan=${planId}&periodo=${periodo}`
                );
            }
            window.location.assign(`https://checkout.wompi.co/p/?${query.toString()}`);
        } catch (error) {
            setCargando(false);
            setEstado({
                tipo: "error",
                texto: error.message || "No pudimos conectar con la pasarela. Intenta de nuevo.",
            });
        }
    };

    return (
        <main className="pagina-pago">
            <div className="pago-resplandor pago-resplandor--uno" />
            <div className="pago-resplandor pago-resplandor--dos" />
            <header className="pago-marca">
                <span className="pago-marca-icono">R</span>
                <span>ROMP <b>GPS</b></span>
                <span className="pago-seguro"><span aria-hidden="true">✓</span> Pago seguro</span>
            </header>

            <section className="pago-panel" aria-labelledby="titulo-pago">
                <div className="pago-etiqueta">Pasarela de pago</div>
                {plan ? (
                    <>
                        <h1 id="titulo-pago">Completa tu protección</h1>
                        <p className="pago-intro">Confirma el plan que acordaste con nuestro asesor.</p>
                        <div className="pago-resumen">
                            <div>
                                <span className="pago-resumen-label">Plan seleccionado</span>
                                <h2>{plan.nombre}</h2>
                            </div>
                            <div className="pago-precio">
                                <strong>{formatoCOP.format(monto)}</strong>
                                <span>{anual ? "/año · 20% de ahorro" : plan.periodo}</span>
                            </div>
                        </div>
                        <p className="pago-nota">El pago se procesa de forma segura por Wompi. ROMP GPS no almacena los datos de tu tarjeta.</p>
                        <button className="pago-boton" type="button" onClick={iniciarPago} disabled={cargando}>
                            {cargando ? "Preparando pago seguro…" : "Continuar con Wompi"}
                            {!cargando && <span aria-hidden="true">→</span>}
                        </button>
                        {estado && <p className={`pago-estado pago-estado--${estado.tipo}`} role="status">{estado.texto}</p>}
                        <a className="pago-ayuda" href="https://wa.me/17814123921" target="_blank" rel="noreferrer">
                            ¿Necesitas ayuda? Habla con tu asesor
                        </a>
                    </>
                ) : (
                    <div className="pago-invalido">
                        <h1 id="titulo-pago">Enlace de pago incompleto</h1>
                        <p>Solicita a tu asesor un enlace válido con el plan acordado.</p>
                        <a className="pago-boton pago-boton--link" href="https://wa.me/17814123921" target="_blank" rel="noreferrer">
                            Contactar a ROMP GPS <span aria-hidden="true">→</span>
                        </a>
                    </div>
                )}
            </section>

            <footer className="pago-pie">
                <span>ROMP GPS · Protección para lo que te mueve</span>
                <Link to="/">Volver al sitio</Link>
            </footer>
        </main>
    );
}
