import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

/*
 * Efecto "desvanecido en partículas" del GPS de la landing.
 *
 * Un campo escalar (altura + ruido simplex) decide qué parte del equipo ya se
 * deshizo: los fragmentos con campo < umbral se descartan y la franja justo
 * por encima del umbral brilla en verde. Las partículas nacen en puntos de la
 * superficie y usan el MISMO campo: aparecen cuando su punto se deshace y se
 * alejan más cuanto más tiempo hace que se deshizo. Al bajar el umbral hacen
 * el camino inverso y el equipo se vuelve a armar.
 *
 * Todo se calcula en el espacio de la raíz del modelo (uRaizInv), así el
 * campo va pegado al equipo aunque el visor lo escale o lo haga flotar.
 */

const VERDE_BORDE = "#8fd477";
const PALETA = [
  ["#a6d993", 0.3],
  ["#7cc267", 0.25],
  ["#b2cea8", 0.2], // verde de la marca
  ["#5a9e4d", 0.16],
  ["#dff4d2", 0.09],
];

const GLSL_CAMPO = /* glsl */ `
  uniform float uAltura;
  vec3 rdMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 rdMod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 rdPermutar(vec4 x) { return rdMod289(((x * 34.0) + 10.0) * x); }
  vec4 rdRaizInv(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  // Ruido simplex 3D (Ashima Arts / Stefan Gustavson, licencia MIT).
  float rdSimplex(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = rdMod289(i);
    vec4 p = rdPermutar(rdPermutar(rdPermutar(
      i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    vec3 ns = 0.142857142857 * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norma = rdRaizInv(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norma.x; p1 *= norma.y; p2 *= norma.z; p3 *= norma.w;
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // 0 en la base y 1 arriba, con un borde irregular de ±12 % de la altura.
  float rdCampo(vec3 p) {
    vec3 q = p * (6.0 / uAltura);
    float ruido = rdSimplex(q) * 0.65 + rdSimplex(q * 2.3 + 7.1) * 0.35;
    return p.y / uAltura + ruido * 0.12;
  }
`;

/** Parchea un material estándar/físico de three: recorte por el campo y borde brillante. */
function aplicarAMaterial(material, uniformes) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uRaizInv;\nvarying vec3 vPosRaiz;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPosRaiz = (uRaizInv * modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vPosRaiz;
        uniform float uUmbral;
        uniform float uAncho;
        uniform float uIntensidadBorde;
        uniform vec3 uColorBorde;
        ${GLSL_CAMPO}`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float rdDistancia = rdCampo(vPosRaiz) - uUmbral;
        if (rdDistancia < 0.0) discard;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rdBrillo = 1.0 - smoothstep(0.0, uAncho, rdDistancia);
        rdBrillo *= rdBrillo;
        totalEmissiveRadiance += mix(uColorBorde, vec3(0.82, 1.0, 0.74), pow(rdBrillo, 6.0))
          * uIntensidadBorde * rdBrillo;`,
      );
  };
  material.customProgramCacheKey = () => "romp-disolucion";
  material.needsUpdate = true;
}

const VERTEX_PARTICULAS = /* glsl */ `
  attribute vec4 aSemilla;
  attribute vec3 aColor;
  attribute float aAmbiente;
  uniform float uUmbral;
  uniform float uTiempo;
  uniform float uTamano;
  uniform vec3 uCentro;
  varying vec3 vColor;
  varying float vAlfa;
  ${GLSL_CAMPO}

  void main() {
    vec3 p = position;
    float alfa;
    if (aAmbiente < 0.5) {
      // Se desprende de la superficie cuando el umbral pasa por su punto.
      float d = uUmbral - rdCampo(p);
      alfa = smoothstep(-0.012, 0.012, d) * (1.0 - smoothstep(0.12, 0.34, d));
      vec3 azar = normalize(aSemilla.xyz - 0.5);
      vec3 radial = normalize(vec3(p.x - uCentro.x, 0.0, p.z - uCentro.z) + azar * 0.7);
      float lejos = max(d, 0.0) * uAltura * 1.7;
      p += (radial * 0.85 + azar * 0.45 + vec3(0.0, 0.25, 0.0)) * lejos;
      float vivo = min(max(d, 0.0) * 12.0, 1.0);
      p += vec3(sin(uTiempo * 1.3 + aSemilla.w * 21.0), cos(uTiempo * 1.1 + aSemilla.w * 13.0),
                sin(uTiempo * 0.9 + aSemilla.w * 7.0)) * uAltura * 0.012 * vivo;
    } else {
      // Polvo verde que flota alrededor del equipo y sube despacio.
      float vuelta = aSemilla.x * 6.2831 + uTiempo * 0.06 * (0.4 + aSemilla.y);
      float radio = uAltura * (0.26 + 0.22 * aSemilla.y);
      float subida = fract(aSemilla.z + uTiempo * 0.012 * (0.5 + aSemilla.w));
      p = uCentro + vec3(cos(vuelta) * radio, (subida - 0.5) * uAltura * 1.1, sin(vuelta) * radio * 0.7);
      alfa = (0.22 + 0.2 * sin(uTiempo * 1.7 + aSemilla.w * 40.0))
        * smoothstep(0.0, 0.15, subida) * (1.0 - smoothstep(0.8, 1.0, subida));
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTamano * (0.45 + aSemilla.w * 1.1) / -mv.z;
    vColor = aColor;
    vAlfa = alfa;
  }
`;

