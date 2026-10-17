"""
Modelado de superficies para la versión realista de los modelos.

Complementa a comun.py con lo que separa un modelo "de primitivas" de uno
creíble:

  * anillos(): superficies a partir de secciones arbitrarias (no solo
    superelipses), con subdivisión Catmull-Clark y pliegues en las aristas
    vivas. Tanques, carenados, colines, asientos y la carcasa del GPS.
  * caja_redondeada(): piezas duras con biseles reales.
  * normales_ponderadas(): reflejos limpios en superficies grandes con
    biseles pequeños (lo que hace que una pieza "parezca de fábrica").
  * restar(): booleanas exactas (agujeros de discos, rejillas, cajeados).
  * UV en metros (uv_cubo y los que generan las primitivas) para usar
    texturas repetibles con una densidad de píxeles uniforme.
  * calcomania(): gráficos renderizados a textura y proyectados sobre la
    pieza, con transparencia recortada (alphaMode MASK).
"""

import math
import os
import tempfile

import bmesh
import bpy
from mathutils import Matrix, Vector

import comun as c


# ── Evaluación de modificadores ─────────────────────────────────────────────

def aplicar_modificadores(obj):
    """Sustituye la malla por la evaluada (modificadores aplicados)."""
    grafo = bpy.context.evaluated_depsgraph_get()
    evaluado = obj.evaluated_get(grafo)
    nueva = bpy.data.meshes.new_from_object(evaluado, preserve_all_data_layers=True, depsgraph=grafo)
    vieja = obj.data
    obj.modifiers.clear()
    obj.data = nueva
    nueva.name = vieja.name
    if vieja.users == 0:
        bpy.data.meshes.remove(vieja)
    return obj


def _capa_pliegue(bm):
    capa = bm.edges.layers.float.get("crease_edge")
    return capa if capa is not None else bm.edges.layers.float.new("crease_edge")


def subdividir(obj, nivel=2):
    if nivel <= 0:
        return obj
    mod = obj.modifiers.new("subdiv", "SUBSURF")
    mod.levels = nivel
    mod.render_levels = nivel
    mod.uv_smooth = "PRESERVE_CORNERS"
    mod.use_creases = True
    aplicar_modificadores(obj)
    return obj


def normales_ponderadas(obj, peso=50):
    """Normales ponderadas por área: las caras grandes quedan planas y la
    curvatura se concentra en los biseles, como en una pieza inyectada."""
    mod = obj.modifiers.new("normales", "WEIGHTED_NORMAL")
    mod.keep_sharp = True
    mod.weight = peso
    mod.mode = "FACE_AREA"
    aplicar_modificadores(obj)
    return obj


