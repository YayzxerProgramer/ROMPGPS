import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Box3, MathUtils, Vector3 } from "three";
import { MODELOS_3D } from "./models/registro";

/*
 * Visor 3D reutilizable. Es el único módulo que importa three/R3F/drei y se
 * carga con React.lazy desde Visor3D.jsx: la landing y los paneles no pagan
 * ese peso hasta que hace falta.
 */

const FOV = 30; // mismo campo de visión vertical que los pósters de Blender
const MARGEN = 1.06;
const ARRIBA = new Vector3(0, 1, 0);
const PAUSA_TRAS_INTERACCION_MS = 3500;
const VERDE_MARCA = "#b2cea8";

/** Dirección objetivo → cámara. Igual que `direccion_camara` de tools/blender/comun.py. */
function direccionCamara(azimut, elevacion) {
  const az = MathUtils.degToRad(azimut);
  const el = MathUtils.degToRad(elevacion);
  return new Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/** Vértices en coordenadas de mundo, como array plano [x, y, z, ...]. */
function verticesMundo(raiz) {
  const puntos = [];
  const v = new Vector3();
  raiz.traverse((nodo) => {
    const posiciones = nodo.isMesh ? nodo.geometry.attributes.position : null;
    if (!posiciones) return;
    for (let i = 0; i < posiciones.count; i += 1) {
      v.fromBufferAttribute(posiciones, i).applyMatrix4(nodo.matrixWorld);
      puntos.push(v.x, v.y, v.z);
    }
  });
  return puntos;
}

/**
 * Distancia mínima para que todos los vértices quepan en cámara mirando a
 * `centro`. Es la fórmula de `distancia_encuadre` en comun.py, por eso el
 * primer cuadro del 3D coincide con el póster.
 */
function distanciaEncuadre(puntos, centro, direccion, fovVertical, aspecto) {
  const adelante = direccion.clone().negate();
  const derecha = adelante.clone().cross(ARRIBA).normalize();
  const arriba = derecha.clone().cross(adelante).normalize();
  const tanV = Math.tan(MathUtils.degToRad(fovVertical) / 2);
  const tanH = tanV * aspecto;
  const rel = new Vector3();
  let distancia = 0;
  for (let i = 0; i < puntos.length; i += 3) {
    rel.set(puntos[i] - centro.x, puntos[i + 1] - centro.y, puntos[i + 2] - centro.z);
    const profundidad = rel.dot(direccion);
    distancia = Math.max(
      distancia,
      profundidad + Math.abs(rel.dot(derecha)) / tanH,
      profundidad + Math.abs(rel.dot(arriba)) / tanV,
    );
  }
  return distancia * MARGEN;
}

/**
 * Normaliza el modelo (lado mayor = 1 y apoyado en y = 0, así sombras y
 * límites de cámara valen para el GPS de 18 cm y para una moto de 2 m) y
 * coloca la cámara para encuadrarlo. Avisa con `onListo` tras el primer cuadro.
 */
function Encuadre({ vista, onListo, children }) {
  const grupo = useRef(null);
  const avisado = useRef(false);
  const obtener = useThree((estado) => estado.get);
  const ancho = useThree((estado) => estado.size.width);
  const alto = useThree((estado) => estado.size.height);
  // Los controles se registran después del primer layout: se suscribe a
  // ellos solo para volver a fijar su objetivo cuando aparecen.
  const hayControles = useThree((estado) => Boolean(estado.controls));

  useLayoutEffect(() => {
    const nodo = grupo.current;
    if (!nodo || !ancho || !alto) return;
    nodo.scale.setScalar(1);
    nodo.position.set(0, 0, 0);
    nodo.updateWorldMatrix(true, true);
    const caja = new Box3().setFromObject(nodo, true);
    if (caja.isEmpty()) return;
    const tamano = caja.getSize(new Vector3());
    const centro = caja.getCenter(new Vector3());
    const escala = 1 / Math.max(tamano.x, tamano.y, tamano.z);
    nodo.scale.setScalar(escala);
    nodo.position.set(-centro.x * escala, -caja.min.y * escala, -centro.z * escala);
    nodo.updateWorldMatrix(true, true);

    const objetivo = new Vector3(0, (tamano.y * escala) / 2, 0);
    const direccion = direccionCamara(vista.azimut, vista.elevacion);
    const { camera, controls, invalidate } = obtener();
    const distancia = distanciaEncuadre(verticesMundo(nodo), objetivo, direccion, camera.fov, ancho / alto);
    camera.position.copy(objetivo).addScaledVector(direccion, distancia);
    camera.near = distancia / 100;
    camera.far = distancia * 10;
    camera.updateProjectionMatrix();
    camera.lookAt(objetivo);
    if (controls) {
      controls.target.copy(objetivo);
      controls.minDistance = distancia * 0.65;
      controls.maxDistance = distancia * 1.5;
      controls.update();
    }
    invalidate();
  }, [vista, ancho, alto, obtener, hayControles]);

  useFrame(() => {
    if (avisado.current || !grupo.current) return;
    avisado.current = true;
    // El aviso va al siguiente cuadro del navegador: este ya se habrá pintado.
    requestAnimationFrame(() => onListo?.());
  });

  return <group ref={grupo}>{children}</group>;
}

/** OrbitControls limitados: sin desplazar, sin pasar bajo el suelo y con
 *  auto-rotación que se pausa mientras el usuario interactúa. */
function Controles({ movimiento, zoom }) {
  const [interactuando, setInteractuando] = useState(false);
  const temporizador = useRef(null);

  useEffect(() => {
    const t = temporizador;
    return () => window.clearTimeout(t.current);
  }, []);

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableZoom={zoom}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      autoRotate={movimiento && !interactuando}
      autoRotateSpeed={0.6}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.48}
      onStart={() => {
        window.clearTimeout(temporizador.current);
        setInteractuando(true);
      }}
      onEnd={() => {
        temporizador.current = window.setTimeout(() => setInteractuando(false), PAUSA_TRAS_INTERACCION_MS);
      }}
    />
  );
}

