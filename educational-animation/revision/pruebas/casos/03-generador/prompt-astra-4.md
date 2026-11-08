Ciclo 03 · verificación (turno 4, corto: máximo ~200 palabras). Opus corrigió tus dos rechazos, sin commitear:
1. En `preparar` (motor/flujo.js), un nombre que se reasigna en algún sitio sale de `P.funciones`. Ningún sitio lo enlaza ya a un cuerpo (ni etiqueta, ni lectura, ni traza, ni documentación). l-reasignada: «[g()]» / «Ejecuta [g()].» / «2 [g()] → «undefined»».
2. `avance()` devuelve `async` y `esperado`. Un next() de un generador async sin await → lectura «Pide a [it] su siguiente valor sin esperarlo: el cuerpo, en (4), empieza a correr, next() devuelve una promesa y el programa sigue aquí sin el valor.» y traza «…y next() devuelve enseguida una promesa.» (fixture p-async-sin-await).
Límite documentado: con tablas antiguas sin marca, solo se acreditan las formas reconocidas (`function*`, `yield*`/`yield from`); el resto, con frase neutral.
Flujo: 383.

Verifica SOLO estas dos correcciones (ejecuta tus programas) y da el veredicto final del ciclo 03: aceptar / aceptar con cambio mínimo / rechazar.
