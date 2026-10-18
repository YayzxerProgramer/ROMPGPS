import { Component, Suspense, lazy, useCallback, useRef, useState } from "react";
import { cargarVisor, hayWebGL, useCercaDePantalla, usePrefiereMovimientoReducido } from "./soporte3d";
import "../../Styles/Visor3D.css";

const ModelViewer = lazy(cargarVisor);

/** Si el chunk, el .glb o el contexto WebGL fallan, se queda el póster. */
class LimiteError extends Component {
  constructor(props) {
    super(props);
    this.state = { fallo: false };
  }

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error) {
    console.warn("[Visor3D] No se pudo mostrar el modelo 3D; se usa la imagen estática.", error);
    this.props.onFallo();
  }

  render() {
    return this.state.fallo ? null : this.props.children;
  }
}

function IconoGirar() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

/**
 * Visor 3D con carga diferida y respaldo estático.
 *
 * - El canvas solo se monta cuando el contenedor se acerca a la pantalla.
 * - Mientras carga se ve el póster renderizado en Blender, que se funde con
 *   el 3D cuando el primer cuadro está pintado.
 * - Sin WebGL, o si algo falla, el póster queda como imagen definitiva.
 * - Fuera de pantalla deja de renderizar en continuo.
 *
 * @param {object} props
 * @param {string} props.modelo id del modelo (ver models/registro.js)
 * @param {string} props.poster URL del render estático (.webp)
 * @param {string} props.etiqueta descripción accesible del modelo
 * @param {boolean} [props.pista=true] muestra "Arrastra para girar" hasta la primera interacción
 * @param {string} [props.className]
 */
export default function Visor3D({ modelo, poster, etiqueta, pista = true, className = "" }) {
  const contenedor = useRef(null);
  const [webgl] = useState(hayWebGL);
  const reducido = usePrefiereMovimientoReducido();
  const { cerca, visible } = useCercaDePantalla(contenedor);
  const [listoDe, setListoDe] = useState(null);
  const [falloDe, setFalloDe] = useState(null);
  const [interactuado, setInteractuado] = useState(false);

  // Por modelo: si cambia el modelo vuelve el póster hasta que el nuevo carga,
  // y un fallo de un modelo no bloquea a los demás.
  const listo = listoDe === modelo;
  const usar3D = webgl && falloDe !== modelo;
  const alListo = useCallback((id) => setListoDe(id), []);

  const clases = ["visor3d", listo && usar3D ? "visor3d--listo" : "", className].filter(Boolean).join(" ");

  return (
    <div ref={contenedor} className={clases} onPointerDown={() => setInteractuado(true)}>
      {poster && (
        <img
          className="visor3d__poster"
          src={poster}
          alt={usar3D ? "" : etiqueta}
          aria-hidden={usar3D || undefined}
          loading="lazy"
          decoding="async"
          draggable="false"
        />
      )}

      {usar3D && cerca && (
        <LimiteError onFallo={() => setFalloDe(modelo)}>
          <Suspense fallback={null}>
            <ModelViewer
              modelo={modelo}
              etiqueta={etiqueta}
              movimiento={!reducido}
              activo={visible}
              onListo={alListo}
            />
          </Suspense>
        </LimiteError>
      )}

      {usar3D && cerca && !listo && (
        <span className="visor3d__cargando" role="status">
          <span className="visor3d__giro" aria-hidden="true" />
          <span className="visor3d__oculto">Cargando modelo 3D…</span>
        </span>
      )}

      {usar3D && listo && pista && !interactuado && (
        <span className="visor3d__pista" aria-hidden="true">
          <IconoGirar />
          Arrastra para girar
        </span>
      )}
    </div>
  );
}
