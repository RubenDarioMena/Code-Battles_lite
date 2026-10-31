# Tiempos y cadena de inputs

## WAR-SEL-01 · PC · selección pendiente

[Vídeo](videos/01a-seleccion-pc.mp4) · [Log completo](videos/01a-seleccion-pc.json)

- 0.90 s → 1. Seleccionar while: el bloque completo queda elegido.
- 1.81 s → 2. Clic en console → Ráfaga en menos de 380 ms.
- 3.19 s → 3. Resultado rápido: ¿Ráfaga envuelve el while anterior?
- 5.39 s → 4. Deshacer: recuperar el texto original.
- 7.23 s → 5. Control: seleccionar while y esperar; después console + pausa 450 ms.
- 9.21 s → 6. Control pausado: el botón usa console, no todo el while.

Inputs confiables:

- 0.950 s → {'texto': 'while', 'offset': '0'} en (874.671875, 312.046875); selección [263, 263].
- 2.567 s → {'texto': 'console', 'offset': '128'} en (916.67578125, 401.640625); selección [0, 262].
- 2.618 s → {'id': '', 'nombre': 'Ráfaga', 'datos': {'i': '10', 'tip': 'Ráfaga', 'tipCod': 'burstFire(/* lugar */);'}} en (1279.078125, 204.296875); selección [0, 262].
- 5.452 s → {'id': '', 'nombre': 'Deshacer', 'datos': {'accion': 'deshacer', 'tip': 'Deshacer'}} en (843.078125, 262.296875); selección [131, 131].
- 7.283 s → {'texto': 'while', 'offset': '0'} en (874.671875, 312.046875); selección [0, 262].
- 8.033 s → {'texto': 'console', 'offset': '128'} en (916.67578125, 401.640625); selección [0, 262].
- 8.533 s → {'id': '', 'nombre': 'Ráfaga', 'datos': {'i': '10', 'tip': 'Ráfaga', 'tipCod': 'burstFire(/* lugar */);'}} en (1279.078125, 204.296875); selección [128, 135].
- 11.569 s → {'id': '', 'nombre': 'Deshacer', 'datos': {'accion': 'deshacer', 'tip': 'Deshacer'}} en (843.078125, 262.296875); selección [138, 145].

## WAR-SEL-01 · móvil emulado · selección pendiente

[Vídeo](videos/01b-seleccion-movil.mp4) · [Log completo](videos/01b-seleccion-movil.json)

- 0.90 s → 1. Seleccionar while: el bloque completo queda elegido.
- 1.96 s → 2. Clic en autoTarget → Disparo en menos de 380 ms.
- 3.40 s → 3. Resultado rápido: Disparo envuelve el while anterior.
- 5.61 s → 4. Deshacer: recuperar el texto original.
- 7.44 s → 5. Control: seleccionar while; después autoTarget + pausa 450 ms.
- 9.36 s → 6. Control pausado: el botón usa autoTarget, no todo el while.

Inputs confiables:

- 1.088 s → {'texto': 'while', 'offset': '0'} en (79.59375, 716.046875); selección [263, 263].
- 2.745 s → {'texto': 'autoTarget', 'offset': '29'} en (218.2265625, 738.4453125); selección [0, 262].
- 2.822 s → {'id': '', 'nombre': 'Disparo', 'datos': {'i': '9', 'tip': 'Disparo', 'tipCod': 'regularShoot(/* lugar */);'}} en (367, 617.296875); selección [0, 262].
- 5.656 s → {'id': '', 'nombre': 'Deshacer', 'datos': {'accion': 'deshacer', 'tip': 'Deshacer'}} en (86, 668.296875); selección [30, 35].
- 7.489 s → {'texto': 'while', 'offset': '0'} en (79.59375, 716.046875); selección [0, 262].
- 8.254 s → {'texto': 'autoTarget', 'offset': '29'} en (218.2265625, 738.4453125); selección [0, 262].
- 8.773 s → {'id': '', 'nombre': 'Disparo', 'datos': {'i': '9', 'tip': 'Disparo', 'tipCod': 'regularShoot(/* lugar */);'}} en (367, 617.296875); selección [29, 39].
- 11.706 s → {'id': '', 'nombre': 'Deshacer', 'datos': {'accion': 'deshacer', 'tip': 'Deshacer'}} en (86, 668.296875); selección [42, 52].

