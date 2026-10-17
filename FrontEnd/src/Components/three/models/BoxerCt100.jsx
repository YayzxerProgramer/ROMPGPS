import ModeloMoto from "./ModeloMoto";
import { urlModelo3D } from "../../../config/vehicleModels";

const URL_MODELO = urlModelo3D("boxer-ct100");

/**
 * Bajaj Boxer CT 100 (public/models/boxer-ct100.glb, generado por tools/blender/boxer_ct100.py).
 *
 * @param {object} props
 * @param {boolean} [props.movimiento=true] false con prefers-reduced-motion
 * @param {boolean} [props.girarRuedas=false]
 * @param {number} [props.velocidad]
 */
export default function BoxerCt100(props) {
  return <ModeloMoto url={URL_MODELO} {...props} />;
}
