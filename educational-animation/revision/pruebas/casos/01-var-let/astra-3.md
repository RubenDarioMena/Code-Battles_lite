Última variante ejecutada con `caso.cjs /dev/stdin`:

```js
const receptor = { push: fn => fn() };
for (let i = 0; i < 2; i++) {
  console.log(receptor.push(() => i));
}
```

**Resultado:** consola `0 / 1`. El callback se ejecuta inmediatamente, pero la lectura estructural y el primer paso de traza afirman:

> [() => i] no se ejecuta aquí

La propia traza lo contradice: «[receptor.push(() => i)] lee [i] «0»».

**Causa:** `guardada` decide por el nombre del método, sin acreditar qué función recibe el callback (`educational-animation/revision/motor/flujo.js:453–460`). Un método llamado `push` no garantiza almacenamiento.

**Veredicto: aceptar con un cambio mínimo.** Para callbacks pasados como argumentos, usar siempre la frase neutral `*Uso` mientras no se haya acreditado la identidad y el comportamiento del receptor. Quitar la lista `GUARDAN` como prueba suficiente; mantener la descripción de almacenamiento para los contextos sintácticos directos. Añadir este programa como fixture: consola `0 / 1`, lecturas conservadas y ausencia de «no se ejecuta aquí».

**Ciclo 02:** callback agendado vs. ejecutado: `queueMicrotask(() => console.log("callback")); console.log("fin");` frente a `(() => console.log("callback"))(); console.log("fin");`, para contrastar registro, ejecución y orden real.