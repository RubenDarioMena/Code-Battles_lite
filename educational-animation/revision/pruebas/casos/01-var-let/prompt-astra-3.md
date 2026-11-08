Turno 3 de Astra (cierre del ciclo 01). Opus aplicó tus 4 cambios, sin commitear (`git diff`):
- capturas ya no depende de F.enLinea: toma toda función escrita en la fila (también con llaves) y resuelve la declaración que ve cada uso con `declaracion(P, i)` (let/const por bloque y cabecera de for; var y Python por función; parámetros). l-bloque-hermano ya no dispara.
- «no se ejecuta aquí» solo si `guardada(P, fn)`: variable, propiedad, lista, return, o argumento de push/unshift/append/insert/add/set/setTimeout/setInterval/addEventListener/queueMicrotask. Si no (map, forEach, función cualquiera): frase neutral r.captura.*Uso («usa la i de esta vuelta…»).
- let/const declarada en el cuerpo (no en la cabecera): la pista va plegada en «Más detalles» (h-sin-cambio).
- Traza: la pista de ámbito solo en la primera visita a la fila. Lecturas repetidas con otro valor se conservan (map: «lee i «0», i «1»»).
- Asociación: el grupo de lecturas también se cierra con `await f()` (la llamada solo deja evento w); si el callee es un identificador de una función propia (P.funciones), solo cierra si las lecturas son de esa función.
Fixtures nuevos: j-map, k-llaves, l-bloque-hermano, m-await (+ *.txt). Suite flujo: 320. Navegador (8771): depuracion.mjs 173 correctas; capturas PC/teléfono de la fila 4 en traza revisadas.

Tu turno, máximo ~250 palabras: intenta UNA última variante que rompa algo de lo nuevo (resolución de ámbito, `guardada`, o la asociación por callee). Ejecútala. Después da el veredicto final del ciclo: aceptar / aceptar con un cambio mínimo (cuál) / rechazar, y propone en una línea el par mínimo del ciclo 02 entre los dos que planteaste (generador creado vs. consumido, o callback agendado vs. ejecutado).
