"""
Simulador de ciclos de mantenimiento.

POR QUÉ EXISTE: un ciclo de mantenimiento real tarda meses en completarse, y
durante el curso solo se podrán reunir unos 15 a 20. Con tan pocos datos no se
puede entrenar ni validar nada, así que se generan ciclos sintéticos con una
regla de desgaste explícita. Sirve para validar el PROCEDIMIENTO (que el
entrenamiento, la partición por vehículo y las métricas funcionan), no para
afirmar que el modelo acierta en la realidad.

LA REGLA DE DESGASTE (la "verdad" oculta que el modelo debe descubrir):
  el intervalo real de un vehículo es el del fabricante multiplicado por un
  factor que baja cuando hay muchas paradas, velocidades altas o recorridos
  cortos (arranques en frío), con ruido que representa cuándo decide el dueño
  llevarlo al taller.

Por eso las métricas sobre datos simulados saldrán buenas casi seguro: el
modelo está aprendiendo la regla que escribimos aquí. Lo que cuenta de verdad
es el contraste con los ciclos reales (ver entrenar.py --reales).
"""
import numpy as np
import pandas as pd

from .common import INTERVALO_FABRICANTE_KM, OBJETIVO, VARIABLES


def _factor_desgaste(paradas, velocidad, dist_media):
    """Multiplicador del intervalo: < 1 significa que se desgasta más rápido."""
    dp = paradas - 30.0
    dv = velocidad - 32.0
    dd = np.maximum(0.0, 8.0 - dist_media)
    factor = (1.0
              - 0.004 * dp
              - 0.003 * dv
              - 0.00006 * np.maximum(dp, 0.0) ** 2   # muchas paradas pesan de más
              - 0.015 * dd)                          # recorridos cortos
    return np.clip(factor, 0.55, 1.25)


def simular(n_vehiculos=150, ciclos_por_vehiculo=8, muestras_por_ciclo=10, semilla=42):
    """
    Devuelve un DataFrame con una fila por "foto" de un vehículo en un día dado.

    Cada ciclo (de un mantenimiento al siguiente) aporta `muestras_por_ciclo`
    fotos tomadas en puntos distintos del ciclo. Con los valores por defecto
    son 150 x 8 = 1.200 ciclos y 12.000 filas. La columna `id_vehiculo` sirve
    para partir los datos por vehículo.
    """
    rng = np.random.default_rng(semilla)
    filas = []

    for v in range(n_vehiculos):
        tipo = "MOTO" if rng.random() < 0.6 else "CARRO"
        intervalo_base = INTERVALO_FABRICANTE_KM[tipo]

        # Estilo de uso propio de este vehículo.
        km_dia = float(np.clip(rng.lognormal(np.log(28), 0.45), 5, 150))
        velocidad = float(np.clip(rng.normal(32 if tipo == "MOTO" else 35, 6), 15, 70))
        paradas = float(np.clip(rng.lognormal(np.log(30), 0.4), 5, 120))
        dist_media = float(np.clip(rng.lognormal(np.log(8), 0.5), 1, 60))

        tipo_ultimo = "PREVENTIVO"
        for ciclo in range(ciclos_por_vehiculo):
            # El estilo de uso cambia poco de un ciclo al siguiente.
            km_dia *= rng.lognormal(0, 0.05)
            velocidad *= rng.lognormal(0, 0.03)
            paradas *= rng.lognormal(0, 0.05)
            dist_media *= rng.lognormal(0, 0.05)

            factor = _factor_desgaste(paradas, velocidad, dist_media)
            if tipo_ultimo == "CORRECTIVO":
                factor *= 0.90   # tras una reparación el siguiente ciclo es más corto
            intervalo_real = intervalo_base * factor * rng.lognormal(0, 0.08)

            # Fotos dentro del ciclo; Beta(1.5, 1) pone más fotos hacia el final,
            # que es donde están los casos urgentes que más importan.
            avance = rng.beta(1.5, 1.0, size=muestras_por_ciclo)
            for a in avance:
                km_desde = a * intervalo_real
                filas.append({
                    "id_vehiculo": f"V{v:04d}",
                    "ciclo": ciclo,
                    "tipo_vehiculo": tipo,
                    "tipo_ultimo_mant": tipo_ultimo,
                    "num_mant_previos": ciclo + 1,
                    "km_desde_ult_mant": km_desde,
                    "dias_desde_ult_mant": km_desde / km_dia * rng.lognormal(0, 0.10),
                    "horas_mov_desde_mant": km_desde / velocidad * rng.lognormal(0, 0.10),
                    # Lo que el sistema mediría en los últimos 30 días: el estilo
                    # real más el ruido propio de cualquier medición.
                    "km_diarios_prom_30d": km_dia * rng.lognormal(0, 0.15),
                    "vel_prom_mov_30d": velocidad * rng.lognormal(0, 0.05),
                    "paradas_por_100km": paradas * rng.lognormal(0, 0.12),
                    "dist_media_recorrido_km": dist_media * rng.lognormal(0, 0.12),
                    OBJETIVO: intervalo_real - km_desde,
                })

            # El tipo del mantenimiento que abre el ciclo siguiente.
            tipo_ultimo = "PREVENTIVO" if rng.random() < 0.85 else "CORRECTIVO"

    df = pd.DataFrame(filas)
    return df[["id_vehiculo", "ciclo"] + VARIABLES + [OBJETIVO]]
