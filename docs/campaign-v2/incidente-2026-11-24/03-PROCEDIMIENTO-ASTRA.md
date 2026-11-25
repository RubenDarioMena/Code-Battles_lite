# Procedimiento nuevo: tareas cortas y acotadas para Astra

**Objetivo:** que cada encargo a Astra cueste una fracción de lo que costaba una porción, quepa holgado en una ventana de cuota y deje un diff que se revise en minutos. Se apoya en lo que la auditoría midió: el gasto viene de leer, de arrancar en frío y de los cortes a medias, no de escribir.

## 1. Tamaño de una tarea

**Una tarea es un solo resultado comprobable.** Debe cumplir todo esto:

| Límite | Valor | Por qué |
|---|---|---|
| Resultado | Uno: «el kit de paisaje aparece en B1», no «UI del primer hito» | Si hay dos resultados, son dos tareas |
| Archivos que toca | 5 como máximo, nombrados en el brief | El diff se revisa de una pasada |
| Diff | ~300 líneas como máximo, sin contar assets ni pruebas grabadas | Si crece más, la tarea estaba mal cortada |
| Llamadas al modelo | 30 como máximo (el lanzador corta) | Las porciones usaban ~60, y el coste crece con el cuadrado |
| Contexto | 120 k tokens como máximo (el lanzador corta) | Las porciones llegaban a 200–240 k |
| Cuota | Que quepa en ~35 % de una ventana de 5 h | Se lanza solo con la ventana por debajo del 30 %, para que nunca se corte a medias |
| Esfuerzo | `high` si es la primera vez que se construye algo; `medium` para correcciones y contenido que repite un patrón | Lo que ya se acordó con el autor |

## 2. Contexto preparado, no exploración

Lo que más se pagó fue que Astra explorase por su cuenta. Ahora **Claude prepara el contexto** y Astra no lo busca:

- **Paquete de contexto en el brief**, de 8 k tokens como máximo:
  - las firmas e interfaces que necesita;
  - los fragmentos exactos con su ruta y sus líneas;
  - el patrón que debe imitar (por ejemplo, «así se registra una mecánica: …»).
- **Lista cerrada de archivos.** Astra puede abrir los archivos de la lista, siempre con `rg -n` y `sed -n` por rangos de 150 líneas como máximo. Nada de `cat` de archivos enteros ni de grupos de archivos, y nada de `nl -ba` de un HTML.
- **Si le falta contexto, para y lo dice.** El último mensaje sería «Falta contexto: necesito X para Y», y Claude lo añade en la siguiente tarea. No explora. No es una pregunta que bloquee: es un cierre con informe.
- **Mapa de contexto de V2** (`docs/campaign-v2/MAPA-CONTEXTO.md`, de 3–5 k tokens): módulos, interfaces y dónde se enchufan un nivel, una mecánica, un asset y un VFX. Se adjunta en cada brief en lugar de las lecturas obligatorias de AGENTS.md.

## 3. Ajustes de Codex que ayudan (probar en la primera tarea)

Las tres claves existen en `codex` 0.166, pero aún no las hemos usado:

- `-c project_doc_max_bytes=0`: no inyecta AGENTS.md (~6,5 k caracteres) ni su orden de leer 60 000 caracteres de documentación. Las reglas que sí importan (determinismo, no hacer commits, solo dentro del worktree) van en la plantilla del brief.
- `-c tool_output_token_limit=4000`: corta cada salida de herramienta en ~16 000 caracteres en lugar de ~42 000. Solo esto habría reducido a menos de la mitad lo reenviado.
- `-c model_auto_compact_token_limit=110000`: si aun así el contexto crece, Codex lo compacta antes de llegar al tope del lanzador.

## 4. Lanzador con topes (`herramientas/lanzar-v3.sh`)

- **Antes de lanzar**, lee la cuota de la última sesión de cada cuenta y solo arranca si la ventana de 5 h está por debajo del 30 % y la semanal por debajo de su tope. En la cuenta normal el tope es el 75 %.
- **Durante la tarea** vigila el registro de la sesión y la corta si:
  - pasa de 30 llamadas al modelo;
  - el contexto pasa de 120 k tokens;
  - lleva 20 minutos sin eventos (el atasco de P5a);
  - en la cuenta normal, el uso llega al 75 %.
- **Al cortar** deja `.astra/<tarea>.corte` con el motivo, para que Claude decida: reducir la tarea o completarla él. Nunca relanza una continuación automática, porque eso era lo que obligaba a releerlo todo.
- **Nunca usa las dos cuentas a la vez.** `codex-astra` es la primaria.

## 5. Ciclo de cada tarea

1. **Claude** prepara el brief con la plantilla: el resultado, los archivos, el paquete de contexto, la comprobación y los topes.
2. **Claude** guarda la instantánea con `git add -A`, para que el diff muestre solo esa tarea.
3. **Astra** la implementa con `lanzar-v3.sh` y solo ejecuta las pruebas que nombra el brief. La suite completa se pasa una vez, al final.
4. **Claude revisa**: el diff contra el índice, la suite, el navegador con el panel visible si hay cambio visual, y el coste real de la sesión (llamadas, tokens, cuota).
5. **Claude registra** una línea en `docs/campaign-v2/REGISTRO-TAREAS.md`: tarea, cuenta, llamadas, entrada, cuota, resultado y revisión. Así se ve en seguida si una tarea se sale de lo previsto.
6. **Si algo falla**, la corrección es otra tarea corta en esfuerzo `medium`, con el fallo concreto y los archivos.

## 6. Quién hace qué

| Trabajo | Quién | Por qué |
|---|---|---|
| Preparar el contexto, cortar tareas, revisar, resumir al autor | Claude | Tiene la conversación y el navegador; Astra arranca en frío |
| Lógica nueva, 3D, rigs, exportar desde Blender, VFX | Astra (`high` la primera vez) | Es su punto fuerte |
| Contenido que repite un patrón (un nivel más, otra tesela, otra unidad) | Astra (`medium`) con el patrón en el brief | Es barato si no explora |
| Revisión visual y capturas | Claude, con el panel visible | Astra no tiene navegador en el sandbox |
| Correcciones de una o dos líneas, documentación y registro | Claude | Lanzar a Astra cuesta más que hacerlo |

## 7. Señales de alarma, por las que se para y se revisa

- Una tarea que gasta más del 40 % de la ventana de 5 h, o más de 3 M de tokens de entrada.
- Un diff que toca archivos fuera de la lista del brief, sobre todo en `paquetes/app/`, `reglas-war` o Rocket Launcher.
- Dos tareas seguidas con «Falta contexto»: el mapa de contexto está incompleto.
- Un informe de Astra que Claude no entiende en una lectura: se le pide un resumen de 5 líneas o lo resume Claude a partir del diff.
