# Propuesta · mecánicas de batalla: vehículos, rueda kamikaze y órdenes por clic

Maqueta jugable del 16 de noviembre de 2026. **Nada de esto está decidido ni forma parte de War o de Campaign.** Es un laboratorio aparte, como el previsto para VFX, para que el autor pruebe las mecánicas en PC y teléfono antes de decidir.

- Abrir: `http://localhost:8770/laboratorio/batalla/` (también desde el pie de la portada). `?prueba=1` a `?prueba=5` elige la prueba.
- Código: `laboratorio/batalla/`. No modifica `Prototypes/Rocket Launcher/`; reutiliza el editor de `shared/editor/` y los colores del juego.
- Pruebas: `node pruebas/lab-batalla.cjs` (reglas y programas, sin navegador) y `pruebas/lab-batalla.mjs` (navegador).

## Por qué un laboratorio y no un reto más de War

Las dos mecánicas cambian cosas que War da por fijas: unidades que se mueven y pueden ser destruidas, y programas que reaccionan a algo que hace el jugador durante la batalla. Meterlas en `juego.js` habría obligado a tocar el runtime, el inspector, las vistas 3D y las suites en plena unificación. El laboratorio conserva lo que importa de la base (paso fijo de 0,05 s, RNG con semilla, un Worker por unidad, mundo que solo avanza cuando todos los programas esperan) y deja el resto para cuando se decida qué se queda.

El mapa es de 48 × 27 casillas (War usa 32 × 18): la base a la izquierda, un muro con dos puertas en x = 7 y el campo a la derecha. La integridad del muro sustituye a las brechas: cada enemigo que llega resta, y a cero se pierde.

## Mecánica 1 · Vehículos que salen del muro

### Vehículo con torreta (`VEH`)

| | |
| --- | --- |
| Movimiento | 3 casillas/s. Cruza el muro solo por las puertas; la ruta la calcula el juego. |
| Arma | La de las torretas, con alcance 8 (la torreta del muro llega a 14). 10 misiles. |
| Sensor | 9 casillas (6 con niebla). `autoTarget()` devuelve el enemigo más cercano, no el más avanzado. |
| Vida | 4. Dentro del muro repara 1 cada 2 s y recarga 2 misiles/s. Fuera, nada. |

Órdenes nuevas, todas modos instantáneos como `regularShoot`: `moveTo(lugar)` y `stop()`. `await arrive()` es la espera asociada (devuelve `"ok"`, `"redirigida"` o `"detenida"`). Lecturas: `position`, `home`, `hp`, `missiles`, `moving`.

«Moverse según dónde se detectan los enemigos» es un bucle que lee el radar y vuelve a dar `moveTo` cada 0,4 s:

```js
const presa = masCercano(RAD_01.list("gunner")) ?? masCercano(RAD_01.list("siege"));
if (reponiendo || !presa) moveTo(home);
else moveTo({ x: presa.x - DISTANCIA, y: presa.y });
regularShoot(autoTarget());
```

Para que salir tenga sentido hacen falta enemigos que las torretas no alcancen:

- **Cañón de asedio** (`siege`): se aposta en x = 36 y resta 1 al muro cada 5 s. 8 de vida.
- **Tirador** (`gunner`): se aposta en x = 25, alcanza 7 casillas y dispara contra vehículos y ruedas al punto donde estarán si siguen rectos. Persigue al vehículo que ve y no alcanza.

El tirador alcanza 7 y el vehículo 8: una sola constante del programa decide si el vehículo recibe impactos. Con `DISTANCIA = 6` (el programa de partida) la prueba «Salida» acaba con el muro en 12/20; con `7.5`, en 19/20. Sin vehículos, el muro cae a los 109 s.

### Rueda kamikaze (`WHL`)

| | |
| --- | --- |
| Movimiento | 6 casillas/s, el doble que el vehículo. |
| Carga | `detonate()`: 8 de daño en 2,5 casillas. Destruye la rueda. También daña (2) a los vehículos propios cercanos; entre ruedas no se dañan. |
| Vida | 1. La base la repone a los 12 s y **su programa vuelve a empezar desde la primera línea**. |

El recorrido raro no es una orden del juego: lo escribe el jugador con `moveTo` y `await arrive()`. El programa de partida avanza `TRAMO` casillas hacia la meta y se desvía `DESVIO` a un lado, alternando.

El zigzag sirve por una regla simétrica a `autoTarget`: el tirador predice en línea recta. Si la rueda cambia de rumbo antes de que llegue el proyectil, falla. En duelos aislados de una rueda contra uno o tres tiradores (10 geometrías):

