#!/usr/bin/env bash
# Pide a Codex CLI una revisión de lo que la rama actual añade sobre una base, sin modificar código.
# Uso: harness/scripts/pedir-revision.sh [base=main]
# Opcional: MODELO=<id> para elegir el modelo; NOTA="texto" para añadir contexto al revisor.
# Requiere: Codex CLI con sesión iniciada en esta máquina.
set -euo pipefail

BASE="${1:-main}"
RAIZ="$(git rev-parse --show-toplevel)"
cd "$RAIZ"
command -v codex >/dev/null || { echo "No se encontró Codex CLI (codex) en esta máquina." >&2; exit 2; }

# Preferir la rama remota si existe: la local puede estar atrasada.
if git rev-parse --verify -q "origin/$BASE" >/dev/null; then BASE_REF="origin/$BASE"; else BASE_REF="$BASE"; fi
git rev-parse --verify -q "$BASE_REF" >/dev/null || { echo "No existe la rama base '$BASE'." >&2; exit 2; }

RAMA="$(git rev-parse --abbrev-ref HEAD)"
HEAD_CORTO="$(git rev-parse --short HEAD)"
MB="$(git merge-base "$BASE_REF" HEAD)"
RANGO="$(git rev-parse --short "$MB")..$HEAD_CORTO"
if [ -z "$(git diff --name-only "$MB" HEAD)" ]; then echo "No hay cambios entre $BASE_REF y HEAD." >&2; exit 1; fi
[ -n "$(git status --porcelain --untracked-files=no)" ] && echo "Aviso: hay cambios sin commit; la revisión solo cubre lo commiteado ($RANGO)." >&2

mkdir -p docs/revisiones
SALIDA="docs/revisiones/$(date +%F)-${RAMA//\//-}-$HEAD_CORTO.md"

PROMPT="$(cat harness/revision/instrucciones.md)

---
Rama: $RAMA · Base: $BASE_REF · Rango a revisar: $RANGO
Archivos cambiados:
$(git diff --stat "$MB" HEAD | tail -n 40)

Obtén el diff con: git diff $MB HEAD
${NOTA:+Nota del usuario: $NOTA}"

ARGS=(exec --sandbox read-only --ephemeral --disable memories -C "$RAIZ" -o "$SALIDA")
[ -n "${MODELO:-}" ] && ARGS+=(-m "$MODELO")

echo "Revisando $RANGO con Codex (solo lectura)…"
codex "${ARGS[@]}" "$PROMPT" </dev/null >/dev/null

# Cabecera reproducible encima de la respuesta.
{ printf '<!-- revisor: codex %s · modelo: %s · base: %s · rango: %s · %s -->\n\n' \
    "$(codex --version 2>/dev/null | awk '{print $NF}')" "${MODELO:-por defecto}" "$BASE_REF" "$RANGO" "$(date '+%F %H:%M')"
  cat "$SALIDA"; } > "$SALIDA.tmp" && mv "$SALIDA.tmp" "$SALIDA"

echo "Revisión guardada en $SALIDA"
