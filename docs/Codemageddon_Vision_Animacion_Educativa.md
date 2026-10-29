# Codemageddon — Visión de animación educativa

**Versión:** 1.0 · **Fecha:** 28 de octubre de 2026 · **Estado:** visión y propuesta de experimentación, no arquitectura implementada.

## 1. Propósito

Construir una identidad de enseñanza audiovisual para Codemageddon. Los conceptos de programación se explicarán mediante **metáforas visuales claras**, animación de código, procesos representados físicamente y **humor de personajes stickman**. El resultado principal serán **videos educativos editables y reproducibles**, no un sistema generalizado de tutoriales interactivos dentro del juego.

El enfoque busca combinar la claridad técnica con la retención emocional: una explicación debe ser correcta, visible, memorable y entretenida. El humor no reemplaza la precisión de la enseñanza; actúa como apoyo para recordar el principio.

## 2. Lenguaje creativo: dos capas separadas

### A. Comedia física y personajes

Los **stickmen** son actores y vehículos de humor. Su animación se produce en **StykAnimate**, donde se preserva el proyecto `.styk` editable. Se exportan secuencias PNG con canal alfa (o APNG/WebM con alfa cuando esté probado) para integrarlas en composiciones. Los personajes no necesitan incorporar el código ni la narración dentro del archivo exportado.

### B. Código, conceptos y abstracciones

Sobre un fondo oscuro, código legible con resaltado de sintaxis coherente con el editor del juego (confirmar si el editor concreto usa **CodeMirror**), secciones que se iluminan conforme avanza la narración, flechas, diagramas, números, variables, colas, estados y líneas de tiempo. Esta capa se anima por separado mediante **Motion Canvas** y, según el experimento, componentes de **Remotion** o **HyperFrames**.

### C. Composición

**Remotion** puede ensamblar voz, música, efectos, código, conceptos y las secuencias transparentes de los stickmen. **Motion Studio** se considera como asistente de dirección y producción sobre Remotion: guion, narración, storyboard, diseño de escenas y sincronización con palabras. No se impone una única herramienta para todas las etapas.

## 3. Escena emblemática: `await` y espera activa

Se representan dos stickmen frente a una cinta o lugar de entrega donde llegará una caja.

- **Espera activa:** un stickman se agacha repetidamente para intentar recoger la caja inexistente. Cada intento equivale a una comprobación inútil. Los movimientos aumentan su frecuencia, el contador de intentos asciende, el texto deja de ser legible y aparece un efecto de **motion blur**: el contador termina pareciendo una mancha o rastro luminoso. El personaje queda exhausto, se tambalea y se desploma.
- **Espera asíncrona:** el otro personaje usa una espera no bloqueante (`await`) sin repetir acciones inútiles. En la puesta en escena, aguarda tranquilo. Tras ver colapsar a su vecino, lo mira, se encoge de hombros y sigue esperando la caja.
- **Resolución:** la caja llega y el flujo puede continuar.

**Precisión pedagógica:** `await` por sí solo no garantiza eficiencia ni significa que una función siempre deje libre cualquier hilo: el comportamiento depende del lenguaje, las promesas, las operaciones y el entorno. La comparación debe ser explícitamente entre **polling ocupado** (por ejemplo, un bucle que comprueba reiteradamente sin pausa) y **espera asíncrona de una operación real**. No afirmar que todo código «sin await» funciona como espera activa.

**Diseño del chiste:** el espectador primero entiende qué hace el personaje, luego percibe la aceleración absurda y finalmente observa el contraste inmóvil del compañero. El humor debe reforzar la diferencia entre consumir recursos comprobando repetidamente y esperar la resolución de una operación.

## 4. Otros conceptos potenciales

- **Variables:** recipientes etiquetados cuyo contenido cambia, con una representación simultánea del código.
- **Condicionales:** bifurcaciones con compuertas que se iluminan únicamente cuando la expresión es verdadera.
- **Bucles:** robots repitiendo tareas, diferenciando `for`, `while` y condiciones de salida; humor visual cuando se omite la condición.
- **Funciones:** una máquina que recibe entradas y produce salidas, diferenciando parámetros de valores retornados.
- **Eventos y promesas:** una estación de entregas con señales y avisos, evitando analogías que confundan espera con ejecución simultánea.
- **Procesos de fábrica:** relacionar instrucciones con transporte, recogida, entrega, sensores, energía y estados en la simulación de Codemageddon.

