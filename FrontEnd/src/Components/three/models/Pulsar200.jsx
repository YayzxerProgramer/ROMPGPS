import ModeloMoto from "./ModeloMoto";
import { urlModelo3D } from "../../../config/vehicleModels";

const URL_MODELO = urlModelo3D("pulsar-200");

/**
 * Bajaj Pulsar NS 200 (public/models/pulsar-200.glb, generado por tools/blender/pulsar_200.py).
 *
 * @param {object} props
 * @param {boolean} [props.movimiento=true] false con prefers-reduced-motion
 * @param {boolean} [props.girarRuedas=false]
 * @param {number} [props.velocidad]
 */
export default function Pulsar200(props) {
  return <ModeloMoto url={URL_MODELO} {...props} />;
}
