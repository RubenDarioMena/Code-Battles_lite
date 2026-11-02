# Plan de efectos visuales (VFX)

Propuesta para empezar a añadir efectos visuales a War (Rocket Launcher) y Factory (Tres vistas) dentro de la arquitectura actual: JavaScript y CSS sin compilación, Three.js r128 por CDN, plano 2D en canvas y simulación de paso fijo con semilla. Estado al 29 de octubre de 2026: **propuesta validada con un prototipo desechable; los juegos no tienen efectos nuevos**.

## Resumen para decidir

- **Qué.** Efectos que expliquen lo que pasa en el mapa. En War: disparo, impacto, fallo, derribo, atasco, reparación, brecha y lectura de sensores. En Factory: recoger, entregar, derrame, viaje vacío y producto terminado.
- **Cómo.** Cada efecto es una **receta de datos**: unas pocas líneas con cantidades, tiempos, tamaños y colores. Un módulo compartido la convierte en partículas que dependen solo del tiempo, y las dibuja igual en 3D y en el plano.
- **Sin riesgo para la simulación.** La simulación anota los sucesos visibles en una lista. Ninguna regla ni ningún programa del jugador la lee. Los efectos no usan el RNG de la partida.
- **Práctico para Claude.** No hacen falta imágenes ni herramientas externas: cambiar un efecto es cambiar números. Claude comprueba el resultado con capturas de un Chromium sin pantalla, como en el prototipo de este plan.
- **Revisión del usuario: visual.** En cada fase hay que abrir el laboratorio y el juego en PC y teléfono y responder [cuatro preguntas](#revisión-del-usuario). Las decisiones de gusto (intensidad, humo, restos) se eligen con `?poc=1`, igual que las paletas.

## Enfoque

1. **Eventos visuales.** La simulación añade `{ k, n, t0, x, y, z, … }` a `mundo.fx` cuando ocurre algo visible. Es una anotación: no cambia ninguna regla, no entra en `instantanea()` (lo que leen los programas) ni en la telemetría. Ya existe un precedente: `mundo.explosiones` y `mundo.derribados`. Este último se anota hoy, pero no se dibuja.
2. **Recetas.** Cada tipo de evento tiene una receta con capas: destello, bola de fuego, chispas, aro, humo, restos… Viven en un archivo de datos por juego.
3. **Partículas sin estado.** La posición, el tamaño, la opacidad y el color de cada partícula son una fórmula del tiempo transcurrido desde el evento. Su variación sale de un hash de la semilla del evento. No hay nada que integrar ni guardar entre fotogramas: pausar, cambiar de 3D a plano, reconstruir la escena o saltar fotogramas a 8× no rompe nada, y la misma partida se ve igual cada vez.
4. **Dos dibujantes.** Three.js r128 para el 3D: dos nubes de puntos con un shader pequeño, una normal (humo, restos) y otra aditiva (luz). Canvas 2D para el plano de War y para Factory: sellos de degradado teñidos.
5. **Laboratorio.** Una página que reproduce cada receta aislada, en 3D y en plano. Tiene una barra de tiempo y una **hoja de contactos**: el mismo efecto en varios instantes y a la escala real del juego. Sirve para que Claude itere solo con capturas y para la revisión visual del usuario.

## Por qué encaja con la arquitectura

- Un módulo `shared/js/vfx.js` sin dependencias, como `shared/js/iconos.js`. La carpeta `shared/` ya está en la lista permitida del paquete de Netlify. No hay npm, compilación ni librerías nuevas.
- Repite decisiones que ya están tomadas. Hay brillo por calcos aditivos y texturas pintadas en un canvas (`textura()` en `juego.js`), sin luces simuladas ni post-proceso. Los colores salen de los tokens de `base.css` (`--explosion`, `--misil`, `--enemigo`, `--rol-*`, `--ok`, `--bad`), así que las paletas A/B/C y futuros temas se aplican solas.
- **Determinismo.** Los efectos nunca llaman a `mundo.rng()` ni escriben en el estado de la simulación. Su azar es un hash propio. El tiempo visual sale del tiempo de simulación más la interpolación `off` que ya calcula `bucle()`. Los efectos se detienen con la pausa y se aceleran con 2×–8×. Además, son compatibles con la grabación de vídeo por tiempo de simulación que recomienda `INFORME-STYKANIMATE.md`.
- **Interacción intacta.** Las nubes de puntos no cuentan al elegir con el puntero (`raycast` vacío, como los calcos), no escriben profundidad y se dibujan sobre los calcos. Etiquetas, globos y avisos siguen en la capa HTML, por encima.
- **Sin WebGL**, el juego ya cae al plano. Los efectos del plano usan las mismas recetas.

## Por qué es práctico que los genere Claude

- Una receta es texto corto y revisable en un diff. Un efecto nuevo suele ser una receta y una línea que anota el evento.
- Sin activos binarios: nada de hojas de sprites, Blender ni After Effects. Las texturas se generan en código y se pueden volver a teñir con la paleta.
- El único GLSL son unas 25 líneas, escritas una vez.
- **Ciclo cerrado:** ajustar números → capturar la hoja de contactos → mirarla → corregir. Funciona en esta nube (WebGL por SwiftShader) y no depende de la revisión técnica del usuario.

## Prototipo de validación

Hecho el 29 de octubre de 2026 fuera del repositorio. Era un prototipo desechable, sin cambios en los juegos. Se probaron:

- War real en Chromium sin pantalla: WebGL disponible, Three r128 cargado, partida del reto 4 capturada en 3D y en plano.
- Núcleo sin estado, dibujante r128 (`THREE.Points` + `ShaderMaterial`) y dibujante 2D con tres recetas (disparo, impacto y derribo de dron). Se compararon con la explosión actual en una hoja de contactos de 0,04 a 1 s y a escala de juego.
- **Dos iteraciones bastaron** para corregir lo que mostraba la primera hoja: el impacto en suelo quedaba dentro de la oruga y el fogonazo del lanzador no se veía. El aro del radio de daño (1,3 m) se lee en 3D y en el plano.
- Coste de CPU: **60 efectos vivos a la vez → 869 partículas, 0,7–0,8 ms por fotograma** para calcularlas.
- Límites: SwiftShader dibuja en la CPU, así que sus fotogramas por segundo no representan un teléfono. El coste de GPU (sobre todo destellos grandes aditivos muy cerca de la cámara) se mide en los dispositivos reales. En esta nube los CDN (cdnjs, jsdelivr) están bloqueados. Las pruebas sirvieron la misma Three r128 desde el registro npm interceptando la petición, sin tocar el juego.

## Diseño técnico

### Receta

```js
impacto: { capas: [
  // forma · mezcla · cuántas · vida (s) · movimiento · tamaño (m) · opacidad · color a lo largo de la vida
  { forma: "brillo", mezcla: "suma", n: 1, vida: .16, alto: .5, tam: [3.2, 1.4], alfa: [1, 0], color: ["#FFF4DC", "explosion"] },
  { forma: "brillo", mezcla: "suma", n: 18, vida: [.3, .6], alto: .5, dir: "esfera", vel: [6, 11], arrastre: 3.5, grav: -9.8, suelo: true,
    tam: [.12, .03], alfa: [1, 0], color: ["#FFF4DC", "misil"], estela: 3 },
  { forma: "brillo", mezcla: "suma", n: 36, vida: .34, alto: .05, dir: "anillo", radioFinal: 1.3, tam: [.05, .18, .08], alfa: [0, 1, 0], color: ["explosion"] },
  { forma: "humo", mezcla: "normal", n: 6, retraso: [.04, .1], vida: [.7, 1.1], alto: .6, dir: "esfera", vel: [.4, 1], arrastre: 3,
    deriva: [0, 0, .6], tam: [.5, 1.5], alfa: [.5, .3, 0], color: ["edge", "grid-2"] },
] }
```

- `forma`: `brillo` (centro intenso), `disco` (borde nítido, para restos) o `humo` (suave).
- `mezcla`: `suma` (luz, no oscurece) o `normal`.
- `n`, `retraso` y `vida`: un número o un intervalo `[mín, máx]` que se sortea por partícula.
- Movimiento: `dir` (`esfera`, `hemisferio`, `cono` hacia el rumbo del evento, `anillo`, `arriba`), `vel`, `arrastre`, `grav`, `deriva`, `suelo` (se queda donde toca el suelo), `alto` y `adelante` (desplazamiento del origen).
- `tam`, `alfa` y `color`: claves repartidas a lo largo de la vida. El color admite tokens de `base.css` o hex.
- `estela`: copias anteriores, más pequeñas, para alargar chispas sin geometría de líneas.
- `ciclo`: capa en bucle para efectos de estado. Cada partícula renace cada `ciclo` segundos con otra semilla, y sigue sin estado.

### Núcleo `shared/js/vfx.js`

- `evaluar(evento, receta, tv, colores, calidad, emitir)`. Para cada partícula se calcula τ = tv − t0 − retraso. La posición es p₀ + d·v·(1 − e^(−kτ))/k + deriva·τ + ½·g·τ². Con `suelo`, la partícula se detiene en el instante en que z = 0. Tamaño, opacidad y color salen de sus claves.
- El núcleo no llama a `Math.random`, `Date.now` ni `performance.now`, y no escribe en `mundo`. Una prueba de lógica lo comprueba.
- `Render3D(THREE, grupo)` crea dos `THREE.Points` con búfer fijo y `setDrawRange`. El tamaño va en metros con perspectiva: `gl_PointSize = tam · escala / −z`, donde escala = alto del búfer / (2·tan(fov/2)). Tiene un límite según el máximo del dispositivo. Con niebla usa los fragmentos de niebla de r128 para que el humo se funda como el resto. Va en un grupo propio, creado una vez fuera de `fijo`/`movil`.
- `Render2D()` usa sellos de degradado radial en caché por forma y color cuantizado. Dibuja con `drawImage`: primero humo y restos, después la luz con `lighter`. Las coordenadas son las del mapa, y en el plano se ignora la altura, como hace hoy con los drones.
- Calidad y presupuesto: ver [más abajo](#calidad-presupuesto-y-accesibilidad).

### Eventos de War

| Evento | Dónde se anota (`juego.js`) | Efecto |
| --- | --- | --- |
| `disparo` | `pasoLanzador`, al crear el misil | Fogonazo por la boca de la torre (rumbo `yaw`), chispas en cono y humo |
| `impacto` | `explotar`, con `golpe` | Destello, bola de fuego, chispas, aro del radio de daño y humo |
| `fallo` | `explotar`, sin `golpe` | Polvo gris y aro tenue: el fallo de puntería se ve, y la precisión es la métrica a optimizar |
| `derribo` | `explotar`, `e.hp <= 0` (con `tipo`) | Oruga: chatarra en el suelo. Dron: chatarra que cae. Dron frío: chispas en `--enemigo-frio` |
| `atasco` | `pasoLanzador`, rama del atasco | Chispas en `--bad`; humo oscuro en bucle mientras `atascado` |
| `reparado` | `pasoReparador` | Chispas verdes que suben; chispas en bucle mientras el robot repara |
| `brecha` | `paso`, al cruzar `LINEA_BASE` | Pulso rojo a lo largo de la línea de base |
| `lectura` | `alMensaje`, `fn: "detect"` | Onda en el suelo del color `--s-vibra`: el código «toca» el mundo |

Un ayudante `fx(k, datos)` hace `mundo.fx.push({ k, n: mundo.sigFx++, t0: mundo.t, ...datos })`. La lista se poda en `paso` como `explosiones`. `explosiones` y `derribados` se conservan mientras haya dibujos que dependan de ellas, y se retiran cuando las recetas los sustituyan. El destello rojo del enemigo golpeado (0,25 s) se conserva, porque informa.

### Eventos de Factory

| Evento | Dónde se anota (`Tres vistas/js/juego.js`) | Efecto |
| --- | --- | --- |
| `recoger` | `iniciarOrden`, `fin()` devuelve `"ok"` | Destello del color del material en la puerta |
| `vacio` | `fin()` devuelve `"viaje_vacio"` | Polvo gris |
| `entregar` | `fin()` devuelve `"ok"` | Partículas que entran por la puerta |
| `rechazado` | `fin()` devuelve `"rechazado"` | Chispas en `--bad` |
| `derrame` | `fin()` devuelve `"derrame"` | Salpicadura del material y `--bad` |
| `producto` | `paso`, al completar un ciclo | Destellos del color del material sobre la máquina |

Mientras una máquina procesa, hay un brillo suave en bucle. Factory no interpola su dibujo: los efectos usarán `mundo.t + acum` para no avanzar a saltos de 0,05 s. El dibujo del robot no cambia en esta propuesta.

### Reloj visual

- Durante la partida, el tiempo visual es `mundo.t + off`. Se detiene con la pausa y mientras los programas deciden, igual que el mundo.
- Al terminar (`mundo.fin`), sigue con el reloj real un máximo de 2 s para que acaben las últimas explosiones.
- Reiniciar o cambiar de reto crea un `mundo.fx` vacío.

### Calidad, presupuesto y accesibilidad

- **Completos**, **reducidos** (40 % de partículas, destellos pequeños) y **sin efectos**. Sin efectos conserva un marcador informativo del impacto: el radio de daño y el acierto o fallo.
- Al principio la calidad se elige con `?vfx=` y en el selector `?poc=1` (tabla `VARIANTES`). En la fase 4 pasa a Ajustes, con `cmg-juego-efectos` y `cmg-banco02-ui-efectos`.
- `prefers-reduced-motion` elige reducidos y quita los destellos. El CSS ya respeta esa preferencia.
- Presupuesto inicial: 2000 partículas en PC y 800 en teléfono, para ajustar con mediciones. Si se supera, se descartan primero el humo y luego los restos de los efectos más antiguos.
- Sin destellos de pantalla completa ni sacudida de cámara: la cámara es del jugador y el mapa se lee.

### Legibilidad

- Los efectos de evento duran como mucho 1,2–1,6 s, y los destellos 0,2 s o menos.
- La luz suma y no oscurece. El humo es tenue y breve. Nada tapa máquinas, mira, selección, etiquetas ni globos.
- Los colores tienen significado: ámbar para la munición propia, rojo enemigo para el enemigo, `--bad` para atasco, brecha y rechazo, `--ok` para reparación, el color de función para la máquina y el color del material en Factory.
- Cada efecto se revisa también a escala de juego (cámara por defecto, mapa completo) y a 8×.

## Fases

Cada fase es una entrega pequeña, con pruebas y una revisión visual del usuario antes de seguir.

### Fase 0 · Base y laboratorio (sin cambios visibles en los juegos)

- `shared/js/vfx.js` (núcleo y dos dibujantes), `Prototypes/Rocket Launcher/js/efectos.js` (recetas de War) y `laboratorio/vfx.html`. El laboratorio queda fuera de la lista de Netlify y se abre en `http://localhost:8770/laboratorio/vfx.html`, también desde el teléfono por la Wi-Fi.
- Pruebas: `pruebas/vfx.cjs` (mismo evento → mismas partículas, vida, calidad, esquema de recetas, sin `Math.random`) y `pruebas/vfx-capturas.mjs` (hojas de contactos en PNG).
- Revisión del usuario: hojear el laboratorio y elegir el tono general.

### Fase 1 · War: disparo, impacto, fallo y derribo

- `mundo.fx` en la simulación, el grupo de efectos en `V3` y en `dibujar2D`. Sustituye la esfera y el disco actuales, conservando el radio de daño en el aro. Calidad por `?vfx=` y `?poc=1`.
- Prueba de determinismo: mismo reto, semilla y programa con efectos completos y con `?vfx=no` → telemetría idéntica (tiempo, derribos, impactos, misiles, atascos).
- Revisión del usuario: retos 1, 3 y 4 (enjambre) en PC y teléfono, a 1× y 8×.

### Fase 2 · War: atasco, reparación, brecha y lecturas

- Efectos en bucle por estado, el pulso de brecha y la onda de `detect`. Un barrido sutil de `autoTarget` queda como variante opcional, porque se llama cada 0,5 s y podría ser ruido.
- Revisión del usuario: ¿ayudan a entender el programa o distraen?

### Fase 3 · Factory

- `efectos.js` de Factory, eventos de la tabla y reloj interpolado solo para los efectos.
- Revisión del usuario: los seis retos, especialmente los de derrames y viajes vacíos.

### Fase 4 · Ajustes y cierre

- «Efectos» en Ajustes de ambos juegos, limpieza de los dibujos antiguos y README/VISION actualizados.

## Verificación en cada fase

- `node pruebas/interaccion.cjs`, `node pruebas/vfx.cjs` y `node --check` de los scripts tocados. Subir `?v=N` en el `index.html` correspondiente.
- Suites de navegador en el puerto 8771: comprueban que elegir unidades, el doble toque y el cuadro siguen funcionando con las nubes de puntos.
- Hojas de contactos y capturas de PC y móvil emulado, a 1× y 8×, revisadas por Claude antes de entregar.
- Coste: contador de partículas y milisegundos de CPU en el laboratorio. Los fotogramas por segundo reales se miden solo en Android/iPhone.

## Revisión del usuario

En el laboratorio y en el juego, en PC y en el teléfono:

1. ¿Se entiende qué pasó (disparo, acierto, fallo, derribo…)?
2. ¿Tapa algo que necesitas ver (unidades, mira, selección, etiquetas)?
3. ¿Va fluido en tu teléfono, también con el enjambre?
4. ¿Cansa a 4× u 8×?

## Riesgos

- **GPU de teléfono.** El coste está en rellenar sprites grandes aditivos. Se mitiga con tamaños acotados, presupuesto, calidad reducida y medición en el S24 Ultra y el iPhone.
- **Legibilidad.** Se cubre con las reglas de arriba y la revisión a escala de juego.
- **Determinismo.** `mundo.fx` no se lee en reglas ni en la instantánea, y la prueba de telemetría idéntica lo vigila.
- **Pruebas de navegador.** La interacción del mapa se protege con el `raycast` vacío y se comprueba con las suites existentes.
- **Detalles menores.** El humo con mezcla normal no se ordena por profundidad: con humo tenue no se nota. El tamaño máximo de punto depende del dispositivo (aquí 1023 px), y los destellos grandes solo lo rozan con la cámara muy cerca.

## Descartado

- **Hojas de sprites o vídeos pre-renderizados.** Exigen herramientas de arte externas, no se tiñen con las paletas y Claude no puede producirlos bien.
- **Librerías de partículas** (three.quarks, three-nebula, Proton). Añaden dependencias y dudas de compatibilidad con r128.
- **Post-proceso con bloom** (`EffectComposer`). Requiere más scripts, pesa en el teléfono y contradice los calcos aditivos ya elegidos.
- **GSAP, Lottie o animaciones CSS en el mapa.** Van por el reloj real y no se reproducen con la simulación. El CSS queda para la interfaz (HUD, avisos, banner).

## Fuera de alcance por ahora

- **Sonido.** `mundo.fx` podría alimentarlo más adelante.
- **Sacudida de cámara, post-proceso y personajes animados.**
- **Vídeo.** El reloj visual ligado al tiempo de simulación lo deja preparado.

## Glosario mínimo

- **VFX:** efectos visuales (destellos, chispas, humo, restos).
- **Partícula:** un punto con tamaño, color y vida corta. Muchas juntas forman un efecto.
- **Mezcla aditiva:** la partícula suma luz a lo que hay detrás. Brilla y nunca oscurece.
- **Shader:** pequeño programa que la tarjeta gráfica ejecuta para pintar cada partícula.
- **Hoja de contactos:** una imagen con el mismo efecto en varios instantes, para revisarlo sin reproducirlo.
