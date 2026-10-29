# Visión y alcance

Code Battle Lite enseña programación mediante retos breves de defensa y automatización. El jugador programa máquinas y observa sus resultados en un mundo legible, con acceso directo a estadísticas y código.

## Pilares

- Legibilidad y ligereza: interfaz mínima, código y datos fáciles de leer.
- Simulación reproducible: cuadrícula, paso fijo y fallos controlados por semilla.
- PC y móvil desde el principio; comprobar el teclado y los gestos en dispositivos reales.
- Interfaz propia en HTML/CSS con paleta de programación y herramientas accesibles.
- Iteraciones pequeñas sobre el prototipo que ya funciona.

## Base actual

JavaScript real en Web Workers, escenarios de lanzadores y sensores, editor con selección múltiple, mapa 3D y plano, inspector de estadísticas, telemetría, Ajustes y distribución configurable. El código está concentrado en `js/juego.js`; `js/layout.js` mantiene la lógica de pantalla separada mediante `window.cmg`.

La interfaz permite variar el orden y orientación de mapa/código. Al escribir en móvil se prioriza el editor y su paleta; el divisor permite ocupar toda el área con un panel.

## Prototipo Tres vistas

La recogida de materiales conserva su simulación y ofrece bloques, pseudocódigo EN/ES y JavaScript como vistas del mismo programa. Ahora comparte la distribución adaptable y el estilo de Rocket Launcher, con las paletas propias de cada modo. Mantiene el plano 2D, el guardado del banco 02 y su API de R1; esta integración no añade esos modos al juego de defensa.

## Próximas decisiones

- Continuar QA de teclado, selección táctil, gestos y accesibilidad de estadísticas.
- Evolucionar los retos y las herramientas de edición a partir del uso real.
- Decidir semántica, traducción y validación de seudocódigo/Python para defensa antes de implementar esos modos allí. Tres vistas conserva su traductor existente de bloques/pseudocódigo a JavaScript.
- Decidir cómo guardar o exportar borradores y trasladar programas entre dispositivos/orígenes.
- Revisar rendimiento móvil y dependencias CDN antes de prometer soporte offline.

## Posibilidades posteriores

Separar el núcleo de simulación, adoptar TypeScript, usar una representación intermedia/VM, mejorar la transición 2D/3D y empaquetar la web para móvil son propuestas del brief original. No se incorporan como requisitos técnicos inmediatos de esta migración.

Fábrica abierta, SQL, ciudades, modelos detallados y mundo abierto quedan fuera del alcance actual. La base de este proyecto es el juego de programación de defensa que ya se está probando.
