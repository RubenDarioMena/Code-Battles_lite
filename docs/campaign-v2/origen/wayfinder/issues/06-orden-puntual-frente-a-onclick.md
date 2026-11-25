# Orden puntual frente a `onClick`

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 02

## Question

El grill fijó la **orden puntual**: clic derecho, una sola acción manual de origen `jugador`, que nunca se repite. El laboratorio propone `onClick`: el clic no hace nada por sí mismo, solo lo que programe cada unidad.

¿Son dos mecanismos distintos que conviven, uno se construye sobre el otro, o `onClick` se aplaza? ¿Qué término queda en el glosario y qué hace un clic izquierdo, uno derecho o un toque en el móvil sobre enemigo, terreno o unidad propia?

## Grill

Preguntas en HTML con diagramas: [grill/ticket-06.html](../grill/ticket-06.html)

## Answer

Resuelto con el autor el 24-nov-2026: grill en HTML (Q1–Q5) y una ronda corta en el chat (Q6–Q9). Respuestas originales: `~/Documents/ticket-06-respuestas.md`.

1. **Relación (Q1 = B, uno sobre otro).** El clic derecho sobre enemigo o terreno (en móvil, mantener ~0,45 s) se entrega primero al programa de cada unidad seleccionada que escucha `onClick`. Esa entrega es el **clic programado**. Si la unidad no escucha, el clic es una **orden puntual**. Con selección mixta, cada unidad decide por su cuenta.
2. **Gestos (Q2 = A, con la nota del autor):**
   - Clic izquierdo o toque: seleccionar.
   - Arrastrar desde el terreno: recuadro.
   - Clic derecho o mantener 0,45 s: orden o clic programado.
   - Dos dedos: cámara.

   Se retiran Alt+clic y el botón «Señalar» (Q6 = A).
3. **Apuntar arrastrando** (nota del autor; Q7 = A, Q8 = A). Se mantiene pulsado ~0,45 s sobre una torreta propia y se arrastra hasta el objetivo. Se ve una línea punteada de la torreta al dedo o cursor, con una diana bajo él. Es **siempre una orden puntual**, aunque el programa escuche: es la vía manual garantizada. Funciona igual en móvil y en PC (clic izquierdo mantenido; antes del umbral sigue siendo selección o recuadro).
4. **Puntería (Q3 = B).** Si el clic cae sobre un enemigo, la torreta apunta con la predicción de `autoTarget`, de War. Es un solo disparo, sin seguimiento por identidad.
5. **Prioridad (Q4 = A).** La orden puntual ocupa el siguiente turno de fuego permitido y respeta cadencia, munición y atasco. Después sigue el modo del programa. Si la torreta no puede disparar, la orden se descarta con un aviso y no queda en cola. Esto requiere una función pública de War para el «intento puntual», separada de los modos (ver ticket 05).
6. **Nombre (Q5 = A).** «Clic programado».
7. **Indicación (Q9, provisional).** Un icono junto a la unidad mientras su programa escucha `onClick`, más una línea en la consola. El juego completo lo explicará en un tutorial.

En modo paridad no hay órdenes de jugador ni clics programados.

Queda para el ticket 07:
- si el clic programado (transporte de eventos) entra en el primer corte;
- la marca de 6 s y `track`.
