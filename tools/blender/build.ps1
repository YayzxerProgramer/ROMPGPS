<#
.SYNOPSIS
  Regenera el modelo 3D del GPS de ROMP GPS: Blender headless -> GLB -> gltf-transform (meshopt).

.DESCRIPTION
  1. Ejecuta el script de modelado con Blender en modo background. El script
     valida presupuesto de triangulos, normales y apoyo en el suelo, exporta el
     GLB crudo a tools/blender/build/ y renderiza el poster .webp en
     FrontEnd/public/models/previews/.
  2. Comprime el GLB con gltf-transform (EXT_meshopt_compression +
     cuantizacion) a FrontEnd/public/models/, sin aplanar la escena ni unir
     mallas para conservar sus nodos (carcasa, impresos).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\blender\build.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\blender\build.ps1 -Blender "D:\Blender\blender.exe" -SinRender
#>
param(
    # Ruta a blender.exe. Si se omite: variable BLENDER, PATH o instalacion estandar.
    [string]$Blender = $env:BLENDER,
    [ValidateSet('gps_device')]
    [string[]]$Modelos = @('gps_device'),
    # No renderiza los posters (mas rapido mientras se itera la geometria).
    [switch]$SinRender
)

$ErrorActionPreference = 'Stop'
$Herramientas = $PSScriptRoot
$Raiz = (Resolve-Path (Join-Path $Herramientas '..\..')).Path
$Build = Join-Path $Herramientas 'build'
$Destino = Join-Path $Raiz 'FrontEnd\public\models'
# Version fija: misma salida en cualquier maquina, sin anadir dependencias
# nativas (sharp) al npm ci del frontend.
$GltfTransform = '@gltf-transform/cli@4.5.1'

function Buscar-Blender {
    if ($Blender) {
        if (Test-Path $Blender) { return (Resolve-Path $Blender).Path }
        throw "No existe Blender en '$Blender'."
    }
    $enPath = Get-Command blender -ErrorAction SilentlyContinue
    if ($enPath) { return $enPath.Source }
    # Instalacion normal o zip portable en la carpeta de programas del usuario.
    $instalados = Get-ChildItem 'C:\Program Files\Blender Foundation\*\blender.exe',
        (Join-Path $env:LOCALAPPDATA 'Programs\Blender\*\blender.exe') -ErrorAction SilentlyContinue |
        Sort-Object { [version](($_.Directory.Name -replace '[^0-9.]', '') + '.0') } -Descending
    if ($instalados) { return $instalados[0].FullName }
    throw "No se encontro Blender. Instalalo (winget install BlenderFoundation.Blender) o pasa -Blender <ruta\blender.exe>."
}

$exe = Buscar-Blender
Write-Host "Blender: $exe"
New-Item -ItemType Directory -Force $Build, $Destino | Out-Null

foreach ($modelo in $Modelos) {
    $nombre = $modelo -replace '_', '-'
    $script = Join-Path $Herramientas "$modelo.py"
    Write-Host ""
    Write-Host "== $nombre ==" -ForegroundColor Green

    $extra = @('--salida', $Build)
    if ($SinRender) { $extra += '--sin-render' }
    # --python-exit-code 1: una excepcion de Python debe detener el build.
    & $exe --background --factory-startup --python-exit-code 1 --python $script -- @extra
    if ($LASTEXITCODE -ne 0) { throw "Blender fallo en $modelo (codigo $LASTEXITCODE)." }

    $crudo = Join-Path $Build "$nombre.glb"
    $final = Join-Path $Destino "$nombre.glb"
    & npx --yes $GltfTransform optimize $crudo $final `
        --compress meshopt --meshopt-level high `
        --flatten false --join false --instance false --palette false `
        --simplify false --texture-compress false
    if ($LASTEXITCODE -ne 0) { throw "gltf-transform fallo en $nombre." }
}

Write-Host ""
Write-Host "Modelos en $Destino" -ForegroundColor Green
Get-ChildItem $Destino -Filter *.glb | ForEach-Object {
    $crudo = Join-Path $Build $_.Name
    $antes = if (Test-Path $crudo) { '{0,7:N1} KB ->' -f ((Get-Item $crudo).Length / 1KB) } else { '' }
    Write-Host ('  {0,-22} {1} {2,7:N1} KB' -f $_.Name, $antes, ($_.Length / 1KB))
}
