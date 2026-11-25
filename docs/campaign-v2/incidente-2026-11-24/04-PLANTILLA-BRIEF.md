# Plantilla de brief corto

Copiar, rellenar y guardar como `docs/campaign-v2/tareas/T<nn>-<nombre>.md`. El brief completo, con el paquete de contexto, ocupa menos de 10 k tokens.

---

```markdown
# T<nn> · <resultado en una frase>

Trabajas solo y sin humano. No hagas preguntas. Esta tarea es corta: cumple el resultado y para.

## Reglas fijas
- Escribe solo en `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`. Sin commits, push, checkout, stash, reset, instalaciones ni descargas.
- No intentes abrir puertos ni navegadores: el sandbox no lo permite y la revisión visual la hace Claude.
- Determinismo: paso fijo y RNG con semilla. Nada de azar global ni reloj en las reglas.
- Lee solo los archivos de «Puedes abrir», con `rg -n` y `sed -n` por rangos de ≤150 líneas. Nada de `cat` de archivos enteros.
- Si te falta algo que no está aquí, no explores: termina con «Falta contexto: …».

## Resultado
<Una sola cosa comprobable. Ej.: «En B1 se ven los 10 elementos del kit de paisaje repartidos fuera del campo de batalla, sin tapar la muralla ni los bastiones.»>

## Archivos
- Cambia: <≤5 rutas>
- Crea: <rutas, si hay>
- Puedes abrir (solo lectura): <rutas con rangos de líneas>
- No toques: `paquetes/reglas-war`, `pruebas/referencias/partidas.json`, `Prototypes/Rocket Launcher/`, `paquetes/app/` (salvo que esté en «Cambia»)

## Contexto
<Lo pega Claude: las firmas, interfaces y fragmentos con su ruta y sus líneas, y el patrón que hay que imitar. Máximo ~8 k tokens.>

## Comprobación
- Prueba que se crea o se cambia: `<pruebas/xxx.mjs>`, con lo que debe afirmar.
- Al final, una sola vez: `node pruebas/todas.mjs`. Lo que pasaba sigue en ok, y solo quedan los 7 fallos de la línea base.

## Topes
- Unas 30 llamadas al modelo. Si te acercas sin terminar, deja el árbol coherente y termina con lo que falta.

## Mensaje final (solo esto)
1. Los archivos creados o cambiados.
2. La línea de resumen de la suite y los nombres de las pruebas que fallan.
3. Si aplica: «Falta contexto: …» o «Fuera de alcance: …».
```

---

## Cómo lanzarla

```bash
zsh docs/campaign-v2/incidente-2026-11-24/herramientas/lanzar-v3.sh T07 docs/campaign-v2/tareas/T07-kit-paisaje.md medium
```
