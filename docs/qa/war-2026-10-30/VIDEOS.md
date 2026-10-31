# War · vídeos de reproducción y regresión · 30-oct-2026


Cada vídeo tiene rótulos de pasos y marcador de clic. El JSON del mismo nombre conserva inputs confiables, coordenadas, selección, texto, tiempos, frames y SHA-256. El [índice de tiempos](TIEMPOS.md) relaciona cada paso con su posición en el vídeo. El [reporte anterior](../war-2026-10-29/REPORTE.md) y su [diagrama secuencial](../war-2026-10-29/cadena-inputs.html) explican el contexto.

| Clip | Qué observar | Clasificación |
| --- | --- | --- |
| [01a · Selección en PC](videos/01a-seleccion-pc.mp4) | `while` seleccionado → `console` → Ráfaga rápida → el botón envuelve el bloque anterior → Deshacer → control con pausa | Bug reproducido; intervalo rápido ≈51 ms |
| [01b · Selección en móvil](videos/01b-seleccion-movil.mp4) | `while` seleccionado → `autoTarget` → Disparo rápido → `regularShoot(while…)` → Deshacer → control con pausa | Mismo bug; intervalo rápido ≈77 ms; ratón en móvil emulado |
| [02 · Residuos al borrar](videos/02-borrado-residuos.mp4) | Tres capítulos: quitar `/* valor */` deja `??`; quitar `pos` deja `const =`; ampliar una vez y quitar `stopFire()` deja `;` | Fricción reproducida; no prueba un bug de Borrar |
| [03 · Espacio del editor móvil](videos/03-espacio-movil.mp4) | Herramientas abiertas → pocas líneas → plegar herramientas → más espacio → desplazar hasta el final | Fricción condicionada por preferencias; recuperación disponible |

## Método y reejecución

Captura real de Chromium mediante CDP Page.startScreencast; MP4 H.264 sin audio, tiempos originales y duplicación a 30 fps de salida. El HUD y marcador de QA no reciben inputs ni alteran la distribución del juego. PC: 1366×900; móvil: 393×852 CSS, codificado a 416×900. Móvil emulado con ratón no valida tacto real.

El control pausado compara la selección utilizada, no la validez del programa insertado. En el clip de borrado, cada capítulo carga un texto perturbado guardado; se rotula como preparación. Deshacer revierte el borrado local. Plegar herramientas aumenta la altura de fichas de 111,7 a 262 px.

Reejecutar con Ego y un único TaskSpace, importando `pruebas/grabar-regresiones-war.mjs`: `grabarSeleccion(page)`, `grabarSeleccion(page,true)`, `grabarResiduos(page)` y `grabarVistaMovil(page)`. Leer primero AGENTS.md y la habilidad Ego Browser. Usar 8771; el script escribe programas/preferencias solo en ese origen. FFmpeg/FFprobe están en `/opt/homebrew/bin/`. Cambiar el directorio de salida antes de repetir: el script reemplaza nombres existentes.

Los cuatro MP4 fueron decodificados íntegramente y revisados por fotogramas. Sintaxis del grabador y 75 checks de lógica correctos; no se repitieron los 57 checks históricos de navegador. [Manifiesto](MANIFIESTO.json). Sin cambios al juego ni publicación.
