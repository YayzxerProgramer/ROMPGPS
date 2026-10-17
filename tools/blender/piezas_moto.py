"""
Piezas compartidas por las tres motos (versión realista).

Ruedas con perfil real de neumático y dibujo de rodadura, rines con pestañas,
ruedas de radios con cruce y niples, rines de aleación con brazos
esculpidos, discos perforados por booleana, pinzas, horquillas con
guardapolvos y tijas, manubrio con piñas, bomba de freno, manetas y cables,
espejos, direccionales con lente translúcida, amortiguadores, cadena con
eslabones, piñones dentados, estribos y tornillería.

Convenciones de comun.py: metros, Z arriba, frente a -Y, lado derecho del
piloto en -X. Las ruedas se construyen centradas en el origen con el eje en X.
"""

import math

import bmesh
from mathutils import Matrix, Vector

import comun as c
import superficies as s
import texturas as t

# Cámara de los pósters (3/4 frontal derecho, como las fotos de referencia).
AZIMUT, ELEVACION = 58, 12
ANCHO_POSTER, ALTO_POSTER = 960, 640


def materiales_base():
    plastico = t.grano_plastico()
    fundido = t.aluminio_fundido()
    cepillado = t.aluminio_cepillado()
    return {
        "caucho": t.material_pbr("caucho", "#111111", rugosidad=0.86),
        "cromo": c.material("cromo", "#f2f4f6", metal=1.0, rugosidad=0.05),
        "aluminio": t.material_pbr("aluminio_fundido", "#a9adad", metal=0.9, rugosidad=0.42, normal=fundido,
                                   escala=(160, 160), fuerza_normal=0.6),
        "aluminio_pulido": c.material("aluminio_pulido", "#dde0e0", metal=1.0, rugosidad=0.16),
        "cepillado": t.material_pbr("aluminio_cepillado", "#c9cccd", metal=1.0, rugosidad=0.3, normal=cepillado,
                                    escala=(140, 140), fuerza_normal=0.5),
        "negro_mate": t.material_pbr("negro_mate", "#121313", rugosidad=0.62, normal=plastico, escala=(300, 300),
                                     fuerza_normal=0.3),
        "negro_satinado": c.material("negro_satinado", "#0f1010", metal=0.15, rugosidad=0.38),
        "chasis": c.material("pintura_chasis", "#0c0d0d", rugosidad=0.34, capa=0.4, capa_rugosidad=0.12),
        "plastico": t.material_pbr("plastico_texturizado", "#161717", rugosidad=0.6, normal=plastico,
                                   escala=(300, 300), fuerza_normal=0.45),
        "goma": t.material_pbr("goma", "#101010", rugosidad=0.82, normal=t.estrias_puno(), escala=(90, 90),
                               fuerza_normal=0.8),
        "pavonado": c.material("acero_pavonado", "#2c2d30", metal=0.85, rugosidad=0.42),
        "zincado": c.material("acero_zincado", "#bfc3c7", metal=1.0, rugosidad=0.3),
        "disco": t.material_pbr("disco_freno", "#b7bbbe", metal=1.0, rugosidad=0.3, normal=cepillado,
                                escala=(220, 220), fuerza_normal=0.6),
        "cadena": c.material("cadena", "#3b3a38", metal=0.85, rugosidad=0.45),
        "lente_clara": t.material_pbr("lente_clara", "#ffffff", rugosidad=0.02, transmision=0.95, ior=1.49),
        "lente_ambar": t.material_pbr("lente_ambar", "#ff8d1a", rugosidad=0.05, transmision=0.6, ior=1.49,
                                      emision="#ff7a00", fuerza_emision=0.25),
        "lente_roja": t.material_pbr("lente_roja", "#c8101b", rugosidad=0.05, transmision=0.55, ior=1.49,
                                     emision="#ff1020", fuerza_emision=0.35),
        "reflector": c.material("reflector", "#eef0f2", metal=1.0, rugosidad=0.18),
        "led": c.material("led_blanco", "#f2f8ff", emision="#f2f8ff", fuerza_emision=7.0),
        "espejo": c.material("cristal_espejo", "#e6ebee", metal=1.0, rugosidad=0.02),
        "asiento": t.material_pbr("asiento", "#161616", rugosidad=0.72, normal=t.grano_cuero(), escala=(36, 36),
                                  fuerza_normal=0.7),
        "placa": c.material("placa", "#ece9dd", rugosidad=0.55),
        "pantalla": c.material("pantalla_lcd", "#0a120f", rugosidad=0.08, emision="#1f3a2a", fuerza_emision=0.6),
    }


def _polar(r, a):
    """Punto del plano de la rueda (YZ) a partir de radio y ángulo."""
    return (r * math.cos(a), r * math.sin(a))


def perno(pos, eje="X", r=0.005, largo=0.006, m=None, mat=None, arandela=True):
    """Cabeza hexagonal con arandela, orientada según `eje` (hacia +eje)."""
    piezas = []
    rot = {"X": (0, 90, 0), "-X": (0, -90, 0), "Y": (-90, 0, 0), "-Y": (90, 0, 0), "Z": (0, 0, 0)}[eje]
    cabeza = c.cilindro("perno", r, largo, mat=mat or m["zincado"], lados=6, bisel=r * 0.12)
    piezas.append(cabeza)
    if arandela:
        piezas.append(c.cilindro("arandela", r * 1.45, largo * 0.25, pos=(0, 0, -largo * 0.55),
                                 mat=mat or m["zincado"], lados=16))
    for p in piezas:
        p.data.transform(c.matriz(pos, rot))
    return piezas


