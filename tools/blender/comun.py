"""
Utilidades compartidas por los scripts de modelado de ROMP GPS.

Se ejecutan dentro de Blender en modo headless (probado con Blender 5.2 LTS,
compatible con 4.2+):

    blender --background --factory-startup --python tools/blender/<modelo>.py

Todo el modelado se hace por código (bmesh) para que cada .glb sea
reproducible: no hay .blend versionados ni pasos manuales.

Convenciones (Blender es Z arriba; el exportador glTF lo convierte a Y arriba):
  * Unidades en metros, escala real.
  * El frente del modelo mira a -Y en Blender, que es +Z en glTF.
  * El lado derecho del piloto es -X (escape de las motos).
  * El origen está en la base: el suelo es z = 0.
  * Las piezas animables son un Empty con nombre (pivote) y su malla como hija,
    así la compresión (que reescribe las transformaciones de las mallas) nunca
    mueve el eje de giro de las ruedas.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

DIR_HERRAMIENTAS = os.path.dirname(os.path.abspath(__file__))
RAIZ_REPO = os.path.abspath(os.path.join(DIR_HERRAMIENTAS, "..", ".."))
DIR_BUILD = os.path.join(DIR_HERRAMIENTAS, "build")
DIR_PREVIEWS = os.path.join(RAIZ_REPO, "FrontEnd", "public", "models", "previews")

EJE_X = Vector((1.0, 0.0, 0.0))

# Paleta de la marca: verde pastoso y negros verdosos.
VERDE_MARCA = "#b2cea8"
FONDO_MARCA = "#0d0f0d"


# ── Argumentos y escena ──────────────────────────────────────────────────────

def argumentos():
    """Lee las opciones que van después de `--` en la línea de Blender."""
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opciones = {"render": True, "salida": DIR_BUILD, "previews": DIR_PREVIEWS, "azimut": None}
    i = 0
    while i < len(args):
        if args[i] == "--sin-render":
            opciones["render"] = False
        elif args[i] == "--salida" and i + 1 < len(args):
            opciones["salida"] = os.path.abspath(args[i + 1])
            i += 1
        elif args[i] == "--azimut" and i + 1 < len(args):
            # Solo para revisar el modelo desde otro ángulo.
            opciones["azimut"] = float(args[i + 1])
            i += 1
        elif args[i] == "--previews" and i + 1 < len(args):
            opciones["previews"] = os.path.abspath(args[i + 1])
            i += 1
        i += 1
    return opciones


def nueva_escena():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    escena = bpy.context.scene
    escena.unit_settings.system = "METRIC"
    escena.unit_settings.scale_length = 1.0
    return escena


# ── Materiales PBR (metallic/roughness, lo que entiende glTF) ────────────────

def hex_lineal(color):
    """'#rrggbb' en sRGB → RGBA lineal, que es lo que esperan los nodos."""
    color = color.lstrip("#")
    canales = [int(color[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]

    def lineal(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (*[lineal(c) for c in canales], 1.0)


def _entrada(nodo, *nombres):
    for nombre in nombres:
        if nombre in nodo.inputs:
            return nodo.inputs[nombre]
    return None


def material(nombre, color, metal=0.0, rugosidad=0.5, capa=0.0, capa_rugosidad=0.08,
             emision=None, fuerza_emision=1.0):
    """Principled BSDF con los parámetros que exporta glTF.

    `capa` es el clearcoat (KHR_materials_clearcoat): da el brillo de pintura
    lacada al tanque sin necesitar texturas.
    """
    mat = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    if mat.node_tree is None:
        mat.use_nodes = True
    nodos = mat.node_tree.nodes
    bsdf = next((n for n in nodos if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodos.new("ShaderNodeBsdfPrincipled")
        salida = next((n for n in nodos if n.type == "OUTPUT_MATERIAL"), None) \
            or nodos.new("ShaderNodeOutputMaterial")
        mat.node_tree.links.new(bsdf.outputs["BSDF"], salida.inputs["Surface"])

    rgba = hex_lineal(color)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rugosidad
    entrada_capa = _entrada(bsdf, "Coat Weight", "Clearcoat")
    if entrada_capa is not None:
        entrada_capa.default_value = capa
        rug = _entrada(bsdf, "Coat Roughness", "Clearcoat Roughness")
        if rug is not None:
            rug.default_value = capa_rugosidad
    if emision:
        col = _entrada(bsdf, "Emission Color", "Emission")
        col.default_value = hex_lineal(emision)
        bsdf.inputs["Emission Strength"].default_value = fuerza_emision

    mat.diffuse_color = rgba
    mat.metallic = metal
    mat.roughness = rugosidad
    return mat


# ── Utilidades de geometría ──────────────────────────────────────────────────

def matriz(pos=(0, 0, 0), rot=(0, 0, 0), escala=None):
    """Traslación · rotación (grados, XYZ) · escala."""
    m = Matrix.Translation(Vector(pos)) @ Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
    if escala is not None:
        m = m @ Matrix.Diagonal((*escala, 1.0))
    return m


def _vincular(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def sombrear(obj, angulo=40.0):
    """Sombreado suave con aristas duras por ángulo.

    Equivale a "Shade Auto Smooth" pero sin depender del modificador de
    nodos (que en modo headless no está disponible en todas las versiones).
    El exportador glTF parte las normales en las aristas marcadas.
    """
    malla_obj = obj.data
    bm = bmesh.new()
    bm.from_mesh(malla_obj)
    bm.normal_update()
    limite = math.radians(angulo)
    for cara in bm.faces:
        cara.smooth = True
    for arista in bm.edges:
        if len(arista.link_faces) == 2:
            arista.smooth = arista.calc_face_angle(0.0) < limite
        else:
            arista.smooth = False
    bm.to_mesh(malla_obj)
    bm.free()


def malla(nombre, bm, mat=None, angulo=40.0, recalcular=True):
    """Convierte un bmesh en objeto de la escena con material y sombreado."""
    if recalcular:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    datos = bpy.data.meshes.new(nombre)
    bm.to_mesh(datos)
    bm.free()
    obj = _vincular(bpy.data.objects.new(nombre, datos))
    if mat is not None:
        datos.materials.append(mat)
    sombrear(obj, angulo)
    return obj


def _biselar(bm, ancho, segmentos, angulo_min=None):
    if ancho <= 0:
        return
    bm.normal_update()
    aristas = bm.edges[:]
    if angulo_min is not None:
        limite = math.radians(angulo_min)
        aristas = [a for a in aristas if len(a.link_faces) == 2 and a.calc_face_angle(0.0) >= limite]
    if not aristas:
        return
    bmesh.ops.bevel(
        bm, geom=aristas, offset=ancho, offset_type="OFFSET", segments=segmentos,
        profile=0.5, affect="EDGES", clamp_overlap=True,
    )


# ── Primitivas ───────────────────────────────────────────────────────────────

def caja(nombre, dims, pos=(0, 0, 0), rot=(0, 0, 0), mat=None, bisel=0.0, segmentos=2, angulo=40.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(dims), verts=bm.verts)
    _biselar(bm, bisel, segmentos)
    bmesh.ops.transform(bm, matrix=matriz(pos, rot), verts=bm.verts)
    return malla(nombre, bm, mat, angulo)


def cilindro(nombre, radio, largo, pos=(0, 0, 0), rot=(0, 0, 0), mat=None, lados=16,
             radio2=None, bisel=0.0, segmentos=1, eje="Z"):
    """Cilindro (o tronco de cono) centrado en `pos` y orientado según `eje`."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=lados,
        radius1=radio, radius2=radio if radio2 is None else radio2, depth=largo,
    )
    _biselar(bm, bisel, segmentos, angulo_min=60)
    orientar = {"Z": (0, 0, 0), "X": (0, 90, 0), "Y": (90, 0, 0)}[eje]
    bmesh.ops.transform(bm, matrix=matriz(pos, rot) @ matriz(rot=orientar), verts=bm.verts)
    return malla(nombre, bm, mat)


