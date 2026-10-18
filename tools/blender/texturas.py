"""
Texturas procedurales repetibles (tileables) para los materiales PBR.

Todo se genera con numpy en el propio build: no hay imágenes binarias
versionadas y el resultado es determinista (semillas fijas). El ruido se
filtra en frecuencia con FFT, así que es periódico por construcción y las
texturas se repiten sin costuras.

Las texturas se aplican con UV en metros (las primitivas generan UV así) y
la escala de cada material dice cuántas veces se repite por metro. El
exportador glTF lo convierte en KHR_texture_transform.
"""

import math

import bpy
import numpy as np

import comun as c


# ── Ruido y mapas ────────────────────────────────────────────────────────────

def ruido(n, sigma_px, semilla=0, anisotropia=(1.0, 1.0)):
    """Ruido gaussiano periódico n×n (media 0, desviación 1).

    sigma_px: tamaño del grano en píxeles. anisotropia (ax, ay) alarga el grano
    (ax > ay → vetas horizontales, como el aluminio cepillado).
    """
    rng = np.random.default_rng(semilla)
    blanco = rng.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * anisotropia[1]
    fx = np.fft.fftfreq(n)[None, :] * anisotropia[0]
    filtro = np.exp(-2 * (math.pi * sigma_px) ** 2 * (fx ** 2 + fy ** 2))
    r = np.real(np.fft.ifft2(np.fft.fft2(blanco) * filtro))
    r -= r.mean()
    return r / (r.std() + 1e-9)


def normal_desde_altura(altura, fuerza=1.0):
    """Mapa de normales (convención OpenGL, la de glTF) desde una altura."""
    dx = (np.roll(altura, -1, axis=1) - np.roll(altura, 1, axis=1)) * 0.5
    dy = (np.roll(altura, -1, axis=0) - np.roll(altura, 1, axis=0)) * 0.5
    n = np.stack([-dx * fuerza, -dy * fuerza, np.ones_like(altura)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def imagen(nombre, datos, no_color=True):
    """Crea una imagen empaquetada desde un array (alto, ancho, 3|4) en 0..1.

    La fila 0 del array es la de ABAJO (convención de Blender y de UV)."""
    datos = np.clip(datos, 0.0, 1.0).astype(np.float32)
    alto, ancho = datos.shape[:2]
    if datos.shape[2] == 3:
        datos = np.concatenate([datos, np.ones((alto, ancho, 1), np.float32)], axis=-1)
    existente = bpy.data.images.get(nombre)
    if existente is not None:
        return existente
    img = bpy.data.images.new(nombre, ancho, alto, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color" if no_color else "sRGB"
    img.pixels.foreach_set(datos.ravel())
    img.pack()
    return img


# ── Catálogo ─────────────────────────────────────────────────────────────────

def grano_molde(n=256):
    """Punteado de molde erosionado (acabado VDI) de carcasas de ABS: el
    "mate con brillitos" de la cara del logo del GPS en la foto."""
    h = ruido(n, 1.3, 81) * 0.7 + ruido(n, 3.2, 82) * 0.3
    return imagen("normal_molde", normal_desde_altura(h, 0.5))


# ── Materiales PBR con texturas ──────────────────────────────────────────────

def _nodo_textura(arbol, imagen, escala, coord=None):
    """Nodo de imagen con escala en repeticiones por unidad de UV (m)."""
    tex = arbol.nodes.new("ShaderNodeTexImage")
    tex.image = imagen
    tex.interpolation = "Linear"
    if escala != (1.0, 1.0):
        mapeo = arbol.nodes.new("ShaderNodeMapping")
        mapeo.vector_type = "POINT"
        mapeo.inputs["Scale"].default_value = (escala[0], escala[1], 1.0)
        uv = coord or arbol.nodes.new("ShaderNodeUVMap")
        arbol.links.new(uv.outputs["UV"], mapeo.inputs["Vector"])
        arbol.links.new(mapeo.outputs["Vector"], tex.inputs["Vector"])
    return tex


def material_pbr(nombre, color, metal=0.0, rugosidad=0.5, normal=None, escala=(1.0, 1.0),
                 fuerza_normal=1.0, capa=0.0, capa_rugosidad=0.05, capa_normal=None, emision=None,
                 fuerza_emision=1.0, transmision=0.0, ior=1.5, especular=0.5):
    """Principled BSDF con mapa de normales opcional (repetible)."""
    mat = c.material(nombre, color, metal=metal, rugosidad=rugosidad, capa=capa, capa_rugosidad=capa_rugosidad,
                     emision=emision, fuerza_emision=fuerza_emision)
    arbol = mat.node_tree
    bsdf = next(n for n in arbol.nodes if n.type == "BSDF_PRINCIPLED")
    if "IOR" in bsdf.inputs:
        bsdf.inputs["IOR"].default_value = ior
    entrada = bsdf.inputs.get("Specular IOR Level")
    if entrada is not None:
        entrada.default_value = especular
    if transmision:
        bsdf.inputs["Transmission Weight"].default_value = transmision
    if normal is not None:
        tex = _nodo_textura(arbol, normal, escala)
        tex.image.colorspace_settings.name = "Non-Color"
        mapa = arbol.nodes.new("ShaderNodeNormalMap")
        mapa.inputs["Strength"].default_value = fuerza_normal
        arbol.links.new(tex.outputs["Color"], mapa.inputs["Color"])
        arbol.links.new(mapa.outputs["Normal"], bsdf.inputs["Normal"])
    if capa_normal is not None and "Coat Normal" in bsdf.inputs:
        tex = _nodo_textura(arbol, capa_normal, escala)
        mapa = arbol.nodes.new("ShaderNodeNormalMap")
        mapa.inputs["Strength"].default_value = 1.0
        arbol.links.new(tex.outputs["Color"], mapa.inputs["Color"])
        arbol.links.new(mapa.outputs["Normal"], bsdf.inputs["Coat Normal"])
    return mat
