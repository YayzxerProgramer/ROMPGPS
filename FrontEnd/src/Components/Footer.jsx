import "../Styles/Footer.css";
import EnlacesLegales from "./EnlacesLegales";

function Footer() {
    return (
        <footer className="pie-pagina">
            <div className="contenedor-pie">

                <div className="logo-pie">ROMP GPS</div>

                <nav className="enlaces-pie" aria-label="Enlaces legales">
                    <EnlacesLegales />
                </nav>

                <div className="derechos-pie">
                    © {new Date().getFullYear()} ROMP GPS. Navegación de precisión.
                </div>

            </div>
        </footer>
    );
}

export default Footer;