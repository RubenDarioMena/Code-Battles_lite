# P4b · UI del primer hito

Campaña y ensayo comparten Misión, el menú de checkpoints y las metas en vivo. En Batalla el árbol selecciona las mismas unidades que el mapa y muestra los vínculos. La ficha completa gira el GLB de la torreta o la primitiva de su clase junto a sus estadísticas. Las barras sobre los enemigos usan la vida de War. El plano emplea iconos vectoriales y el SVG de la prensa.

## Archivos

- Pantalla en `Prototypes/Rocket Launcher/{index.html,css/campaign-v2.css,img/campaign/maquinas/svg-b/prensa.svg}` y textos en `shared/i18n/campaign-v2/nivel-1.js`.
- Composición y guardado en `paquetes/app/juego/{campaign-v2,ciclo-programas,iniciar,programas,vinculos-v2,vistas}.js`.
- HUD y panel en `paquetes/interfaz/{etiquetas,hud-hito,info-reto,layout,layout-panel,maquinas,panel-hito,index}.js`, contrato y prueba pública.
- Plano en `paquetes/vista-2d/{campaign,iconos-hito,war,index}.js` y contrato. Cámara y retrato en `paquetes/vista-3d/{camara,cv2/index,cv2/ficha,cv2/paisaje,index}.js`, contrato y prueba pública.
- Pruebas en `pruebas/{campaign-v2-ui,campaign-v2-escena-three,juego-arranque,juego-dom,todas}.mjs`. Documentación en los README de los cuatro paquetes, spec del editor, BUG-0001 e índice, plan de porciones e historial.

## Verificación

- `node pruebas/todas.mjs` dio **80 ok, 7 falla, 0 omitida**. Fallos de base: vfx-dibujantes, medir-carga-node, publicables, steam-empaquetado, steam-vdf, globales-juego y juego-identificadores.
- `node pruebas/campaign-v2-ui.mjs` acciona el árbol y el mapa, edita en JS y Python, separa una copia y restaura las fuentes vinculadas desde ⋯. Recorre H0 y B1, cambia de idioma y comprueba la tira de War.
- `node pruebas/three-r180.mjs` carga los GLB reales. En 900 × 530 y 375 × 812 comprueba la proyección del campo, la entrada y los bastiones. También verifica el giro y la pausa del retrato. Se revisaron imágenes de la geometría proyectada y los iconos rasterizados por software.
- `git diff -- paquetes/reglas-war pruebas/referencias/partidas.json` quedó vacío respecto al índice.

## Suposiciones

- El árbol incluye aliados y enemigos presentes. Solo las unidades programables aportan documentos a la edición común. Una selección con un programa editado y plantillas iniciales conserva el editado. Si ya hay fuentes editadas distintas, el borrador mixto permite resolverlas explícitamente con Add o Replace.
- En ensayo, volver restaura el inicio de la batalla actual. En campaña, la última frontera es la opción inicial y la casilla permite recuperar sus programas y vínculos.
- H0 carece de editor y su ajuste disponible es la vista del mapa. El móvil adopta pantalla completa cuando aún no hay preferencia guardada.

## Comprobaciones visuales pendientes

Servir este worktree desde la raíz con `python3 -m http.server 8771 --bind 127.0.0.1`. Para comprobar el valor móvil por defecto, usar un perfil de QA sin preferencias de pantalla.

- [ ] PC · Abrir Misión, comprobar la pista de ambos clics y arrancar. Ver los tres bastiones, la entrada por el este, las cuatro metas y las barras al alternar Plano, 3D y Batalla. Abrir la ficha de la torreta y la de una oruga. [B1](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&ensayo=b1).
- [ ] PC · Marcar Torretas, editar, seleccionar solo LAU-02 en el campo y desvincularla. Confirmar que LAU-01 conserva su texto. [B5](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&ensayo=b5).
- [ ] PC · Observar la prensa y la bodega en Plano, leer Misión y esperar a B1. Desde ⋯ elegir H0 y recuperar la frontera. [Campaña](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2).
- [ ] Móvil · Fijar 375 × 812, pasar del mapa al código y desplegar el árbol. Verificar que todas las casillas son alcanzables, que el selector cabe entre ! y ⋯, y que las metas y la ficha se leen en ES y EN. [B5 móvil](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&ensayo=b5&forma=movil).
- [ ] PC y móvil · Confirmar que se mantienen las tarjetas de programas y la disposición habitual. [War](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=war).

## Faltantes

El entorno rechazó abrir el puerto 8771 y el arranque de Ego Lite. La disposición CSS final y el aspecto con GPU quedan para la lista visual. El enlace a `?pruebas=1` está preparado y oculto hasta P5. En la comprobación adicional de TypeScript persisten las dependencias locales ausentes y los dos diagnósticos previos sobre `mundo.hito`.
