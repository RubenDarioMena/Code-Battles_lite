# Modo revisión · prototipo

La pantalla se parte en dos franjas de borde a borde: **arriba el código** de una máquina y **abajo su explicación**, paso a paso y en el orden real de ejecución. El código no se edita. Tocar cualquier fragmento explica qué es. Todo sale de una **partida real del juego**: el texto no inventa nada, y los valores son los que vio el programa.

Es un prototipo fuera del juego, como las infografías. No cambia el juego ni sus archivos. El ejemplo es el **reto 5 · Dos lanzadores**, con un programa para cada lanzador que lee al otro como objeto (`LAU_02.jammed`):

```js
// Un solo reparador para LAU-01 y LAU-02
while (true) {
  const pos = autoTarget("drone", "visual")
    ?? autoTarget("stealth", "visual")
    ?? autoTarget("crawler", "visual")
  if (LAU_02.jammed) {
    // El reparador está ocupado
    regularShoot(pos)
  } else if (failureRate < 0.12) {
    burstFire(pos)
  } else {
    // Que baje el failureRate
    regularShoot(pos)
  }
  await esperar(0.25)
}
```

Con la semilla 1, el resultado es victoria: 31/31 derribados, 0 brechas y 2 atascos.
- LAU-01 se atasca a los 20,35 s. Mientras REP-01 lo repara, LAU-02 lee `LAU_01.jammed === true` durante 14 vueltas y no usa ráfaga.
- A los 25 s le toca a LAU-02, y LAU-01 hace lo mismo durante 19 vueltas.

Sin ese `if`, con la misma semilla también gana, pero con 3 atascos (uno más y una reparación más). En un barrido de 12 semillas con la misma lógica, la regla dejó siempre 2 atascos y ninguna brecha; sin ella hubo 3 atascos en 9 de las 12.

## Uso

```bash
python3 -m http.server 8790        # desde la raíz del repo; abre /educational-animation/revision/
node educational-animation/revision/grabar.mjs educational-animation/revision/ejemplos/reto-5   # vuelve a grabar la partida
node educational-animation/revision/pruebas/trazador.cjs
node educational-animation/revision/pruebas/pasos.cjs
node educational-animation/revision/pruebas/interfaz.mjs
```

**Teclado y gestos:**
- ← → o deslizar en la explicación: paso anterior o siguiente.
- Espacio o ▶: avanzar solo.
- Inicio y Fin: primer y último paso.
- `1` / `2`: cambiar de programa.
- Esc: cerrar la tarjeta.

**Tocar:**
- Un fragmento del código abre la tarjeta «¿qué es?». Otro toque sobre el mismo sube al bloque que lo contiene: `jammed` → `LAU_02.jammed` → `if`.
- Un fragmento de la explicación se señala en el código.
- La franja de abajo es la partida entera, con un color por camino del programa. Tocar un tramo salta a su resumen. ▲ rojo marca un atasco y ▲ verde, una reparación.

## Cómo funciona

```text
programa ──trazador.js──▶ programa con ganchos (mismas líneas) ──juego real (grabar.mjs)──▶ grabacion.js
grabacion.js ──pasos.js──▶ vueltas ▸ tramos ▸ pasos ──explicar.js + catalogo.js──▶ frases ──revision.js──▶ pantalla
```

