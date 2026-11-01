
---

## Fases 3 a 5: API, backend y pantalla

### 1. Clave compartida (una sola vez)
Genera una clave y ponla **igual** en los dos `.env` (no se suben al repo):

    python -c "import secrets; print(secrets.token_urlsafe(32))"

- `ml-service/.env`  ->  `ML_API_KEY=<la clave>`
- `BackEnd/.env`     ->  `ML_API_KEY=<la clave>` y, si no usas el puerto 8000, `ML_SERVICE_URL=http://localhost:8000`

### 2. Levantar el ml-service
    cd ml-service
    pip install -r requirements.txt
    python -m pytest -q            # 15 pruebas
    python -m app.entrenar         # genera models/modelo.joblib (~2 min)
    # PowerShell: carga la clave y arranca
    $env:ML_API_KEY = "<la clave>"
    uvicorn app.api:app --host 127.0.0.1 --port 8000

Comprobación: `curl http://127.0.0.1:8000/salud` devuelve `{"estado":"ok"}`.
Sin `ML_API_KEY` el servicio **no arranca** (a propósito).

### 3. Backend
    cd BackEnd
    .\mvnw.cmd -q compile
    .\mvnw.cmd -q test -Dtest=AcumuladorCicloTest

Al arrancar, el backend crea el índice `(imei, registrado_en)` en `gps_data`.
Endpoints nuevos (propietario del vehículo o ADMIN):
- `GET /vehiculo/{id}/prediccion-mantenimiento`
- `GET|POST /vehiculo/{id}/mantenimientos`, `DELETE /vehiculo/{id}/mantenimientos/{idMant}`

### 4. Frontend
    cd FrontEnd
    npm run lint
    npm run dev

Verás una píldora de estado en cada tarjeta de "Mis vehículos" y un botón de llave inglesa en cada fila de Unidades (admin).

### Qué esperar
- Sin ningún mantenimiento registrado: "Registrar mantenimiento".
- Con mantenimiento pero menos de 5 km de recorrido GPS desde entonces: "Sin datos GPS".
- Con datos: "≈ X km", con nivel y la advertencia de que el modelo se entrenó con datos **simulados**.
- Si el ml-service está apagado: "Predicción no disponible"; el resto de la plataforma sigue funcionando.
