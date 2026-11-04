import LogoRomp from "./LogoRomp";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/NavBar.css";

const ENLACES = [
    { href: "#nosotros", texto: "Nosotros" },
    { href: "#producto", texto: "Producto" },
    { href: "#pricing", texto: "Pricing" },
    { href: "#equipo", texto: "Equipo" },
];

function Navbar() {
    const navigate = useNavigate();
    const [menuAbierto, setMenuAbierto] = useState(false);

    // Cierra con Escape y bloquea el scroll del fondo mientras está abierto
    useEffect(() => {
        if (!menuAbierto) return;

        const alPulsarTecla = (e) => {
            if (e.key === "Escape") setMenuAbierto(false);
        };

        document.body.classList.add("sin-scroll");
        window.addEventListener("keydown", alPulsarTecla);

        return () => {
            document.body.classList.remove("sin-scroll");
            window.removeEventListener("keydown", alPulsarTecla);
        };
    }, [menuAbierto]);

    return (
        <nav className="barra-navegacion">
            <div className="contenedor-barra">

                <div className="logo" onClick={() => navigate("/")}>
                    <LogoRomp tamano={26} className="logo-icono" />
                    <span className="logo-texto">ROMP GPS</span>
                </div>

                <div className="enlaces-nav">
                    {ENLACES.map(({ href, texto }) => (
                        <a key={href} href={href}>{texto}</a>
                    ))}
                </div>

                <div className="acciones-nav">
                    <button
                        type="button"
                        className="boton-nav"
                        onClick={() => navigate("/login")}>
                        Área de Clientes
                    </button>

                    <button
                        type="button"
                        className="boton-hamburguesa"
                        aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
                        aria-expanded={menuAbierto}
                        aria-controls="menu-movil"
                        onClick={() => setMenuAbierto((v) => !v)}>
                        <span className={`icono-hamburguesa ${menuAbierto ? "icono-hamburguesa--activo" : ""}`}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </button>
                </div>

            </div>

            <div
                id="menu-movil"
                className={`menu-movil ${menuAbierto ? "menu-movil--abierto" : ""}`}
                hidden={!menuAbierto}>
                {ENLACES.map(({ href, texto }) => (
                    <a key={href} href={href} onClick={() => setMenuAbierto(false)}>
                        {texto}
                    </a>
                ))}
                <button
                    type="button"
                    className="boton-nav boton-nav--movil"
                    onClick={() => { setMenuAbierto(false); navigate("/login"); }}>
                    Área de Clientes
                </button>
            </div>

            <div
                className={`velo-menu ${menuAbierto ? "velo-menu--visible" : ""}`}
                onClick={() => setMenuAbierto(false)}
                aria-hidden="true"
            />
        </nav>
    );
}

export default Navbar;