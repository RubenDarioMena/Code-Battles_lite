# Referencias de paridad · fase 0, paso 5

`partidas.json` fija 41 partidas sin pantalla: War 1–5 × semillas 1/7,
27 casos reproducibles del oráculo Factory, Campaign JS/Python y dos
programas Python equivalentes escritos a mano (War 2/7 y Factory
`reto-1-victoria`). Factory conserva la conversión de índices históricos +1.
La selección única está en `herramientas/partida/casos.mjs`.

Generadas con `node herramientas/grabar-referencias.mjs` sobre el commit
indicado en `generado`, usando los anfitriones actuales, sin Chromium.
Cada entrada conserva parámetros, SHA-256 completo, pasos y resultado íntegro;
Campaign añade sus tramos. No se guardan ms ni registros por paso.
Se comparan los resultados exactos de VM; la excepción de intercalado entre
Workers de Campaign solo se aplica al contraste con el navegador.

Comprobar: `node pruebas/partida-referencias.mjs` o `npm test`.
El diagnóstico común muestra hash, pasos y primer campo distinto del resultado
(o tramo). Sin registros de pasos, `primerPasoDistinto` queda en null.

**NO se regraban para que una prueba pase.** [AGENTS.md](../../AGENTS.md),
regla «Paridad durante la reestructura»: «Hasta cerrar la fase 2 del plan,
el juego se comporta igual». El [plan](../../docs/PLAN-ARQUITECTURA.md),
fase 0, establece que «Estas referencias son el criterio de paridad de las
fases 1 y 2»; sus criterios exigen que coincidan.

Si una deja de coincidir, buscar la causa y arreglar el código. Conservar
la referencia y usar el diagnóstico, el oráculo y el contraste real para aislar
la regresión. Solo una decisión explícita del autor permite regrabar:
`node herramientas/grabar-referencias.mjs --forzar` imprime una advertencia.
Dos grabaciones deben ser idénticas salvo `generado` (commit y fecha ISO).
Los 39 casos originales tienen contraste histórico aprobado por la dirección;
los dos Python nuevos quedan pendientes del contraste real del autor.
