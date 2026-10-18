"""
Rastreador GPS GNXIS, réplica del equipo real de la foto
FrontEnd/img-blender/gps real.jpg (cara del logo y cara de la etiqueta).

Carcasa de ABS negro de esquinas casi rectas, en dos conchas con línea de
partición. La cara del logo es mate, con el punteado del molde, y lleva
rebajadas tres medias lunas cóncavas y pulidas: una en cada borde largo y una
pequeña en el extremo opuesto al cable. La trasera es lisa y mate, con la
etiqueta "SIMCOM FCC 2AJYU-8BAE002 / VOLTAJE 9-90VDC". No tiene LED.
Del extremo sale el manguito de goma con tres ranuras, el cable plano de
cuatro hilos, un tramo termorretráctil y el conector de 4 vías (tipo JST SM)
con sus aletas y el pestillo con ventana.

Las medidas salen de la foto en píxeles (largo/ancho = 2,3) tomando 33 mm de
ancho, la medida habitual de estos equipos.

    blender --background --factory-startup --python tools/blender/gps_device.py

Nodos: gps_gnxis (raíz) > carcasa, impresos.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import comun as c  # noqa: E402
import superficies as s  # noqa: E402
import texturas as t  # noqa: E402

NOMBRE = "gps-device"
PRESUPUESTO = 45_000

# Se modela tumbado, como en la foto: largo en Y (el cable sale por +Y), ancho
# en X y grosor en Z con la cara del logo hacia arriba. Al final se pone de pie.
L, W, T = 0.076, 0.033, 0.014
R_PLANTA = 0.0032  # esquinas casi rectas
R_SUP, R_INF = 0.0010, 0.0014  # redondeo del borde de la cara del logo y de la trasera
Z_PARTICION = 0.0062
D_MAX = W / 2 - 0.0004
E0 = L / 2  # extremo del cable: las distancias "e" del cable se miden desde aquí
Z_EJE = T / 2  # eje del manguito, del cable y del conector

# Letras del logo medidas en la foto, y su posición (algo hacia el extremo sin cable).
LOGO_ANCHO, LOGO_ALTO, LOGO_Y = 0.0326, 0.0070, -0.0024
# Etiqueta de la trasera: tamaño y centro.
ETQ_ANCHO, ETQ_ALTO = 0.0294, 0.0106
ETQ_X, ETQ_Y = -0.0011, E0 - 0.0209

FUENTE_LOGO = r"C:\Windows\Fonts\GOTHICB.TTF"  # Century Gothic Bold: GNXIS es geométrica, ancha y gruesa
FUENTE_ETIQUETA = r"C:\Windows\Fonts\ARIALNB.TTF"  # la etiqueta usa una palo seco estrecha y gruesa

# De pie (+90° en X: la cara del logo mira al frente, -Y, y el cable arriba) e inclinado.
POSE = (Matrix.Rotation(math.radians(-14), 4, "Y") @ Matrix.Rotation(math.radians(-10), 4, "X")
        @ Matrix.Rotation(math.radians(90), 4, "X"))


def materiales():
    molde = t.grano_molde()
    return {
        # Rugosidad media y grano marcado: negro profundo con el destello del
        # punteado, no el gris lavado que da un mate muy rugoso bajo luz de estudio.
        "mate": t.material_pbr("abs_texturizado", "#090909", rugosidad=0.42, normal=molde, escala=(90, 90),
                               fuerza_normal=0.85),
        "satinado": t.material_pbr("abs_satinado", "#080808", rugosidad=0.28, normal=molde, escala=(90, 90),
                                   fuerza_normal=0.25),
        "brillo": t.material_pbr("abs_pulido", "#070707", rugosidad=0.1, capa=0.4, capa_rugosidad=0.04),
        "goma": t.material_pbr("goma_manguito", "#0f0f0f", rugosidad=0.52, normal=molde, escala=(200, 200),
                               fuerza_normal=0.45),
        "cable": c.material("pvc_cable_plano", "#1b1b1b", rugosidad=0.3),
        "termo": c.material("termorretractil", "#0c0c0c", rugosidad=0.58),
        "nylon": t.material_pbr("nylon_conector", "#2b2b2a", rugosidad=0.62, normal=molde, escala=(260, 260),
                                fuerza_normal=0.35),
        "nylon_negro": t.material_pbr("nylon_negro", "#111111", rugosidad=0.5, normal=molde, escala=(260, 260),
                                      fuerza_normal=0.35),
        "hueco": c.material("fondo_cavidad", "#030303", rugosidad=0.9),
        "estano": c.material("terminal_estanado", "#c9c7bd", metal=1.0, rugosidad=0.3),
    }


# ── Carcasa ──────────────────────────────────────────────────────────────────

def perfil_carcasa():
    """(desplazamiento hacia dentro, z) desde el centro de la trasera hasta el
    centro de la cara del logo: fondo plano, redondeo inferior, pared con la
    línea de partición de las dos conchas, redondeo superior y cara plana."""
    # Las tapas son el último anillo plano (un rectángulo redondeado convexo):
    # un anillo casi degenerado en el centro se triangula mal y deja una raya.
    p = [(0.011, 0.0), (0.0055, 0.0), (0.0028, 0.0)]
    for k in range(7):
        a = math.radians(270 - 15 * k)
        p.append((R_INF + R_INF * math.cos(a), R_INF + R_INF * math.sin(a)))
    p += [(0.0, 0.0034), (0.0, Z_PARTICION - 0.0003), (0.00022, Z_PARTICION - 0.00008),
          (0.00022, Z_PARTICION + 0.00008), (0.0, Z_PARTICION + 0.0003), (0.0, T - R_SUP - 0.0025),
          (0.0, T - R_SUP)]
    for k in range(1, 7):
        a = math.radians(180 - 15 * k)
        p.append((R_SUP + R_SUP * math.cos(a), T - R_SUP + R_SUP * math.sin(a)))
    p += [(0.0028, T), (0.0055, T), (0.009, T), (0.0125, T)]
    return p


def media_luna(nombre, eje, lado, centro, cuerda, hondo, caida, mat, plana=False, concavidad=0.8, filas=96,
               segmentos=40):
    """Cortador de una media luna: bisel cóncavo cuyo ancho crece del borde
    hacia el centro, como un barrido de elipses que pasan por (hondo dentro de
    la cara del logo) y (caida pared abajo). Con `concavidad` 0 sería un
    chaflán plano; cuanto mayor, más hundida la media luna.

    eje "Y": borde largo en x = lado·W/2 (la media luna recorre Y).
    eje "X": extremo en y = lado·L/2 (la media luna recorre X).
    cuerda: largo visible de la media luna sobre la cara del logo.
    plana: fondo recto en el centro (la "sonrisa" larga de la foto) en vez de arco.
    """
    exponente = 1.6  # puntas afiladas y tangentes al borde, como en la foto
    potencia = 4 if plana else 2
    # Solo se ve en la cara plana donde entra más que el redondeo del borde.
    u_visible = (1 - (R_SUP / hondo) ** (1 / exponente)) ** (1 / potencia)
    semi = cuerda / 2 / u_visible
    k = math.sqrt((1 + concavidad) ** 2 + concavidad ** 2)
    borde = W / 2 if eje == "Y" else L / 2
    aros = []
    for i in range(filas + 1):
        u = -1.0 + 2.0 * i / filas
        f = max(1 - abs(u) ** potencia, 0.0) ** exponente
        d, h = max(hondo * f, 2e-5), max(caida * f, 2e-5)
        n0, z0 = borde + concavidad * d, T + concavidad * h
        pos = centro + u * semi
        aro = []
        for j in range(segmentos):
            a = 2 * math.pi * j / segmentos
            n, z = n0 + d * k * math.cos(a), z0 + h * k * math.sin(a)
            aro.append((lado * n, pos, z) if eje == "Y" else (pos, lado * n, z))
        aros.append(aro)
    return s.anillos(nombre, aros, mat, tapas=("plana", "plana"), subdiv=0, angulo=60)


def rebajar(cuerpo, cortadores):
    """Booleana exacta que conserva el material del cortador: las caras de
    las medias lunas quedan con el ABS pulido."""
    cortador = c.unir("medias_lunas", cortadores)
    mod = cuerpo.modifiers.new("rebajar", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.material_mode = "TRANSFER"
    mod.object = cortador
    s.aplicar_modificadores(cuerpo)
    bpy.data.objects.remove(cortador, do_unlink=True)


def repartir_materiales(cuerpo, m):
    """Cara del logo y trasera mates, paredes satinadas y medias lunas
    pulidas, con arista viva en el borde de cada media luna."""
    mats = cuerpo.data.materials
    mats.append(m["satinado"])
    i_brillo, i_satinado = mats.find(m["brillo"].name), mats.find(m["satinado"].name)
    for p in cuerpo.data.polygons:
        if p.material_index != i_brillo and abs(p.normal.z) < 0.7:
            p.material_index = i_satinado
    c.sombrear(cuerpo, 50)
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    for arista in bm.edges:
        if len(arista.link_faces) == 2:
            a, b = (cara.material_index for cara in arista.link_faces)
            if a != b and i_brillo in (a, b):
                arista.smooth = False
    bm.to_mesh(cuerpo.data)
    bm.free()


def carcasa(m):
    aros = []
    for d, z in perfil_carcasa():
        contorno = s.rect_redondeado(W / 2 - d, L / 2 - d, max(R_PLANTA - d, 0.0006),
                                     n_lado_x=8, n_lado_y=20, n_esquina=8)
        aros.append([(x, y, z) for x, y in contorno])
    cuerpo = s.anillos("cuerpo", aros, m["mate"], tapas=("plana", "plana"), subdiv=0, angulo=50)

    # Medias lunas medidas en la foto: la del borde de abajo de la foto (+X) es
    # larga, honda y de fondo recto; la de arriba (-X), más corta, en arco y
    # desplazada hacia el cable; la del extremo, pequeña.
    rebajar(cuerpo, [
        media_luna("luna_larga", "Y", +1, 0.0013, 0.053, 0.0068, 0.0060, m["brillo"], plana=True),
        media_luna("luna_corta", "Y", -1, 0.0030, 0.0284, 0.0045, 0.0050, m["brillo"]),
        media_luna("luna_extremo", "X", -1, 0.0, 0.0089, 0.0020, 0.0032, m["brillo"]),
    ])
    repartir_materiales(cuerpo, m)
    s.uv_cubo(cuerpo)
    return cuerpo


# ── Logo y etiqueta ──────────────────────────────────────────────────────────

def medir_tinta(imagen, lienzo):
    """Ancho y alto (m) de lo pintado en una calcomanía."""
    ancho_px, alto_px = imagen.size
    alfa = np.array(imagen.pixels[:], dtype=np.float32).reshape(alto_px, ancho_px, 4)[..., 3]
    ys, xs = np.where(alfa > 0.5)
    return (xs.max() - xs.min() + 1) * lienzo[0] / ancho_px, (ys.max() - ys.min() + 1) * lienzo[1] / alto_px


def textura_logo():
    """GNXIS en tinta gris, ajustado a la medida de las letras de la foto:
    el tamaño fija el alto y el espaciado el ancho."""
    lienzo = (LOGO_ANCHO + 0.003, LOGO_ALTO + 0.003)
    tam, espaciado = LOGO_ALTO * 1.4, 1.0
    for _ in range(4):
        img = s.textura_calcomania("gnxis", *lienzo, [
            {"tipo": "texto", "cuerpo": "GNXIS", "alto": tam, "color": "#77797a", "fuente": FUENTE_LOGO,
             "espaciado": espaciado},
        ], px_por_m=30000, max_px=1024)
        ancho, alto = medir_tinta(img, lienzo)
        if abs(ancho - LOGO_ANCHO) < 0.00015 and abs(alto - LOGO_ALTO) < 0.0001:
            break
        bpy.data.images.remove(img)
        tam *= LOGO_ALTO / alto
        espaciado *= 1 + (LOGO_ANCHO / (ancho * LOGO_ALTO / alto) - 1) * 1.3
    print(f"[{NOMBRE}] logo: {ancho * 1000:.1f} × {alto * 1000:.1f} mm (tamaño {tam * 1000:.2f} mm, "
          f"espaciado {espaciado:.3f})")
    return img, lienzo


def barras(x0, x1, y0, y1):
    """Código de barras de la etiqueta (patrón fijo)."""
    azar = random.Random(2017)
    modulo = 0.00015
    x, negra, salida = x0, True, []
    while x < x1:
        ancho = modulo * azar.choice((1, 1, 2, 2, 3, 4))
        if negra and x + ancho <= x1:
            salida.append({"tipo": "poligono", "color": "#121212",
                           "puntos": [(x, y0), (x + ancho, y0), (x + ancho, y1), (x, y1)]})
        x += ancho
        negra = not negra
    return salida


def textura_etiqueta():
    """Etiqueta de la foto, con las medidas tomadas de la imagen ampliada."""
    hx, hy, mm = ETQ_ANCHO / 2, ETQ_ALTO / 2, 0.001

    def texto(cuerpo, x, y, alto, alinear="LEFT"):
        return {"tipo": "texto", "cuerpo": cuerpo, "alto": alto, "pos": (-hx + x * mm, hy - y * mm),
                "color": "#151515", "fuente": FUENTE_ETIQUETA, "alinear": alinear}

    # El tamaño de un texto de Blender no es la altura de las mayúsculas: en
    # Arial Narrow la mayúscula mide ~0,49 del tamaño (1,5 mm → 3,0 mm).
    return s.textura_calcomania("etiqueta", ETQ_ANCHO, ETQ_ALTO, [
        {"tipo": "poligono", "color": "#ecebe6", "puntos": s.rect_redondeado(hx, hy, 0.0012, 2, 2, 6)},
        texto("SIMCOM FCC", 1.8, 2.0, 2.85 * mm),
        texto("2AJYU-8BAE002", 14.7, 2.0, 2.85 * mm),
        *barras(-hx + 2.0 * mm, -hx + 24.6 * mm, hy - 7.0 * mm, hy - 3.1 * mm),
        texto("45", 26.75, 5.3, 2.8 * mm, "CENTER"),
        texto("LB", 26.75, 7.5, 2.8 * mm, "CENTER"),
        texto("VOLTAJE 9-90VDC", 5.7, 8.3, 3.0 * mm),
    ], px_por_m=40000, max_px=1024)


def impresos(cuerpo):
    logo_img, lienzo = textura_logo()
    logo = s.calcomania("logo", cuerpo, centro=(0.0, LOGO_Y, T), normal=(0, 0, 1), arriba=(-1, 0, 0),
                        ancho=lienzo[0], alto=lienzo[1],
                        mat=s.material_calcomania("tinta_logo", logo_img, rugosidad=0.42), subdiv=(24, 8))
    # Vista desde la trasera, la etiqueta se lee con el cable a la izquierda.
    etiqueta = s.calcomania("etiqueta", cuerpo, centro=(ETQ_X, ETQ_Y, 0.0), normal=(0, 0, -1), arriba=(-1, 0, 0),
                            ancho=ETQ_ANCHO, alto=ETQ_ALTO,
                            mat=s.material_calcomania("papel_etiqueta", textura_etiqueta(), rugosidad=0.38),
                            subdiv=(8, 4))
    return [logo, etiqueta]


# ── Cable y conector ─────────────────────────────────────────────────────────

def aro_redondeado(e, ancho, alto, radio, n=(6, 4, 5)):
    """Sección de rectángulo redondeado perpendicular al cable, a una
    distancia e del extremo de la carcasa."""
    contorno = s.rect_redondeado(ancho / 2, alto / 2, radio, n_lado_x=n[0], n_lado_y=n[1], n_esquina=n[2])
    return [(x, E0 + e, Z_EJE + z) for x, z in contorno]


def manguito(m):
    """Manguito de goma: se estrecha un poco hacia el cable y tiene tres ranuras."""
    def medidas(e):
        k = min(max(e / 0.0093, 0.0), 1.0)
        return 0.0120 - 0.0014 * k, 0.0086 - 0.0008 * k

    secciones = [(-0.0012, 0.0), (0.0, 0.0), (0.0024, 0.0)]
    for e in (0.0031, 0.0056, 0.0079):
        secciones += [(e - 0.0006, 0.0), (e - 0.00045, 0.0005), (e + 0.00045, 0.0005), (e + 0.0006, 0.0)]
    secciones += [(0.0093, 0.0), (0.0097, 0.0004), (0.0099, 0.0013)]
    aros = []
    for e, dentro in secciones:
        ancho, alto = medidas(e)
        aros.append(aro_redondeado(e, ancho - 2 * dentro, alto - 2 * dentro, 0.0022 - dentro))
    return s.anillos("manguito", aros, m["goma"], tapas=("plana", "plana"), subdiv=0, angulo=40)


def seccion_cable_plano(e):
    """Cable plano de cuatro hilos: cuatro núcleos solapados con sus surcos."""
    r, centros = 0.0013, (-0.0024, -0.0008, 0.0008, 0.0024)

    def cara(x):
        return max(math.sqrt(max(r * r - (x - xi) ** 2, 0.0)) for xi in centros)

    pts = []
    for k in range(9):  # extremo +x, de abajo arriba
        a = math.radians(-90 + 180 * k / 8)
        pts.append((centros[-1] + r * math.cos(a), r * math.sin(a)))
    for k in range(1, 22):  # cara de arriba, de +x a -x
        x = centros[-1] - (centros[-1] - centros[0]) * k / 22
        pts.append((x, cara(x)))
    for k in range(9):  # extremo -x, de arriba abajo
        a = math.radians(90 + 180 * k / 8)
        pts.append((centros[0] + r * math.cos(a), r * math.sin(a)))
    for k in range(1, 22):  # cara de abajo, de -x a +x
        x = centros[0] + (centros[-1] - centros[0]) * k / 22
        pts.append((x, -cara(x)))
    return [(x, E0 + e, Z_EJE + z) for x, z in pts]


def cable_y_conector(m):
    piezas = [manguito(m)]
    piezas.append(s.anillos("cable_plano", [seccion_cable_plano(e) for e in (0.0080, 0.0372)], m["cable"],
                            tapas=("plana", "plana"), subdiv=0, angulo=40))

    # Termorretráctil: más grueso sobre el cable y un cuello antes del conector.
    piezas.append(s.anillos("termorretractil", [aro_redondeado(e, a, h, r) for e, a, h, r in (
        (0.0358, 0.0076, 0.0028, 0.0013), (0.0362, 0.0081, 0.0040, 0.0018), (0.0368, 0.0083, 0.0044, 0.0019),
        (0.0485, 0.0083, 0.0044, 0.0019), (0.0496, 0.0077, 0.0042, 0.0018), (0.0505, 0.0071, 0.0040, 0.0017),
        (0.0510, 0.0070, 0.0040, 0.0017), (0.0602, 0.0070, 0.0040, 0.0017),
    )], m["termo"], tapas=("plana", "plana"), subdiv=0, angulo=40))
    return piezas + conector(m)


def aleta(lado, bisagra, mat):
    """Aleta del conector: lámina trapezoidal que nace en la unión de los dos
    cuerpos y se abre hacia el cable (la "punta de flecha" de la foto)."""
    angulo = math.radians(25)
    largo, alto_base, alto_punta, grueso = 0.0052, 0.0060, 0.0036, 0.0007
    contorno = [(0.0, -alto_base / 2), (0.0, alto_base / 2), (largo, alto_punta / 2), (largo, -alto_punta / 2)]
    # Contorno en el plano (avance hacia el cable, z); se extruye en el grosor.
    direccion = Vector((lado * math.sin(angulo), -math.cos(angulo), 0.0))
    normal = Vector((math.cos(angulo), lado * math.sin(angulo), 0.0))
    bm = bmesh.new()
    caras = []
    for desplazamiento in (-grueso / 2, grueso / 2):
        caras.append([bm.verts.new(bisagra + direccion * a + Vector((0, 0, z)) + normal * desplazamiento)
                      for a, z in contorno])
    bm.faces.new(caras[0])
    bm.faces.new(list(reversed(caras[1])))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((caras[0][i], caras[1][i], caras[1][j], caras[0][j]))
    obj = c.malla("aleta", bm, mat, 30)
    s.uv_cubo(obj)
    return obj


def conector(m):
    """Conector de 4 vías: cuerpo trasero negro, cuerpo delantero gris que
    termina en cuatro torres (una por vía, los "dientes" de la foto), pestillo
    con ventana en la cara de la etiqueta y dos aletas."""
    e_trasera, e_frente, e_torres, e_punta = 0.0595, 0.0640, 0.0701, 0.0737
    piezas = [s.caja_redondeada("conector_trasera", (0.0110, e_frente - e_trasera + 0.0004, 0.0080), 0.0008,
                                pos=(0, E0 + (e_trasera + e_frente) / 2, Z_EJE), mat=m["nylon_negro"], segmentos=2)]
    largo = e_torres - e_frente + 0.0004
    piezas.append(s.caja_redondeada("conector_frente", (0.0101, largo, 0.0074), 0.0005,
                                    pos=(0, E0 + e_frente + largo / 2, Z_EJE), mat=m["nylon"], segmentos=2))

    vias = (-0.0037, -0.00123, 0.00123, 0.0037)
    largo_torre = e_punta - e_torres + 0.0004
    torres = [s.caja_redondeada("torre", (0.0022, largo_torre, 0.0066), 0.0002,
                                pos=(x, E0 + e_torres - 0.0004 + largo_torre / 2, Z_EJE + 0.0003),
                                mat=m["nylon"], segmentos=1) for x in vias]
    torres = c.unir("torres", torres)
    z_pestillo = Z_EJE - 0.0037
    s.restar(torres, [c.caja("cavidad", (0.0015, 0.008, 0.0015), pos=(x, E0 + e_punta, Z_EJE + 0.0005))
                      for x in vias])
    s.uv_cubo(torres)
    piezas.append(torres)
    for x in vias:
        piezas.append(c.caja("fondo_via", (0.0015, 0.0003, 0.0015), pos=(x, E0 + e_punta - 0.0036, Z_EJE + 0.0005),
                             mat=m["hueco"]))
        piezas.append(c.caja("terminal", (0.0007, 0.0024, 0.0007), pos=(x, E0 + e_punta - 0.0024, Z_EJE + 0.0005),
                             mat=m["estano"], bisel=0.0001, segmentos=1))

    # Pestillo: lengüeta sobre la cara de la etiqueta con la ventana de enganche.
    largo_pestillo = e_punta - e_frente - 0.0012
    lengueta = s.caja_redondeada("pestillo", (0.0052, largo_pestillo, 0.0009), 0.0002,
                                 pos=(0, E0 + e_frente + 0.0006 + largo_pestillo / 2, z_pestillo - 0.0001),
                                 mat=m["nylon"], segmentos=1)
    s.restar(lengueta, [c.caja("ventana", (0.0026, 0.0015, 0.0030), pos=(0, E0 + e_punta - 0.0024, z_pestillo))])
    s.uv_cubo(lengueta)
    piezas.append(lengueta)
    piezas.append(c.caja("fondo_ventana", (0.0024, 0.0013, 0.0002),
                         pos=(0, E0 + e_punta - 0.0024, z_pestillo + 0.0005), mat=m["hueco"]))
    for lado in (-1, 1):
        piezas.append(c.caja("riel", (0.0005, e_punta - e_frente - 0.0010, 0.0005),
                             pos=(lado * 0.0036, E0 + (e_frente + e_punta) / 2, z_pestillo - 0.0001),
                             mat=m["nylon"], bisel=0.0001, segmentos=1))
        piezas.append(aleta(lado, Vector((lado * 0.0051, E0 + e_frente - 0.0002, Z_EJE)), m["nylon"]))
    return piezas


# ── Ensamblado ───────────────────────────────────────────────────────────────

def modelar():
    """Equipo tumbado como en la foto. Devuelve (carcasa, impresos)."""
    c.nueva_escena()
    m = materiales()
    cuerpo = carcasa(m)
    calcos = impresos(cuerpo)
    solido = c.unir("carcasa", [cuerpo] + cable_y_conector(m))
    return solido, c.unir("impresos", calcos)


def construir(opciones):
    solido, calcos = modelar()
    for obj in (solido, calcos):
        obj.data.transform(POSE)
    minimo_z = min(v.co.z for obj in (solido, calcos) for v in obj.data.vertices)
    for obj in (solido, calcos):
        obj.data.transform(Matrix.Translation((0, 0, -minimo_z)))

    raiz = c.vacio("gps_gnxis")
    c.colgar(solido, raiz)
    c.colgar(calcos, raiz)

    c.validar(NOMBRE, PRESUPUESTO)
    # WebP dentro del .glb (EXT_texture_webp): el grano y las calcomanías pesan
    # una fracción de lo que pesarían en PNG, y el GPS se precarga en la landing.
    c.exportar_glb(os.path.join(opciones["salida"], f"{NOMBRE}.glb"), formato_imagen="WEBP")
    # Sin la tira frontal (pensada para piezas cromadas): la cara del logo
    # la reflejaría entera y el negro se vería gris; el visor tampoco la tiene.
    c.poster(opciones, NOMBRE, 800, 800, azimut=24, elevacion=14, luces={"tira_frontal": 0.0})


if __name__ == "__main__":
    construir(c.argumentos())
