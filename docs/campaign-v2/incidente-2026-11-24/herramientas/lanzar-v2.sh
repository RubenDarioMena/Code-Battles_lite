#!/bin/zsh
# Lanza una porción de Campaign-V2 con Astra. codex-astra es la cuenta primaria.
# codex (normal) solo entra si codex-astra se queda sin cuota, nunca a la vez, y se corta
# cuando su uso (ventana de 5 h o semanal) llega al TOPE (75 % usado = queda ~25 %).
# uso: lanzar-v2.sh <porcion> <prompt> <esfuerzo>
set -u
P=$1; B=$2; E=$3; TOPE=${TOPE:-75}
WT=/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2
cd $WT || exit 1
mkdir -p .astra
rm -f .astra/$P.fin .astra/$P.tope
log() { echo "[$(date +%H:%M)] $*" | tee -a .astra/$P.log; }
correr() { # $1 = comando, $2 = archivo con el prompt
  rm -f .astra/$P-ultimo.txt
  cat "$2" | $1 exec -m gpt-6.2-astra -c model_reasoning_effort=$E \
    --disable default_mode_request_user_input -s workspace-write -C $WT \
    -o .astra/$P-ultimo.txt - 2>&1 | tee -a .astra/$P.log
}
sin_cuota() { [ ! -s .astra/$P-ultimo.txt ] && tail -5 .astra/$P.log | grep -q "usage limit"; }
uso() { # mayor used_percent (5 h o semanal) de la última sesión de esa cuenta
  local f=$(ls -t $1/sessions/*/*/*/*.jsonl 2>/dev/null | head -1)
  [ -z "$f" ] && { echo 0; return; }
  grep -o '"used_percent":[0-9.]*' "$f" | tail -2 | cut -d: -f2 | sort -n | tail -1 | cut -d. -f1
}
vigilar() { # corta la cuenta normal al llegar al tope
  while sleep 60; do
    local u=$(uso ~/.codex)
    if [ "${u:-0}" -ge $TOPE ]; then
      log "codex normal al ${u}% usado: corto la sesión (tope $TOPE%)"
      touch .astra/$P.tope; pkill -f "codex exec -m gpt-6.2-astra"; return
    fi
  done
}

log "$P con codex-astra (primaria), esfuerzo $E"
correr codex-astra "$B"
if sin_cuota; then
  u=$(uso ~/.codex)
  if [ "${u:-0}" -ge $TOPE ]; then
    log "codex-astra sin cuota y codex normal ya al ${u}%: paro aquí"
  else
    CONT=.astra/$P-continuar2.md
    { echo "> Una sesión anterior empezó esta porción y se cortó por cuota. Su trabajo está en el árbol:"
      echo "> \`git status\` y \`git diff\` respecto al índice muestran solo lo suyo. Revísalo, continúa desde ahí y no rehagas lo hecho."
      echo; cat "$B"; } > $CONT
    log "codex-astra sin cuota; sigue codex normal (al ${u}%, tope $TOPE%)"
    vigilar & V=$!
    correr codex $CONT
    kill $V 2>/dev/null
  fi
fi
date > .astra/$P.fin
