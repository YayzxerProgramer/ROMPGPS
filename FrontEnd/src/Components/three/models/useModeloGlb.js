import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";

/**
 * Libera la memoria de GPU de un objeto: geometrías, materiales y texturas.
 * three.js vuelve a subir los datos si el objeto se pinta otra vez, así que
 * es seguro aunque la escena siga en la caché de useGLTF.
 */
export function liberarObjeto(raiz) {
  raiz.traverse((nodo) => {
    if (!nodo.isMesh) return;
    nodo.geometry?.dispose();
    const materiales = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
    for (const material of materiales) {
      if (!material) continue;
      for (const valor of Object.values(material)) {
        if (valor?.isTexture) valor.dispose();
      }
      material.dispose();
    }
  });
}

/**
 * Carga un .glb comprimido con meshopt y devuelve una copia de su escena.
 *
 * Se clona porque el mismo modelo puede estar en dos visores a la vez (la
 * lista y el modal) y un Object3D solo puede tener un padre. Al desmontar se
 * libera la GPU y, salvo `conservarCache`, se saca el GLB de la caché para que
 * las motos que se abren una vez no ocupen memoria el resto de la sesión.
 *
 * @param {string} url
 * @param {{ conservarCache?: boolean }} [opciones]
 */
export default function useModeloGlb(url, { conservarCache = false } = {}) {
  // Sin Draco (no se usa) y con el decodificador meshopt, que va embebido en
  // el bundle: no hay que descargar decodificadores de una CDN.
  const { scene } = useGLTF(url, false, true);
  const escena = useMemo(() => scene.clone(true), [scene]);

  useEffect(
    () => () => {
      liberarObjeto(escena);
      if (!conservarCache) useGLTF.clear(url);
    },
    [escena, url, conservarCache],
  );

  return escena;
}
