#!/bin/bash
# Regenera todos los atlas de artillería y la escena de prueba. Tarda cerca de una hora y media en 4 núcleos, sin GPU.
#   arte/blender/vfx/generar_artilleria.sh <carpeta de trabajo> [calidad]
# Deja los atlas en <carpeta>/atlas y la escena en <carpeta>/escena. Requiere `blender` (5.2 LTS) y `ffmpeg`.
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
T="${1:?falta la carpeta de trabajo}"
Q="${2:-media}"
mkdir -p "$T/atlas"
B="blender -b --factory-startup --python"

sim() {  # variante poder nombre semilla
  $B "$AQUI/explosion.py" -- --variante "$1" --poder "$2" --semilla "$4" --salida "$T/sim_$3" --calidad "$Q" > "$T/sim_$3.log" 2>&1
  grep '^\[explosion\]' "$T/sim_$3.log" | tr '\n' ' '; echo "← $3"
}
atlas() {  # nombre [opciones de empaquetar.py]
  n="$1"; shift
  $B "$AQUI/empaquetar.py" -- --entrada "$T/sim_$n" --destino "$T/atlas" --nombre "$n" --previa "$@" >> "$T/sim_$n.log" 2>&1
}

for s in 1 2 3 4; do sim bocanada 2 boc$s $s; done
$B "$AQUI/empaquetar.py" -- --entrada "$T/sim_boc1,$T/sim_boc2,$T/sim_boc3,$T/sim_boc4" --destino "$T/atlas" --nombre bocanada --desvanecer 5 > "$T/bocanada.log" 2>&1

for p in 1 2 3; do
  sim aerea $p aerea_p$p 1;   atlas aerea_p$p
  sim tierra $p tierra_p$p 1; atlas tierra_p$p
done
sim incendio 2 incendio_p2 1; atlas incendio_p2
sim fuego 2 fuego_p2 1;       atlas fuego_p2
sim polvo 2 polvo_p2 1;       atlas polvo_p2

$B "$AQUI/artilleria.py" -- --atlas "$T/atlas" --salida "$T/escena" | grep '^\[artilleria\]' | tail -1
