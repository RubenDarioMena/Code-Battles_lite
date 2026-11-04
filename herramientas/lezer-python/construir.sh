#!/bin/sh
# Regenera el paquete local de lezer para Python. Se ejecuta a mano al actualizar versiones;
# jugar y probar no lo necesitan. Requiere Node y acceso al registro de npm.
#   sh herramientas/lezer-python/construir.sh
# Después: revisar el diff, actualizar los SHA-256 de shared/vendor/manifest.json y la tabla de
# shared/vendor/README.md, y ejecutar node pruebas/editor-lenguajes.cjs.
set -eu
aqui=$(cd "$(dirname "$0")" && pwd)
raiz=$(cd "$aqui/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp "$aqui/package.json" "$aqui/entrada.mjs" "$tmp/"
[ -f "$aqui/package-lock.json" ] && cp "$aqui/package-lock.json" "$tmp/"
cd "$tmp"
if [ -f package-lock.json ]; then npm ci --ignore-scripts --no-audit --no-fund; else npm install --ignore-scripts --no-audit --no-fund; cp package-lock.json "$aqui/"; fi
npx --no-install esbuild entrada.mjs --bundle --format=iife --global-name=LezerPython --minify --legal-comments=none \
  --banner:js="/* @lezer/python 1.1.19 · @lezer/lr 1.4.11 · @lezer/common 1.5.4 · @lezer/highlight 1.2.5 · MIT (ver LICENSE-lezer). Generado por herramientas/lezer-python/construir.sh */" \
  --outfile="$raiz/shared/vendor/lezer-python-1.1.19.js"
cp node_modules/@lezer/python/LICENSE "$raiz/shared/vendor/LICENSE-lezer"