| Programa | Ruedas que llegan a detonar |
| --- | --- |
| Recta, tramos de 3 | 0 de 10 |
| Recta, tramos de 2 | 4 de 10 (detonan en el mismo instante en que reciben el impacto) |
| `DESVIO` 1,5 o 2, tramos de 2 | 10 de 10 |
| `DESVIO` 2, tramos de 3 | 7 de 10 |

Tramos largos empeoran el resultado: lo que cuenta es el tiempo entre dos cambios de rumbo frente al vuelo del proyectil. En la prueba completa la diferencia es menor (2 ruedas perdidas frente a 3, muro 15 frente a 11) porque salen tres a la vez y se reparten los disparos.

### El mismo recorrido en el otro bando: rodador (`roller`)

La frase del encargo admitía dos lecturas, así que el enemigo también tiene su rueda: avanza a 3 casillas/s en dientes de sierra y resta 3 al muro. Un misil acierta solo si llega antes del siguiente giro, de modo que cuanto antes se la empieza a seguir, más oportunidades hay. Aparece en «Observador» y «Campaña 1».

## Mecánica 2 · `onClick`: programar qué pasa cuando el jugador hace clic

### Lo que escribe el jugador

```js
let foco = null;

enemies.onClick((enemigo) => {        // clic sobre un enemigo
  foco = enemigo.id;
});

terrain.onClick(async (lugar) => {    // clic en el terreno
  zona = lugar;
  await wait(2);
  if (zona === lugar) zona = null;
});

while (true) {
  regularShoot(track(foco) ?? zona ?? autoTarget());
  await wait(0.3);
}
```

- `terrain.onClick(fn)` recibe `{ x, y }`. `enemies.onClick(fn)` recibe `{ id, type, x, y, hp, vx, vy }`. `onClick(fn)` recibe cualquier clic (`ev.target`, `ev.x`, `ev.y`, `ev.enemy`).
- El clic no hace nada por sí mismo. Solo ocurre lo que el programa de cada unidad haya dicho. Tres usos aparecen en las pruebas: cambiar una variable que lee el bucle, dar una orden directa (`moveTo(lugar)`) y abrir una secuencia con `await`.
- Un programa puede ser solo oyentes. No termina: se queda esperando clics.

### Reglas que propone la maqueta

1. **El oyente corre dentro del lockstep.** El clic se entrega entre dos pasos fijos; el mundo no avanza hasta que el oyente termina o espera. Cada `await wait()` aparca solo ese hilo: el bucle principal y otros oyentes siguen a su ritmo.
2. **A quién llega.** A las unidades elegidas en la fila «El clic llega a» (o tocándolas en el campo). Sin elegir ninguna, a todas las que escuchan. Tocar una unidad propia la elige y abre su programa; no es una orden.
3. **Un clic sobre un enemigo lo marca 6 s.** Mientras dura, cualquier unidad puede seguirlo con `track(id)` aunque su sensor no lo vea. Es la respuesta al seguimiento por identidad de la visión (5.3): la identidad se obtiene de un sensor o del jugador, y caduca.
4. **Los clics quedan grabados** con el paso en que llegaron. «Repetir mis clics» vuelve a jugar la batalla con las mismas entradas y el código de ahora: sirve para comparar dos programas con la misma partida. La simulación sigue siendo reproducible; las pruebas comprueban que dos ejecuciones con los mismos clics son idénticas.
5. **Los errores no paran la batalla.** Un programa que falla se detiene y enseña su línea; las demás unidades siguen. En una batalla de varios minutos, perderlo todo por una errata parecía excesivo.

### Qué aporta, medido con un jugador de prueba

Un guion fijo que hace clic cada 2 o 3 s. No imita a una persona; sirve para saber si los clics cambian el resultado.

| Prueba | Sin clics | Con clics |
| --- | --- | --- |
| 3 · Observador (torretas con niebla) | Derrota a los 111 s | Victoria, muro 16/16 |
| 4 · Órdenes (vehículos y ruedas) | Derrota a los 92 s | Victoria, muro 16/20 |
| 5 · Campaña 1 (4 min 10 s) | Victoria, muro 4/16 | Victoria, muro 15/16 |

En «Observador» los clics valen porque hay niebla: las torretas ven 6 casillas y su arma llega a 14. El jugador hace de observador avanzado. Sin esa diferencia entre lo que ve la máquina y lo que ve el jugador, un clic sobre un enemigo no añade nada que `autoTarget` no haga ya.

### Preguntas que la maqueta deja abiertas

