import "../Styles/Equipo.css";

import luchoimg from "../Image/Luis.jpeg"
import yanniorimg from "../Image/Yannior.jpeg"
import jaimeimg from "../Image/Chang.jpeg"
import holmertimg from "../Image/Holmert.jpg"
import santiagoimg from "../Image/santiago.png"

const miembros = [
    {
        nombre: "Luis Sarmiento",
        cargo: "Desarrollador Frontend",
        imagen: luchoimg
    },
    {
        nombre: "Yannior Tapias",
        cargo: "Desarrollador Fullstack",
        imagen: yanniorimg
    },
    {
        nombre: "Holmert Cabarcas",
        cargo: "Ayudante del Frontend",
        imagen: holmertimg
    },
    {
        nombre: "Jaime Chang",
        cargo: "Desarrollador Backend",
        imagen: jaimeimg
    },
    {
        nombre: "Santiago Marimon",
        cargo: "Admin de Bases de Datos",
        imagen: santiagoimg
    }
]

function Equipo() {
    return (
        <section className="seccion-equipo" id="equipo">

            <div className="contenedor-equipo">

                <div className="encabezado-equipo">

                    <div className="encabezado-equipo-izquierda">

                        <span className="etiqueta-seccion">
                            Nuestro Equipo
                        </span>

                        <h2>
                            Mentes detrás del sistema.
                        </h2>

                    </div>

                    <div className="encabezado-equipo-derecha">

                        <p>
                            Un equipo multidisciplinar enfocado en resolver
                            los problemas de logística más complejos.
                        </p>

                    </div>

                </div>

                <div className="cuadricula-equipo">

                    {miembros.map((miembro, index) => (
                        <div className="tarjeta-miembro" key={index}>

                            <img
                                src={miembro.imagen}
                                alt={miembro.nombre}
                            />

                            <div className="superposicion-miembro">

                                <h3>{miembro.nombre}</h3>
                                <span>{miembro.cargo}</span>

                            </div>

                        </div>
                    ))}

                </div>

            </div>

        </section>
    )
}

export default Equipo