## 5. Principios de producción

1. **Voz y objetivo educativo primero:** definir qué debe entender el jugador y qué malentendido hay que evitar.
2. **Comparar metáforas antes de escoger herramientas:** pedir dos propuestas editables por motor, no múltiples videos opacos.
3. **Conservar la fuente:** guion, storyboard, proyecto de personajes, componentes, escenas y recursos exportados. Nunca conservar solo el MP4.
4. **Animación modular:** código, diagramas, personajes, efectos, subtítulos y sonido se mantienen como capas o componentes independientes.
5. **Sincronía con la narración:** vincular efectos a señales semánticas o palabras, no solamente a tiempos aproximados.
6. **Identidad consistente:** fondo oscuro, tipografía clara, acentos de color y código legible. Confirmar el resaltador real del editor del proyecto antes de replicarlo.
7. **Correctitud:** revisar la metáfora con un pequeño conjunto de casos límite; no depender de una autoevaluación de IA como garantía de comprensión humana.
8. **Uso comercial y costos:** verificar licencia de cada framework y de los recursos incluidos; no activar servicios facturables sin autorización expresa.

## 6. Herramientas y roles

| Herramienta | Papel propuesto | Reutilización | Licencia / advertencia |
|---|---|---|---|
| **StykAnimate** | Actuación, gestos, caídas y comedia stickman | Proyecto `.styk`, figuras, movieclips, PNG transparentes | GPL-3.0-or-later para la aplicación. Su sitio aclara que permite monetizar las animaciones creadas. Revisar licencias de recursos ajenos. |
| **Motion Canvas** | Animaciones vectoriales de conceptos, código y diagramas | Escenas y funciones TypeScript editables | MIT; permite uso comercial. |
| **Remotion** | Composición y render final, subtítulos, audio y efectos | Componentes React, props, composiciones | Uso comercial permitido; gratuito para individuos y organizaciones de hasta tres empleados, con licencia requerida en otras condiciones. No es OSI open source. |
| **Motion Studio** (`domdexter/motion-studio`) | Flujo guiado por voz, storyboard y edición asistida con IA | Especificaciones de escena, proyectos y elementos editables | MIT para el proyecto; su motor Remotion tiene condiciones propias. Proyecto incipiente; resultados sin validar de forma independiente. |
| **HyperFrames** | Alternativa HTML/GSAP para motion graphics, videos y composiciones portables | Carpetas HTML/CSS/JS, componentes y plantillas editables | Apache-2.0; comercial permitido. Candidato comparativo, no obligatorio en primera iteración. |

**Exclusión:** **Anything2Explainer** no entra en la selección de producción por su licencia PolyForm Noncommercial. Puede ser referencia conceptual sin copiar su código ni recursos restringidos.

**Nota sobre MCPs:** el informe de StykAnimate documenta múltiples proyectos MCP creados recientemente, pero no acredita estabilidad operativa. Para producción, mantener `.styk` como fuente, exportar de modo verificable y realizar prueba real de creación → revisión → modificación → exportación. No convertir a MCP en requisito del espectador.

## 7. Arquitectura orientativa (no obligatoria)

```text
Objetivo de aprendizaje y guion
  ├── Storyboard / variantes de metáfora
  ├── StykAnimate (.styk): animación de personajes → PNG alfa
  ├── Motion Canvas (TS): código, conceptos y diagramas → clips/capas
  ├── Motion Studio: dirección, voz, tiempos, propuestas de escena
  └── Remotion (React): composición + narración + SFX → video final
```

No existe una conversión garantizada y completa de escenas de Motion Canvas a Remotion ni de `.styk` a esqueletos React. Intercambiar recursos estáticos o renderizados es más confiable que intentar trasladar timelines completos. HyperFrames permite otra ruta mediante HTML/GSAP y exportación reproducible, a comparar en un experimento pequeño.

## 8. Experimento comparativo y criterios

**Piloto:** pieza de 20–40 segundos sobre `await` frente a espera activa. Mantener el mismo guion y condiciones para todos los experimentos. Realizar dos propuestas visuales en Motion Canvas y dos en Motion Studio/Remotion; si conviene, incorporar una variante HyperFrames. Mantener el mismo personaje StykAnimate en todas.

