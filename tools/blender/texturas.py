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

def grano_plastico(n=256):
    """Plástico texturizado (carenados mate, mandos, guardabarros interiores)."""
    h = ruido(n, 0.9, 11) * 0.7 + ruido(n, 2.5, 12) * 0.3
    return imagen("normal_plastico", normal_desde_altura(h, 0.35))


def grano_cuero(n=512):
    """Polipiel del asiento: poro fino con arrugas suaves."""
    poro = ruido(n, 1.1, 21)
    celdas = np.abs(ruido(n, 4.0, 22))
    h = poro * 0.45 - celdas * 0.8 + ruido(n, 14.0, 23) * 0.4
    return imagen("normal_cuero", normal_desde_altura(h, 0.55))


def aluminio_cepillado(n=256):
    h = ruido(n, 0.7, 31, anisotropia=(0.05, 1.0))
    return imagen("normal_cepillado", normal_desde_altura(h, 0.22))


def aluminio_fundido(n=256):
    """Superficie de fundición (cárter, culata): granallado fino."""
    h = ruido(n, 0.8, 41) * 0.8 + ruido(n, 3.0, 42) * 0.2
    return imagen("normal_fundido", normal_desde_altura(h, 0.3))


def piel_naranja(n=256):
    """Ondulación de la laca (efecto piel de naranja): reflejos de pintura real."""
    h = ruido(n, 6.0, 51)
    return imagen("normal_laca", normal_desde_altura(h, 0.06))


def estrias_puno(n=256):
    """Puños de goma: estrías en diamante."""
    y, x = np.mgrid[0:n, 0:n] / n
    h = np.sin(2 * math.pi * (x * 8 + y * 8)) + np.sin(2 * math.pi * (x * 8 - y * 8))
    h = np.clip(h, -0.4, 2.0) + ruido(n, 1.0, 61) * 0.15
    return imagen("normal_puno", normal_desde_altura(h, 0.8))


def dibujo_neumatico(tipo, ancho=512, alto=256):
    """Dibujo de la banda de rodadura. u (columnas) = sentido de giro, una
    repetición; v (filas) = perfil del neumático de talón a talón (0..1), con
    la banda de rodadura en el centro y los flancos lisos.

    tipo: "costillas" (Boxer delantera), "tacos" (Boxer trasera) o
    "deportivo" (Raider y Pulsar: surcos en ángulo alternados).
    """
    v, u = np.mgrid[0:alto, 0:ancho].astype(np.float64)
    u /= ancho
    v /= alto
    banda = np.clip(1 - np.abs(v - 0.5) / 0.23, 0, 1)  # 1 en la corona, 0 en los flancos
    corona = banda > 0
    h = np.zeros_like(u)
    w = (v - 0.5) / 0.23  # -1..1 a lo ancho de la banda

    def surco(distancia, ancho_surco):
        return np.exp(-(distancia / ancho_surco) ** 2)

    if tipo == "costillas":
        for centro in (-0.62, -0.2, 0.2, 0.62):
            zig = centro + 0.05 * np.sin(2 * math.pi * u * 2)
            h -= surco(w - zig, 0.06)
    elif tipo == "tacos":
        for fila in range(2):
            desfase = 0.5 * fila
            fase = (u * 2 + desfase) % 1.0
            lado = 1 if fila == 0 else -1
            bloque = (np.abs(fase - 0.5) < 0.32) & (lado * w > 0.08) & (lado * w < 0.95)
            h += bloque * 0.9
        h -= surco(w, 0.05) * 0.6
        h = h - 0.9
    else:  # deportivo
        for lado, desfase in ((1, 0.0), (-1, 0.5)):
            # Surco curvo que nace cerca del centro y sale hacia el hombro.
            t = (u * 2 + desfase) % 1.0
            recorrido = lado * w
            curva = 0.12 + recorrido * 0.38 + 0.08 * recorrido ** 2
            dentro = (recorrido > 0.15) & (recorrido < 0.92)
            h -= surco(t - curva, 0.035) * dentro
    h *= corona
    h += ruido(alto, 1.2, 71)[:, :1].repeat(ancho, 1) * 0.0  # sin ruido: banda limpia
    normal = normal_desde_altura(h, 6.0)
    return imagen(f"normal_neumatico_{tipo}", normal)


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
