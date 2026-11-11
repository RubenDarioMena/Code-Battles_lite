# Torreta de observación · fuente Blender

Esfera nominal de 1 m, compuerta doble centrada entre pistas a 45°, alojamiento Allen ampliado y profundo y telescopio hueco sin cristal. La versión base conserva la bajada de 10 mm respecto al primer diseño.

- `Torreta_observacion_1m.blend`: fuente editable, materiales, controles y animación de 456 fotogramas a 24 fps (19 s). Abre en reposo; pulsa Espacio.
- `Animacion_torreta.mp4` y `.gif`: reposo, inversión, apertura, extensión y miradas con varios ejes simultáneos.
- `propuestas/`: A (cardán dentado, 25 mm adicionales de descenso) y B (tres ruedas omni, 50 mm adicionales), con fuentes independientes, comparación y clips de 13 s.
- Cada fuente contiene documentación interna. Los LEEME describen controles, alturas y límites de cada alternativa.

## Para continuar e integrar al juego

No se ha elegido todavía un mecanismo definitivo. Las propuestas requieren dimensionar cargas, contactos, precarga y holguras. La torre es contexto ajustable, no una reproducción dimensionada de las referencias originales.

Apéndase la colección `TORRETA_OBSERVACION | conjunto editable` para reutilizar la pieza; el estudio y la torre de contexto están separados. Las unidades son metros. El archivo base conserva controles de inversión, apertura, extensión, azimut y dos inclinaciones.

Antes de integrar: elegir variante, simplificar mallas y materiales, preparar LOD y colisiones, hornear los drivers en animaciones transformadas y exportar GLB. Los recursos de ejecución del juego van en `Prototypes/Rocket Launcher/modelos/`; aquí se conserva la fuente de arte. Esta incorporación no modifica el juego ni incluye todavía un GLB integrado.

[Ver comparación animada](propuestas/Comparacion_mecanismos.gif) · [Video](propuestas/Comparacion_mecanismos.mp4)
