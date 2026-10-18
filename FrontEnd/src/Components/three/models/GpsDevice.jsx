import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import useModeloGlb from "./useModeloGlb";
import { crearDisolucion } from "./disolucion";
import { MODELO_GPS, urlModelo3D } from "../../../config/modelos3d";

const URL_GPS = urlModelo3D(MODELO_GPS);

// Única precarga del proyecto: el GPS se ve en la landing y conviene que el
// .glb (140 KB) llegue en paralelo al chunk.
useGLTF.preload(URL_GPS, false, true);

const AMPLITUD_FLOTACION = 0.004; // m: el equipo mide ~15 cm de alto con el cable

// Desvanecido guiado por el scroll, según lo lejos que esté la tarjeta del
// centro de la pantalla (en altos de pantalla): centrada, el equipo está
// armado; al entrar desde abajo se arma desde las partículas y al salir por
// arriba se deshace de abajo arriba.
const UMBRAL_ARMADO = -0.16; // por debajo del campo mínimo: equipo completo
const UMBRAL_DESHECHO = 1.15; // por encima del campo máximo: solo quedan partículas
const DESVIO_ARMADO = 0.12; // hasta aquí del centro, armado del todo
const DESVIO_DESHECHO = 0.6; // desde aquí, deshecho del todo
const AMORTIGUACION = 6; // 1/s: el umbral sigue al scroll sin saltos de la rueda
const TAMANO_PARTICULA = 9; // px a distancia 1 (se multiplica por el pixel ratio)

const suave = (x) => x * x * (3 - 2 * x);

/** Umbral que corresponde a la posición actual del lienzo en la pantalla. */
function umbralPorScroll(lienzo) {
  const caja = lienzo.getBoundingClientRect();
  const alto = window.innerHeight || 1;
  const desvio = Math.abs((caja.top + caja.height / 2 - alto / 2) / alto);
  const avance = Math.min(Math.max((desvio - DESVIO_ARMADO) / (DESVIO_DESHECHO - DESVIO_ARMADO), 0), 1);
  return UMBRAL_ARMADO + (UMBRAL_DESHECHO - UMBRAL_ARMADO) * suave(avance);
}

/**
 * Rastreador GNXIS, réplica del equipo real: flota despacio y, con el scroll,
 * se desvanece en partículas verdes y se vuelve a armar (ver disolucion.js).
 * Con movimiento reducido queda armado y quieto.
 *
 * Nodos del .glb: gps_gnxis > carcasa, impresos (logo y etiqueta).
 *
 * @param {object} props
 * @param {boolean} [props.movimiento=true]
 */
export default function GpsDevice({ movimiento = true }) {
  const escena = useModeloGlb(URL_GPS, { conservarCache: true });
  const flotante = useRef(null);
  const efecto = useRef(null);
  const inicio = useRef(null);
  const umbral = useRef(null);

  // En un efecto y no en el render: modifica la escena (materiales y nube de
  // partículas) y tiene que poder deshacerse al desmontar.
  useLayoutEffect(() => {
    const disolucion = crearDisolucion(escena);
    efecto.current = disolucion;
    return () => {
      disolucion.liberar();
      efecto.current = null;
    };
  }, [escena]);

  useFrame(({ clock, gl }, delta) => {
    const ahora = clock.getElapsedTime();
    if (inicio.current === null) inicio.current = ahora;
    const t = ahora - inicio.current;
    const grupo = flotante.current;
    if (grupo) {
      grupo.position.y = movimiento ? Math.sin(t * 1.1) * AMPLITUD_FLOTACION : 0;
      grupo.rotation.z = movimiento ? Math.sin(t * 0.7) * 0.02 : 0;
    }
    const objetivo = movimiento ? umbralPorScroll(gl.domElement) : UMBRAL_ARMADO;
    umbral.current = umbral.current === null
      ? objetivo
      : umbral.current + (objetivo - umbral.current) * Math.min(1, delta * AMORTIGUACION);
    efecto.current?.actualizar(umbral.current, movimiento ? t : 0, TAMANO_PARTICULA * gl.getPixelRatio());
  });

  return (
    <group ref={flotante}>
      <primitive object={escena} />
    </group>
  );
}