def esfera(nombre, radio, pos=(0, 0, 0), rot=(0, 0, 0), mat=None, segmentos=16, anillos=8, escala=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segmentos, v_segments=anillos, radius=radio)
    bmesh.ops.transform(bm, matrix=matriz(pos, rot, escala), verts=bm.verts)
    return malla(nombre, bm, mat, angulo=60)


def torno(nombre, perfil, pos=(0, 0, 0), rot=(0, 0, 0), mat=None, lados=32, cerrado=False,
          eje="Z", angulo=40.0):
    """Revoluciona un perfil [(radio, altura), ...] alrededor del eje local Z.

    Con `cerrado` el perfil es un lazo (sección de un neumático). Si no, va de
    eje a eje y los extremos con radio 0 se cierran en un vértice.
    """
    bm = bmesh.new()
    anillos = []
    for r, h in perfil:
        if r <= 1e-6:
            anillos.append([bm.verts.new((0.0, 0.0, h))])
            continue
        anillos.append([
            bm.verts.new((r * math.cos(2 * math.pi * k / lados), r * math.sin(2 * math.pi * k / lados), h))
            for k in range(lados)
        ])

    def unir_anillos(a, b):
        if len(a) == 1 and len(b) == 1:
            return
        if len(a) == 1:
            for k in range(lados):
                bm.faces.new((a[0], b[k], b[(k + 1) % lados]))
        elif len(b) == 1:
            for k in range(lados):
                bm.faces.new((a[k], b[0], a[(k + 1) % lados]))
        else:
            for k in range(lados):
                j = (k + 1) % lados
                bm.faces.new((a[k], b[k], b[j], a[j]))

    for i in range(len(anillos) - 1):
        unir_anillos(anillos[i], anillos[i + 1])
    if cerrado:
        unir_anillos(anillos[-1], anillos[0])
    else:
        # Extremos con radio > 0 se tapan con una cara plana.
        if len(anillos[0]) > 1:
            bm.faces.new(anillos[0])
        if len(anillos[-1]) > 1:
            bm.faces.new(list(reversed(anillos[-1])))

    orientar = {"Z": (0, 0, 0), "X": (0, 90, 0), "Y": (90, 0, 0)}[eje]
    bmesh.ops.transform(bm, matrix=matriz(pos, rot) @ matriz(rot=orientar), verts=bm.verts)
    return malla(nombre, bm, mat, angulo)


