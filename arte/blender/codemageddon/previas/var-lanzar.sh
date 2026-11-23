#!/bin/zsh
cd "${0:A:h}/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
r(){ d=previas/var/$1; shift; [[ -f $d/muestra.jpg ]] || $B -b --factory-startup --python variantes.py -- --salida $d --previa "$@" >/dev/null 2>&1; echo "$d $([[ -f $d/muestra.jpg ]] && echo OK || echo FALLO)"; }
L=(-1 -1.75 -2.5)
for i in 1 2 3; do for m in 3 4 5; do r h1_${i}_$m --luz $L[$i] --rojo_mm $m; done; done
E=(0.6 1 1.6)
for i in 1 2 3; do for j in 1 2 3; do r h2_${i}_$j --luz $L[$i] --rojo_mm 4 --emision $E[$j]; done; done
G=(bajo medio alto); C=(suave medio marcado)
for i in 1 2 3; do for j in 1 2 3; do r h3_${i}_$j --luz -1.75 --rojo_mm 4 --galv $G[$i] --cepillado $C[$j]; done; done
echo TERMINADO
