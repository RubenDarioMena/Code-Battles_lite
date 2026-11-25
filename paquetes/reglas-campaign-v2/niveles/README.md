# Añadir una Batalla

1. Crea `nivel-1/bN.js` con un objeto exportado por defecto y `clave: "bN"`.
2. Para usar un reto original añade `war` con su número de 1 a 5.
3. Para una Batalla propia pon los campos del reto normalizado junto a `clave`. Omite `war`.
4. En `nivel.js` reexporta el módulo con su clave y añade la clave a `hitos` en la posición deseada.
5. Ejecuta `node pruebas/campaign-v2-contenido.mjs` y `node pruebas/campaign-v2-paridad.mjs`.
6. Abre `?serie=campaign-v2&ensayo=bN` en la aplicación de Rocket Launcher.
