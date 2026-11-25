# P1 · Esqueleto y paridad

Las Batallas B1–B5 pasan por el reglamento `campaign-v2`. En las diez partidas de referencia coinciden el SHA-256 de todas las instantáneas, el número de pasos y el resultado completo. Las referencias siguen siendo las de trunk.

## Archivos tocados

- `paquetes/reglas-campaign-v2/` contiene el contrato, la creación del reglamento con War inyectado, el validador, el manifiesto, las recetas y los seis módulos del Nivel 1.
- `paquetes/app/juego/campaign-v2.js` resuelve la URL y los retos. `estado.js`, `arranque.js`, `ciclo-programas.js`, `vistas.js` e `interfaz/info-reto.js` conectan la partida V2 con los programas y las vistas de War.
- `paquetes/app/index.js`, `index.d.ts` y su README recogen la entrada de composición. `paquetes/README.md`, `pruebas/fronteras.mjs` y `package-lock.json` registran el paquete.
- `pruebas/campaign-v2-{paridad,contenido}.mjs` y `todas.mjs` cubren las partidas y el contenido. `juego-adaptador.mjs` y `juego-arranque.mjs` comprueban la conexión con la app.
- `PLAN-PORCIONES.md` y `PROGRESO.md` registran el cierre de P1.

## Cómo se prueba

- `node pruebas/campaign-v2-paridad.mjs` ejecuta los programas de cada reto con el intérprete y las semillas 1 y 7.
- `node pruebas/campaign-v2-contenido.mjs` recorre las carpetas de niveles, juega cada hito sin vista y prueba contenido inválido y una Batalla con datos propios.
- `node pruebas/juego-arranque.mjs` ejecuta las tres URL de V2 en 2D y 3D con DOM y GPU emulados. `node pruebas/fronteras.mjs` cubre los 15 paquetes.
- `node pruebas/todas.mjs` dio **65 ok, 7 falla, 0 omitida**. Son los siete fallos de la línea base por dependencias ausentes.
- Pasaron la comprobación de tipos de los paquetes con un TypeScript local existente y `node --check` de los módulos tocados. `git diff --stat -- paquetes/reglas-war` salió vacío.

## Suposiciones

- El primer nivel se identifica como `nivel-1`, revisión 1. Su marco se declara en metros y las vistas actuales reciben las coordenadas locales de War.
- La partida guarda el modo como `campaign`, `ensayo` o `paridad`. Si la URL combina ensayo y paridad, prevalece paridad.
- Una Batalla propia describe el reto normalizado junto a `clave`. Para B1–B5, paridad conserva el reto original al sustituir la referencia por datos propios.
- La pantalla heredada guarda los programas e intentos de V2 en su propio espacio de almacenamiento. Su escenario editable se abre como ensayo.

## Faltantes

- El entorno denegó abrir el puerto 8771 (EPERM). La prueba de navegador `vista-caliente` quedó sin ejecutar en navegador real.
- Los tipos del proyecto completo requieren las dependencias de Electron, Steam y Playwright.
- Fábrica, suministro, checkpoints y referencias adicionales de victoria y atasco corresponden a P2. Eventos, escenario 3D y mecánicas nuevas corresponden a P3–P5.