- **Prioridad entre el clic y el programa.** Es la misma duda de la visión sobre el Control Maestro (6.5). En «Campaña 1» el clic manda 10 o 20 s y luego el vehículo vuelve a su patrulla; esa regla está escrita en el programa, no en el juego. ¿Debe seguir siendo decisión del jugador?
- **Ritmo.** El guion usa unos 80 clics por minuto en «Campaña 1»; una persona hará bastantes menos. ¿Cuántos resultan cómodos sin convertir la batalla en un juego de reflejos? Subir la duración de la marca reduce los clics necesarios.
- **Selección.** ¿Basta la fila de destinatarios o hace falta un cuadro de selección como el de War?
- **Clic sobre una unidad propia como evento.** Hoy solo elige. Podría ser `onSelfClick` (por ejemplo, cambiar de modo), a costa de mezclar elegir y ordenar.
- **Teléfono en vertical.** El campo queda en unos 360 × 200 px. Se puede ampliar y arrastrar; en horizontal se juega mejor. Falta probarlo en un teléfono real.

## Mecánicas extra incluidas

| Mecánica | Qué es | Dónde probarla |
| --- | --- | --- |
| `onDamage(fn)` | Evento del mundo, no del jugador: la unidad recibió un impacto. Mismo mecanismo que `onClick`. | Prueba 4: el vehículo vuelve solo con 1 de vida. |
| `track(id)` | Seguimiento por identidad, limitado al sensor propio o a la marca del jugador. | Pruebas 3 y 5. |
| Radar `RAD_01` | `detect`, `locate(id)`, `list(tipo)` y `count` sobre casi todo el campo, sin predicción. | Pruebas 1, 2, 4 y 5. |
| ⚡ Aplicar ahora | Reprograma una unidad sin parar la batalla: su programa empieza de nuevo. Queda grabado como una entrada más. | Cualquier prueba, con la batalla en marcha o en pausa. |
| Reposición | La base repone las ruedas y su programa arranca otra vez. | Pruebas 2, 4 y 5. |
| Pausa con clics en espera | En pausa se puede leer, editar y hacer clic; los clics llegan al reanudar. | Barra espaciadora. |

## Otras unidades y eventos que se podrían probar después

No están implementados. Cada uno cabría como una prueba más de este laboratorio.

- **Camión de munición.** Lleva misiles del depósito a un vehículo que no quiere volver. Es la prueba 1 de la ruta hacia Campaign (abastecer un lanzador) con un destino que se mueve.
- **Señuelo.** Rueda sin carga y más barata que solo atrae el fuego de los tiradores: `moveTo` y nada más. Haría del reparto de disparos algo que se programa.
- **Minador.** Deja cargas en el suelo con `drop()`; detonan al pasar un enemigo. Convierte el terreno en parte del programa.
- **Dron explorador.** Sensor móvil que disipa la niebla donde está. Con `terrain.onClick` el jugador decide dónde mirar en lugar de a qué disparar.
- **Escudo de puerta.** Unidad lenta que protege a las que tiene detrás; enseñaría formaciones (`moveTo` relativo a otra unidad).
- **Más eventos con el mismo mecanismo:** `onEnemySeen` (entra algo en el sensor), `onArrive`, `onWallHit`, y `signal("retirada")` / `onSignal` entre unidades, que sería el primer paso del Control Maestro.

## Qué haría falta para llevarlo a War o Campaign

1. Runtime: varios hilos por programa (cuerpo y oyentes) contados por separado. Está hecho en `laboratorio/batalla/js/runtime.js` sobre el mismo protocolo de mensajes; el de War solo admite una espera por programa y avisa de «Falta await» con esa suposición.
2. Instrumentación por línea (`__L`) para que los oyentes marquen la línea que corre y los avisos lleven su número. La maqueta saca la línea solo de los errores.
3. Unidades móviles y destruibles en el inspector, en las dos vistas y en la semántica de `null` (prueba 2 de la ruta hacia Campaign).
4. Python: `terrain.on_click(...)` pasa una función como argumento; habría que comprobar que el traductor lo admite y añadirlo a sus pruebas. La maqueta es solo JavaScript.
5. Seudocódigo y bloques para «cuando haga clic en…».

## Límites de la maqueta

- Solo JavaScript y solo plano 2D. Sin seudocódigo, sin Python y sin inspector de estadísticas.
- No hay ráfaga ni atascos: las torretas disparan 1 misil/s con suministro continuo, para no mezclar preguntas.
- Los números (alcances, vidas, cadencias) están ajustados para que cada prueba enseñe su mecánica, no como equilibrio de juego.
- Verificado con Chromium emulando PC y teléfono. Sin probar en un teléfono real ni en Safari.
