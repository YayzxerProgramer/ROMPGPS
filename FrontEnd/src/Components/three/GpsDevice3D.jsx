import { useEffect } from "react";
import Visor3D from "./Visor3D";
import { alQuedarOcioso, cargarModeloGps, cargarVisor, hayWebGL } from "./soporte3d";
import { MODELO_GPS, urlPoster3D } from "../../config/vehicleModels";

/**
 * Rastreador GNXIS en 3D para la sección Producto de la landing.
 *
 * No compite con el LCP (que está en el Hero): el chunk 3D y el .glb se
 * descargan cuando la página ya cargó y el navegador está ocioso, y el canvas
 * se monta al acercarse a la sección. Hasta entonces se ve el póster.
 */
export default function GpsDevice3D() {
  useEffect(() => {
    // Sin WebGL se queda el póster: no tiene sentido descargar three.js.
    if (!hayWebGL()) return undefined;
    return alQuedarOcioso(() => {
      // Precarga silenciosa: si falla, el visor lo reintentará al montarse.
      cargarVisor().catch(() => {});
      cargarModeloGps().catch(() => {});
    });
  }, []);

  return (
    <Visor3D
      modelo={MODELO_GPS}
      poster={urlPoster3D(MODELO_GPS)}
      etiqueta="Rastreador GPS GNXIS en 3D, con su cable y el arnés de conexión. Arrastra para girarlo."
      className="visor3d--gps"
    />
  );
}