def restar(obj, cortadores):
    """Booleana exacta: obj − unión(cortadores). Los cortadores se borran."""
    cortadores = [x for x in cortadores if x is not None]
    if not cortadores:
        return obj
    cortador = c.unir(f"{obj.name}_cortador", cortadores)
    mod = obj.modifiers.new("restar", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cortador
    cortador.hide_render = True
    aplicar_modificadores(obj)
    bpy.data.objects.remove(cortador, do_unlink=True)
    return obj


# ── Superficies por anillos ──────────────────────────────────────────────────

def anillos(nombre, aros, mat=None, tapas=("plana", "plana"), cerrado=True, subdiv=2,
            pliegues=None, pliegue_tapas=0.0, angulo=50.0, uv=True):
    """Malla a partir de una lista de anillos (listas de puntos 3D con el mismo
    número de vértices). Es la base de todas las piezas orgánicas.

    tapas:     ("plana" | "punto" | None) para el primer y el último anillo.
    pliegues:  {índice_de_vértice_del_anillo: valor 0..1} → arista longitudinal
               con pliegue (arista viva tras subdividir).
    pliegue_tapas: pliegue del borde de las tapas planas.
    UV:        u = recorrido alrededor del anillo (m), v = recorrido a lo largo (m).
    """
    aros = [[Vector(p) for p in a] for a in aros]
    m = len(aros[0])
    if any(len(a) != m for a in aros):
        raise ValueError(f"{nombre}: todos los anillos deben tener {m} puntos")
    bm = bmesh.new()
    capa_uv = bm.loops.layers.uv.new("UVMap") if uv else None
    filas = [[bm.verts.new(p) for p in a] for a in aros]

    # Coordenadas UV en metros.
    centros = [sum(a, Vector()) / m for a in aros]
    v_largo = [0.0]
    for a, b in zip(centros, centros[1:]):
        v_largo.append(v_largo[-1] + (b - a).length)
    u_aro = []
    for a in aros:
        acumulado = [0.0]
        tramos = range(m) if cerrado else range(m - 1)
        for k in tramos:
            acumulado.append(acumulado[-1] + (a[(k + 1) % m] - a[k]).length)
        u_aro.append(acumulado)

    pliegue = _capa_pliegue(bm)
    lim = m if cerrado else m - 1
    for i in range(len(filas) - 1):
        a, b = filas[i], filas[i + 1]
        for k in range(lim):
            j = (k + 1) % m
            cara = bm.faces.new((a[k], a[j], b[j], b[k]))
            if capa_uv is not None:
                uk, uj = u_aro[i][k], u_aro[i][k + 1]
                ukb, ujb = u_aro[i + 1][k], u_aro[i + 1][k + 1]
                for bucle, (uu, vv) in zip(cara.loops, ((uk, v_largo[i]), (uj, v_largo[i]),
                                                        (ujb, v_largo[i + 1]), (ukb, v_largo[i + 1]))):
                    bucle[capa_uv].uv = (uu, vv)
    if pliegues:
        for i in range(len(filas) - 1):
            for k, valor in pliegues.items():
                arista = bm.edges.get((filas[i][k % m], filas[i + 1][k % m]))
                if arista is not None:
                    arista[pliegue] = valor

    def tapar(fila, tipo, invertir):
        if tipo == "plana":
            cara = bm.faces.new(list(reversed(fila)) if invertir else fila)
            if pliegue_tapas:
                for arista in cara.edges:
                    arista[pliegue] = pliegue_tapas
        elif tipo == "punto":
            centro = bm.verts.new(sum((v.co for v in fila), Vector()) / len(fila))
            for k in range(len(fila) if cerrado else len(fila) - 1):
                tri = (fila[k], fila[(k + 1) % len(fila)], centro)
                bm.faces.new(tuple(reversed(tri)) if invertir else tri)

    if cerrado:
        tapar(filas[0], tapas[0], True)
        tapar(filas[-1], tapas[-1], False)
    obj = c.malla(nombre, bm, mat, angulo, recalcular=bool(cerrado and tapas[0] and tapas[-1]))
    if subdiv:
        subdividir(obj, subdiv)
        c.sombrear(obj, angulo)
    return obj


def lamina(nombre, filas, mat=None, grosor=0.003, exterior=None, subdiv=1, angulo=50.0, pliegue_borde=0.0):
    """Pieza de chapa o plástico inyectado: superficie curva con espesor.

    filas: rejilla de puntos 3D (lista de filas, todas con el mismo número de
    puntos) que describe la cara EXTERIOR. La cara interior se obtiene
    desplazando cada punto `grosor` hacia dentro según la normal de la
    rejilla; los bordes se cierran con el canto. `exterior` es un punto o una
    función p→vector que indica hacia dónde mira la cara exterior (para
    orientar las normales). Carenados, tapas laterales, guardabarros y viseras.
    """
    filas = [[Vector(p) for p in f] for f in filas]
    nf, nc = len(filas), len(filas[0])

    def normal(i, k):
        du = filas[min(i + 1, nf - 1)][k] - filas[max(i - 1, 0)][k]
        dv = filas[i][min(k + 1, nc - 1)] - filas[i][max(k - 1, 0)]
        n = du.cross(dv)
        if n.length < 1e-12:
            return Vector((0, 0, 1))
        n.normalize()
        if exterior is not None:
            ref = exterior(filas[i][k]) if callable(exterior) else (filas[i][k] - Vector(exterior))
            if n.dot(ref) < 0:
                n = -n
        return n

    interiores = [[filas[i][k] - normal(i, k) * grosor for k in range(nc)] for i in range(nf)]
    bm = bmesh.new()
    capa_uv = bm.loops.layers.uv.new("UVMap")
    ext = [[bm.verts.new(p) for p in f] for f in filas]
    inn = [[bm.verts.new(p) for p in f] for f in interiores]

    def cara(vs, uvs=None):
        f = bm.faces.new(vs)
        if uvs:
            for bucle, uv in zip(f.loops, uvs):
                bucle[capa_uv].uv = uv
        return f

    for i in range(nf - 1):
        for k in range(nc - 1):
            uvs = [(k * 0.02, i * 0.02), ((k + 1) * 0.02, i * 0.02), ((k + 1) * 0.02, (i + 1) * 0.02),
                   (k * 0.02, (i + 1) * 0.02)]
            cara((ext[i][k], ext[i][k + 1], ext[i + 1][k + 1], ext[i + 1][k]), uvs)
            cara((inn[i + 1][k], inn[i + 1][k + 1], inn[i][k + 1], inn[i][k]))
    pliegue = _capa_pliegue(bm)
    bordes = []
    for i in range(nf - 1):
        bordes.append(cara((ext[i][0], ext[i + 1][0], inn[i + 1][0], inn[i][0])))
        bordes.append(cara((ext[i + 1][-1], ext[i][-1], inn[i][-1], inn[i + 1][-1])))
    for k in range(nc - 1):
        bordes.append(cara((ext[0][k + 1], ext[0][k], inn[0][k], inn[0][k + 1])))
        bordes.append(cara((ext[-1][k], ext[-1][k + 1], inn[-1][k + 1], inn[-1][k])))
    if pliegue_borde:
        for f in bordes:
            for arista in f.edges:
                arista[pliegue] = pliegue_borde
    obj = c.malla(nombre, bm, mat, angulo, recalcular=True)
    if subdiv:
        subdividir(obj, subdiv)
        c.sombrear(obj, angulo)
    return obj


def prisma_xz(nombre, contorno_xz, y0, y1, mat=None, sub=0, bisel=0.0):
    """Extruye un contorno del plano XZ (vista frontal) a lo largo de Y.
    Útil como cortador de booleanas (huecos de faros, rejillas)."""
    pts = c.catmull_rom([Vector((x, 0.0, z)) for x, z in contorno_xz], sub, cerrado=True) if sub > 1 \
        else [Vector((x, 0.0, z)) for x, z in contorno_xz]
    bm = bmesh.new()
    a = [bm.verts.new((p.x, y0, p.z)) for p in pts]
    b = [bm.verts.new((p.x, y1, p.z)) for p in pts]
    n = len(pts)
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if bisel:
        _biselar_bm(bm, bisel)
    return c.malla(nombre, bm, mat, 40)


def _biselar_bm(bm, ancho):
    aristas = [a for a in bm.edges if len(a.link_faces) == 2 and a.calc_face_angle(0.0) > math.radians(50)]
    bmesh.ops.bevel(bm, geom=aristas, offset=ancho, offset_type="OFFSET", segments=2, profile=0.5, affect="EDGES",
                    clamp_overlap=True)


def rejilla_secciones(secciones, puntos=12, pasos=3):
    """Convierte secciones clave (polilíneas abiertas con cualquier número de
    puntos) en una rejilla regular para `lamina`: cada sección se remuestrea
    a `puntos` por longitud de arco y se intercalan `pasos` filas entre claves."""
    remuestreadas = []
    for sec in secciones:
        pts = c.catmull_rom([Vector(p) for p in sec], 6)
        u = c._parametro_longitud(pts)
        fila = []
        j = 0
        for k in range(puntos):
            objetivo = k / (puntos - 1)
            while j < len(u) - 2 and u[j + 1] < objetivo:
                j += 1
            t_ = (objetivo - u[j]) / max(u[j + 1] - u[j], 1e-9)
            fila.append(pts[j].lerp(pts[j + 1], min(max(t_, 0.0), 1.0)))
        remuestreadas.append(fila)
    return interpolar_secciones(remuestreadas, pasos)


def seccion(puntos_xz, y=0.0, x=0.0, z=0.0, simetrica=True, escala=(1.0, 1.0)):
    """Anillo horizontal a partir de medio perfil (x, z) en el plano XZ.

    Con `simetrica`, los puntos van del eje superior (x = 0) al eje inferior
    pasando por el lado +X, y se reflejan para cerrar el anillo. Así un tanque
    o un asiento se describen con medio corte, como en un plano técnico.
    """
    sx, sz = escala
    medio = [(px * sx, pz * sz) for px, pz in puntos_xz]
    if simetrica:
        espejo = [(-px, pz) for px, pz in reversed(medio[1:-1])]
        lazo = medio + espejo
    else:
        lazo = medio
    return [Vector((x + px, y, z + pz)) for px, pz in lazo]


def rect_redondeado(hx, hy, r, n_lado_x=6, n_lado_y=12, n_esquina=6):
    """Contorno (2D, antihorario) de un rectángulo redondeado centrado.

    Devuelve siempre el mismo número de puntos aunque el radio tienda a 0, de
    modo que los anillos de distintas medidas se pueden unir entre sí (piezas
    tipo "almohada" construidas por desplazamientos del contorno).
    """
    r = max(min(r, hx, hy), 1e-5)
    pts = []

    def recta(a, b, n):
        for i in range(n):
            t = i / n
            pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))

    def arco(cx, cy, a0, n):
        for i in range(n):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

    recta((hx, -hy + r), (hx, hy - r), n_lado_y)
    arco(hx - r, hy - r, 0, n_esquina)
    recta((hx - r, hy), (-hx + r, hy), n_lado_x)
    arco(-hx + r, hy - r, 90, n_esquina)
    recta((-hx, hy - r), (-hx, -hy + r), n_lado_y)
    arco(-hx + r, -hy + r, 180, n_esquina)
    recta((-hx + r, -hy), (hx - r, -hy), n_lado_x)
    arco(hx - r, -hy + r, 270, n_esquina)
    return pts