/** Luces y entorno procedural (sin descargar HDRIs): caja de luz cenital,
 *  tira lateral para los reflejos del cromo y contraluz verde de la marca. */
function Iluminacion() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, 2.5, -3]} intensity={1.1} color={VERDE_MARCA} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 1]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-5, 1.5, 2]} rotation-y={Math.PI / 2} scale={[1.2, 6, 1]} />
        <Lightformer form="rect" intensity={1} position={[5, 1, -3]} rotation-y={-Math.PI / 2} scale={[3, 5, 1]}
          color={VERDE_MARCA} />
        <Lightformer form="ring" intensity={0.6} position={[0, 2, -6]} scale={3} />
      </Environment>
    </>
  );
}

/** Mantiene la etiqueta accesible del <canvas> al cambiar de modelo. */
function EtiquetaLienzo({ etiqueta }) {
  const gl = useThree((estado) => estado.gl);
  useEffect(() => {
    gl.domElement.setAttribute("role", "img");
    gl.domElement.setAttribute("aria-label", etiqueta);
  }, [gl, etiqueta]);
  return null;
}

/**
 * @param {object} props
 * @param {keyof typeof MODELOS_3D} props.modelo id del modelo ("gps-device", "boxer-ct100", ...)
 * @param {string} props.etiqueta aria-label del canvas
 * @param {boolean} [props.movimiento=true] false con prefers-reduced-motion: sin auto-rotación ni animaciones
 * @param {boolean} [props.activo=true] false fuera de pantalla: el render pasa a bajo demanda
 * @param {boolean} [props.zoom=false] rueda/pellizco para acercar (limitado)
 * @param {(modelo: string) => void} [props.onListo] primer cuadro pintado del modelo
 */
export default function ModelViewer({ modelo, etiqueta, movimiento = true, activo = true, zoom = false, onListo }) {
  const definicion = MODELOS_3D[modelo];
  if (!definicion) throw new Error(`Modelo 3D desconocido: ${modelo}`);
  const { Componente, vista } = definicion;

  return (
    <Canvas
      className="visor3d__lienzo"
      style={{ position: "absolute", inset: 0 }}
      dpr={[1, 2]}
      frameloop={activo && movimiento ? "always" : "demand"}
      camera={{ fov: FOV, near: 0.01, far: 100, position: [0, 0.5, 3] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <EtiquetaLienzo etiqueta={etiqueta} />
      <Iluminacion />
      <Controles movimiento={movimiento} zoom={zoom} />
      {/* La clave reinicia el encuadre y la sombra al cambiar de moto sin
          crear otro canvas (un solo contexto WebGL por vista). */}
      <Suspense key={modelo} fallback={null}>
        <Encuadre vista={vista} onListo={() => onListo?.(modelo)}>
          <Componente movimiento={movimiento} />
        </Encuadre>
        {/* Una sola pasada: la cámara orbita, el modelo no, así que la
            sombra no cambia y no hay que recalcularla cada cuadro. */}
        <ContactShadows position={[0, 0.0005, 0]} scale={2.4} far={0.9} blur={2.4} opacity={0.65} resolution={512}
          frames={1} color="#000000" />
      </Suspense>
    </Canvas>
  );
}
