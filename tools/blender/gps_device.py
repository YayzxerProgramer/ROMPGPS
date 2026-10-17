"""
Rastreador GPS GNXIS (referencia: FrontEnd/img-blender/gps.webp) — versión realista.

Carcasa de ABS negro brillante en dos conchas con línea de partición, cara
superior abombada tipo "almohada" con el logo impreso, LED de estado bajo una
lente, cara trasera con etiqueta (IMEI, código de barras) y cuatro tornillos
Phillips encastrados. Manguito de cuatro anillos, cable con termorretráctil y
conector de 4 pines con sus cavidades, pines metálicos y aletas de nylon
claro. Arnés trenzado de seis cables con conector de 6 vías, abrazadera,
portafusible con tapa y fusible violeta translúcido con sus láminas.

    blender --background --factory-startup --python tools/blender/gps_device.py

Nodos: gps_gnxis (raíz) > carcasa, impresos, led_estado > led_estado_malla, arnes.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mathutils import Matrix, Vector  # noqa: E402

import comun as c  # noqa: E402
import superficies as s  # noqa: E402
import texturas as t  # noqa: E402

NOMBRE = "gps-device"
PRESUPUESTO = 45_000

# Se modela tumbado: largo en Y (el cable sale por +Y), ancho en X y grosor
# en Z con la cara del logo hacia arriba. Al final se pone de pie para la pose.
L, W, T = 0.086, 0.034, 0.0145
R_PLANTA = 0.0085  # radio de las esquinas en planta
D_MAX = W / 2 - 0.0012  # desplazamiento del anillo más interior
Z_CABLE = 0.0072  # altura del eje del manguito
VERDE = c.VERDE_MARCA


def materiales():
    plastico = t.grano_plastico()
    return {
        "carcasa": t.material_pbr("carcasa_abs", "#060706", rugosidad=0.2, capa=0.55, capa_rugosidad=0.07),
        "goma": t.material_pbr("goma_negra", "#070707", rugosidad=0.55, normal=plastico, escala=(260, 260),
                               fuerza_normal=0.5),
        "termo": c.material("termorretractil", "#0e0e0e", rugosidad=0.3),
        "nylon": t.material_pbr("nylon_negro", "#141414", rugosidad=0.48, normal=plastico, escala=(320, 320),
                                fuerza_normal=0.35),
        "estano": c.material("estano", "#cfcfc4", metal=1.0, rugosidad=0.26),
        "nylon_claro": t.material_pbr("nylon_natural", "#ecebe3", rugosidad=0.42, transmision=0.25),
        "rojo": c.material("cable_rojo", "#a50d18", rugosidad=0.4),
        "amarillo": c.material("cable_amarillo", "#e0a800", rugosidad=0.4),
        "naranja": c.material("cable_naranja", "#d8500c", rugosidad=0.4),
        "negro_cable": c.material("cable_negro", "#141414", rugosidad=0.34),
        "portafusible": c.material("portafusible_blanco", "#eeebe2", rugosidad=0.48),
        "fusible": t.material_pbr("fusible_violeta", "#9b4fd8", rugosidad=0.1, transmision=0.6, ior=1.49),
        "tornillo": c.material("tornillo_pavonado", "#1c1d1f", metal=0.85, rugosidad=0.36),
        "led": c.material("led_verde", VERDE, rugosidad=0.3, emision=VERDE, fuerza_emision=4.0),
        "lente": t.material_pbr("lente_led", "#e4ece5", rugosidad=0.04, transmision=0.85),
    }


# ── Carcasa ──────────────────────────────────────────────────────────────────

def altura_superior(d):
    """Altura de la cara superior a una distancia d del borde (corona suave)."""
    inicio = 0.0045
    if d <= inicio:
        return 0.0133
    x = min((d - inicio) / (D_MAX - inicio), 1.0)
    return 0.0133 + 0.0012 * (x * x * (3 - 2 * x))


def perfil_carcasa():
    """(desplazamiento hacia dentro, z) desde el centro de la cara trasera
    hasta el centro de la superior: fondo, redondeos, paredes, línea de
    partición y la corona superior."""
    p = [(D_MAX, 0.0), (D_MAX * 0.7, 0.0), (D_MAX * 0.45, 0.0), (0.0055, 0.0), (0.0032, 0.0)]
    r = 0.0016  # redondeo inferior
    for a in (250, 230, 210, 190, 180):
        ang = math.radians(a)
        p.append((r + r * math.cos(ang), r + r * math.sin(ang)))
    p += [(0.0, 0.0040), (0.0, 0.0056)]
    # Línea de partición entre las dos conchas.
    p += [(0.00028, 0.00575), (0.00034, 0.0060), (0.00028, 0.00625), (0.0, 0.0064)]
    p += [(0.00008, 0.0080), (0.00015, 0.0094)]
    # Redondeo superior amplio: el aspecto de "almohada" del póster.
    d0, cz, rd, rz = 0.00015, 0.0094, 0.0043, 0.0039
    for a in (165, 150, 135, 120, 105, 90):
        ang = math.radians(a)
        p.append((d0 + rd + rd * math.cos(ang), cz + rz * math.sin(ang)))
    for d in (0.0058, 0.0074, 0.0092, 0.0112, 0.0132, D_MAX * 0.94, D_MAX):
        p.append((d, altura_superior(d)))
    return p


def carcasa(m):
    aros = []
    for d, z in perfil_carcasa():
        contorno = s.rect_redondeado(W / 2 - d, L / 2 - d, R_PLANTA - d, n_lado_x=7, n_lado_y=14, n_esquina=8)
        aros.append([(x, y, z) for x, y in contorno])
    cuerpo = s.anillos("cuerpo", aros, m["carcasa"], tapas=("plana", "plana"), subdiv=0, angulo=55)

    # Cajeados de los tornillos en la cara trasera.
    cortes = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cortes.append(c.cilindro("cajeado", 0.0024, 0.003, pos=(sx * 0.0112, sy * 0.0335, 0.0004), lados=20))
    s.restar(cuerpo, cortes)
    c.sombrear(cuerpo, 55)
    return cuerpo


def tornillos(m):
    piezas = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cabeza = c.torno("tornillo", [
                (0.0, 0.0006), (0.0016, 0.0006), (0.0019, 0.00075), (0.0020, 0.0011), (0.0020, 0.0016),
                (0.0, 0.0016),
            ], pos=(sx * 0.0112, sy * 0.0335, 0.0), mat=m["tornillo"], lados=16)
            ranura = [
                c.caja("ranura", (0.0024, 0.00045, 0.0006), pos=(sx * 0.0112, sy * 0.0335, 0.00055)),
                c.caja("ranura", (0.00045, 0.0024, 0.0006), pos=(sx * 0.0112, sy * 0.0335, 0.00055)),
            ]
            s.restar(cabeza, ranura)
            piezas.append(cabeza)
    return piezas


def impresos(cuerpo):
    """Logo GNXIS en la cara superior y etiqueta en la trasera."""
    logo_img = s.textura_calcomania("gnxis", 0.056, 0.016, [
        {"tipo": "texto", "cuerpo": "GNXIS", "alto": 0.0128, "color": "#8e948d", "espaciado": 1.12},
    ])
    logo = s.calcomania("logo", cuerpo, centro=(0.0, -0.005, 0.015), normal=(0, 0, 1), arriba=(-1, 0, 0),
                        ancho=0.056, alto=0.016, mat=s.material_calcomania("tinta_logo", logo_img, rugosidad=0.38),
                        subdiv=(28, 10))

    barras = []
    x = -0.0095
    patron = [1, 2, 1, 1, 3, 1, 2, 2, 1, 1, 2, 3, 1, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2]
    for i, ancho in enumerate(patron):
        w = 0.00022 * ancho
        if i % 2 == 0:
            barras.append({"tipo": "poligono", "color": "#111111",
                           "puntos": [(x, -0.0128), (x + w, -0.0128), (x + w, -0.0072), (x, -0.0072)]})
        x += w + 0.00018
    etiqueta_img = s.textura_calcomania("etiqueta", 0.024, 0.046, [
        {"tipo": "poligono", "color": "#e9eae6", "puntos": [
            (-0.0115, -0.0225), (0.0115, -0.0225), (0.0115, 0.0225), (-0.0115, 0.0225)]},
        {"tipo": "texto", "cuerpo": "GNXIS", "alto": 0.0042, "pos": (0, 0.0165), "color": "#111111"},
        {"tipo": "texto", "cuerpo": "GPS TRACKER  GT06N", "alto": 0.0016, "pos": (0, 0.0118), "color": "#222222"},
        {"tipo": "texto", "cuerpo": "IMEI 864893034127751", "alto": 0.0016, "pos": (0, 0.0062), "color": "#222222"},
        {"tipo": "texto", "cuerpo": "DC 9-36V  50mA", "alto": 0.0016, "pos": (0, 0.0030), "color": "#222222"},
        {"tipo": "texto", "cuerpo": "S/N GX2611-04892", "alto": 0.0014, "pos": (0, -0.0002), "color": "#333333"},
        *barras,
        {"tipo": "texto", "cuerpo": "CE   FC   RoHS", "alto": 0.0018, "pos": (0, -0.0175), "color": "#111111"},
    ])
    etiqueta = s.calcomania("etiqueta", cuerpo, centro=(0.0, -0.002, -0.001), normal=(0, 0, -1), arriba=(0, 1, 0),
                            ancho=0.024, alto=0.046,
                            mat=s.material_calcomania("papel_etiqueta", etiqueta_img, rugosidad=0.55),
                            subdiv=(6, 10))
    return [logo, etiqueta]


def led(m):
    """Lente del LED (va en la carcasa) y el diodo emisivo (pieza animable)."""
    x, y = -0.0088, L / 2 - 0.0118
    z = altura_superior(0.0088)
    lente = c.torno("lente_led", [
        (0.0, z + 0.00035), (0.0011, z + 0.0003), (0.0014, z + 0.0001), (0.0015, z - 0.0006), (0.0, z - 0.0006),
    ], pos=(x, y, 0), mat=m["lente"], lados=24)
    diodo = c.cilindro("diodo", 0.0008, 0.0004, pos=(x, y, z - 0.0002), mat=m["led"], lados=16)
    return lente, diodo


def cable_y_conector(m):
    """Manguito de cuatro anillos, cable con curva, termorretráctil y conector."""
    piezas = [c.torno("manguito", [
        (0.0, 0.0030), (0.0050, 0.0030), (0.0050, -0.0004), (0.0053, -0.0009), (0.0053, -0.0027),
        (0.0044, -0.0031), (0.0050, -0.0035), (0.0050, -0.0052), (0.0042, -0.0056), (0.0047, -0.0060),
        (0.0047, -0.0076), (0.0039, -0.0080), (0.0044, -0.0084), (0.0044, -0.0099), (0.0035, -0.0104),
        (0.0030, -0.0120), (0.0026, -0.0138), (0.0, -0.0138),
    ], pos=(0, L / 2, Z_CABLE), mat=m["goma"], lados=24, eje="Y")]

    y0 = L / 2 + 0.012
    camino = [
        (0.0, y0, Z_CABLE), (0.0, y0 + 0.018, Z_CABLE), (0.003, y0 + 0.034, Z_CABLE + 0.002),
        (0.010, y0 + 0.047, Z_CABLE + 0.004), (0.017, y0 + 0.056, Z_CABLE + 0.005),
        (0.020, y0 + 0.062, Z_CABLE + 0.005),
    ]
    piezas.append(c.tubo("cable", camino, 0.0024, m["goma"], lados=12, sub=8))
    cx, cz = 0.020, Z_CABLE + 0.005
    y1 = y0 + 0.061
    piezas.append(c.torno("termorretractil", [
        (0.0, 0.0), (0.0026, 0.0), (0.0031, -0.003), (0.0032, -0.020), (0.0034, -0.024), (0.0, -0.024),
    ], pos=(cx, y1, cz), mat=m["termo"], lados=20, eje="Y"))

    # Conector de 4 pines (estilo JST SM): cuerpo, cavidades, pines, cierre y aletas.
    yc = y1 + 0.024 + 0.008
    cuerpo = s.caja_redondeada("conector", (0.0128, 0.016, 0.0086), 0.0009, pos=(cx, yc, cz), mat=m["nylon"],
                               segmentos=2)
    cavidades = [c.caja("cavidad", (0.0021, 0.008, 0.0023), pos=(cx - 0.0045 + i * 0.003, yc + 0.0062, cz))
                 for i in range(4)]
    cavidades.append(c.caja("ventana", (0.004, 0.0035, 0.002), pos=(cx, yc + 0.001, cz + 0.0043)))
    s.restar(cuerpo, cavidades)
    c.sombrear(cuerpo, 45)
    piezas.append(cuerpo)
    for i in range(4):
        piezas.append(c.caja("pin", (0.0007, 0.0062, 0.0007), pos=(cx - 0.0045 + i * 0.003, yc + 0.0034, cz),
                             mat=m["estano"], bisel=0.0001, segmentos=1))
    piezas.append(s.caja_redondeada("pestillo", (0.0034, 0.0042, 0.0006), 0.0002, pos=(cx, yc + 0.001, cz + 0.0036),
                                    mat=m["nylon"], segmentos=1))
    for lado in (-1, 1):
        piezas.append(s.caja_redondeada("aleta", (0.0016, 0.0062, 0.0058), 0.0004,
                                        pos=(cx + lado * 0.0071, yc - 0.0035, cz), mat=m["nylon_claro"], segmentos=2))
    return piezas


# ── Arnés ────────────────────────────────────────────────────────────────────

def arnes(m):
    """Seis cables trenzados enrollados alrededor de la base del equipo."""
    piezas = []
    centro = Vector((0.0, 0.004, 0.0))
    inicio = math.radians(120)
    vueltas = 1.12
    n = 90
    radio_haz = 0.0030
    r_cable = 0.00118

    def centro_haz(k):
        a = inicio + 2 * math.pi * vueltas * k / n
        r = 0.036 + 0.0016 * math.sin(3 * a)
        z = radio_haz + r_cable + 0.0006 * (1 + math.sin(2 * a)) + 0.004 * max(0.0, (k / n - 0.86) / 0.14)
        return Vector((r * math.cos(a), r * math.sin(a) * 0.92, z)) + centro, a

    trazas = [centro_haz(k) for k in range(n + 1)]
    colores = ["rojo", "amarillo", "naranja", "negro_cable", "rojo", "amarillo", "naranja", "rojo"]
    for i, color in enumerate(colores):
        fase = 2 * math.pi * i / len(colores)
        puntos = []
        for k, (p, _a) in enumerate(trazas):
            tangente = (trazas[min(k + 1, n)][0] - trazas[max(k - 1, 0)][0]).normalized()
            lado = tangente.cross(Vector((0, 0, 1))).normalized()
            arriba = lado.cross(tangente).normalized()
            giro = fase + k * 0.35  # trenzado
            puntos.append(p + (lado * math.cos(giro) + arriba * math.sin(giro)) * radio_haz)
        piezas.append(c.tubo(f"hilo_{color}_{i}", puntos, r_cable, m[color], lados=8, sub=1))

    # Conector de 6 vías al inicio.
    p0, a0 = trazas[0]
    giro0 = math.degrees(a0) + 90
    rot0 = Matrix.Rotation(math.radians(giro0), 4, "Z")
    base0 = p0 + rot0 @ Vector((0, -0.010, 0)) + Vector((0, 0, 0.0063 - p0.z))
    piezas.append(s.caja_redondeada("conector_arnes", (0.0165, 0.021, 0.0125), 0.0012, pos=base0, rot=(0, 0, giro0),
                                    mat=m["nylon"], segmentos=2))
    for i in range(6):
        fila, col = divmod(i, 3)
        pos = base0 + rot0 @ Vector(((col - 1) * 0.0045, 0.0105, (fila - 0.5) * 0.0045))
        piezas.append(c.cilindro("sello", 0.0016, 0.0012, pos=pos, rot=(90, 0, giro0), mat=m["goma"], lados=10))

    # Abrazadera a media vuelta.
    k = n // 2
    p, _a = trazas[k]
    tangente = (trazas[k + 1][0] - trazas[k - 1][0]).normalized()
    ang = math.degrees(math.atan2(tangente.y, tangente.x))
    giro = Matrix.Rotation(math.radians(ang), 4, "Z")
    banda = [p + giro @ Vector((0, math.cos(2 * math.pi * j / 16) * 0.0045, math.sin(2 * math.pi * j / 16) * 0.0045))
             for j in range(17)]
    piezas.append(c.tubo("abrazadera", banda, 0.0007, m["negro_cable"], lados=6, sub=1))
    piezas.append(s.caja_redondeada("cabeza_abrazadera", (0.0045, 0.0034, 0.0034), 0.0005,
                                    pos=p + Vector((0, 0, 0.005)), rot=(0, 0, ang), mat=m["negro_cable"], segmentos=1))

    # Portafusible al final, con el fusible violeta encajado.
    p1, a1 = trazas[-1]
    giro1 = math.degrees(a1) + 90
    rot1 = Matrix.Rotation(math.radians(giro1), 4, "Z")
    base = p1 + rot1 @ Vector((0, 0.012, 0)) + Vector((0, 0, 0.0065 - p1.z))
    piezas.append(s.caja_redondeada("portafusible", (0.0175, 0.033, 0.013), 0.003, pos=base, rot=(0, 0, giro1),
                                    mat=m["portafusible"], segmentos=3))
    tapa_pos = base + Vector((0, 0, 0.0074))
    piezas.append(s.caja_redondeada("fusible", (0.0152, 0.0048, 0.0118), 0.0009,
                                    pos=tapa_pos + rot1 @ Vector((0, 0.002, 0.0028)), rot=(0, 0, giro1),
                                    mat=m["fusible"], segmentos=2))
    for lado in (-1, 1):
        piezas.append(c.caja("lamina", (0.0028, 0.0006, 0.0075),
                             pos=tapa_pos + rot1 @ Vector((lado * 0.0036, 0.002, 0.0006)), rot=(0, 0, giro1),
                             mat=m["estano"]))
    return piezas


# ── Ensamblado ───────────────────────────────────────────────────────────────

def construir(opciones):
    c.nueva_escena()
    m = materiales()

    cuerpo = carcasa(m)
    calcos = impresos(cuerpo)
    lente, diodo = led(m)
    piezas = [cuerpo, lente] + tornillos(m) + cable_y_conector(m) + calcos

    # De pie (+90° en X: la cara del logo mira al frente, -Y) e inclinado.
    pose = (Matrix.Rotation(math.radians(-14), 4, "Y") @ Matrix.Rotation(math.radians(-10), 4, "X")
            @ Matrix.Rotation(math.radians(90), 4, "X"))
    for obj in piezas + [diodo]:
        obj.data.transform(pose)
    minimo_z = min(v.co.z for obj in piezas for v in obj.data.vertices)
    elevar = Matrix.Translation((0, 0, -minimo_z))
    for obj in piezas + [diodo]:
        obj.data.transform(elevar)
    centro_led = sum((v.co for v in diodo.data.vertices), Vector()) / len(diodo.data.vertices)

    raiz = c.vacio("gps_gnxis")
    calcomanias = [p for p in piezas if p.get("calcomania")]
    solidas = [p for p in piezas if not p.get("calcomania")]
    c.colgar(c.unir("carcasa", solidas), raiz)
    c.colgar(c.unir("impresos", calcomanias), raiz)
    c.pieza_animable("led_estado", [diodo], centro_led, raiz)
    c.colgar(c.unir("arnes", arnes(m)), raiz)

    c.validar(NOMBRE, PRESUPUESTO)
    c.exportar_glb(os.path.join(opciones["salida"], f"{NOMBRE}.glb"))
    c.poster(opciones, NOMBRE, 800, 800, azimut=24, elevacion=14)


if __name__ == "__main__":
    construir(c.argumentos())
