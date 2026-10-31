# Cadena de inputs por iteración

Cada flecha conserva el orden real. Los tiempos son relativos al inicio del intento; el botón aleatorio queda registrado en el evento de clic confiable. La selección tras clic puede seguir pendiente durante 380 ms.

## 01 · Nivel 1 · escritorio

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 1 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 146 ms: carácter ` `; offset UTF-16 9; línea 1, columna 10; (933.48, 312.05) CSS px → **Si no hay (??) · mantén para 7 variantes** a 282 ms (intervalo **136 ms**) → selección inmediata [0, 44] → texto perturbado.

**Recuperación:** SPAN → Borrar → Deshacer → Deshacer → **recuperado**, 4 clics; 29.0 s desde inicio.

Borrar el comentario deja ?? sin operando. Recuperación con Deshacer dos veces (borrado e inserción).

[Partida](evidencia/intento-1-juego.png) · [Perturbación](evidencia/intento-1-perturbacion.png) · [Final](evidencia/intento-1-final.png) · [Traza completa](evidencia/intento-1-traza.json)

## 02 · Nivel 4 · escritorio

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 3 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 443 ms: carácter `f`; offset UTF-16 162; línea 6, columna 4; (883.08, 446.44) CSS px → **Variable · mantén para 2 variantes** a 598 ms (intervalo **155 ms**) → selección inmediata [0, 263] → texto perturbado.

**Recuperación:** SPAN → Borrar → Deshacer → Deshacer → **recuperado**, 4 clics; 24.0 s desde inicio.

Variable se antepuso al while completo. Borrar pos deja const sin nombre; Deshacer dos veces recupera. Selección tras carácter conserva bloque completo: revisar posible gesto múltiple del agente.

[Partida](evidencia/intento-2-juego.png) · [Perturbación](evidencia/intento-2-perturbacion.png) · [Final](evidencia/intento-2-final.png) · [Traza completa](evidencia/intento-2-traza.json)

## 03 · Nivel 4 · escritorio

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 4 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 671 ms: carácter `c`; offset UTF-16 17; línea 2, columna 3; (874.68, 334.45) CSS px → **Detener** a 809 ms (intervalo **138 ms**) → selección inmediata [0, 263] → texto perturbado.

**Recuperación:** SPAN → Ampliar selección → Borrar → Deshacer → Deshacer → **recuperado**, 5 clics; 31.3 s desde inicio.

Ampliar una vez y borrar stopFire() deja un punto y coma y línea residual. Dos Deshacer recuperan el texto exacto.

[Partida](evidencia/intento-3-juego.png) · [Perturbación](evidencia/intento-3-perturbacion.png) · [Final](evidencia/intento-3-final.png) · [Traza completa](evidencia/intento-3-traza.json)

## 04 · Nivel 4 · escritorio

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 3 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 657 ms: carácter `(`; offset UTF-16 140; línea 4, columna 17; (992.29, 401.64) CSS px → **Ráfaga** a 861 ms (intervalo **204 ms**) → selección inmediata [0, 263] → texto perturbado.

**Recuperación:** Deshacer → **recuperado**, 1 clics; 29.0 s desde inicio.

Carrera con el clic simple diferido 380 ms dentro de selección. Un Deshacer recupera.

[Partida](evidencia/intento-4-juego.png) · [Perturbación](evidencia/intento-4-perturbacion.png) · [Final](evidencia/intento-4-final.png) · [Traza completa](evidencia/intento-4-traza.json)

## 05 · Nivel 3 · escritorio

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 4 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 830 ms: carácter `o`; offset UTF-16 107; línea 3, columna 13; (958.68, 379.24) CSS px → **Comentar** a 1032 ms (intervalo **202 ms**) → selección inmediata [0, 140] → texto perturbado.

**Recuperación:** Deshacer → **recuperado**, 1 clics; 12.4 s desde inicio.

Misma carrera de selección; un Deshacer recupera.

