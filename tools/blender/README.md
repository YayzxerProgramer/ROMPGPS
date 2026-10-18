# Modelo 3D del GPS de ROMP GPS

El rastreador GNXIS de la landing se genera **por código** con Blender en modo
headless (`bpy`): no hay archivos `.blend` ni pasos manuales. El script
construye la geometría, la valida, exporta el `.glb` y renderiza su póster.

| Script          | Modelo           | Salida (`FrontEnd/public/models/`)           |
| --------------- | ---------------- | -------------------------------------------- |
| `gps_device.py` | Rastreador GNXIS | `gps-device.glb`, `previews/gps-device.webp` |

- `comun.py`: primitivas (cajas biseladas, torno, tubos, textos), materiales
  PBR, validación, exportación y póster.
- `superficies.py`: superficies por anillos, booleanas y calcomanías.
- `texturas.py`: textura procedural del grano del molde.
- `comparar_gps.py`: compara el modelo con la foto del equipo real
  (`FrontEnd/img-blender/gps real.jpg`, cara del logo y cara de la etiqueta).

## Requisitos

- Blender 4.2 o superior (probado con **5.2.2 LTS**):
  `winget install BlenderFoundation.Blender`, o el zip portable descomprimido en
  `%LOCALAPPDATA%\Programs\Blender` (`build.ps1` lo encuentra ahí solo).
- Node 18+ (para `npx @gltf-transform/cli`; no se instala en el proyecto).

## Regenerar (Windows, PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File tools\blender\build.ps1
# Blender en otra ruta, o sin renderizar el póster (iterar la geometría más rápido)
powershell -ExecutionPolicy Bypass -File tools\blender\build.ps1 -Blender "D:\Blender\blender.exe" -SinRender
```

El script hace:

1. `blender --background --factory-startup --python-exit-code 1 --python gps_device.py -- --salida tools\blender\build`
   → GLB crudo en `tools/blender/build/` (ignorado por git) y póster `.webp`.
2. `npx --yes @gltf-transform/cli@4.5.1 optimize <crudo> <final> --compress meshopt --meshopt-level high --flatten false --join false --instance false --palette false --simplify false --texture-compress false`
   → GLB final en `FrontEnd/public/models/`.

`--flatten/--join/--palette false` mantienen los nodos `carcasa` e `impresos`
y sus materiales tal como salen de Blender.

## Comparar con la foto

```powershell
blender --background --factory-startup --python tools/blender/comparar_gps.py
```

Renderiza el equipo tumbado desde los dos ángulos de la foto, a la misma escala
en píxeles, y escribe foto / render / superposición en
`tools/blender/build/calibracion/gps-logo.png` y `gps-etiqueta.png`.

## Qué se valida en cada build

El script termina con error (y `build.ps1` se detiene) si:

- supera el presupuesto de **45.000 triángulos** (hoy: 11.652);
- algún cascarón cerrado tiene las normales invertidas (volumen con signo negativo);
- el modelo no apoya en el suelo (z mínima ≠ 0);
- una calcomanía (logo o etiqueta) se sale de la pieza sobre la que se proyecta.

## Convenciones

- Metros y escala real. Origen en la base (suelo z = 0).
- Blender Z arriba con el frente a -Y; el exportador lo convierte a **Y arriba
  y frente a +Z** en glTF.
- Materiales PBR (metallic/roughness, clearcoat en el plástico pulido) con el
  grano de molde procedural y calcomanías. Las texturas van en WebP
  (`EXT_texture_webp`) porque el GPS se precarga en la landing.
- Nodos: `gps_gnxis` > `carcasa`, `impresos` (logo y etiqueta).
- El póster usa la misma cámara (campo de visión 30°, azimut/elevación y
  encuadre por vértices) que `ModelViewer.jsx`, para que el paso póster → 3D
  no salte.

## Problemas conocidos

- **Blender portable en una ruta muy larga** (más de ~120 caracteres): Python
  no puede abrir los módulos del exportador glTF por el límite de 260 caracteres
  de Windows (`ImportError: cannot import name 'pbr_metallic_roughness'`).
  Instálalo en su ruta estándar o mapea la carpeta a una unidad corta:
  `subst B: "C:\ruta\larga\blender"` y usa `-Blender B:\blender-5.2.2-windows-x64\blender.exe`.
- **Blender portable dentro de `%TEMP%`**: la limpieza automática de Windows
  borra archivos del zip (conservan su fecha original, parecen viejos) y Python
  deja de arrancar (`init_fs_encoding: failed to get the Python codec`).
  Descomprímelo en `%LOCALAPPDATA%\Programs\Blender`: ruta corta y fuera de Temp.
