"""
Calibra la cámara de cada foto de referencia y superpone el modelo sobre ella.

Sirve para modelar "contra la foto" y no a ojo: con la cámara de la foto
resuelta, el render del modelo cae encima de la referencia y se ve exactamente
dónde sobra o falta forma.

    blender -b --factory-startup --python tools/blender/calibrar.py -- <modelo> [--resolver] [--salida DIR]

  <modelo>     id del modelo (boxer-ct100, tvs-raider-125, pulsar-200, gps-device)
  --resolver   vuelve a resolver la cámara a partir de las correspondencias
  --salida     carpeta para las imágenes de comparación (por defecto build/calibracion)

Lee referencias/<modelo>.json:
  imagen    ruta a la foto (relativa a la raíz del repo)
  objetivo  punto 3D al que mira la cámara (m, ejes de Blender)
  puntos    [{nombre, p3d: [x, y, z], px: [u, v], peso}]
  curvas    [{nombre, centro, radio, eje: "X", px: [[u, v], ...], peso}]
            puntos de la foto que deben caer sobre la proyección de un
            círculo 3D (contorno de rines y neumáticos)
  camara    {azimut, elevacion, giro, distancia, focal_px, cx, cy}  (resultado)

Genera en la carpeta de salida:
  <modelo>-superpuesta.png  foto + modelo semitransparente + puntos
  <modelo>-siluetas.png     gris: coinciden · rojo: solo foto · cian: solo modelo
y escribe el IoU de las siluetas.
"""

import json
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import comun as c  # noqa: E402


# ── Modelo de cámara (pinhole con punto principal libre) ────────────────────

def base_camara(azimut, elevacion, giro):
    """Ejes (derecha, arriba, adelante) en coordenadas de Blender."""
    direccion = np.array(c.direccion_camara(azimut, elevacion))  # objetivo → cámara
    adelante = -direccion
    derecha = np.cross(adelante, [0.0, 0.0, 1.0])
    derecha /= np.linalg.norm(derecha)
    arriba = np.cross(derecha, adelante)
    g = math.radians(giro)
    derecha_g = derecha * math.cos(g) + arriba * math.sin(g)
    arriba_g = -derecha * math.sin(g) + arriba * math.cos(g)
    return derecha_g, arriba_g, adelante, direccion


def proyectar(puntos, cam, objetivo):
    derecha, arriba, adelante, direccion = base_camara(cam["azimut"], cam["elevacion"], cam["giro"])
    centro = np.array(objetivo) + direccion * cam["distancia"]
    d = np.asarray(puntos, dtype=float) - centro
    z = d @ adelante
    u = cam["cx"] + cam["focal_px"] * (d @ derecha) / z
    v = cam["cy"] - cam["focal_px"] * (d @ arriba) / z
    return np.stack([u, v], axis=-1)


def retroproyectar(px, cam, objetivo, plano_x):
    """Punto 3D de la foto: rayo de la cámara por el píxel ∩ plano x = plano_x.

    Con la cámara calibrada, cualquier punto de la foto que esté en un plano
    conocido (el plano central de la moto, el del escape...) se mide en metros.
    """
    derecha, arriba, adelante, direccion = base_camara(cam["azimut"], cam["elevacion"], cam["giro"])
    centro = np.array(objetivo) + direccion * cam["distancia"]
    u, v = px
    rayo = adelante + derecha * (u - cam["cx"]) / cam["focal_px"] - arriba * (v - cam["cy"]) / cam["focal_px"]
    t = (plano_x - centro[0]) / rayo[0]
    return centro + rayo * t


def circulo(centro, radio, eje="X", n=240):
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    cx, cy, cz = centro
    if eje == "X":
        return np.stack([np.full(n, cx), cy + radio * np.cos(a), cz + radio * np.sin(a)], axis=-1)
    if eje == "Y":
        return np.stack([cx + radio * np.cos(a), np.full(n, cy), cz + radio * np.sin(a)], axis=-1)
    return np.stack([cx + radio * np.cos(a), cy + radio * np.sin(a), np.full(n, cz)], axis=-1)


CLAVES = ["azimut", "elevacion", "giro", "distancia", "focal_px", "cx", "cy"]


