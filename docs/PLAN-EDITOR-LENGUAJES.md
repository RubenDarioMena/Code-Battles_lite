# Plan · editor reutilizable, dropdown de lenguajes y Python

Base: `Code-Battles_lite`, `trunk` en `a50fde2` (Factory en 3D con T1). Sustituye a la versión anterior del plan, que no estaba por etapas.

## Intención

1. **Un solo runtime.** Python se traduce a JavaScript y corre en los mismos Workers, encargos y simulación. No hay un segundo intérprete.
2. **IDE reutilizable.** La capa visible e interactiva del editor no sabe nada de traducción, ejecución ni del juego. Puede vivir en otras aplicaciones.

### Lenguajes del juego y lenguajes del editor (aclarado por el usuario en E3)

- **Lenguaje del editor:** lo que el componente sabe editar. Lo define un adaptador (léxico, estructura, huecos, sangría, plantillas, teclas). El componente no lo ejecuta.
- **Lenguaje del juego:** lo que el juego sabe ejecutar. Se traduce a JS y corre en el mismo Worker (intención 1).
- Otra aplicación que reutilice el editor puede tener sus propios lenguajes, con **su propio motor**. Eso no se hará en este proyecto: aquí solo se comparte la UI.
- **Alcance:** el único lenguaje nuevo es **Python**, para el editor y para el juego. No se añade ningún otro.

## Principios

- El **texto original es la fuente de verdad**. El JS generado es un resultado derivado y desechable.
- **Editar no requiere ejecutar.** El editor funciona sin proveedor, traductor, Worker ni almacenamiento.
- **Cada etapa se fusiona sola**, sin cambiar las cifras de las suites salvo donde la etapa lo declare.
- Sin framework ni compilación: cada dependencia lleva versión fija y se verifica en el paquete.
- **Sin CDN.** Todas las dependencias, fuentes y recursos necesarios se sirven desde el repositorio. El juego y el editor deben arrancar desde un servidor local sin acceso a Internet.

## Capas e interfaces

```text
┌──────────────── Editor (shared/editor/) ────────────────┐
│ texto · selección · resaltado · fichas · arrastre       │
│ historial · paletas · barra de símbolos · sin teclado   │
└───────┬───────────────────────┬─────────────────────────┘
        │ usa                   │ pide datos
┌───────▼─────────┐     ┌───────▼──────────────┐
│ Adaptador de    │     │ Proveedor del        │
│ lenguaje (JS,   │     │ proyecto (juego,     │
│ Python)         │     │ demo, otra app)      │
└─────────────────┘     └──────────────────────┘
        ▲ el anfitrión lee el documento
┌───────┴──────────────────────────────────────────────────┐
│ Traducción y ejecución (fuera del componente, en juego)  │
│ traducir(doc) → JS con las mismas líneas → Worker actual │
└──────────────────────────────────────────────────────────┘
```

### Instancia

```js
const ed = CMGEditor.crear({
  raiz,                 // elemento DOM; el componente crea dentro su marcado
  documento,            // { id, lenguaje, texto, revision }
  adaptadores,          // { js: AdaptadorJS, python: AdaptadorPython }
  proveedor,            // opcional
  preferencias,         // { leer(k, d), escribir(k, v) } opcional; sin él, dura la sesión
  alCambiar,            // (documento) => void  · revision crece en cada cambio
  alAviso,              // (html) => void
  soloLectura,          // () => bool  (p. ej. programa en ejecución)
});
ed.abrir(documento); ed.documento(); ed.insertar(texto, sa, sb);
ed.marcas(revision, [{ linea, clase, texto }]);   // se ignoran si la revisión ya no es la actual
ed.irALinea(n); ed.modoSinTeclado(bool); ed.destruir();
```

### Adaptador de lenguaje

El contrato sale de lo que `edicion.js` usa hoy de `window.ESTRUCTURA` y de `cmg`: `analizar`, `atomo`, `ampliar`, `unidadLinea`, `fronteraValida`, `contexto`, `destino`, `enLista`, `lineaDe`, `inicioLinea`, `finLinea`, `fichaEn`, `desenvolver`, además de `lexico`, `clasificar` y `reHueco`.

```js
Adaptador = {
  id, nombre,
  lexico(src) → [[tipo, texto]],              // id kw num str com esp nl p
  clasificar(fichas, i, vocabulario) → clase | null,
  estructura: { analizar(src), atomo, ampliar, unidadLinea, fronteraValida, contexto,
                destino, enLista, lineaDe, inicioLinea, finLinea, fichaEn, desenvolver },
  hueco: { crear(nombre) → texto, re, nombreDe(texto) },
  comentario: { linea: "//" | "#", alternar(src, a, b) → cambio },
  sangria: { unidad, significativa, alPartirLinea(src, pos), reubicar(bloque, destino) },
  plantillas: { si, siSino, siSinoSi, mientras, siempre, para, hacer, salir, … },  // { texto, envolvente }
  llamada(fn) → { texto, sel },                 // fn viene del proveedor como datos
  teclas: [...],                               // barra de símbolos del teléfono
};
```