def contorno_polar(poligono, n=48, centro=None):
    """Remuestrea un polígono convexo 2D con n rayos a ángulos iguales desde
    `centro`. Polígonos distintos muestreados así tienen vértices
    correspondientes, y se pueden unir como anillos de una misma superficie
    (por ejemplo, del contorno de un faro al de su carenado)."""
    pts = [Vector((x, y)) for x, y in poligono]
    if centro is None:
        centro = sum(pts, Vector((0, 0))) / len(pts)
    centro = Vector(centro)
    salida = []
    for k in range(n):
        a = 2 * math.pi * k / n
        d = Vector((math.cos(a), math.sin(a)))
        mejor = None
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            e = q - p
            den = d.x * e.y - d.y * e.x
            if abs(den) < 1e-12:
                continue
            w = p - centro
            t_ = (w.x * e.y - w.y * e.x) / den
            s_ = (w.x * d.y - w.y * d.x) / den
            if t_ > 0 and -1e-9 <= s_ <= 1 + 1e-9 and (mejor is None or t_ < mejor):
                mejor = t_
        salida.append((centro.x + d.x * mejor, centro.y + d.y * mejor))
    return salida


def interpolar_secciones(claves, pasos=3):
    """Intercala anillos entre secciones clave (mismo nº de puntos) con
    Catmull-Rom por vértice: transiciones suaves sin escalones."""
    if len(claves) < 2 or pasos <= 1:
        return claves
    m = len(claves[0])
    columnas = [c.catmull_rom([aro[k] for aro in claves], pasos) for k in range(m)]
    return [[columnas[k][i] for k in range(m)] for i in range(len(columnas[0]))]


