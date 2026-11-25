# Campaign-V2 · Estado del trabajo autónomo (24-nov-2026)

Sin commits ni push. Todo está en el worktree `Code-battle-lite-cv2`, rama `Campaign-V2`. El índice de git sirve de instantánea entre porciones: `git diff` muestra solo lo último.

## Hecho

| Porción | Quién | Prueba en Node | Navegador real |
|---|---|---|---|
| P1 Esqueleto y paridad | Astra (codex) | ok | ok |
| P2 Fábrica, puente y checkpoint | Astra (codex) | ok | ok: H0 llega a 4 misiles y pasa a B1 |
| P3a Runtime base | Astra (codex + cierre en codex-astra) | ok | ok: error aislado en LAU-01, «Aplicar ahora» lo recupera |
| P3b Eventos y gestos | Astra (codex-astra) | ok | ok: `terrain.onClick` y `enemies.onClick`, cola en pausa |
| P4a lógica (escena en metros, bastiones, colocador) | Claude | `campaign-v2-marco.mjs` | — (no visual) |
| War `leerEnemigos` y `danoEnArea` (coste único de P5a) | Claude | `war-dano-en-area.mjs` | — |
| P4a vista 3D (terreno, muralla Traba, torreta con rig, combate, clics 3D, colocador) | Astra (codex, 16 min) | ok | ok: H0, B1 papel/combate, clic 3D en enemigo y terreno, «+» en pausa, paridad intacta |
| P4b UI del primer hito (árbol, compartidos/Desvincular, Misión, metas, ⋯, fichas, vida, iconos 2D, encuadre) | Astra (codex, 25 min) | ok | ok: PC y móvil 375×812; War sin cambios |
| P5a Movimiento, VEH y tirador; ensayo «Salida» | Astra (codex-astra, 18 min, tras un intento atascado en codex) | ok, `campaign-v2-mecanicas.mjs` | ok: VEH sale por la puerta, derriba drones y el tirador le dispara; sin errores en consola |
| Página propia `Prototypes/Campaign-V2/` (sin menús viejos; Rocket Launcher y `reglas-campaign` vuelven a trunk) | Astra (codex-astra, y codex al acabarse la cuota) | ok, `campaign-v2-pagina.mjs` | ok: B1 y Salida en 3D, menú ⋯ sin enlaces viejos, redirección desde Rocket Launcher, War limpio |

Suite: **82 ok, 7 falla**. Los 7 fallos son los de la línea base, todos por falta de `node_modules`.

## Cuentas de Astra

- `codex-astra` es la cuenta primaria. `codex` (la normal) solo entra si la primaria se queda sin cuota, nunca a la vez, y se corta al 75 % usado.
- Tras P5a: `codex-astra` al 88 % de la ventana de 5 h y al 54 % de la semanal. `codex` al 17 % y al 36 %.
- El primer intento de P5a con `codex` (16:30–20:55) se atascó: cada respuesta tardaba cerca de hora y media. Se cortó, y `codex-astra` la terminó en 18 minutos sobre sus borradores.

## Coste real de añadir una mecánica (P5a-INFORME)

- Cada pieza (movimiento, VEH, tirador) ocupa su carpeta con `ficha.js` y `reglas.js`, más 2 líneas en `paso.js`, 1 modelo y sus textos ES/EN.
- El primer corte pagó un coste único: `paso.js` (122 líneas) y 32 archivos de producto (+280/−88), sobre todo el anfitrión, la composición de la app y las dos vistas. Las piezas siguientes ya no lo pagan.

## Vistos en P4a, sin resolver

- **Losa de la fábrica**: `mapa.py` la hornea en x 72–113 m, lejos de las máquinas (x ≈ 201). Hay que regenerar las teselas en una tarea de arte; no la hice.
- **Rendimiento**: unos 5 ms de CPU por fotograma en papel y en combate. Los fps reales hay que medirlos con el panel del navegador visible: oculto, Chromium limita los fotogramas.

## Decisiones que tomé y conviene revisar

1. **`regularShoot(enemigo)`**: se conserva la semántica de War. Con un enemigo como argumento, el lugar se predice; el disparo único existe solo en la orden puntual.
2. **Bastiones = puestos de War** `[6,5]`, `[6,9]` y `[6,13]`, en casillas locales. Quedan 3,5 m por delante de la muralla (x = 207 m, la línea base de War). No los acerqué a la muralla para no cambiar el equilibrio de War.
3. **Colocar durante una Batalla** vale para la siguiente. Mientras tanto, la lista de bastiones ya muestra la reserva como ocupada.
4. **`danoEnArea` trabaja en el plano**, sin altura: alcanza tanto a enemigos de suelo como a drones. Cada derribo suma a `derribosMin`.
5. **El 3D se queda en WebGL**: los VFX GLSL no corren en WebGPU.

## Para revisar en el navegador

Servidor sin caché: `python3 .claude/servidor-sin-cache.py 8779 <worktree>` (está en el repo principal) y abrir `http://127.0.0.1:8779/Prototypes/Campaign-V2/` (`?ensayo=b1`, `?ensayo=salida`). Con `localhost` y `http.server`, el navegador sirve módulos viejos.
