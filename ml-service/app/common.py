"""
Definiciones compartidas del modelo de mantenimiento predictivo.

Todo lo que el simulador, el entrenamiento y (más adelante) la API deben
entender igual vive aquí, para que no se desincronicen: los nombres de las
variables, el umbral de cada nivel y el intervalo de referencia del fabricante.
"""
import os

import numpy as np

# --------------------------------------------------------------- variables

# Lo que el modelo predice: kilómetros que le faltan al vehículo para su
# próximo mantenimiento.
OBJETIVO = "km_restantes_mantenimiento"

# Lo que el modelo recibe. Todas salen de datos que la plataforma ya tiene o
# tendrá: posiciones GPS (Mongo, colección gps_data), el vehículo (Postgres,
# tabla Vehiculos) y el registro de mantenimientos (tabla mantenimientos).
VARIABLES_NUMERICAS = [
    "km_desde_ult_mant",        # km recorridos (GPS) desde el último mantenimiento
    "dias_desde_ult_mant",      # días transcurridos desde el último mantenimiento
    "horas_mov_desde_mant",     # horas con el vehículo en movimiento desde entonces
    "num_mant_previos",         # mantenimientos registrados del vehículo (>= 1)
    "km_diarios_prom_30d",      # km/día promedio en los últimos 30 días
    "vel_prom_mov_30d",         # km/h promedio estando en movimiento, últimos 30 días
    "paradas_por_100km",        # paradas por cada 100 km (arranque y parada)
    "dist_media_recorrido_km",  # longitud media de un recorrido
]
VARIABLES_CATEGORICAS = [
    "tipo_vehiculo",            # MOTO o CARRO (Vehiculo.tipo)
    "tipo_ultimo_mant",         # PREVENTIVO o CORRECTIVO (Mantenimiento.tipo)
]
VARIABLES = VARIABLES_NUMERICAS + VARIABLES_CATEGORICAS

TIPOS_VEHICULO = ["MOTO", "CARRO"]
TIPOS_MANTENIMIENTO = ["PREVENTIVO", "CORRECTIVO"]

# ----------------------------------------------------------------- niveles

# Cuántos km le quedan decide el nivel de urgencia de la alerta.
UMBRAL_ALTO_KM = 150     # <= 150 km  -> ALTO
UMBRAL_MEDIO_KM = 400    # 151-400 km -> MEDIO, más de 400 -> BAJO


def nivel(km_restantes):
    """Nivel de urgencia (BAJO, MEDIO o ALTO) para uno o varios valores de km."""
    km = np.asarray(km_restantes, dtype=float)
    resultado = np.where(km <= UMBRAL_ALTO_KM, "ALTO",
                        np.where(km <= UMBRAL_MEDIO_KM, "MEDIO", "BAJO"))
    return resultado if resultado.ndim else str(resultado)


# --------------------------------------------------- intervalo del fabricante

# ATENCIÓN: ESTOS VALORES SON DE EJEMPLO, NO DEL MANUAL DE TUS VEHÍCULOS.
# Cámbialos por el intervalo de mantenimiento que indica el fabricante, o
# define las variables de entorno INTERVALO_MOTO_KM e INTERVALO_CARRO_KM.
# Son la línea base del proyecto: el modelo se mide contra "intervalo menos
# los km recorridos", así que un valor equivocado cambia la comparación.
INTERVALO_FABRICANTE_KM = {
    "MOTO": float(os.getenv("INTERVALO_MOTO_KM", 3000)),
    "CARRO": float(os.getenv("INTERVALO_CARRO_KM", 5000)),
}


def prediccion_base(tipo_vehiculo, km_desde_ult_mant):
    """
    Línea base: lo que dice el calendario fijo del fabricante.

    Se recorta en 0: un vehículo que ya pasó el intervalo tiene 0 km restantes,
    no una cantidad negativa.
    """
    intervalo = np.array([INTERVALO_FABRICANTE_KM[t] for t in tipo_vehiculo])
    return np.clip(intervalo - np.asarray(km_desde_ult_mant, dtype=float), 0, None)