def catmull_rom(puntos, sub=8, cerrado=False):
    """Interpolación Catmull-Rom uniforme de una polilínea (2D o 3D)."""
    pts = [Vector(p) for p in puntos]
    if sub <= 1 or len(pts) < 3:
        return pts
    if cerrado:
        ext = [pts[-1]] + pts + [pts[0], pts[1]]
        tramos = len(pts)
    else:
        ext = [pts[0] + (pts[0] - pts[1])] + pts + [pts[-1] + (pts[-1] - pts[-2])]
        tramos = len(pts) - 1
    salida = []
    for i in range(1, tramos + 1):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(sub):
            t = k / sub
            t2, t3 = t * t, t * t * t
            salida.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                                 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not cerrado:
        salida.append(pts[-1])
    return salida


def _parametro_longitud(pts):
    acumulado = [0.0]
    for a, b in zip(pts, pts[1:]):
        acumulado.append(acumulado[-1] + (b - a).length)
    total = acumulado[-1] or 1.0
    return [d / total for d in acumulado]


def _monotona(xs, ys):
    """Interpolador cúbico monótono (Fritsch-Carlson): sin sobrepasos."""
    n = len(xs)
    if n == 1:
        return lambda x: ys[0]
    d = [(ys[k + 1] - ys[k]) / ((xs[k + 1] - xs[k]) or 1e-9) for k in range(n - 1)]
    m = [d[0]] + [0.0 if d[k - 1] * d[k] <= 0 else (d[k - 1] + d[k]) / 2 for k in range(1, n - 1)] + [d[-1]]
    for k in range(n - 1):
        if d[k] == 0:
            m[k] = m[k + 1] = 0.0
            continue
        a, b = m[k] / d[k], m[k + 1] / d[k]
        s = a * a + b * b
        if s > 9:
            t = 3 / math.sqrt(s)
            m[k], m[k + 1] = t * a * d[k], t * b * d[k]

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        k = max(i for i in range(n - 1) if xs[i] <= x)
        h = xs[k + 1] - xs[k]
        t = (x - xs[k]) / h
        h00 = (1 + 2 * t) * (1 - t) ** 2
        h10 = t * (1 - t) ** 2
        h01 = t * t * (3 - 2 * t)
        h11 = t * t * (t - 1)
        return h00 * ys[k] + h10 * h * m[k] + h01 * ys[k + 1] + h11 * h * m[k + 1]

    return f


def _superelipse(c, s, n):
    return math.copysign(abs(c) ** (2.0 / n), c), math.copysign(abs(s) ** (2.0 / n), s)


def barrido(nombre, camino_yz, perfil, mat=None, x=0.0, lados=24, sub=8, tapas=True, angulo=40.0, comba=0.0):
    """Barre una sección de superelipse a lo largo de un camino en el plano YZ.

    Sirve para tanque, asiento, colín, guardabarros y silenciador: piezas
    orgánicas que una caja biselada no resuelve.

    perfil: claves (u, semiancho, alto_exterior, alto_interior, n[, n_inferior])
      u ∈ [0, 1] a lo largo del camino. El "exterior" es el lado X × tangente;
      para un camino que va del frente (-Y) hacia atrás (+Y) es hacia arriba.
      n = 2 es elipse; valores mayores son secciones más cuadradas.
    comba: cuánto caen los bordes laterales hacia el interior (m). Convierte la
      sección en un arco que abraza la rueda (guardabarros).
    """
    pts = catmull_rom([Vector((x, y, z)) for y, z in camino_yz], sub)
    us = _parametro_longitud(pts)
    claves = sorted(perfil, key=lambda k: k[0])
    xs = [k[0] for k in claves]
    interp = [_monotona(xs, [k[i] for k in claves]) for i in range(1, 5)]
    interp_n_inf = _monotona(xs, [k[5] if len(k) > 5 else k[4] for k in claves])

    bm = bmesh.new()
    anillos = []
    for i, p in enumerate(pts):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == len(pts) - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        t.normalize()
        arriba = EJE_X.cross(t).normalized()
        u = us[i]
        semiancho, alto_ext, alto_int = (max(f(u), 1e-4) for f in interp[:3])
        n_sup = max(interp[3](u), 0.5)
        n_inf = max(interp_n_inf(u), 0.5)
        anillo = []
        for k in range(lados):
            a = 2 * math.pi * k / lados
            c, s = math.cos(a), math.sin(a)
            lx, lz = _superelipse(c, s, n_sup if s >= 0 else n_inf)
            alto = alto_ext if s >= 0 else alto_int
            caida = comba * lx * lx
            anillo.append(bm.verts.new(p + EJE_X * (lx * semiancho) + arriba * (lz * alto - caida)))
        anillos.append(anillo)

    for a, b in zip(anillos, anillos[1:]):
        for k in range(lados):
            j = (k + 1) % lados
            bm.faces.new((a[k], a[j], b[j], b[k]))
    if tapas:
        bm.faces.new(list(reversed(anillos[0])))
        bm.faces.new(anillos[-1])
    return malla(nombre, bm, mat, angulo)


