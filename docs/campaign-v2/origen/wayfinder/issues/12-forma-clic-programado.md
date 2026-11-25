# Forma del clic programado en JS, Python y seudocódigo

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: —

## Question

El clic programado entra en el primer corte (ticket 07). ¿Qué escribe el jugador?

- **Forma de la API.** El laboratorio tenía tres: `terrain.onClick(fn)` con `{ x, y }`, `enemies.onClick(fn)` con `{ id, type, x, y, hp, vx, vy }`, y `onClick(fn)` con `ev.target`. ¿Cuál queda, y qué datos recibe el manejador?
- **Python.** `terrain.on_click(fn)` pasa una función como argumento: ¿lo admite el traductor de trunk (subconjunto sin decoradores ni clases)? Alternativas: `def` con nombre, o `lambda`.
- **Seudocódigo y bloques.** ¿Cómo se ve «cuando hagas clic en el terreno…»?
- **Varios oyentes.** ¿Qué pasa con dos oyentes, un oyente que hace `await wait()` o un programa que solo tiene oyentes?
- **Coherencia con el ticket 06.** Un clic sobre un enemigo apunta con predicción si es una orden puntual. ¿El manejador recibe el punto predicho, el del clic o ambos?

## Pistas

- En ccr: `docs/PROPUESTA-MECANICAS-BATALLA.md` («Mecánica 2») y `laboratorio/batalla/js/runtime.js`.
- En trunk: `lenguaje/python-preludio.js`, el traductor (`docs/REGLAMENTO.md` § Python: subconjunto) y `editor/seudo-modelo.js`.
- Investigación: `research/02-runtime-laboratorio-vs-anfitrion.md`.

## Grill

[grill/ticket-12.html](../grill/ticket-12.html) · HTML conjunto de los tickets 12 (Q1–Q7) y 10 (Q8–Q12). Esqueletos del prototipo en [prototipo/receta/](../prototipo/receta/). Datos nuevos: el seudocódigo de trunk rechaza funciones (`editor/seudo-modelo.js:171`); el subconjunto Python ya admite `def`, `async def` y `lambda`; `regularShoot` de War es un modo, sin blanco.

## Answer

Resuelto el 24-nov-2026 con el HTML conjunto de los tickets 12 y 10.

1. **API (A):** dos oyentes por destino, `terrain.onClick(fn)` → `{ x, y }` y `enemies.onClick(fn)` → `{ id, type, x, y, hp, vx, vy }`, datos del instante del clic.
   - Un clic sobre un enemigo va a `enemies.onClick`.
   - Si la unidad solo escucha el terreno, va a `terrain.onClick` con el punto.
   - Si no escucha nada, es una orden puntual (ticket 06).
2. **Disparar a un enemigo:** sin opción marcada; la nota del autor dice que `regularShoot` haría «pretty much the same» que `shootAt()`. **Confirmado por el autor (24-nov):** no hay verbo nuevo; se amplía `regularShoot`.
   - `regularShoot()` sin argumento es el modo de War, igual que hoy.
   - `regularShoot(objetivo)` con un enemigo o un lugar es el disparo dirigido, con la misma regla que la orden puntual del ticket 06: predicción de War, siguiente turno de fuego y descarte con aviso.
   - La forma con argumento solo existe en campaña y ensayo; en paridad, la API es la de War sin cambios.
3. **Coordenadas (A):** los programas ven las del marco de batalla (las de War, con la muralla en x = 3), iguales en paridad, ensayo y campaña. `reglas-campaign-v2` traduce también en la frontera de la API del programa.
4. **Python (A):** `def` o `async def` con nombre, o `lambda` para una línea: `terrain.on_click(al_clic)`. Ya cabe en el subconjunto; se añaden casos a las pruebas del traductor. Un manejador con `await` tiene que ser `async def`.
5. **Seudocódigo (A):** un nodo genérico «cuando <evento> → <parámetro>» con cuerpo en `seudo-modelo`. El texto sale de la ficha del evento, y los eventos futuros no tocan el editor.
6. **Concurrencia (A):** cada clic abre un hilo del manejador, que puede solaparse con otros del mismo manejador. Los oyentes corren en orden de registro, y un programa con solo oyentes sigue vivo.
7. **Registro (A):** solo al principio, antes del primer `await`. Registrar después da un error con la línea, aislado en esa unidad.
