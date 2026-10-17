import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import useModeloGlb from "./useModeloGlb";

const NODOS_RUEDA = ["rueda_delantera", "rueda_trasera"];

/**
 * Base común de las tres motos. Los .glb comparten la misma estructura de
 * nodos (ver tools/blender/piezas_moto.py), así que un solo componente sirve
 * para todas; BoxerCt100, TvsRaider125 y Pulsar200 solo fijan la URL.
 *
 * Nodos: chasis, motor, escape, carroceria, asiento, direccion,
 * faro_delantero, luz_trasera, [suspension_trasera],
 * rueda_delantera > rueda_delantera_malla, rueda_trasera > rueda_trasera_malla.
 * Las ruedas son pivotes en su eje: girar su rotation.x las hace rodar.
 *
 * @param {object} props
 * @param {string} props.url
 * @param {boolean} [props.movimiento=true] false con prefers-reduced-motion
 * @param {boolean} [props.girarRuedas=false] simula avance
 * @param {number} [props.velocidad=2.5] rad/s
 */
export default function ModeloMoto({ url, movimiento = true, girarRuedas = false, velocidad = 2.5 }) {
  const escena = useModeloGlb(url);
  const raiz = useRef(null);

  useFrame((_, delta) => {
    if (!movimiento || !girarRuedas || !raiz.current) return;
    for (const nombre of NODOS_RUEDA) {
      const rueda = raiz.current.getObjectByName(nombre);
      // Rotación positiva en X: la parte alta de la rueda avanza hacia +Z (el frente).
      if (rueda) rueda.rotation.x += delta * velocidad;
    }
  });

  return (
    <group ref={raiz}>
      <primitive object={escena} />
    </group>
  );
}
