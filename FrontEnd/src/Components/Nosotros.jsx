import "../Styles/Nosotros.css";

function Nosotros() {
    return (
        <section className="seccion-nosotros" id="nosotros">

            <div className="contenedor-nosotros">

                <div className="parte-superior-nosotros">

                    <div className="izquierda-nosotros">

                        <span className="etiqueta-seccion">
                            Nuestra Misión
                        </span>

                        <h2 className="titulo-nosotros">
                            Creamos instrumentos de precision
                            para un mundo en movimiento.
                            No rastreamos;
                            <span> guiamos.</span>
                        </h2>

                    </div>

                    <div className="derecha-nosotros">

                        <p>
                            ROMP GPS nació de la necesidad de
                            fiabilidad absoluta en entornos críticos.
                            Nuestra tecnología combina hardware
                            de grado militar con software de análisis predictivo.
                        </p>

                    </div>

                </div>

                <div className="cuadricula-caracteristicas">

                    <div className="tarjeta-caracteristica">
                        <div className="icono-caracteristica">⚙</div>

                        <h3>I+D Constante</h3>

                        <p>
                            Innovación continua en microgeolocalización
                            y eficiencia energetica.
                        </p>
                    </div>

                    <div className="tarjeta-caracteristica">
                        <div className="icono-caracteristica">⛨</div>

                        <h3>Seguridad Encriptada</h3>

                        <p>
                            Protocolos de seguridad extremo a extremo
                            para proteger sus datos mas valiosos.
                        </p>
                    </div>

                    <div className="tarjeta-caracteristica">
                        <div className="icono-caracteristica">↯</div>

                        <h3>Latencia Cero</h3>

                        <p>
                            Actualizaciones en tiempo real
                            con infraestructura global de alta velocidad.
                        </p>
                    </div>

                </div>

            </div>

        </section>
    )
}

export default Nosotros