# Cáscara web · QA por enlace

La web es el canal de QA por enlace de Code Battle Lite. La entrada existente
`Prototypes/Rocket Launcher/js/juego.js` crea esta plataforma y la pasa a
`arrancarJuego({ plataforma, servicios })`. Steam y Android tendrán sus propias
cáscaras; ningún paquete importa `cascaras/`.

## Contrato

`crearPlataformaWeb(ventana = globalThis)` devuelve la `Plataforma` declarada en
`paquetes/app/index.d.ts`: `{ almacen, sesion }`. `almacen` adapta `localStorage`
y `sesion` adapta `sessionStorage`, en el mismo origen y con el mismo alcance
que antes. Cada almacén ofrece `leer(clave): string | null`,
`escribir(clave, texto): void` y `borrar(clave): void`.

Todo es síncrono. No añade prefijos ni serializa, normaliza o migra datos: los
consumidores conservan sus conversiones JSON, claves, textos y orden de lectura.
Los fallos, incluso al obtener el almacenamiento, se absorben en el adaptador:
una lectura fallida devuelve `null`; una escritura o borrado fallidos no lanzan.
No hay copia alternativa en memoria que cambie las lecturas siguientes.
Escritorio precargará el guardado al arrancar y escribirá en disco por detrás.
Para Node y pruebas, `app` exporta `crearPlataformaMemoria()`.

## Qué guarda la web

Inventario de los consumidores trasladados, con las mismas claves finales:

| Archivo | Claves |
| --- | --- |
| `app/juego/estado.js` | Adaptador JSON `cmg-banco03:${k}`; lee `reto`, `factory-reto`, `propio`, `factory-propio`, `hechos`, `records`, `records-lenguaje`, `${P}telemetria`, `ruteo`, `${P}vista`, `colores`, `letra`, `semillaFija`. Lee también `cmg-banco02:reto` y `cmg-banco02:propio` antes de los valores actuales de Factory. |
| `app/juego/programas.js` | `cmg-juego-confirmar-replace` (texto `false` desactiva la confirmación). |
| `app/juego/remota.js` | `cmg-banco03:remota:activa`, `:quien`, `:id`; lectura de `cmg-banco03:reto`. |
| `app/juego/vistas.js` | `CMGTerreno.CLAVE_JUEGO` (`cmg-terreno:war-v1`), solo lectura del terreno que escribe el estudio. |
| `interfaz/inspector.js` | Preferencias del editor `cmg-juego-` + `letra`, `sin-teclado`, `asa`, `barra`; vistas `cmg-juego-${P}` + `modo`, `idioma-seudo`. Factory importa `cmg-banco02:modo` → `cmg-juego-factory-modo` y `cmg-banco02:idioma` → `cmg-juego-factory-idioma-seudo` solo si falta el valor actual. |
| `interfaz/layout.js` | `cmg-juego-` + `orientacion`, `primero` (lectura antigua), `primero-{horizontal,vertical}`, `barras-plegadas`, `coordenadas`, `inspector-movil`, `reparto-${forma}[-${eje}]`. Sus paneles conservan `pie-modo`, `pie-{alto,ultimo}-${forma}`, `pantalla-completa`, `info-alto` y `pantalla-girar` bajo el mismo prefijo. |
| `interfaz/info-reto.js` | Lectura antigua `cmg-banco02:prog-${retoIdx}`; vía `guardado`, `cmg-banco03:` + `pistas`, `prog-${claveReto}`, `fuentes-${claveReto}`, `${P}reto`, `${P}vista`, `semillaFija`. |
| `editor/edicion-acciones.js` | Sesión: `cmg-portapapeles`, texto sin JSON, mediante `configurar({ sesion })`; memoria por defecto. La demo es un anfitrión autónomo y aporta su adaptador de sesión. |

`P` es `""`, `"factory-"` o `"campaign-"`; `forma` es `escritorio` o `movil`;
`eje` es `horizontal` o `vertical`; `claveReto` conserva el prefijo de serie y
el índice o `propio`. Los demás consumidores de `guardado` conservan programas,
fuentes Python, progreso, récords, intentos y checkpoints de Campaign sin cambios.

**Pendiente para escritorio:** `shared/i18n` sigue usando su propio
`localStorage`, porque es una biblioteca compartida con otras páginas. El
estudio de terreno también sigue escribiendo su clave desde su propia página.

## Verificación

`node pruebas/plataforma.mjs`: almacenes falsos, texto exacto, fallos, aislamiento,
migraciones de Factory y portapapeles. Registrada en `npm test`.
`node pruebas/juego-arranque.mjs` inyecta memoria en el arranque emulado.
`node pruebas/fronteras.mjs` solo permite a esta cáscara importar la entrada
pública de `app`; `globales-juego.mjs` impide almacenamiento de navegador en
los paquetes de producción (excluye anfitriones `demo/` y `pruebas/`).
