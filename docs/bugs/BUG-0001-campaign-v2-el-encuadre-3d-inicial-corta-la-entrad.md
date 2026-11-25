# BUG-0001 · El encuadre inicial de Batalla corta la entrada al este

Corregido en `Campaign-V2` el 24 de noviembre de 2026. Pendiente de contraste en navegador. Pantalla de mapa, cámara y bastiones.

## Reproducción

Abrir B1 en 3D antes de mover la cámara. En la revisión de P4a el autor observó que la muralla ocupaba el encuadre y quedaba cortado el fondo. El campo va de x = 204 a 236 m y las unidades aparecen ligeramente más al este.

## Causa y arreglo

La cámara ajustaba un rectángulo a altura cero antes de que terminase la carga del relieve. P4b proyecta los límites a la altura del terreno, añade la entrada aérea y los apoyos de torreta, y actualiza la postura inicial cuando llega la geometría. Una cámara que el jugador ya movió conserva su posición.

## Evidencia

`node pruebas/three-r180.mjs` abre los GLB y comprueba que los extremos y los tres bastiones entran en 900 × 530 y 375 × 812. En vertical, la entrada queda por encima de la base. El informe incluye la revisión visual pendiente. [Informe de P4b](../campaign-v2/P4b-INFORME.md).
