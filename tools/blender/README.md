# Modelos 3D de ROMP GPS

Los cuatro modelos del frontend se generan **por código** con Blender en modo
headless (`bpy`): no hay archivos `.blend` ni pasos manuales. Cada script
construye la geometría, la valida, exporta el `.glb` y renderiza su póster.

| Script              | Modelo                  | Salida (`FrontEnd/public/models/`)        |
| ------------------- | ----------------------- | ----------------------------------------- |
| `gps_device.py`     | Rastreador GNXIS        | `gps-device.glb`, `previews/gps-device.webp` |
| `boxer_ct100.py`    | Bajaj Boxer CT 100      | `boxer-ct100.glb`, `previews/boxer-ct100.webp` |
| `tvs_raider_125.py` | TVS Raider 125          | `tvs-raider-125.glb`, `previews/tvs-raider-125.webp` |
| `pulsar_200.py`     | Bajaj Pulsar NS 200     | `pulsar-200.glb`, `previews/pulsar-200.webp` |

`comun.py` reúne primitivas (cajas biseladas, torno, barridos, tubos, prismas,
calcomanías proyectadas), materiales PBR, validación, exportación y póster.
`piezas_moto.py` reúne lo que comparten las motos (ruedas, frenos, horquilla,
manubrio, espejos, amortiguadores, cadena). Las referencias visuales están en
`FrontEnd/img-blender/`.

## Requisitos

- Blender 4.2 o superior (probado con **5.2.2 LTS**):
  `winget install BlenderFoundation.Blender`
- Node 18+ (para `npx @gltf-transform/cli`; no se instala en el proyecto).

## Regenerar todo (Windows, PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File tools\blender\build.ps1
```

Opciones:

```powershell
# Blender fuera del PATH o de "C:\Program Files\Blender Foundation"
powershell -ExecutionPolicy Bypass -File tools\blender\build.ps1 -Blender "D:\Blender\blender.exe"
# Solo algunos modelos, sin renderizar pósters (iterar geometría más rápido)
powershell -ExecutionPolicy Bypass -File tools\blender\build.ps1 -Modelos boxer_ct100,pulsar_200 -SinRender
```

El script hace, por cada modelo:

1. `blender --background --factory-startup --python-exit-code 1 --python <script>.py -- --salida tools\blender\build`
   → GLB crudo en `tools/blender/build/` (ignorado por git) y póster `.webp`.
2. `npx --yes @gltf-transform/cli@4.5.1 optimize <crudo> <final> --compress meshopt --meshopt-level high --flatten false --join false --instance false --palette false --simplify false --texture-compress false`
   → GLB final en `FrontEnd/public/models/`.

`--flatten/--join/--palette false` no son opcionales: los valores por defecto
aplanan la escena, unen mallas y fusionan materiales, y se perderían los nodos
animables (`rueda_delantera`, `led_estado`…) y el material propio del LED.

## Un solo modelo, sin el orquestador

```powershell
blender --background --factory-startup --python-exit-code 1 --python tools/blender/boxer_ct100.py
# Revisar el modelo desde otro ángulo (escribe tools/blender/build/boxer-ct100-az-130.webp):
blender --background --factory-startup --python tools/blender/boxer_ct100.py -- --azimut -130
```

## Qué se valida en cada build

El script termina con error (y `build.ps1` se detiene) si:

- supera el presupuesto: **≤ 40.000 triángulos** por moto y **≤ 10.000** el GPS;
- algún cascarón cerrado tiene las normales invertidas (volumen con signo negativo);
- el modelo no apoya en el suelo (z mínima ≠ 0);
- una calcomanía (texto o franja) se sale de la pieza sobre la que se proyecta.

Resultado actual: GPS 7.176 tris · Boxer 27.888 · Raider 24.264 · Pulsar 27.374.

## Convenciones

- Metros y escala real. Origen en la base (suelo z = 0).
- Blender Z arriba con el frente a -Y; el exportador lo convierte a **Y arriba
  y frente a +Z** en glTF. El escape (lado derecho del piloto) queda en -X.
- Sin texturas: materiales PBR por factores (metallic/roughness, clearcoat en
  pinturas lacadas, emisivos en faros, pilotos y LED).
- Las piezas animables son un Empty con nombre y su malla hija `<nombre>_malla`:
  la cuantización de meshopt reescribe la transformación de las mallas, nunca la
  del pivote, así que el eje de giro de las ruedas se conserva exacto.
- Nodos de las motos: `chasis`, `motor`, `escape`, `carroceria`, `asiento`,
  `direccion`, `faro_delantero`, `luz_trasera`, `suspension_trasera`,
  `rueda_delantera`, `rueda_trasera`. GPS: `carcasa`, `led_estado`, `arnes`.
- El póster usa la misma cámara (campo de visión 30°, azimut/elevación y
  encuadre por vértices) que `ModelViewer.jsx`, para que el paso póster → 3D
  no salte.

## Problemas conocidos

- **Blender portable en una ruta muy larga** (más de ~120 caracteres): Python
  no puede abrir los módulos del exportador glTF por el límite de 260 caracteres
  de Windows (`ImportError: cannot import name 'pbr_metallic_roughness'`).
  Instálalo en su ruta estándar o mapea la carpeta a una unidad corta:
  `subst B: "C:\ruta\larga\blender"` y usa `-Blender B:\blender-5.2.2-windows-x64\blender.exe`.

## Si hace falta más fidelidad

El modelado por primitivas da un estilo low/mid-poly fiel a la silueta, no
fotorrealista. Para acercarse más a una moto concreta, la alternativa es
generar una base con una herramienta image-to-3D a partir de las fotos de
referencia y limpiarla con un script `bpy` reproducible: importar el `.glb`
generado, `Remesh`/`QuadriFlow` o `Decimate` hasta el presupuesto, recalcular
normales, separar ruedas y LED en pivotes con los mismos nombres y reasignar
materiales PBR de la paleta. El resto del pipeline (validación, gltf-transform,
pósters y componentes React) sirve igual.
