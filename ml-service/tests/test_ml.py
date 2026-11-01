"""Pruebas de las piezas del modelo. Ejecutar: python -m pytest -q"""
import numpy as np
import pandas as pd
import pytest

from app.common import (OBJETIVO, UMBRAL_ALTO_KM, UMBRAL_MEDIO_KM, VARIABLES,
                        nivel, prediccion_base)
from app.entrenar import (calibrar_umbral_alerta, candidatos, ajustar,
                        dividir_por_vehiculo, metricas)
from app.simulador import simular


@pytest.fixture(scope="module")
def datos():
    return simular(n_vehiculos=40, semilla=7)


def test_simulador_es_reproducible():
    a = simular(n_vehiculos=5, semilla=1)
    b = simular(n_vehiculos=5, semilla=1)
    pd.testing.assert_frame_equal(a, b)


def test_simulador_forma_y_columnas(datos):
    assert len(datos) == 40 * 8 * 10
    assert list(datos.columns) == ["id_vehiculo", "ciclo"] + VARIABLES + [OBJETIVO]


def test_simulador_sin_nulos_ni_objetivo_negativo(datos):
    assert not datos.isna().any().any()
    assert (datos[OBJETIVO] >= 0).all()
    assert (datos["km_desde_ult_mant"] >= 0).all()


def test_particion_sin_vehiculos_repetidos(datos):
    i_entr, i_val, i_test = dividir_por_vehiculo(datos)
    grupos = [set(datos.iloc[i]["id_vehiculo"]) for i in (i_entr, i_val, i_test)]
    assert not grupos[0] & grupos[1]
    assert not grupos[0] & grupos[2]
    assert not grupos[1] & grupos[2]
    assert len(i_entr) + len(i_val) + len(i_test) == len(datos)


def test_niveles_en_los_limites():
    assert nivel(UMBRAL_ALTO_KM) == "ALTO"
    assert nivel(UMBRAL_ALTO_KM + 1) == "MEDIO"
    assert nivel(UMBRAL_MEDIO_KM) == "MEDIO"
    assert nivel(UMBRAL_MEDIO_KM + 1) == "BAJO"
    assert list(nivel([0, 200, 900])) == ["ALTO", "MEDIO", "BAJO"]


def test_linea_base_no_da_negativos():
    pred = prediccion_base(["MOTO", "CARRO"], [99999, 0])
    assert pred[0] == 0
    assert pred[1] > 0


def test_calibrar_umbral_alcanza_la_meta():
    rng = np.random.default_rng(0)
    real = rng.uniform(0, 1500, 2000)
    pred = real + rng.normal(0, 250, 2000)
    umbral = calibrar_umbral_alerta(real, pred, meta=85.0)
    assert umbral >= UMBRAL_ALTO_KM
    assert metricas(real, pred, umbral)["recall_alto_pct"] >= 85.0


def test_calibrar_umbral_sin_casos_alto():
    assert calibrar_umbral_alerta([1000, 2000], [900, 2100]) == UMBRAL_ALTO_KM


def test_los_tres_modelos_entrenan_y_predicen(datos):
    entr = datos[datos["id_vehiculo"].isin(datos["id_vehiculo"].unique()[:30])]
    for nombre, (pipe, rejilla) in candidatos(rapido=True).items():
        modelo, _ = ajustar(nombre, pipe, rejilla, entr[VARIABLES], entr[OBJETIVO], entr["id_vehiculo"])
        pred = modelo.predict(datos[VARIABLES].head(5))
        assert pred.shape == (5,) and np.isfinite(pred).all(), nombre