def tubo(nombre, puntos, radio, mat=None, lados=8, sub=8, tapas=True, angulo=50.0, cerrado=False):
    """Tubo de sección circular a lo largo de un camino 3D.

    Usa marcos de transporte paralelo para que el tubo no se retuerza en las
    curvas (chasis, manubrio, cables). `radio` puede ser una función de u.
    Con `cerrado` el camino es un lazo (cadena) y no lleva tapas.
    """
    pts = catmull_rom(puntos, sub, cerrado=cerrado)
    if cerrado:
        pts.append(pts[0].copy())
    us = _parametro_longitud(pts)
    radio_en = radio if callable(radio) else (lambda _u: radio)

    bm = bmesh.new()
    t0 = (pts[1] - pts[0]).normalized()
    normal = t0.orthogonal().normalized()
    anillos = []
    for i, p in enumerate(pts):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == len(pts) - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        t.normalize()
        normal = (normal - t * normal.dot(t))
        if normal.length < 1e-8:
            normal = t.orthogonal()
        normal.normalize()
        binormal = t.cross(normal)
        r = radio_en(us[i])
        if cerrado and i == len(pts) - 1:
            anillos.append(anillos[0])  # el lazo se suelda con el primer anillo
            break
        anillos.append([
            bm.verts.new(p + (normal * math.cos(2 * math.pi * k / lados) + binormal * math.sin(2 * math.pi * k / lados)) * r)
            for k in range(lados)
        ])
    for a, b in zip(anillos, anillos[1:]):
        for k in range(lados):
            j = (k + 1) % lados
            bm.faces.new((a[k], a[j], b[j], b[k]))
    if tapas and not cerrado:
        bm.faces.new(list(reversed(anillos[0])))
        bm.faces.new(anillos[-1])
    return malla(nombre, bm, mat, angulo)


def prisma(nombre, perfil_yz, x0, x1, mat=None, bisel=0.0, segmentos=2, sub=0, espejo=False, angulo=40.0):
    """Extruye un polígono del plano YZ entre x0 y x1 (paneles laterales,
    carenados, quilla, portaplaca). Con `sub` > 1 el contorno se suaviza."""
    contorno = catmull_rom([Vector((0.0, y, z)) for y, z in perfil_yz], sub, cerrado=True) if sub > 1 \
        else [Vector((0.0, y, z)) for y, z in perfil_yz]
    bm = bmesh.new()
    a = [bm.verts.new((x0, p.y, p.z)) for p in contorno]
    b = [bm.verts.new((x1, p.y, p.z)) for p in contorno]
    n = len(contorno)
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    _biselar(bm, bisel, segmentos, angulo_min=50)
    obj = malla(nombre, bm, mat, angulo)
    if espejo:
        simetria(obj)
    return obj


