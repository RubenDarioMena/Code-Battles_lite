# Reglas comunes para agentes

Válidas para Claude, Codex y cualquier otro agente, en todos los proyectos que enlacen este archivo. Las instrucciones propias del proyecto (`AGENTS.md`) mandan si hay conflicto.

## 1. La fuente de verdad son los archivos, no la memoria

- No uses ni escribas memoria automática del servicio. Lo que deba recordarse va en un archivo del repo: specs, bugs, `PROGRESO.md` o estas reglas.
- Si detectas una preferencia del usuario que no está escrita, **propón** añadirla al archivo adecuado. No la apliques en silencio.
- Si dos documentos se contradicen, avisa y pregunta. No elijas por tu cuenta.

## 2. Antes de tocar una pantalla

1. Abre su spec en `docs/pantallas/`. Busca primero por **palabras clave** (índice de la spec) en vez de leer archivos enteros.
2. Comprueba la **lista de features** contra lo que vas a cambiar. Si integras algo, confirma que partes de la versión vigente de cada parte conectada (rama y commit), no de una copia antigua.
3. Busca en `docs/bugs/INDICE.md` bugs del área. Si tu tarea toca uno, lee su historial antes de proponer un arreglo.

## 3. Al terminar

- Actualiza la checklist de features de la spec si añades, cambias o retiras algo.
- Registra cada bug encontrado o corregido con `node harness/scripts/nuevo-bug.mjs` (detecta duplicados) o añade una recurrencia al bug existente.
- Deja tu resumen en `PROGRESO.md` como pide el proyecto: qué cambió, cómo se verificó y qué quedó pendiente.

## 4. Salidas para el usuario

- Todo HTML pedido como salida va en `docs/salidas/AAAA-MM-DD-tema.html`. Debe ser autocontenido: estilos dentro, sin dependencias externas salvo que se pidan, y legible en móvil.
- Añade una línea a `docs/salidas/README.md` con fecha, título y para qué sirve.
- Tras el push, entrega el enlace raw.githack, como indica el proyecto.

## 5. Presupuesto de tokens

- **Primero lo gratis:** suites, `node --check`, el clicker. Un modelo solo juzga lo que un script no puede.
- Todo bucle (probar → corregir → probar) tiene tope: **3 rondas** salvo indicación. Al llegar al tope, para y resume qué falta.
- No releas archivos grandes enteros. Usa el índice de palabras clave y lee solo las secciones necesarias.
- No lances subagentes ni sesiones paralelas sin petición explícita.

## 6. Revisión

- El cambio lo revisa un modelo distinto del que lo escribió, con [revision/instrucciones.md](revision/instrucciones.md).
- Quien implementó recibe la revisión y decide cada punto: corregido, rechazado con motivo o convertido en pregunta para el usuario. La decisión queda en el mismo archivo de revisión.
- La revisión no modifica código.

## 7. Git

- Sin commit ni push sin instrucción del usuario. Cuando sí: mensajes claros y una tarea por commit.
- Si el proyecto declara una línea canónica (en Code Battle Lite, `trunk`), las ramas nacen de ella y el trabajo terminado vuelve a ella con merge.
- No mezcles en un mismo cambio arreglos de la pantalla y cambios del harness.