const FRAGMENT_PARTICULAS = /* glsl */ `
  varying vec3 vColor;
  varying float vAlfa;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5 || vAlfa <= 0.0) discard;
    gl_FragColor = vec4(vColor, vAlfa * (1.0 - smoothstep(0.18, 0.5, r)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function colorAlAzar() {
  let x = Math.random();
  for (const [hex, peso] of PALETA) {
    if ((x -= peso) <= 0) return new Color(hex);
  }
  return new Color(PALETA[0][0]);
}

/**
 * Prepara el efecto sobre la copia de la escena del GPS. `liberar` lo deshace
 * por completo (devuelve los materiales originales), así se puede montar y
 * desmontar varias veces sobre la misma copia.
 *
 * @param {import("three").Object3D} escena
 * @param {{ particulas?: number, ambiente?: number }} [opciones]
 * @returns {{ actualizar: (umbral: number, tiempo: number, tamano: number) => void, liberar: () => void }}
 */
export function crearDisolucion(escena, { particulas = 1700, ambiente = 220 } = {}) {
  escena.updateWorldMatrix(true, true);
  const raizInv = new Matrix4().copy(escena.matrixWorld).invert();
  const caja = new Box3().setFromObject(escena, true).applyMatrix4(raizInv);
  const centro = caja.getCenter(new Vector3());
  const altura = caja.max.y - caja.min.y;

  const uniformes = {
    uAltura: { value: altura },
    uUmbral: { value: -1 },
    uAncho: { value: 0.035 },
    uIntensidadBorde: { value: 1.3 },
    uColorBorde: { value: new Color(VERDE_BORDE) },
    uRaizInv: { value: new Matrix4() },
  };

  // Materiales propios (la copia de useGLTF comparte los del caché).
  const mallas = [];
  const originales = [];
  escena.traverse((nodo) => {
    if (!nodo.isMesh) return;
    originales.push([nodo, nodo.material]);
    nodo.material = nodo.material.clone();
    aplicarAMaterial(nodo.material, uniformes);
    mallas.push(nodo);
  });

  // Puntos de partida en la superficie del cuerpo, repartidos por área.
  const cuerpo = mallas.filter((m) => !/impresos/.test(m.parent?.name ?? "") && !/impresos/.test(m.name));
  const muestreadores = cuerpo.map((malla) => {
    const muestreador = new MeshSurfaceSampler(malla).build();
    const area = muestreador.distribution[muestreador.distribution.length - 1];
    return { malla, muestreador, area };
  });
  const areaTotal = muestreadores.reduce((suma, m) => suma + m.area, 0);
  const total = particulas + ambiente;
  const posiciones = new Float32Array(total * 3);
  const semillas = new Float32Array(total * 4);
  const colores = new Float32Array(total * 3);
  const deAmbiente = new Float32Array(total);
  const punto = new Vector3();
  const aRaiz = new Matrix4();
  let i = 0;
  for (const { malla, muestreador, area } of muestreadores) {
    aRaiz.multiplyMatrices(raizInv, malla.matrixWorld);
    const cuantas = Math.round((particulas * area) / areaTotal);
    for (let k = 0; k < cuantas && i < particulas; k += 1, i += 1) {
      muestreador.sample(punto);
      punto.applyMatrix4(aRaiz).toArray(posiciones, i * 3);
    }
  }
  for (; i < total; i += 1) {
    // El polvo calcula su posición en el shader: aquí basta un punto dentro
    // del equipo para no agrandar la caja que usa el encuadre.
    centro.toArray(posiciones, i * 3);
    deAmbiente[i] = i >= particulas ? 1 : 0;
  }
  for (let n = 0; n < total; n += 1) {
    for (let c = 0; c < 4; c += 1) semillas[n * 4 + c] = Math.random();
    colorAlAzar().toArray(colores, n * 3);
  }

  const geometria = new BufferGeometry();
  geometria.setAttribute("position", new BufferAttribute(posiciones, 3));
  geometria.setAttribute("aSemilla", new BufferAttribute(semillas, 4));
  geometria.setAttribute("aColor", new BufferAttribute(colores, 3));
  geometria.setAttribute("aAmbiente", new BufferAttribute(deAmbiente, 1));
  const material = new ShaderMaterial({
    uniforms: {
      ...uniformes,
      uTiempo: { value: 0 },
      uTamano: { value: 9 },
      uCentro: { value: centro },
    },
    vertexShader: VERTEX_PARTICULAS,
    fragmentShader: FRAGMENT_PARTICULAS,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const nube = new Points(geometria, material);
  nube.name = "particulas_disolucion";
  nube.frustumCulled = false;
  nube.renderOrder = 2;
  escena.add(nube);

  return {
    actualizar(umbral, tiempo, tamano) {
      uniformes.uUmbral.value = umbral;
      escena.updateWorldMatrix(true, false);
      uniformes.uRaizInv.value.copy(escena.matrixWorld).invert();
      material.uniforms.uTiempo.value = tiempo;
      material.uniforms.uTamano.value = tamano;
    },
    liberar() {
      escena.remove(nube);
      geometria.dispose();
      material.dispose();
      for (const [malla, original] of originales) {
        malla.material.dispose();
        malla.material = original;
      }
    },
  };
}
