# Code Battle Lite

Juegos de programación con interfaz para escritorio y móvil. Rocket Launcher permite controlar lanzadores con JavaScript; Tres vistas permite programar un robot de recogida con bloques, pseudocódigo o JavaScript.

## Ejecutar

Desde esta carpeta, sin instalar paquetes ni compilar:

```bash
python3 -m http.server 8770 --bind 0.0.0.0
```

- Rocket Launcher: [abrir defensa](http://localhost:8770/Prototypes/Rocket%20Launcher/).
- Tres vistas: [abrir recogida](http://localhost:8770/Prototypes/Tres%20vistas/). El enlace anterior `Prototypes/02_tres_vistas.html` redirige aquí conservando los parámetros.
- Cada carpeta incluye `probar.html` para ver teléfono y PC a la vez.
- Para probar desde otro dispositivo de la misma Wi-Fi: `http://IP-DEL-EQUIPO:8770/`.
- Recarga después de editar. El servidor debe permanecer abierto.
- `?forma=movil` y `?forma=escritorio` fuerzan el formato; `?marco=1` activa el teclado simulado del probador.

Alternativa con PowerShell y recarga automática, en localhost:

```powershell
pwsh -NoProfile -File ./server.ps1 -Root "./Prototypes/Tres vistas" -Port 8770 -NoBrowser
```

Esta alternativa sirve únicamente el prototipo elegido en `http://localhost:8770/`; cambia `-Root` para servir Rocket Launcher.

Ambos prototipos cargan Acorn 8.11.3 y las fuentes Archivo/JetBrains Mono desde CDN. Rocket Launcher también usa Three.js r128. Se necesita conexión para cargarlos; todavía no son aplicaciones offline.

## Estructura

Cada prototipo vive en su propia carpeta bajo `Prototypes/`, con `index.html`, `probar.html`, `css/` y `js/`. Las rutas de esta tabla son relativas a la carpeta del prototipo:

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Mapa, editor, inspector, Ajustes y diálogos. |
| `js/juego.js` | Retos, simulación de paso fijo, programas en Web Workers, dibujo del mapa, selección y editor. |
| `js/layout.js` | Distribución, divisor, preferencias, teclado móvil, barra de símbolos y tooltips. |
| `js/iconos.js` | Iconos SVG de la paleta. |
| `css/base.css` | Colores, tipografía y apariencia común. |
| `css/componentes.css` | Estilos de componentes. |
| `css/layout.css` | Reparto y adaptación a pantalla/teclado. |
| `probar.html` | Probador con marcos de dispositivos y teclado simulado. |

En la raíz: `server.ps1` es el servidor opcional y `pruebas/` contiene las pruebas. `02_tres_vistas.html` en la raíz es la referencia histórica sin adaptar; la entrada vigente está en `Prototypes/`.

Las simulaciones usan cuadrícula y paso fijo; defensa conserva su RNG con semilla y recogida su secuencia de stock por intento. El código del jugador se instrumenta con Acorn y se ejecuta en Web Workers. `window.cmg` comunica editor y layout; `window.__banco` expone herramientas de depuración/pruebas. Son interfaces existentes que se mantienen durante la separación.

## Comportamiento actual de Rocket Launcher

- Selección individual/múltiple y borradores con Add/Replace. Cerrar el inspector conserva la selección. Los borradores sin aplicar duran durante el reto y la sesión.
- Cuadro de selección: arrastre con el botón izquierdo en PC; en táctil, doble toque en el suelo y arrastrar con el segundo toque.
- Cada máquina toma el color de su función principal (provisional). Sin seleccionar muestra un halo difuso; seleccionada, un círculo nítido y su nombre. `?poc=1` abre el selector de paleta, halo, brillo e intensidad.
- Doble clic selecciona cadenas o comentarios `/* … */`. Los elementos envolventes rodean el código seleccionado con bloques, llamadas o pares de símbolos.
- Ajustes ofrece distribución automática o fija; posiciones del mapa independientes para izquierda/derecha y arriba/abajo, con vistas previas.
- El divisor permite ocupar toda la pantalla con uno de los paneles y recuperar el otro mediante el asa.
- Al escribir en móvil se prioriza la paleta. Las barras auxiliares se pliegan juntas; su botón flota con borde rojo. Las coordenadas manuales se activan en Ajustes.
- La ficha móvil permite recorrer las estadísticas manteniendo visible únicamente el cierre.
- Idiomas alternativos, seudocódigo y Python aparecen como opciones futuras deshabilitadas.

## Tres vistas

- Conserva los seis retos de recogida, el reto propio y la API `yo.recoger`, `yo.entregar`, `yo.esperar` y `yo.cuantos`.
- Bloques y pseudocódigo comparten un árbol editable, con paletas propias EN/ES, valores seleccionables y arrastre. JavaScript conserva el texto libre, la traducción del subconjunto admitido y la confirmación antes de descartar texto no traducible.
- Interfaz de Rocket Launcher: marcos, paneles ajustables y reordenables, herramientas plegables, inspector desplazable con cierre fijo y consola móvil plegable. El mapa conserva el plano 2D de este prototipo.
- JavaScript incluye iconos de recogida, resaltado de sintaxis, selección de cadenas/comentarios y elementos envolventes; al escribir en móvil aparece la barra de símbolos.
- Ajustes permite elegir el modo, el idioma de los bloques, el tamaño de letra y la distribución. En teléfonos bajos, idioma y letra quedan en Ajustes, y la consola espera a desplegarse. Las preferencias de pantalla usan `cmg-banco02-ui-*`; los programas, retos y registros conservan `cmg-banco02:*`.

## Verificar

```bash
node pruebas/interaccion.cjs
node --check "Prototypes/Tres vistas/js/juego.js"
node --check "Prototypes/Tres vistas/js/layout.js"
node --check "Prototypes/Tres vistas/js/iconos.js"
node --check pruebas/navegador.mjs
node --check pruebas/tres-vistas.mjs
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
await probar(task.page("p1")); // Rocket Launcher
await probarTresVistas(task.page("p1"));
await task.finish({ keep: [] });
JS
```

Adapta la ruta del import si mueves el proyecto. El teclado simulado no sustituye probar teclado real, selección táctil e inspector en Android y Safari/iPhone. Al modificar CSS/JS incrementa su versión `?v=N` en el `index.html` correspondiente.

## Origen y continuidad

Separado el 28 de octubre de 2026 del juego HTML de Codemageddon. Se copió el estado real del worktree `agente/codex/revision-html`, incluidos cambios sin commit y las pruebas nuevas. La base publicada de origen era `259ac33`.

El directorio no depende de otras carpetas de Codemageddon. Se dejaron fuera Godot, demos antiguas, modelos, imágenes no utilizadas, logs generales, dependencias instaladas y metadatos Git del origen. El repositorio propio es [RubenDarioMena/Code-Battles_lite](https://github.com/RubenDarioMena/Code-Battles_lite), en la rama `main`.

Las claves locales heredadas (`cmg-banco03`, `cmg-juego-*`, `cmg-probar-*`) se conservan para evitar un cambio de formato de guardado durante la migración. El almacenamiento depende del origen: los datos de `:8769` no aparecen automáticamente en `:8770`. El proyecto aún no incorpora una transferencia de esas preferencias y programas.

Consulta [PROGRESO.md](PROGRESO.md) para la sesión y la migración, [docs/VISION.md](docs/VISION.md) para el alcance y [AGENTS.md](AGENTS.md) para trabajar en el código.