def simetria(obj):
    """Añade a la misma malla su copia reflejada en X = 0."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    originales = bm.faces[:]
    dup = bmesh.ops.duplicate(bm, geom=bm.verts[:] + bm.edges[:] + originales)
    verts = [e for e in dup["geom"] if isinstance(e, bmesh.types.BMVert)]
    caras = [e for e in dup["geom"] if isinstance(e, bmesh.types.BMFace)]
    bmesh.ops.scale(bm, vec=(-1.0, 1.0, 1.0), verts=verts)
    bmesh.ops.reverse_faces(bm, faces=caras)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def _a_malla(obj_origen, nombre):
    """Evalúa un objeto (curva, texto, modificadores) y lo cambia por una malla."""
    grafo = bpy.context.evaluated_depsgraph_get()
    datos = bpy.data.meshes.new_from_object(obj_origen.evaluated_get(grafo))
    datos.name = nombre
    nuevo = _vincular(bpy.data.objects.new(nombre, datos))
    nuevo.matrix_world = obj_origen.matrix_world.copy()
    bpy.data.objects.remove(obj_origen, do_unlink=True)
    return nuevo


def _verificar_proyeccion(obj, sobre):
    """Una calcomanía con vértices fuera de la pieza quedaría flotando en el
    aire (la proyección no encontró superficie): mejor fallar con el nombre."""
    esquinas = [sobre.matrix_world @ Vector(e) for e in sobre.bound_box]
    minimo = Vector([min(e[i] for e in esquinas) for i in range(3)]) - Vector((0.004, 0.004, 0.004))
    maximo = Vector([max(e[i] for e in esquinas) for i in range(3)]) + Vector((0.004, 0.004, 0.004))
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        if any(p[i] < minimo[i] or p[i] > maximo[i] for i in range(3)):
            raise RuntimeError(f"{obj.name}: la calcomanía se sale de '{sobre.name}' en {tuple(round(x, 3) for x in p)}")


def _fuente_bold():
    """Fuente sans gruesa del sistema; si no hay, la integrada de Blender."""
    candidatas = [
        r"C:\Windows\Fonts\segoeuiz.ttf",  # Segoe UI Bold Italic
        r"C:\Windows\Fonts\arialbi.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf",
        "/Library/Fonts/Arial Bold Italic.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf",
    ]
    for ruta in candidatas:
        if os.path.exists(ruta):
            try:
                return bpy.data.fonts.load(ruta, check_existing=True)
            except RuntimeError:
                pass
    return None


def texto(nombre, cuerpo, alto, pos=(0, 0, 0), rot=(0, 0, 0), mat=None, inclinacion=0.0,
          extrusion=0.0, sobre=None, separacion=0.0008, resolucion=2, espaciado=1.0):
    """Texto convertido a malla. Con `sobre` se proyecta como calcomanía sobre
    la superficie de otro objeto (shrinkwrap), para seguir la curva del tanque."""
    curva = bpy.data.curves.new(nombre, "FONT")
    curva.body = cuerpo
    curva.size = alto
    curva.align_x = "CENTER"
    curva.align_y = "CENTER"
    curva.extrude = extrusion
    curva.shear = inclinacion
    curva.resolution_u = resolucion
    curva.space_character = espaciado
    fuente = _fuente_bold()
    if fuente is not None:
        curva.font = fuente
    obj = _vincular(bpy.data.objects.new(nombre, curva))
    obj.matrix_world = matriz(pos, rot)
    if sobre is not None:
        # Se proyecta según la normal del texto (su Z local) sobre la pieza.
        mod = obj.modifiers.new("proyectar", "SHRINKWRAP")
        mod.target = sobre
        mod.wrap_method = "PROJECT"
        mod.use_project_z = True
        mod.use_negative_direction = True
        mod.use_positive_direction = False
        mod.wrap_mode = "OUTSIDE_SURFACE"
        mod.offset = separacion
    obj = _a_malla(obj, nombre)
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    if sobre is not None:
        _verificar_proyeccion(obj, sobre)
    if mat is not None:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    obj["calcomania"] = extrusion == 0.0
    sombrear(obj, 60)
    return obj


def cinta(nombre, camino_yz, ancho, lado, sobre, mat=None, sub=6, separacion=0.0009):
    """Franja gráfica (calcomanía) proyectada sobre el costado de `sobre`.

    El camino va en el plano YZ y `lado` es +1 (izquierda, +X) o -1 (derecha).
    Se genera como una tira con muchos segmentos para que pueda doblarse con
    la curvatura del tanque al proyectarla. `ancho` puede ser función de u.
    """
    pts = catmull_rom([Vector((0.0, y, z)) for y, z in camino_yz], sub)
    us = _parametro_longitud(pts)
    ancho_en = ancho if callable(ancho) else (lambda _u: ancho)
    bm = bmesh.new()
    filas = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        normal_plano = Vector((0.0, -t.z, t.y))
        mitad = ancho_en(us[i]) / 2
        base = Vector((lado * 0.6, p.y, p.z))
        filas.append((bm.verts.new(base + normal_plano * mitad), bm.verts.new(base - normal_plano * mitad)))
    for (a0, a1), (b0, b1) in zip(filas, filas[1:]):
        cara = (a0, a1, b1, b0) if lado > 0 else (a0, b0, b1, a1)
        bm.faces.new(cara)
    datos = bpy.data.meshes.new(nombre)
    bm.to_mesh(datos)
    bm.free()
    obj = _vincular(bpy.data.objects.new(nombre, datos))
    # Proyección lateral (no "punto más cercano"): desde lejos, el punto más
    # cercano de un tanque redondeado es siempre su ecuador y la cinta se
    # aplastaría en una línea.
    mod = obj.modifiers.new("proyectar", "SHRINKWRAP")
    mod.target = sobre
    mod.wrap_method = "PROJECT"
    mod.use_project_x = True
    mod.use_negative_direction = lado > 0
    mod.use_positive_direction = lado < 0
    mod.wrap_mode = "OUTSIDE_SURFACE"
    mod.offset = separacion
    obj = _a_malla(obj, nombre)
    _verificar_proyeccion(obj, sobre)
    if mat is not None:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    obj["calcomania"] = True
    sombrear(obj, 60)
    return obj


def mover(objetos, desplazamiento=(0, 0, 0), rot=(0, 0, 0)):
    """Aplica una transformación a la malla de varios objetos."""
    m = matriz(desplazamiento, rot)
    for obj in objetos:
        obj.data.transform(m)
    return objetos


# ── Ensamblado ───────────────────────────────────────────────────────────────

def unir(nombre, objetos):
    """Une varias mallas en un solo objeto (menos draw calls en el visor)."""
    objetos = [o for o in objetos if o is not None]
    capa = bpy.context.view_layer
    for o in capa.objects:
        o.select_set(False)
    for o in objetos:
        o.select_set(True)
    base = objetos[0]
    capa.objects.active = base
    calcomania = all(o.get("calcomania", False) for o in objetos)
    if len(objetos) > 1:
        with bpy.context.temp_override(active_object=base, selected_objects=objetos,
                                       selected_editable_objects=objetos):
            bpy.ops.object.join()
    base.name = nombre
    base.data.name = nombre
    if not calcomania and "calcomania" in base:
        del base["calcomania"]
    base.select_set(False)
    return base


def vacio(nombre, pos=(0, 0, 0), padre=None):
    obj = _vincular(bpy.data.objects.new(nombre, None))
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.05
    obj.location = pos
    if padre is not None:
        obj.parent = padre
    return obj


def colgar(hijo, padre):
    """Emparenta conservando la posición en el mundo (padres sin rotar)."""
    hijo.parent = padre
    hijo.matrix_parent_inverse = padre.matrix_world.inverted()
    return hijo


def pieza_animable(nombre, objetos, pivote, padre):
    """Empty `nombre` en `pivote` con la malla `<nombre>_malla` como hija."""
    pivote = Vector(pivote)
    obj = unir(nombre + "_malla", objetos)
    obj.data.transform(Matrix.Translation(-pivote))
    obj.location = (0, 0, 0)
    eje = vacio(nombre, pivote, padre)
    obj.parent = eje
    return eje


# ── Validación ───────────────────────────────────────────────────────────────

def mallas_escena():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def contar_triangulos():
    total = 0
    for obj in mallas_escena():
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def _cascarones(bm):
    """Componentes conexas de caras."""
    pendientes = set(bm.faces)
    while pendientes:
        semilla = pendientes.pop()
        grupo, pila = [semilla], [semilla]
        while pila:
            cara = pila.pop()
            for arista in cara.edges:
                for vecina in arista.link_faces:
                    if vecina in pendientes:
                        pendientes.remove(vecina)
                        grupo.append(vecina)
                        pila.append(vecina)
        yield grupo


def caras_invertidas():
    """Cuenta cascarones cerrados con volumen negativo (normales hacia dentro)."""
    malos = []
    for obj in mallas_escena():
        if obj.get("calcomania"):
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.transform(obj.matrix_world)
        for grupo in _cascarones(bm):
            aristas = {a for c in grupo for a in c.edges}
            if any(len(a.link_faces) != 2 for a in aristas):
                continue  # abierto: el signo del volumen no significa nada
            volumen = 0.0
            for cara in grupo:
                v = [l.vert.co for l in cara.loops]
                for i in range(1, len(v) - 1):
                    volumen += v[0].dot(v[i].cross(v[i + 1])) / 6.0
            if volumen < -1e-12:
                malos.append(obj.name)
        bm.free()
    return malos


def caja_escena():
    minimo = Vector((1e9, 1e9, 1e9))
    maximo = Vector((-1e9, -1e9, -1e9))
    for obj in mallas_escena():
        for v in obj.data.vertices:
            p = obj.matrix_world @ v.co
            minimo = Vector(map(min, minimo, p))
            maximo = Vector(map(max, maximo, p))
    return minimo, maximo


def validar(nombre, presupuesto):
    """Comprueba presupuesto de triángulos, normales y origen en el suelo."""
    bpy.context.view_layer.update()
    tris = contar_triangulos()
    invertidas = caras_invertidas()
    minimo, maximo = caja_escena()
    dims = maximo - minimo
    print(f"[{nombre}] triángulos: {tris} / {presupuesto}")
    print(f"[{nombre}] dimensiones (m): ancho {dims.x:.3f} · largo {dims.y:.3f} · alto {dims.z:.3f}")
    print(f"[{nombre}] base z = {minimo.z:.4f}")
    errores = []
    if tris > presupuesto:
        errores.append(f"supera el presupuesto: {tris} > {presupuesto} triángulos")
    if invertidas:
        errores.append(f"cascarones con normales invertidas en: {sorted(set(invertidas))}")
    if abs(minimo.z) > 0.002:
        errores.append(f"el modelo no apoya en el suelo (z mínima {minimo.z:.4f})")
    if errores:
        for e in errores:
            print(f"[{nombre}] ERROR: {e}")
        sys.exit(1)
    return tris


# ── Exportación y póster ─────────────────────────────────────────────────────

def exportar_glb(ruta):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=ruta,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,  # texturas repetibles (grano, cepillado, dibujo) y calcomanías
        export_image_format="AUTO",
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
    )
    print(f"GLB exportado: {ruta} ({os.path.getsize(ruta) / 1024:.1f} KB)")


def direccion_camara(azimut, elevacion):
    """Dirección desde el objetivo hacia la cámara, en ejes de Blender.

    azimut 0 = de frente; positivo gira hacia el lado derecho del modelo (-X).
    Debe coincidir con `direccionCamara` de ModelViewer.jsx.
    """
    az, el = math.radians(azimut), math.radians(elevacion)
    return Vector((-math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))


def puntos_escena():
    return [obj.matrix_world @ v.co for obj in mallas_escena() for v in obj.data.vertices]


def distancia_encuadre(puntos, centro, direccion, fov_vertical, aspecto, margen=1.06):
    """Distancia mínima para que todos los vértices quepan en cámara mirando
    a `centro`. Es la misma fórmula que `distanciaEncuadre` de ModelViewer.jsx."""
    adelante = -direccion
    derecha = adelante.cross(Vector((0, 0, 1))).normalized()
    arriba = derecha.cross(adelante).normalized()
    tan_v = math.tan(math.radians(fov_vertical) / 2)
    tan_h = tan_v * aspecto
    d = 0.0
    for p in puntos:
        rel = p - centro
        profundidad = rel.dot(direccion)
        d = max(d, profundidad + abs(rel.dot(derecha)) / tan_h, profundidad + abs(rel.dot(arriba)) / tan_v)
    return d * margen


def _luz_area(nombre, pos, objetivo, potencia, tam, color="#ffffff"):
    datos = bpy.data.lights.new(nombre, "AREA")
    datos.energy = potencia
    datos.size = tam
    datos.color = hex_lineal(color)[:3]
    obj = _vincular(bpy.data.objects.new(nombre, datos))
    obj.location = pos
    obj.rotation_euler = (Vector(objetivo) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
    return obj


def _caja_luz(nombre, pos, tam, fuerza, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(tam[0], tam[1], 1.0), verts=bm.verts)
    obj = malla(nombre, bm, recalcular=False)
    obj.matrix_world = matriz(pos, rot)
    mat = bpy.data.materials.new(nombre)
    if mat.node_tree is None:
        mat.use_nodes = True
    nodos = mat.node_tree.nodes
    for n in list(nodos):
        if n.type != "OUTPUT_MATERIAL":
            nodos.remove(n)
    emision = nodos.new("ShaderNodeEmission")
    emision.inputs["Strength"].default_value = fuerza
    salida = next(n for n in nodos if n.type == "OUTPUT_MATERIAL")
    mat.node_tree.links.new(emision.outputs["Emission"], salida.inputs["Surface"])
    obj.data.materials.append(mat)
    obj.visible_camera = False
    obj.visible_shadow = False
    return obj


def _activar_gpu():
    """Cycles en GPU (OptiX > CUDA > HIP > Metal) si hay; si no, CPU."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except KeyError:
        return "CPU"
    for tipo in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = tipo
        except TypeError:
            continue
        prefs.refresh_devices()
        dispositivos = [d for d in prefs.devices if d.type == tipo]
        if dispositivos:
            for d in prefs.devices:
                d.use = d.type == tipo
            return tipo
    return "CPU"


