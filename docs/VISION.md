# Visión y alcance

Code Battle Lite enseña programación mediante retos breves de defensa y automatización. El jugador programa máquinas y observa sus resultados en un mundo legible, con acceso directo a estadísticas y código.

## Prioridades (15 de noviembre de 2026)

- **Steam primero, Android después.** El navegador queda como canal de QA. Tecnología web, con Electron y Capacitor.
- **Equipo modesto con efectos de batalla cuidados**, mediante niveles de calidad.
- **Juego modular.** El editor por botones debe servir a otra aplicación o a otra mecánica.
- **Simulación separada de los gráficos**, con representación 2D y 3D intercambiable en caliente.
- **Diseño abierto.** El estilo, la interfaz y el combate actuales de War, Factory y Campaign no son definitivos: se contemplan el control manual de unidades y combates con muchas más unidades.
- **Trabajo con agentes.** El autor revisa desde el teléfono; los agentes verifican solos.

La arquitectura y sus fases están en [PLAN-ARQUITECTURA.md](PLAN-ARQUITECTURA.md).

## Pilares

- Legibilidad: código y datos fáciles de leer, en PC y en móvil.
- Simulación reproducible: paso fijo y fallos controlados por semilla.
- JavaScript y Python reales como lenguaje del jugador.
- Interfaz propia en HTML/CSS con paleta de programación y herramientas accesibles.

## Base actual

Describe el punto de partida, anterior a la reestructura.

JavaScript real en Web Workers, escenarios de lanzadores y sensores, editor con selección múltiple, mapa 3D y plano, inspector de estadísticas, telemetría, Ajustes y distribución configurable. El código está concentrado en `js/juego.js`; `js/layout.js` mantiene la lógica de pantalla separada mediante `window.cmg`.

La interfaz permite variar el orden y orientación de mapa/código. Al escribir en móvil se prioriza el editor y su paleta; el divisor permite ocupar toda el área con un panel.

## Factory / Tres vistas

La recogida de materiales conserva su simulación y ofrece bloques, pseudocódigo EN/ES y JavaScript como vistas del mismo programa. Ahora comparte la distribución adaptable y el estilo de Rocket Launcher, con las paletas propias de cada modo. Mantiene el plano 2D, el guardado del banco 02 y su API de R1; ambos juegos comparten ahora las herramientas de edición sin teclado y barra, con adaptadores para sus programas y sugerencias. War también ofrece seudocódigo ES/EN.

## Próximas decisiones

- Continuar QA de teclado, selección táctil, gestos y accesibilidad de estadísticas.
- Evolucionar los retos y las herramientas de edición a partir del uso real.
- Ampliar gradualmente los subconjuntos de seudocódigo de Factory y War sin alterar el significado de los programas.
- Python ya es un lenguaje del juego (E5–E7): se edita con el mismo editor, se traduce a JS con las mismas líneas y corre en el mismo worker. No se añadirán otros lenguajes. Siguen pendientes diccionarios y tuplas completas, la QA en un teléfono real y la decisión sobre Bloques y Seudo (D8).
- Decidir cómo guardar o exportar borradores y trasladar programas entre dispositivos/orígenes.
- Revisar rendimiento móvil antes de prometer soporte offline (las dependencias ya se sirven desde el repositorio, sin CDN).

## Lo que ya no es una posibilidad, sino el plan

Separar el núcleo de simulación, comprobar tipos, ejecutar los programas en un intérprete determinista, mejorar la transición 2D/3D y empaquetar para escritorio y móvil eran propuestas del brief original. Ahora son las fases de [PLAN-ARQUITECTURA.md](PLAN-ARQUITECTURA.md).

Fábrica abierta, SQL, ciudades y mundo abierto siguen fuera del alcance actual.

## Entrada y distribución

La portada ofrece Factory, War y Campaign (próximamente). El repositorio prepara un paquete estático para Netlify en `dist/`, sin publicar ni incluir el laboratorio de animación. Los enlaces y formatos de guardado existentes se conservan; trasladar programas entre orígenes sigue pendiente.
