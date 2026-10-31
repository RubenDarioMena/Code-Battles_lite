# Ciclo de recuperación del editor · Rocket Launcher

Evaluación inspirada en RLVR: un objetivo verificable, una perturbación reproducible y una señal de recuperación. Este arnés recopila evaluaciones y casos de regresión; no actualiza los pesos del modelo. Primera tanda: **10 intentos, cinco ejercicios en escritorio y los mismos cinco en móvil emulado**. No lanzar el piloto hasta que esté disponible la UI sin teclado de Claude. La calibración del arnés sobre el editor anterior no valida esa feature.

## Qué comprobamos

El agente debe reconstruir **el texto que había inmediatamente antes de la perturbación**, usando la UI sin teclado. No basta con que el parser acepte el texto ni con que el juego siga ejecutándose. La comparación inicial es exacta, incluidos espacios y saltos de línea; si una edición queda semánticamente equivalente pero cambia el formato se revisa como límite del criterio, no como bug automático.

La perturbación esperada puede producir código inválido, envolver el bloque equivocado o reemplazar una selección: eso por sí solo no demuestra un bug. Un posible bug necesita una regla incumplida y evidencia, por ejemplo «se pulsó el primer argumento y se seleccionó el segundo». La sintaxis se registra como diagnóstico, sin ejecutar programas.

## Máquina del ciclo

1. Congelar la versión del juego durante la tanda. Preparar un ejercicio y el formato **antes** de iniciar el intento. Mostrar el código al agente como referencia; activar la UI sin teclado y verificar visualmente su estado.
2. Sortear un umbral de 1–4 clics reales dentro del editor y sus botoneras. Los clics de mapa, Ajustes u otras partes no cuentan. Los gestos compuestos terminan antes de sincronizar; nunca interrumpir un doble clic o un arrastre a medias.
3. Al alcanzar el umbral, guardar en memoria el código, selección, scroll, contexto de programa y viewport. Elegir con un RNG propio con semilla un carácter **visible y pulsable**, pulsarlo con el ratón del navegador y pulsar un botón de código permitido. Copiar y pegar quedan excluidos por selector y descripción.
4. Suspender nuevas perturbaciones durante la reparación. Guardar lo que ocurrió tras el clic al carácter y tras el botón, incluida la selección que realmente produjo la UI.
5. El agente repara y verifica. Presupuesto inicial: 40 clics de reparación o 180 segundos desde el inicio del intento; revisar el estado entre gestos. Al alcanzar el límite, cerrar y clasificar. No utilizar teclado, atajos, portapapeles, restauración global del programa ni escritura de `.value`, `setRangeText`, `window.cmg.insertar` o APIs equivalentes durante el intento. Leer el DOM y tomar capturas está permitido. Si existe Deshacer en la nueva barra, registrar su uso: primero intentar una reparación localizada para ejercitar selección y edición.
6. Cerrar el intento. Recompensa 1 = texto exacto reconstruido tras un cambio efectivo, sin teclado observado; 0 = no reconstruido. Sin efecto, fallo del inyector o uso de teclado = inconcluso, recompensa desconocida. No repetir silenciosamente inyecciones sin efecto: conservarlas en el denominador.
7. Guardar resumen breve de **cada** intento. Exportar código completo, traza y captura únicamente si hay incidencia, límite de UI, fallo de recuperación, inyección inconclusa o carencia que reportar. Descartar la traza y código de los intentos sanos. Preparar el siguiente ejercicio después de cerrar.

El arnés observa entradas y registra eventos; no es un entorno de seguridad que impida que un agente haga trampas con herramientas externas. La disciplina de usar solo la UI forma parte del protocolo.

## Uso con Ego Browser

No se instala npm ni se cambia el juego. Servir la carpeta en el puerto reservado:

```sh
python3 -m http.server 8771 --bind 127.0.0.1
```

Leer primero la skill Ego Browser y su guía `ego-browser skill`. Abrir **un solo TaskSpace** para toda la tanda. Ejemplo de preparación, desde la raíz del proyecto:

```sh
ego-browser nodejs <<'JS'
const task = await taskSpace('Rocket · piloto de recuperación');
const page = task.page('p1');
await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1366, height: 900, deviceScaleFactor: 1, mobile: false
});
await page.goto('http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?forma=escritorio');
await page.waitForFunction(() => !!window.cmg);
const base = 'file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/';
const { piloto } = await import(base + 'recuperacion-ejercicios.mjs');
// Solo preparación: antes del intento y de activar el modo sin teclado.
await page.fill('#codigo', piloto[0].codigo);
console.log({ spaceId: task.spaceId, ejercicio: piloto[0].id, foco: piloto[0].foco });
console.log(await page.snapshot());
JS
```

Activar la nueva UI con su botón real y verificar el estado antes de `iniciar`. El arnés no supone el ID ni inventa el botón que Claude añadirá. Adaptar al resultado de Claude `config.botones` (solo inserción de código) y `config.area` (editor y botoneras que cuentan). Por defecto usa `#paleta button.atajo[data-i]` y `#editor, #paleta, #simbolos, #acciones-edicion`. Si cambia el textarea, adaptar `config.editor` y el reproductor. No reutilizar un adaptador que ya no corresponde a la UI.

En cada ronda, reanudar el **mismo** `spaceId` e importar el módulo. La fase, semilla y traza persisten en memoria de esa página. No recargar, navegar ni abrir otra página durante un intento: se perdería esa memoria. Los ejemplos de continuación usan `ID` como marcador que debe reemplazarse por el número impreso:

```js
const task = await taskSpace(ID);
const page = task.page('p1');
const { conectarCiclo } = await import('file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/recuperacion-editor.mjs');
const ciclo = await conectarCiclo(page, {
  directorio: '/Users/rubenmena/Documents/Dev/Code-battle-lite/.qa-recuperacion/piloto-rocket-01'
});
// Solo una vez por intento:
console.log(await ciclo.iniciar('R1 · escritorio'));
// En las rondas siguientes omitir iniciar. Elegir el gesto tras observar la UI:
console.log(await ciclo.click('#codigo'));
console.log(await ciclo.estado());
console.log(await page.snapshot());
```

`ciclo.click(selector)`, `ciclo.clickEn(x,y)` y `ciclo.dobleClick(selector)` sincronizan después del gesto. Para un drag o pulsación larga usar `await ciclo.paso(async () => { /* gesto completo con page.mouse */ })`. También observa clics hechos directamente con `page`, pero debe llamarse `await ciclo.sincronizar()` **después de cada gesto** para ejecutar la perturbación pendiente. El detector no inyecta clics mediante `HTMLElement.click()` ni reemplaza texto para provocar el cambio. No emitir una secuencia larga de gestos sin sincronización.

Cuando el estado indique `reparacion`, comparar visualmente con la referencia, reparar y cerrar:

```js
console.log(await ciclo.cerrar()); // El verificador decide recuperación exacta.
// O bien, ante una incidencia (solo una llamada a cerrar):
console.log(await ciclo.cerrar({
  clasificacion: 'bug-sospechado',
  esperado: 'Un clic sobre crawler selecciona la cadena "crawler" completa.',
  observado: 'Quedó seleccionado el segundo argumento "visual".',
  nota: 'Se reprodujo dos veces; ver coordenadas, selección y traza.',
  faltantes: []
}));
```

Las clasificaciones disponibles son `evaluar`, `bug-sospechado`, `limite-ui`, `fallo-agente` e `infraestructura`. Una carencia en la botonera va en `faltantes`, con el elemento deseado, su motivo y ejercicio; no se registra como bug por defecto. La propuesta de añadirlo se decide tras revisar si se repite y si se puede expresar con los controles existentes.

Los archivos se guardan bajo `.qa-recuperacion/<sesion>/` del proyecto, fuera de Git, o en el `directorio` absoluto indicado. `resumen.json` contiene todos los resultados; `caso-NN.json` y su PNG solo las incidencias. Cada caso contiene: semilla y estado del RNG, umbral, pasos numerados, coordenadas en CSS px, offset UTF-16, línea/columna, carácter solicitado, selección real tras pulsarlo, botón e inventario disponible, código inicial/previo/posterior/final, sintaxis, modo/contexto, viewport y URLs versionadas de CSS/JS. Una traza truncada queda marcada; no se debe presentar como evidencia completa. La captura corresponde al cierre; los estados intermedios se conservan como texto y selección.

