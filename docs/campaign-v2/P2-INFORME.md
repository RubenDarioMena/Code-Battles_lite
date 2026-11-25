# P2 · Fábrica, puente y checkpoint

H0 empieza con una prensa junto a la bodega. El plano 2D de Campaign muestra la producción y la meta. Al llegar a cuatro misiles se abre B1. La fábrica sigue trabajando durante B1–B5. Cada misil recargado descuenta una unidad de la bodega, incluso cuando dos torretas compiten por el último misil.

El checkpoint conserva la planta, las existencias, las posiciones, los programas, sus vínculos, las fuentes Python y la semilla de fábrica. La app guarda cada frontera en `campaign-v2-nivel-1` y las ediciones en otra clave. Tras perder se puede elegir hito y programas. Al cambiar de revisión, el nivel empieza en H0 con los programas actuales y un aviso en la consola.

## Archivos tocados

- `paquetes/reglas-campaign/{produccion.js,estado.js,mundo.js,index.js,index.d.ts,README.md}` contiene la producción compartida y el adaptador histórico.
- `paquetes/reglas-war/{index.js,index.d.ts,mundo.js}` añade el suministro por lanzador y su lectura al recargar.
- `paquetes/reglas-campaign-v2/{index.js,index.d.ts,fabrica.js,validar.js,README.md}` y `niveles/nivel-1/{h0,nivel}.js` componen el nivel.
- `paquetes/app/juego/{campaign-v2,checkpoints-v2,estado,iniciar,arranque,ciclo-programas,cierre-intentos,programas}.js`, `paquetes/app/{README.md,index.d.ts}` y `paquetes/interfaz/{info-reto,retos}.js` conectan la partida, el editor y los checkpoints.
- `Prototypes/Rocket Launcher/{index.html,js/servicios.js}` y `shared/i18n/campaign-v2/nivel-1.js` conectan el plano y los textos ES/EN.
- `herramientas/partida/casos.mjs`, `pruebas/referencias/partidas.json` y `pruebas/campaign-v2-{paridad,contenido,puente,secuencia,checkpoint}.mjs` cubren las referencias y los contratos.
- `pruebas/{todas,juego-arranque,juego-conductor,three-r180}.mjs` registra las pruebas, juega H0 → B1 → B2 en la app emulada y verifica la carga diferida de Three con el catálogo presente.
- `PLAN-PORCIONES.md`, este informe y `PROGRESO.md` registran la entrega.

## Cómo se prueba

- `node pruebas/todas.mjs` dio **68 ok, 7 falla, 0 omitida**. Los siete fallos de la línea base son vfx-dibujantes, medir-carga-node, publicables, steam-empaquetado, steam-vdf, globales-juego y juego-identificadores.
- Antes de editar War, `ejecutarReferencia` produjo con semilla 13 una victoria de B1 en 718 pasos y una derrota de B4 en 1004 pasos con cuatro atascos. V2 reproduce las 12 partidas de paridad. La comparación con HEAD confirma que los 41 casos previos del archivo y sus metadatos siguen idénticos.
- Las pruebas de Campaign H0–H5 pasan con sus referencias originales. Las nuevas comprueban el suministro con dos torretas, la continuidad, el checkpoint JSON, el cambio de revisión y la huella del intento restaurado frente al ensayo con el intérprete.
- Pasaron la frontera de imports y la comprobación de tipos de los paquetes con el TypeScript local disponible. Se revisó el dibujo de H0 rasterizando las operaciones del plano en Node, con la prensa en marcha y la bodega a 3/4.

## Suposiciones

- La tolva repone acero automáticamente. La prensa usa el ciclo de dos segundos de la receta de ojiva con salida de munición básica. La bodega conserva la capacidad de 40 de Campaign.
- La meta experimental son cuatro misiles. Un ensayo de batalla empieza con 16 salvo que el escenario fije las existencias. En una disputa simultánea por la última unidad prevalece el orden de lanzadores del reto.
- Entre hitos la pantalla deja la siguiente batalla lista para editar y ejecutar. Los vínculos se conservan como datos opacos.

## Faltantes

- P3 debe incorporar `semillaIntento` a la grabación completa. En P2 queda en el mundo de cada intento.
- El entorno denegó abrir el puerto 8771. El recorrido de la app se verificó con DOM y GPU emulados. Queda pendiente el contraste en navegador real.
