# Oráculo de Factory · etapa 0

`factory-oraculo.json` fija el comportamiento del Factory original antes de migrarlo. Incluye el commit y SHA-256 de `Prototypes/Tres vistas/js/juego.js`, los programas completos, el escenario de «Tu reto» y los resultados observados en Chromium con Web Workers reales. No ejecuta una copia ni una reimplementación de las reglas.

Los casos cubren programas iniciales y ganadores de los seis retos y un reto propio, la secuencia completa de `stockPorIntento`, derrames permitidos y prohibidos, viajes vacíos, órdenes sin `await`, el vigía de bucles, el límite de consultas, lugares inexistentes y rechazo de material. El caso de programa continuo alcanza las metas y después sigue esperando hasta el límite de 300 s: documenta la regla antigua de victoria.

El inicial se genera desde el árbol y se ejecuta como JS activo (equivale al modo bloques; la vista JS inicial del juego lo muestra comentado). «Tu reto» usa explícitamente el mapa de Primer viaje, no el reto que estuviera guardado por el jugador. Los escenarios de derrame que no son posibles con el stock/capacidad de Primer viaje se prueban en Sin derrames y en un reto propio con entrada de un hueco.

Cada resultado conserva `fin`, motivo, mensaje y línea del error, tiempo sin redondear, intento, stock oculto, derrames, viajes vacíos, valores y cumplimiento de metas, estado final del robot, contadores de resultados y eventos de órdenes/lecturas. Se excluyen fechas, tiempos de pared y estado visual. `cambiaEtapa3` identifica los casos dirigidos a reglas que cambiarán; no autoriza a actualizar automáticamente el fixture.

## Original retirado (etapa 5)

Desde la etapa 5 el Factory original ya no está en el árbol: `Prototypes/Tres vistas/` solo redirige a `Rocket Launcher/?serie=factory`. El fixture sigue siendo la referencia histórica. `factory-oraculo.mjs` (`generarOraculo`/`probarOraculo`) solo funciona en un checkout del commit de origen (`git worktree add ../cbl-oraculo b76411b`), servido en 8771. La comprobación vigente es `factory-comun.mjs`.

## Ejecutar (sobre el commit de origen)

Desde la raíz, servir el proyecto en el puerto reservado:

```sh
python3 -m http.server 8771 --bind 127.0.0.1
```

En otra terminal, con Ego Browser disponible (adaptar la ruta absoluta si cambia el checkout):

```sh
ego-browser nodejs <<'JS'
const task = await taskSpace('Factory · comprobar oráculo');
const { probarOraculo } = await import('file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/factory-oraculo.mjs');
console.log(await probarOraculo(task.page('p1')));
await task.finish({ keep: [] });
JS
```

La suite rechaza cualquier origen que no sea `http://127.0.0.1:8771` o `http://localhost:8771`. Respalda y restaura las claves de Factory en `finally`; no usar simultáneamente ese origen para jugar o ejecutar otra suite. Si se mata el proceso o se cierra el navegador, `finally` puede no ejecutarse. La velocidad es el 4× oficial: el caso de 300 s tarda unos 75 s reales y la suite completa varios minutos. No se acelera ni sustituye el reloj de la simulación.

## Captura inicial y cambios futuros

`generarOraculo(page)` comprueba que la fuente local coincide con el commit y con lo servido por HTTP, ejecuta dos pasadas completas y exige igualdad exacta antes de escribir el JSON. Se niega a sobrescribir un fixture existente. `probarOraculo(page)` compara con el fixture guardado, admite solo `1e-9` de diferencia en `mundo.t` y exige igualdad en el resto.

Cuando se implemente el adaptador para la base común, deberá ejecutar **estos mismos programas y escenarios** y producir la misma estructura de resultados; la etapa 1 compara primero el subconjunto de Primer viaje. La etapa 3 documentará las diferencias aprobadas manteniendo esta referencia histórica del original. No regenerar el oráculo para ocultar una regresión.

Esto verifica reglas y runtime en navegador de escritorio; no acredita interacción táctil, teclado físico ni paridad de la futura versión migrada.

## Aplicación común · reglas aprobadas

`factory-comun.mjs` ejecuta los mismos 28 programas y escenarios en `?serie=factory` y exige igualdad con el fixture histórico más `factory-deltas.json`. Este último contiene únicamente los campos que cambian y la razón de cada uno: 13 casos; los otros 15 permanecen exactos. No existe un generador que sobrescriba automáticamente esos deltas.

- Tres casos de límite: `derrame` pasa a `rechazo`/`lleno`, con carga conservada y el mismo instante.
- El caso sin límite ya no pierde piezas: las siguientes recogidas devuelven `manos_llenas`, por eso acaba en 9,7 s en lugar de 14,5 s.
- «Sin entregas rechazadas» gana en la entrega final (39,2 s), sin ejecutar la espera posterior de 3 s.
- Los seis casos de bucle de vaciado omiten la última lectura después de ganar, sin cambiar el tiempo.
- El bucle continuo gana en 8,7 s; el lugar inexistente lee `null` y termina incompleto.

`factory-reglas.cjs` comprueba conservación, devolución y límites con paso fijo. `factory-api.mjs` verifica alias y variables. `factory-vistas-comunes.mjs` adapta la cobertura de Tres vistas (ejecución de seis soluciones en tres vistas, importación y Tu reto); `factory-editor-comun.mjs` adapta la del editor (historial, sugerencias, persistencia y arrastre).

Para ejecutarlas, importar sus funciones `probarFactoryComun`, `probarFactoryAPI`, `probarFactoryVistas` y `probarFactoryEditorComun` desde una página de Ego Browser en 8771. Ejecutar secuencialmente: comparten almacenamiento de QA. La suite de reglas usa `node pruebas/factory-reglas.cjs`.
