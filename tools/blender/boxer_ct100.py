"""
Bajaj Boxer CT 100 (referencia: FrontEnd/img-blender/boxer ct 100.webp) — versión realista.

Modelada contra la foto: la cámara de la foto está calibrada
(referencias/boxer-ct100.json) y las cotas de tanque, asiento, faro, escape,
motor, defensa y guardabarros se midieron retroproyectando píxeles de la foto
sobre planos conocidos (calibrar.py --medir).

Medidas de ficha: entre ejes 1,285 m, largo 1,945 m, rines 17"
(2.75-17 / 3.00-17), frenos de tambor, lanzamiento ~26°.

    blender --background --factory-startup --python tools/blender/boxer_ct100.py

Nodos: boxer_ct100 (raíz) > chasis, motor, escape, carroceria, calcomanias,
asiento, direccion, faro_delantero, luz_trasera, suspension_trasera,
rueda_delantera > rueda_delantera_malla, rueda_trasera > rueda_trasera_malla.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mathutils import Vector  # noqa: E402

import comun as c  # noqa: E402
import piezas_moto as pm  # noqa: E402
import superficies as s  # noqa: E402
import texturas as t  # noqa: E402

NOMBRE = "boxer-ct100"
PRESUPUESTO = 160_000

ENTRE_EJES = 1.285
YF, YR = -ENTRE_EJES / 2, ENTRE_EJES / 2
RF, RR = 0.277, 0.283  # radio exterior de los neumáticos (2.75-17 / 3.00-17)
R_LLANTA = 0.2159  # rin de 17"
RAKE = 26
LARGO_HORQUILLA = 0.68
TURQUESA = "#18b7b5"


def materiales():
    m = pm.materiales_base()
    laca = t.piel_naranja()
    m.update({
        "pintura": t.material_pbr("pintura_negra", "#070808", rugosidad=0.22, capa=1.0, capa_rugosidad=0.03,
                                  capa_normal=laca, escala=(6, 6)),
        "visera": t.material_pbr("visera_ahumada", "#1e2a2e", rugosidad=0.04, transmision=0.55, ior=1.49),
        "motor_gris": t.material_pbr("motor_gris_claro", "#c8cbca", metal=0.85, rugosidad=0.36,
                                     normal=t.aluminio_fundido(), escala=(160, 160), fuerza_normal=0.5),
        "cilindro": t.material_pbr("cilindro_negro", "#151616", metal=0.35, rugosidad=0.5,
                                   normal=t.aluminio_fundido(), escala=(160, 160), fuerza_normal=0.5),
        "resorte": c.material("resorte_rojo", "#b8321a", metal=0.3, rugosidad=0.35, capa=0.6),
        "neumatico_del": t.material_pbr("neumatico_costillas", "#151515", rugosidad=0.86,
                                        normal=t.dibujo_neumatico("costillas"), fuerza_normal=1.0),
        "neumatico_tra": t.material_pbr("neumatico_tacos", "#151515", rugosidad=0.86,
                                        normal=t.dibujo_neumatico("tacos"), fuerza_normal=1.0),
        "capuchon": c.material("capuchon_bujia", "#1a1a1a", rugosidad=0.55),
    })
    return m


# ── Ruedas ───────────────────────────────────────────────────────────────────

def ruedas(m, raiz):
    delantera = pm.rueda_radios("rueda_delantera", RF, 0.066, R_LLANTA, 0.062, 0.11, m, m["neumatico_del"],
                                lado_freno=-1)
    c.mover(delantera, (0, YF, RF))
    c.pieza_animable("rueda_delantera", delantera, (0, YF, RF), raiz)

    trasera = pm.rueda_radios("rueda_trasera", RR, 0.074, R_LLANTA, 0.075, 0.13, m, m["neumatico_tra"],
                              lado_freno=-1)
    trasera.append(pm.corona("corona", 41, 0.082, 0.072, m))
    c.mover(trasera, (0, YR, RR))
    c.pieza_animable("rueda_trasera", trasera, (0, YR, RR), raiz)


# ── Dirección: horquilla, manubrio, carenado bikini y faro ───────────────────

def contorno_carenado(semi_inf, semi_sup, z0, z1, n=6):
    """Trapecio (más ancho arriba) en el plano XZ, antihorario, con las
    esquinas suavizadas por Catmull-Rom."""
    esquinas = [(semi_inf, z0), (semi_sup, z1), (-semi_sup, z1), (-semi_inf, z0)]
    puntos = []
    for i, (x, z) in enumerate(esquinas):
        sig = esquinas[(i + 1) % 4]
        for k in range(n):
            f = k / n
            puntos.append(Vector((x + (sig[0] - x) * f, z + (sig[1] - z) * f, 0)))
    return [(p.x, p.y) for p in c.catmull_rom(puntos, 1, cerrado=True)]


# Ojo del faro (vista frontal, medido: lente de z 0,744 a 0,883 y ±0,1 m):
# borde superior recto, laterales en punta y base redondeada.
OJO = [(-0.1, 0.852), (-0.094, 0.8), (-0.062, 0.758), (0.0, 0.744), (0.062, 0.758), (0.094, 0.8), (0.1, 0.852),
       (0.094, 0.884), (-0.094, 0.884)]
CENTRO_OJO = (0.0, 0.815)
Z_FARO = 0.815
N_CARENADO = 48


def trapecio(semi_inf, semi_sup, z0, z1):
    return [(semi_inf, z0), (semi_sup, z1), (-semi_sup, z1), (-semi_inf, z0)]


def anillo_polar(y, poligono, escala=1.0, dz_sup=0.0):
    """Anillo del carenado o del faro muestreado en polar desde el centro
    del faro: todos los anillos tienen vértices correspondientes."""
    cx, cz = CENTRO_OJO
    aro = []
    for x, z in s.contorno_polar(poligono, N_CARENADO, CENTRO_OJO):
        x2, z2 = cx + (x - cx) * escala, cz + (z - cz) * escala
        if z2 > cz:
            z2 += dz_sup * (z2 - cz) / 0.07
        aro.append((x2, y, z2))
    return aro


def anillo_ojo(y, escala=1.0):
    return anillo_polar(y, OJO, escala)


def direccion(m):
    piezas, _tope = pm.horquilla((0, YF, RF), RAKE, LARGO_HORQUILLA, 0.074, 0.0165, 0.0235, 0.3, m["cromo"],
                                 m["aluminio"], m, cubre_barras=(0.43, 0.6, 0.0255), reflectores=True)
    centro = Vector((0, -0.335, 0.955))
    piezas += pm.manubrio(centro, 0.335, 0.185, 0.04, m, destino_cables=(0, -0.3, 0.72))
    for lado in (-1, 1):
        piezas += pm.espejo((lado * 0.24, -0.25, 0.99), lado, m, alto=0.12, abierto=0.035, estilo="ovalo",
                            retroceso=0.13)

    # Carenado bikini en forma de embudo: nace en el contorno de la lente y se
    # abre hacia atrás (frente inclinado hasta la visera, laterales en ángulo).
    aros = [
        anillo_polar(-0.527, OJO, 1.03),
        anillo_polar(-0.52, OJO, 1.1, 0.012),
        anillo_polar(-0.5, trapecio(0.104, 0.122, 0.735, 0.925)),
        anillo_polar(-0.46, trapecio(0.11, 0.13, 0.735, 0.955)),
        anillo_polar(-0.43, trapecio(0.105, 0.128, 0.742, 0.968)),
        anillo_polar(-0.405, trapecio(0.085, 0.105, 0.755, 0.968)),
        anillo_polar(-0.39, trapecio(0.05, 0.062, 0.78, 0.948)),
    ]
    piezas.append(s.anillos("carenado", aros, m["pintura"], tapas=(None, "plana"), subdiv=1, angulo=40))
    piezas.append(c.cilindro("emblema", 0.008, 0.003, pos=(0.082, -0.5, 0.905), rot=(-25, 0, 0), mat=m["cromo"],
                             lados=20, eje="Y"))
    # Barbilla bajo el faro con la abertura de la bocina.
    piezas.append(s.caja_redondeada("bocina", (0.07, 0.04, 0.03), 0.012, pos=(0, -0.49, 0.715),
                                    mat=m["negro_satinado"], segmentos=2))

    # Visera ahumada: lámina curvada que envuelve el frente.
    filas = []
    for i in range(6):
        f = i / 5
        semi = 0.126 - 0.01 * f
        fila = []
        for k in range(13):
            u = -1 + 2 * k / 12
            fila.append((semi * u, -0.506 + 0.066 * f + 0.042 * u * u, 0.918 + 0.082 * f - 0.024 * u * u * f))
        filas.append(fila)
    piezas.append(s.lamina("visera", filas, m["visera"], grosor=0.003,
                           exterior=lambda p: Vector((0, -1, 0.7)), subdiv=1))
    for lado in (-1, 1):
        piezas += pm.perno((lado * 0.118, -0.47, 0.948), "-Y", r=0.0045, largo=0.003, m=m, mat=m["zincado"],
                           arandela=False)

    # Velocímetro tras la visera, con su esfera.
    piezas.append(c.cilindro("velocimetro", 0.05, 0.045, pos=(0, -0.415, 0.94), rot=(-60, 0, 0), mat=m["plastico"],
                             lados=32, bisel=0.008, segmentos=2))
    marcas = [{"tipo": "trazo", "color": "#e8ecec", "ancho": 0.0016,
               "puntos": [(0.034 * math.cos(math.radians(a)), 0.034 * math.sin(math.radians(a))),
                          (0.04 * math.cos(math.radians(a)), 0.04 * math.sin(math.radians(a)))]}
              for a in range(-40, 230, 27)]
    esfera = s.textura_calcomania("esfera", 0.09, 0.09, [
        {"tipo": "poligono", "color": "#0a0b0b", "puntos": [(-0.045, -0.045), (0.045, -0.045), (0.045, 0.045),
                                                            (-0.045, 0.045)]},
        *marcas,
        {"tipo": "texto", "cuerpo": "km/h", "alto": 0.008, "pos": (0, -0.018), "color": "#e8ecec"},
        {"tipo": "trazo", "color": "#ff6a1a", "ancho": 0.0022, "puntos": [(0, 0), (-0.026, 0.02)]},
    ])
    piezas.append(c.cilindro("cristal_velocimetro", 0.042, 0.002, pos=(0, -0.404, 0.958), rot=(-60, 0, 0),
                             mat=s.material_calcomania("esfera_velocimetro", esfera, rugosidad=0.1), lados=32))
    for lado in (-1, 1):
        piezas += pm.direccional((lado * 0.1, -0.44, 0.875), lado, m, tallo=0.065, radio=0.017, largo=0.042)

    # Guardabarros delantero: lámina en arco que abraza el neumático
    # (medido: punta y −0,84 z 0,54; cima z 0,60).
    rg = RF + 0.016
    filas = []
    for a in [196 - (196 - 48) * i / 13 for i in range(14)]:
        ang = math.radians(a)
        fila = []
        for k in range(11):
            u = -1 + 2 * k / 10
            r = rg + 0.016 * (1 - u * u) - 0.004 * u ** 4
            fila.append((0.062 * u, YF + r * math.cos(ang), RF + r * math.sin(ang)))
        filas.append(fila)
    piezas.append(s.lamina("guardabarros_delantero", filas, m["pintura"], grosor=0.003,
                           exterior=lambda p: Vector((0, p.y - YF, p.z - RF)), subdiv=1))
    d = pm.eje_direccion(RAKE)
    soporte = Vector((0, YF, RF)) + d * (rg - 0.005)
    for lado in (-1, 1):
        piezas.append(s.caja_redondeada("soporte_guardabarros", (0.03, 0.05, 0.02), 0.005,
                                        pos=soporte + Vector((lado * 0.066, 0, 0)), rot=(-RAKE, 0, 0),
                                        mat=m["negro_satinado"], segmentos=1))
    # Leva y cable del freno de tambor.
    piezas.append(c.tubo("leva_freno", [(-0.075, YF + 0.03, RF + 0.05), (-0.08, YF + 0.075, RF + 0.11)], 0.005,
                         m["aluminio"], lados=8, sub=1))
    piezas.append(c.tubo("cable_freno", [(-0.08, YF + 0.075, RF + 0.11), (-0.085, YF + 0.12, RF + 0.3),
                                         (-0.07, -0.36, 0.86), (-0.2, -0.24, 0.95)], 0.0035, m["negro_satinado"],
                         lados=8, sub=8))

    # Faro hundido en el hueco: reflector multifaceta, bombillo y lente.
    faro = [
        s.anillos("lente_faro", [anillo_ojo(-0.538, 0.94), anillo_ojo(-0.533, 0.99), anillo_ojo(-0.526, 1.0)],
                  m["lente_clara"], tapas=("plana", "plana"), subdiv=1),
        # Reflector multifaceta: pocas caras y sombreado plano (cada faceta
        # recoge la luz del estudio por separado, como en la foto).
        s.anillos("reflector_faro", [anillo_ojo(-0.525, 1.0), anillo_ojo(-0.512, 0.82), anillo_ojo(-0.5, 0.62),
                                     anillo_ojo(-0.49, 0.4)],
                  m["reflector"], tapas=(None, "punto"), subdiv=0, angulo=5),
        c.esfera("bombillo", 0.011, pos=(0, -0.505, Z_FARO), mat=m["led"], segmentos=12, anillos=6),
        c.cilindro("proyector", 0.024, 0.012, pos=(0.035, -0.515, Z_FARO + 0.008), mat=m["reflector"], lados=20,
                   eje="Y"),
    ]
    return piezas, faro


# ── Chasis ───────────────────────────────────────────────────────────────────

def chasis(m):
    d = pm.eje_direccion(RAKE)
    tope = Vector((0, YF, RF)) + d * LARGO_HORQUILLA
    piezas = [
        c.tubo("pipa_direccion", [tope - d * 0.17, tope - d * 0.03], 0.027, m["chasis"], lados=16, sub=1),
        c.tubo("espina", [(0, -0.36, 0.8), (0, -0.15, 0.76), (0, 0.06, 0.72), (0, 0.12, 0.6), (0, 0.12, 0.42)],
               0.024, m["chasis"], lados=12, sub=6),
        c.tubo("bajante", [(0, -0.385, 0.74), (0, -0.37, 0.55), (0, -0.33, 0.36), (0, -0.25, 0.22),
                           (0, 0.02, 0.2), (0, 0.11, 0.3), (0, 0.12, 0.42)], 0.021, m["chasis"], lados=12, sub=6),
        c.cilindro("eje_basculante", 0.016, 0.22, pos=(0, 0.09, 0.37), mat=m["zincado"], lados=12, eje="X"),
    ]
    for lado in (-1, 1):
        x = lado * 0.1
        piezas.append(c.tubo("subchasis", [(x * 0.4, 0.05, 0.66), (x, 0.3, 0.655), (x, 0.65, 0.665), (x * 0.9, 0.95, 0.68)],
                             0.015, m["chasis"], lados=10, sub=5))
        piezas.append(c.tubo("tirante", [(x * 0.5, 0.12, 0.42), (x, 0.36, 0.54), (x, 0.6, 0.655)], 0.014, m["chasis"],
                             lados=10, sub=5))
        # Defensa de motor (medida en x = ±0,17).
        piezas.append(c.tubo("defensa", [(lado * 0.02, -0.37, 0.64), (lado * 0.12, -0.43, 0.58),
                                         (lado * 0.17, -0.455, 0.5), (lado * 0.172, -0.44, 0.38),
                                         (lado * 0.165, -0.4, 0.27), (lado * 0.11, -0.33, 0.215),
                                         (lado * 0.03, -0.26, 0.205)], 0.0135, m["chasis"], lados=12, sub=6))
        # Basculante de sección rectangular.
        piezas.append(c.prisma("basculante", [(0.08, 0.395), (0.66, 0.31), (0.66, 0.272), (0.08, 0.345)],
                               lado * 0.072, lado * 0.098, m["chasis"], bisel=0.006, segmentos=2))
        piezas += pm.estribo((lado * 0.1, -0.016, 0.28), lado, m, largo=0.115)
        piezas += pm.estribo((lado * 0.11, 0.40, 0.38), lado, m, largo=0.07)
        piezas += pm.perno((lado * 0.1, 0.09, 0.37), "X" if lado > 0 else "-X", r=0.009, largo=0.007, m=m)
    # Pedal de freno (derecho) y caballete central plegado.
    piezas.append(c.tubo("pedal_freno", [(-0.105, 0.0, 0.29), (-0.13, -0.1, 0.26), (-0.14, -0.18, 0.26)], 0.008,
                         m["chasis"], lados=8, sub=5))
    piezas.append(s.caja_redondeada("goma_pedal", (0.05, 0.03, 0.014), 0.005, pos=(-0.15, -0.19, 0.265),
                                    mat=m["goma"], segmentos=2))
    for lado in (-1, 1):
        piezas.append(c.tubo("caballete", [(lado * 0.09, 0.1, 0.24), (lado * 0.11, 0.3, 0.17), (lado * 0.12, 0.42, 0.13)],
                             0.012, m["chasis"], lados=10, sub=4))
    # Cubrecadena integral (lado izquierdo).
    piezas.append(c.barrido("cubrecadena", [(0.0, 0.37), (0.3, 0.345), (0.67, 0.31)], [
        (0.0, 0.016, 0.06, 0.06, 2.0), (0.12, 0.018, 0.072, 0.07, 2.4), (0.88, 0.018, 0.098, 0.096, 2.4),
        (1.0, 0.016, 0.09, 0.09, 2.2),
    ], m["negro_satinado"], x=0.082, lados=16, sub=5))
    # Parrilla trasera tubular y asideros.
    for lado in (-1, 1):
        x = lado * 0.125
        piezas.append(c.tubo("parrilla_lateral", [(x * 0.9, 0.55, 0.745), (x, 0.7, 0.768), (x, 0.92, 0.772),
                                                   (x * 0.65, 1.04, 0.77), (0, 1.065, 0.768)],
                             0.0095, m["chasis"], lados=10, sub=6))
        piezas.append(c.tubo("apoyo_parrilla", [(x, 0.84, 0.772), (x * 0.85, 0.87, 0.69)], 0.008, m["chasis"],
                             lados=8, sub=1))
    for y in (0.82, 0.9, 0.98):
        piezas.append(c.tubo("travesano", [(-0.12, y, 0.773), (0.12, y, 0.773)], 0.0075, m["chasis"], lados=8, sub=1))
    return piezas


# ── Motor y escape ───────────────────────────────────────────────────────────

def motor(m):
    piezas = [
        s.caja_redondeada("carter", (0.21, 0.36, 0.21), 0.05, pos=(0, -0.14, 0.37), mat=m["motor_gris"], segmentos=4),
        # Tapa derecha: embrague (medida: centro y −0,19 z 0,39) con emblema.
        c.torno("tapa_embrague", [
            (0.0, -0.148), (0.03, -0.148), (0.06, -0.146), (0.078, -0.14), (0.088, -0.128), (0.092, -0.11),
            (0.0, -0.11),
        ], pos=(0, -0.186, 0.386), mat=m["motor_gris"], lados=48, eje="X"),
        c.cilindro("emblema", 0.026, 0.004, pos=(-0.149, -0.186, 0.386), mat=m["negro_satinado"], lados=32, eje="X"),
        s.caja_redondeada("tapa_derecha", (0.04, 0.26, 0.18), 0.03, pos=(-0.105, -0.12, 0.34), mat=m["motor_gris"],
                          segmentos=3),
        c.torno("tapa_volante", [
            (0.0, 0.142), (0.05, 0.142), (0.072, 0.136), (0.08, 0.124), (0.08, 0.1), (0.0, 0.1),
        ], pos=(0, -0.24, 0.33), mat=m["motor_gris"], lados=40, eje="X"),
        s.caja_redondeada("tapa_pinon", (0.035, 0.13, 0.11), 0.02, pos=(0.105, -0.02, 0.34), mat=m["negro_satinado"],
                          segmentos=2),
        c.cilindro("tapon_aceite", 0.012, 0.018, pos=(-0.13, -0.07, 0.29), mat=m["negro_satinado"], lados=8, eje="X"),
    ]
    for i in range(10):
        a = 2 * math.pi * i / 10
        y, z = -0.186 + 0.082 * math.cos(a), 0.386 + 0.082 * math.sin(a)
        piezas += pm.perno((-0.13, y, z), "-X", r=0.0045, largo=0.004, m=m, arandela=False)
    # Cilindro negro aleteado inclinado 15°, culata y bujía.
    eje = Vector((0, -math.sin(math.radians(15)), math.cos(math.radians(15))))
    base = Vector((0, -0.215, 0.44))
    piezas.append(c.tubo("camisa", [base, base + eje * 0.17], 0.045, m["cilindro"], lados=20, sub=1))
    for i in range(8):
        escala = 1.0 - i * 0.02
        piezas.append(s.caja_redondeada("aleta", (0.19 * escala, 0.17 * escala, 0.0055), 0.0025,
                                        pos=base + eje * (0.025 + i * 0.0185), rot=(15, 0, 0), mat=m["cilindro"],
                                        segmentos=1))
    culata = base + eje * 0.185
    piezas.append(s.caja_redondeada("culata", (0.16, 0.15, 0.055), 0.016, pos=culata, rot=(15, 0, 0),
                                    mat=m["cilindro"], segmentos=2))
    piezas.append(s.caja_redondeada("tapa_valvulas", (0.12, 0.11, 0.03), 0.012, pos=culata + eje * 0.04,
                                    rot=(15, 0, 0), mat=m["motor_gris"], segmentos=2))
    piezas.append(c.tubo("capuchon", [culata + Vector((-0.07, -0.02, 0.0)), culata + Vector((-0.1, 0.0, 0.03)),
                                      culata + Vector((-0.11, 0.06, 0.05))], 0.011, m["capuchon"], lados=10, sub=4))
    piezas.append(c.tubo("cable_bujia", [culata + Vector((-0.11, 0.06, 0.05)), Vector((-0.09, 0.0, 0.66)),
                                         Vector((-0.05, 0.08, 0.68))], 0.0035, m["negro_satinado"], lados=6, sub=6))
    # Carburador y filtro detrás del cilindro.
    piezas.append(c.cilindro("carburador", 0.026, 0.07, pos=(0, -0.13, 0.55), rot=(80, 0, 0), mat=m["aluminio"],
                             lados=16, bisel=0.004))
    piezas.append(s.caja_redondeada("filtro", (0.15, 0.28, 0.13), 0.03, pos=(0, 0.06, 0.6), mat=m["negro_satinado"],
                                    segmentos=2))
    piezas.append(s.caja_redondeada("bateria", (0.15, 0.12, 0.12), 0.012, pos=(0, 0.25, 0.6),
                                    mat=m["negro_satinado"], segmentos=2))
    # Pedal de arranque (medido: goma en y −0,07 z 0,49) y palanca de cambios.
    piezas.append(c.tubo("palanca_arranque", [(-0.13, 0.02, 0.4), (-0.15, -0.02, 0.45), (-0.16, -0.06, 0.48)],
                         0.008, m["negro_satinado"], lados=8, sub=4))
    piezas.append(c.tubo("goma_arranque", [(-0.135, -0.074, 0.487), (-0.195, -0.074, 0.487)], 0.011, m["goma"],
                         lados=12, sub=1))
    piezas.append(c.tubo("cambios", [(0.11, -0.02, 0.3), (0.14, -0.12, 0.28), (0.15, -0.2, 0.29)], 0.008,
                         m["negro_satinado"], lados=8, sub=4))
    return piezas


def escape(m):
    """Colector bajo el motor y silenciador casi horizontal hasta y +0,91
    (medido), con escudo térmico cromado atornillado y punta cónica."""
    piezas = [c.tubo("colector", [(-0.02, -0.32, 0.5), (-0.05, -0.39, 0.42), (-0.08, -0.39, 0.3), (-0.11, -0.33, 0.25),
                                  (-0.14, -0.15, 0.25), (-0.155, -0.02, 0.26)], 0.019, m["negro_satinado"], lados=14,
                         sub=8)]
    piezas.append(c.barrido("silenciador", [(-0.04, 0.245), (0.2, 0.252), (0.5, 0.262), (0.84, 0.28)], [
        (0.0, 0.02, 0.02, 0.02, 2.0), (0.08, 0.034, 0.034, 0.034, 2.0), (0.2, 0.046, 0.046, 0.046, 2.0),
        (1.0, 0.05, 0.05, 0.05, 2.0),
    ], m["negro_satinado"], x=-0.155, lados=28, sub=6))
    piezas.append(c.torno("punta_escape", [
        (0.0, 0.0), (0.05, 0.0), (0.049, -0.012), (0.042, -0.05), (0.03, -0.075), (0.018, -0.08), (0.0, -0.08),
    ], pos=(-0.155, 0.84, 0.28), mat=m["negro_satinado"], lados=28, eje="Y"))
    piezas.append(c.cilindro("salida", 0.016, 0.03, pos=(-0.155, 0.925, 0.282), mat=m["pavonado"], lados=16, eje="Y"))
    # Escudo térmico: concha cromada que cubre la cara exterior-superior.
    aros = []
    for k in range(9):
        f = k / 8
        y = 0.38 + 0.42 * f
        z = 0.258 + 0.018 * f
        ancho = 0.35 + 0.65 * math.sin(math.pi * min(1.0, f * 1.15 + 0.08))
        ida = []
        for j in range(9):
            a = math.radians(-25 + 135 * j / 8) * (0.55 + 0.45 * ancho)
            ida.append(Vector((-0.155 - 0.056 * math.cos(a), y, z + 0.056 * math.sin(a))))
        vuelta = [Vector((-0.155 - (abs(p.x + 0.155) - 0.003), p.y, p.z - 0.001)) for p in reversed(ida)]
        aros.append(ida + vuelta)
    piezas.append(s.anillos("escudo_termico", aros, m["cromo"], tapas=("plana", "plana"), subdiv=1, angulo=50))
    for y in (0.45, 0.7):
        piezas += pm.perno((-0.212, y, 0.285), "-X", r=0.0055, largo=0.004, m=m, mat=m["cromo"], arandela=False)
    piezas.append(s.caja_redondeada("soporte_escape", (0.06, 0.03, 0.08), 0.008, pos=(-0.13, 0.62, 0.36),
                                    mat=m["chasis"], segmentos=2))
    return piezas


# ── Carrocería ───────────────────────────────────────────────────────────────

def medio_tanque(w, zt, zb, rodilla=0.0):
    """Medio corte del tanque (x, z) del eje superior al inferior: techo
    amplio, flanco abombado, hueco de rodilla y fondo recogido sobre el chasis."""
    return [
        (0.0, zt), (0.3 * w, zt - 0.004), (0.58 * w, zt - 0.014), (0.8 * w, zt - 0.032), (0.94 * w, zt - 0.058),
        (w, zt - 0.092), (w - rodilla, zt - 0.13), (0.97 * w - rodilla, zb + 0.05), (0.88 * w, zb + 0.018),
        (0.66 * w, zb), (0.3 * w, zb + 0.012), (0.0, zb + 0.03),
    ]


def carroceria(m):
    claves = [
        s.seccion(medio_tanque(0.075, 0.8, 0.73), y=-0.43),
        s.seccion(medio_tanque(0.12, 0.832, 0.7), y=-0.38),
        s.seccion(medio_tanque(0.145, 0.846, 0.675), y=-0.3),
        s.seccion(medio_tanque(0.155, 0.852, 0.66), y=-0.18),
        s.seccion(medio_tanque(0.152, 0.846, 0.66, 0.012), y=-0.06),
        s.seccion(medio_tanque(0.135, 0.83, 0.67, 0.02), y=0.04),
        s.seccion(medio_tanque(0.105, 0.81, 0.69, 0.01), y=0.1),
        s.seccion(medio_tanque(0.07, 0.795, 0.72), y=0.135),
    ]
    tanque = s.anillos("tanque", s.interpolar_secciones(claves, 4), m["pintura"], tapas=("plana", "plana"),
                       subdiv=1, angulo=40)
    piezas = [tanque]
    tapon_z = max(v.co.z for v in tanque.data.vertices if abs(v.co.y + 0.22) < 0.03 and abs(v.co.x) < 0.04)
    piezas.append(c.cilindro("tapon", 0.038, 0.014, pos=(0, -0.22, tapon_z + 0.004), mat=m["cromo"], lados=32,
                             bisel=0.005, segmentos=2))
    piezas.append(c.cilindro("cerradura", 0.008, 0.004, pos=(0.012, -0.22, tapon_z + 0.0115), mat=m["pavonado"],
                             lados=12))

    # Tapas laterales: láminas abombadas bajo la parte delantera del asiento.
    tapas = []
    for lado in (-1, 1):
        filas = []
        for y, zt, zb in ((0.03, 0.66, 0.585), (0.12, 0.675, 0.53), (0.25, 0.678, 0.505), (0.38, 0.672, 0.525),
                          (0.45, 0.655, 0.58)):
            fila = []
            for k in range(7):
                f = k / 6
                z = zt + (zb - zt) * f
                fila.append((lado * (0.108 + 0.024 * math.sin(math.pi * (0.15 + 0.7 * f))), y, z))
            filas.append(fila)
        tapas.append(s.lamina(f"tapa_lateral_{lado}", s.interpolar_secciones(filas, 3), m["pintura"], grosor=0.003,
                              exterior=lambda p, lado=lado: Vector((lado, 0, 0)), subdiv=1))
    piezas += tapas
    colin = c.barrido("colin", [(0.42, 0.65), (0.66, 0.672), (0.9, 0.684), (1.0, 0.67)], [
        (0.0, 0.11, 0.035, 0.05, 3.0), (0.6, 0.11, 0.04, 0.05, 3.2), (1.0, 0.07, 0.03, 0.04, 3.0),
    ], m["pintura"], lados=28, sub=6)
    piezas.append(colin)
    # Guardabarros trasero (lámina) y faldón largo (medido: hasta z 0,46 en y 0,97).
    rg = RR + 0.03
    filas = []
    for a in [120 - (120 - 20) * i / 10 for i in range(11)]:
        ang = math.radians(a)
        fila = []
        for k in range(11):
            u = -1 + 2 * k / 10
            r = rg + 0.014 * (1 - u * u)
            fila.append((0.066 * u, YR + r * math.cos(ang), RR + r * math.sin(ang)))
        filas.append(fila)
    piezas.append(s.lamina("guardabarros_trasero", filas, m["plastico"], grosor=0.003,
                           exterior=lambda p: Vector((0, p.y - YR, p.z - RR)), subdiv=1))
    filas = []
    for i in range(6):
        f = i / 5
        y = 0.915 + 0.03 * f
        z = 0.66 - 0.235 * f
        filas.append([(0.066 * (-1 + 2 * k / 6), y + 0.006 * (1 - (-1 + 2 * k / 6) ** 2), z) for k in range(7)])
    piezas.append(s.lamina("faldon", filas, m["plastico"], grosor=0.004, exterior=lambda p: Vector((0, 1, 0)),
                           subdiv=1))
    for lado in (-1, 1):
        piezas += pm.direccional((lado * 0.07, 0.96, 0.615), lado, m, tallo=0.045, radio=0.015, largo=0.036)
    return piezas, tanque, tapas, colin


def calcomanias(tanque, tapas, colin, carenado_lados):
    """Gráficos de la foto: rodillera, logo BOXER con su swoosh turquesa,
    CT100, molduras de las tapas laterales y franjas del carenado."""
    piezas = []
    rodillera_img = s.textura_calcomania("rodillera", 0.2, 0.09, [
        {"tipo": "poligono", "color": "#121313", "suave": 4, "puntos": [
            (-0.095, -0.03), (-0.06, -0.042), (0.07, -0.043), (0.095, -0.025), (0.09, 0.035), (0.04, 0.042),
            (-0.07, 0.04), (-0.096, 0.02)]},
    ])
    logo_img = s.textura_calcomania("boxer_logo", 0.26, 0.07, [
        {"tipo": "poligono", "color": TURQUESA,
         "puntos": [(-0.13, -0.004), (-0.04, 0.008), (-0.032, 0.016), (-0.125, 0.004)]},
        {"tipo": "poligono", "color": TURQUESA,
         "puntos": [(-0.12, -0.012), (-0.05, -0.002), (-0.046, 0.003), (-0.116, -0.007)]},
        {"tipo": "texto", "cuerpo": "BOXER", "alto": 0.04, "pos": (0.03, 0.014), "color": "#0b0c0c",
         "inclinacion": 0.25, "grosor": 0.0035, "espaciado": 1.08},
        {"tipo": "texto", "cuerpo": "BOXER", "alto": 0.04, "pos": (0.03, 0.014), "color": "#d6dadc",
         "inclinacion": 0.25, "espaciado": 1.08},
        {"tipo": "texto", "cuerpo": "CT", "alto": 0.018, "pos": (0.042, -0.02), "color": "#e9eded", "inclinacion": 0.2},
        {"tipo": "texto", "cuerpo": "100", "alto": 0.018, "pos": (0.075, -0.02), "color": "#ff5a1e", "inclinacion": 0.2},
    ])
    moldura_img = s.textura_calcomania("moldura", 0.3, 0.04, [
        {"tipo": "poligono", "color": "#c9cdd0",
         "puntos": [(-0.15, -0.006), (0.14, -0.014), (0.15, -0.006), (-0.14, 0.004)]},
        {"tipo": "poligono", "color": TURQUESA,
         "puntos": [(-0.12, 0.006), (0.1, -0.004), (0.11, 0.004), (-0.11, 0.013)]},
    ])
    ct_img = s.textura_calcomania("ct100_colin", 0.09, 0.04, [
        {"tipo": "texto", "cuerpo": "CT", "alto": 0.022, "pos": (-0.02, 0.0), "color": "#e9eded", "inclinacion": 0.2},
        {"tipo": "texto", "cuerpo": "100", "alto": 0.022, "pos": (0.018, 0.0), "color": "#ff5a1e", "inclinacion": 0.2},
    ])
    franjas_img = s.textura_calcomania("franjas_carenado", 0.12, 0.06, [
        {"tipo": "poligono", "color": TURQUESA, "puntos": [(-0.055, 0.02), (-0.03, 0.02), (0.05, -0.022), (0.03, -0.022)]},
        {"tipo": "poligono", "color": TURQUESA, "puntos": [(-0.03, 0.024), (-0.018, 0.024), (0.04, -0.008), (0.028, -0.008)]},
    ])
    mat_rodillera = s.material_calcomania("rodillera", rodillera_img, rugosidad=0.85)
    mat_logo = s.material_calcomania("logo_boxer", logo_img, metal=0.3, rugosidad=0.3)
    mat_moldura = s.material_calcomania("moldura", moldura_img, metal=0.6, rugosidad=0.25)
    mat_ct = s.material_calcomania("ct100", ct_img, rugosidad=0.35)
    mat_franjas = s.material_calcomania("franjas", franjas_img, rugosidad=0.3)
    for indice, lado in enumerate((-1, 1)):
        n = (lado, 0, 0)
        piezas.append(s.calcomania(f"rodillera_{lado}", tanque, (lado * 0.25, -0.085, 0.735), n, (0, 0, 1), 0.2, 0.09,
                                   mat_rodillera))
        piezas.append(s.calcomania(f"logo_{lado}", tanque, (lado * 0.25, -0.16, 0.795), n, (0, 0, 1), 0.26, 0.07,
                                   mat_logo))
        piezas.append(s.calcomania(f"moldura_{lado}", tapas[indice], (lado * 0.25, 0.25, 0.53), n, (0, 0, 1), 0.3,
                                   0.04, mat_moldura, subdiv=(30, 4)))
        piezas.append(s.calcomania(f"ct100_{lado}", colin, (lado * 0.25, 0.8, 0.655), n, (0, 0, 1), 0.09, 0.04,
                                   mat_ct, subdiv=(12, 6)))
        piezas.append(s.calcomania(f"franjas_{lado}", carenado_lados, (lado * 0.25, -0.475, 0.9), n, (0, 0, 1), 0.12,
                                   0.06, mat_franjas, subdiv=(12, 6)))
    return piezas


def luz_trasera(m):
    return [
        s.caja_redondeada("carcasa_stop", (0.13, 0.06, 0.07), 0.018, pos=(0, 0.99, 0.665), rot=(-12, 0, 0),
                          mat=m["plastico"], segmentos=3),
        s.caja_redondeada("stop", (0.115, 0.022, 0.056), 0.012, pos=(0, 1.02, 0.66), rot=(-12, 0, 0),
                          mat=m["lente_roja"], segmentos=3),
    ]


def asiento(m):
    """Asiento largo y plano (medido: borde superior a 0,79-0,825 m)."""
    def medio(w, zt, zb):
        return [(0.0, zt), (0.35 * w, zt - 0.002), (0.65 * w, zt - 0.008), (0.85 * w, zt - 0.02),
                (0.96 * w, zt - 0.04), (w, zt - 0.065), (0.99 * w, zb + 0.02), (0.92 * w, zb), (0.0, zb)]

    claves = [
        s.seccion(medio(0.07, 0.76, 0.7), y=0.04),
        s.seccion(medio(0.115, 0.772, 0.675), y=0.12),
        s.seccion(medio(0.135, 0.782, 0.665), y=0.25),
        s.seccion(medio(0.14, 0.788, 0.66), y=0.5),
        s.seccion(medio(0.135, 0.792, 0.665), y=0.7),
        s.seccion(medio(0.11, 0.788, 0.675), y=0.82),
        s.seccion(medio(0.06, 0.775, 0.69), y=0.87),
    ]
    cojin = s.anillos("asiento", s.interpolar_secciones(claves, 4), m["asiento"], tapas=("plana", "plana"),
                      subdiv=1, angulo=50)
    vivo = [c.tubo("vivo", [(lado * 0.137, y, 0.722 + (y - 0.04) * 0.025) for y in (0.12, 0.3, 0.55, 0.78)],
                   0.0035, m["negro_satinado"], lados=6, sub=6) for lado in (-1, 1)]
    base = c.barrido("base_asiento", [(0.06, 0.668), (0.45, 0.662), (0.84, 0.672)], [
        (0.0, 0.08, 0.012, 0.012, 3.0), (0.2, 0.135, 0.012, 0.012, 3.0), (1.0, 0.1, 0.012, 0.012, 3.0),
    ], m["plastico"], lados=16, sub=4)
    return [cojin, base] + vivo


def construir(opciones):
    c.nueva_escena()
    m = materiales()
    raiz = c.vacio("boxer_ct100")

    piezas_direccion, faro = direccion(m)
    c.colgar(c.unir("chasis", chasis(m)), raiz)
    c.colgar(c.unir("motor", motor(m)), raiz)
    c.colgar(c.unir("escape", escape(m)), raiz)
    piezas_carroceria, tanque, tapas, colin = carroceria(m)
    calcos = calcomanias(tanque, tapas, colin, next(p for p in piezas_direccion if p.name == "carenado"))
    c.colgar(c.unir("carroceria", piezas_carroceria), raiz)
    c.colgar(c.unir("calcomanias", calcos), raiz)
    c.colgar(c.unir("direccion", piezas_direccion), raiz)
    c.colgar(c.unir("faro_delantero", faro), raiz)
    c.colgar(c.unir("asiento", asiento(m)), raiz)
    c.colgar(c.unir("luz_trasera", luz_trasera(m)), raiz)
    suspension = []
    for lado in (-1, 1):
        # Medidos: arriba (y 0,62 z 0,55), abajo (y 0,72 z 0,315).
        suspension += pm.amortiguador((lado * 0.108, 0.712, 0.3), (lado * 0.108, 0.614, 0.52), m, m["resorte"],
                                      vueltas=9, r_resorte=0.026, mat_cuerpo=m["cromo"])
    c.colgar(c.unir("suspension_trasera", suspension), raiz)
    ruedas(m, raiz)

    c.validar(NOMBRE, PRESUPUESTO)
    c.exportar_glb(os.path.join(opciones["salida"], f"{NOMBRE}.glb"))
    c.poster(opciones, NOMBRE, pm.ANCHO_POSTER, pm.ALTO_POSTER, pm.AZIMUT, pm.ELEVACION)


if __name__ == "__main__":
    construir(c.argumentos())
