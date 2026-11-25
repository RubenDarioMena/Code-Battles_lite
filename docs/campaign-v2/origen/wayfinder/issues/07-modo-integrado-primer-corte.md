# Qué partes del modo de batalla integrado entran para probar las Batallas 1–5

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 02, 06

## Question

De las piezas del laboratorio, ¿cuáles hacen falta para probar las Batallas 1–5 en Campaign-V2 y cuáles quedan como extensión prevista?

- grabar y repetir entradas;
- aplicar ahora;
- errores que no paran la batalla;
- pausa con entradas en espera;
- radar `RAD_01`;
- marca de 6 s + `track`;
- `onDamage`;
- reaparición.

¿Cómo encajan con el menú de pruebas y con el modo paridad (que no admite órdenes de jugador)? Resultado esperado: tres listas («entra», «extensión prevista», «necesita definición»).

## Contexto añadido (tras el ticket 06)

- El clic programado se apoya en el transporte genérico de eventos (ticket 05). Si no entra en el primer corte, el clic derecho es siempre una orden puntual, sin cambiar los gestos.
- La orden puntual y apuntar arrastrando sí son del primer corte, porque el grill puso la orden puntual en la Batalla 1.
- La marca de 6 s y `track` quedan abiertas aquí: el ticket 06 decidió no seguir por identidad.

## Grill

Preguntas en HTML con diagramas: [grill/ticket-07.html](../grill/ticket-07.html)

## Answer

Resuelto con el autor el 24-nov-2026 (grill en HTML). Respuestas originales: `~/Documents/ticket-07-respuestas.md`.

1. **Tres maneras de jugar una Batalla (Q1 = A):**
   - **campaña:** progresión, fábrica y checkpoints;
   - **ensayo** (menú de pruebas, `?ensayo=…`): cualquier Batalla o caso de mecánica con las reglas de campaña, sin progresión ni checkpoint, con la bodega en un valor fijo y la fábrica opcional; las cifras experimentales viven en el ensayo;
   - **paridad:** War exacto.

   Los casos del laboratorio («Salida», «Rueda kamikaze», «Observador», «Órdenes», «Campaña 1») serán ensayos cuando lleguen sus mecánicas.
2. **Piezas (Q2):**

   | Entran en el primer corte | Extensión prevista | Necesita definición |
   | --- | --- | --- |
   | Errores aislados por unidad · aplicar ahora · grabar y repetir entradas · pausa con órdenes en espera · **clic programado** | `onDamage` · `onArrive` · `onEnemySeen` · radar `RAD_01` · reaparición | marca de 6 s + `track(id)` |
3. **Piezas activadas por modo (Q3 = A).** En paridad, todo como War: un error termina, no hay entradas y no se aplica nada en caliente. En campaña y ensayo, las piezas nuevas están activas. Las referencias no se regraban.

Consecuencias:
- **Que entre el clic programado** adelanta al primer corte el coste único del transporte de eventos y los varios hilos por programa en el anfitrión (ticket 05), con `onClick` como único evento. Después, `onDamage`, `onArrive` y `onEnemySeen` solo añaden su ficha y su emisión.
- **Oyentes en Python y seudocódigo:** el grill exige seudocódigo en las Batallas desde el primer hito y mantiene Python, así que el clic programado los necesita en el primer corte. Pasa de la niebla al ticket «Forma del clic programado en JS, Python y seudocódigo».
- **La marca y `track`** se quedan en la niebla de visibilidad compartida.
- **Glosario:** se añade «Ensayo».
