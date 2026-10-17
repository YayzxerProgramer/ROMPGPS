import ModeloMoto from "./ModeloMoto";
import { urlModelo3D } from "../../../config/vehicleModels";

const URL_MODELO = urlModelo3D("tvs-raider-125");

/**
 * TVS Raider 125 (public/models/tvs-raider-125.glb, generado por tools/blender/tvs_raider_125.py).
 *
 * @param {object} props
 * @param {boolean} [props.movimiento=true] false con prefers-reduced-motion
 * @param {boolean} [props.girarRuedas=false]
 * @param {number} [props.velocidad]
 */
export default function TvsRaider125(props) {
  return <ModeloMoto url={URL_MODELO} {...props} />;
}