### Proveedor del proyecto

```js
Proveedor = {
  funciones() → [{ grupo, objeto?, nombre, firma, await?, nota?, nombres?: { python: "pick_up" } }],
  vocabulario() → { objetos: [...], funciones: [...], propiedades: [...] },   // para resaltar
  sugerencias(contexto) → [...],                                              // valores de un hueco o argumento
};
```

Hoy `cmg.funciones()` ya devuelve casi esta forma: el trabajo es moverla, no inventarla.

### Traductor (fuera del componente)

```js
traducir({ lenguaje, texto }) → { ok, js, diagnosticos: [{ linea, columna, mensaje }] }
```

- Se llama **al pulsar Ejecutar**, siempre sobre el texto actual, con caché por texto. Los diagnósticos en vivo usan la revisión y se descartan si ya no es la actual.
- Genera **JS con las mismas líneas**: cada sentencia en su línea, cierres al final de la última línea del cuerpo y auxiliares en el preludio del Worker. Así `lineaDe()`, `__L(linea)`, la línea en ejecución y los errores funcionan sin cambios. El mapa de líneas queda en la identidad y se usa solo como red de seguridad.

## Guardado

| Clave | Contenido | Regla |
|---|---|---|
| `prog-<reto>` | `{ id: "JS" }` | Sin cambios. Solo se escribe para unidades JS. Las versiones anteriores siguen funcionando. |
| `fuentes-<reto>` | `{ id: { lenguaje: "python", texto, enUso } }` | Si existe para una unidad con `enUso`, **gana** (desde E5 sin flag). Con `enUso: false` guarda el programa Python mientras la unidad vuelve a JS. |
| `records` / `records-lenguaje` | War: coste por derribo y, aparte, el lenguaje del intento que lo puso; Factory: `{ medida, regla, valor, lenguaje }` | D6: una tabla por reto, el lenguaje como etiqueta. |
| `cmg-banco02:*` | — | La importación de solo lectura no cambia. |

- Telemetría (`codigos`) y récords añaden `lenguaje`.
- **Selección múltiple:** el borrador tiene lenguaje. Add/Replace aplican solo a unidades del mismo lenguaje; en otro caso se convierte por árbol o se explica por qué no.
- «Copiar a los demás lanzadores» y «Restaurar» se resuelven por unidad y por lenguaje.

## Vistas y lenguaje

- El editor se reutilizará como IDE, donde Seudo y Bloques no son prioridad. El usuario prevé **quitar Bloques y probablemente Seudo** (D8, pendiente). Hasta que se decida, el juego los conserva como «Vistas de JavaScript» dentro del desplegable de lenguaje de la cabecera (`#sel-lenguaje`, que sustituye a los botones JS/Seudo/Bloques/Py). Ajustes mantiene sus botones.
- Desde E3 las vistas son **opcionales** en el componente (`opciones.vistas`). El juego las pide; una instancia autónoma no las tiene salvo que las pida, y la demo ya no carga `seudo.js`.
- El selector del editor muestra solo **lenguajes del documento**, es decir, los adaptadores que ofrece el anfitrión. Cambiar de lenguaje es pedirle al anfitrión el documento en el otro lenguaje: convertirlo, abrir otro archivo o explicar por qué no. El editor no convierte.
- Seudo y Bloques usan el árbol de `seudo.js`, que entra desde JS y **sale como JS**. Sobre un documento Python el componente no los crea.
- En el juego, cambiar de JS a Python es convertir por el árbol (E7) cuando el programa cabe en el subconjunto. Si no cabe, el texto se conserva y se muestra el motivo.

## Etapas

