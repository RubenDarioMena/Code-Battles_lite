# Code Battle Lite · instrucciones de trabajo

Este proyecto es autónomo. Lee `README.md`, `docs/VISION.md` y el estado reciente de `PROGRESO.md` antes de hacer cambios.

- Evoluciona el juego HTML existente. No requiere Godot, SQL, backend ni instalación de npm.
- El alcance habitual es esta carpeta. El proyecto de origen solo es una referencia histórica, no una dependencia ni una fuente automática de instrucciones.
- Mantén la legibilidad y la interacción de PC y móvil. Haz cambios pequeños; el usuario realiza QA manual frecuente.
- Conserva el paso fijo y el RNG con semilla de la simulación. No introduzcas aleatoriedad global ni tiempo de reloj en sus reglas.
- Conserva la API de los programas, el comportamiento del editor, `window.cmg` y los formatos de guardado salvo cambio solicitado y documentado. Añade cobertura si cambias reglas de simulación o semántica de programas.
- JavaScript y CSS sin framework ni compilación. No añadas herramientas o dependencias por rutina. Las propuestas de TypeScript, VM, Python o empaquetado móvil aún no son implementaciones decididas.
- Ajusta las versiones de CSS/JS en `index.html` cuando cambies esos recursos.
- Verificación habitual: `node pruebas/interaccion.cjs` y `node --check` de los scripts modificados. Usa la prueba de navegador cuando el cambio afecte interacción o arranque; no ejecutes pruebas Godot.
- Para navegador usa el puerto dedicado 8771. La suite escribe en localStorage; evita usar el origen donde el usuario esté jugando.
- Registra cambios relevantes y pendientes en `PROGRESO.md`. Distingue resultados actuales de comprobaciones históricas y emulación de teclado real.
- No hagas commits, push ni publicación sin instrucciones del usuario. No crees tareas paralelas ni delegues salvo petición explícita.

En el resumen indica qué cambió, cómo se verificó y cualquier límite material. No conviertas una migración de carpetas en una reescritura del juego.
