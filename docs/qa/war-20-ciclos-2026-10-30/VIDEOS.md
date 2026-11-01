# Vídeos de regresión actual

| Caso | Duración | Resultado |
| --- | ---: | --- |
| [Sugerencias sobre el asa móvil](videos/04-sugerencias-asa.mp4) | 10,57 s | Clic en (31,8; 790,0) elige `missiles`; cerrar y borrar línea restaura la referencia. |
| [Selección rápida PC](videos/01a-seleccion-pc.mp4) | 12,93 s | 68 ms entre console y Ráfaga: no envuelve el while. Control 519 ms idéntico; Deshacer exacto. |
| [Selección rápida móvil](videos/01b-seleccion-movil.mp4) | 13,20 s | 65 ms entre autoTarget y Disparo: no envuelve el while. Control 516 ms idéntico; Deshacer exacto. |

Cada MP4 tiene JSON homónimo con inputs confiables, UTC, tiempos relativos, estados, metadatos y SHA256; `*-revision.jpg` recoge cuatro etapas revisadas y `*-final.png` conserva el cierre. FFprobe y decodificación íntegra con FFmpeg correctos. El intervalo máximo entre capturas fue 0,351 s en PC, 0,284 s en selección móvil y 0,350 s en la fricción. Salida a 30 fps con duplicados, sin audio y con HUD QA sobrepuesto. Las etiquetas históricas de los controles dicen «usa console/autoTarget»: la regla actual inserta una línea nueva al no elegir una expresión envolvible; el JSON confirma el mismo texto con y sin pausa.

Adaptador: `pruebas/war-20-video.mjs`, función `videos(page)`; usa directorio fijo. Elegir otra carpeta antes de repetir para conservar esta evidencia.
