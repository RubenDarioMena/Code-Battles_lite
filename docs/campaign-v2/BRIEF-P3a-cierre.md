# Brief para Astra · cierre de P3a

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en el informe y sigue.

Una sesión anterior empezó la porción P3a (`docs/campaign-v2/BRIEF-P3a.md`) y se cortó por límite de uso antes de terminar.

- **Lo hecho:** `git diff` (sin `--cached`) muestra exactamente sus cambios sobre P1+P2, que están en el índice. También están sus archivos nuevos sin seguimiento: `paquetes/app/juego/repetir-intento.js` y `pruebas/campaign-v2-{error-aislado,aplicar,repetir,pausa,intento-base}.mjs`.
- **Estado:** `node pruebas/todas.mjs` da 72 ok y solo los 7 fallos de la línea base.

## Tarea

1. **Contrasta.** Lee `docs/campaign-v2/BRIEF-P3a.md` y compáralo con lo hecho (`git diff --stat`, `git diff` y los archivos nuevos). No rehagas lo que ya funciona.
2. **Completa** solo lo que falte de los entregables 1–5 del brief. En particular:
   - el error aislado muestra la línea y la unidad en la consola de la app;
   - «Aplicar ahora» funciona desde la UI de V2;
   - hay una forma de repetir el último intento en la app;
   - la cola de la pausa se ve en la consola;
   - en modo paridad todo sigue como en War.
3. **Limpia:** borra `.p3a-temp/` si solo contiene restos de la sesión anterior.
4. **Escribe `docs/campaign-v2/P3a-INFORME.md`** (60 líneas como mucho): qué se hizo, los archivos tocados, cómo se prueba en Node y **cómo se prueba a mano en el navegador** (URL y pasos), Suposiciones y Faltantes.
5. **Actualiza `PLAN-PORCIONES.md`:** divide la fila P3 en P3a y P3b, y marca P3a como «hecha» solo si las pruebas pasan.

## Reglas

- Escribe solo en este worktree.
- No hagas commits, git add, checkout, stash, reset ni `npm install`.
- `paquetes/reglas-war` y `pruebas/referencias/partidas.json` no cambian.
- Al terminar, tu último mensaje es solo esto: la lista de archivos que tocaste en esta sesión, y la línea de resumen de `node pruebas/todas.mjs` con los nombres de las pruebas que fallan.