[Partida](evidencia/intento-5-juego.png) · [Perturbación](evidencia/intento-5-perturbacion.png) · [Final](evidencia/intento-5-final.png) · [Traza completa](evidencia/intento-5-traza.json)

## 06 · Nivel 1 · móvil emulado

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 3 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 811 ms: carácter `"`; offset UTF-16 31; línea 1, columna 32; (323.23, 716.05) CSS px → **If / else · mantén para 2 variantes** a 1028 ms (intervalo **217 ms**) → selección inmediata [0, 64] → texto perturbado.

**Recuperación:** Deshacer → **recuperado**, 1 clics; 20.0 s desde inicio.

Carrera rápida también en móvil emulado; recuperado con un Deshacer.

[Partida](evidencia/intento-6-juego.png) · [Perturbación](evidencia/intento-6-perturbacion.png) · [Final](evidencia/intento-6-final.png) · [Traza completa](evidencia/intento-6-traza.json)

## 07 · Nivel 4 · móvil emulado

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 2 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 725 ms: carácter `a`; offset UTF-16 29; línea 2, columna 15; (180.43, 738.45) CSS px → **Disparo** a 961 ms (intervalo **236 ms**) → selección inmediata [0, 263] → texto perturbado.

**Recuperación:** Deshacer → **recuperado**, 1 clics; 11.2 s desde inicio.

Un Deshacer recupera. Solo 121 caracteres visibles en móvil; captura y geometría conservadas.

[Partida](evidencia/intento-7-juego.png) · [Perturbación](evidencia/intento-7-perturbacion.png) · [Final](evidencia/intento-7-final.png) · [Traza completa](evidencia/intento-7-traza.json)

## 08 · Nivel 4 · móvil emulado

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 1 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 528 ms: carácter ` `; offset UTF-16 96; línea 3, columna 2; (71.20, 805.64) CSS px → **Disparo** a 764 ms (intervalo **236 ms**) → selección inmediata [0, 262] → texto perturbado.

**Recuperación:** Deshacer → **recuperado**, 1 clics; 19.1 s desde inicio.

Un Deshacer recupera.

[Partida](evidencia/intento-8-juego.png) · [Perturbación](evidencia/intento-8-perturbacion.png) · [Final](evidencia/intento-8-final.png) · [Traza completa](evidencia/intento-8-traza.json)

## 09 · Nivel 4 · móvil emulado

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 4 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 1229 ms: carácter `)`; offset UTF-16 92; línea 2, columna 78; (130.00, 783.24) CSS px → **While true · mantén para 4 variantes** a 1462 ms (intervalo **233 ms**) → selección inmediata [0, 263] → texto perturbado.

**Recuperación:** Deshacer → **recuperado**, 1 clics; 7.6 s desde inicio.

Un Deshacer recupera; no se ensayó desanidar todo manualmente por riesgo de borrar el original.

[Partida](evidencia/intento-9-juego.png) · [Perturbación](evidencia/intento-9-perturbacion.png) · [Final](evidencia/intento-9-final.png) · [Traza completa](evidencia/intento-9-traza.json)

## 10 · Nivel 5 · móvil emulado

Preparación: ejecutar programa de partida, detener y reiniciar → activar modo sin teclado → 1 clic(s) sobre la primera ficha → sorteo con semilla.

**Clic aleatorio** 464 ms: carácter `v`; offset UTF-16 50; línea 2, columna 36; (71.20, 760.84) CSS px → **Si no hay (??) · mantén para 7 variantes** a 697 ms (intervalo **233 ms**) → selección inmediata [0, 139] → texto perturbado.

**Recuperación:** Deshacer → **recuperado**, 1 clics; 54.5 s desde inicio.

Un Deshacer recupera.

[Partida](evidencia/intento-10-juego.png) · [Perturbación](evidencia/intento-10-perturbacion.png) · [Final](evidencia/intento-10-final.png) · [Traza completa](evidencia/intento-10-traza.json)
