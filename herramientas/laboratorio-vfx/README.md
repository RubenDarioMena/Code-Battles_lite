# Laboratorio VFX

Fase 4, paso 1. Recetas aisladas de War, sin conectar las vistas ni cambiar
reglas, API, textos o guardado del juego. No lee ni escribe almacenamiento.
El laboratorio no está en la lista de Netlify ni en la cáscara de escritorio.
No añade dependencias; usa el Three r128 local de `shared/vendor/`.

## Abrir

Desde la raíz del repositorio:

```sh
python3 -m http.server 8771 --bind 0.0.0.0
```

Abrir `http://localhost:8771/herramientas/laboratorio-vfx/`.
Desde un teléfono en la misma Wi-Fi, cambiar localhost por la IP del equipo.
`?receta=impacto&calidad=medio` fija la muestra; `&idioma=en` usa inglés.
Los textos del laboratorio tienen catálogos propios ES/EN en
`textos.js` (en esta carpeta, que no se publica), sin cargarse en el juego.

Selector de las nueve recetas, pausa, repetir, 1×/0,25×, cuatro calidades,
barra de tiempo y contador de partículas/ms de CPU **solo de particulas()**.
La CPU incluye su evaluación y presupuesto; no incluye anotar, dibujar ni GPU.
Si falla WebGL se muestra el error y la herramienta de hojas falla explícitamente.

Las vistas usan metros del juego, mapa 32×18, cámara War 38°/33 m y pitch .93.
Se leen los tokens CSS efectivos del mismo tema y `base.css` que el juego
(las definiciones están en `paquetes/editor/estilos/tema.css`). El radio se
inyecta desde la entrada pública `reglas-war.MISIL.radio`, nunca en `vfx`.
Un testigo de 1 m y su selección permiten juzgar si el efecto los tapa.

La hoja muestra 0,04/0,1/0,2/0,35/0,6/1/1,4 s, arriba 3D y abajo plano.
Son **recortes 1:1, sin ampliar** de lienzos 640×400 a la escala de mapa del
juego; la hoja completa mide 1540×440 px. La barra permite revisar tiempos
intermedios. Pausar en un instante no altera la forma de las partículas.

## Generar hojas (lo ejecuta el autor)

Requiere Node, las dependencias npm instaladas, Chromium de Playwright
(`npx playwright install chromium`, si falta) y el servidor anterior activo.
La herramienta no inicia el servidor ni Electron.

```sh
node herramientas/vfx-hojas.mjs --salida /tmp/vfx-hojas
# Opcionales:
node herramientas/vfx-hojas.mjs --origen http://127.0.0.1:8771 --salida /tmp/vfx-hojas --calidades alto,medio,bajo,no
```

Por defecto genera **36 PNG**: un PNG por receta en cada carpeta de calidad,
con 3D y plano juntos. `resumen.json` incluye receta/calidad/ruta, máximo de
partículas, media y máximo de ms y número de muestras (161 tiempos de 0 a
1,6 s con 5 calentamientos). Son medidas de CPU de este navegador/equipo,
no FPS ni rendimiento real de teléfono. Solo se permiten solicitudes al
origen elegido; no necesita CDN. Errores de página/consola o de WebGL fallan
la ejecución. `?captura=1` pausa el laboratorio para automatización.

API de QA: `globalThis.laboratorioVfx` ofrece `listo`, `error`, `nombres`,
`instantes`, `configurar(receta,calidad)`, `ir(t)`, `hoja()` y
`medir(receta,calidad)`. No comparte ningún estado con el juego.

## Verificación sin navegador

`node pruebas/vfx-laboratorio.mjs` (en `npm test`) ejecuta el arranque, los
controles, el rebobinado y las 36 combinaciones con DOM/canvas/renderizador
falsos y Three r128 real. Comprueba también recursos locales y paridad ES/EN.
Es una **emulación**, no comprueba shaders, rasterizado ni apariencia.

## Revisar las hojas

Distinguir impacto/fallo, boca del lanzador y dirección del cono; aro de
radio constante en todas las calidades; caída de restos a suelo sin deslizar;
humo breve y tenue; etiquetas/selección legibles. Comparar 3D/plano y alto/
medio/bajo/no sin que los destellos invadan el mapa. La inspección visual y
las medidas reales quedan pendientes del autor: no se ha lanzado navegador
en este paso. La integración con War es el paso 2, y la fase 4 sigue abierta.
