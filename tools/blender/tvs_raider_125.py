"""
TVS Raider 125 (referencia: FrontEnd/img-blender/tvs rider 125.jpg).

Commuter deportiva: tanque morado mate con aletas laterales negras y panel
gris, faro LED con DRL en "Y" sobre lente ahumada, asiento partido escalonado,
colín afilado con portaplaca colgante, rines negros de 5 brazos dobles, disco
delantero con mordaza dorada, quilla morada y silenciador corto con protector
plateado.

Medidas de ficha: entre ejes 1,326 m, largo ~2,07 m, alto ~1,03 m,
neumáticos 80/100-17 y 100/90-17, lanzamiento ~25,5°.

    blender --background --factory-startup --python tools/blender/tvs_raider_125.py

Nodos: tvs_raider_125 (raíz) > chasis, motor, escape, carroceria, asiento,
direccion, faro_delantero, luz_trasera, rueda_delantera >
rueda_delantera_malla, rueda_trasera > rueda_trasera_malla.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mathutils import Vector  # noqa: E402

import comun as c  # noqa: E402
import piezas_moto as pm  # noqa: E402

NOMBRE = "tvs-raider-125"
PRESUPUESTO = 40_000

ENTRE_EJES = 1.326
YF, YR = -ENTRE_EJES / 2, ENTRE_EJES / 2
RF, RR = 0.296, 0.306
R_LLANTA = 0.2159
RAKE = 25.5


def materiales():
    m = pm.materiales_base()
    m.update({
        "morado": c.material("pintura_morada", "#4a40a6", metal=0.15, rugosidad=0.48, capa=0.25, capa_rugosidad=0.3),
        "carenado": c.material("carenado_negro", "#1d1f22", rugosidad=0.5),
        "gris": c.material("acento_gris", "#8d9096", metal=0.45, rugosidad=0.4),
        "letras": c.material("letras_plata", "#cdd0d5", metal=0.5, rugosidad=0.3),
        "lente": c.material("lente_ahumada", "#1f2529", metal=0.2, rugosidad=0.06),
        "visera": c.material("visera_tintada", "#1a2124", metal=0.1, rugosidad=0.08),
        "dorado": c.material("mordaza_dorada", "#c3993b", metal=0.9, rugosidad=0.35),
        "plata": c.material("protector_plata", "#b7bbbf", metal=0.9, rugosidad=0.28),
    })
    return m


def ruedas(m, raiz):
    delantera = pm.rueda_aleacion("rueda_delantera", RF, 0.08, R_LLANTA, m, m["negro_satinado"], estilo="V")
    delantera += pm.disco_freno("disco_delantero", 0.12, 0.075, -0.052, m)
    c.mover(delantera, (0, YF, RF))
    c.pieza_animable("rueda_delantera", delantera, (0, YF, RF), raiz)

    trasera = pm.rueda_aleacion("rueda_trasera", RR, 0.1, R_LLANTA, m, m["negro_satinado"], estilo="V")
    trasera.append(c.cilindro("tambor_trasero", 0.08, 0.05, pos=(-0.035, 0, 0), mat=m["aluminio"], lados=24, eje="X",
                              bisel=0.008))
    trasera.append(pm.corona("corona", 0.09, 0.075, m))
    c.mover(trasera, (0, YR, RR))
    c.pieza_animable("rueda_trasera", trasera, (0, YR, RR), raiz)


def direccion(m):
    piezas, tope = pm.horquilla((0, YF, RF), RAKE, 0.70, 0.075, 0.016, 0.022, 0.3, m["cromo"], m["negro_satinado"], m)
    d = pm.eje_direccion(RAKE)
    centro = tope + Vector((0, 0.025, 0.045))
    piezas += pm.manubrio(centro, 0.37, 0.07, 0.04, m)
    for lado in (-1, 1):
        piezas += pm.espejo((lado * 0.25, centro.y + 0.04, centro.z + 0.025), lado, m, alto=0.12, abierto=0.06,
                            forma=(0.082, 0.012, 0.03))

    # Carcasa angulosa del faro.
    piezas.append(c.barrido("carcasa_faro", [(-0.53, 0.86), (-0.47, 0.866), (-0.4, 0.878)], [
        (0.0, 0.096, 0.072, 0.06, 4.2), (0.5, 0.092, 0.07, 0.06, 4.0), (1.0, 0.07, 0.05, 0.05, 3.4),
    ], m["carenado"], lados=28, sub=4))
    piezas.append(c.barrido("visera", [(-0.538, 0.935), (-0.512, 0.975), (-0.478, 1.008)], [
        (0.0, 0.08, 0.003, 0.003, 2.0), (1.0, 0.06, 0.003, 0.003, 2.0),
    ], m["visera"], lados=14, sub=4, comba=0.018))
    piezas.append(c.caja("tablero", (0.12, 0.05, 0.075), pos=(0, -0.43, 0.985), rot=(-35, 0, 0), mat=m["plastico"],
                         bisel=0.01, segmentos=2))
    for lado in (-1, 1):
        piezas += pm.direccional((lado * 0.08, -0.455, 0.83), lado, m, tallo=0.06, tam=(0.016, 0.036, 0.016))

    # Guardabarros delantero corto, en el morado de la moto.
    rg = RF + 0.022
    arco = [(YF + rg * math.cos(math.radians(a)), RF + rg * math.sin(math.radians(a))) for a in (150, 128, 104, 80, 58)]
    piezas.append(c.barrido("guardabarros_delantero", arco, [
        (0.0, 0.04, 0.005, 0.005, 2.0), (0.35, 0.052, 0.007, 0.006, 2.4), (1.0, 0.046, 0.005, 0.005, 2.0),
    ], m["morado"], lados=16, sub=4, comba=0.016))
    soporte = Vector((0, YF, RF)) + d * (rg - 0.01)
    for lado in (-1, 1):
        piezas.append(c.caja("soporte_guardabarros", (0.028, 0.04, 0.018), pos=soporte + Vector((lado * 0.06, 0, 0)),
                             rot=(-RAKE, 0, 0), mat=m["negro_satinado"], bisel=0.004, segmentos=1))

    # Mordaza dorada detrás del disco (no gira con la rueda).
    theta = math.radians(-25)
    piezas.append(c.caja("mordaza", (0.032, 0.062, 0.036),
                         pos=(-0.064, YF + 0.098 * math.cos(theta), RF + 0.098 * math.sin(theta)),
                         rot=(math.degrees(theta) + 90, 0, 0), mat=m["dorado"], bisel=0.008, segmentos=2))

    # Faro: lente ahumada, proyector LED y DRL en "Y".
    faro = [
        c.barrido("lente_faro", [(-0.541, 0.86), (-0.529, 0.86)], [
            (0.0, 0.086, 0.062, 0.052, 4.2), (1.0, 0.092, 0.068, 0.056, 4.2),
        ], m["lente"], lados=28, sub=1),
        c.cilindro("proyector", 0.021, 0.01, pos=(0, -0.543, 0.85), mat=m["faro"], lados=18, eje="Y"),
        c.tubo("drl_tallo", [(0, -0.544, 0.826), (0, -0.544, 0.8)], 0.0045, m["faro"], lados=6, sub=1),
    ]
    for lado in (-1, 1):
        faro.append(c.tubo("drl_brazo", [(lado * 0.074, -0.543, 0.912), (lado * 0.045, -0.544, 0.885),
                                         (lado * 0.02, -0.544, 0.852), (0, -0.544, 0.828)], 0.0045, m["faro"],
                           lados=6, sub=4))
    return piezas, faro


def chasis(m):
    d = pm.eje_direccion(RAKE)
    tope = Vector((0, YF, RF)) + d * 0.70
    piezas = [
        c.tubo("pipa_direccion", [tope - d * 0.17, tope - d * 0.03], 0.027, m["negro_mate"], lados=14, sub=1),
        c.tubo("espina", [(0, -0.37, 0.83), (0, -0.15, 0.79), (0, 0.07, 0.73), (0, 0.13, 0.6), (0, 0.13, 0.42)],
               0.023, m["negro_mate"], lados=10, sub=5),
        c.tubo("tubo_bajada", [(0, -0.4, 0.78), (0, -0.35, 0.55), (0, -0.3, 0.38)], 0.021, m["negro_mate"], lados=10, sub=4),
        c.cilindro("eje_basculante", 0.016, 0.22, pos=(0, 0.12, 0.385), mat=m["aluminio"], lados=10, eje="X"),
        c.barrido("amortiguador_mono", [(0.26, 0.42), (0.13, 0.64)], [
            (0.0, 0.022, 0.022, 0.022, 2.0), (1.0, 0.024, 0.024, 0.024, 2.0),
        ], m["negro_satinado"], lados=12, sub=1),
        c.tubo("pedal_freno", [(-0.1, 0.05, 0.3), (-0.13, -0.07, 0.27), (-0.14, -0.15, 0.26)], 0.007,
               m["negro_satinado"], lados=6, sub=4),
    ]
    for lado in (-1, 1):
        x = lado * 0.095
        piezas.append(c.tubo("subchasis", [(x * 0.5, 0.06, 0.73), (x, 0.3, 0.74), (x, 0.6, 0.77), (x * 0.7, 0.82, 0.78)],
                             0.013, m["negro_mate"], lados=8, sub=4))
        piezas.append(c.tubo("tirante", [(x * 0.6, 0.13, 0.43), (x, 0.36, 0.6), (x, 0.55, 0.76)], 0.012,
                             m["negro_mate"], lados=8, sub=4))
        piezas.append(c.tubo("cuna", [(0, -0.3, 0.38), (lado * 0.06, -0.24, 0.24), (lado * 0.07, 0.04, 0.21),
                                      (lado * 0.06, 0.12, 0.33)], 0.016, m["negro_mate"], lados=8, sub=4))
        piezas.append(c.prisma("basculante", [(0.1, 0.415), (0.68, 0.33), (0.68, 0.288), (0.1, 0.365)],
                               lado * 0.074, lado * 0.098, m["negro_satinado"], bisel=0.006, segmentos=1))
        piezas += pm.estribo((lado * 0.11, 0.04, 0.29), lado, m, largo=0.11)
        piezas += pm.estribo((lado * 0.12, 0.43, 0.45), lado, m, largo=0.07)
        # Asa trasera plateada.
    piezas.append(c.tubo("asa", [(-0.11, 0.44, 0.835), (-0.125, 0.62, 0.86), (-0.09, 0.76, 0.875), (0, 0.79, 0.878),
                                  (0.09, 0.76, 0.875), (0.125, 0.62, 0.86), (0.11, 0.44, 0.835)],
                         0.011, m["plata"], lados=10, sub=5))
    piezas.append(pm.cadena((0.04, 0.36), 0.035, (YR, RR), 0.09, 0.077, m))
    piezas.append(c.barrido("cubrecadena", [(0.14, 0.415), (0.4, 0.39), (0.58, 0.37)], [
        (0.0, 0.007, 0.012, 0.006, 2.0), (0.5, 0.008, 0.015, 0.006, 2.4), (1.0, 0.007, 0.012, 0.006, 2.0),
    ], m["negro_satinado"], x=0.077, lados=10, sub=3))
    # Portaplaca colgante bajo el colín.
    piezas.append(c.tubo("brazo_portaplaca", [(0, 0.78, 0.74), (0, 0.88, 0.68), (0, 0.95, 0.6)], 0.016, m["plastico"],
                         lados=8, sub=4))
    piezas += pm.portaplaca((0, 0.965, 0.55), m, inclinacion=14)
    for lado in (-1, 1):
        piezas += pm.direccional((lado * 0.02, 0.905, 0.655), lado, m, tallo=0.07, tam=(0.016, 0.032, 0.016))
    return piezas


def motor(m):
    piezas = [
        c.caja("carter", (0.19, 0.3, 0.19), pos=(0, -0.07, 0.345), mat=m["negro_satinado"], bisel=0.04, segmentos=3),
        c.cilindro("tapa_embrague", 0.095, 0.03, pos=(-0.108, -0.04, 0.335), mat=m["gris"], lados=28, eje="X",
                   bisel=0.012, segmentos=2),
        c.cilindro("tapa_embrague_centro", 0.04, 0.012, pos=(-0.125, -0.04, 0.335), mat=m["negro_satinado"], lados=18,
                   eje="X", bisel=0.004),
        c.cilindro("tapa_volante", 0.08, 0.03, pos=(0.105, -0.13, 0.325), mat=m["negro_satinado"], lados=24, eje="X",
                   bisel=0.01, segmentos=2),
        c.caja("tapa_pinon", (0.03, 0.11, 0.1), pos=(0.1, 0.03, 0.34), mat=m["gris"], bisel=0.018, segmentos=2),
        c.caja("caja_filtro", (0.12, 0.14, 0.13), pos=(0, 0.08, 0.6), mat=m["plastico"], bisel=0.02, segmentos=2),
    ]
    eje = Vector((0, -math.sin(math.radians(20)), math.cos(math.radians(20))))
    base = Vector((0, -0.16, 0.43))
    piezas.append(c.tubo("camisa", [base, base + eje * 0.19], 0.044, m["negro_satinado"], lados=14, sub=1))
    for i in range(7):
        escala = 1.0 - i * 0.03
        piezas.append(c.caja("aleta", (0.15 * escala, 0.13 * escala, 0.007), pos=base + eje * (0.03 + i * 0.022),
                             rot=(20, 0, 0), mat=m["negro_satinado"], bisel=0.003, segmentos=1))
    piezas.append(c.caja("culata", (0.14, 0.12, 0.055), pos=base + eje * 0.205, rot=(20, 0, 0), mat=m["gris"],
                         bisel=0.016, segmentos=2))
    piezas.append(c.tubo("pedal_cambios", [(0.105, -0.02, 0.3), (0.135, -0.12, 0.28), (0.145, -0.2, 0.29)], 0.007,
                         m["negro_satinado"], lados=6, sub=4))
    # Quilla morada bajo el motor.
    quilla = c.prisma("quilla", [(-0.36, 0.34), (-0.3, 0.22), (-0.14, 0.17), (0.04, 0.18), (0.06, 0.23), (-0.12, 0.25),
                                 (-0.27, 0.31)], 0.092, 0.11, m["morado"], sub=3, espejo=True)
    piezas.append(quilla)
    piezas.append(c.caja("quilla_fondo", (0.2, 0.2, 0.012), pos=(0, -0.08, 0.18), mat=m["carenado"], bisel=0.005,
                         segmentos=1))
    return piezas


def escape(m):
    return [
        c.tubo("colector", [(-0.02, -0.255, 0.49), (-0.05, -0.335, 0.4), (-0.07, -0.325, 0.27), (-0.09, -0.22, 0.19),
                            (-0.12, -0.02, 0.18), (-0.15, 0.12, 0.24)], 0.019, m["negro_satinado"], lados=10, sub=6),
        c.barrido("silenciador", [(0.1, 0.245), (0.3, 0.31), (0.52, 0.39)], [
            (0.0, 0.024, 0.024, 0.024, 2.0), (0.14, 0.056, 0.066, 0.06, 2.6), (0.86, 0.058, 0.07, 0.064, 2.6),
            (1.0, 0.046, 0.05, 0.05, 2.4),
        ], m["negro_satinado"], x=-0.165, lados=20, sub=6),
        c.barrido("protector_escape", [(0.15, 0.262), (0.3, 0.312), (0.44, 0.362)], [
            (0.0, 0.06, 0.07, 0.065, 2.8), (0.5, 0.062, 0.073, 0.067, 2.8), (1.0, 0.06, 0.071, 0.066, 2.8),
        ], m["plata"], x=-0.17, lados=20, sub=4),
        c.torno("punta_escape", [(0.0, 0.0), (0.03, 0.0), (0.038, 0.012), (0.038, 0.028), (0.0, 0.028)],
                pos=(-0.165, 0.515, 0.385), rot=(-70, 0, 0), mat=m["plata"], lados=18),
    ]


def carroceria(m):
    tanque = c.barrido("tanque", [(-0.37, 0.86), (-0.22, 0.885), (-0.07, 0.872), (0.06, 0.83)], [
        (0.0, 0.08, 0.035, 0.05, 2.6, 3.5), (0.12, 0.14, 0.06, 0.075, 2.6, 3.8), (0.5, 0.168, 0.066, 0.085, 2.6, 4.0),
        (0.85, 0.15, 0.05, 0.08, 2.6, 3.8), (1.0, 0.09, 0.02, 0.05, 2.6, 3.4),
    ], m["morado"], lados=28, sub=8)
    piezas = [tanque]
    tapon_z = max(v.co.z for v in tanque.data.vertices if abs(v.co.y + 0.19) < 0.02 and abs(v.co.x) < 0.05)
    piezas.append(c.cilindro("tapon", 0.036, 0.012, pos=(0, -0.19, tapon_z + 0.001), mat=m["negro_satinado"], lados=20,
                             bisel=0.004))
    # Aletas del tanque: negras con un panel gris en la punta.
    piezas.append(c.prisma("aleta_tanque", [(-0.43, 0.83), (-0.3, 0.855), (-0.1, 0.8), (-0.13, 0.7), (-0.36, 0.67)],
                           0.142, 0.163, m["carenado"], bisel=0.006, segmentos=1, espejo=True))
    piezas.append(c.prisma("panel_aleta", [(-0.41, 0.822), (-0.33, 0.838), (-0.31, 0.76), (-0.36, 0.69)],
                           0.162, 0.167, m["gris"], bisel=0.002, segmentos=1, espejo=True))
    # Tapas laterales con "RAIDER".
    tapa = c.prisma("tapa_lateral", [(0.02, 0.745), (0.33, 0.775), (0.42, 0.725), (0.36, 0.585), (0.12, 0.565),
                                     (0.04, 0.62)], 0.1, 0.124, m["carenado"], sub=3, espejo=True)
    piezas.append(tapa)
    for lado in (-1, 1):
        rot = (90, 0, 90) if lado > 0 else (90, 0, -90)
        piezas.append(c.texto("logo_raider", "RAIDER", 0.034, pos=(lado * 0.3, 0.21, 0.655), rot=rot, mat=m["letras"],
                              inclinacion=0.15, sobre=tapa))
        piezas.append(c.cinta("filo_tapa", [(0.05, 0.725), (0.2, 0.745), (0.34, 0.752)], 0.012, lado, tapa, m["gris"]))
    # Colín afilado.
    piezas.append(c.barrido("colin", [(0.3, 0.74), (0.55, 0.78), (0.8, 0.8), (0.9, 0.795)], [
        (0.0, 0.12, 0.04, 0.05, 3.0), (0.5, 0.105, 0.04, 0.05, 3.0), (1.0, 0.045, 0.022, 0.03, 3.0),
    ], m["carenado"], lados=18, sub=5))
    rg = RR + 0.03
    arco = [(YR + rg * math.cos(math.radians(a)), RR + rg * math.sin(math.radians(a))) for a in (130, 105, 80, 55, 35)]
    piezas.append(c.barrido("cubrerrueda", arco, [
        (0.0, 0.05, 0.004, 0.004, 2.0), (1.0, 0.055, 0.004, 0.004, 2.0),
    ], m["plastico"], lados=14, sub=4, comba=0.025))
    return piezas


def luz_trasera(m):
    return [c.caja("stop", (0.085, 0.03, 0.035), pos=(0, 0.895, 0.795), rot=(-14, 0, 0), mat=m["stop"], bisel=0.008,
                   segmentos=2)]


def asiento(m):
    return [
        c.barrido("asiento_piloto", [(0.0, 0.775), (0.15, 0.766), (0.32, 0.776), (0.4, 0.8)], [
            (0.0, 0.09, 0.02, 0.04, 3.0, 4.0), (0.15, 0.14, 0.036, 0.045, 3.2, 4.0), (0.75, 0.13, 0.032, 0.045, 3.2, 4.0),
            (1.0, 0.09, 0.03, 0.04, 3.0, 4.0),
        ], m["asiento"], lados=22, sub=5),
        c.barrido("asiento_pasajero", [(0.4, 0.826), (0.55, 0.842), (0.7, 0.852)], [
            (0.0, 0.1, 0.026, 0.04, 3.0, 4.0), (0.5, 0.11, 0.03, 0.04, 3.0, 4.0), (1.0, 0.075, 0.02, 0.035, 3.0, 4.0),
        ], m["asiento"], lados=22, sub=5),
    ]


def construir(opciones):
    c.nueva_escena()
    m = materiales()
    raiz = c.vacio("tvs_raider_125")

    piezas_direccion, faro = direccion(m)
    c.colgar(c.unir("direccion", piezas_direccion), raiz)
    c.colgar(c.unir("faro_delantero", faro), raiz)
    c.colgar(c.unir("chasis", chasis(m)), raiz)
    c.colgar(c.unir("motor", motor(m)), raiz)
    c.colgar(c.unir("escape", escape(m)), raiz)
    c.colgar(c.unir("carroceria", carroceria(m)), raiz)
    c.colgar(c.unir("asiento", asiento(m)), raiz)
    c.colgar(c.unir("luz_trasera", luz_trasera(m)), raiz)
    ruedas(m, raiz)

    c.validar(NOMBRE, PRESUPUESTO)
    c.exportar_glb(os.path.join(opciones["salida"], f"{NOMBRE}.glb"))
    c.poster(opciones, NOMBRE, pm.ANCHO_POSTER, pm.ALTO_POSTER, pm.AZIMUT, pm.ELEVACION)


if __name__ == "__main__":
    construir(c.argumentos())
