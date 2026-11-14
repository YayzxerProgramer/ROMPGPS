import { useState } from "react";
import "../Styles/Pricing.css";

const DESCUENTO_ANUAL = 0.8;
const MESES_ANIO = 12;

const PLANES = [
    {
        id: "personal",
        nombre: "Plan Básico",
        precioMensual: 229000,
        unidad: "/mes",
        descripcion: "Protección esencial para tu moto o automóvil.",
        destacado: false,
        caracteristicas: [
            "Equipo GPS 4G",
            "Ubicación en tiempo real",
            "Apagado del vehículo desde la app",
            "Historial de recorridos",
            "App para iOS y Android",
            "Sistema anti jammer",
        ],
    },
    {
        id: "pro",
        nombre: "Plan Garantía",
        precioMensual: 289000,
        unidad: "/mes",
        descripcion: "Más respaldo y protección para tu vehículo.",
        destacado: true,
        caracteristicas: [
            "Garantía extendida por 2 años",
            "Incluye todo lo del Plan Básico",
            "Equipo GPS 4G",
        ],
    },
    {
        id: "enterprise",
        nombre: "Plan Premium",
        precioMensual: 339000,
        unidad: "/mes",
        descripcion: "Cobertura integral para máxima tranquilidad.",
        destacado: false,
        caracteristicas: [
            "Rastreador de respaldo inalámbrico",
            "Doble protección total",
            "Incluye todo lo del Plan Garantía",
            "Equipo GPS 4G",
        ],
    },
];

const formatoCOP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});

function Pricing() {
    const [facturacionAnual, setFacturacionAnual] = useState(false);

    const abrirWhatsApp = (plan) => {
        const periodo = facturacionAnual ? "anual" : "mensual";
        const mensaje = `Hola, necesito información y asesoría sobre el ${plan.nombre} de ROMP GPS. Me interesa la modalidad ${periodo}. ¿Me pueden ayudar?`;
        window.open(
            `https://wa.me/17814123921?text=${encodeURIComponent(mensaje)}`,
            "_blank",
            "noopener,noreferrer"
        );
    };

    return (
        <section className="seccion-precios" id="pricing">
            <div className="contenedor-precios">
                <div className="encabezado-precios">
                    <span className="etiqueta-seccion">Planes y Precios</span>
                    <h2>Protección inteligente para tu vehículo o flota</h2>
                    <p className="descripcion-precios">
                        Elige una cobertura y habla con nuestro equipo para recibir asesoría personalizada.
                    </p>

                    <div className="conmutador-facturacion">
                        <span className={`conmutador-etiqueta ${!facturacionAnual ? "conmutador-etiqueta--activa" : ""}`}>
                            Mensual
                        </span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={facturacionAnual}
                            aria-label="Seleccionar modalidad anual con 20% de ahorro"
                            className="conmutador-pista"
                            onClick={() => setFacturacionAnual((actual) => !actual)}
                        >
                            <span className="conmutador-mando" />
                        </button>
                        <span className={`conmutador-etiqueta ${facturacionAnual ? "conmutador-etiqueta--activa" : ""}`}>
                            Anual <span className="insignia-ahorro">Ahorra 20%</span>
                        </span>
                    </div>
                </div>

                <div className="cuadricula-precios">
                    {PLANES.map((plan) => {
                        const precio = facturacionAnual
                            ? Math.round(plan.precioMensual * DESCUENTO_ANUAL)
                            : plan.precioMensual;
                        const totalAnual = Math.round(plan.precioMensual * MESES_ANIO * DESCUENTO_ANUAL);

                        return (
                            <article key={plan.id} className={`tarjeta-precio tarjeta-precio--${plan.id} ${plan.destacado ? "destacado" : ""}`}>
                                {plan.destacado && <div className="insignia-destacado">Recomendado</div>}
                                <div className="parte-superior-plan">
                                    <span className={`etiqueta-plan ${plan.destacado ? "texto-destacado" : ""}`}>
                                        {plan.nombre}
                                    </span>
                                    <h3 className="precio-plan">
                                        {formatoCOP.format(precio)}
                                        <span className="periodo-plan">{plan.unidad}</span>
                                    </h3>
                                    {facturacionAnual && (
                                        <span className="nota-facturacion">
                                            Total anual: {formatoCOP.format(totalAnual)}
                                        </span>
                                    )}
                                    <p className="descripcion-plan">{plan.descripcion}</p>
                                </div>

                                <ul className="caracteristicas-plan">
                                    {plan.caracteristicas.map((caracteristica) => (
                                        <li key={caracteristica}>
                                            <span className="marca" aria-hidden="true">✓</span>
                                            {caracteristica}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    type="button"
                                    onClick={() => abrirWhatsApp(plan)}
                                    className={`boton-precio ${plan.destacado ? "primario" : "secundario"}`}
                                >
                                    Hablar con un asesor
                                </button>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export default Pricing;
