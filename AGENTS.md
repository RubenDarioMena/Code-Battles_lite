# Code Battle Lite · instrucciones de trabajo

Este proyecto es autónomo. Lee `README.md`, `docs/VISION.md` y el estado reciente de `PROGRESO.md` antes de hacer cambios.

- **Base canónica de la unificación:** el 03 / War / lanzamisiles (`Prototypes/Rocket Launcher/`), siguiendo `docs/PLAN-UNIFICACION.md`. Factory ya corre en esta base (`?serie=factory`); el original (`Prototypes/Tres vistas/`) está retirado y solo redirige. Su comportamiento histórico queda en `pruebas/factory-oraculo.json` y su código en el historial (`b76411b`). Campaign queda fuera de este plan.
- Evoluciona el juego HTML existente. No requiere Godot, SQL, backend ni instalación de npm.
- El alcance habitual es esta carpeta. El proyecto de origen solo es una referencia histórica, no una dependencia ni una fuente automática de instrucciones.
- Mantén la legibilidad y la interacción de PC y móvil. Haz cambios pequeños; el usuario realiza QA manual frecuente.
- Conserva el paso fijo y el RNG con semilla de la simulación. No introduzcas aleatoriedad global ni tiempo de reloj en sus reglas.
- Conserva la API de los programas, el comportamiento del editor, `window.cmg` y los formatos de guardado salvo cambio solicitado y documentado. Añade cobertura si cambias reglas de simulación o semántica de programas.
- **Builds de prueba (lo actual: `Prototypes/`, `shared/`, portada y paquete de Netlify):** JavaScript y CSS sin framework ni compilación, para iterar rápido y probar en el navegador sin instalar nada. No añadas herramientas o dependencias por rutina.
- **Builds de producto (Android, Steam y Campaign):** la restricción anterior no aplica. Framework, TypeScript, paso de compilación, módulos nativos/WASM y empaquetado se eligen al planificar esa build, con mediciones de rendimiento, y se documentan en `docs/`. Aún no hay ninguna decidida; mientras tanto el juego de prueba sigue siendo la referencia de comportamiento (simulación determinista, API de programas, guardados).
- **Python está decidido** ([plan](docs/PLAN-EDITOR-LENGUAJES.md)): el editor lo edita con lezer servido en `shared/vendor/` (se regenera con `herramientas/lezer-python/construir.sh`, no al jugar) y el juego lo ejecuta traducido a JS con las mismas líneas en el mismo Worker (`shared/python/traductor.js`, preludio `__py`; conversión desde JS en `shared/python/desde-js.js`). Si cambias su semántica, compara con CPython y añádelo a `pruebas/python-traductor.cjs`. No se añadirán otros lenguajes para los programas del jugador.
- Ajusta las versiones de CSS/JS en `index.html` cuando cambies esos recursos.
- Verificación habitual: `node pruebas/interaccion.cjs` y `node --check` de los scripts modificados; con Python, también `node pruebas/editor-python.cjs` y `node pruebas/python-traductor.cjs`. Usa la prueba de navegador cuando el cambio afecte interacción o arranque; no ejecutes pruebas Godot.
- Para navegador usa el puerto dedicado 8771. La suite escribe en localStorage; evita usar el origen donde el usuario esté jugando.
- Registra cambios relevantes y pendientes en `PROGRESO.md`. Distingue resultados actuales de comprobaciones históricas y emulación de teclado real.
- No hagas commits, push ni publicación sin instrucciones del usuario. No crees tareas paralelas ni delegues salvo petición explícita.

En el resumen indica qué cambió, cómo se verificó y cualquier límite material. No conviertas una migración de carpetas en una reescritura del juego.