def estudio(centro, tam, verde=True):
    """Iluminación de estudio de producto, la misma disposición que el
    Environment del visor (ModelViewer.jsx): caja de luz cenital, tira lateral
    del lado de la cámara, contraluz verde de la marca y relleno trasero.
    Las luces de área se ven en los reflejos del cromo y la laca."""
    def area(nombre, pos, tam_xy, potencia, color="#ffffff", forma="RECTANGLE"):
        datos = bpy.data.lights.new(nombre, "AREA")
        datos.shape = forma
        datos.size = tam_xy[0] * tam
        datos.size_y = tam_xy[1] * tam
        datos.energy = potencia * tam * tam
        datos.color = hex_lineal(color)[:3]
        obj = _vincular(bpy.data.objects.new(nombre, datos))
        obj.location = centro + Vector(pos) * tam
        obj.rotation_euler = (centro - obj.location).to_track_quat("-Z", "Y").to_euler()
        return obj

    # Fotografía de producto sobre fondo oscuro: las caras grandes reflejan
    # oscuridad y solo los bordes recogen las tiras de luz.
    area("caja_cenital", (0.4, 0.6, 2.6), (2.2, 1.0), 260)
    area("tira_lateral", (-2.6, -0.4, 0.9), (0.45, 3.0), 170)
    area("tira_frontal", (0.6, -2.8, 1.4), (2.6, 0.35), 90)
    area("contraluz", (2.2, 2.0, 0.8), (1.2, 2.6), 380, VERDE_MARCA if verde else "#ffffff")
    area("relleno_trasero", (-0.6, 3.0, 1.0), (2.0, 2.0), 70, forma="DISK")
    sol = bpy.data.lights.new("clave", "SUN")
    sol.energy = 1.2
    sol.angle = math.radians(6)
    obj = _vincular(bpy.data.objects.new("clave", sol))
    obj.rotation_euler = (Vector((-3, 4, -5))).to_track_quat("-Z", "Y").to_euler()


