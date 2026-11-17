import { useState, useCallback } from "react";
import MiniMapaHero from "./MiniMapaHero";
import "../Styles/Hero.css";

function Hero() {
    const [telemetria, setTelemetria] = useState({
        velocidad: 58.4,
        lat: "10.4285° N",
        lng: "75.5512° O",
        senal: 99.8,
        alt: "2.4m"
    });

    const handleTelemetryUpdate = useCallback((data) => {
        setTelemetria((prev) => ({
            ...prev,
            ...data
        }));
    }, []);

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
                            <MiniMapaHero onTelemetryUpdate={handleTelemetryUpdate} />
                        </div>

                        <div className="estadisticas-tarjeta">
                            <div className="caja-estadistica-hero">
                                <small>Velocidad</small>
                                <h3>{telemetria.velocidad.toFixed(1)} <span>km/h</span></h3>
                            </div>

                            <div className="caja-estadistica-hero">
                                <small>Señal</small>
                                <h3>{telemetria.senal.toFixed(1)} <span>%</span></h3>
                            </div>
                        </div>

                    </div>

                    {/* Coordenadas en vivo sincronizadas con el recorrido GPS en Cartagena */}
                    <div className="coordenadas">
                        Lat: {telemetria.lat} <br />
                        Long: {telemetria.lng} <br />
                        Alt: {telemetria.alt}
                    </div>

                </div>

            </div>

        </section>
    );
}

export default Hero;
