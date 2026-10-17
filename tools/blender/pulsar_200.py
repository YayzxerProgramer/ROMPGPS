"""
Bajaj Pulsar NS200 (referencia: FrontEnd/img-blender/pulsar 200.webp).

Naked deportiva: negra lacada con gráficos rojos, faro alto con proyector y
DRL "ojo de lobo", aletas de radiador amplias, chasis perimetral negro a la
vista, quilla con "NS" en rojo y escape bajo el motor, asiento partido con
colín afilado y asideros separados, rines de brazos en Y con filete rojo,
discos con anillo ABS y monoamortiguador con resorte rojo.

Medidas de ficha: entre ejes 1,363 m, largo ~2,02 m, alto ~1,08 m,
neumáticos 100/80-17 y 130/70-17, lanzamiento ~25°.

    blender --background --factory-startup --python tools/blender/pulsar_200.py

Nodos: pulsar_200 (raíz) > chasis, motor, escape, carroceria, asiento,
direccion, faro_delantero, luz_trasera, suspension_trasera,
rueda_delantera > rueda_delantera_malla, rueda_trasera > rueda_trasera_malla.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mathutils import Vector  # noqa: E402

import comun as c  # noqa: E402
import piezas_moto as pm  # noqa: E402

NOMBRE = "pulsar-200"
PRESUPUESTO = 40_000

ENTRE_EJES = 1.363
YF, YR = -ENTRE_EJES / 2, ENTRE_EJES / 2
RF, RR = 0.296, 0.307
R_LLANTA = 0.2159
RAKE = 25


def materiales():
    m = pm.materiales_base()
    m.update({
        "pintura": c.material("pintura_negra", "#0b0c0d", rugosidad=0.28, capa=1.0, capa_rugosidad=0.05),
        "granate": c.material("grafica_granate", "#8f1823", metal=0.3, rugosidad=0.3, capa=0.8, capa_rugosidad=0.06),
        "rojo": c.material("rojo_vivo", "#d3232e", rugosidad=0.35),
        "lente": c.material("lente_ahumada", "#1d2327", metal=0.2, rugosidad=0.06),
        "visera": c.material("visera_tintada", "#192024", metal=0.1, rugosidad=0.08),
        "radiador": c.material("radiador", "#2b2d2f", metal=0.6, rugosidad=0.45),
        "gris": c.material("gris_motor", "#5e6266", metal=0.6, rugosidad=0.4),
    })
    return m


def ruedas(m, raiz):
    delantera = pm.rueda_aleacion("rueda_delantera", RF, 0.1, R_LLANTA, m, m["negro_satinado"], estilo="Y",
                                  mat_filete=m["rojo"])
    delantera += pm.disco_freno("disco_delantero", 0.15, 0.1, -0.058, m)
    delantera.append(c.torno("anillo_abs", [(0.058, -0.064), (0.07, -0.064), (0.07, -0.06), (0.058, -0.06)],
                             mat=m["disco"], lados=24, cerrado=True, eje="X"))
    c.mover(delantera, (0, YF, RF))
    c.pieza_animable("rueda_delantera", delantera, (0, YF, RF), raiz)

    trasera = pm.rueda_aleacion("rueda_trasera", RR, 0.13, R_LLANTA, m, m["negro_satinado"], estilo="Y",
                                mat_filete=m["rojo"])
    trasera += pm.disco_freno("disco_trasero", 0.115, 0.075, -0.07, m)
    trasera.append(pm.corona("corona", 0.095, 0.082, m))
    c.mover(trasera, (0, YR, RR))
    c.pieza_animable("rueda_trasera", trasera, (0, YR, RR), raiz)


def mordaza(nombre, eje, radio, theta, x, mat):
    t = math.radians(theta)
    return c.caja(nombre, (0.034, 0.07, 0.04), pos=(x, eje[0] + radio * math.cos(t), eje[1] + radio * math.sin(t)),
                  rot=(theta + 90, 0, 0), mat=mat, bisel=0.009, segmentos=2)


def direccion(m):
    piezas, tope = pm.horquilla((0, YF, RF), RAKE, 0.72, 0.08, 0.018, 0.025, 0.31, m["cromo"], m["negro_satinado"], m)
    d = pm.eje_direccion(RAKE)
    centro = tope + Vector((0, 0.03, 0.03))
    piezas += pm.manubrio(centro, 0.37, 0.06, 0.02, m)
    for lado in (-1, 1):
        piezas += pm.espejo((lado * 0.25, centro.y + 0.035, centro.z + 0.012), lado, m, alto=0.12, abierto=0.07,
                            forma=(0.086, 0.012, 0.032))

    carcasa = c.barrido("carcasa_faro", [(-0.552, 0.88), (-0.49, 0.89), (-0.42, 0.902)], [
        (0.0, 0.086, 0.088, 0.075, 4.5), (0.5, 0.084, 0.084, 0.07, 4.0), (1.0, 0.064, 0.06, 0.05, 3.4),
    ], m["pintura"], lados=28, sub=4)
    piezas.append(carcasa)
    for lado in (-1, 1):
        piezas.append(c.cinta("acento_faro", [(-0.545, 0.93), (-0.5, 0.94), (-0.44, 0.94)], 0.012, lado, carcasa,
                              m["granate"]))
    piezas.append(c.barrido("visera", [(-0.566, 0.968), (-0.54, 1.008), (-0.502, 1.042)], [
        (0.0, 0.074, 0.003, 0.003, 2.0), (1.0, 0.056, 0.003, 0.003, 2.0),
    ], m["visera"], lados=14, sub=4, comba=0.016))
    piezas.append(c.caja("tablero", (0.13, 0.05, 0.08), pos=(0, -0.45, 1.0), rot=(-35, 0, 0), mat=m["plastico"],
                         bisel=0.01, segmentos=2))
    for lado in (-1, 1):
        piezas += pm.direccional((lado * 0.075, -0.47, 0.845), lado, m, tallo=0.07, tam=(0.016, 0.036, 0.016))

    rg = RF + 0.022
    arco = [(YF + rg * math.cos(math.radians(a)), RF + rg * math.sin(math.radians(a))) for a in (152, 128, 104, 80, 58)]
    piezas.append(c.barrido("guardabarros_delantero", arco, [
        (0.0, 0.046, 0.005, 0.005, 2.0), (0.35, 0.06, 0.007, 0.006, 2.4), (1.0, 0.054, 0.005, 0.005, 2.0),
    ], m["pintura"], lados=16, sub=4, comba=0.018))
    soporte = Vector((0, YF, RF)) + d * (rg - 0.01)
    for lado in (-1, 1):
        piezas.append(c.caja("soporte_guardabarros", (0.028, 0.04, 0.018), pos=soporte + Vector((lado * 0.066, 0, 0)),
                             rot=(-RAKE, 0, 0), mat=m["negro_satinado"], bisel=0.004, segmentos=1))
    piezas.append(mordaza("mordaza_delantera", (YF, RF), 0.124, -28, -0.07, m["gris"]))

    faro = [
        c.barrido("lente_faro", [(-0.563, 0.88), (-0.55, 0.88)], [
            (0.0, 0.076, 0.078, 0.066, 4.5), (1.0, 0.082, 0.084, 0.07, 4.5),
        ], m["lente"], lados=28, sub=1),
        c.cilindro("proyector", 0.024, 0.01, pos=(0, -0.566, 0.865), mat=m["faro"], lados=18, eje="Y"),
    ]
    for lado in (-1, 1):
        faro.append(c.tubo("drl", [(lado * 0.068, -0.566, 0.945), (lado * 0.06, -0.567, 0.905), (lado * 0.04, -0.567, 0.84)],
                           0.0045, m["faro"], lados=6, sub=4))
    return piezas, faro


def chasis(m):
    d = pm.eje_direccion(RAKE)
    tope = Vector((0, YF, RF)) + d * 0.72
    piezas = [
        c.tubo("pipa_direccion", [tope - d * 0.18, tope - d * 0.03], 0.028, m["negro_mate"], lados=14, sub=1),
        c.cilindro("eje_basculante", 0.017, 0.24, pos=(0, 0.13, 0.4), mat=m["aluminio"], lados=10, eje="X"),
        c.tubo("pedal_freno", [(-0.1, 0.07, 0.31), (-0.13, -0.05, 0.28), (-0.14, -0.13, 0.27)], 0.007,
               m["negro_satinado"], lados=6, sub=4),
    ]
    for lado in (-1, 1):
        x = lado * 0.1
        # Chasis perimetral: baja desde la pipa rodeando el motor.
        piezas.append(c.tubo("perimetral", [(lado * 0.04, -0.4, 0.83), (lado * 0.1, -0.24, 0.73), (lado * 0.115, -0.02, 0.64),
                                            (lado * 0.11, 0.12, 0.56), (lado * 0.1, 0.14, 0.4)], 0.021, m["negro_mate"],
                             lados=10, sub=5))
        piezas.append(c.tubo("bajada", [(lado * 0.03, -0.42, 0.78), (lado * 0.07, -0.36, 0.58), (lado * 0.08, -0.3, 0.42)],
                             0.018, m["negro_mate"], lados=8, sub=4))
        piezas.append(c.tubo("subchasis", [(lado * 0.1, 0.1, 0.62), (x, 0.35, 0.75), (x * 0.9, 0.62, 0.81), (x * 0.6, 0.86, 0.85)],
                             0.013, m["negro_mate"], lados=8, sub=4))
        piezas.append(c.prisma("basculante", [(0.12, 0.435), (0.72, 0.34), (0.72, 0.284), (0.12, 0.372)],
                               lado * 0.076, lado * 0.102, m["negro_satinado"], bisel=0.007, segmentos=1))
        piezas += pm.estribo((lado * 0.11, 0.07, 0.31), lado, m, largo=0.1)
        piezas += pm.estribo((lado * 0.12, 0.45, 0.48), lado, m, largo=0.07)
        # Asideros separados del colín.
        piezas.append(c.tubo("asidero", [(lado * 0.1, 0.47, 0.865), (lado * 0.112, 0.62, 0.89), (lado * 0.085, 0.74, 0.905)],
                             0.012, m["negro_satinado"], lados=8, sub=4))
    piezas.append(mordaza("mordaza_trasera", (YR, RR), 0.095, 120, -0.08, m["gris"]))
    piezas.append(pm.cadena((0.05, 0.37), 0.036, (YR, RR), 0.095, 0.083, m))
    piezas.append(c.tubo("brazo_portaplaca", [(0, 0.8, 0.8), (0, 0.9, 0.7), (0, 0.97, 0.61)], 0.016, m["plastico"],
                         lados=8, sub=4))
    piezas += pm.portaplaca((0, 0.985, 0.56), m, inclinacion=14)
    for lado in (-1, 1):
        piezas += pm.direccional((lado * 0.02, 0.925, 0.665), lado, m, tallo=0.07, tam=(0.016, 0.032, 0.016))
    return piezas


def motor(m):
    piezas = [
        c.caja("carter", (0.2, 0.31, 0.2), pos=(0, -0.06, 0.36), mat=m["negro_satinado"], bisel=0.045, segmentos=3),
        c.cilindro("tapa_embrague", 0.098, 0.032, pos=(-0.115, -0.03, 0.35), mat=m["gris"], lados=28, eje="X",
                   bisel=0.012, segmentos=2),
        c.cilindro("tapa_embrague_centro", 0.04, 0.012, pos=(-0.133, -0.03, 0.35), mat=m["aluminio"], lados=18,
                   eje="X", bisel=0.004),
        c.cilindro("tapa_volante", 0.084, 0.032, pos=(0.112, -0.12, 0.34), mat=m["negro_satinado"], lados=24, eje="X",
                   bisel=0.01, segmentos=2),
        c.caja("radiador", (0.25, 0.045, 0.2), pos=(0, -0.37, 0.56), rot=(-14, 0, 0), mat=m["radiador"], bisel=0.008,
               segmentos=1),
    ]
    for i in range(6):
        piezas.append(c.caja("rejilla", (0.23, 0.006, 0.008), pos=(0, -0.398, 0.485 + i * 0.03), rot=(-14, 0, 0),
                             mat=m["negro_mate"]))
    eje = Vector((0, -math.sin(math.radians(10)), math.cos(math.radians(10))))
    base = Vector((0, -0.15, 0.45))
    piezas.append(c.tubo("cilindro", [base, base + eje * 0.17], 0.055, m["negro_satinado"], lados=16, sub=1))
    for i in range(4):
        piezas.append(c.caja("aleta", (0.15, 0.13, 0.006), pos=base + eje * (0.04 + i * 0.03), rot=(10, 0, 0),
                             mat=m["gris"], bisel=0.003, segmentos=1))
    piezas.append(c.caja("culata", (0.15, 0.14, 0.07), pos=base + eje * 0.2, rot=(10, 0, 0), mat=m["negro_satinado"],
                         bisel=0.02, segmentos=2))
    piezas.append(c.tubo("pedal_cambios", [(0.112, 0.0, 0.31), (0.14, -0.1, 0.29), (0.15, -0.18, 0.3)], 0.007,
                         m["negro_satinado"], lados=6, sub=4))
    # Quilla con "NS".
    quilla = c.prisma("quilla", [(-0.38, 0.37), (-0.31, 0.21), (-0.1, 0.16), (0.11, 0.18), (0.13, 0.27), (-0.05, 0.28),
                                 (-0.26, 0.33)], 0.1, 0.122, m["pintura"], sub=3, espejo=True)
    piezas.append(quilla)
    piezas.append(c.caja("quilla_fondo", (0.22, 0.24, 0.012), pos=(0, -0.08, 0.17), mat=m["plastico"], bisel=0.005,
                         segmentos=1))
    for lado in (-1, 1):
        rot = (90, 0, 90) if lado > 0 else (90, 0, -90)
        piezas.append(c.texto("logo_ns", "NS", 0.06, pos=(lado * 0.3, -0.1, 0.225), rot=rot, mat=m["rojo"],
                              inclinacion=0.25, sobre=quilla))
    return piezas


def escape(m):
    return [
        c.tubo("colector", [(-0.02, -0.265, 0.5), (-0.045, -0.335, 0.41), (-0.055, -0.33, 0.27), (-0.06, -0.2, 0.19),
                            (-0.06, -0.06, 0.185)], 0.02, m["negro_satinado"], lados=10, sub=6),
        c.barrido("silenciador", [(-0.07, 0.19), (0.12, 0.19), (0.31, 0.215)], [
            (0.0, 0.03, 0.025, 0.025, 2.0), (0.15, 0.075, 0.045, 0.035, 3.0), (0.88, 0.075, 0.045, 0.035, 3.0),
            (1.0, 0.06, 0.036, 0.03, 2.6),
        ], m["negro_satinado"], x=-0.045, lados=20, sub=5),
        c.torno("punta_escape", [(0.0, 0.0), (0.024, 0.0), (0.03, 0.01), (0.03, 0.03), (0.0, 0.03)],
                pos=(-0.07, 0.305, 0.212), rot=(-82, 0, 0), mat=m["cromo"], lados=16),
    ]


def carroceria(m):
    tanque = c.barrido("tanque", [(-0.39, 0.88), (-0.24, 0.918), (-0.08, 0.905), (0.06, 0.86)], [
        (0.0, 0.085, 0.04, 0.05, 2.8, 4.0), (0.12, 0.15, 0.065, 0.075, 2.8, 4.2), (0.5, 0.178, 0.07, 0.09, 2.8, 4.4),
        (0.85, 0.15, 0.05, 0.08, 2.8, 4.0), (1.0, 0.09, 0.02, 0.05, 2.8, 3.5),
    ], m["pintura"], lados=28, sub=8)
    piezas = [tanque]
    tapon_z = max(v.co.z for v in tanque.data.vertices if abs(v.co.y + 0.2) < 0.02 and abs(v.co.x) < 0.05)
    piezas.append(c.cilindro("tapon", 0.04, 0.012, pos=(0, -0.2, tapon_z + 0.001), mat=m["aluminio"], lados=20, bisel=0.004))
    for lado in (-1, 1):
        rot = (90, 0, 90) if lado > 0 else (90, 0, -90)
        piezas.append(c.texto("logo_pulsar", "PULSAR", 0.036, pos=(lado * 0.3, -0.1, 0.885), rot=rot, mat=m["rojo"],
                              inclinacion=0.25, sobre=tanque))
        piezas.append(c.cinta("franja_tanque", [(-0.3, 0.86), (-0.15, 0.845), (-0.04, 0.832)],
                              lambda u: 0.01 * (1 - 0.5 * u), lado, tanque, m["granate"]))
    # Aletas del radiador: amplias, negras, con panel granate.
    aleta = c.prisma("aleta_radiador", [(-0.47, 0.86), (-0.32, 0.88), (-0.12, 0.83), (-0.16, 0.66), (-0.33, 0.53),
                                        (-0.45, 0.6)], 0.148, 0.17, m["pintura"], bisel=0.006, segmentos=1, espejo=True)
    piezas.append(aleta)
    piezas.append(c.prisma("panel_aleta", [(-0.44, 0.72), (-0.3, 0.76), (-0.18, 0.72), (-0.22, 0.66), (-0.35, 0.6)],
                           0.169, 0.174, m["granate"], bisel=0.002, segmentos=1, espejo=True))
    # Colín afilado con acento rojo.
    colin = c.barrido("colin", [(0.3, 0.765), (0.55, 0.825), (0.8, 0.88), (0.93, 0.9)], [
        (0.0, 0.12, 0.045, 0.06, 3.2), (0.5, 0.1, 0.045, 0.055, 3.2), (1.0, 0.035, 0.02, 0.03, 3.0),
    ], m["pintura"], lados=18, sub=5)
    piezas.append(colin)
    for lado in (-1, 1):
        piezas.append(c.cinta("acento_colin", [(0.42, 0.79), (0.62, 0.835), (0.82, 0.87)], lambda u: 0.022 * (1 - 0.6 * u),
                              lado, colin, m["granate"]))
    rg = RR + 0.03
    arco = [(YR + rg * math.cos(math.radians(a)), RR + rg * math.sin(math.radians(a))) for a in (130, 105, 80, 55, 35)]
    piezas.append(c.barrido("cubrerrueda", arco, [
        (0.0, 0.065, 0.004, 0.004, 2.0), (1.0, 0.07, 0.004, 0.004, 2.0),
    ], m["plastico"], lados=14, sub=4, comba=0.03))
    return piezas


def luz_trasera(m):
    return [c.caja(f"stop_{i}", (0.03, 0.026, 0.026), pos=(lado * 0.022, 0.928, 0.895), rot=(-16, 0, lado * 8),
                   mat=m["stop"], bisel=0.006, segmentos=2) for i, lado in enumerate((-1, 1))]


def asiento(m):
    return [
        c.barrido("asiento_piloto", [(0.0, 0.795), (0.15, 0.785), (0.33, 0.8), (0.41, 0.83)], [
            (0.0, 0.09, 0.02, 0.04, 3.0, 4.0), (0.15, 0.14, 0.036, 0.045, 3.2, 4.0), (0.75, 0.13, 0.032, 0.045, 3.2, 4.0),
            (1.0, 0.09, 0.03, 0.04, 3.0, 4.0),
        ], m["asiento"], lados=22, sub=5),
        c.barrido("asiento_pasajero", [(0.42, 0.872), (0.56, 0.892), (0.7, 0.906)], [
            (0.0, 0.095, 0.024, 0.04, 3.0, 4.0), (0.5, 0.1, 0.028, 0.04, 3.0, 4.0), (1.0, 0.065, 0.018, 0.035, 3.0, 4.0),
        ], m["asiento"], lados=22, sub=5),
    ]


def construir(opciones):
    c.nueva_escena()
    m = materiales()
    raiz = c.vacio("pulsar_200")

    piezas_direccion, faro = direccion(m)
    c.colgar(c.unir("direccion", piezas_direccion), raiz)
    c.colgar(c.unir("faro_delantero", faro), raiz)
    c.colgar(c.unir("chasis", chasis(m)), raiz)
    c.colgar(c.unir("motor", motor(m)), raiz)
    c.colgar(c.unir("escape", escape(m)), raiz)
    c.colgar(c.unir("carroceria", carroceria(m)), raiz)
    c.colgar(c.unir("asiento", asiento(m)), raiz)
    c.colgar(c.unir("luz_trasera", luz_trasera(m)), raiz)
    c.colgar(c.unir("suspension_trasera", pm.amortiguador((0, 0.3, 0.43), (0, 0.13, 0.67), m, m["rojo"], vueltas=7,
                                                          r_resorte=0.03)), raiz)
    ruedas(m, raiz)

    c.validar(NOMBRE, PRESUPUESTO)
    c.exportar_glb(os.path.join(opciones["salida"], f"{NOMBRE}.glb"))
    c.poster(opciones, NOMBRE, pm.ANCHO_POSTER, pm.ALTO_POSTER, pm.AZIMUT, pm.ELEVACION)


if __name__ == "__main__":
    construir(c.argumentos())
