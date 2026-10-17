import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import useModeloGlb from "./useModeloGlb";
import { MODELO_GPS, urlModelo3D } from "../../../config/vehicleModels";

const URL_GPS = urlModelo3D(MODELO_GPS);

// Única precarga del proyecto: el GPS se ve en la landing y conviene que el
// .glb (60 KB) llegue en paralelo al chunk. Las motos se cargan bajo demanda.
useGLTF.preload(URL_GPS, false, true);

const AMPLITUD_FLOTACION = 0.004; // m: el equipo mide ~18 cm de alto
// El exportador normaliza el color emisivo: en three la intensidad del .glb es ~1,4.
const INTENSIDAD_LED_FIJA = 1.4;

/** Parpadeo tipo rastreador: destello corto cada 1,6 s con un pulso doble. */
function brilloLed(t) {
  const fase = t % 1.6;
  const pulso = (centro) => Math.exp(-(((fase - centro) / 0.06) ** 2));
  return 0.15 + 2.6 * Math.max(pulso(0.1), pulso(0.32) * 0.6);
}

/**
 * Rastreador GNXIS: flota despacio y su LED de estado parpadea en el verde
 * de la marca. Con movimiento reducido queda quieto y con el LED fijo.
 *
 * Nodos del .glb: gps_gnxis > carcasa, led_estado > led_estado_malla, arnes.
 *
 * @param {object} props
 * @param {boolean} [props.movimiento=true]
 */
export default function GpsDevice({ movimiento = true }) {
  const escena = useModeloGlb(URL_GPS, { conservarCache: true, materialesPropios: ["led_estado"] });
  const flotante = useRef(null);
  // Material propio del LED (clonado en useModeloGlb): se anima vía ref.
  const led = useRef(null);

  useEffect(() => {
    let material = null;
    escena.getObjectByName("led_estado")?.traverse((nodo) => {
      if (nodo.isMesh) material = nodo.material;
    });
    led.current = material;
  }, [escena]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const grupo = flotante.current;
    if (grupo) {
      grupo.position.y = movimiento ? Math.sin(t * 1.1) * AMPLITUD_FLOTACION : 0;
      grupo.rotation.z = movimiento ? Math.sin(t * 0.7) * 0.02 : 0;
    }
    const material = led.current;
    if (material) material.emissiveIntensity = movimiento ? brilloLed(t) : INTENSIDAD_LED_FIJA;
  });

  return (
    <group ref={flotante}>
      <primitive object={escena} />
    </group>
  );
}