# ── Neumáticos y rines ───────────────────────────────────────────────────────

def neumatico(nombre, r_llanta, r_ext, ancho, mat, lados=72, repeticiones=24):
    """Neumático con perfil real (talones estrechos, flancos abombados y
    corona redonda) y UV pensadas para el dibujo de rodadura: u da la vuelta
    `repeticiones` veces, v recorre el perfil de talón a talón con la corona
    en v = 0.5."""
    alto = r_ext - r_llanta
    talon = ancho * 0.36
    perfil = []
    # Media sección del lado +X: desde el interior centrado hasta la corona.
    claves = [
        (r_llanta - 0.004, 0.0), (r_llanta - 0.004, talon * 0.8), (r_llanta + 0.002, talon * 1.02),
        (r_llanta + alto * 0.22, ancho * 0.44), (r_llanta + alto * 0.48, ancho * 0.5),
        (r_llanta + alto * 0.7, ancho * 0.48), (r_llanta + alto * 0.86, ancho * 0.38),
        (r_llanta + alto * 0.96, ancho * 0.2), (r_ext, 0.0),
    ]
    medio = [Vector((0, rr, xx)) for rr, xx in claves]
    suave = c.catmull_rom(medio, 3)
    mitad = [(p.y, p.z) for p in suave]
    # Lazo completo: interior → flanco +X → corona → flanco -X → interior.
    perfil = mitad + [(r, -x) for r, x in reversed(mitad[1:-1])]
    n = len(perfil)
    bm = bmesh.new()
    capa = bm.loops.layers.uv.new("UVMap")
    aros = []
    for k in range(lados):
        a = 2 * math.pi * k / lados
        aros.append([bm.verts.new((x, r * math.cos(a), r * math.sin(a))) for r, x in perfil])
    # v: corona (índice len(mitad)-1) en 0.5; el lazo empieza en el interior (v = 0).
    for k in range(lados):
        a_ = aros[k]
        b_ = aros[(k + 1) % lados]
        u0 = k / lados * repeticiones
        u1 = (k + 1) / lados * repeticiones
        for i in range(n):
            j = (i + 1) % n
            cara = bm.faces.new((a_[i], b_[i], b_[j], a_[j]))
            v0 = i / n
            v1 = (i + 1) / n
            for bucle, uv in zip(cara.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
                bucle[capa].uv = uv
    return c.malla(nombre, bm, mat, 70)


def aro(nombre, r_llanta, ancho, mat, lados=72):
    """Rin con pestañas, asientos de talón y canal central (perfil de llanta real)."""
    w = ancho / 2
    r = r_llanta
    exterior = [  # cara del neumático, de la pestaña izquierda a la derecha
        (-1.04, 0.008), (-0.98, 0.006), (-0.94, 0.001), (-0.86, 0.0005), (-0.72, 0.0), (-0.6, -0.009),
        (-0.3, -0.0105), (0.3, -0.0105), (0.6, -0.009), (0.72, 0.0), (0.86, 0.0005), (0.94, 0.001),
        (0.98, 0.006), (1.04, 0.008),
    ]
    interior = [  # cara de los radios, de vuelta
        (1.06, 0.006), (1.02, -0.002), (0.85, -0.008), (0.6, -0.017), (0.3, -0.0195), (-0.3, -0.0195),
        (-0.6, -0.017), (-0.85, -0.008), (-1.02, -0.002), (-1.06, 0.006),
    ]
    perfil = [(r + dr, fx * w) for fx, dr in exterior + interior]
    return c.torno(nombre, perfil, mat=mat, lados=lados, cerrado=True, eje="X", angulo=35)


def valvula(r_llanta, angulo, m):
    y, z = _polar(r_llanta - 0.012, angulo)
    y2, z2 = _polar(r_llanta - 0.034, angulo)
    return [
        c.tubo("valvula", [(0.0, y, z), (0.0, y2, z2)], 0.003, m["caucho"], lados=8, sub=1),
        c.tubo("tapon_valvula", [(0.0, *_polar(r_llanta - 0.034, angulo)), (0.0, *_polar(r_llanta - 0.044, angulo))],
               0.0034, m["pavonado"], lados=8, sub=1),
    ]


def rueda_radios(nombre, r_ext, ancho, r_llanta, r_cubo, ancho_cubo, m, mat_neumatico, radios=36, lado_freno=-1,
                 mat_cubo=None):
    """Rueda de radios cruzados (cruce 2) con niples, cubo con freno de tambor
    y tapa de freno con nervios en el lado `lado_freno`."""
    mat_cubo = mat_cubo or m["aluminio"]
    piezas = [
        neumatico(f"{nombre}_neumatico", r_llanta, r_ext, ancho, mat_neumatico),
        aro(f"{nombre}_aro", r_llanta, ancho * 0.72, m["cromo"]),
    ]
    piezas += valvula(r_llanta, math.radians(-60), m)
    w = ancho_cubo / 2
    r_brida = r_cubo * 0.72
    piezas.append(c.torno(f"{nombre}_cubo", [
        (0.0, -w), (0.022, -w), (0.026, -w * 0.9), (r_brida * 0.7, -w * 0.62), (r_brida, -w * 0.58),
        (r_brida, -w * 0.48), (0.032, -w * 0.42), (0.03, 0.0), (0.032, w * 0.42), (r_brida, w * 0.48),
        (r_brida, w * 0.58), (r_brida * 0.7, w * 0.62), (0.026, w * 0.9), (0.022, w), (0.0, w),
    ], mat=mat_cubo, lados=36, eje="X"))
    # Tapa del tambor con nervios radiales y leva.
    lf = lado_freno
    piezas.append(c.torno(f"{nombre}_tambor", [
        (0.0, lf * (w + 0.004)), (0.03, lf * (w + 0.004)), (r_cubo * 0.95, lf * (w - 0.002)),
        (r_cubo, lf * (w - 0.008)), (r_cubo, lf * (w - 0.026)), (r_cubo * 0.9, lf * (w - 0.03)), (0.0, lf * (w - 0.03)),
    ], mat=mat_cubo, lados=40, eje="X"))
    for i in range(8):
        a = 2 * math.pi * i / 8
        y, z = _polar(r_cubo * 0.62, a)
        nervio = c.caja("nervio_tambor", (0.006, r_cubo * 0.62, 0.004), pos=(lf * (w + 0.002), y, z),
                        rot=(math.degrees(a) - 90, 0, 0), mat=mat_cubo, bisel=0.0012, segmentos=1)
        piezas.append(nervio)
    piezas += perno((lf * (w + 0.006), 0, 0), "X" if lf > 0 else "-X", r=0.0085, largo=0.007, m=m)

    por_lado = radios // 2
    paso = 2 * math.pi / por_lado
    for lado in (-1, 1):
        for i in range(por_lado):
            a = paso * i + (paso / 2 if lado > 0 else 0)
            cruce = 2 * paso * (1 if i % 2 == 0 else -1)
            y0, z0 = _polar(r_brida * 0.96, a)
            y1, z1 = _polar(r_llanta - 0.016, a + cruce)
            x0 = lado * w * 0.53
            x1 = lado * 0.006
            piezas.append(c.tubo(f"{nombre}_radio", [(x0, y0, z0), (x1, y1, z1)], 0.0016, m["zincado"], lados=5,
                                 sub=1, tapas=False))
            # Niple en el rin.
            d = (Vector((x1, y1, z1)) - Vector((x0, y0, z0))).normalized()
            p1 = Vector((x1, y1, z1))
            piezas.append(c.tubo(f"{nombre}_niple", [p1 - d * 0.009, p1 + d * 0.002], 0.0026, m["zincado"], lados=6,
                                 sub=1))
    return [c.unir(nombre, piezas)]


def _brazo_aleacion(nombre, a0, a1, r0, r1, ancho0, ancho1, grosor0, grosor1, mat, x=0.0, pasos=5):
    """Brazo de rin de aleación entre los radios r0 y r1, del ángulo a0 al
    a1: sección redondeada que se afina hacia el rin (pieza fundida)."""
    aros = []
    for k in range(pasos + 1):
        t_ = k / pasos
        r = r0 + (r1 - r0) * t_
        a = a0 + (a1 - a0) * t_
        centro = Vector((x, r * math.cos(a), r * math.sin(a)))
        tangencial = Vector((0, -math.sin(a), math.cos(a)))
        axial = Vector((1, 0, 0))
        w = (ancho0 + (ancho1 - ancho0) * t_) / 2
        g = (grosor0 + (grosor1 - grosor0) * t_) / 2
        contorno = s.rect_redondeado(w, g, min(w, g) * 0.7, n_lado_x=1, n_lado_y=1, n_esquina=3)
        aros.append([centro + tangencial * px + axial * py for px, py in contorno])
    return s.anillos(nombre, aros, mat, tapas=("plana", "plana"), subdiv=0, angulo=70)


def rueda_aleacion(nombre, r_ext, ancho, r_llanta, m, mat_llanta, mat_neumatico, estilo="V", brazos=5,
                   mat_filete=None, ancho_cubo=0.1):
    """Rin de aleación con brazos dobles en V (Raider) o en Y (Pulsar)."""
    piezas = [
        neumatico(f"{nombre}_neumatico", r_llanta, r_ext, ancho, mat_neumatico),
        aro(f"{nombre}_aro", r_llanta, ancho * 0.8, mat_llanta),
    ]
    piezas += valvula(r_llanta, math.radians(-54), m)
    w = ancho_cubo / 2
    piezas.append(c.torno(f"{nombre}_cubo", [
        (0.0, -w), (0.024, -w), (0.026, -w * 0.94), (0.032, -w * 0.9), (0.034, -w * 0.5), (0.05, -w * 0.32),
        (0.052, -w * 0.2), (0.052, w * 0.2), (0.05, w * 0.32), (0.034, w * 0.5), (0.032, w * 0.9), (0.026, w * 0.94),
        (0.024, w), (0.0, w),
    ], mat=mat_llanta, lados=40, eje="X"))
    r_hub = 0.045
    r_rim = r_llanta - 0.014
    for b in range(brazos):
        base = 2 * math.pi * b / brazos + math.pi / 2
        if estilo == "V":
            for lado in (-1, 1):
                piezas.append(_brazo_aleacion(f"{nombre}_brazo", base + lado * 0.06, base + lado * 0.17, r_hub, r_rim,
                                              0.026, 0.016, 0.034, 0.02, mat_llanta))
        else:
            r_medio = r_hub + (r_rim - r_hub) * 0.5
            piezas.append(_brazo_aleacion(f"{nombre}_tallo", base, base, r_hub, r_medio + 0.012, 0.034, 0.026, 0.034,
                                          0.026, mat_llanta))
            for lado in (-1, 1):
                piezas.append(_brazo_aleacion(f"{nombre}_rama", base + lado * 0.03, base + lado * 0.2, r_medio,
                                              r_rim, 0.02, 0.014, 0.024, 0.016, mat_llanta))
    if mat_filete is not None:
        for lado in (-1, 1):
            piezas.append(c.torno(f"{nombre}_filete", [
                (r_llanta + 0.0072, lado * ancho * 0.43), (r_llanta + 0.0088, lado * ancho * 0.43),
                (r_llanta + 0.0086, lado * ancho * 0.418), (r_llanta + 0.0005, lado * ancho * 0.355),
                (r_llanta - 0.006, lado * ancho * 0.305), (r_llanta - 0.0068, lado * ancho * 0.318),
            ], mat=mat_filete, lados=96, cerrado=True, eje="X"))
    return [c.unir(nombre, piezas)]


def disco_freno(nombre, r_ext, r_int, x, m, filas=((0.5, 18), (0.78, 18)), mat_porta=None, ondulado=0):
    """Disco perforado (agujeros reales por booleana) con portadisco de brazos."""
    lado = 1 if x > 0 else -1
    e = 0.0045
    if ondulado:
        # Borde de margarita: el radio exterior ondula con `ondulado` lóbulos.
        aros = []
        lados = ondulado * 8
        contorno_ext = []
        for k in range(lados):
            a = 2 * math.pi * k / lados
            r = r_ext - 0.006 * (0.5 + 0.5 * math.cos(ondulado * a))
            contorno_ext.append((r * math.cos(a), r * math.sin(a)))
        contorno_int = [(r_int * math.cos(2 * math.pi * k / lados), r_int * math.sin(2 * math.pi * k / lados))
                        for k in range(lados)]
        for cont, xx in ((contorno_int, x - e / 2), (contorno_ext, x - e / 2), (contorno_ext, x + e / 2),
                         (contorno_int, x + e / 2)):
            aros.append([(xx, py, pz) for py, pz in cont])
        disco = s.anillos(f"{nombre}_disco", aros, m["disco"], tapas=(None, None), subdiv=0, angulo=50)
        # Cerrar el lazo: se une el último anillo con el primero.
        bm = bmesh.new()
        bm.from_mesh(disco.data)
        bm.verts.ensure_lookup_table()
        nv = lados
        for k in range(nv):
            j = (k + 1) % nv
            a_, b_ = bm.verts[3 * nv + k], bm.verts[3 * nv + j]
            c_, d_ = bm.verts[j], bm.verts[k]
            bm.faces.new((a_, b_, c_, d_))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(disco.data)
        bm.free()
        c.sombrear(disco, 50)
    else:
        disco = c.torno(f"{nombre}_disco", [
            (r_int, x - e / 2), (r_ext, x - e / 2), (r_ext, x + e / 2), (r_int, x + e / 2),
        ], mat=m["disco"], lados=72, cerrado=True, eje="X")
    agujeros = []
    for fraccion, n in filas:
        r = r_int + (r_ext - r_int) * fraccion
        for i in range(n):
            a = 2 * math.pi * (i + (0.5 if fraccion > 0.6 else 0)) / n
            y, z = _polar(r, a)
            agujeros.append(c.cilindro("agujero", 0.0042, e * 3, pos=(x, y, z), lados=8, eje="X"))
    s.restar(disco, agujeros)
    c.sombrear(disco, 50)
    piezas = [disco]
    porta = c.torno(f"{nombre}_porta", [
        (0.028, x - lado * 0.002), (r_int + 0.012, x - lado * 0.001), (r_int + 0.012, x + lado * 0.004),
        (0.04, x + lado * 0.006), (0.028, x + lado * 0.006),
    ], mat=mat_porta or m["disco"], lados=48, cerrado=True, eje="X")
    ventanas = []
    for i in range(5):
        a = 2 * math.pi * i / 5 + 0.6
        y, z = _polar((0.045 + r_int) / 2 + 0.004, a)
        ventanas.append(s.caja_redondeada("ventana", (0.03, 0.022, (r_int - 0.045) * 0.75), 0.008, pos=(x, y, z),
                                          rot=(math.degrees(a) - 90, 0, 0), segmentos=2))
    s.restar(porta, ventanas)
    c.sombrear(porta, 45)
    piezas.append(porta)
    for i in range(5):
        a = 2 * math.pi * i / 5
        y, z = _polar(r_int + 0.006, a)
        piezas += perno((x + lado * 0.004, y, z), "X" if lado > 0 else "-X", r=0.0042, largo=0.004, m=m,
                        arandela=False)
    return piezas


def pinza(nombre, centro_eje, radio, angulo, x, mat, m, pistones=2):
    """Pinza flotante de dos pistones colocada sobre el disco."""
    lado = 1 if x > 0 else -1
    a = math.radians(angulo)
    y, z = centro_eje[0] + radio * math.cos(a), centro_eje[1] + radio * math.sin(a)
    rot = (math.degrees(a) + 90, 0, 0)
    cuerpo = s.caja_redondeada(f"{nombre}", (0.03, 0.075, 0.042), 0.008, pos=(x + lado * 0.012, y, z), rot=rot,
                               mat=mat, segmentos=3)
    puente = s.caja_redondeada(f"{nombre}_puente", (0.03, 0.05, 0.018), 0.005,
                               pos=(x - lado * 0.004, y + 0.016 * math.cos(a), z + 0.016 * math.sin(a)), rot=rot,
                               mat=mat, segmentos=2)
    piezas = [cuerpo, puente]
    for i in range(pistones):
        off = (i - (pistones - 1) / 2) * 0.03
        py = y + off * (-math.sin(a))
        pz = z + off * math.cos(a)
        piezas.append(c.cilindro("tapa_piston", 0.012, 0.004, pos=(x + lado * 0.028, py, pz), mat=mat, lados=20,
                                 eje="X", bisel=0.0015))
    piezas.append(c.cilindro("purgador", 0.003, 0.012, pos=(x + lado * 0.02, y + 0.03 * math.cos(a),
                                                             z + 0.03 * math.sin(a)), mat=m["zincado"], lados=6))
    return piezas


def corona(nombre, dientes, r_primitivo, x, m, grosor=0.005, aligerada=True):
    """Corona/piñón con dientes reales (contorno extruido) y aligeramientos."""
    paso = 2 * math.pi / dientes
    contorno = []
    for i in range(dientes):
        a = i * paso
        for frac, r in ((0.0, r_primitivo - 0.004), (0.18, r_primitivo - 0.0035), (0.32, r_primitivo + 0.0035),
                        (0.5, r_primitivo + 0.0045), (0.68, r_primitivo + 0.0035), (0.82, r_primitivo - 0.0035)):
            contorno.append(_polar(r, a + frac * paso))
    obj = c.prisma(nombre, contorno, x - grosor / 2, x + grosor / 2, m["cadena"], bisel=0.0006, segmentos=1)
    huecos = [c.cilindro("eje_corona", 0.028, 0.03, pos=(x, 0, 0), lados=20, eje="X")]
    if aligerada and r_primitivo > 0.06:
        for i in range(6):
            a = 2 * math.pi * i / 6
            y, z = _polar(r_primitivo * 0.62, a)
            huecos.append(c.cilindro("aligerado", r_primitivo * 0.18, 0.03, pos=(x, y, z), lados=16, eje="X"))
    s.restar(obj, huecos)
    c.sombrear(obj, 40)
    return obj


# ── Tren delantero ───────────────────────────────────────────────────────────

def eje_direccion(rake):
    """Vector unitario de la horquilla (sube y se inclina hacia atrás)."""
    return Vector((0.0, math.sin(math.radians(rake)), math.cos(math.radians(rake))))


def horquilla(eje, rake, largo, separacion, r_barra, r_funda, largo_funda, mat_barra, mat_funda, m,
              cubre_barras=None, reflectores=False):
    """Horquilla telescópica: barras, guardapolvos, botellas con patas de eje,
    tapones, tijas y (opcional) cubrebarras y reflectores ámbar."""
    d = eje_direccion(rake)
    base = Vector(eje)
    piezas = []
    lateral = Vector((1, 0, 0))
    adelante = d.cross(lateral).normalized()
    for lado in (-1, 1):
        x = lateral * (lado * separacion)
        inicio = base + x - d * 0.04
        fin_funda = inicio + d * largo_funda
        # Botella con pata del eje (más gruesa abajo, perfil cónico).
        piezas.append(c.tubo("botella", [inicio, inicio + d * largo_funda * 0.15, fin_funda],
                             lambda u: r_funda * (1.08 - 0.12 * u), mat_funda, lados=20, sub=2))
        piezas.append(s.caja_redondeada("pata_eje", (0.034, 0.05, 0.05), 0.012,
                                        pos=base + x + lateral * (lado * 0.004), rot=(-rake, 0, 0), mat=mat_funda,
                                        segmentos=2))
        piezas.append(c.tubo("guardapolvo", [fin_funda - d * 0.006, fin_funda + d * 0.016],
                             lambda u: r_barra * (1.32 - 0.22 * u), m["goma"], lados=20, sub=1))
        tope = base + x + d * largo
        piezas.append(c.tubo("barra", [fin_funda - d * 0.02, tope], r_barra, mat_barra, lados=20, sub=1))
        piezas.append(c.tubo("tapon", [tope - d * 0.002, tope + d * 0.014], r_barra * 0.98, m["pavonado"], lados=6,
                             sub=1))
        piezas += perno(base + x + lateral * (lado * 0.024), "X" if lado > 0 else "-X", r=0.007, largo=0.006, m=m)
        if cubre_barras is not None:
            alto0, alto1, r_cubre = cubre_barras
            piezas.append(c.tubo("cubrebarra", [base + x + d * alto0, base + x + d * alto1], r_cubre,
                                 m["negro_satinado"], lados=20, sub=1))
        if reflectores:
            centro_ref = inicio + d * (largo_funda * 0.62) - adelante * (r_funda * 0.7) + lateral * (lado * r_funda * 0.75)
            piezas.append(s.caja_redondeada("reflector", (0.012, 0.012, 0.05), 0.004, pos=centro_ref,
                                            rot=(-rake, 0, 0), mat=m["lente_ambar"], segmentos=2))
    piezas.append(c.cilindro("eje_delantero", 0.008, separacion * 2 + 0.05, pos=base, mat=m["zincado"], lados=12,
                             eje="X"))
    tope = base + d * largo
    rot = (-rake, 0, 0)
    piezas.append(s.caja_redondeada("tija_superior", (separacion * 2 + 0.06, 0.075, 0.02), 0.009,
                                    pos=tope - d * 0.004, rot=rot, mat=m["aluminio"], segmentos=3))
    piezas.append(s.caja_redondeada("tija_inferior", (separacion * 2 + 0.058, 0.07, 0.032), 0.01,
                                    pos=tope - d * 0.14, rot=rot, mat=m["negro_satinado"], segmentos=3))
    piezas.append(c.cilindro("tuerca_direccion", 0.014, 0.012, pos=tope + d * 0.008, rot=rot, mat=m["zincado"],
                             lados=6, bisel=0.002))
    return piezas, tope


def manubrio(centro, semiancho, retroceso, subida, m, radio=0.011, mat=None, estilo="commuter",
             destino_cables=None):
    """Manubrio con puños estriados, contrapesos, piñas de mandos, bomba de
    freno con depósito, manetas forjadas y cables hacia `destino_cables`."""
    cx, cy, cz = centro
    camino = [
        (-semiancho, cy + retroceso, cz + subida), (-semiancho * 0.72, cy + retroceso * 0.82, cz + subida * 0.94),
        (-semiancho * 0.38, cy + retroceso * 0.22, cz + subida * 0.4), (0, cy, cz),
        (semiancho * 0.38, cy + retroceso * 0.22, cz + subida * 0.4),
        (semiancho * 0.72, cy + retroceso * 0.82, cz + subida * 0.94), (semiancho, cy + retroceso, cz + subida),
    ]
    piezas = [c.tubo("manubrio", camino, radio, mat or m["negro_satinado"], lados=16, sub=8)]
    for lado in (-1, 1):
        a = Vector((lado * semiancho, cy + retroceso, cz + subida))
        b = Vector((lado * semiancho * 0.72, cy + retroceso * 0.82, cz + subida * 0.94))
        d = (b - a).normalized()
        piezas.append(c.tubo("puno", [a - d * 0.008, a + d * 0.125], lambda u: 0.0165 + 0.0012 * math.sin(math.pi * u),
                             m["goma"], lados=16, sub=4))
        piezas.append(c.tubo("contrapeso", [a - d * 0.02, a - d * 0.006], 0.0145, m["cromo"] if estilo == "commuter"
                             else m["negro_satinado"], lados=16, sub=1))
        pina = a + d * 0.15
        piezas.append(s.caja_redondeada("pina", (0.05, 0.052, 0.046), 0.012, pos=pina, rot=(0, 0, 0),
                                        mat=m["plastico"], segmentos=2))
        for k in range(3):
            piezas.append(s.caja_redondeada("boton", (0.012, 0.008, 0.008), 0.002,
                                            pos=pina + Vector((lado * 0.006, -0.026, 0.012 - k * 0.012)),
                                            mat=m["negro_satinado"], segmentos=1))
        # Maneta (freno a la derecha, embrague a la izquierda) y su soporte.
        soporte = a + d * 0.2
        if lado < 0:
            piezas.append(s.caja_redondeada("bomba_freno", (0.04, 0.034, 0.03), 0.008, pos=soporte, mat=m["negro_satinado"],
                                            segmentos=2))
            piezas.append(c.cilindro("deposito", 0.017, 0.022, pos=soporte + Vector((lado * 0.004, 0.006, 0.026)),
                                     mat=m["negro_satinado"], lados=24, bisel=0.003))
            piezas.append(c.cilindro("tapa_deposito", 0.0165, 0.003, pos=soporte + Vector((lado * 0.004, 0.006, 0.038)),
                                     mat=m["aluminio_pulido"], lados=24, bisel=0.001))
        else:
            piezas.append(s.caja_redondeada("soporte_embrague", (0.034, 0.03, 0.026), 0.007, pos=soporte,
                                            mat=m["aluminio"], segmentos=2))
        maneta = [soporte + Vector((lado * 0.012, -0.03, -0.004)), soporte + Vector((lado * 0.06, -0.068, -0.012)),
                  soporte + Vector((lado * 0.14, -0.07, -0.02)), soporte + Vector((lado * 0.17, -0.062, -0.022))]
        piezas.append(c.tubo("maneta", maneta, lambda u: 0.0062 * (1 - 0.3 * u), m["aluminio_pulido"], lados=8, sub=5))
        if destino_cables is not None:
            fin = Vector(destino_cables) + Vector((lado * 0.04, 0, 0))
            medio = (soporte + fin) / 2 + Vector((lado * 0.05, -0.08, 0.02))
            piezas.append(c.tubo("cable_mando", [soporte + Vector((-lado * 0.01, 0.01, 0)), medio, fin], 0.0035,
                                 m["negro_satinado"], lados=8, sub=8))
    return piezas


def espejo(base, lado, m, alto=0.2, abierto=0.07, estilo="ovalo", retroceso=0.012):
    """Espejo retrovisor: tallo, rótula y cabeza con su cristal (hacia el piloto)."""
    b = Vector(base)
    cabeza = b + Vector((lado * abierto, retroceso, alto))
    piezas = [
        c.tubo("tallo_espejo", [b, b + Vector((lado * abierto * 0.3, retroceso * 0.35, alto * 0.55)), cabeza], 0.0055,
               m["negro_satinado"], lados=8, sub=6),
        c.esfera("rotula", 0.008, pos=cabeza, mat=m["negro_satinado"], segmentos=12, anillos=6),
    ]
    if estilo == "ovalo":
        n = 28
        contorno = [(0.058 * math.cos(2 * math.pi * k / n), 0.04 * math.sin(2 * math.pi * k / n)) for k in range(n)]
    else:
        esquinas = ([(-0.068, -0.012), (0.04, -0.03), (0.07, -0.006), (0.058, 0.028), (-0.05, 0.032), (-0.072, 0.012)]
                    if estilo == "anguloso" else
                    [(-0.07, -0.02), (0.05, -0.026), (0.074, 0.0), (0.052, 0.026), (-0.062, 0.024)])
        contorno = [(p.x, p.y) for p in c.catmull_rom([Vector((x, z, 0)) for x, z in esquinas], 4, cerrado=True)]
    centro = cabeza + Vector((lado * 0.052, 0.006, 0.026))

    def aro_espejo(fondo, escala):
        # El cristal mira al piloto (+Y); x se refleja según el lado.
        return [centro + Vector((x * escala * lado, fondo, z * escala)) for x, z in contorno]

    piezas.append(s.anillos("carcasa_espejo", [aro_espejo(-0.022, 0.86), aro_espejo(-0.015, 0.97),
                                               aro_espejo(0.0, 1.0), aro_espejo(0.004, 0.99)],
                            m["plastico"], tapas=("plana", "plana"), subdiv=1, angulo=50))
    piezas.append(s.anillos("cristal_espejo", [aro_espejo(0.0045, 0.9), aro_espejo(0.0053, 0.9)], m["espejo"],
                            tapas=("plana", "plana"), subdiv=0))
    return piezas


def direccional(pos, lado, m, tallo=0.05, largo=0.034, radio=0.012, eje="X"):
    """Intermitente: tallo de goma, carcasa y lente ámbar translúcida con reflector."""
    p = Vector(pos)
    d = Vector((lado, 0, 0)) if eje == "X" else Vector((0, lado, 0))
    punta = p + d * tallo
    return [
        c.tubo("tallo_direccional", [p, p + d * (tallo * 0.5), punta], lambda u: 0.0055 + 0.002 * u, m["goma"],
               lados=10, sub=2),
        c.tubo("carcasa_direccional", [punta, punta + d * (largo * 0.45)], lambda u: radio * (0.75 + 0.25 * u),
               m["negro_satinado"], lados=18, sub=2),
        c.torno("lente_direccional", [
            (0.0, 0.0), (radio * 1.0, 0.0), (radio * 0.98, largo * 0.35), (radio * 0.75, largo * 0.48),
            (radio * 0.35, largo * 0.55), (0.0, largo * 0.56),
        ], pos=punta + d * (largo * 0.42), rot=(0, 90 * lado, 0) if eje == "X" else (-90 * lado, 0, 0),
            mat=m["lente_ambar"], lados=20),
        c.esfera("bombillo", radio * 0.45, pos=punta + d * (largo * 0.6), mat=m["reflector"], segmentos=10, anillos=5),
    ]


# ── Tren trasero ─────────────────────────────────────────────────────────────

def amortiguador(inferior, superior, m, mat_resorte, vueltas=9, r_resorte=0.027, mat_cuerpo=None, mat_vastago=None):
    """Amortiguador con ojos, casquillos, cuerpo, vástago, tope y resorte."""
    p0, p1 = Vector(inferior), Vector(superior)
    eje = p1 - p0
    largo = eje.length
    a = eje.normalized()
    u = a.orthogonal().normalized()
    v = a.cross(u)
    cuerpo = mat_cuerpo or m["negro_satinado"]
    piezas = [
        c.cilindro("ojo_inferior", 0.016, 0.03, pos=p0, mat=cuerpo, lados=16, eje="X", bisel=0.003),
        c.cilindro("casquillo_inf", 0.008, 0.036, pos=p0, mat=m["zincado"], lados=10, eje="X"),
        c.tubo("cuerpo_amortiguador", [p0 + a * 0.012, p0 + a * largo * 0.44], 0.0185, cuerpo, lados=20, sub=1),
        c.tubo("asiento_resorte", [p0 + a * largo * 0.12, p0 + a * largo * 0.14], r_resorte + 0.004, m["cromo"],
               lados=20, sub=1),
        c.tubo("vastago", [p0 + a * largo * 0.42, p0 + a * largo * 0.9], 0.0075, mat_vastago or m["cromo"], lados=12,
               sub=1),
        c.tubo("tope", [p0 + a * largo * 0.8, p1 - a * 0.012], lambda q: 0.021 + 0.002 * q, cuerpo, lados=20, sub=1),
        c.tubo("platillo", [p0 + a * largo * 0.84, p0 + a * largo * 0.865], r_resorte + 0.005, m["cromo"], lados=20,
               sub=1),
        c.cilindro("ojo_superior", 0.015, 0.03, pos=p1, mat=cuerpo, lados=16, eje="X", bisel=0.003),
        c.cilindro("casquillo_sup", 0.008, 0.036, pos=p1, mat=m["zincado"], lados=10, eje="X"),
    ]
    puntos = []
    pasos = vueltas * 12
    for k in range(pasos + 1):
        t_ = k / pasos
        ang = 2 * math.pi * vueltas * t_
        puntos.append(p0 + a * (largo * (0.15 + 0.69 * t_)) + (u * math.cos(ang) + v * math.sin(ang)) * r_resorte)
    piezas.append(c.tubo("resorte", puntos, 0.0045, mat_resorte, lados=8, sub=2))
    return piezas


def _recorrido_cadena(c0, r0, c1, r1, x, paso):
    """Puntos equiespaciados (paso de la cadena) por el contorno exterior de
    dos círculos tangentes: piñón (c0, r0) y corona (c1, r1)."""
    p0, p1 = Vector((0, *c0)), Vector((0, *c1))
    d = (p1 - p0)
    dist = d.length
    ang = math.atan2(d.z, d.y)
    # Tangente exterior: la normal n cumple n·(c1 − c0) = r0 − r1.
    beta = math.acos((r0 - r1) / dist)
    # Ángulos de tangencia (medidos desde el eje y del plano YZ).
    a_sup0, a_sup1 = ang + beta, ang + beta
    a_inf0, a_inf1 = ang - beta, ang - beta
    densos = []
    # Arco del piñón (lado delantero) de a_sup0 a a_inf0 + 2π (por delante).
    n = 60
    ini, fin = a_sup0, a_inf0 + 2 * math.pi
    for k in range(n + 1):
        a = ini + (fin - ini) * k / n
        densos.append(Vector((x, c0[0] + r0 * math.cos(a), c0[1] + r0 * math.sin(a))))
    # Ramal inferior hasta la corona.
    q0 = Vector((x, c1[0] + r1 * math.cos(a_inf1), c1[1] + r1 * math.sin(a_inf1)))
    for k in range(1, 30):
        densos.append(densos[-1].lerp(q0, k / 30))
    # Arco de la corona (lado trasero).
    ini, fin = a_inf1, a_sup1
    if fin < ini:
        fin += 2 * math.pi
    for k in range(n + 1):
        a = ini + (fin - ini) * k / n
        densos.append(Vector((x, c1[0] + r1 * math.cos(a), c1[1] + r1 * math.sin(a))))
    # Ramal superior de vuelta.
    q1 = densos[0]
    ultimo = densos[-1]
    for k in range(1, 30):
        densos.append(ultimo.lerp(q1, k / 30))
    # Reparto equiespaciado.
    acumulado = [0.0]
    for a_, b_ in zip(densos, densos[1:] + densos[:1]):
        acumulado.append(acumulado[-1] + (b_ - a_).length)
    total = acumulado[-1]
    eslabones = max(int(total / paso), 8)
    salida = []
    j = 0
    for i in range(eslabones):
        objetivo = total * i / eslabones
        while acumulado[j + 1] < objetivo:
            j += 1
        a_, b_ = densos[j], densos[(j + 1) % len(densos)]
        tt = (objetivo - acumulado[j]) / max(acumulado[j + 1] - acumulado[j], 1e-9)
        salida.append(a_.lerp(b_, tt))
    return salida


def cadena(pinon, r_pinon, corona_pos, r_corona, x, m, paso=0.0127):
    """Cadena 428 de eslabones (placas interiores y exteriores con rodillos)."""
    puntos = _recorrido_cadena(pinon, r_pinon, corona_pos, r_corona, x, paso)
    bm_piezas = []
    for i, p in enumerate(puntos):
        q = puntos[(i + 1) % len(puntos)]
        d = q - p
        ang = math.degrees(math.atan2(d.z, d.y))
        centro = (p + q) / 2
        exterior = i % 2 == 0
        sep = 0.0048 if exterior else 0.0032
        for lado in (-1, 1):
            bm_piezas.append(c.caja("placa_cadena", (0.0012, paso * 1.3, 0.0072), pos=centro + Vector((lado * sep, 0, 0)),
                                    rot=(ang, 0, 0), mat=m["cadena"]))
        bm_piezas.append(c.cilindro("rodillo", 0.0039, 0.0072, pos=p, mat=m["cadena"], lados=6, eje="X"))
    return bm_piezas


def estribo(pos, lado, m, largo=0.1, estilo="goma"):
    """Estribo con soporte, eje y goma estriada (o aluminio dentado)."""
    p = Vector(pos)
    piezas = [s.caja_redondeada("soporte_estribo", (0.032, 0.05, 0.03), 0.008, pos=p, mat=m["chasis"], segmentos=2)]
    if estilo == "goma":
        nucleo = c.cilindro("estribo", 0.0135, largo, pos=p + Vector((lado * largo / 2, 0, 0)), mat=m["goma"],
                            lados=16, eje="X", bisel=0.004, segmentos=2)
        piezas.append(nucleo)
        for k in range(6):
            piezas.append(c.cilindro("estria", 0.0148, 0.004,
                                     pos=p + Vector((lado * (0.012 + k * (largo - 0.02) / 5), 0, 0)), mat=m["goma"],
                                     lados=16, eje="X"))
    else:
        piezas.append(s.caja_redondeada("estribo", (largo, 0.03, 0.02), 0.005,
                                        pos=p + Vector((lado * largo / 2, 0, 0)), mat=m["aluminio"], segmentos=2))
        for k in range(5):
            piezas.append(c.caja("diente", (0.004, 0.032, 0.004),
                                 pos=p + Vector((lado * (0.01 + k * (largo - 0.02) / 4), 0, 0.011)), mat=m["aluminio"]))
    return piezas


def portaplaca(pos, m, inclinacion=12):
    """Placa trasera con soporte y pernos."""
    p = Vector(pos)
    piezas = [
        s.caja_redondeada("placa", (0.17, 0.003, 0.105), 0.006, pos=p, rot=(inclinacion, 0, 0), mat=m["placa"],
                          segmentos=2),
        s.caja_redondeada("marco_placa", (0.18, 0.006, 0.115), 0.007, pos=p + Vector((0, 0.004, 0)),
                          rot=(inclinacion, 0, 0), mat=m["plastico"], segmentos=2),
    ]
    for sx in (-1, 1):
        piezas += perno(p + Vector((sx * 0.06, -0.003, 0.03)), "-Y", r=0.0045, largo=0.003, m=m, arandela=False)
    return piezas
