# Telemetría mínima (War)

Para la prueba con compañeros: saber quién entra, qué retos abre e intenta, con qué código y cuántas veces.

## Qué se envía

| Evento | Cuándo | Datos |
|---|---|---|
| `entrada` | Al abrir War | id anónimo del navegador, sesión, `quien`, reto actual, tamaño de pantalla, táctil, idioma, sitio de origen |
| `reto` | Al cambiar de reto | número y título del reto |
| `intento` | Al terminar una ejecución (victoria, fallo, error o reinicio) o al pulsar EJECUTAR con un error de sintaxis | reto, número de intento, resultado, motivo, mensaje, línea, tiempo de juego, brechas, derribos, líneas, **el código de cada lanzador** (máx. 12 000 caracteres por programa, en el lenguaje en que se escribió) y `lenguajes` (`{ "LAU-01": "python" }`, desde E5) |

El servidor añade la hora de llegada y el país (Netlify). No se guardan IP ni cuentas.

- **Solo envía desde el sitio publicado.** En `localhost`, 127.0.0.1, la red local, githack o `file:` no sale nada, salvo que se fuerce con `?telemetria=1`.
- **Nombre opcional:** comparte enlaces del tipo `…/Prototypes/Rocket%20Launcher/?quien=Ana`. El nombre queda guardado en ese navegador.
- **Desactivar:** desde Ajustes («Enviar datos anónimos de uso») o con `?telemetria=0`.

## Piezas

- Cliente: `Prototypes/Rocket Launcher/js/remota.js`. Escucha los eventos `cmg:intento` y `cmg:reto` que emite `juego.js` y los envía con `sendBeacon` a `/api/t`. Nunca bloquea ni rompe la partida.
- Servidor: `netlify/functions/t.mjs`, que guarda cada evento en Netlify Blobs (almacén `telemetria`, clave `AAAA-MM-DD/hora-azar`). Su dependencia está en `package.json` (`@netlify/blobs`); Netlify la instala en cada build.
- Prueba: `npm install && node pruebas/telemetria.mjs`, con un almacén en memoria.

## Puesta en marcha (una vez)

1. En Netlify: **Site configuration → Environment variables → Add a variable**: `TELEMETRIA_CLAVE` = una clave larga. Sin ella, la lectura queda cerrada, aunque los eventos sí se guardan.
2. Desplegar (`main`).
3. Comprobar que llega algo: abrir War en el sitio, ejecutar un intento y luego leer los datos.

## Leer los datos

- Resumen por persona y reto: `https://<sitio>/api/t?clave=CLAVE&resumen=1`
- Todos los eventos (JSON): `https://<sitio>/api/t?clave=CLAVE`
- Hoja de cálculo: `https://<sitio>/api/t?clave=CLAVE&formato=csv`
- Desde una fecha: añadir `&desde=2026-11-01`

También se ven en el panel de Netlify: **Blobs → telemetria**.
