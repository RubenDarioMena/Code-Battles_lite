# protocolo

Estado: fase 1.

Contrato de datos entre el mundo, las vistas y los controladores. Módulo ES sin
imports ni dependencias de ejecución. Funciona en Node y navegador. Los tipos
están en `index.d.ts`; no requiere compilación.

## Exportaciones

- `ORIGENES`: arreglo congelado `['programa', 'jugador', 'sistema']`.
- `esDatoPlano(valor)`: indica si el valor es dato plano.
- `validarOrden(o)`, `validarSuceso(s)`, `validarInstantanea(i)`: devuelven
  cadenas de error en español con la ruta del campo. Un arreglo vacío indica
  validez. No modifican los mensajes.
- Tipos: `Origen`, `DatoPlano`, `Orden`, `Suceso`, `Instantanea`, `Vista`.
  `Vista` (fase 2, paso 12) es el contrato común de dibujo, sucesos, elección,
  proyección, tamaño y destrucción; admite escenas visibles además de instantáneas.
  Es solo un tipo, sin dependencia de DOM ni cambio de los mensajes.
- `canonico(valor)` (fase 2): JSON canónico con claves ordenadas, arreglos en
  orden y números sin redondear. Base de las huellas de partida (antes en
  `herramientas/partida/huella.mjs`, que ahora la reexporta). Es autocontenida:
  el contraste del navegador la copia por su texto.

## Mensajes

Una orden contiene `{ paso, origen, unidad, verbo, args }` y admite `ref` opcional:
`paso` es entero ≥ 0; `origen` pertenece a `ORIGENES`; `unidad` y `verbo`
son cadenas no vacías; `args` es un arreglo de datos planos.
`ref`, si está, es una cadena no vacía: referencia del emisor que el reglamento
devuelve en la respuesta.

Un suceso contiene `paso` (entero ≥ 0) y `tipo` (cadena no vacía).
Admite únicamente dos campos opcionales: `unidad` (cadena no vacía) y
`datos` (objeto plano cuyos valores son datos planos). Es un hecho para ver
y oír; ninguna regla ni programa lo lee.

Una instantánea es un objeto plano de datos planos con `t`, número finito ≥ 0.
Las demás claves son libres y las define cada reglamento.

## Dato plano

`null`, booleanos, cadenas, números finitos, arreglos y objetos planos,
recursivamente y sin ciclos. Las referencias compartidas sin ciclos son válidas.
Un objeto plano tiene prototipo nulo o un prototipo cuyo propio prototipo es
nulo; se admiten objetos de otros reinos. Una propiedad de objeto con valor
`undefined` se admite y cuenta como ausente (JSON la omite; la instantánea de
Factory la tiene). Se rechazan `undefined` suelto o en arreglos, funciones,
símbolos, bigint, números no finitos, mapas, fechas e instancias de clase.
También se rechazan huecos de arreglos, propiedades con clave símbolo y
accesores; se inspeccionan propiedades propias sin ejecutar sus accesores.

Los tipos describen la estructura; las restricciones de finitud, ciclos,
prototipos y claves se comprueban con los validadores en ejecución.

## Imports y pruebas

No importa nada. Véanse las reglas de [paquetes](../README.md).
Las pruebas usan únicamente módulos `node:*` desde `pruebas/`:

```sh
node paquetes/protocolo/pruebas/protocolo.mjs
node pruebas/fronteras.mjs
npm run tipos
npm test
```

Cubren mensajes válidos e inválidos, rutas de error, ciclos, otros reinos,
serialización JSON y clonación estructurada. La suite forma parte de `npm test`.
