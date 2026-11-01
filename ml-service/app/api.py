"""
API del modelo de mantenimiento predictivo (FastAPI).

Es SIN ESTADO: no lee bases de datos ni guarda nada. El backend Spring calcula
las variables (porque es quien tiene los datos GPS y los mantenimientos) y este
servicio solo responde "con estas variables, le faltan X km".

Seguridad: toda ruta de predicción exige la cabecera X-API-Key, y el servicio
NO ARRANCA si no existe ML_API_KEY (mismo criterio que el backend: es mejor no
arrancar que arrancar abierto). Solo el backend debe poder llamarlo; no lo
publiques fuera de tu red.

Ejecutar:  uvicorn app.api:app --host 127.0.0.1 --port 8000
"""
import hmac
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.common import VARIABLES, prediccion_base

log = logging.getLogger("ml-service")
RUTA_MODELO = Path(os.getenv("ML_MODELO", Path(__file__).resolve().parent.parent / "models" / "modelo.joblib"))


# ------------------------------------------------------------------ contrato

class Caracteristicas(BaseModel):
    """Las 10 variables del modelo. Los rangos rechazan datos absurdos con 422."""
    tipo_vehiculo: Literal["MOTO", "CARRO"]
    tipo_ultimo_mant: Literal["PREVENTIVO", "CORRECTIVO"]
    km_desde_ult_mant: float = Field(ge=0, le=200_000)
    dias_desde_ult_mant: float = Field(ge=0, le=5_000)
    horas_mov_desde_mant: float = Field(ge=0, le=20_000)
    num_mant_previos: float = Field(ge=0, le=1_000)
    km_diarios_prom_30d: float = Field(ge=0, le=2_000)
    vel_prom_mov_30d: float = Field(ge=0, le=250)
    paradas_por_100km: float = Field(ge=0, le=5_000)
    dist_media_recorrido_km: float = Field(ge=0, le=2_000)


class Prediccion(BaseModel):
    km_restantes: float
    nivel: Literal["BAJO", "MEDIO", "ALTO"]
    error_tipico_km: float | None
    km_restantes_fabricante: float
    umbral_alerta_km: float
    modelo: str
    datos_entrenamiento: str


# -------------------------------------------------------------------- estado

@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    if not os.getenv("ML_API_KEY"):
        raise RuntimeError("Falta ML_API_KEY: el servicio no arranca sin clave.")
    if not RUTA_MODELO.exists():
        raise RuntimeError(f"No existe {RUTA_MODELO}. Entrena primero: python -m app.entrenar")
    app.state.paquete = joblib.load(RUTA_MODELO)
    log.info("Modelo %s cargado (datos: %s)", app.state.paquete["nombre"], app.state.paquete.get("datos"))
    yield


app = FastAPI(title="ROMP GPS - ml-service", version="1.0", lifespan=ciclo_de_vida,
              docs_url=None, redoc_url=None, openapi_url=None)


def exigir_clave(x_api_key: str | None = Header(default=None)):
    esperada = os.getenv("ML_API_KEY", "")
    # compare_digest evita filtrar la clave por diferencias de tiempo de respuesta
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), esperada.encode()):
        raise HTTPException(status_code=401, detail="Clave de API inválida")


# --------------------------------------------------------------------- rutas

@app.get("/salud")
def salud():
    """Sin clave: solo indica que el proceso vive. No revela nada del modelo."""
    return {"estado": "ok"}


@app.post("/predecir", response_model=Prediccion, dependencies=[Depends(exigir_clave)])
def predecir(c: Caracteristicas):
    p = app.state.paquete
    fila = pd.DataFrame([c.model_dump()])[VARIABLES]
    km = max(0.0, float(p["modelo"].predict(fila)[0]))
    umbral = float(p["umbral_alerta_km"])

    # ALTO: dentro del umbral calibrado (recall >= 85 % en validación).
    # MEDIO: hasta el doble del umbral. Es una decisión de diseño, NO está calibrada.
    nivel = "ALTO" if km <= umbral else "MEDIO" if km <= 2 * umbral else "BAJO"

    return Prediccion(
        km_restantes=round(km, 1),
        nivel=nivel,
        error_tipico_km=p.get("error_tipico_km"),
        km_restantes_fabricante=float(prediccion_base([c.tipo_vehiculo], [c.km_desde_ult_mant])[0]),
        umbral_alerta_km=round(umbral, 1),
        modelo=p["nombre"],
        datos_entrenamiento=p.get("datos", "DESCONOCIDO"),
    )