def residuos(vector, datos):
    cam = dict(zip(CLAVES, vector))
    cam.update(datos.get("fijar", {}))
    salida = []
    for p in datos["puntos"]:
        if p.get("peso", 1.0) <= 0:
            continue
        uv = proyectar([p["p3d"]], cam, datos["objetivo"])[0]
        salida.extend((uv - np.array(p["px"])) * p.get("peso", 1.0))
    for curva in datos.get("curvas", []):
        poli = proyectar(circulo(curva["centro"], curva["radio"], curva.get("eje", "X")), cam, datos["objetivo"])
        for px in curva["px"]:
            distancia = np.min(np.linalg.norm(poli - np.array(px), axis=1))
            salida.append(distancia * curva.get("peso", 1.0))
    # Puntos de fuga: deshacen la ambigüedad de altura de cámara que dejan los
    # puntos coplanares (todos los de las ruedas están en el plano central).
    for fuga in datos.get("fugas", []):
        d = np.array(fuga["direccion"], dtype=float)
        lejos = np.array(datos["objetivo"]) + d * 1e5
        uv = proyectar([lejos], cam, datos["objetivo"])[0]
        medido = np.array(fuga["px"], dtype=float)
        escala = max(np.linalg.norm(medido - np.array([cam["cx"], cam["cy"]])), 1.0)
        salida.extend((uv - medido) / escala * 400 * fuga.get("peso", 1.0))
    return np.array(salida)


def resolver(datos, ancho, alto):
    inicial = datos.get("camara") or {}
    x = np.array([
        inicial.get("azimut", 55.0), inicial.get("elevacion", 10.0), inicial.get("giro", 0.0),
        inicial.get("distancia", 4.0), inicial.get("focal_px", 1.4 * max(ancho, alto)),
        inicial.get("cx", ancho / 2), inicial.get("cy", alto / 2),
    ])
    lam = 1e-2
    error = np.sum(residuos(x, datos) ** 2)
    pasos = np.array([0.05, 0.05, 0.05, 0.005, 2.0, 0.5, 0.5])
    for _ in range(300):
        r = residuos(x, datos)
        J = np.zeros((len(r), len(x)))
        for j in range(len(x)):
            dx = np.zeros(len(x))
            dx[j] = pasos[j]
            J[:, j] = (residuos(x + dx, datos) - r) / pasos[j]
        A = J.T @ J
        g = J.T @ r
        mejora = False
        for _ in range(12):
            delta = np.linalg.solve(A + lam * np.diag(np.diag(A) + 1e-9), -g)
            candidato = x + delta
            nuevo = np.sum(residuos(candidato, datos) ** 2)
            if nuevo < error:
                x, error, lam, mejora = candidato, nuevo, max(lam / 3, 1e-7), True
                break
            lam *= 4
        if not mejora or np.linalg.norm(delta) < 1e-6:
            break
    cam = dict(zip(CLAVES, (float(v) for v in x)))
    cam.update(datos.get("fijar", {}))
    rms = math.sqrt(error / max(len(residuos(x, datos)), 1))
    return cam, rms


# ── Imágenes ─────────────────────────────────────────────────────────────────

