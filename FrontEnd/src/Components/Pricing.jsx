import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { haySesionValida, obtenerUsuario, obtenerToken } from "../Service/sesion";
import { API_URL, api } from "../Service/api";
import "../Styles/Pricing.css";

const DESCUENTO_ANUAL = 0.8;   // 20% de ahorro al prepagar el año
const MESES_ANIO = 12;

/* Única fuente de verdad de los precios. Tanto el importe que se
   muestra como el que va al checkout se derivan de `precioMensual`,
   así que no pueden quedar desalineados. */
const PLANES = [
    {
        id: "personal",
        nombre: "Personal (Moto / Auto)",
        precioMensual: 24900,
        unidad: "/mes",
        descripcion: "Para usuarios particulares que buscan seguridad diaria.",
        destacado: false,
        caracteristicas: [
            { texto: "1 Dispositivo GPS GT06", incluida: true },
            { texto: "Ubicación en tiempo real (actualización 15s)", incluida: true },
            { texto: "Historial de recorridos (7 días)", incluida: true },
            { texto: "Apagado de motor desde la app", incluida: true },
            { texto: "Alertas por SMS directos", incluida: false },
        ],
    },
    {
        id: "pro",
        nombre: "Flotas & Negocios Pro",
        precioMensual: 44900,
        unidad: "/mes por vehículo",
        descripcion: "Para flotas pequeñas y medianas con monitoreo intensivo.",
        destacado: true,
        caracteristicas: [
            { texto: "Posicionamiento ultrarrápido (5 segundos)", incluida: true },
            { texto: "Historial extendido (90 días)", incluida: true },
            { texto: "Recomendador de rutas rápidas (Google Maps)", incluida: true },
            { texto: "Alertas push y SMS ilimitadas (OTP + corte)", incluida: true },
            { texto: "Reportes de velocidad y paradas en PDF", incluida: true },
        ],
    },
    {
        id: "enterprise",
        nombre: "Empresarial Custom",
        precioMensual: 79900,
        unidad: "/mes",
        descripcion: "Soluciones corporativas con API REST dedicada.",
        destacado: false,
        caracteristicas: [
            { texto: "Dispositivos ilimitados", incluida: true },
            { texto: "Acceso API REST para integraciones ERP", incluida: true },
            { texto: "Soporte técnico prioritario 24/7", incluida: true },
            { texto: "Geocercas y subcuentas ilimitadas", incluida: true },
        ],
    },
];

const LLAVE_PRUEBAS = "pub_test_Q5y15286524589254823";
const wompiPublicKey = import.meta.env.VITE_WOMPI_PUB_KEY || LLAVE_PRUEBAS;

if (!import.meta.env.VITE_WOMPI_PUB_KEY) {
    console.warn(
        "[Pricing] Falta VITE_WOMPI_PUB_KEY. Se usará la llave de PRUEBAS de Wompi."
    );
}

const formatoCOP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});

/** Lo que se muestra en la tarjeta: importe por mes. */
const precioPorMes = (plan, anual) =>
    anual ? Math.round(plan.precioMensual * DESCUENTO_ANUAL) : plan.precioMensual;

/** Lo que realmente se cobra: el año completo si la facturación es anual. */
const precioACobrar = (plan, anual) =>
    anual
        ? Math.round(plan.precioMensual * MESES_ANIO * DESCUENTO_ANUAL)
        : plan.precioMensual;