# ── Piezas duras ─────────────────────────────────────────────────────────────

def caja_redondeada(nombre, dims, radio, pos=(0, 0, 0), rot=(0, 0, 0), mat=None, segmentos=4,
                    radio_vertical=None):
    """Caja con todas las aristas redondeadas (o las verticales con otro radio)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(dims), verts=bm.verts)
    if radio_vertical is not None:
        verticales = [a for a in bm.edges if abs((a.verts[0].co - a.verts[1].co).normalized().z) > 0.9]
        bmesh.ops.bevel(bm, geom=verticales, offset=radio_vertical, offset_type="OFFSET", segments=segmentos,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
        resto = [a for a in bm.edges if a.is_valid and len(a.link_faces) == 2
                 and a.calc_face_angle(0) > math.radians(60)]
        bmesh.ops.bevel(bm, geom=resto, offset=radio, offset_type="OFFSET", segments=segmentos,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
    else:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=radio, offset_type="OFFSET", segments=segmentos,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
    bmesh.ops.transform(bm, matrix=c.matriz(pos, rot), verts=bm.verts)
    obj = c.malla(nombre, bm, mat, 40)
    uv_cubo(obj)
    return obj


def uv_cubo(obj, escala=1.0):
    """Proyección cúbica en metros: cada cara se proyecta sobre el plano de
    su eje dominante. Suficiente para texturas de grano, ruido y cepillado."""
    malla = obj.data
    if not malla.uv_layers:
        malla.uv_layers.new(name="UVMap")
    capa = malla.uv_layers.active.data
    for poli in malla.polygons:
        n = poli.normal
        eje = max(range(3), key=lambda i: abs(n[i]))
        for indice in poli.loop_indices:
            p = malla.vertices[malla.loops[indice].vertex_index].co
            if eje == 0:
                uv = (p.y, p.z)
            elif eje == 1:
                uv = (p.x, p.z)
            else:
                uv = (p.x, p.y)
            capa[indice].uv = (uv[0] * escala, uv[1] * escala)
    return obj


def copiar_rotado(obj, n, eje="X", centro=(0, 0, 0)):
    """Repite la geometría n veces alrededor de un eje (radios, pernos, dientes)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    geom_original = bm.verts[:] + bm.edges[:] + bm.faces[:]
    centro = Vector(centro)
    for i in range(1, n):
        dup = bmesh.ops.duplicate(bm, geom=geom_original)
        verts = [e for e in dup["geom"] if isinstance(e, bmesh.types.BMVert)]
        rot = Matrix.Translation(centro) @ Matrix.Rotation(2 * math.pi * i / n, 4, eje) @ Matrix.Translation(-centro)
        bmesh.ops.transform(bm, matrix=rot, verts=verts)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