def _atrapasombras(tam):
    """Suelo que solo recoge la sombra (el PNG queda transparente) y, debajo,
    un suelo blanco invisible a cámara: rebota luz y es lo que reflejan los
    cromos, como el suelo blanco de un estudio de producto."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=tam * 6)
    obj = malla("suelo_sombra", bm, recalcular=False)
    obj.is_shadow_catcher = True
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=tam * 8)
    blanco = malla("suelo_blanco", bm, recalcular=False)
    blanco.location.z = -0.002
    blanco.data.materials.append(material("suelo_estudio", "#e8e8e8", rugosidad=0.6))
    blanco.visible_camera = False
    blanco.visible_shadow = False
    return obj


def render_preview(ruta, ancho, alto, azimut, elevacion, fov=30.0, muestras=160):
    """Render fotorrealista (Cycles) con fondo transparente y sombra en el
    suelo: póster mientras carga el 3D, respaldo sin WebGL y miniatura."""
    escena = bpy.context.scene
    escena.render.engine = "CYCLES"
    escena.cycles.device = "GPU" if _activar_gpu() != "CPU" else "CPU"
    escena.cycles.samples = muestras
    escena.cycles.use_adaptive_sampling = True
    escena.cycles.use_denoising = True
    escena.cycles.max_bounces = 8
    escena.cycles.transmission_bounces = 8
    escena.cycles.glossy_bounces = 4
    escena.render.resolution_x = ancho
    escena.render.resolution_y = alto
    escena.render.resolution_percentage = 100
    escena.render.film_transparent = True
    ajustes = escena.render.image_settings
    if hasattr(ajustes, "media_type"):
        ajustes.media_type = "IMAGE"
    ajustes.file_format = "WEBP"
    ajustes.color_mode = "RGBA"
    ajustes.quality = 82
    try:
        escena.view_settings.view_transform = "AgX"
        escena.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    mundo = bpy.data.worlds.new("mundo")
    escena.world = mundo
    if mundo.node_tree is None:
        mundo.use_nodes = True
    fondo = next(n for n in mundo.node_tree.nodes if n.type == "BACKGROUND")
    fondo.inputs["Color"].default_value = hex_lineal("#1a1f1b")
    fondo.inputs["Strength"].default_value = 0.25

    minimo, maximo = caja_escena()
    centro = (minimo + maximo) / 2
    direccion = direccion_camara(azimut, elevacion)
    distancia = distancia_encuadre(puntos_escena(), centro, direccion, fov, ancho / alto)
    radio = (maximo - minimo).length / 2
    tam = max(maximo - minimo)

    cam_datos = bpy.data.cameras.new("camara")
    cam_datos.sensor_fit = "VERTICAL"
    cam_datos.lens_unit = "FOV"
    cam_datos.angle_y = math.radians(fov)
    cam_datos.clip_start = radio * 0.01
    cam_datos.clip_end = radio * 100
    cam = _vincular(bpy.data.objects.new("camara", cam_datos))
    cam.location = centro + direccion * distancia
    cam.rotation_euler = (-direccion).to_track_quat("-Z", "Y").to_euler()
    escena.camera = cam

    estudio(centro, tam)
    _atrapasombras(tam)

    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    escena.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    print(f"Póster renderizado: {ruta} ({os.path.getsize(ruta) / 1024:.1f} KB)")


def poster(opciones, nombre, ancho, alto, azimut, elevacion):
    """Renderiza el póster salvo con --sin-render. Con --azimut (revisión desde
    otro ángulo) escribe <nombre>-az<grados>.webp en la carpeta de build, que
    no se publica, y no pisa el póster real."""
    if not opciones["render"]:
        return
    carpeta, sufijo = opciones["previews"], ""
    if opciones["azimut"] is not None:
        azimut = opciones["azimut"]
        carpeta, sufijo = opciones["salida"], f"-az{int(azimut)}"
    render_preview(os.path.join(carpeta, f"{nombre}{sufijo}.webp"), ancho, alto, azimut, elevacion)