## WAR-EDIT-02 · fricción de borrado, sin bug confirmado

[Vídeo](videos/02-borrado-residuos.mp4) · [Log completo](videos/02-borrado-residuos.json)

- 0.90 s → 1. Caso ?? · seleccionar el comentario /* valor */ y Borrar.
- 3.56 s → Queda ?? sin operando. Borrar el hueco no quita el operador.
- 6.65 s → 2. Preparar otro caso guardado: Variable antepuesta al while.
- 8.01 s → Seleccionar pos del prefijo const pos = y Borrar.
- 9.32 s → Queda const = while. Deshacer restaura el borrado local.
- 12.40 s → 3. Preparar caso guardado: stopFire(); añadido en línea 2.
- 14.36 s → Ampliar una vez → Borrar la llamada.
- 15.10 s → Queda ; y una línea residual. No demuestra un bug de Borrar.

Inputs confiables:

- 2.355 s → {'texto': '/* valor */', 'offset': '48'} en (1294.765625, 312.046875); selección [79, 79].
- 2.936 s → {'id': '', 'nombre': 'Borrar', 'datos': {'accion': 'borrar', 'tip': 'Borrar'}} en (1072.078125, 262.296875); selección [48, 59].
- 5.821 s → {'id': '', 'nombre': 'Deshacer', 'datos': {'accion': 'deshacer', 'tip': 'Deshacer'}} en (843.078125, 262.296875); selección [48, 48].
- 6.704 s → {'id': 'b-teclado', 'nombre': 'Modo sin teclado activo: toca para escribir con teclado', 'datos': {'tip': 'Volver al teclado'}} en (1206.609375, 81); selección [48, 59].
- 6.886 s → {'id': 'b-teclado', 'nombre': 'Modo sin teclado', 'datos': {'tip': 'Modo sin teclado'}} en (1206.609375, 81); selección [275, 275].
- 8.056 s → {'texto': 'pos', 'offset': '6'} en (916.6796875, 312.046875); selección [275, 275].
- 8.686 s → {'id': '', 'nombre': 'Borrar', 'datos': {'accion': 'borrar', 'tip': 'Borrar'}} en (1072.078125, 262.296875); selección [6, 9].
- 11.570 s → {'id': '', 'nombre': 'Deshacer', 'datos': {'accion': 'deshacer', 'tip': 'Deshacer'}} en (843.078125, 262.296875); selección [5, 5].
- 12.453 s → {'id': 'b-teclado', 'nombre': 'Modo sin teclado activo: toca para escribir con teclado', 'datos': {'tip': 'Volver al teclado'}} en (1206.609375, 81); selección [6, 10].
- 12.668 s → {'id': 'b-teclado', 'nombre': 'Modo sin teclado', 'datos': {'tip': 'Modo sin teclado'}} en (1206.609375, 81); selección [277, 277].
- 13.837 s → {'texto': 'stopFire', 'offset': '17'} en (904.078125, 334.4453125); selección [277, 277].
- 14.403 s → {'id': '', 'nombre': 'Ampliar selección', 'datos': {'accion': 'ampliar', 'tip': 'Ampliar selección'}} en (1125.078125, 262.296875); selección [17, 25].
- 14.469 s → {'id': '', 'nombre': 'Borrar', 'datos': {'accion': 'borrar', 'tip': 'Borrar'}} en (1072.078125, 262.296875); selección [17, 27].
- 17.552 s → {'id': '', 'nombre': 'Deshacer', 'datos': {'accion': 'deshacer', 'tip': 'Deshacer'}} en (843.078125, 262.296875); selección [16, 16].

## WAR-VIEW-03 · espacio de edición condicionado por preferencias

[Vídeo](videos/03-espacio-movil.mp4) · [Log completo](videos/03-espacio-movil.json)

- 0.88 s → 1. 393 × 852: herramientas abiertas; pocas líneas visibles.
- 3.48 s → 2. Plegar herramientas para recuperar espacio de código.
- 7.62 s → 3. Desplazar el editor: volver a las líneas finales.

Inputs confiables:

- 3.703 s → {'id': 'b-barras', 'nombre': 'Plegar herramientas', 'datos': {}} en (361.8671875, 458); selección [263, 263].

