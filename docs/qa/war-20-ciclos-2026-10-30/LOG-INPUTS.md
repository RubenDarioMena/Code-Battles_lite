# Cadena de inputs · 20 ciclos

Cada JSON conserva código previo, perturbado y final, selección y traza completa. Coordenadas en CSS px; tiempos desde iniciar el intento. Preparación con fill fuera del intento; recuperación con UI.

## 01 · R1 · nivel 1 · PC

Umbral 3; recuperado; 3 clics de reparación; 3.37 s.

[Antes](evidencia/01-antes.png) → [Perturbación](evidencia/01-perturbacion.png) → [Ensayo local](evidencia/01-local.png) → [Final](evidencia/01-final.png) · [JSON](evidencia/01-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 90 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 4 | 742 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 6 | 1342 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 9 | 1441 | Clic (866.0, 312.0) · SPAN · selección 0–63 |
| 10 | 1492 | tras-caracter · selección 0–63 |
| 11 | 1607 | Clic (1279.0, 204.0) · Ráfaga · selección 0–63 |
| 12 | 1658 | tras-perturbacion · selección 74–85 |
| 13 | 1940 | Clic (1072.0, 262.0) · Borrar · selección 74–85 |
| 16 | 2624 | Clic (843.0, 262.0) · Deshacer · selección 74–74 |
| 19 | 2810 | Clic (843.0, 262.0) · Deshacer · selección 74–85 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Candidato a reparación por línea → Deshacer perturbación.

## 02 · R2 · nivel 3 · PC

Umbral 1; recuperado; 3 clics de reparación; 2.14 s.

[Antes](evidencia/02-antes.png) → [Perturbación](evidencia/02-perturbacion.png) → [Ensayo local](evidencia/02-local.png) → [Final](evidencia/02-final.png) · [JSON](evidencia/02-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 91 | Clic (874.0, 312.0) · SPAN · selección 0–106 |
| 5 | 225 | Clic (908.0, 356.0) · SPAN · selección 0–106 |
| 6 | 294 | tras-caracter · selección 0–106 |
| 7 | 408 | Clic (839.0, 204.0) · Comentar · selección 64–76 |
| 8 | 442 | tras-perturbacion · selección 62–85 |
| 9 | 674 | Clic (1072.0, 262.0) · Borrar · selección 62–85 |
| 12 | 1391 | Clic (843.0, 262.0) · Deshacer · selección 61–61 |
| 15 | 1559 | Clic (843.0, 262.0) · Deshacer · selección 64–88 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 03 · R3 · nivel 4 · PC

Umbral 3; recuperado; 3 clics de reparación; 3.78 s.

[Antes](evidencia/03-antes.png) → [Perturbación](evidencia/03-perturbacion.png) → [Ensayo local](evidencia/03-local.png) → [Final](evidencia/03-final.png) · [JSON](evidencia/03-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 91 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 4 | 742 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 6 | 1392 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 9 | 1495 | Clic (983.0, 446.0) · SPAN · selección 116–119 |
| 10 | 1560 | tras-caracter · selección 116–119 |
| 11 | 2060 | Clic (1312.0, 204.0) · Aviso · mantén para 3 variantes · selección 116–119 |
| 12 | 2124 | tras-perturbacion · selección 135–148 |
| 13 | 2341 | Clic (1072.0, 262.0) · Borrar · selección 135–148 |
| 16 | 3024 | Clic (843.0, 262.0) · Deshacer · selección 135–135 |
| 19 | 3210 | Clic (843.0, 262.0) · Deshacer · selección 135–148 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Candidato a reparación por línea → Deshacer perturbación.

## 04 · R4 · nivel 4 · PC

Umbral 4; recuperado; 3 clics de reparación; 3.96 s.

[Antes](evidencia/04-antes.png) → [Perturbación](evidencia/04-perturbacion.png) → [Ensayo local](evidencia/04-local.png) → [Final](evidencia/04-final.png) · [JSON](evidencia/04-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 122 | Clic (954.0, 312.0) · SPAN · selección 0–24 |
| 4 | 741 | Clic (954.0, 312.0) · SPAN · selección 0–24 |
| 6 | 1375 | Clic (954.0, 312.0) · SPAN · selección 0–24 |
| 8 | 2023 | Clic (954.0, 312.0) · SPAN · selección 0–24 |
| 11 | 2159 | Clic (1034.0, 334.0) · SPAN · selección 37–47 |
| 12 | 2190 | tras-caracter · selección 37–47 |
| 13 | 2306 | Clic (1279.0, 204.0) · Ráfaga · selección 37–47 |
| 14 | 2338 | tras-perturbacion · selección 92–103 |
| 15 | 2539 | Clic (1072.0, 262.0) · Borrar · selección 92–103 |
| 18 | 3204 | Clic (843.0, 262.0) · Deshacer · selección 92–92 |
| 21 | 3359 | Clic (843.0, 262.0) · Deshacer · selección 92–103 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Candidato a reparación por línea → Deshacer perturbación.

## 05 · R5 · nivel 5 · PC

Umbral 2; recuperado; 3 clics de reparación; 2.93 s.

[Antes](evidencia/05-antes.png) → [Perturbación](evidencia/05-perturbacion.png) → [Ensayo local](evidencia/05-local.png) → [Final](evidencia/05-final.png) · [JSON](evidencia/05-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 119 | Clic (874.0, 312.0) · SPAN · selección 0–200 |
| 4 | 787 | Clic (874.0, 312.0) · SPAN · selección 0–200 |
| 7 | 886 | Clic (983.0, 401.0) · SPAN · selección 0–200 |
| 8 | 955 | tras-caracter · selección 0–200 |
| 9 | 1087 | Clic (903.0, 204.0) · While true · mantén para 4 variantes · selección 122–125 |
| 10 | 1170 | tras-perturbacion · selección 127–148 |
| 11 | 1452 | Clic (1072.0, 262.0) · Borrar · selección 127–148 |
| 14 | 2135 | Clic (843.0, 262.0) · Deshacer · selección 126–126 |
| 17 | 2303 | Clic (843.0, 262.0) · Deshacer · selección 131–153 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 06 · R1 · nivel 4 · PC

Umbral 3; recuperado; 3 clics de reparación; 3.44 s.

[Antes](evidencia/06-antes.png) → [Perturbación](evidencia/06-perturbacion.png) → [Ensayo local](evidencia/06-local.png) → [Final](evidencia/06-final.png) · [JSON](evidencia/06-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 123 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 4 | 740 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 6 | 1390 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 9 | 1489 | Clic (950.0, 312.0) · SPAN · selección 0–44 |
| 10 | 1574 | tras-caracter · selección 0–44 |
| 11 | 1706 | Clic (1175.0, 204.0) · Apuntar · selección 12–12 |
| 12 | 1774 | tras-perturbacion · selección 68–89 |
| 13 | 2005 | Clic (1072.0, 262.0) · Borrar · selección 68–89 |
| 16 | 2672 | Clic (843.0, 262.0) · Deshacer · selección 68–68 |
| 19 | 2874 | Clic (843.0, 262.0) · Deshacer · selección 71–94 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Candidato a reparación por línea → Deshacer perturbación.

## 07 · R2 · nivel 4 · PC

Umbral 1; recuperado; 3 clics de reparación; 2.17 s.

[Antes](evidencia/07-antes.png) → [Perturbación](evidencia/07-perturbacion.png) → [Ensayo local](evidencia/07-local.png) → [Final](evidencia/07-final.png) · [JSON](evidencia/07-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 117 | Clic (874.0, 312.0) · SPAN · selección 0–106 |
| 5 | 214 | Clic (983.0, 334.0) · SPAN · selección 0–106 |
| 6 | 247 | tras-caracter · selección 0–106 |
| 7 | 364 | Clic (955.0, 204.0) · If / else · mantén para 2 variantes · selección 29–39 |
| 8 | 434 | tras-perturbacion · selección 40–88 |
| 9 | 715 | Clic (1072.0, 262.0) · Borrar · selección 40–88 |
| 12 | 1399 | Clic (843.0, 262.0) · Deshacer · selección 39–39 |
| 15 | 1565 | Clic (843.0, 262.0) · Deshacer · selección 42–91 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 08 · R3 · nivel 4 · PC

Umbral 1; recuperado; 3 clics de reparación; 2.17 s.

[Antes](evidencia/08-antes.png) → [Perturbación](evidencia/08-perturbacion.png) → [Ensayo local](evidencia/08-local.png) → [Final](evidencia/08-final.png) · [JSON](evidencia/08-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 122 | Clic (874.0, 312.0) · SPAN · selección 0–44 |
| 5 | 206 | Clic (933.0, 401.0) · SPAN · selección 88–96 |
| 6 | 239 | tras-caracter · selección 88–96 |
| 7 | 373 | Clic (1227.0, 204.0) · Disparo · selección 88–96 |
| 8 | 439 | tras-perturbacion · selección 115–126 |
| 9 | 672 | Clic (1072.0, 262.0) · Borrar · selección 115–126 |
| 12 | 1371 | Clic (843.0, 262.0) · Deshacer · selección 115–115 |
| 15 | 1556 | Clic (843.0, 262.0) · Deshacer · selección 115–126 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Candidato a reparación por línea → Deshacer perturbación.

## 09 · R4 · nivel 4 · PC

Umbral 1; recuperado; 3 clics de reparación; 2.17 s.

[Antes](evidencia/09-antes.png) → [Perturbación](evidencia/09-perturbacion.png) → [Ensayo local](evidencia/09-local.png) → [Final](evidencia/09-final.png) · [JSON](evidencia/09-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 90 | Clic (954.0, 312.0) · SPAN · selección 0–24 |
| 5 | 224 | Clic (983.0, 312.0) · SPAN · selección 0–24 |
| 6 | 291 | tras-caracter · selección 0–24 |
| 7 | 406 | Clic (1227.0, 204.0) · Disparo · selección 0–24 |
| 8 | 439 | tras-perturbacion · selección 13–37 |
| 9 | 690 | Clic (1072.0, 262.0) · Borrar · selección 13–37 |
| 12 | 1356 | Clic (843.0, 262.0) · Deshacer · selección 13–13 |
| 15 | 1574 | Clic (843.0, 262.0) · Deshacer · selección 13–37 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 10 · R5 · nivel 5 · PC

Umbral 2; recuperado; 3 clics de reparación; 3.26 s.

[Antes](evidencia/10-antes.png) → [Perturbación](evidencia/10-perturbacion.png) → [Ensayo local](evidencia/10-local.png) → [Final](evidencia/10-final.png) · [JSON](evidencia/10-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 128 | Clic (874.0, 312.0) · SPAN · selección 0–200 |
| 4 | 777 | Clic (874.0, 312.0) · SPAN · selección 0–200 |
| 7 | 877 | Clic (1076.0, 356.0) · SPAN · selección 0–200 |
| 8 | 913 | tras-caracter · selección 0–200 |
| 9 | 1546 | Clic (1312.0, 204.0) · Aviso · mantén para 3 variantes · selección 84–92 |
| 10 | 1595 | tras-perturbacion · selección 110–123 |
| 11 | 1811 | Clic (1072.0, 262.0) · Borrar · selección 110–123 |
| 14 | 2512 | Clic (843.0, 262.0) · Deshacer · selección 110–110 |
| 17 | 2700 | Clic (843.0, 262.0) · Deshacer · selección 110–123 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Candidato a reparación por línea → Deshacer perturbación.

## 11 · R1 · nivel 1 · móvil

Umbral 2; recuperado; 1 clics de reparación; 1.90 s.

[Antes](evidencia/11-antes.png) → [Perturbación](evidencia/11-perturbacion.png) → [Ensayo local](evidencia/11-local.png) → [Final](evidencia/11-final.png) · [JSON](evidencia/11-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 61 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 4 | 678 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 7 | 816 | Clic (87.0, 760.0) · SPAN · selección 45–57 |
| 8 | 866 | tras-caracter · selección 45–57 |
| 9 | 980 | Clic (269.0, 617.0) · Variable · mantén para 2 variantes · selección 45–57 |
| 10 | 1061 | tras-perturbacion · selección 76–87 |
| 11 | 1261 | Clic (299.0, 668.0) · Borrar · selección 76–87 |

Recuperación observada: Borrar selección resultante.

## 12 · R2 · nivel 3 · móvil

Umbral 3; recuperado; 1 clics de reparación; 2.56 s.

[Antes](evidencia/12-antes.png) → [Perturbación](evidencia/12-perturbacion.png) → [Ensayo local](evidencia/12-local.png) → [Final](evidencia/12-final.png) · [JSON](evidencia/12-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 88 | Clic (79.0, 716.0) · SPAN · selección 0–106 |
| 4 | 739 | Clic (79.0, 716.0) · SPAN · selección 0–106 |
| 6 | 1355 | Clic (79.0, 716.0) · SPAN · selección 0–106 |
| 9 | 1473 | Clic (130.0, 716.0) · SPAN · selección 0–106 |
| 10 | 1540 | tras-caracter · selección 0–106 |
| 11 | 1673 | Clic (269.0, 617.0) · Variable · mantén para 2 variantes · selección 7–11 |
| 12 | 1744 | tras-perturbacion · selección 29–40 |
| 13 | 1923 | Clic (299.0, 668.0) · Borrar · selección 29–40 |

Recuperación observada: Borrar selección resultante.

## 13 · R3 · nivel 4 · móvil

Umbral 2; recuperado; 3 clics de reparación; 2.63 s.

[Antes](evidencia/13-antes.png) → [Perturbación](evidencia/13-perturbacion.png) → [Ensayo local](evidencia/13-local.png) → [Final](evidencia/13-final.png) · [JSON](evidencia/13-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 61 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 4 | 678 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 7 | 779 | Clic (87.0, 738.0) · SPAN · selección 0–121 |
| 8 | 844 | tras-caracter · selección 0–121 |
| 9 | 979 | Clic (93.0, 617.0) · While true · mantén para 4 variantes · selección 0–121 |
| 10 | 1009 | tras-perturbacion · selección 15–150 |
| 11 | 1176 | Clic (299.0, 668.0) · Borrar · selección 15–150 |
| 14 | 1894 | Clic (86.0, 668.0) · Deshacer · selección 14–14 |
| 17 | 2078 | Clic (86.0, 668.0) · Deshacer · selección 15–151 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 14 · R4 · nivel 4 · móvil

Umbral 1; recuperado; 4 clics de reparación; 46.12 s.

[Antes](evidencia/14-antes.png) → [Perturbación](evidencia/14-perturbacion.png) → [Ensayo local](evidencia/14-local.png) → [Final](evidencia/14-final.png) · [JSON](evidencia/14-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 62 | Clic (159.0, 716.0) · SPAN · selección 0–24 |
| 5 | 166 | Clic (146.0, 738.0) · SPAN · selección 0–109 |
| 6 | 229 | tras-caracter · selección 0–109 |
| 7 | 748 | Clic (354.0, 617.0) · Aviso · mantén para 3 variantes · selección 0–109 |
| 8 | 812 | tras-perturbacion · selección 123–136 |
| 9 | 1063 | Clic (299.0, 668.0) · Borrar · selección 123–136 |
| 12 | 1713 | Clic (86.0, 668.0) · Deshacer · selección 123–123 |
| 16 | 45749 | Clic (31.0, 789.0) · DIV · selección 110–138 |
| 18 | 45945 | Clic (299.0, 668.0) · Borrar · selección 110–138 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Intento de asa bloqueado por sugerencias → Cerrar sugerencias → seleccionar línea 5 → Borrar.

## 15 · R5 · nivel 5 · móvil

Umbral 2; recuperado; 4 clics de reparación; 2.99 s.

[Antes](evidencia/15-antes.png) → [Perturbación](evidencia/15-perturbacion.png) → [Ensayo local](evidencia/15-local.png) → [Final](evidencia/15-final.png) · [JSON](evidencia/15-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 60 | Clic (79.0, 716.0) · SPAN · selección 0–200 |
| 4 | 645 | Clic (79.0, 716.0) · SPAN · selección 0–200 |
| 7 | 780 | Clic (230.0, 738.0) · SPAN · selección 0–200 |
| 8 | 813 | tras-caracter · selección 0–200 |
| 9 | 1331 | Clic (300.0, 617.0) · Sensor de vibración · selección 29–39 |
| 10 | 1398 | tras-perturbacion · selección 123–144 |
| 11 | 1562 | Clic (299.0, 668.0) · Borrar · selección 123–144 |
| 14 | 2195 | Clic (86.0, 668.0) · Deshacer · selección 123–123 |
| 18 | 2563 | Clic (31.0, 801.0) · DIV · selección 95–146 |
| 20 | 2747 | Clic (299.0, 668.0) · Borrar · selección 95–146 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Seleccionar línea 3 y Borrar.

## 16 · R1 · nivel 4 · móvil

Umbral 3; recuperado; 3 clics de reparación; 3.25 s.

[Antes](evidencia/16-antes.png) → [Perturbación](evidencia/16-perturbacion.png) → [Ensayo local](evidencia/16-local.png) → [Final](evidencia/16-final.png) · [JSON](evidencia/16-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 62 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 4 | 678 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 6 | 1347 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 9 | 1429 | Clic (62.0, 738.0) · SPAN · selección 0–44 |
| 10 | 1463 | tras-caracter · selección 0–44 |
| 11 | 1582 | Clic (93.0, 617.0) · While true · mantén para 4 variantes · selección 34–42 |
| 12 | 1647 | tras-perturbacion · selección 15–61 |
| 13 | 1828 | Clic (299.0, 668.0) · Borrar · selección 15–61 |
| 16 | 2478 | Clic (86.0, 668.0) · Deshacer · selección 14–14 |
| 19 | 2647 | Clic (86.0, 668.0) · Deshacer · selección 15–62 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 17 · R2 · nivel 4 · móvil

Umbral 3; recuperado; 3 clics de reparación; 3.27 s.

[Antes](evidencia/17-antes.png) → [Perturbación](evidencia/17-perturbacion.png) → [Ensayo local](evidencia/17-local.png) → [Final](evidencia/17-final.png) · [JSON](evidencia/17-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 61 | Clic (79.0, 716.0) · SPAN · selección 0–106 |
| 4 | 678 | Clic (79.0, 716.0) · SPAN · selección 0–106 |
| 6 | 1295 | Clic (79.0, 716.0) · SPAN · selección 0–106 |
| 9 | 1395 | Clic (130.0, 760.0) · SPAN · selección 0–106 |
| 10 | 1448 | tras-caracter · selección 0–106 |
| 11 | 1581 | Clic (93.0, 617.0) · While true · mantén para 4 variantes · selección 29–60 |
| 12 | 1646 | tras-perturbacion · selección 32–80 |
| 13 | 1828 | Clic (299.0, 668.0) · Borrar · selección 32–80 |
| 16 | 2480 | Clic (86.0, 668.0) · Deshacer · selección 31–31 |
| 19 | 2678 | Clic (86.0, 668.0) · Deshacer · selección 34–83 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 18 · R3 · nivel 4 · móvil

Umbral 4; recuperado; 3 clics de reparación; 4.29 s.

[Antes](evidencia/18-antes.png) → [Perturbación](evidencia/18-perturbacion.png) → [Ensayo local](evidencia/18-local.png) → [Final](evidencia/18-final.png) · [JSON](evidencia/18-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 95 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 4 | 744 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 6 | 1360 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 8 | 2030 | Clic (79.0, 716.0) · SPAN · selección 0–44 |
| 11 | 2129 | Clic (180.0, 783.0) · SPAN · selección 58–75 |
| 12 | 2163 | tras-caracter · selección 58–75 |
| 13 | 2564 | Clic (256.0, 617.0) · Ráfaga · selección 58–75 |
| 14 | 2613 | tras-perturbacion · selección 68–85 |
| 15 | 2795 | Clic (299.0, 668.0) · Borrar · selección 68–85 |
| 18 | 3513 | Clic (86.0, 668.0) · Deshacer · selección 68–79 |
| 21 | 3732 | Clic (86.0, 668.0) · Deshacer · selección 68–85 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 19 · R4 · nivel 4 · móvil

Umbral 4; recuperado; 3 clics de reparación; 3.87 s.

[Antes](evidencia/19-antes.png) → [Perturbación](evidencia/19-perturbacion.png) → [Ensayo local](evidencia/19-local.png) → [Final](evidencia/19-final.png) · [JSON](evidencia/19-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 91 | Clic (159.0, 716.0) · SPAN · selección 0–24 |
| 4 | 740 | Clic (159.0, 716.0) · SPAN · selección 0–24 |
| 6 | 1357 | Clic (159.0, 716.0) · SPAN · selección 0–24 |
| 8 | 2007 | Clic (159.0, 716.0) · SPAN · selección 0–24 |
| 11 | 2106 | Clic (79.0, 805.0) · SPAN · selección 83–95 |
| 12 | 2156 | tras-caracter · selección 83–95 |
| 13 | 2291 | Clic (137.0, 617.0) · If / else · mantén para 2 variantes · selección 83–95 |
| 14 | 2355 | tras-perturbacion · selección 106–134 |
| 15 | 2505 | Clic (299.0, 668.0) · Borrar · selección 106–134 |
| 18 | 3122 | Clic (86.0, 668.0) · Deshacer · selección 105–105 |
| 21 | 3290 | Clic (86.0, 668.0) · Deshacer · selección 106–135 |

Recuperación observada: Borrar selección resultante → Deshacer reparación local → Deshacer perturbación.

## 20 · R5 · nivel 5 · móvil

Umbral 2; recuperado; 1 clics de reparación; 1.89 s.

[Antes](evidencia/20-antes.png) → [Perturbación](evidencia/20-perturbacion.png) → [Ensayo local](evidencia/20-local.png) → [Final](evidencia/20-final.png) · [JSON](evidencia/20-traza.json)

| Paso | ms | Input / estado |
| --- | ---: | --- |
| 2 | 61 | Clic (79.0, 716.0) · SPAN · selección 0–200 |
| 4 | 682 | Clic (79.0, 716.0) · SPAN · selección 0–200 |
| 7 | 815 | Clic (331.0, 738.0) · SPAN · selección 0–200 |
| 8 | 899 | tras-caracter · selección 0–200 |
| 9 | 1032 | Clic (181.0, 617.0) · Si no hay (??) · mantén para 7 variantes · selección 29–58 |
| 10 | 1099 | tras-perturbacion · selección 62–73 |
| 11 | 1247 | Clic (299.0, 668.0) · Borrar · selección 62–73 |

Recuperación observada: Borrar selección resultante.