| Etapa | Resultado | Cambio visible | Compuerta |
|---|---|---|---|
| **E0 Contrato y red** | `shared/editor/CONTRATO.md` desde las API reales; `interaccion.cjs` carga módulos en vez de cortar `juego.js` | No | Cifras de referencia registradas: 123 lógica, 90 War, editor 18, vistas 31, paridad 28/28, API 7 |
| **E1 Extracción** | `CMGEditor.crear`; adaptador JS (`lexico`, `estructura.js`, `ATAJOS`, `TECLAS`, huecos); proveedor del juego; preferencias inyectadas; `destruir()`; fachada `window.cmg`/`cmg.edicion`/`cmg.seudo` | No | Mismas cifras que E0, capturas iguales, versiones `?v=` actualizadas |
| **E2 Demo** | `shared/editor/demo.html`, dos instancias y proveedor declarativo | Página nueva | Aislamiento de documento, historial, preferencias y atajos; destruir y crear sin oyentes duplicados; sin globals del juego |
| **E2.1 Paridad** | Forma, barras, tooltips, letra y ajustes comunes con el juego; pantalla completa de cada instancia | Demo | War y Factory idénticos píxel a píxel; demo en PC, tableta y teléfono (vertical y horizontal) |
| **E3 Lenguaje del documento** | Catálogo de lenguajes del editor (`CMGLenguajes`); `<select>` de lenguaje en las instancias autónomas; cambio de adaptador en vivo (`abrir` con otro lenguaje, `alCambiarLenguaje`); vistas opcionales. Revisado: sin Seudo ni Bloques en el selector y sin cambios en el juego | Demo | Cambio de lenguaje sin oyentes ni menús duplicados; historial por documento; respuestas tardías o negativas del anfitrión; el juego idéntico |
| **E4a Python en el componente** | lezer fijado y empaquetado localmente; adaptador Python (léxico, árbol con los nodos del editor, huecos `__tipo__`, sangría significativa con niveles y `pass` en bloques vacíos, plantillas, operadores, teclas, comentarios con `#`); `edicion.js` toma del adaptador sangría, huecos y sugerencias; Python en la demo | Demo | Las operaciones de edición conservan el significado (pruebas antes/después con la forma del árbol); juego idéntico |
| **E4b Python en el juego** (`?python=1`) | Botón Py en la cabecera y Python en Ajustes (botones, como JS/Seudo/Bloques); `fuentes-<reto>`; paleta, inspector y sugerencias Python de War/Factory; Add/Replace y copiar por lenguaje | Detrás de flag | Ejecutar bloqueado con mensaje; sin flag, el juego idéntico |
| **E5 Ejecutar Python** ✓ | Traductor con el mismo árbol lezer; subset núcleo; preludio en el Worker; diagnósticos con línea de Python | Se retira el flag | Equivalencia JS/Python: misma semilla, eventos, tiempos y resultados en War y Factory |
| **E6 Listas** ✓ | `len`, `append`, `pop`, índices negativos, slices con paso, `range`, `enumerate`, comprensiones con un `for` e `if` | Sí | Resultados comparados con CPython, escritos a mano en las pruebas |
| **E7 Conversión y docs** ✓ (salvo QA real) | Árbol → Python; conversión desde el dropdown; `REGLAMENTO`, `AGENTS`, `VISION`, `PROGRESO` | Sí | QA en un teléfono real: teclado y sangría (**pendiente**: solo emulación) |

## Riesgos que el plan atiende explícitamente

1. **Sangría significativa (E4).** En JS reindentar es cosmético; en Python, mover, arrastrar, envolver, desenvolver, pegar y Tab cambian el programa. Cada operación declara la sangría resultante y tiene una prueba de significado.
2. **Huecos (E4).** `/* tipo */` es un comentario de JS que Python no tiene. Cada adaptador define su forma de hueco.
3. **Seudo/Bloques escriben JS.** Sobre Python el componente no los crea; su futuro depende de D8.
4. **Pruebas por recorte de texto.** Se migran en E0, antes de mover código.
5. **lezer es ESM con tres dependencias** (`@lezer/common`, `lr`, `highlight`). Se distribuirá como un paquete local en el repo hecho con un guion documentado; no se usará CDN. Acorn, Three y sus cargadores también se sirven localmente. Se verifican `publicacion.mjs` y el comportamiento sin red.
6. **Piezas del editor fuera del editor.** `TECLAS` (layout), `ATAJOS`, `clasificar`/`esObjeto` y sugerencias (juego), tokens CSS de `base.css` y `localStorage` directo en `seudo.js`.

## Subconjunto Python

| Núcleo (E5) | Listas (E6) | Fuera |
|---|---|---|
| Variables, asignación, `+=`; `if`/`elif`/`else`; `while`, `for … in range`, `break`, `continue`; `def`/`async def`, `return`; `await`; `print`, f-strings; `//`, `%`, `**`; `and`/`or`/`not` (devuelven operando); `None`/`True`/`False`; `is None`, `in`; verdad de vacíos; `==` profundo; errores al estilo de Python | `[...]`, `len`, `append`, `pop`, `a[-1]`, `a[i:j:k]`, `enumerate`, `[x for x in xs if c]`, ámbito propio de la comprensión | Clases, imports, biblioteca estándar, diccionarios y tuplas (siguiente etapa), generadores, `try`, `with`, decoradores, enteros de precisión arbitraria |