Para la tanda completa fijar un `directorio` absoluto nuevo desde la primera conexión y repetirlo en todas las rondas. El arnés rechaza reutilizar una carpeta con otra sesión. Al cambiar a móvil **entre intentos cerrados**, ajustar el viewport, navegar con `?forma=movil`, preparar el siguiente fixture y conectar con el mismo `directorio`, la misma configuración y `reanudar: true`: restaura numeración, resúmenes y RNG desde el archivo. Sin esta opción, una recarga empieza otra sesión y no sobrescribe la anterior. Nunca navegar con un intento abierto. Al terminar, llamar `await task.finish({ keep: [] })`.

## Reproducir una incidencia

Preparar en el origen 8771 la misma versión de los recursos y los mismos controles, programa seleccionado, código previo, modo, tamaño de letra, reparto, viewport, selección y scroll del JSON. Hacer la preparación fuera de cualquier intento activo. Después:

```js
const { reproducirCaso } = await import('file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/recuperacion-editor.mjs');
console.log(await reproducirCaso(page, '/ruta/absoluta/caso-02.json'));
```

El reproductor verifica las precondiciones básicas, pulsa las coordenadas y el botón guardados y compara el texto resultante con el del caso. No restaura el código por debajo de la UI. Si cambió la geometría, un modo dependía de gestos anteriores o cambió la versión, reconstruir la secuencia de la traza: semilla sola no reproduce todas las decisiones del agente. Las URLs versionadas ayudan a identificar la build, pero no sustituyen conservar los archivos del juego de esa tanda.

## Matriz y criterios de revisión

`pruebas/recuperacion-ejercicios.mjs` exporta cinco referencias y el orden de los 10 intentos: R1–R5 a 1366×900 con `?forma=escritorio`, después R1–R5 a 393×852 con `?forma=movil`. No activar `?marco=1` para esta tanda sin teclado. Móvil emulado con ratón no demuestra funcionamiento táctil ni supresión del menú/teclado de Android o Safari.

| Referencia | Aspecto que observar |
| --- | --- |
| R1 | Dos argumentos, primer argumento frente al segundo, comillas completas. |
| R2 | `while`, sangría y expansión de selección a llamada, sentencia y bloque. |
| R3 | `if/else`, condiciones y duplicación de la variable hacia huecos. |
| R4 | Comentarios placeholder, argumentos vacíos, líneas vacías y sugerencias pertinentes. |
| R5 | Anidamiento, `??`, líneas que se ajustan al ancho y variantes de botones. |

La distribución uniforme sobre caracteres visibles favorece líneas largas y espacios. Para el primer piloto conservarla y registrar qué tocó; no atribuir cobertura de todos los gestos a diez sorteos. Después añadir estratos explícitos: primer/segundo argumento, cadena, comentario, borde semántico, handle de línea y hueco. Long press, arrastre/duplicación, expansión semántica y exactitud del dropdown necesitan además casos dirigidos; la perturbación aleatoria no garantiza ejercerlos.

No corregir bugs durante los 10 intentos: cerrar la tanda, agrupar incidencias, reproducir y convertir los casos confirmados en regresiones. Comparar sesiones de agentes/versiones usando misma semilla, referencias, viewport y presupuesto. La identidad de los botones/caracteres puede divergir si cambian el código visible o las decisiones del agente; usar el caso explícito para la comparación exacta. Reportar resultados como conteos descriptivos, sin inferir una tasa estable con esta muestra pequeña.

## Tokens y coste

`pruebas/uso-tokens.mjs` lee exclusivamente los eventos `token_count` de un rollout Codex que se le indique; no exporta el contenido de la conversación. No convertir porcentajes del límite de suscripción en tokens. Ejemplo:

```sh
node pruebas/uso-tokens.mjs /ruta/absoluta/al/rollout-de-esta-sesion.jsonl
```

