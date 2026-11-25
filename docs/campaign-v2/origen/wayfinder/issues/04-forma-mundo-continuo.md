# Forma del mundo continuo: fábrica y batalla en un mismo reglamento, con paridad

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 01, 02

## Question

¿Cómo se compone el mundo de Campaign-V2 para que la fábrica siga funcionando durante la batalla y, a la vez, el modo paridad dé la misma huella que War en las Batallas 1–5 (semillas 1 y 7)?

Opciones de partida (no exhaustivas):

- **(a)** Un reglamento compuesto que ejecuta `reglas-war` y una fábrica recortada lado a lado, con un puente (bodega → cargador/suministro).
- **(b)** Un reglamento nuevo `reglas-campaign-v2` que importa los mundos de War y de la fábrica como piezas.
- **(c)** Extender `reglas-campaign`.

Comparar por archivos compartidos tocados, pruebas de paridad y contexto que debe cargar un agente. Insumos: las dos arquitecturas (Astra y Claude) enlazadas en el mapa.

## Insumos

[Comparación Astra/Claude](../arquitecturas/COMPARACION.md)

## Answer

Resuelto con el autor el 24-nov-2026 (grilling, ronda única más confirmación).

1. **Paquete nuevo `reglas-campaign-v2`.** Implementa el contrato de reglamento de trunk y solo importa `nucleo` y `protocolo`. `app` le inyecta War y la producción, sin excepción en `pruebas/fronteras.mjs`.
2. **War como caja negra.** Cada Batalla crea un mundo de `reglas-war` sin cambios de lógica. Se añade una sola función pública en `reglas-war/index.js` para fijar el suministro. Hoy el suministro es infinito: `reglas-war/mundo.js:164` recarga `def.suministro × dt`.
3. **Producción extraída.** `reglas-campaign` expone `produccion.js` (robots, máquinas y recetas como datos), que H0–H5 sigue usando. V2 la compone con la receta de munición básica.
   - Motivo: hoy `PIEZAS`, `RECETAS` y `MAQUINAS` son constantes de `estado.js:14-41`, y `mundo.js` fija números de hito en el código.
   - Las referencias de H0–H5 vigilan la extracción.
4. **Continuidad entre Batallas.** Pasan la fábrica, la bodega, los programas y la posición de la torreta en su bastión. La torreta empieza cada Batalla con el cargador de su reto y sin atasco, y las oleadas cuentan el tiempo desde 0.
5. **Un solo reloj.** Cada paso de 0,05 s va en este orden: fábrica → puente → batalla. Entre Batallas no hay mundo de War, y en modo paridad solo corre la batalla.
6. **Puente bodega → torretas.** La torreta recarga al ritmo de `suministro` de su Batalla mientras quede munición en la bodega. Cada misil cargado resta 1, y con la bodega vacía el suministro es 0.
7. **Paridad.** Se ejecutan las 10 referencias (`pruebas/referencias/partidas.json`) por el camino de V2 con el puente apagado.
   - Además, antes de tocar nada, se graban desde War una victoria de la Batalla 1 y una partida con atascos.
   - Motivo: las semillas 1 y 7 coinciden en las Batallas 1, 2, 3 y 5, y las 10 referencias acaban en derrota.

Descartado: refactorizar `reglas-war` en `defensa.js` (Astra) mientras ninguna mecánica necesite entrar en mitad de su paso. También queda descartado V2 dentro de `reglas-campaign/v2/`.

Consecuencias:
- Se abre «Formato del checkpoint de Campaign-V2».
- La colocación en el bastión cambia la posición del lanzador en la definición de la Batalla (ver ticket 09).
- Las mecánicas nuevas viven en `reglas-campaign-v2` (ver ticket 05).