- Los nombres de Python que son reservados en JS (`new`, `var`, `this`, `function`, `delete`…) se renombran al traducir.
- Las funciones locales que se llaman como la API (`count`) siguen siendo locales.

## Decisiones

| # | Decisión | Estado |
|---|---|---|
| D1 | Nombres de la API en Python | **Decidido:** `yo.pick_up` principal; se aceptan `pickUp` y los alias en español. Vive en el proveedor (`nombres: { python }`) y en el traductor; el editor solo muestra lo que recibe |
| D2 | `await` | **Decidido:** explícito, con `async def` en funciones que esperan; documentar que es el estilo del REPL de `asyncio` |
| D3 | Consola | **Aplicada en E5:** `print` → log; `info()`, `warn()` y `error()` a sus niveles |
| D4 | Huecos en Python | **Decidido:** `__tipo__`, identificador válido; el traductor lo rechaza con «Rellena el hueco» |
| D5 | Fidelidad | **Decidido:** semántica real de Python dentro del subconjunto |
| D6 | Récords | **Aplicada en E5:** una tabla por reto; el lenguaje como etiqueta |
| D7 | `<select>` nativo | Recomendación aplicada en E3 (selector de lenguaje): excepción al pilar «UI propia», accesible y con el selector del teléfono. Reversible |
| D8 | Bloques y Seudo | **Pendiente.** El usuario prevé quitar Bloques y probablemente Seudo: no son prioridad para un IDE. Quitarlos del juego cambia lo que ve el jugador (botones, ladrillos de Factory, suite de vistas y preferencia `modo`) y se hará como cambio aparte y documentado |
| D9 | Más lenguajes | **Decidido:** solo Python. Los lenguajes de otras aplicaciones traen su propio motor y quedan fuera de este proyecto |

### Cómo se resuelve D1 sin tocar el editor

1. El proveedor declara cada función una vez: `{ nombre: "pickUp", nombres: { python: "pick_up" }, firma, await }`.
2. El adaptador Python inserta `nombres.python` cuando existe, y si no, `nombre`. El editor no conoce ninguna regla de nombres.
3. El traductor recibe del juego la tabla de alias (`pick_up` | `pickUp` | `recoger` → orden `recoger`) y la reescribe al nombre que ya acepta el Worker. JS no gana `pick_up`: se queda como está.
4. El resaltado usa `vocabulario()` del proveedor, que incluye las tres formas.

## Fuera de esta entrega

Campaign, bloques nuevos para War, nodos, LSP, extracción automática de funciones desde otros codebases y una aplicación completa de proyectos. El proveedor es el punto de integración para todo eso.

## Cómo quedó (E5–E7)

- **Traductor** (`shared/python/traductor.js`): lezer da las sentencias; las expresiones con operadores se aplanan y se reasocian con la precedencia de Python, porque lezer asocia distinto `not a and b` y `await f() + 1`. Los nombres se resuelven por ámbito (locales, `global`, `nonlocal`, comprensiones, lambdas); los que chocan con JS o con la API se renombran con `$`. La API pasa por la tabla `alias("python")` del proveedor. El JS generado se cachea por texto y se revisa con acorn antes de ejecutar.
- **Preludio** (`__py`, inyectado en el Worker con `toString()`): verdad, operadores con sus `TypeError`, igualdad profunda, índices y trozos, métodos de listas y textos, `range`, `print`/`repr`, f-strings con formato, redondeo mitad al par y mensajes de error de JS reescritos como los de Python.
- **Conversión** (`shared/python/desde-js.js`): acorn → Python. Conserva comentarios y líneas en blanco, convierte el código comentado, `for` clásico → `range`, `??` de una lectura → `or`, sumas que empiezan por texto → f-string. Lo que no cabe devuelve motivo y línea.
- **Límites conocidos:** sin distinción entero/real (`4 / 2` → `2`), enteros hasta 2⁵³, diccionarios y tuplas completas para la siguiente etapa, y Py recupera el último Python guardado en vez de volver a convertir.

### Continuidad · 6 de noviembre de 2026

E5–E7 ya estaban implementadas en `trunk` y también incorporadas a `main`. Esta revisión continúa en `trunk`: corrige valores por defecto de funciones Python y colisiones de nombres del traductor y del conversor JS → Python. Los defaults Python se evalúan una vez al definir `def`, `async def` o `lambda`; convertir defaults JS dinámicos da un diagnóstico por su distinta semántica. La conversión conserva el JS guardado cuando no puede representar el programa.

La QA en un teléfono físico sigue pendiente. También quedan diferencias de Unicode en fuentes escritas directamente en Python (normalización de identificadores y operaciones sobre textos); la corrección de nombres del conversor JS → Python no completa ese trabajo. Diccionarios, tuplas completas y D8 conservan el alcance indicado arriba.