# ── Calcomanías ──────────────────────────────────────────────────────────────

def textura_calcomania(nombre, ancho_m, alto_m, elementos, px_por_m=5000, max_px=1024):
    """Renderiza gráficos vectoriales (textos, polígonos y trazos) a una imagen
    RGBA empaquetada en el .blend, lista para usar como calcomanía.

    elementos: dicts con "tipo":
      texto:    cuerpo, alto, pos (x, y), rot (grados), color, inclinacion,
                espaciado, fuente (ruta opcional), alinear ("CENTER"|"LEFT")
      poligono: puntos [(x, y)...], color, suave (subdivisión Catmull-Rom)
      trazo:    puntos [(x, y)...], ancho, color, suave
    Coordenadas en metros con el origen en el centro de la calcomanía.
    """
    escala_px = min(px_por_m, max_px / max(ancho_m, alto_m))
    ancho_px = max(8, int(round(ancho_m * escala_px)))
    alto_px = max(8, int(round(alto_m * escala_px)))

    escena = bpy.data.scenes.new(f"calcomania_{nombre}")
    for motor in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            escena.render.engine = motor
            break
        except TypeError:
            continue
    escena.render.resolution_x = ancho_px
    escena.render.resolution_y = alto_px
    escena.render.resolution_percentage = 100
    escena.render.film_transparent = True
    escena.view_settings.view_transform = "Standard"
    escena.render.image_settings.file_format = "PNG"
    escena.render.image_settings.color_mode = "RGBA"
    try:
        escena.eevee.taa_render_samples = 16
    except AttributeError:
        pass

    cam_datos = bpy.data.cameras.new(f"cam_{nombre}")
    cam_datos.type = "ORTHO"
    cam_datos.ortho_scale = max(ancho_m, alto_m)
    cam = bpy.data.objects.new(f"cam_{nombre}", cam_datos)
    cam.location = (0, 0, 1)
    escena.collection.objects.link(cam)
    escena.camera = cam

    creados = [cam]
    materiales = []

    def mat_color(color):
        mat = bpy.data.materials.new(f"calco_{nombre}_{len(materiales)}")
        if mat.node_tree is None:
            mat.use_nodes = True
        nodos = mat.node_tree.nodes
        for n in list(nodos):
            if n.type != "OUTPUT_MATERIAL":
                nodos.remove(n)
        em = nodos.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = c.hex_lineal(color)
        salida = next(n for n in nodos if n.type == "OUTPUT_MATERIAL")
        mat.node_tree.links.new(em.outputs["Emission"], salida.inputs["Surface"])
        materiales.append(mat)
        return mat

    for i, el in enumerate(elementos):
        z = 0.001 * (i + 1)
        if el["tipo"] == "texto":
            curva = bpy.data.curves.new(f"t_{nombre}_{i}", "FONT")
            curva.body = el["cuerpo"]
            curva.size = el["alto"]
            curva.align_x = el.get("alinear", "CENTER")
            curva.align_y = "CENTER"
            curva.shear = el.get("inclinacion", 0.0)
            curva.space_character = el.get("espaciado", 1.0)
            curva.offset = el.get("grosor", 0.0)
            curva.resolution_u = 8
            fuente = el.get("fuente")
            if fuente and os.path.exists(fuente):
                curva.font = bpy.data.fonts.load(fuente, check_existing=True)
            else:
                f = c._fuente_bold()
                if f is not None:
                    curva.font = f
            obj = bpy.data.objects.new(f"t_{nombre}_{i}", curva)
            obj.location = (el.get("pos", (0, 0))[0], el.get("pos", (0, 0))[1], z)
            obj.rotation_euler = (0, 0, math.radians(el.get("rot", 0.0)))
        else:
            curva = bpy.data.curves.new(f"p_{nombre}_{i}", "CURVE")
            curva.dimensions = "2D" if el["tipo"] == "poligono" else "3D"
            pts = el["puntos"]
            if el.get("suave", 0):
                pts = [(p.x, p.y) for p in c.catmull_rom([Vector((x, y, 0)) for x, y in pts], el["suave"],
                                                         cerrado=el["tipo"] == "poligono")]
            spline = curva.splines.new("POLY")
            spline.points.add(len(pts) - 1)
            for p, (x, y) in zip(spline.points, pts):
                p.co = (x, y, 0, 1)
            if el["tipo"] == "poligono":
                spline.use_cyclic_u = True
                curva.fill_mode = "BOTH"
            else:
                curva.bevel_depth = el.get("ancho", 0.002) / 2
                curva.bevel_resolution = 2
            obj = bpy.data.objects.new(f"p_{nombre}_{i}", curva)
            obj.location = (0, 0, z)
        obj.data.materials.append(mat_color(el.get("color", "#ffffff")))
        escena.collection.objects.link(obj)
        creados.append(obj)

    ruta = os.path.join(tempfile.gettempdir(), f"romp_calco_{nombre}.png")
    escena.render.filepath = ruta
    bpy.ops.render.render(write_still=True, scene=escena.name)
    imagen = bpy.data.images.load(ruta, check_existing=False)
    imagen.name = f"calcomania_{nombre}"
    imagen.pack()
    imagen.filepath = ""
    try:
        os.remove(ruta)
    except OSError:
        pass

    for obj in creados:
        datos = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if isinstance(datos, bpy.types.Curve):
            bpy.data.curves.remove(datos)
        elif isinstance(datos, bpy.types.Camera):
            bpy.data.cameras.remove(datos)
    for mat in materiales:
        bpy.data.materials.remove(mat)
    bpy.data.scenes.remove(escena)
    return imagen


