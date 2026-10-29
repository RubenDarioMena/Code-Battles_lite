# Code Battle Lite

Juegos de programación para escritorio y móvil con una entrada común: **Factory** (Tres vistas), **War** (Rocket Launcher) y **Campaign** (próximamente). Factory programa un robot de recogida con bloques, seudocódigo o JavaScript; War controla lanzadores con JavaScript o seudocódigo.

## Ejecutar

Desde esta carpeta, sin instalar paquetes ni compilar:

```bash
python3 -m http.server 8770 --bind 0.0.0.0
```

- [Entrada común](http://localhost:8770/).
- War / Rocket Launcher: [abrir defensa](http://localhost:8770/Prototypes/Rocket%20Launcher/).
- Factory / Tres vistas: [abrir recogida](http://localhost:8770/Prototypes/Tres%20vistas/). El enlace anterior `Prototypes/02_tres_vistas.html` redirige aquí conservando los parámetros.
- Cada carpeta incluye `probar.html` para ver teléfono y PC a la vez.
- Para probar desde otro dispositivo de la misma Wi-Fi: `http://IP-DEL-EQUIPO:8770/`.
- Recarga después de editar. El servidor debe permanecer abierto.
- `?forma=movil` y `?forma=escritorio` fuerzan el formato; `?marco=1` activa el teclado simulado del probador.

Alternativa con PowerShell y recarga automática, en localhost:

```powershell
pwsh -NoProfile -File ./server.ps1 -Root "." -Port 8770 -NoBrowser
```

Sirve la entrada y ambos juegos. Mantén como raíz la carpeta completa: los juegos usan los recursos de `shared/`. PowerShell sigue pendiente de comprobación en Windows.

Ambos prototipos cargan Acorn 8.11.3 y las fuentes Archivo/JetBrains Mono desde CDN. Rocket Launcher también usa Three.js r128. Se necesita conexión para cargarlos; todavía no son aplicaciones offline.

## Estructura

Cada prototipo vive en su propia carpeta bajo `Prototypes/`, con `index.html`, `probar.html`, `css/` y `js/`. Las rutas de esta tabla son relativas a la carpeta del prototipo:

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Mapa, editor, inspector, Ajustes y diálogos. |
| `js/juego.js` | Retos, simulación de paso fijo, programas en Web Workers, dibujo del mapa, selección y editor. |
| `js/layout.js` | Distribución, divisor, preferencias, teclado móvil, barra de símbolos y tooltips. |
| `js/iconos.js` | Solo Factory: iconos de recogida que complementan los compartidos. |
| `js/seudo.js` | Solo Rocket Launcher. Seudocódigo ES/EN traído de Tres vistas: traducción JavaScript ↔ árbol, renglones editables, ladrillos y arrastre. |
| `css/base.css` | Colores, tipografía y apariencia común. |
| `css/componentes.css` | Estilos de componentes. |
| `css/layout.css` | Reparto y adaptación a pantalla/teclado. |
| `probar.html` | Probador con marcos de dispositivos y teclado simulado. |

Los módulos `shared/js/iconos.js`, `shared/js/estructura.js` y `shared/js/edicion.js`, y el estilo `shared/css/edicion.css`, sirven a ambos juegos. La estructura analiza código incompleto; edición mantiene fichas, sugerencias, asas, barra reordenable e historial por documento. Factory aporta sus sugerencias, su adaptador del árbol y capturas completas para deshacer sin perder la sincronía. Las claves de preferencias de Factory y War permanecen separadas.

En la raíz: `index.html` es la entrada; `campaign/` muestra el anuncio; `server.ps1` es el servidor opcional y `pruebas/` contiene las pruebas. `02_tres_vistas.html` en la raíz es la referencia histórica sin adaptar; la entrada vigente está en `Prototypes/`.

Las simulaciones usan cuadrícula y paso fijo; defensa conserva su RNG con semilla y recogida su secuencia de stock por intento. El código del jugador se instrumenta con Acorn y se ejecuta en Web Workers. `window.cmg` comunica editor y layout; `window.__banco` expone herramientas de depuración/pruebas. Son interfaces existentes que se mantienen durante la separación.

## Comportamiento actual de Rocket Launcher

- Selección individual/múltiple y borradores con Add/Replace. Cerrar el inspector conserva la selección. Los borradores sin aplicar duran durante el reto y la sesión.
- Cuadro de selección: arrastre con el botón izquierdo en PC; en táctil, doble toque en el suelo y arrastrar con el segundo toque.
- Cada máquina toma el color de su función principal (provisional). Sin seleccionar muestra un halo difuso; seleccionada, un círculo nítido y su nombre. `?poc=1` abre el selector de paleta, halo, brillo e intensidad.
- Doble clic selecciona cadenas o comentarios `/* … */`. Los elementos envolventes rodean el código seleccionado con bloques, llamadas o pares de símbolos.
- Modo sin teclado: el botón del teclado (junto a la letra en PC, primero de la barra de edición en el teléfono) se tacha en rojo y muestra el código como fichas sin abrir el teclado. Un toque elige un elemento entero (textos con comillas, comentarios completos); el doble toque amplía hasta el siguiente límite semántico. Los valores arrastrados se copian sobre un hueco, un argumento o dentro de `( )`/`[ ]`; las líneas se mueven por el número o por un asa en el borde derecho (Ajustes). El modo se recuerda por dispositivo.
- Al elegir un hueco `/* … */`, un argumento vacío o (sin teclado) un valor de una llamada conocida aparece la lista de valores posibles: tipos, sensores, lugares, propiedades y operadores, según los datos de la máquina. Elegir uno pasa al siguiente hueco de la línea.
- Barra de edición (deshacer, rehacer, cortar, copiar, pegar, borrar, ampliar/reducir selección, duplicar, subir/bajar, línea nueva): fija bajo la paleta en el teléfono; en PC con el modo sin teclado o el seudocódigo. Sin contexto seguro (IP de la red local) pegar usa lo último copiado en el juego. Ajustes → «Ordenar botones y grupos…» cambia el orden de grupos y botones arrastrándolos.
- La paleta y la barra de edición ocupan una línea cada una y se deslizan (con ratón, la rueda las mueve). En el teléfono la consola empieza cerrada: solo queda su asa.
- Seudocódigo (botones JS/Seudo junto a la letra o Ajustes → Lenguaje del programa, en español o inglés): el mismo programa como frases con valores que se eligen, ladrillos que se tocan o arrastran y la barra de edición sobre el renglón elegido. Se guarda y ejecuta como JavaScript; lo que aún no tiene seudocódigo se queda en JavaScript con un aviso.
- Mantener pulsado un atajo con la esquina marcada (o clic derecho) abre sus variantes: while/for/do…while/break, if/if-else/else if, operadores, `let`/asignación y niveles de `console`.
- Ajustes ofrece distribución automática o fija; posiciones del mapa independientes para izquierda/derecha y arriba/abajo, con vistas previas.
- El divisor permite ocupar toda la pantalla con uno de los paneles y recuperar el otro mediante el asa.
- Al escribir en móvil se prioriza la paleta. Las barras auxiliares se pliegan juntas; su botón flota con borde rojo. Las coordenadas manuales se activan en Ajustes.
- La ficha móvil permite recorrer las estadísticas manteniendo visible únicamente el cierre.
- El idioma alternativo de la interfaz y Python siguen deshabilitados; el seudocódigo ES/EN ya está disponible.
- La traducción conserva `let`/`const`/`var`, las reasignaciones y el nombre y alcance del contador de un `for`. Bloques independientes, comparaciones con coerción (`==`/`!=`) y llamadas calculadas no representables se conservan en JavaScript con aviso.

## Factory / Tres vistas

- Conserva los seis retos de recogida, el reto propio y la API `yo.recoger`, `yo.entregar`, `yo.esperar` y `yo.cuantos`.
- Bloques y pseudocódigo comparten un árbol editable, con paletas propias EN/ES, valores seleccionables y arrastre. JavaScript conserva el texto libre, la traducción del subconjunto admitido y la confirmación antes de descartar texto no traducible.
- Interfaz de Rocket Launcher: marcos, paneles ajustables y reordenables, herramientas plegables, inspector desplazable con cierre fijo y consola móvil plegable. El mapa conserva el plano 2D de este prototipo.
- JavaScript incluye los controles de edición de War: modo sin teclado, selección semántica, arrastre de valores/líneas, asas configurables, sugerencias de edificios/materiales/sensores, variantes por pulsación larga y barra reordenable. Al escribir en móvil aparece la barra de símbolos.
- La barra común sirve también a bloques y seudocódigo: cortar, copiar, pegar, borrar, duplicar, mover y ampliar/reducir la selección. Deshacer/rehacer recupera modelo y texto juntos, con historial por reto durante la sesión. Las filas de seudocódigo usan placas y chips como War.
- Se guarda la última edición al cambiar de reto o abandonar el juego para volver al inicio. Las barras ocupan una línea y la consola móvil empieza cerrada.
- Ajustes permite elegir el modo, el idioma de los bloques, el tamaño de letra y la distribución. En teléfonos bajos, idioma y letra quedan en Ajustes, y la consola espera a desplegarse. Las preferencias de pantalla usan `cmg-banco02-ui-*`; los programas, retos y registros conservan `cmg-banco02:*`.

## Preparar Netlify

El repositorio incluye `netlify.toml`. Para conectar el repo en Netlify, usa la raíz del repositorio como base; el comando es `node scripts/preparar-netlify.mjs` y el directorio publicado es `dist`. No requiere `npm install` ni backend. El comando usa Node.js 22 y copia una lista permitida: entrada, Campaign, ambos juegos, recursos compartidos y el enlace heredado del prototipo.

Para una subida manual o una revisión local del paquete:

```bash
node scripts/preparar-netlify.mjs
node pruebas/publicacion.mjs
```

Sube el **contenido de `dist/`**. La carpeta es generada e ignorada por Git. No incluye el laboratorio de animación, sus dependencias, documentos, pruebas ni metadatos del repositorio. Incluye una página 404; conserva las URL existentes bajo `Prototypes/`. No hay una redirección global de SPA que oculte recursos ausentes.

La preparación no publica nada. Al cambiar a un dominio Netlify, localStorage empieza separado del origen local: aún no existe importación/exportación de programas. Los CDN siguen requiriendo conexión.

## Verificar

```bash
node pruebas/interaccion.cjs
node --check "Prototypes/Rocket Launcher/js/juego.js"
node --check "Prototypes/Rocket Launcher/js/layout.js"
node --check shared/js/iconos.js
node --check shared/js/estructura.js
node --check shared/js/edicion.js
node --check "Prototypes/Rocket Launcher/js/seudo.js"
node --check "Prototypes/Tres vistas/js/juego.js"
node --check "Prototypes/Tres vistas/js/layout.js"
node --check "Prototypes/Tres vistas/js/iconos.js"
node --check pruebas/navegador.mjs
node --check pruebas/tres-vistas.mjs
node --check pruebas/factory-editor.mjs
node --check pruebas/entrada.mjs
node --check scripts/preparar-netlify.mjs
node --check pruebas/publicacion.mjs
```

Para la suite de navegador usa otro puerto, porque modifica programas y preferencias del origen de prueba:

```bash
python3 -m http.server 8771 --bind 127.0.0.1
```

En otra terminal, con Ego Browser instalado y desde esta carpeta:

```bash
ego-browser nodejs <<'JS'
const task = await taskSpace("Code Battle Lite QA " + Date.now());
const { probar } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/navegador.mjs");
const { probarTresVistas } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/tres-vistas.mjs");
const { probarFactoryEditor } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/factory-editor.mjs");
const { probarEntrada } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/entrada.mjs");
await probar(task.page("p1")); // War / Rocket Launcher
await probarTresVistas(task.page("p1"));
await probarFactoryEditor(task.page("p1"));
await probarEntrada(task.page("p1")); // generar dist/ primero
await task.finish({ keep: [] });
JS
```

Adapta la ruta del import si mueves el proyecto. El teclado simulado no sustituye probar teclado real, selección táctil e inspector en Android y Safari/iPhone. Al modificar CSS/JS incrementa su versión `?v=N` en el `index.html` correspondiente.

Para evaluar la recuperación del editor sin teclado de Rocket Launcher, consultar [el ciclo, la matriz de 10 intentos y el prompt para el agente](docs/CICLO-RECUPERACION-EDITOR.md). El arnés externo de `pruebas/recuperacion-editor.mjs` introduce perturbaciones con semilla mediante clics reales en el origen 8771, exporta evidencia detallada solo ante incidencias y admite contadores de tokens. Su calibración sintética se ejecuta con `probarArnes(page)` de `pruebas/recuperacion-harness.mjs`; no sustituye el piloto sobre la nueva UI.

## Origen y continuidad

Separado el 28 de octubre de 2026 del juego HTML de Codemageddon. Se copió el estado real del worktree `agente/codex/revision-html`, incluidos cambios sin commit y las pruebas nuevas. La base publicada de origen era `259ac33`.

El directorio no depende de otras carpetas de Codemageddon. Se dejaron fuera Godot, demos antiguas, modelos, imágenes no utilizadas, logs generales, dependencias instaladas y metadatos Git del origen. El repositorio propio es [RubenDarioMena/Code-Battles_lite](https://github.com/RubenDarioMena/Code-Battles_lite), en la rama `main`.

Las claves locales heredadas (`cmg-banco03`, `cmg-juego-*`, `cmg-probar-*`) se conservan para evitar un cambio de formato de guardado durante la migración. El almacenamiento depende del origen: los datos de `:8769` no aparecen automáticamente en `:8770`. El proyecto aún no incorpora una transferencia de esas preferencias y programas.

Consulta [PROGRESO.md](PROGRESO.md) para la sesión y la migración, [docs/VISION.md](docs/VISION.md) para el alcance y [AGENTS.md](AGENTS.md) para trabajar en el código.
