import "../Styles/Hero.css";

function Hero() {
    return (
        <section className="hero">

            <div className="superposicion-hero"></div>

            <div className="contenedor-hero">

                <div className="contenido-hero">

                    <div className="insignia-hero">
                        <span className="pulso"></span>
                        Precisión redefinida
                    </div>

                    <h1 className="titulo-hero">
                        EL CAMINO <br />
                        <span>DE LA PRECISIÓN.</span>
                    </h1>

                    <p className="descripcion-hero">
                        Instrumentación de alta gama para navegación global.
                        Rastree cada coordenada con precisión quirúrgica
                        utilizando nuestro ecosistema GPS de grado industrial.
                    </p>

                    <div className="botones-hero">
                        <a href="#pricing" className="boton-primario">
                            Empieza Ahora
                        </a>
                    </div>

                    <a className="indicador-scroll" href="#nosotros" aria-label="Desplazarse para conocer ROMP GPS">
                        <span className="indicador-scroll-linea" />
                        <span>Desliza para explorar</span>
                    </a>

                </div>

                <div className="envoltorio-tarjeta-hero">

                    <div className="resplandor-hero"></div>

                    <div className="tarjeta-hero">

                        <div className="parte-superior-tarjeta">
                            <span>Telemetría en vivo</span>
                            <span className="id-tarjeta">ID: ROMP_4492_X</span>
                        </div>

                        <div className="mapa-tarjeta">
                            <div className="superposicion-mapa"></div>
                            <div className="punto-mapa"></div>
                        </div>

                        <div className="estadisticas-tarjeta">
                            <div className="caja-estadistica-hero">
                                <small>Velocidad</small>
                                <h3>84.2 <span>km/h</span></h3>
                            </div>

                            <div className="caja-estadistica-hero">
                                <small>Señal</small>
                                <h3>99.8 <span>%</span></h3>
                            </div>
                        </div>

                    </div>

                    {/* Cartagena, igual que el centro por defecto del mapa.
                        Antes eran las coordenadas de Berlín. */}
                    <div className="coordenadas">
                        Lat: 10.4236° N <br />
                        Long: 75.5478° O <br />
                        Alt: 2.0m
                    </div>

                </div>

            </div>

        </section>
    );
}

export default Hero;