def material_calcomania(nombre, imagen, metal=0.0, rugosidad=0.4, emision=0.0):
    """Material con color y transparencia recortada (glTF alphaMode MASK)."""
    mat = bpy.data.materials.new(nombre)
    if mat.node_tree is None:
        mat.use_nodes = True
    arbol = mat.node_tree
    bsdf = next(n for n in arbol.nodes if n.type == "BSDF_PRINCIPLED")
    tex = arbol.nodes.new("ShaderNodeTexImage")
    tex.image = imagen
    tex.interpolation = "Linear"
    tex.extension = "CLIP"
    arbol.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    redondeo = arbol.nodes.new("ShaderNodeMath")
    redondeo.operation = "ROUND"  # el exportador glTF lo traduce a alphaMode MASK
    arbol.links.new(tex.outputs["Alpha"], redondeo.inputs[0])
    arbol.links.new(redondeo.outputs[0], bsdf.inputs["Alpha"])
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rugosidad
    if emision:
        arbol.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emision
    try:
        mat.surface_render_method = "DITHERED"
    except AttributeError:
        mat.blend_method = "CLIP"
    mat.diffuse_color = (0.8, 0.8, 0.8, 1.0)
    return mat


def calcomania(nombre, sobre, centro, normal, arriba, ancho, alto, mat, separacion=0.0005,
               subdiv=(24, 12)):
    """Plano subdividido con UV 0..1 proyectado sobre `sobre` a lo largo de
    -normal. `arriba` orienta el lado superior de la imagen."""
    normal = Vector(normal).normalized()
    arriba = (Vector(arriba) - normal * Vector(arriba).dot(normal)).normalized()
    derecha = arriba.cross(normal).normalized()
    nx, ny = subdiv
    bm = bmesh.new()
    capa_uv = bm.loops.layers.uv.new("UVMap")
    rejilla = []
    base = Vector(centro) + normal * 0.05
    for j in range(ny + 1):
        fila = []
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            p = base + derecha * ((u - 0.5) * ancho) + arriba * ((v - 0.5) * alto)
            fila.append((bm.verts.new(p), (u, v)))
        rejilla.append(fila)
    for j in range(ny):
        for i in range(nx):
            esquinas = (rejilla[j][i], rejilla[j][i + 1], rejilla[j + 1][i + 1], rejilla[j + 1][i])
            cara = bm.faces.new([e[0] for e in esquinas])
            for bucle, (_, uv) in zip(cara.loops, esquinas):
                bucle[capa_uv].uv = uv
    datos = bpy.data.meshes.new(nombre)
    bm.to_mesh(datos)
    bm.free()
    obj = c._vincular(bpy.data.objects.new(nombre, datos))
    # Proyección a lo largo de -normal: se orienta el objeto para que su Z
    # local sea la normal (shrinkwrap proyecta en ejes locales).
    rot = Matrix((derecha, arriba, normal)).transposed().to_4x4()
    obj.data.transform(rot.inverted())
    obj.matrix_world = rot
    originales = [v.co.copy() for v in obj.data.vertices]
    mod = obj.modifiers.new("proyectar", "SHRINKWRAP")
    mod.target = sobre
    mod.wrap_method = "PROJECT"
    mod.use_project_z = True
    mod.use_negative_direction = True
    mod.use_positive_direction = False
    mod.wrap_mode = "OUTSIDE_SURFACE"
    mod.offset = separacion
    aplicar_modificadores(obj)
    # Los vértices que no encontraron superficie se quedan en el plano de
    # partida: se quitan sus caras (son esquinas transparentes que caen fuera
    # de la pieza). Si se pierde demasiado, la calcomanía está mal colocada.
    fallidos = {i for i, v in enumerate(obj.data.vertices) if (v.co - originales[i]).length < 1e-6}
    if fallidos:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.verts.ensure_lookup_table()
        caras = [f for f in bm.faces if any(v.index in fallidos for v in f.verts)]
        total = len(bm.faces)
        if len(caras) > total * 0.4:
            bm.free()
            raise RuntimeError(f"{nombre}: la calcomanía no cae sobre '{sobre.name}' ({len(caras)}/{total} caras fuera)")
        bmesh.ops.delete(bm, geom=caras, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(obj.data)
        bm.free()
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.materials.append(mat)
    obj["calcomania"] = True
    c.sombrear(obj, 60)
    return obj
