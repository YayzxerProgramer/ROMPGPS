import { Link } from "react-router-dom";
import { API_URL } from "../Service/api";

/** Enlaces legales de todos los pies de página, en un solo sitio. */
export default function EnlacesLegales({ claseEnlace }) {
    return (
        <>
            <Link to="/privacidad" className={claseEnlace}>Política de Privacidad</Link>
            <Link to="/terminos" className={claseEnlace}>Términos de Servicio</Link>
            <a
                href={`${API_URL}/swagger-ui/index.html`}
                className={claseEnlace}
                target="_blank"
                rel="noopener noreferrer"
            >
                Documentación API
            </a>
        </>
    );
}
