"""
Compara el GPS con la foto del equipo real (FrontEnd/img-blender/gps real.jpg).

Renderiza el equipo tumbado desde los dos ángulos de la foto (cara del logo
con el cable a la derecha y cara de la etiqueta con el cable a la izquierda),
con cámara ortográfica a la misma escala en píxeles que la foto, y compone
foto / render / superposición al 50 % en build/calibracion/gps-<vista>.png.

    blender --background --factory-startup --python tools/blender/comparar_gps.py [-- <muestras>]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import comun as c  # noqa: E402
import gps_device as g  # noqa: E402

FOTO = os.path.join(c.RAIZ_REPO, "FrontEnd", "img-blender", "gps real.jpg")
SALIDA = os.path.join(c.DIR_BUILD, "calibracion")

# Medidas de la foto (px): caja del equipo y recorte de cada vista.
VISTAS = {
    # cara del logo: la caja mide 490 px de largo y su centro está en (423, 134,5)
    "logo": {"largo_px": 490, "centro": (423, 134.5), "recorte": (150, 10, 1110, 260), "desde_arriba": True},
    # cara de la etiqueta: 523 px de largo, centro en (858,5, 577,5)
    "etiqueta": {"largo_px": 523, "centro": (858.5, 577.5), "recorte": (30, 440, 1150, 730), "desde_arriba": False},
}


def preparar_escena(muestras):
    escena = bpy.context.scene
    escena.render.engine = "CYCLES"
    escena.cycles.device = "GPU" if c._activar_gpu() != "CPU" else "CPU"
    escena.cycles.samples = muestras
    escena.cycles.use_denoising = True
    escena.view_settings.view_transform = "Standard"
    escena.render.film_transparent = False
    escena.render.image_settings.file_format = "PNG"

    # Fondo blanco para la cámara (el de la foto) y gris para la iluminación.
    mundo = bpy.data.worlds.new("mundo_foto")
    escena.world = mundo
    if mundo.node_tree is None:
        mundo.use_nodes = True
    nodos, enlaces = mundo.node_tree.nodes, mundo.node_tree.links
    gris = next(n for n in nodos if n.type == "BACKGROUND")
    gris.inputs["Color"].default_value = (0.25, 0.25, 0.25, 1)
    blanco = nodos.new("ShaderNodeBackground")
    blanco.inputs["Color"].default_value = (1, 1, 1, 1)
    camino = nodos.new("ShaderNodeLightPath")
    mezcla = nodos.new("ShaderNodeMixShader")
    enlaces.new(camino.outputs["Is Camera Ray"], mezcla.inputs[0])
    enlaces.new(gris.outputs[0], mezcla.inputs[1])
    enlaces.new(blanco.outputs[0], mezcla.inputs[2])
    enlaces.new(mezcla.outputs[0], next(n for n in nodos if n.type == "OUTPUT_WORLD").inputs["Surface"])

    luz = bpy.data.lights.new("caja_de_luz", "AREA")
    luz.size = 0.35
    luz.energy = 0.35
    obj_luz = bpy.data.objects.new("caja_de_luz", luz)
    escena.collection.objects.link(obj_luz)
    cam = bpy.data.objects.new("camara_foto", bpy.data.cameras.new("camara_foto"))
    cam.data.type = "ORTHO"
    escena.collection.objects.link(cam)
    escena.camera = cam
    return escena, cam, obj_luz


def a_numpy(imagen):
    """RGB con la fila 0 arriba."""
    ancho, alto = imagen.size
    return np.array(imagen.pixels[:], dtype=np.float32).reshape(alto, ancho, 4)[::-1, :, :3]


def comparar(nombre, vista, escena, cam, luz, foto):
    x0, y0, x1, y1 = vista["recorte"]
    px_m = vista["largo_px"] / g.L
    # Desplazamiento del centro del recorte respecto al centro de la caja: en
    # las dos vistas la foto tiene -X arriba; el cable (+Y) va a la derecha en
    # la del logo y a la izquierda en la de la etiqueta.
    dx_px = (x0 + x1) / 2 - vista["centro"][0]
    dy_px = (y0 + y1) / 2 - vista["centro"][1]
    if vista["desde_arriba"]:
        pos = Vector((dy_px / px_m, dx_px / px_m, 0.5))
        rot = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1)))
    else:
        pos = Vector((dy_px / px_m, -dx_px / px_m, -0.5))
        rot = Matrix(((0, -1, 0), (-1, 0, 0), (0, 0, -1)))
    cam.data.ortho_scale = (x1 - x0) / px_m
    cam.matrix_world = Matrix.Translation(pos) @ rot.to_4x4()
    luz.location = pos * 0.5 + Vector((0.04, 0.0, 0.0))
    luz.rotation_euler = (0, 0, 0) if vista["desde_arriba"] else (3.14159265, 0, 0)
    escena.render.resolution_x, escena.render.resolution_y = (x1 - x0) * 2, (y1 - y0) * 2

    ruta_render = os.path.join(SALIDA, f"gps-{nombre}-render.png")
    escena.render.filepath = ruta_render
    bpy.ops.render.render(write_still=True)
    render = a_numpy(bpy.data.images.load(ruta_render))
    recorte = foto[y0:y1, x0:x1].repeat(2, axis=0).repeat(2, axis=1)
    panel = np.concatenate([recorte, render, recorte * 0.5 + render * 0.5], axis=0)

    alto, ancho = panel.shape[:2]
    salida = bpy.data.images.new(f"gps_{nombre}", ancho, alto)
    rgba = np.ones((alto, ancho, 4), np.float32)
    rgba[..., :3] = panel[::-1]
    salida.pixels.foreach_set(rgba.ravel())
    salida.filepath_raw = os.path.join(SALIDA, f"gps-{nombre}.png")
    salida.file_format = "PNG"
    salida.save()
    print(f"Comparación: {salida.filepath_raw}")


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    muestras = int(args[0]) if args else 48
    os.makedirs(SALIDA, exist_ok=True)
    g.modelar()
    escena, cam, luz = preparar_escena(muestras)
    foto = a_numpy(bpy.data.images.load(FOTO))
    for nombre, vista in VISTAS.items():
        comparar(nombre, vista, escena, cam, luz, foto)


if __name__ == "__main__":
    main()
