# Paquetes de Code Battle Lite

Un paquete es una carpeta con manifiesto, README de contrato, entrada pública
`index.js` y pruebas propias. En la fase 0 solo había manifiesto y contrato;
la fase 1 ya tiene entradas públicas de `protocolo`, `nucleo`, `reglas-war` y
`reglas-factory` y `reglas-campaign`.

El porqué y las tres fronteras están en [Arquitectura objetivo](../docs/PLAN-ARQUITECTURA.md#arquitectura-objetivo).
Los contratos son orientativos: los nombres definitivos los fija la fase 2.

## Dependencias permitidas

| Paquete | Puede importar |
| --- | --- |
| `protocolo` | Nada |
| `nucleo` | `protocolo` |
| `reglas-war` | `nucleo`, `protocolo` |
| `reglas-factory` | `nucleo`, `protocolo` |
| `reglas-campaign` | `nucleo`, `protocolo` |
| `reglas-campaign-v2` | `nucleo`, `protocolo` |
| `lenguaje` | Nada |
| `interprete` | Nada (Acorn inyectado por opciones) |
| `anfitrion` | `nucleo`, `protocolo`, `lenguaje`, `interprete` |
| `editor` | `lenguaje` |
| `vfx` | `protocolo` |
| `vista-2d` | `protocolo`, `vfx` |
| `rig` | Nada |
| `vista-3d` | `protocolo`, `vfx`, `rig` |
| `interfaz` | `protocolo`, `editor` |
| `app` | Todos |

## Imports

Entre paquetes solo se admite la entrada pública mediante ruta relativa exacta:
`../nucleo/index.js` (desde una subcarpeta como `pruebas/`, `../../nucleo/index.js`). No se admiten especificadores desnudos entre paquetes,
archivos internos, alias, sufijos de consulta ni rutas alternativas. Esto funciona
en navegador y Node sin compilación ni mapa de imports entre paquetes.
Los imports relativos internos están permitidos. `import()` exige cadena literal.

Los terceros usan especificadores desnudos y un futuro mapa de imports:
`acorn` y `@lezer/python` solo en `lenguaje`; `three` solo en `vista-3d`.
La fase 0 no los conecta. La tabla está en `pruebas/fronteras.mjs`.
Cualquier otro especificador queda prohibido; `node:*` solo se permite en
la carpeta `pruebas/` de cada paquete.

## Entorno y determinismo

En `protocolo`, `nucleo`, `reglas-*`, `lenguaje`, `interprete` y `vfx` no se permiten APIs de
navegador ni Three.js. Deben funcionar en Node sin simulación del navegador.
La comprobación detecta APIs de navegador: `window`, `document`, almacenamiento web,
`requestAnimationFrame`, `THREE`, `setTimeout`, `setInterval`, y accesos a
`performance.now`, `Date.now`, `new Date` y `Math.random`.
Se prohíben ambos temporizadores también en núcleo y reglas para mantener
el paso fijo y el determinismo. Las pruebas propias quedan exentas del entorno.

## Comprobación

`node pruebas/fronteras.mjs` analiza imports y sintaxis real con Acorn vendorizado,
sin dependencias npm; ignora cadenas y comentarios para las prohibiciones de entorno.
Forma parte de `npm test`, junto con `pruebas/fronteras-autoprueba.mjs`.
`--raiz <dir>` permite comprobar otro árbol mínimo con carpeta `paquetes/`.
Las infracciones salen como `archivo:línea · regla · detalle` y código 1.
Esta barrera estática no sustituye las pruebas de contratos y paridad del plan.

`interprete` ejecuta ESTree con presupuesto y cola de trabajos propios. Su [contrato](interprete/README.md) incluye aislamiento de intrínsecos, pausas y pruebas contra V8. En fase 5/paso 2 solo lo usan las herramientas; la dependencia permitida de `anfitrion` se activará en el paso 3. El comprobador prohíbe además todo uso de `Date`, `performance` y canceladores de temporizadores en este paquete.
