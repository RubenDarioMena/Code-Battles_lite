# Reglamento común de Factory y War

Decisiones aprobadas el 3 de noviembre de 2026. Las dos series comparten runtime y paso fijo de 0,05 s. Cada máquina programable tiene su programa JavaScript en un worker. Bloques y seudocódigo son vistas de ese texto; un programa que no se puede representar conserva su JavaScript.

## Tiempo y órdenes

| Clase | Operaciones | Efecto |
| --- | --- | --- |
| Encargo | Factory: `await pickUp(lugar, material)`, `await deliver(lugar)`, `await wait(segundos)` | El programa espera al viaje y la operación. Las otras máquinas siguen funcionando. |
| Modo | War: `regularShoot`, `burstFire`, `stopFire` | Configura al instante el lanzador, que sigue operando mientras su programa espera. No necesita `await`. |
| Lectura | Factory: `count`; War: `autoTarget`, `detect` y propiedades | Consulta la instantánea actual sin avanzar tiempo. |
| Espera | War: `await esperar(segundos)` | Permite avanzar a la simulación mientras siguen funcionando los lanzadores y reparadores. |

El reloj avanza cuando todos los programas han cedido el control a una espera o encargo. `await` sincroniza el programa con la simulación; un bucle que solo consulta no deja avanzar el mundo. `await` delante de una lectura sigue aceptado sin aviso y no consume tiempo de juego.

Dar otro encargo mientras sigue pendiente uno sin `await` conserva el diagnóstico de Factory con sus líneas. Permanecen los límites contra bloqueo: 500 lecturas consecutivas para el robot, 4000 mensajes sin esperar para lanzadores y vigía de 2,5 s reales para programas que no ceden control. El vigía es protección del runtime, no una regla de azar o tiempo de juego.

## Robot y materiales

| API principal | Alias compatible | Resultado |
| --- | --- | --- |
| `pickUp(lugar, material)` | `recoger` | `ok`, `viaje_vacio` o `manos_llenas` |
| `deliver(lugar)` | `entregar` | `ok`, `lleno`, `rechazado` o `manos_vacias` |
| `wait(segundos)` | `esperar` | `ok`; admite más de 0 y hasta 60 s |
| `count(lugar, material)` | `cuantos` | Número de piezas o `null` |

Se puede escribir `pickUp(ENT_1, "cobre")`, `yo.pickUp(...)` o el programa antiguo `yo.recoger("ENT-1", "cobre")`. Las máquinas se exponen como variables sustituyendo guiones por guiones bajos; también pueden guardarse en una variable del programa. Los identificadores que no sean nombres JS válidos, colisionen o coincidan con la API se usan como texto.

`count` devuelve **0** si el edificio existe y no tiene ese material; **null** si el edificio no existe. Un material desconocido sigue siendo error. En bodegas cuenta el stock; en máquinas cuenta la entrada pendiente, sin incluir la pieza que se está procesando. No hay destrucción de edificios en Factory.

Si el destino está lleno, `deliver` devuelve `lleno` y el robot conserva la pieza y su procedencia. Si no acepta el material, devuelve `rechazado` y también conserva la pieza. Ambos suman una entrega rechazada. No hay derrame ni pérdida implícita; se puede esperar, elegir otra máquina o devolver la pieza a una bodega. «Sin entregas rechazadas» sustituye a «Sin derrames»; al importar escenarios, `maxDerrames` se interpreta como `maxRechazos`.

En War, `null` de `autoTarget` o `detect` significa que no se encontró objetivo. Los modos, propiedades, munición, reparación y resultados de War mantienen su comportamiento anterior.

## Metas, intentos y guardado

Se gana cuando se cumplen las metas del mundo, aunque quede código o un bucle continuo. Los límites del reto siguen vigentes. Si Factory agota el programa antes de completar las metas, queda incompleto. Su límite general continúa siendo 300 s; War conserva 400 s.

Factory mejora el tiempo; War, el coste por derribo. Los récords Factory incluyen la versión de reglas `comun-v1` y no compiten con los del oráculo original. El stock por intento conserva su secuencia determinista; War conserva su RNG con semilla.

La aplicación importa una sola vez los programas de `cmg-banco02:*` a claves `cmg-banco03:prog-factory-*`, sin escribir en el banco original. Factory registra telemetría local; War conserva la telemetría remota. La comparación histórica y los cambios esperados están en `pruebas/factory-oraculo.md` y las pruebas comunes.