Para registrar intervalos desde el ciclo, repetir estas opciones en cada conexión:

```js
const { leerUsoCodex } = await import('file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/uso-tokens.mjs');
const ciclo = await conectarCiclo(page, {
  directorio: '/Users/rubenmena/Documents/Dev/Code-battle-lite/.qa-recuperacion/piloto-rocket-01',
  leerUso: () => leerUsoCodex('/ruta/absoluta/al/rollout-de-esta-sesion.jsonl')
});
```

Guardar una lectura antes y otra después de la tanda, separadas del desarrollo/calibración del arnés. Los contadores pueden llegar después del turno; los intervalos por intento son de mejor esfuerzo. Si falta un contador, conserva la misma marca o retrocede, `uso` queda `null`, nunca cero inventado. El cierre del último intento puede necesitar una lectura posterior al turno para completar la medición global. También se puede suministrar un lector del proveedor de Claude con el mismo formato (`fuente`, `marca`, `input_tokens`, `output_tokens`, `total_tokens` y opcionales de caché/razonamiento); aquí no se implementa su extracción.

Entrada y salida se informan por separado. Caché es parte de entrada; razonamiento es parte de salida. No sumarlos otra vez al total ni convertirlos a dinero sin las tarifas y modelo realmente usados. OpenAI documenta que el uso puede ser desconocido, llegar con retraso y cambiar; no es una factura final: [Observability and usage](https://developers.openai.com/api/docs/guides/agents-api/observability).

Informe de la tanda: modelo y esfuerzo declarados; versión de UI; semilla; 10 resultados con recuperado/no recuperado/inconcluso; clics y tiempo por intento; tokens globales y por intervalo si están disponibles; bugs sospechados con enlace a evidencia; faltantes repetidos; límites de la emulación. No llamar «bug confirmado» a una dificultad del agente ni a la inserción aleatoria esperada.

## Calibración del arnés

Desde el mismo TaskSpace de QA, antes del piloto o en una tanda independiente:

```js
const { probarArnes } = await import('file:///Users/rubenmena/Documents/Dev/Code-battle-lite/pruebas/recuperacion-harness.mjs');
console.log(await probarArnes(task.page('p1')));
```

Esta prueba usa clics reales para inyectar, pero restaura fixtures con `fill`, simula un botón sin efecto y un fallo de recuperación, cambia a móvil emulado y comprueba la detección de teclado. Sus cuatro casos tienen modalidad `calibracion` y recompensa `null`. Verifica transporte, gating, exclusión de copiar/pegar, reproducción, verificador, exportación selectiva, reanudación y lectura de tokens. **No se cuentan como los 10 intentos del piloto.**

## Prompt para el agente que ejecute el piloto

> Lee AGENTS.md, README.md, docs/VISION.md, el estado reciente de PROGRESO.md y docs/CICLO-RECUPERACION-EDITOR.md. Prueba Rocket Launcher solo en localhost:8771, con Ego Browser y un único TaskSpace. No delegues ni modifiques el juego durante la tanda. Primero confirma visualmente que la UI sin teclado nueva existe y está activa; adapta los selectores del arnés a sus controles reales. Si no existe, informa la precondición pendiente sin presentar calibración como piloto. Ejecuta los 10 intentos de recuperacion-ejercicios.mjs con la semilla rocket-piloto-v1. Prepara cada fixture antes del intento. Todos los gestos del intento pasan por el ciclo y se sincronizan al terminar. Tras la perturbación, repara solo mediante controles de la UI, sin teclado, portapapeles, restauración global ni APIs que escriban el código. Respeta 40 clics/180 segundos. Separa inserciones esperadas, fallos del agente, límites de UI y bugs sospechados. Para estos últimos escribe regla esperada y resultado observado, conserva el JSON/PNG y reproduce el caso. Registra carencias de lenguaje y repeticiones. Mide el uso del proveedor antes y después de la tanda y conserva null si no está disponible. Al cerrar los 10 intentos entrega un informe breve con enlaces a evidencias, conteos de resultados y tokens, sin arreglar bugs todavía. Cierra el TaskSpace al terminar.
