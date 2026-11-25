# Incidente · consumo de Astra en Campaign-V2 (22–24 nov 2026)

## Qué pasó, en pocas líneas

- **Entre el 22 y el 24 de noviembre, Astra (gpt-6.2-astra, en las cuentas `codex` y `codex-astra`) implementó por porciones el prototipo Campaign-V2.**
  - En el 24-nov solo, las porciones consumieron unos **70,7 M de tokens de entrada**, el 97 % cacheados. Astra escribió **~250 k de salida**.
  - Cada porción gastó entre el 70 y el 85 % de una ventana de 5 h y entre el 11 y el 14 % de la cuota semanal.
- **El resultado:**
  - unas 6 000 líneas de código y pruebas, con la suite en 82 ok y War intacto;
  - los assets de `assets-3d` copiados, pero casi sin usar;
  - una integración dentro de la página de Rocket Launcher que estorbaba al revisar y que hubo que deshacer con una porción más («Página propia»).
- **Las causas:** el coste viene de **leer**, no de escribir.
  - Cada porción arrancaba en frío.
  - Volcaba archivos enteros de ~40 000 caracteres, que se reenviaban en ~60 llamadas.
  - Además releía la documentación obligatoria de AGENTS.md.
  - Cuatro porciones se cortaron por cuota a medias y tuvieron que releerlo todo.
  - Una sesión se atascó cuatro horas.
  - El propio plan (Claude) también contribuyó: meter V2 en el armazón compartido obligaba a cada porción a cargar archivos grandes.
- **El cambio de procedimiento:** tareas **cortas y acotadas**.
  - Contexto preparado por Claude, en lugar de exploración libre.
  - Topes de llamadas, contexto e inactividad, con lanzamiento solo con la cuota fresca.
  - Revisión de Claude tras cada tarea.

## Contenido

| Archivo | Qué es |
|---|---|
| [01-CRONOLOGIA.md](01-CRONOLOGIA.md) | Las sesiones en orden, con quién trabajó, qué pasó y cuánto costó |
| [02-AUDITORIA.md](02-AUDITORIA.md) | La auditoría completa: tokens, causas, estado del código y assets |
| [03-PROCEDIMIENTO-ASTRA.md](03-PROCEDIMIENTO-ASTRA.md) | El procedimiento nuevo de tareas cortas y acotadas, con las sugerencias |
| [04-PLANTILLA-BRIEF.md](04-PLANTILLA-BRIEF.md) | La plantilla de brief corto para cada tarea |
| [05-PASOS-PENDIENTES.md](05-PASOS-PENDIENTES.md) | Lo que falta de Campaign-V2, desglosado en tareas cortas |
| [datos/sesiones.csv](datos/sesiones.csv) | Una fila por sesión: modelo, esfuerzo, llamadas, tokens, contexto máximo y cuota antes y después |
| [datos/scripts/](datos/scripts/) | Los scripts que leen los registros de sesión de Codex y producen las cifras. Se pueden volver a ejecutar |
| [herramientas/lanzar-v2.sh](herramientas/lanzar-v2.sh) | El lanzador usado al final del 24-nov (primaria `codex-astra`, tope del 75 % en la normal) |
| [herramientas/lanzar-v3.sh](herramientas/lanzar-v3.sh) | El lanzador propuesto: comprueba la cuota antes, corta por llamadas, contexto o inactividad, y limita la salida de las herramientas |

## Estado al cerrar el informe

- Todo está en el worktree `Code-battle-lite-cv2`, rama `Campaign-V2`, **sin commits ni push**.
- La página propia es `Prototypes/Campaign-V2/`. Rocket Launcher y `reglas-campaign` vuelven a trunk, salvo la redirección.
- **Cuotas:**
  - `codex`, al 70 % de la ventana de 5 h y al 47 % de la semanal;
  - `codex-astra`, al 100 % de la ventana (vuelve a las 00:10) y al 56 % de la semanal.
- No se lanza nada nuevo hasta aplicar el procedimiento.
