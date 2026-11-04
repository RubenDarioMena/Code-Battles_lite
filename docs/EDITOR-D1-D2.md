# D1 y D2 · contrato inicial

Esta entrega implementa las decisiones D1 y D2 del plan, distintas de las etapas E1 y E2. Python aún no se puede seleccionar ni ejecutar: faltan E0–E5.

## D1: nombres suministrados por el juego

`js/proveedor.js` declara cada función una vez. `cmg.proveedor.funciones()` y la fachada existente `cmg.funciones()` devuelven los mismos datos. Cada descriptor contiene `nombre`, `nombres.python` cuando difiere, `firma`, `await` y los alias españoles existentes.

Factory enseña `pick_up`, `deliver`, `wait`, `count`; War enseña `auto_target`, `regular_shoot`, `burst_fire`, `stop_fire`, `wait` y `detect`. Python aceptará también los nombres originales y los alias españoles que ya existen en cada serie. Por ejemplo, `pick_up`, `pickUp` y `recoger` resuelven a la orden `recoger`. JavaScript conserva su vocabulario actual y no recibe `pick_up`.

`proveedor.alias("python")` entrega al futuro traductor registros con objeto, nombre, destino JS, orden y espera. El traductor debe consultar la tabla **después de resolver ámbitos**: una función local `count` o un método de otro objeto no es la API. Esta entrega no hace sustituciones de texto ni incorpora traducción.

`proveedor.vocabulario("python")` incluye las formas Python, originales y españolas para el futuro resaltado. `CMGLenguajes.llamada(descriptor, "python")` elige el nombre recibido y genera una llamada con huecos; no contiene un diccionario de nombres del juego. Este módulo es una pieza inicial del contrato, no el adaptador Python completo de E4.

## D2: espera escrita en el programa

Los encargos de Factory y las esperas de tiempo llevan `await`; `count` y las lecturas no lo requieren. `await` en lecturas seguirá permitido. No se introduce espera automática en el runtime.

Ejemplo del futuro documento Python:

```python
async def viaje():
    await yo.pick_up(ENT_1, "cobre")
    await yo.deliver(FUN)

await viaje()
```

Las funciones que esperan se declaran `async def`. Se admite `await` en el nivel superior, como en el REPL de `asyncio` (`python -m asyncio`); un archivo Python ordinario necesita su propio punto de entrada asíncrono. El generador escribe `await` explícito en las llamadas cuyo descriptor lo pide. `CMGLenguajes.python` publica esas tres decisiones para E4/E5; su validación sintáctica y ejecución llegarán con esas etapas.

## Recursos locales

Acorn 8.11.3, Three r128 y GLTFLoader r128 están en `shared/vendor/`, con licencias y hashes. El arranque y el cargador de Factory usan esas rutas. No se cargan fuentes de Google: se usan las alternativas locales ya declaradas en CSS, por lo que las métricas tipográficas pueden variar según el dispositivo. El servidor estático sigue siendo suficiente; no hay instalación ni compilación para jugar.

La telemetría remota opcional conserva su configuración; no es una dependencia para ejecutar los juegos localmente. Campaign y el laboratorio histórico de animación quedan fuera de esta entrega.
