#!/bin/zsh
# Lanza UNA tarea corta de Campaign-V2 con Astra, con topes. Sin continuaciones automáticas.
#
# uso: lanzar-v3.sh <tarea> <brief.md> <esfuerzo: high|medium>
# ej.: lanzar-v3.sh T07 docs/campaign-v2/tareas/T07-kit-paisaje.md medium
#
# - Elige cuenta: codex-astra (primaria) y, si no tiene ventana libre, codex (normal). Nunca las dos a la vez.
# - Solo arranca con la ventana de 5 h por debajo de VENTANA_MAX. La normal, además, por debajo de TOPE_NORMAL en la semanal.
# - Corta la sesión si pasa de TOPE_LLAMADAS, si el contexto pasa de TOPE_CTX, si lleva INACTIVO segundos
#   sin eventos o, en la cuenta normal, si el uso llega a TOPE_NORMAL. El motivo queda en .astra/<tarea>.corte.
# - Limita la salida de cada herramienta y no inyecta AGENTS.md: las reglas van en el brief.
set -u
T=$1; B=$2; E=$3
WT=${WT:-/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2}
VENTANA_MAX=${VENTANA_MAX:-30}      # % usado de la ventana de 5 h para poder empezar
TOPE_NORMAL=${TOPE_NORMAL:-75}      # % usado (5 h o semanal) en el que se corta la cuenta normal
TOPE_SEMANA_ASTRA=${TOPE_SEMANA_ASTRA:-90}
TOPE_LLAMADAS=${TOPE_LLAMADAS:-30}
TOPE_CTX=${TOPE_CTX:-120000}
INACTIVO=${INACTIVO:-1200}
cd $WT || exit 1
mkdir -p .astra
rm -f .astra/$T.fin .astra/$T.corte .astra/$T-ultimo.txt
log() { echo "[$(date +%H:%M)] $*" | tee -a .astra/$T.log; }

# Uso de cuota de una cuenta: "<5h> <semana>" según su última sesión. Si la ventana ya se reinició, cuenta 0.
cuota() {
  python3 -I - "$1" <<'PY'
import glob, json, os, sys, time
fs = sorted(glob.glob(os.path.expanduser(sys.argv[1]) + "/sessions/*/*/*/*.jsonl"), key=os.path.getmtime)
p = s = 0
if fs:
    r = None
    for l in open(fs[-1]):
        if '"rate_limits"' in l:
            x = json.loads(l)["payload"].get("rate_limits") or {}
            if x.get("primary"): r = x
    if r:
        ahora = time.time()
        p = 0 if r["primary"].get("resets_at", 0) < ahora else r["primary"]["used_percent"]
        s = 0 if r["secondary"].get("resets_at", 0) < ahora else r["secondary"]["used_percent"]
print(int(p), int(s))
PY
}

read A5 AS <<< "$(cuota ~/.codex-astra)"
read N5 NS <<< "$(cuota ~/.codex)"
if [ $A5 -lt $VENTANA_MAX ] && [ $AS -lt $TOPE_SEMANA_ASTRA ]; then
  CMD=codex-astra; HOMEC=~/.codex-astra; NORMAL=0
elif [ $N5 -lt $VENTANA_MAX ] && [ $NS -lt $TOPE_NORMAL ]; then
  CMD=codex; HOMEC=~/.codex; NORMAL=1
else
  log "$T no arranca: codex-astra ${A5}%/${AS}%, codex ${N5}%/${NS}% (5 h / semana). Espera a que se libere una ventana."
  exit 2
fi
[ $NORMAL = 1 ] && U0="$N5%/$NS%" || U0="$A5%/$AS%"
log "$T con $CMD (uso 5 h/semana $U0), esfuerzo $E · topes: $TOPE_LLAMADAS llamadas, ${TOPE_CTX} ctx, ${INACTIVO}s inactiva"

MARCA=$(mktemp); sleep 1
$CMD exec -m gpt-6.2-astra -c model_reasoning_effort=$E \
  -c project_doc_max_bytes=0 -c tool_output_token_limit=4000 -c model_auto_compact_token_limit=110000 \
  --disable default_mode_request_user_input -s workspace-write -C $WT \
  -o .astra/$T-ultimo.txt - < "$B" >> .astra/$T.log 2>&1 &
PID=$!
tail -n 0 -f .astra/$T.log & COLA=$!

cortar() { log "CORTE $T: $1"; echo "$1" > .astra/$T.corte; pkill -P $PID 2>/dev/null; kill $PID 2>/dev/null; }
SES=""; LL=0; CTX=0; U5=0; US=0
while kill -0 $PID 2>/dev/null; do
  sleep 30
  [ -z "$SES" ] && SES=$(find $HOMEC/sessions -name '*.jsonl' -newer $MARCA 2>/dev/null | head -1)
  [ -z "$SES" ] && continue
  read LL CTX U5 US <<< "$(python3 -I - "$SES" <<'PY'
import json, sys
n = ctx = p = s = 0
for l in open(sys.argv[1]):
    if '"token_count"' not in l: continue
    d = json.loads(l)["payload"]
    if d.get("info"): n += 1; ctx = max(ctx, d["info"]["last_token_usage"]["input_tokens"])
    r = d.get("rate_limits") or {}
    if r.get("primary"): p, s = r["primary"]["used_percent"], r["secondary"]["used_percent"]
print(n, ctx, int(p), int(s))
PY
)"
  QUIETO=$(( $(date +%s) - $(stat -f %m "$SES") ))
  if [ $LL -gt $TOPE_LLAMADAS ]; then cortar "pasó de $TOPE_LLAMADAS llamadas ($LL)"
  elif [ $CTX -gt $TOPE_CTX ]; then cortar "contexto $CTX > $TOPE_CTX"
  elif [ $QUIETO -gt $INACTIVO ]; then cortar "${QUIETO}s sin eventos"
  elif [ $NORMAL = 1 ] && { [ $U5 -ge $TOPE_NORMAL ] || [ $US -ge $TOPE_NORMAL ]; }; then cortar "cuenta normal al ${U5}%/${US}%"
  fi
done
wait $PID 2>/dev/null
kill $COLA 2>/dev/null; rm -f $MARCA
[ -n "$SES" ] && log "$T terminó: $LL llamadas, contexto máx. $CTX, cuota 5 h ${U5}%, semana ${US}% · sesión $(basename $SES)"
date > .astra/$T.fin
