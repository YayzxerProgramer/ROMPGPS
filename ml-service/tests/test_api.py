"""Pruebas de la API. Usan un modelo mínimo entrenado al vuelo: no dependen de models/."""
import joblib
import pytest
from fastapi.testclient import TestClient
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.common import OBJETIVO, VARIABLES, VARIABLES_CATEGORICAS
from app.simulador import simular

CLAVE = "clave-de-prueba"
BUENA = dict(tipo_vehiculo="MOTO", tipo_ultimo_mant="PREVENTIVO", km_desde_ult_mant=1200,
            dias_desde_ult_mant=60, horas_mov_desde_mant=40, num_mant_previos=3,
            km_diarios_prom_30d=30, vel_prom_mov_30d=35, paradas_por_100km=60,
            dist_media_recorrido_km=8)


@pytest.fixture(scope="module")
def ruta_modelo(tmp_path_factory):
    df = simular(n_vehiculos=20, ciclos_por_vehiculo=3, muestras_por_ciclo=5, semilla=1)
    pre = ColumnTransformer([("c", OneHotEncoder(handle_unknown="ignore"), VARIABLES_CATEGORICAS)],
                            remainder="passthrough")
    m = Pipeline([("p", pre), ("m", GradientBoostingRegressor(n_estimators=30, random_state=1))])
    m.fit(df[VARIABLES], df[OBJETIVO])
    ruta = tmp_path_factory.mktemp("m") / "modelo.joblib"
    joblib.dump({"modelo": m, "variables": VARIABLES, "nombre": "prueba", "umbral_alerta_km": 500.0,
                "error_tipico_km": 300.0, "datos": "SIMULADOS"}, ruta)
    return ruta


@pytest.fixture()
def cliente(ruta_modelo, monkeypatch):
    import app.api as api
    monkeypatch.setenv("ML_API_KEY", CLAVE)
    monkeypatch.setattr(api, "RUTA_MODELO", ruta_modelo)
    with TestClient(api.app) as c:
        yield c


def test_salud_no_pide_clave(cliente):
    assert cliente.get("/salud").json() == {"estado": "ok"}


def test_sin_clave_401(cliente):
    assert cliente.post("/predecir", json=BUENA).status_code == 401


def test_clave_incorrecta_401(cliente):
    assert cliente.post("/predecir", json=BUENA, headers={"X-API-Key": "otra"}).status_code == 401


def test_prediccion_valida(cliente):
    r = cliente.post("/predecir", json=BUENA, headers={"X-API-Key": CLAVE})
    assert r.status_code == 200
    d = r.json()
    assert d["km_restantes"] >= 0
    assert d["nivel"] in ("BAJO", "MEDIO", "ALTO")
    assert d["km_restantes_fabricante"] == 1800
    assert d["datos_entrenamiento"] == "SIMULADOS"


def test_datos_absurdos_422(cliente):
    mala = {**BUENA, "km_desde_ult_mant": -5}
    assert cliente.post("/predecir", json=mala, headers={"X-API-Key": CLAVE}).status_code == 422
    mala = {**BUENA, "tipo_vehiculo": "BICI"}
    assert cliente.post("/predecir", json=mala, headers={"X-API-Key": CLAVE}).status_code == 422


def test_no_arranca_sin_clave(ruta_modelo, monkeypatch):
    import app.api as api
    monkeypatch.delenv("ML_API_KEY", raising=False)
    monkeypatch.setattr(api, "RUTA_MODELO", ruta_modelo)
    with pytest.raises(RuntimeError):
        with TestClient(api.app):
            pass
