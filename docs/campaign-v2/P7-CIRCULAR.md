# P7 · Producción circular mínima

Fuente: la sección 13.A del [consolidado del 23-nov](../Vision/2026-11-23/DECISIONES-PREPROTOTIPO.md) («Producción circular mínima») y sus invariantes de la sección 12. El autor pidió empezar a implementarlo el 26-nov. Los números son provisionales, como todos los de la misión: se ajustan jugando.

## Qué valida

Que el jugador entienda el subproducto, el coste energético, la acumulación y la utilidad del reciclaje sin física exacta (13.A). El recorte de chapa no es un defecto: es un subproducto previsto de un proceso normal (3.2).

## Cadena

```
placa (10 kg) ──embutidora──▶ domo (10 kg) ──sierra o láser──▶ semiesfera (6 kg) + recortes (4 kg)
     ▲                                                                        │
     └──────────────────── fundidora: 3 recortes (12 kg) → placa (10 kg) + 2 kg de escoria perdida
```

| Pieza | id | Masa |
| --- | --- | ---: |
| Placa | `plate` | 10 kg |
| Domo (semiesfera en bruto) | `dome` | 10 kg |
| Semiesfera | `shell` | 6 kg |
| Recortes | `scrap` | 4 kg |

| Máquina | Receta | kW | Ritmo | Nota |
| --- | --- | ---: | ---: | --- |
| Embutidora | placa → domo, 3 s | 2 | 1 | Prensa con forma de media esfera. |
| Sierra | domo → semiesfera + recortes, 6 s | 1 | 1 | Lenta y barata en energía. |
| Láser | la misma receta | 5 | 3 | Tres veces más rápido; con la energía justa frena al resto. |
| Fundidora | 3 recortes → placa, 6 s | 3 | 1 | Recupera 10 de cada 12 kg. |

## Mecánicas nuevas del motor (opcionales)

Solo se activan si el catálogo las declara. La misión 1 y Campaign del trunk siguen igual.

- **`sub` en una receta:** subproductos que salen junto a la pieza principal, por la misma salida. La máquina solo arranca si caben todas las piezas del ciclo. Si nadie retira los recortes, la máquina se bloquea: la acumulación se ve antes de ser irreversible (4.1).
- **`masa` en una pieza:** el motor comprueba al crearse que ninguna receta crea masa. Lleva un libro de pérdidas (`perdida`, en kg) y ofrece `masaEnPlanta(m)` para las pruebas de conservación (6.2).
- **`ritmo` en una máquina:** multiplica su velocidad de trabajo. Sierra y láser comparten la receta y difieren en tiempo y energía (5.1).

## Invariantes (sección 12.2) como pruebas

1. **Conservación:** masa en planta + pérdidas = masa inicial + masa entregada en la bahía, en cada paso.
2. **No duplicación:** dos brazos piden el mismo recorte y solo uno se lo lleva.
3. **Inventarios válidos:** ninguna salida, entrada ni tarima pasa de su capacidad.
4. **Procesos compatibles:** la fundidora rechaza lo que no son recortes.
5. **Semilla fija:** la misma partida da el mismo resultado.
6. **Sierra frente a láser:** la misma semiesfera, con distinto tiempo y energía.
7. **Catálogo honesto:** una receta que crea masa no deja crear el motor.

## H6 «Carcasas» en la misión 1

Va después de la B8 (`hitos: [..., "b8", "h6"]` en `niveles/nivel-1/nivel.js`). El taller ocupa el bolsillo nordeste de la losa (x 93–103, y 42–48,5) sin tocar el decorado:

- EMB-01, SAW-01 y LSR-01 en fila, mirando al sur;
- FND-01 a su lado, mirando al oeste;
- BOT-01, un robot libre (sin `alcance`), camina entre ellas;
- PAL-6 recibe las placas, PAL-7 las semiesferas y PAL-8 los recortes.

Todo aparece con `desde: 6`.

- **Al empezar:** llegan 5 placas a BAY-1 (`alEmpezar.entregas`). FRK-01 tiene que llevarlas a PAL-6.
- **Metas:** 6 semiesferas en PAL-7 y 1 placa refundida (`tipo: "hechos"`). Cinco placas dan cinco semiesferas, así que la sexta exige reciclar. La meta de la placa refundida impide saltárselo comprando placas.
- **Programa de partida de BOT-01:** un solo ciclo que deja los recortes en la sierra. Si se repite tal cual, la sierra se bloquea, que es la primera lección.
- **Pistas:** 1) subir las placas con FRK-01; 2) retirar los recortes a PAL-8 y refundir tres; 3) láser frente a sierra y su coste en kW.
- **Soluciones probadas:**
  - `campaign-v2-fabrica.mjs`: guion del motor, 102 s, con conservación de masa;
  - `campaign-v2-demo-fabrica.mjs`: programa del editor en la página, 97 s.
- **Vista:**
  - `vista-3d/cv2/taller.js` tiene las cuatro máquinas;
  - las piezas nuevas están en `fabrica.js` (3D) y `vista-2d/campaign.js` (plano);
  - la minificha usa `prensa.svg` y `cnc.svg` hasta que haya dibujos propios.

## Fuera de esta porción

El daño por componentes y la recuperación en combate (13.B), los vóxeles (13.C), los láseres como arma y la química.
