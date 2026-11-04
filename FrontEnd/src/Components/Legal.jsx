import { useEffect } from "react";
import { Link } from "react-router-dom";
import "../Styles/Legal.css";
import EnlacesLegales from "./EnlacesLegales";
import FondoAurora from "./FondoAurora";
import LogoRomp from "./LogoRomp";


const CORREO_CONTACTO = "RompGps@gmai.com";
const ACTUALIZADO = "1 de noviembre de 2026";

const DOCUMENTOS = {
    privacidad: {
        titulo: "Política de Privacidad",
        intro: "Esta política explica qué datos trata ROMP GPS, para qué los usa y qué derechos tienes sobre ellos.",
        secciones: [
            {
                titulo: "1. Datos que tratamos",
                lista: [
                    "Datos de cuenta: nombre, apellido, usuario, correo, teléfono y foto de perfil si decides subirla.",
                    "Datos del vehículo: placa, modelo, tipo e IMEI del equipo GPS.",
                    "Datos de ubicación: posición, velocidad y hora que reporta el equipo GPS.",
                    "Mantenimientos: fecha, tipo y notas que registres.",
                    "Pagos: plan, valor, estado y referencia de la transacción. No guardamos los datos de tu tarjeta.",
                ],
            },
            {
                titulo: "2. Para qué los usamos",
                lista: [
                    "Mostrar la ubicación y el historial de recorridos de tus vehículos.",
                    "Enviar códigos de verificación, alertas y comandos al equipo GPS.",
                    "Estimar cuándo necesitará mantenimiento cada vehículo.",
                    "Gestionar tu cuenta, tu plan y el soporte.",
                ],
            },
            {
                titulo: "3. Con quién los compartimos",
                texto: "Solo con los proveedores necesarios para prestar el servicio: Google y GitHub (inicio de sesión y mapas), Wompi (pagos), Twilio (SMS y WhatsApp), Cloudinary (fotos de perfil) y MongoDB Atlas (almacenamiento de posiciones). No vendemos tus datos.",
            },
            {
                titulo: "4. Tus derechos",
                texto: `De acuerdo con la Ley 1581 de 2012 de Colombia, puedes conocer, actualizar, rectificar y solicitar la eliminación de tus datos, y revocar tu autorización. Escríbenos a ${CORREO_CONTACTO}.`,
            },
            {
                titulo: "5. Seguridad",
                texto: "Protegemos las contraseñas con cifrado, limitamos los intentos de acceso y ofrecemos verificación en dos pasos. Ningún sistema es infalible, así que te recomendamos activarla y usar una contraseña única.",
            },
        ],
    },
    terminos: {
        titulo: "Términos de Servicio",
        intro: "Al crear una cuenta en ROMP GPS aceptas estas condiciones. Léelas antes de usar la plataforma.",
        secciones: [
            {
                titulo: "1. El servicio",
                texto: "ROMP GPS permite localizar vehículos con equipos GPS GT06, consultar sus recorridos, enviar comandos y estimar su próximo mantenimiento.",
            },
            {
                titulo: "2. Tu cuenta",
                texto: "Debes dar datos verdaderos y mantener tu contraseña en secreto. Eres responsable de lo que se haga desde tu cuenta.",
            },
            {
                titulo: "3. Uso permitido",
                lista: [
                    "Rastrea solo vehículos propios o aquellos para los que tengas autorización.",
                    "No uses la plataforma para vigilar a personas sin su consentimiento.",
                    "Usa el apagado de motor únicamente cuando sea seguro hacerlo.",
                ],
            },
            {
                titulo: "4. Estimaciones de mantenimiento",
                texto: "Los kilómetros restantes son una estimación y pueden tener errores. No reemplazan el manual del fabricante ni la revisión de un taller.",
            },
            {
                titulo: "5. Disponibilidad",
                texto: "La ubicación depende de la cobertura celular y satelital, y del estado del equipo GPS. No garantizamos que el servicio funcione sin interrupciones.",
            },
            {
                titulo: "6. Planes y pagos",
                texto: "Los pagos se procesan a través de Wompi. Las características y el precio de cada plan son los publicados al momento de la compra.",
            },
            {
                titulo: "7. Contacto",
                texto: `Si tienes dudas sobre estos términos, escríbenos a ${CORREO_CONTACTO}.`,
            },
        ],
    },
};

export default function Legal({ tipo }) {
    const documento = DOCUMENTOS[tipo];

    useEffect(() => {
        window.scrollTo(0, 0);
        document.title = `${documento.titulo} · ROMP GPS`;
        return () => { document.title = "ROMP GPS"; };
    }, [documento]);

    return (
        <div className="legal">
            <FondoAurora />

            <header className="legal-cabecera">
                <Link to="/" className="legal-marca">
                    <LogoRomp tamano={26} />
                    ROMP GPS
                </Link>
                <Link to="/" className="legal-volver">
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                    Volver al inicio
                </Link>
            </header>

            <main className="legal-contenido">
                <h1>{documento.titulo}</h1>
                <p className="legal-fecha">Última actualización: {ACTUALIZADO}</p>
                <p className="legal-intro">{documento.intro}</p>

                {documento.secciones.map(({ titulo, texto, lista }) => (
                    <section key={titulo}>
                        <h2>{titulo}</h2>
                        {texto && <p>{texto}</p>}
                        {lista && <ul>{lista.map((item) => <li key={item}>{item}</li>)}</ul>}
                    </section>
                ))}
            </main>

            <footer className="legal-pie">
                <EnlacesLegales />
            </footer>
        </div>
    );
}
