import { useEffect, useState } from "react";
import Visor3D from "./Visor3D";
import { cargarVisor, hayWebGL } from "./soporte3d";
import { MODELOS_VEHICULO, resolverModeloVehiculo, urlPoster3D } from "../../config/vehicleModels";
import "../../Styles/VistaVehiculo3D.css";

/** Retrasa un valor para no buscar modelo en cada pulsación. */
function useRetrasado(valor, ms) {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setRetrasado(valor), ms);
    return () => window.clearTimeout(id);
  }, [valor, ms]);
  return retrasado;
}

function SiluetaMoto() {
  return (
    <svg viewBox="0 0 120 72" className="silueta-vehiculo" aria-hidden="true">
      <circle cx="24" cy="52" r="15" />
      <circle cx="96" cy="52" r="15" />
      <circle cx="24" cy="52" r="3" />
      <circle cx="96" cy="52" r="3" />
      <path d="M24 52 L42 34 H66 L82 24 L96 52" />
      <path d="M34 30 H58 Q64 22 76 24" />
      <path d="M82 24 L78 12 H88" />
      <path d="M44 52 H66 L70 40 H48 Z" />
    </svg>
  );
}

function SiluetaCarro() {
  return (
    <svg viewBox="0 0 120 72" className="silueta-vehiculo" aria-hidden="true">
      <path d="M8 50 V40 L22 35 L40 21 H76 L94 35 L110 39 V50 H101" />
      <path d="M45 50 H75" />
      <path d="M8 50 H19" />
      <path d="M44 25 H58 V35 H31 Z M64 25 H74 L86 35 H64 Z" />
      <circle cx="32" cy="50" r="10" />
      <circle cx="88" cy="50" r="10" />
    </svg>
  );
}

const DISPONIBLES = MODELOS_VEHICULO.map((m) => m.corto).join(", ").replace(/, ([^,]*)$/, " y $1");

/**
 * Vista 3D del vehículo según el texto de su modelo, con respaldo genérico
 * (silueta de moto o carro) cuando no hay modelo 3D: nunca un hueco vacío.
 *
 * @param {object} props
 * @param {string} props.modelo texto libre del campo "modelo"
 * @param {"MOTO"|"CARRO"} [props.tipo="MOTO"] elige la silueta del respaldo
 * @param {boolean} [props.zoom=true]
 * @param {string} [props.className]
 */
export default function VistaVehiculo3D({ modelo, tipo = "MOTO", zoom = true, className = "" }) {
  const texto = useRetrasado(modelo, 250);
  const encontrado = resolverModeloVehiculo(texto);

  // Mientras el usuario escribe se adelanta la descarga del código del visor
  // (no de los modelos): al haber coincidencia el 3D aparece antes.
  useEffect(() => {
    if (hayWebGL()) cargarVisor().catch(() => {});
  }, []);

  return (
    <div className={`vista-vehiculo3d ${className}`}>
      {encontrado ? (
        <figure className="vista-vehiculo3d__escena" key="modelo">
          <Visor3D
            modelo={encontrado.id}
            poster={urlPoster3D(encontrado.id)}
            etiqueta={`Modelo 3D de la ${encontrado.nombre}. Arrastra para girarla.`}
            zoom={zoom}
          />
          <figcaption className="vista-vehiculo3d__pie" aria-live="polite">
            <span className="vista-vehiculo3d__chip">3D</span>
            {encontrado.nombre}
          </figcaption>
        </figure>
      ) : (
        <div className="vista-vehiculo3d__escena vista-vehiculo3d__respaldo" key="respaldo">
          {tipo === "CARRO" ? <SiluetaCarro /> : <SiluetaMoto />}
          <p aria-live="polite">
            {texto?.trim() ? "Este modelo aún no tiene vista 3D" : "Escribe el modelo para ver su vista 3D"}
          </p>
          <small>Disponible para {DISPONIBLES}.</small>
        </div>
      )}
    </div>
  );
}

/**
 * Atajos para elegir uno de los modelos con vista 3D sin teclearlo. El campo
 * sigue siendo libre: cualquier otro modelo se escribe a mano ("Otro").
 *
 * @param {object} props
 * @param {string} props.valor texto actual del campo modelo
 * @param {(modelo: import("../../config/vehicleModels").ModeloVehiculo) => void} props.onElegir
 */
export function SugerenciasModelo3D({ valor, onElegir }) {
  const actual = resolverModeloVehiculo(valor)?.id;
  return (
    <div className="sugerencias-3d" role="group" aria-label="Modelos con vista 3D">
      <span className="sugerencias-3d__titulo">Con vista 3D</span>
      {MODELOS_VEHICULO.map((m) => (
        <button
          key={m.id}
          type="button"
          className="sugerencias-3d__chip"
          aria-pressed={actual === m.id}
          onClick={() => onElegir(m)}
        >
          {m.corto}
        </button>
      ))}
    </div>
  );
}

/**
 * Miniatura estática para listas: el póster del modelo si lo hay (una imagen,
 * no un canvas por fila) o la silueta genérica.
 *
 * @param {object} props
 * @param {string} props.modelo
 * @param {"MOTO"|"CARRO"} [props.tipo="MOTO"]
 */
export function MiniaturaVehiculo({ modelo, tipo = "MOTO" }) {
  const encontrado = resolverModeloVehiculo(modelo);
  if (!encontrado) {
    return <span className="miniatura-vehiculo miniatura-vehiculo--generica">{tipo === "CARRO" ? <SiluetaCarro /> : <SiluetaMoto />}</span>;
  }
  return (
    <span className="miniatura-vehiculo">
      <img src={urlPoster3D(encontrado.id)} alt={encontrado.nombre} loading="lazy" decoding="async" />
    </span>
  );
}
