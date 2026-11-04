# Code Battle Lite

Juegos de programación para escritorio y móvil con una entrada común: **Factory** y **War**, sobre la aplicación común de Rocket Launcher, y **Campaign** (próximamente). Factory programa un robot de recogida con bloques, seudocódigo o JavaScript; War controla lanzadores con JavaScript o seudocódigo.

## Ejecutar

Desde esta carpeta, sin instalar paquetes ni compilar:

```bash
python3 -m http.server 8770 --bind 0.0.0.0
```

- [Entrada común](http://localhost:8770/).
- War / Rocket Launcher: [abrir defensa](http://localhost:8770/Prototypes/Rocket%20Launcher/).
- Factory: [abrir recogida](http://localhost:8770/Prototypes/Rocket%20Launcher/?serie=factory). `?reto=0` a `?reto=5` elige un reto; `?reto=propio`, el editable.
- `Prototypes/Rocket Launcher/probar.html` muestra teléfono y PC a la vez; acepta `?serie=factory`.
- Para probar desde otro dispositivo de la misma Wi-Fi: `http://IP-DEL-EQUIPO:8770/`.
- Recarga después de editar. El servidor debe permanecer abierto.
- `?forma=movil` y `?forma=escritorio` fuerzan el formato; `?marco=1` activa el teclado simulado del probador.

Alternativa con PowerShell y recarga automática, en localhost:

```powershell
pwsh -NoProfile -File ./server.ps1 -Root "." -Port 8770 -NoBrowser
```

Sirve la entrada y ambos juegos. Mantén como raíz la carpeta completa: los juegos usan los recursos de `shared/`. PowerShell sigue pendiente de comprobación en Windows.

La aplicación sirve Acorn 8.11.3, Three.js r128 y GLTFLoader r128 desde `shared/vendor/`, con licencias y hashes fijados. Usa fuentes instaladas en el dispositivo. Los juegos funcionan desde el servidor local sin CDN ni conexión a Internet. La telemetría remota opcional necesita red para enviar datos.

## Estructura

La aplicación común vive en `Prototypes/Rocket Launcher/`. Las rutas siguientes son relativas a esa carpeta:

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Mapa, editor, inspector, Ajustes y diálogos. |
| `js/juego.js` | Aplicación, selección, editor, guardado e integración de las familias. |
| `js/nucleo.js`, `js/runtime.js` | Paso fijo, lockstep, Web Workers, esperas y encargos. |
| `js/war.js`, `js/factory.js` | Reglas de combate y logística. |
| `js/war-retos.js`, `js/factory-retos.js` | Retos y normalización de escenarios. |
| `js/vistas.js`, `js/factory-vista.js` | Mapa 3D/plano y dibujo de logística. |
| `js/factory-3d.js`, `modelos/t1.glb` | Escenario 3D de Factory: edificios y transporte T1 con tres LOD (generado por `arte/blender/exportar_t1.py`). |
| `js/factory-form.js` | Formulario de enunciado, metas y mapa de «Tu reto». |
| `js/layout.js` | Distribución, divisor, preferencias, teclado móvil, barra de símbolos y tooltips. |
| `js/seudo.js` | Vistas del JS: seudocódigo ES/EN para ambas series y bloques de Factory, edición y arrastre. |
| `css/base.css` | Colores, tipografía y apariencia común. |
| `css/componentes.css` | Estilos de componentes. |
| `css/layout.css` | Reparto y adaptación a pantalla/teclado. |
| `probar.html` | Probador con marcos de dispositivos y teclado simulado. |

Los módulos `shared/js/iconos.js`, `shared/js/estructura.js` y `shared/js/edicion.js`, y el estilo `shared/css/edicion.css`, sirven a ambos juegos. La estructura analiza código incompleto; edición mantiene fichas, sugerencias, asas, barra reordenable e historial por documento. Las dos series usan el mismo editor y layout. El modo de programa y su idioma se recuerdan por serie; la distribución de pantalla es común.

En la raíz: `index.html` es la entrada; `campaign/` muestra el anuncio; `server.ps1` es el servidor opcional y `pruebas/` contiene las pruebas. `02_tres_vistas.html` en la raíz es la referencia histórica sin adaptar; la entrada vigente está en `Prototypes/`.

Las simulaciones usan cuadrícula y paso fijo; defensa conserva su RNG con semilla y recogida su secuencia de stock por intento. El código del jugador se instrumenta con Acorn y se ejecuta en Web Workers. `window.cmg` comunica editor y layout; `window.__banco` expone herramientas de depuración/pruebas. Son interfaces existentes que se mantienen durante la separación.

## Comportamiento actual de Rocket Launcher

- Selección individual/múltiple y borradores con Add/Replace. Cerrar el inspector conserva la selección. El inspector empieza cerrado y solo se abre al elegir una unidad (campo, chips o enlace); abrir un programa no lo despliega. Los borradores sin aplicar duran durante el reto y la sesión.
- Cuadro de selección: arrastre con el botón izquierdo en PC; en táctil, doble toque en el suelo y arrastrar con el segundo toque.
- Cada máquina toma el color de su función principal (provisional). Sin seleccionar muestra un halo difuso; seleccionada, un círculo nítido y su nombre. `?poc=1` abre el selector de paleta, halo, brillo e intensidad.
- Doble clic selecciona cadenas o comentarios `/* … */`. Los elementos envolventes rodean el código seleccionado con bloques, llamadas o pares de símbolos.
- Modo sin teclado: el botón del teclado (junto a la letra en PC, primero de la barra de edición en el teléfono) se tacha en rojo y muestra el código como fichas sin abrir el teclado. Un toque elige un elemento entero (textos con comillas, comentarios completos); el doble toque amplía hasta el siguiente límite semántico. Los valores arrastrados se copian sobre un hueco, un argumento o dentro de `( )`/`[ ]`; las líneas se mueven por el número o por un asa en el borde derecho (Ajustes). El modo se recuerda por dispositivo.
- Al elegir un hueco `/* … */`, un argumento vacío o (sin teclado) un valor de una llamada conocida aparece la lista de valores posibles: tipos, sensores, lugares, propiedades y operadores, según los datos de la máquina. Elegir uno pasa al siguiente hueco de la línea.
- Barra de edición (deshacer, rehacer, cortar, copiar, pegar, borrar, ampliar/reducir selección, duplicar, subir/bajar, línea nueva, desenvolver: quita el if/while/for/do que rodea lo elegido y deja su contenido): fija bajo la paleta en el teléfono; en PC con el modo sin teclado o el seudocódigo. Sin contexto seguro (IP de la red local) pegar usa lo último copiado en el juego. Ajustes → «Ordenar botones y grupos…» cambia el orden de grupos y botones arrastrándolos.
- La paleta y la barra de edición ocupan una línea cada una y se deslizan (con ratón, la rueda las mueve). En el teléfono la consola empieza cerrada: solo queda su asa.
- Seudocódigo (botones JS/Seudo junto a la letra o Ajustes → Lenguaje del programa, en español o inglés): el mismo programa como frases con valores que se eligen, ladrillos que se tocan o arrastran y la barra de edición sobre el renglón elegido. Se guarda y ejecuta como JavaScript; lo que aún no tiene seudocódigo se queda en JavaScript con un aviso.
- Mantener pulsado un atajo con la esquina marcada (o clic derecho) abre sus variantes: while/for/do…while/break, if/if-else/else if, operadores, `let`/asignación y niveles de `console`.
- Ctrl+Alt+A activa o desactiva el modo sin teclado. Sin teclado, el clic derecho (o mantener el dedo 2 s, con un anillo que se llena) abre las alternativas del elemento: todas las funciones sobre una llamada, operadores de su familia, `const`/`let`, literales y los valores que encajan en su sitio.
- Modo pantalla completa (tableta y teléfono): mantener 2 s el botón de cuatro esquinas. La batalla y el código ocupan cada uno la pantalla; `</>`, ▶ EJECUTAR y el botón del mapa saltan entre ellos. Explicación en Ajustes.
- Bajo el editor, un panel arrastrable alterna entre Inspector (lo que el programa puede usar) y Consola.
- Ajustes ofrece distribución automática o fija; posiciones del mapa independientes para izquierda/derecha y arriba/abajo, con vistas previas.
- El divisor permite ocupar toda la pantalla con uno de los paneles y recuperar el otro mediante el asa.
- Al escribir en móvil se prioriza la paleta. Las barras auxiliares se pliegan juntas; su botón flota con borde rojo. Las coordenadas manuales se activan en Ajustes.
- La ficha móvil permite recorrer las estadísticas manteniendo visible únicamente el cierre.
- El idioma alternativo de la interfaz y Python siguen deshabilitados; el seudocódigo ES/EN ya está disponible.
- La traducción conserva `let`/`const`/`var`, las reasignaciones y el nombre y alcance del contador de un `for`. Bloques independientes, comparaciones con coerción (`==`/`!=`) y llamadas calculadas no representables se conservan en JavaScript con aviso.

## Factory

- Seis retos y «Tu reto», sobre el mapa 9 × 7 y el runtime común. Bloques, seudocódigo y JS son vistas del mismo programa; lo que no se puede representar se conserva en JS con aviso.
- API principal `pickUp`, `deliver`, `wait`, `count`; `yo.` opcional y alias españoles compatibles. Edificios como `ENT_1` o `FUN`, referencias reutilizables y IDs de texto aceptados.
- Victoria al cumplir metas; las entregas llenas conservan la carga. `count` devuelve 0 para edificio vacío y null si no existe. [Reglamento completo](docs/REGLAMENTO.md).
- Importación única de programas y preferencias desde `cmg-banco02:*`, sin escribir en ese banco. Los programas comunes usan `cmg-banco03:prog-factory-*`; el árbol antiguo se convierte a JS cuando era la fuente activa.
- Récord por tiempo con versión de reglas, telemetría local separada y stock determinista por intento. War conserva sus claves y telemetría remota.
- Vista 3D (por defecto) o plano, recordada por serie. R1 es el transporte T1 de Blender: el brazo alcanza el edificio al recoger o entregar y lleva la caja con el color del material. El nivel de detalle (LOD0–2) depende del tamaño del robot en pantalla. El cargador glTF r128 local se carga solo en Factory.
- Comparación histórica: 28 casos, con [13 diferencias aprobadas](pruebas/factory-deltas.json) y 15 resultados idénticos. El [oráculo original](pruebas/factory-oraculo.md) se conserva.
- El Factory original (`Prototypes/Tres vistas/`) está retirado: sus URL y `Prototypes/02_tres_vistas.html` redirigen aquí conservando query y hash. Su código queda en el historial de git (`b76411b`).

## Preparar Netlify

El repositorio incluye `netlify.toml`. Para conectar el repo en Netlify, usa la raíz del repositorio como base; el comando es `node scripts/preparar-netlify.mjs` y el directorio publicado es `dist`. No requiere `npm install` ni backend. El comando usa Node.js 22 y copia una lista permitida: entrada, Campaign, aplicación común, recursos compartidos y entradas heredadas.

Para una subida manual o una revisión local del paquete:

```bash
node scripts/preparar-netlify.mjs
node pruebas/publicacion.mjs
```

Sube el **contenido de `dist/`**. La carpeta es generada e ignorada por Git. No incluye el laboratorio de animación, sus dependencias, documentos, pruebas ni metadatos del repositorio. Incluye una página 404; conserva las URL existentes bajo `Prototypes/`. No hay una redirección global de SPA que oculte recursos ausentes.

La preparación no publica nada. Al cambiar a un dominio Netlify, localStorage empieza separado del origen local: aún no existe importación/exportación de programas. El paquete incluye las dependencias locales.

## Verificar

El [oráculo histórico y sus deltas](pruebas/factory-oraculo.md) verifican las reglas migradas; las suites comunes cubren las tres vistas, importación y edición. Estado de cada etapa en [PROGRESO.md](PROGRESO.md) y el [plan](docs/PLAN-UNIFICACION.md).

```bash
node pruebas/interaccion.cjs
node --check "Prototypes/Rocket Launcher/js/juego.js"
node --check "Prototypes/Rocket Launcher/js/layout.js"
node --check shared/js/iconos.js
node --check shared/js/estructura.js
node --check shared/js/edicion.js
node --check "Prototypes/Rocket Launcher/js/seudo.js"
node pruebas/factory-reglas.cjs
node --check "Prototypes/Rocket Launcher/js/runtime.js"
node --check "Prototypes/Rocket Launcher/js/factory.js"
node --check pruebas/navegador.mjs
node --check pruebas/factory-comun.mjs
node --check pruebas/factory-editor-comun.mjs
node --check pruebas/factory-vistas-comunes.mjs
node --check pruebas/factory-3d.mjs
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
const { probarFactoryComun } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/factory-comun.mjs");
const { probarFactoryVistas } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/factory-vistas-comunes.mjs");
const { probarFactoryEditorComun } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/factory-editor-comun.mjs");
const { probarFactory3D } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/factory-3d.mjs");
const { probarEntrada } = await import("file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/entrada.mjs");
await probar(task.page("p1")); // War / Rocket Launcher
await probarFactoryComun(task.page("p1"));
await probarFactoryVistas(task.page("p1"));
await probarFactoryEditorComun(task.page("p1"));
await probarFactory3D(task.page("p1"));
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


## Editor y lenguajes

[Plan por etapas](docs/PLAN-EDITOR-LENGUAJES.md) y [contrato inicial D1/D2](docs/EDITOR-D1-D2.md). El proveedor declara nombres Python y esperas; la edición y ejecución Python siguen pendientes de E4/E5.