def leer_imagen(ruta):
    img = bpy.data.images.load(ruta, check_existing=False)
    ancho, alto = img.size
    buf = np.empty(ancho * alto * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    # Blender guarda las filas de abajo arriba.
    return buf.reshape(alto, ancho, 4)[::-1].copy()


def guardar_imagen(ruta, rgba):
    alto, ancho = rgba.shape[:2]
    img = bpy.data.images.new(os.path.basename(ruta), ancho, alto, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(rgba[::-1]).astype(np.float32).ravel())
    img.filepath_raw = ruta
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def marcar(rgba, uv, color, radio=5):
    alto, ancho = rgba.shape[:2]
    u, v = int(round(uv[0])), int(round(uv[1]))
    for d in range(-radio, radio + 1):
        for (x, y) in ((u + d, v), (u, v + d)):
            if 0 <= x < ancho and 0 <= y < alto:
                rgba[y, x, :3] = color
                rgba[y, x, 3] = 1.0


def mascara_referencia(ref):
    if ref[..., 3].min() < 0.5:  # PNG/WebP con transparencia
        return ref[..., 3] > 0.5
    # Fondo blanco de estudio: todo lo que no sea casi blanco (la sombra del
    # suelo queda fuera porque es muy clara).
    return np.min(ref[..., :3], axis=-1) < 0.86


# ── Escena ───────────────────────────────────────────────────────────────────

def importar_modelo(modelo):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ruta = os.path.join(c.DIR_BUILD, f"{modelo}.glb")
    if not os.path.exists(ruta):
        raise SystemExit(f"No existe {ruta}: ejecuta antes el script del modelo con --sin-render")
    bpy.ops.import_scene.gltf(filepath=ruta)


def render_modelo(cam, objetivo, ancho, alto, ruta, fotorrealista=False):
    escena = bpy.context.scene
    if fotorrealista:
        from mathutils import Vector as V
        escena.render.engine = "CYCLES"
        escena.cycles.device = "GPU" if c._activar_gpu() != "CPU" else "CPU"
        escena.cycles.samples = 128
        escena.cycles.use_denoising = True
        escena.view_settings.view_transform = "AgX"
        mundo = bpy.data.worlds.new("mundo")
        escena.world = mundo
        fondo = next(n for n in mundo.node_tree.nodes if n.type == "BACKGROUND")
        # Estudio con banderas negras: el fondo blanco de la foto no se refleja
        # en la laca (por eso los negros de la foto son negros). El blanco se
        # pone al componer.
        fondo.inputs["Color"].default_value = (0.03, 0.03, 0.03, 1)
        fondo.inputs["Strength"].default_value = 1.0
        escena.render.film_transparent = True
        minimo, maximo = c.caja_escena()
        c.estudio((minimo + maximo) / 2, max(maximo - minimo), verde=False)
        c._atrapasombras(max(maximo - minimo))
    else:
        escena.render.engine = "BLENDER_WORKBENCH"
        escena.display.shading.light = "STUDIO"
        escena.display.shading.color_type = "MATERIAL"
        escena.display.shading.show_cavity = True
    escena.render.resolution_x, escena.render.resolution_y = ancho, alto
    escena.render.resolution_percentage = 100
    escena.render.film_transparent = True
    escena.render.image_settings.file_format = "PNG"
    escena.render.image_settings.color_mode = "RGBA"

    derecha, arriba, adelante, direccion = base_camara(cam["azimut"], cam["elevacion"], cam["giro"])
    posicion = np.array(objetivo) + direccion * cam["distancia"]
    datos = bpy.data.cameras.new("calibracion")
    datos.sensor_fit = "HORIZONTAL"
    datos.lens_unit = "FOV"
    datos.angle = 2 * math.atan(ancho / (2 * cam["focal_px"]))
    mayor = max(ancho, alto)
    datos.shift_x = -(cam["cx"] - ancho / 2) / mayor
    datos.shift_y = (cam["cy"] - alto / 2) / mayor
    datos.clip_start, datos.clip_end = 0.01, 100
    obj = bpy.data.objects.new("calibracion", datos)
    escena.collection.objects.link(obj)
    from mathutils import Matrix, Vector
    m = Matrix((
        (derecha[0], arriba[0], -adelante[0], posicion[0]),
        (derecha[1], arriba[1], -adelante[1], posicion[1]),
        (derecha[2], arriba[2], -adelante[2], posicion[2]),
        (0, 0, 0, 1),
    ))
    obj.matrix_world = m
    escena.camera = obj
    escena.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    return Vector(posicion)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not args:
        raise SystemExit(__doc__)
    modelo = args[0]
    salida = os.path.join(c.DIR_BUILD, "calibracion")
    if "--salida" in args:
        salida = os.path.abspath(args[args.index("--salida") + 1])
    os.makedirs(salida, exist_ok=True)

    ruta_json = os.path.join(c.DIR_HERRAMIENTAS, "referencias", f"{modelo}.json")
    with open(ruta_json, encoding="utf-8") as f:
        datos = json.load(f)
    if "--medir" in args:
        # --medir <plano_x> u,v u,v ...  → coordenadas 3D (m) de esos píxeles.
        i = args.index("--medir")
        plano = float(args[i + 1])
        for par in args[i + 2:]:
            if "," not in par:
                break
            u, v = (float(x) for x in par.split(","))
            p = retroproyectar((u, v), datos["camara"], datos["objetivo"], plano)
            print(f"[medir] px ({u:.0f}, {v:.0f}) en x={plano:+.3f} → y={p[1]:+.4f}  z={p[2]:+.4f}")
        return

    ref = leer_imagen(os.path.join(c.RAIZ_REPO, datos["imagen"]))
    alto, ancho = ref.shape[:2]

    if "--resolver" in args or not datos.get("camara"):
        cam, rms = resolver(datos, ancho, alto)
        datos["camara"] = {k: round(v, 4) for k, v in cam.items()}
        with open(ruta_json, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=2)
        print(f"[calibrar] cámara resuelta (error RMS {rms:.2f} px): {datos['camara']}")
    cam = datos["camara"]

    importar_modelo(modelo)
    if "--fotorrealista" in args:
        ruta = os.path.join(salida, f"{modelo}-cycles.png")
        render_modelo(cam, datos["objetivo"], ancho, alto, ruta, fotorrealista=True)
        render = leer_imagen(ruta)
        blanco = np.ones_like(render)
        compuesto = render.copy()
        compuesto[..., :3] = render[..., :3] * render[..., 3:4] + blanco[..., :3] * (1 - render[..., 3:4])
        compuesto[..., 3] = 1.0
        foto = ref.copy()
        foto[..., :3] = ref[..., :3] * ref[..., 3:4] + (1 - ref[..., 3:4])
        foto[..., 3] = 1.0
        guardar_imagen(os.path.join(salida, f"{modelo}-comparacion.png"), np.concatenate([foto, compuesto], axis=1))
        print(f"[calibrar] comparación: {os.path.join(salida, f'{modelo}-comparacion.png')}")
        return
    ruta_render = os.path.join(salida, f"{modelo}-render.png")
    render_modelo(cam, datos["objetivo"], ancho, alto, ruta_render)
    modelo_rgba = leer_imagen(ruta_render)

    # Superpuesta: foto + modelo al 60 % + correspondencias.
    alfa = modelo_rgba[..., 3:4] * 0.6
    superpuesta = ref.copy()
    superpuesta[..., :3] = ref[..., :3] * (1 - alfa) + modelo_rgba[..., :3] * alfa
    superpuesta[..., 3] = 1.0
    for p in datos["puntos"]:
        marcar(superpuesta, p["px"], (0.1, 0.9, 0.2))
        marcar(superpuesta, proyectar([p["p3d"]], cam, datos["objetivo"])[0], (1.0, 0.1, 0.2), 4)
    for curva in datos.get("curvas", []):
        for px in curva["px"]:
            marcar(superpuesta, px, (0.1, 0.9, 0.2), 3)
        for uv in proyectar(circulo(curva["centro"], curva["radio"], curva.get("eje", "X"), 90), cam,
                            datos["objetivo"]):
            marcar(superpuesta, uv, (1.0, 0.85, 0.1), 1)
    guardar_imagen(os.path.join(salida, f"{modelo}-superpuesta.png"), superpuesta)

    # Siluetas.
    m_ref = mascara_referencia(ref)
    m_mod = modelo_rgba[..., 3] > 0.5
    siluetas = np.ones((alto, ancho, 4), dtype=np.float32)
    siluetas[m_ref & m_mod, :3] = (0.55, 0.55, 0.55)
    siluetas[m_ref & ~m_mod, :3] = (0.95, 0.15, 0.15)
    siluetas[~m_ref & m_mod, :3] = (0.1, 0.75, 0.9)
    guardar_imagen(os.path.join(salida, f"{modelo}-siluetas.png"), siluetas)
    iou = np.sum(m_ref & m_mod) / max(np.sum(m_ref | m_mod), 1)
    print(f"[calibrar] IoU de siluetas: {iou:.3f}  (solo foto {np.sum(m_ref & ~m_mod)} px · "
          f"solo modelo {np.sum(~m_ref & m_mod)} px)")
    for p in datos["puntos"]:
        uv = proyectar([p["p3d"]], cam, datos["objetivo"])[0]
        print(f"[calibrar]   {p['nombre']:<24} foto {p['px']}  modelo [{uv[0]:.0f}, {uv[1]:.0f}]  "
              f"desvío {np.linalg.norm(uv - np.array(p['px'])):.1f} px")


if __name__ == "__main__":
    main()
