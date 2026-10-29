# Storyboard · variantes del piloto `await`

Mismo guion ([scripts/await-busy-wait.md](../scripts/await-busy-wait.md)) y mismos parámetros para todas.

## Variante A · pantalla dividida (implementada en ambos motores)

- Arriba: dos paneles de código (polling ocupado a la izquierda, `await` a la derecha) con el resaltado del editor del juego.
- Abajo: dos stickmen, cada uno frente a su plataforma de entrega.
- El contador de intentos encima del personaje ocupado; al acelerar, estela de muestras + desenfoque + brillo.
- Motion Canvas: `concepts/motion-canvas/src/scenes/awaitBusyWait.tsx`
- Remotion: `compositions/remotion/src/AwaitPilot.tsx`

## Variante B · una sola cinta, cámara que viaja (pendiente)

- Plano general de una cinta transportadora con los dos personajes.
- La cámara se acerca al ocupado durante la aceleración (el contador ocupa media pantalla cuando se vuelve ilegible).
- Corte/paneo al tranquilo para el encogimiento de hombros.
- El código aparece como etiqueta flotante sobre cada personaje, no como panel.
- Objetivo: medir si el chiste funciona mejor con menos texto en pantalla.

## Reglas visuales comunes

- Fondo `#0B0F13`, tipografía Archivo / JetBrains Mono, tokens `--tk-*` del juego (ver `shared/theme.ts`).
- Ámbar (`warn`) = desperdicio / ocupado; verde (`ok`) = resolución.
- El motion blur es determinista: muestras del intervalo de obturación calculadas a partir de `t`, nunca acelerar una secuencia PNG de pocos FPS.
