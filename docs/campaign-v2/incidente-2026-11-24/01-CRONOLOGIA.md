# Cronología

Horas locales (UTC−6). Los tokens de entrada incluyen los cacheados. Los porcentajes son el uso de la cuota antes y después de la sesión. Las cifras exactas están en [datos/sesiones.csv](datos/sesiones.csv).

## Antes de las porciones

| Fecha y hora | Cuenta y modelo | Qué | Entrada | Ventana 5 h | Semana |
|---|---|---|---:|---|---|
| 22-nov 17:40–01:47 | codex · Astra high | Motor de vóxeles de la muralla, en el worktree `papercraft` (luego llegó a `assets-3d`) | 11,5 M | 4 → 25 % | 52 → 66 % |
| 23-nov 19:25–20:08 | codex · gpt-6-luna xhigh | Sesiones de diseño en el repo principal | 3,3 M | 0 → 2 % | 66 % |
| 23-nov 22:26–22:31 | codex · Astra high | Arquitectura alternativa de Campaign-V2 (alias «B2») | 0,9 M | 2 → 19 % | 66 → 69 % |

## 24-nov · porciones

| Hora | Cuenta | Porción | Llamadas | Entrada | Ventana 5 h | Semana | Nota |
|---|---|---|---:|---:|---|---|---|
| 00:40–00:49 | codex | P1 Esqueleto y paridad | 38 | 4,4 M | 0 → 41 % | 69 → 75 % | |
| 06:05–06:20 | codex | P2 Fábrica, puente, checkpoint | 56 | 8,5 M | 0 → 70 % | 0 → 11 % | Reinicio semanal |
| 06:34–06:40 | codex | P3a Runtime base | 26 | 2,6 M | 71 → 100 % | 11 → 16 % | **Cortada por cuota** |
| 06:42–06:46 | codex-astra | Cierre de P3a | 26 | 2,0 M | 0 → 21 % | 9 → 12 % | Relee y termina |
| 06:49–07:05 | codex-astra | P3b Eventos y gestos | 67 | 9,9 M | 22 → 99 % | 12 → 25 % | |
| mañana | Claude | P4a lógica (escena en metros, bastiones, colocador) y `leerEnemigos`/`danoEnArea` en War | — | — | — | Sin Astra |
| 11:06–11:22 | codex | P4a Escenario 3D | 53 | 8,1 M | 0 → 71 % | 16 → 27 % | |
| 11:31–11:35 | codex | P4b UI del primer hito | 21 | 2,1 M | 73 → 98 % | 27 → 31 % | **Cortada por cuota** |
| 11:43–11:56 | codex-astra | P4b (continuación) | 66 | 10,9 M | 0 → 84 % | 25 → 38 % | Relee todo |
| 12:02–12:05 | codex-astra | P5a | 13 | 0,8 M | 86 → 99 % | 38 → 40 % | **Sin cuota**; no cambia nada |
| 16:30–20:55 | codex | P5a | 18 | 1,0 M | 0 → 32 % | 31 → 36 % | **Atascada**: ~1,5 h por respuesta; Claude la corta |
| 20:55–21:12 | codex-astra | P5a (retoma borradores) | 65 | 10,7 M | 4 → 88 % | 41 → 54 % | Pasa a ser la cuenta primaria |
| 21:48–21:49 | codex-astra | Página propia | 10 | 0,5 M | 90 → 100 % | 55 → 56 % | **Sin cuota** |
| 21:49–22:02 | codex | Página propia (continuación) | 62 | 9,1 M | 0 → 70 % | 36 → 47 % | Termina por debajo del tope del 75 % |

## Hechos que lo enmarcan

- **Tras P4b**, el autor no podía revisar con comodidad: lo viejo de Rocket Launcher (menús, selector de series, almacenamiento compartido) se mezclaba con V2 y a veces lo dejaba fuera. Pidió una página propia, y esa porción deshizo la integración.
- **Desde la tarde del 24**, `codex-astra` es la cuenta primaria. La normal solo entra si la primaria se queda sin cuota, nunca a la vez, y se corta al 75 % usado.
- **Astra nunca pudo ver el juego**: el sandbox no le deja abrir puertos ni navegadores. Toda la revisión visual la hizo Claude, a veces con el panel limitado a 2 fps.