**Evaluación cualitativa:** (a) claridad del concepto, (b) potencia y ritmo del chiste, (c) sincronización con la voz, (d) legibilidad del código, (e) facilidad de corregir o cambiar el guion, (f) independencia de componentes, (g) tiempo de trabajo y costo en tokens, (h) reproducibilidad del render.

**Prueba de reutilización obligatoria:** después de generar una escena, cambiar el lenguaje del texto, el intervalo del contador y la duración de la espera sin rehacer la composición desde cero. Guardar resultados y registrar qué porcentaje del trabajo requiere intervención manual; no inventar métricas antes de medirlas.

## 9. Organización sugerida

```text
educational-animation/
  vision.md
  scripts/await-busy-wait.md
  storyboards/await-variants.md
  characters/stickman-wait.styk
  characters/exports/png-sequence/
  concepts/motion-canvas/
  concepts/hyperframes/
  compositions/remotion/
  motion-studio-projects/
  audio/voice/
  audio/sfx/
  renders/
  experiments/observations.md
  licenses/ASSET-LICENSES.md
```

Guardar referencias y manifiestos del render (resolución, FPS, duración, versión de herramientas, comandos y fuentes). Los efectos de motion blur deben ser reproducibles; evitar acelerar indiscriminadamente secuencias PNG de baja frecuencia de cuadros.

## 10. Alcance y trabajo futuro

**Ahora:** dominar la producción de videos, desarrollar un estilo propio y una biblioteca reutilizable de metáforas visuales y componentes. Preparar demostraciones cortas antes de intentar una serie de lecciones.

**Después, solo como nota de baja prioridad:** evaluar tutoriales interactivos, simulaciones modificables por el aprendiz y evaluación automática de claridad de metáforas. Su integración con el juego no forma parte del alcance inmediato. La evaluación humana seguirá siendo relevante.

## 11. Material para ver y evaluar

Los enlaces siguientes son páginas de demostraciones o colecciones verificadas. No todos son videos individuales de YouTube y **no se han reproducido íntegramente aquí**; se indican claramente para evitar atribuirles resultados que no se han inspeccionado.

- **Motion Canvas:** [Galería de ejemplos con proyectos](https://github.com/motion-canvas/examples) — consultar **Could This Asset Be Code** y **One Year of Motion Canvas**; [editor y demostración en la web oficial](https://motioncanvas.io/).
- **Remotion:** [Showcase oficial de trabajos](https://www.remotion.dev/showcase) — elegir al menos dos producciones de categorías distintas; [canal oficial de YouTube](https://www.youtube.com/@Remotion).
- **StykAnimate:** [sitio oficial con demo y ejemplos](https://stykanimate.com/) y [tutorial interactivo con reproducción de poses](https://stykanimate.com/docs/basics/).
- **HyperFrames:** [Inspiration — videos reproducibles](https://hyperframes.heygen.com/examples) — elegir dos: uno explicativo y uno centrado en tipografía; [ejemplos técnicos con fuente](https://github.com/heygen-com/hyperframes/blob/main/docs/examples.mdx).
- **Motion Studio:** [repositorio y flujo de trabajo](https://github.com/domdexter/motion-studio) y [guía del usuario](https://github.com/domdexter/motion-studio/blob/main/docs/USER_GUIDE.md). No se verificaron dos videos públicos hechos específicamente con este repositorio; se excluyen supuestos enlaces de demostración no confirmados.

## 12. Fuentes principales

- Informe recibido: `stykAnimator.md` (investigación 28-oct-2026).
- StykAnimate: https://stykanimate.com/eula/ y https://stykanimate.com/docs/export/
- Motion Canvas: https://github.com/motion-canvas/motion-canvas/blob/main/LICENSE y https://motioncanvas.io/docs/
- Remotion: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md y https://www.remotion.dev/docs/license/pricing
- Motion Studio: https://github.com/domdexter/motion-studio
- HyperFrames: https://github.com/heygen-com/hyperframes/blob/main/LICENSE

**Decisión actual:** no fijar el stack definitivamente hasta ver resultados y hacer la prueba de edición posterior. El criterio principal no es solo la calidad del primer video, sino la calidad pedagógica y la reutilización futura.
