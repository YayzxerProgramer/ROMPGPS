"""
Entrenamiento y comparación de modelos de mantenimiento predictivo.

Uso (desde la carpeta ml-service):

    python -m app.entrenar
    python -m app.entrenar --reales datos/ciclos_reales.csv

Qué hace, en orden:
  1. Genera datos simulados (app/simulador.py) y los guarda en datos/simulado.csv.
  2. Parte los datos POR VEHÍCULO: 70 % entrenamiento, 15 % validación, 15 % prueba.
     Se parte por vehículo y no por fila porque las fotos de un mismo vehículo
     se parecen mucho entre sí: mezclarlas haría que el modelo "viera" en
     entrenamiento a los vehículos de la prueba y las métricas saldrían infladas.
  3. Entrena Ridge, Random Forest y Gradient Boosting (los dos con ajuste de
     hiperparámetros por validación cruzada agrupada) y los compara con la línea
     base del fabricante.
  4. Elige el de menor error en validación y lo mide UNA vez en prueba.
  5. Guarda el modelo en models/modelo.joblib y las métricas en models/metricas.json.
  6. Si se pasa --reales, mide aparte el modelo con ciclos reales.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, GroupKFold, GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .common import (OBJETIVO, UMBRAL_ALTO_KM, VARIABLES, VARIABLES_CATEGORICAS,
                     VARIABLES_NUMERICAS, prediccion_base)
from .simulador import simular

RAIZ = Path(__file__).resolve().parent.parent
SEMILLA = 42

# Criterios de éxito definidos en la propuesta del modelo.
META_REDUCCION_MAE = 20.0   # % mínimo de reducción del MAE frente a la línea base
META_RECALL_ALTO = 85.0     # % mínimo de casos ALTO detectados


# ------------------------------------------------------------------ partición

def dividir_por_vehiculo(df, semilla=SEMILLA):
    """Devuelve índices (entrenamiento, validación, prueba) sin vehículos repetidos entre grupos."""
    grupos = df["id_vehiculo"].to_numpy()
    resto, prueba = next(GroupShuffleSplit(1, test_size=0.15, random_state=semilla)
                         .split(df, groups=grupos))
    # 0.15 / 0.85 del resto deja la validación en el 15 % del total.
    entr, valid = next(GroupShuffleSplit(1, test_size=0.15 / 0.85, random_state=semilla)
                       .split(df.iloc[resto], groups=grupos[resto]))
    return resto[entr], resto[valid], prueba


# ------------------------------------------------------------------- métricas

def metricas(y_real, y_pred, umbral_alerta=UMBRAL_ALTO_KM):
    """
    MAE, RMSE, R2 y recall/precisión del nivel ALTO.

    Un caso es ALTO de verdad si le quedan <= UMBRAL_ALTO_KM km. El modelo lo
    marca como ALTO si predice <= umbral_alerta, que puede ser mayor (ver
    calibrar_umbral_alerta).
    """
    y_real = np.asarray(y_real, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    real_alto = y_real <= UMBRAL_ALTO_KM
    pred_alto = y_pred <= umbral_alerta
    verdaderos = int(np.sum(real_alto & pred_alto))
    recall = 100.0 * verdaderos / max(1, int(real_alto.sum()))
    precision = 100.0 * verdaderos / max(1, int(pred_alto.sum()))
    return {
        "MAE_km": float(mean_absolute_error(y_real, y_pred)),
        "RMSE_km": float(np.sqrt(mean_squared_error(y_real, y_pred))),
        "R2": float(r2_score(y_real, y_pred)),
        "recall_alto_pct": float(recall),
        "precision_alto_pct": float(precision),
        "casos_alto": int(real_alto.sum()),
        "filas": int(len(y_real)),
        "umbral_alerta_km": float(umbral_alerta),
    }


def calibrar_umbral_alerta(y_real, y_pred, meta=META_RECALL_ALTO):
    """
    Menor umbral T tal que marcar como ALTO todo lo que se predice <= T detecta
    al menos `meta` % de los casos ALTO reales.

    POR QUÉ HACE FALTA: el modelo se equivoca en cientos de km, y el nivel ALTO
    es una franja de solo 150 km. Con el umbral literal (150) casi todos los
    casos urgentes se predicen como "todavía le queda bastante". Para una alerta
    de mantenimiento es peor no avisar que avisar de más, así que se sube el
    umbral hasta alcanzar el recall pedido, y se acepta perder algo de precisión.
    """
    y_real = np.asarray(y_real, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    real_alto = y_real <= UMBRAL_ALTO_KM
    if not real_alto.any():
        return float(UMBRAL_ALTO_KM)
    pred_de_los_alto = np.sort(y_pred[real_alto])
    k = int(np.ceil(meta / 100.0 * len(pred_de_los_alto)))
    return float(max(pred_de_los_alto[k - 1], UMBRAL_ALTO_KM))


# -------------------------------------------------------------------- modelos

def _preprocesador(escalar):
    numericas = StandardScaler() if escalar else "passthrough"
    return ColumnTransformer([
        ("num", numericas, VARIABLES_NUMERICAS),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), VARIABLES_CATEGORICAS),
    ])


def candidatos(semilla=SEMILLA, rapido=False):
    """Los tres modelos a comparar, cada uno con su rejilla de hiperparámetros (rapido: una sola opción)."""
    modelos = {
        "Ridge": (
            Pipeline([("pre", _preprocesador(True)), ("m", Ridge())]),
            {"m__alpha": [0.1, 1.0, 10.0, 100.0]},
        ),
        "RandomForest": (
            Pipeline([("pre", _preprocesador(False)),
                      ("m", RandomForestRegressor(n_estimators=300, min_samples_leaf=3,
                                                  n_jobs=-1, random_state=semilla))]),
            {"m__max_depth": [None, 12]},
        ),
        "GradientBoosting": (
            Pipeline([("pre", _preprocesador(False)),
                      ("m", GradientBoostingRegressor(subsample=0.8, random_state=semilla))]),
            {"m__n_estimators": [200, 400],
             "m__max_depth": [2, 3],
             "m__learning_rate": [0.05, 0.1]},
        ),
    }
    if rapido:   # para pruebas automáticas: sin búsqueda, un solo valor por hiperparámetro
        modelos = {n: (p, {k: v[:1] for k, v in r.items()}) for n, (p, r) in modelos.items()}
    return modelos


def ajustar(nombre, pipeline, rejilla, X, y, grupos):
    """Ajusta hiperparámetros con validación cruzada AGRUPADA por vehículo."""
    busqueda = GridSearchCV(pipeline, rejilla, cv=GroupKFold(n_splits=5),
                            scoring="neg_mean_absolute_error", n_jobs=-1)
    busqueda.fit(X, y, groups=grupos)
    return busqueda.best_estimator_, busqueda.best_params_


def evaluar_reales(modelo, ruta, umbral_alerta=UMBRAL_ALTO_KM):
    """Mide modelo y línea base con ciclos reales. Devuelve None si no hay datos suficientes."""
    reales = pd.read_csv(ruta)
    faltan = [c for c in VARIABLES + [OBJETIVO] if c not in reales.columns]
    if faltan:
        raise SystemExit(f"Al archivo {ruta} le faltan columnas: {faltan}")
    reales = reales.dropna(subset=VARIABLES + [OBJETIVO])
    if len(reales) == 0:
        return None
    pred = np.clip(modelo.predict(reales[VARIABLES]), 0, None)
    base = prediccion_base(reales["tipo_vehiculo"], reales["km_desde_ult_mant"])
    return {"modelo": metricas(reales[OBJETIVO], pred, umbral_alerta),
            "linea_base": metricas(reales[OBJETIVO], base)}


# ----------------------------------------------------------------------- main

def _linea(nombre, m):
    return (f"  {nombre:<18} MAE {m['MAE_km']:8.1f} km   RMSE {m['RMSE_km']:8.1f} km   "
            f"R2 {m['R2']:6.3f}   recall ALTO {m['recall_alto_pct']:5.1f} %   "
            f"precision ALTO {m['precision_alto_pct']:5.1f} %")


def main():
    parser = argparse.ArgumentParser(description="Entrena y compara modelos de mantenimiento predictivo.")
    parser.add_argument("--vehiculos", type=int, default=150, help="vehiculos simulados (por defecto 150)")
    parser.add_argument("--semilla", type=int, default=SEMILLA)
    parser.add_argument("--reales", type=Path, default=None, help="CSV con ciclos reales para contrastar")
    parser.add_argument("--rapido", action="store_true", help="sin busqueda de hiperparametros (pruebas)")
    args = parser.parse_args()

    (RAIZ / "datos").mkdir(exist_ok=True)
    (RAIZ / "models").mkdir(exist_ok=True)

    # 1. Datos
    df = simular(n_vehiculos=args.vehiculos, semilla=args.semilla)
    df.to_csv(RAIZ / "datos" / "simulado.csv", index=False)
    print(f"Datos simulados: {len(df)} filas de {df['id_vehiculo'].nunique()} vehiculos "
          f"({df['id_vehiculo'].nunique() * 8} ciclos)")

    # 2. Partición por vehículo
    i_entr, i_val, i_test = dividir_por_vehiculo(df, args.semilla)
    entr, val, test = df.iloc[i_entr], df.iloc[i_val], df.iloc[i_test]
    for a, b in ((entr, val), (entr, test), (val, test)):
        assert not set(a["id_vehiculo"]) & set(b["id_vehiculo"]), "Hay vehiculos repetidos entre grupos"
    print(f"Vehiculos: entrenamiento {entr['id_vehiculo'].nunique()}, "
          f"validacion {val['id_vehiculo'].nunique()}, prueba {test['id_vehiculo'].nunique()}")

    # 3. Entrenar y comparar (selección por validación)
    ajustados, params, resultados_val = {}, {}, {}
    for nombre, (pipe, rejilla) in candidatos(args.semilla, args.rapido).items():
        print(f"Entrenando {nombre}...")
        mejor, mejores_params = ajustar(nombre, pipe, rejilla, entr[VARIABLES], entr[OBJETIVO],
                                        entr["id_vehiculo"])
        ajustados[nombre], params[nombre] = mejor, mejores_params
        resultados_val[nombre] = metricas(val[OBJETIVO], np.clip(mejor.predict(val[VARIABLES]), 0, None))

    base_val = metricas(val[OBJETIVO], prediccion_base(val["tipo_vehiculo"], val["km_desde_ult_mant"]))
    print("\nVALIDACION")
    print(_linea("Linea base", base_val))
    for nombre, m in resultados_val.items():
        print(_linea(nombre, m))

    elegido = min(resultados_val, key=lambda n: resultados_val[n]["MAE_km"])
    print(f"\nModelo elegido (menor MAE en validacion): {elegido}  {params[elegido]}")

    # 4. Umbral de alerta: se calibra en VALIDACION (nunca en prueba) para el modelo
    #    elegido y, por justicia, también para la línea base.
    modelo = ajustados[elegido]
    pred_val = np.clip(modelo.predict(val[VARIABLES]), 0, None)
    base_pred_val = prediccion_base(val["tipo_vehiculo"], val["km_desde_ult_mant"])
    umbral = calibrar_umbral_alerta(val[OBJETIVO], pred_val)
    umbral_base = calibrar_umbral_alerta(val[OBJETIVO], base_pred_val)

    # 5. Prueba: una sola vez, solo con lo ya elegido
    pred_test = np.clip(modelo.predict(test[VARIABLES]), 0, None)
    base_pred_test = prediccion_base(test["tipo_vehiculo"], test["km_desde_ult_mant"])
    res_test = metricas(test[OBJETIVO], pred_test, umbral)
    base_test = metricas(test[OBJETIVO], base_pred_test, umbral_base)
    res_test_literal = metricas(test[OBJETIVO], pred_test)   # umbral de 150 km sin calibrar
    reduccion = 100.0 * (1.0 - res_test["MAE_km"] / base_test["MAE_km"])
    print("\nPRUEBA (vehiculos que el modelo nunca vio)")
    print(f"  Alerta ALTO con umbral calibrado: modelo <= {umbral:.0f} km, linea base <= {umbral_base:.0f} km")
    print(_linea("Linea base", base_test))
    print(_linea(elegido, res_test))
    print(f"  (con el umbral literal de {UMBRAL_ALTO_KM} km el recall del modelo seria "
          f"{res_test_literal['recall_alto_pct']:.1f} %)")
    print(f"\n  Reduccion del MAE frente a la linea base: {reduccion:.1f} %  "
          f"(meta >= {META_REDUCCION_MAE:.0f} %): {'CUMPLE' if reduccion >= META_REDUCCION_MAE else 'NO CUMPLE'}")
    print(f"  Recall del nivel ALTO: {res_test['recall_alto_pct']:.1f} %  "
          f"(meta >= {META_RECALL_ALTO:.0f} %): {'CUMPLE' if res_test['recall_alto_pct'] >= META_RECALL_ALTO else 'NO CUMPLE'}"
          f"   a costa de precision {res_test['precision_alto_pct']:.1f} %")
    print("  AVISO: son datos SIMULADOS. Validan el procedimiento, no el desempeno real.")

    # 6. Importancia de cada variable (qué pesa más en las predicciones)
    imp = permutation_importance(modelo, test[VARIABLES], test[OBJETIVO], n_repeats=5,
                                 random_state=args.semilla, scoring="neg_mean_absolute_error", n_jobs=-1)
    importancias = dict(sorted(zip(VARIABLES, imp.importances_mean.round(2).tolist()),
                               key=lambda p: -p[1]))
    print("\nImportancia de variables (aumento del MAE en km al desordenarlas):")
    for nombre, valor in importancias.items():
        print(f"  {nombre:<26} {valor:8.1f}")

    # 7. Modelo final: se reajusta con TODOS los datos antes de guardarlo
    final = clone(modelo).fit(df[VARIABLES], df[OBJETIVO])
    informe = {
        "modelo": elegido,
        "hiperparametros": {k: (None if v is None else v) for k, v in params[elegido].items()},
        "entrenado_en": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "datos": "SIMULADOS",
        "validacion": {"linea_base": base_val, **resultados_val},
        "umbral_alerta_km": umbral,
        "prueba": {"linea_base": base_test, elegido: res_test,
                   "modelo_con_umbral_literal": res_test_literal,
                   "reduccion_mae_pct": round(reduccion, 2)},
        "importancia_variables": importancias,
    }

    # 8. Ciclos reales, si los hay
    if args.reales:
        reales = evaluar_reales(modelo, args.reales, umbral)
        if reales is None:
            print(f"\n{args.reales} no tiene filas completas todavia.")
        else:
            informe["ciclos_reales"] = reales
            print(f"\nCICLOS REALES ({reales['modelo']['filas']} filas) - reportar aparte")
            print(_linea("Linea base", reales["linea_base"]))
            print(_linea(elegido, reales["modelo"]))

    joblib.dump({"modelo": final, "variables": VARIABLES, "nombre": elegido,
                 "umbral_alerta_km": umbral, "error_tipico_km": float(res_test["MAE_km"]),
                 "entrenado_en": informe["entrenado_en"], "datos": "SIMULADOS"},
                RAIZ / "models" / "modelo.joblib")
    (RAIZ / "models" / "metricas.json").write_text(
        json.dumps(informe, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nGuardado: models/modelo.joblib y models/metricas.json")


if __name__ == "__main__":
    main()