| Archivo | Qué hace |
|---|---|
| `motor/trazador.js` | Instrumenta el JavaScript por su árbol (acorn, el mismo del juego) sin mover líneas. Añade ganchos para sentencias (`s`), condiciones (`c`), valores (`v`) y esperas (`w`). La línea en ejecución y los errores del juego siguen coincidiendo. Además conserva los comentarios del autor. |
| `grabar.mjs` | Abre el juego real en Chromium (puerto 8771) y lo ejecuta con los programas instrumentados. Recoge la traza de cada Worker. Después **repite la partida sin traza con la misma semilla** y falla si cambia el resultado o algún evento de alguna máquina. La grabación es reproducible byte a byte. |
| `motor/catalogo.js` | Qué significa cada objeto, función y propiedad del juego. **Es lo único que hay que ampliar** cuando aparece una máquina o un robot nuevo (abajo). |
| `motor/explicar.js` | Plantillas por tipo de nodo. Escriben el programa en palabras, narran cada paso con los valores reales y explican el fragmento que se toca. |
| `motor/pasos.js` | Divide la traza en vueltas y junta en tramos las vueltas iguales seguidas; las cortas que alternan forman un único tramo. Detalla solo lo nuevo y resume lo repetido. |
| `motor/revision.js`, `motor/revision.css` | La interfaz. |

**Qué cuenta cada paso:**
1. El programa en palabras, generado del árbol con el catálogo («Si LAU-02 está atascado: dispara normal a pos»).
2. La primera vuelta, sentencia a sentencia, y luego solo lo que cambia la primera vez que aparece: un objetivo de verdad, el `else`, el atasco propio, el atasco del compañero.
3. Un resumen por tramo, con rangos («failureRate: 0,095–0,115») y los hechos de la partida que caen en él (atascos, reparaciones, derribos).
4. El resultado, comparado con la variante del ejemplo (`ejemplo.json` → `comparar`).

**Colores por papel** (los mismos de las infografías):
- amarillo: condición;
- azul: sensor;
- cian: otra máquina;
- morado: la máquina propia;
- cobre: orden;
- rosa: espera.

## Añadir un objeto o un robot

Cada máquina se registra una vez en `motor/catalogo.js`. Desde ese momento, sus lecturas y órdenes se explican en el programa en palabras, en la narración y en la tarjeta «¿qué es?». No hace falta tocar las plantillas.

```js
CMGCatalogo.registrar({
  clave: "dron-propio", nombre: "dron explorador", patron: /^DRN_\d+$/, idDe: (n) => n.replace(/_/g, "-"),
  descripcion: "Dron explorador del jugador.",
  propiedades: {
    bateria: { tipo: "numero", rol: "otra", que: "la batería que le queda", frase: (s) => `la batería de ${s}`, valor: (v) => `${v} %` },
  },
  metodos: {
    patrullar: { clase: "orden", rol: "orden", args: [{ que: "zona", valores: { norte: "la mitad norte del mapa" } }],
      hace: "vuela en círculos por esa zona", frase: (a) => `patrulla ${a[0]}`, resultados: { ok: "el dron sale a patrullar" } },
  },
});
```

`pruebas/pasos.cjs` comprueba exactamente este caso. El catálogo ya trae:
- el lanzador (`LAU_xx`), con sus 7 propiedades y 4 órdenes;
- el sensor de vibración (`VIB_xx`);
- `esperar` y `console`;
- el robot de Factory (`yo`, con `recoger`/`pickUp`…), todavía sin grabación de ejemplo.

## Límites y siguientes pasos

- **Solo JavaScript.** Python se ejecuta en el juego traducido a JS con las mismas líneas, así que esta traza sirve para resaltar líneas enteras. Para resaltar expresiones, el traductor tendría que conservar también las columnas, y las plantillas necesitan el glosario de las infografías (`True`, `and`…).
- **Fuera del juego.** Para integrarlo hace falta:
  - un botón junto al del mapa;
  - repetir el último intento con su semilla e instrumentado en lugar de grabarlo aparte;
  - unir este catálogo con `Prototypes/Rocket Launcher/js/proveedor.js`, que ya tiene nombres y firmas.
- **Solo el bucle principal.** Los tramos se agrupan por el bucle de nivel superior. Bucles anidados y funciones propias se narran, pero no se agrupan aparte.
- **La traza ocupa** unos 2 500 eventos por programa en 36 s de partida (265 kB la grabación de dos programas).
- **Revisión pendiente:** QA en un teléfono real; el texto de las plantillas necesita revisión humana.
