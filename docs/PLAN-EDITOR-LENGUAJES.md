# Plan · editor reutilizable, dropdown de lenguajes y Python

Base: `Code-Battles_lite`, `trunk` en `a50fde2` (Factory en 3D con T1). Sustituye a la versión anterior del plan, que no estaba por etapas.

## Intención

1. **Un solo runtime.** Python se traduce a JavaScript y corre en los mismos Workers, encargos y simulación. No hay un segundo intérprete.
2. **IDE reutilizable.** La capa visible e interactiva del editor no sabe nada de traducción, ejecución ni del juego. Puede vivir en otras aplicaciones.

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
| `fuentes-<reto>` | `{ id: { lenguaje, texto } }` | Si existe para una unidad, **gana**. |
| `cmg-banco02:*` | — | La importación de solo lectura no cambia. |

- Telemetría (`codigos`) y récords añaden `lenguaje`.
- **Selección múltiple:** el borrador tiene lenguaje. Add/Replace aplican solo a unidades del mismo lenguaje; en otro caso se convierte por árbol o se explica por qué no.
- «Copiar a los demás lanzadores» y «Restaurar» se resuelven por unidad y por lenguaje.

## Vistas y lenguaje

- El dropdown ofrece **lenguaje del documento** (JavaScript, Python) y **vistas** (Seudocódigo y, en Factory, Bloques). Nodos queda oculto.
- Seudo y Bloques usan el árbol de `seudo.js`, que hoy entra desde JS y **sale como JS**. Sobre un documento Python solo se activan cuando exista «árbol → Python» (E7); hasta entonces muestran el motivo y no cambian nada.
- Cambiar de lenguaje es convertir: JS → árbol → Python cuando el programa cabe en el subconjunto. Si no cabe, el texto y la vista se conservan y se muestra el motivo.

## Etapas

| Etapa | Resultado | Cambio visible | Compuerta |
|---|---|---|---|
| **E0 Contrato y red** | `shared/editor/CONTRATO.md` desde las API reales; `interaccion.cjs` carga módulos en vez de cortar `juego.js` | No | Cifras de referencia registradas: 123 lógica, 90 War, editor 18, vistas 31, paridad 28/28, API 7 |
| **E1 Extracción** | `CMGEditor.crear`; adaptador JS (`lexico`, `estructura.js`, `ATAJOS`, `TECLAS`, huecos); proveedor del juego; preferencias inyectadas; `destruir()`; fachada `window.cmg`/`cmg.edicion`/`cmg.seudo` | No | Mismas cifras que E0, capturas iguales, versiones `?v=` actualizadas |
| **E2 Demo** | `shared/editor/demo.html`, dos instancias y proveedor declarativo | Página nueva | Aislamiento de documento, historial, preferencias y atajos; destruir y crear sin oyentes duplicados; sin globals del juego |
| **E3 Dropdown** | Catálogo común; `<select>` en el editor y en Ajustes con JS, Seudo y Bloques | Sí | Mismo comportamiento que los botones; teclado, móvil y pantalla completa |
| **E4 Editar Python** (`?python=1`) | lezer fijado; adaptador Python; huecos; sangría significativa; plantillas y barra de símbolos; `fuentes-<reto>` | Detrás de flag | Las operaciones de edición conservan el significado (pruebas antes/después); Ejecutar bloqueado con mensaje |
| **E5 Ejecutar Python** | Traductor con el mismo árbol lezer; subset núcleo; preludio en el Worker; diagnósticos con línea de Python | Se retira el flag | Equivalencia JS/Python: misma semilla, eventos, tiempos y resultados en War y Factory |
| **E6 Listas** | `len`, `append`, `pop`, índices negativos, slices con paso, `range`, `enumerate`, comprensiones con un `for` e `if` | Sí | Resultados comparados con CPython, escritos a mano en las pruebas |
| **E7 Conversión y docs** | Árbol → Python; conversión desde el dropdown; `REGLAMENTO`, `AGENTS`, `VISION`, `PROGRESO` | Sí | QA en un teléfono real: teclado y sangría |

## Riesgos que el plan atiende explícitamente

1. **Sangría significativa (E4).** En JS reindentar es cosmético; en Python, mover, arrastrar, envolver, desenvolver, pegar y Tab cambian el programa. Cada operación declara la sangría resultante y tiene una prueba de significado.
2. **Huecos (E4).** `/* tipo */` es un comentario de JS que Python no tiene. Cada adaptador define su forma de hueco.
3. **Seudo/Bloques escriben JS.** Sobre Python solo se activan con «árbol → Python» (E7).
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
| D3 | Consola | Recomendación: `print` → log; `warn()`/`error()` como funciones del proveedor |
| D4 | Huecos en Python | **Decidido:** `__tipo__`, identificador válido; el traductor lo rechaza con «Rellena el hueco» |
| D5 | Fidelidad | **Decidido:** semántica real de Python dentro del subconjunto |
| D6 | Récords | Recomendación: una tabla por reto; el lenguaje como etiqueta |
| D7 | `<select>` nativo | Recomendación: aceptarlo como excepción al pilar «UI propia»: accesible y con el selector del teléfono |

### Cómo se resuelve D1 sin tocar el editor

1. El proveedor declara cada función una vez: `{ nombre: "pickUp", nombres: { python: "pick_up" }, firma, await }`.
2. El adaptador Python inserta `nombres.python` cuando existe, y si no, `nombre`. El editor no conoce ninguna regla de nombres.
3. El traductor recibe del juego la tabla de alias (`pick_up` | `pickUp` | `recoger` → orden `recoger`) y la reescribe al nombre que ya acepta el Worker. JS no gana `pick_up`: se queda como está.
4. El resaltado usa `vocabulario()` del proveedor, que incluye las tres formas.

## Fuera de esta entrega

Campaign, bloques nuevos para War, nodos, LSP, extracción automática de funciones desde otros codebases y una aplicación completa de proyectos. El proveedor es el punto de integración para todo eso.