function Pricing() {
    const navigate = useNavigate();
    const [facturacionAnual, setFacturacionAnual] = useState(false);
    const [estadoPago, setEstadoPago] = useState(null);
    const [usuarioData, setUsuarioData] = useState(null);
    const [modalAuth, setModalAuth] = useState(false);
    const [planParaComprar, setPlanParaComprar] = useState(null);
    const [guardandoVenta, setGuardandoVenta] = useState(false);

    // Cargar información del usuario actual si está autenticado
    useEffect(() => {
        if (haySesionValida()) {
            const username = obtenerUsuario();
            const token = obtenerToken();
            if (username) {
                fetch(`${API_URL}/usuario/usuario/${username}`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data) => {
                        if (data) setUsuarioData(data);
                    })
                    .catch(() => {});
            }
        }
    }, []);

    const abrirWompiCheckout = (plan) => {
        const aCobrar = precioACobrar(plan, facturacionAnual);
        const montoCentavos = aCobrar * 100;
        const periodo = facturacionAnual ? "ANUAL" : "MENSUAL";
        const userId = usuarioData?.id || "CLIENTE";
        const referencia = `SUB-${userId}-${Date.now()}-${plan.id.toUpperCase()}-${periodo}`;

        setEstadoPago(null);

        const lanzarCheckout = () => {
            if (!window.WidgetCheckout) return;

            const customerData = usuarioData ? {
                email: usuarioData.correo,
                fullName: `${usuarioData.nombre || ""} ${usuarioData.apellido || ""}`.trim() || usuarioData.usuario,
                phoneNumber: usuarioData.telefono || undefined,
            } : undefined;

            const checkout = new window.WidgetCheckout({
                currency: "COP",
                amountInCents: montoCentavos,
                reference: referencia,
                publicKey: wompiPublicKey,
                customerData: customerData,
                redirectUrl: window.location.origin + "/panel-control",
            });

            checkout.open(async (result) => {
                const transaccion = result?.transaction;

                if (!transaccion) {
                    setEstadoPago({
                        tipo: "pendiente",
                        mensaje: "No recibimos confirmación de la transacción. Revisa tu correo o cuenta bancaria.",
                    });
                    return;
                }

                if (transaccion.status === "APPROVED") {
                    try {
                        setGuardandoVenta(true);
                        // Confirmar compra directamente en backend para reflejar la venta y actualizar el plan
                        await api("/pagos/confirmar-compra", {
                            method: "POST",
                            body: {
                                referencia,
                                transaccionId: transaccion.id,
                                plan: plan.id.toUpperCase(),
                                periodo,
                                monto: aCobrar,
                                metodoPago: transaccion.payment_method_type || "WOMPI",
                            },
                        });

                        localStorage.setItem("plan", plan.id.toUpperCase());
                        if (usuarioData) {
                            setUsuarioData((prev) => ({ ...prev, plan: plan.id.toUpperCase() }));
                        }

                        setEstadoPago({
                            tipo: "ok",
                            mensaje: `¡Pago aprobado con éxito! Tu cuenta ha sido activada en el plan ${plan.nombre}. La venta ya fue registrada en el sistema.`,
                        });
                    } catch (err) {
                        console.error("Error al registrar la venta:", err);
                        setEstadoPago({
                            tipo: "ok",
                            mensaje: `¡Pago aprobado en Wompi! (Ref: ${referencia}). Tu plan se actualizará en breves momentos.`,
                        });
                    } finally {
                        setGuardandoVenta(false);
                    }
                } else if (transaccion.status === "DECLINED") {
                    setEstadoPago({
                        tipo: "error",
                        mensaje: "El pago fue rechazado. Verifica los datos o prueba con otro medio de pago.",
                    });
                } else {
                    setEstadoPago({
                        tipo: "pendiente",
                        mensaje: `Transacción en estado "${transaccion.status}". Te avisaremos cuando se confirme.`,
                    });
                }
            });
        };

        if (window.WidgetCheckout) {
            lanzarCheckout();
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.wompi.co/widget.js";
        script.async = true;
        script.onload = lanzarCheckout;
        script.onerror = () =>
            setEstadoPago({
                tipo: "error",
                mensaje: "No pudimos cargar la pasarela de pago. Revisa tu conexión e inténtalo de nuevo.",
            });
        document.body.appendChild(script);
    };

    const manejarClicPagar = (plan) => {
        if (!haySesionValida()) {
            setPlanParaComprar(plan);
            setModalAuth(true);
            return;
        }
        abrirWompiCheckout(plan);
    };

    return (
        <section className="seccion-precios" id="pricing">
            <div className="contenedor-precios">

                <div className="encabezado-precios">
                    <span className="etiqueta-seccion">Planes y Precios</span>
                    <h2>Protección inteligente para tu vehículo o flota</h2>
                    <p className="descripcion-precios">
                        Selecciona la cobertura que mejor se adapte a tus necesidades.
                        Cancela en cualquier momento sin cláusulas de permanencia.
                    </p>

                    <div className="conmutador-facturacion">
                        <span className={`conmutador-etiqueta ${!facturacionAnual ? "conmutador-etiqueta--activa" : ""}`}>
                            Mensual
                        </span>

                        <button
                            type="button"
                            role="switch"
                            aria-checked={facturacionAnual}
                            aria-label="Activar facturación anual con 20% de ahorro"
                            className="conmutador-pista"
                            onClick={() => setFacturacionAnual((v) => !v)}
                        >
                            <span className="conmutador-mando" />
                        </button>

                        <span className={`conmutador-etiqueta ${facturacionAnual ? "conmutador-etiqueta--activa" : ""}`}>
                            Anual
                            <span className="insignia-ahorro">Ahorra 20%</span>
                        </span>
                    </div>
                </div>

                <div className="cuadricula-precios">
                    {PLANES.map((plan) => {
                        const porMes = precioPorMes(plan, facturacionAnual);
                        const aCobrar = precioACobrar(plan, facturacionAnual);
                        const esPlanActual = usuarioData?.plan?.toUpperCase() === plan.id.toUpperCase();

                        return (
                            <div
                                key={plan.id}
                                className={`tarjeta-precio ${plan.destacado ? "destacado" : ""} ${esPlanActual ? "tarjeta-precio--actual" : ""}`}
                            >
                                {esPlanActual ? (
                                    <div className="insignia-plan-activo">Tu Plan Actual</div>
                                ) : plan.destacado ? (
                                    <div className="insignia-destacado">Recomendado</div>
                                ) : null}

                                <div className="parte-superior-plan">
                                    <span className={`etiqueta-plan ${plan.destacado ? "texto-destacado" : ""}`}>
                                        {plan.nombre}
                                    </span>

                                    <h3 className="precio-plan">
                                        {formatoCOP.format(porMes)}
                                        <span className="periodo-plan">{plan.unidad}</span>
                                    </h3>

                                    {/* El importe real, visible ANTES de abrir el checkout */}
                                    {facturacionAnual && (
                                        <span className="nota-facturacion">
                                            Se factura {formatoCOP.format(aCobrar)} hoy, por 12 meses
                                        </span>
                                    )}

                                    <p className="descripcion-plan">{plan.descripcion}</p>
                                </div>

                                <ul className="caracteristicas-plan">
                                    {plan.caracteristicas.map(({ texto, incluida }) => (
                                        <li key={texto} className={incluida ? "" : "excluida"}>
                                            <span className="marca" aria-hidden="true">
                                                {incluida ? "✓" : "✕"}
                                            </span>
                                            {texto}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    type="button"
                                    onClick={() => manejarClicPagar(plan)}
                                    disabled={guardandoVenta}
                                    className={`boton-precio ${esPlanActual ? "actual" : plan.destacado ? "primario" : "secundario"}`}
                                >
                                    {esPlanActual
                                        ? `Renovar ${plan.nombre}`
                                        : facturacionAnual
                                        ? `Pagar 12 meses · ${formatoCOP.format(aCobrar)}`
                                        : `Pagar ${formatoCOP.format(aCobrar)} · PSE / Nequi / Tarjeta`}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {estadoPago && (
                    <div
                        className={`estado-pago estado-pago--${estadoPago.tipo}`}
                        role="status"
                        aria-live="polite"
                    >
                        <p>{estadoPago.mensaje}</p>
                        {estadoPago.tipo === "ok" && (
                            <button
                                type="button"
                                className="btn-ir-panel-exito"
                                onClick={() => navigate("/panel-control")}
                            >
                                Ir a mi Panel de Control
                            </button>
                        )}
                    </div>
                )}

            </div>

            {/* Modal de requerimiento de autenticación para vincular plan al cliente */}
            {modalAuth && (
                <div className="modal-pricing-overlay" onClick={() => setModalAuth(false)}>
                    <div className="modal-pricing-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-pricing-icono">
                            <span className="material-symbols-outlined">lock</span>
                        </div>
                        <h3>Inicia sesión para activar tu plan</h3>
                        <p>
                            Para contratar o mejorar al plan <strong>{planParaComprar?.nombre}</strong>, debes iniciar sesión o registrarte con tu cuenta de ROMP GPS. Así tu plan se vinculará directamente a tus vehículos y monitoreo.
                        </p>
                        <div className="modal-pricing-acciones">
                            <button
                                type="button"
                                className="modal-pricing-btn-primario"
                                onClick={() => navigate("/login")}
                            >
                                Iniciar Sesión
                            </button>
                            <button
                                type="button"
                                className="modal-pricing-btn-secundario"
                                onClick={() => navigate("/registro")}
                            >
                                Registrarme
                            </button>
                        </div>
                        <button
                            type="button"
                            className="modal-pricing-btn-cancelar"
                            onClick={() => setModalAuth(false)}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}

export default Pricing;