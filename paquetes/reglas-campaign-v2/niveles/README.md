# Añadir una Batalla

1. Crea `nivel-1/bN.js` con un objeto exportado por defecto y `clave: "bN"`.
2. Para usar un reto original añade `war` con su número de 1 a 5.
3. Para una Batalla propia pon los campos del reto normalizado junto a `clave`. Omite `war`.
4. En `nivel.js` reexporta el módulo con su clave y añade la clave a `hitos` en la posición deseada.
5. Ejecuta `node pruebas/campaign-v2-contenido.mjs` y `node pruebas/campaign-v2-paridad.mjs`.
6. Abre `Prototypes/Campaign-V2/?ensayo=bN`.

# Añadir un hito de fábrica

1. Crea `nivel-1/hN.js` con `clave: "hN"`, `fabrica: true`, `pistas` (número de pistas en el catálogo), `metas` y, si hace falta, `alEmpezar.entregas` (material que llega a la bahía).
2. Las metas son `en` (piezas en un lugar), `hechos` (piezas fabricadas), `lotes`, `tarima` o `banda`. Usa los IDs y piezas de `fabrica.js` y `fabrica/catalogo.js`.
3. Las unidades nuevas del hito van en `fabrica.js` con `desde: N`: aparecen al empezar ese hito.
4. En `nivel.js` reexporta el módulo y pon la clave en `hitos`, detrás de la Batalla que lo precede.
5. Añade a `shared/i18n/campaign-v2/nivel-1.js` (ES y EN) el título, el objetivo y las pistas: `campaign.hito.<índice entre los hitos de fábrica>.*`.
6. Ejecuta `node pruebas/campaign-v2-contenido.mjs` y `node pruebas/campaign-v2-fabrica.mjs`. Un hito de fábrica no tiene ensayo suelto: se abre desde su checkpoint en la campaña.
