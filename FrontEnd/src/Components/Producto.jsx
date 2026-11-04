import "../Styles/Producto.css";
import GpsDevice3D from "./three/GpsDevice3D";

function Producto() {
    return (
        <section className="seccion-producto" id="producto">

            <div className="contenedor-producto">

                <div className="envoltorio-imagen-producto">

                    <div className="caja-imagen-producto">

                        <GpsDevice3D />

                    </div>

                    <div className="metrica-flotante">
                        <h3>0.5m</h3>
                        <span>Margen de Error</span>
                    </div>

                </div>

                <div className="contenido-producto">

                    <span className="etiqueta-seccion">
                        Producto
                    </span>

                    <h2 className="titulo-producto">
                        LA UNIDAD <br />
                        DE CONTROL
                        <span> GNXIS.</span>
                    </h2>

                    <p className="descripcion-producto">
                        Diseñado para flotas profesionales y activos
                        de alto valor. El GNXIS integra conectividad
                        global multibanda con sensores inerciales avanzados.
                    </p>

                    <ul className="caracteristicas-producto">

                        <li>
                            <span className="punto"></span>
                            Batería de larga duración (365 días)
                        </li>

                        <li>
                            <span className="punto"></span>
                            Resistencia IP68 contra agua y polvo
                        </li>

                        <li>
                            <span className="punto"></span>
                            Instalación &quot;Plug-and-Monitor&quot; en 5 minutos
                        </li>

                    </ul>

                    <a
                        className="boton-especificaciones"
                        href="/docs/especificaciones-gnxis.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Explorar Especificaciones Técnicas
                        <span aria-hidden="true">→</span>
                    </a>

                </div>

            </div>

        </section>
    )
}

export default Producto