# Steam: lista del autor · fase 3, paso 2

La integración es opcional. El repositorio incluye `steam.json` con `appId: null`:
no carga Steam ni necesita una cuenta para jugar o probar Electron. Los agentes
no tienen acceso a Steamworks. Esta lista requiere acciones del autor; no
certifica todavía ejecutables, Steam Cloud ni Steam Deck.

1. **Cuenta y cuota — cuesta dinero y puede tardar días.** Da de alta tu cuenta
   de Steamworks, firma los acuerdos y completa identidad, banco e información
   fiscal. La cuota es **100 USD por aplicación**, más impuestos aplicables;
   se recupera tras 1.000 USD de ingresos brutos ajustados. La verificación
   fiscal puede tardar hasta 30 días. Para el estreno público hay además espera
   desde el pago, revisión y una página «próximamente» durante dos semanas;
   consulta los plazos vigentes antes de fijar fecha. Son requisitos de estreno,
   no una instrucción de publicar esta prueba. Documentación:
   [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding),
   [Steam Direct Fee](https://partner.steamgames.com/doc/gettingstarted/appfee).

2. **App y depósitos.** Crea Code Battle Lite usando el crédito de la cuota.
   Anota su **AppID** y dos **DepotID distintos**, uno restringido a Windows y
   otro a Linux, ambos x64; inclúyelos en el paquete de licencia de pruebas.
   En Installation configura las opciones de lanzamiento por sistema:
   `code-battle-lite.exe` (Windows) y `code-battle-lite` (Linux), desde la raíz
   instalada. Guarda/publica la configuración de Steamworks cuando corresponda.
   Documentación: [Depots](https://partner.steamgames.com/doc/store/application/depots),
   [Uploading to Steam](https://partner.steamgames.com/doc/sdk/uploading).

3. **AppID local.** Cambia `cascaras/escritorio/steam.json` a
   `{ "appId": 123456 }`, sustituyendo el número por el tuyo, **antes de
   empaquetar**. No hace falta `steam_appid.txt`. Para una prueba local puedes
   usar `CBL_STEAM_APPID=123456 npm run escritorio` (PowerShell:
   `$env:CBL_STEAM_APPID="123456"; npm run escritorio`). La variable prevalece
   sobre el JSON; `CBL_STEAM_APPID=0` desactiva Steam. Usa Steam abierto y una
   cuenta con licencia de la app. Un fallo de inicialización se anota una vez y
   deja jugar. La superposición solo se prepara si Steam lanzó el proceso
   (`SteamAppId` o `SteamGameId`); abrir Electron directamente no la habilita.

4. **Logro de prueba.** En Stats & Achievements crea el nombre API exacto
   `CBL_PRUEBA_VICTORIA`, con nombre visible, descripción e iconos de prueba,
   y publica la configuración. El juego lo solicita al ganar War o Factory o
   cumplir un hito de Campaign, cuyo resultado ya es victoria. No hay más
   logros ni cambios de reglas. Documentación:
   [Stats and Achievements](https://partner.steamgames.com/doc/features/achievements).

5. **Auto-Cloud, sin API adicional.** En Steam Cloud fija cuota de bytes y
   archivos suficiente para `guardado.json` (contiene programas e historial y
   puede crecer); habilita inicialmente pruebas solo para desarrolladores y
   publica los ajustes. Crea **una** regla base:
   raíz `WinAppDataRoaming`, subdirectorio `Code Battle Lite`, patrón exacto
   `guardado.json`, OS `Cross-Platform`, recursivo **desactivado**.
   Añade estas sustituciones de la raíz original `WinAppDataRoaming`:

   | Sistema | New Root | Add/Replace Path | Replace Path |
   | --- | --- | --- | --- |
   | Linux + SteamOS | `LinuxHome` | `.config/Code Battle Lite` | Sí |
   | macOS (preparación futura) | `MacAppSupport` | `Code Battle Lite` | Sí |

   Las rutas resultantes son:

   | Sistema | Archivo de Electron empaquetado |
   | --- | --- |
   | Windows | `%APPDATA%\Code Battle Lite\guardado.json` |
   | Linux / Steam Deck | `~/.config/Code Battle Lite/guardado.json` |
   | macOS | `~/Library/Application Support/Code Battle Lite/guardado.json` |

   Electron prefiere `productName: "Code Battle Lite"` al nombre npm.
   Linux usa `$XDG_CONFIG_HOME/Code Battle Lite` si esa variable está definida:
   la regla anterior supone el valor habitual `~/.config`. Si lo cambias,
   comprueba la ubicación real y adapta Auto-Cloud al entorno de prueba.
   No uses `CBL_DATOS` al probar nube: reemplaza `userData`. Comprueba las
   vistas previas de Steamworks; todas deben referirse al mismo guardado lógico.
   Excluye `ventana.json`, temporales, archivos dañados y la caché/localStorage
   de Electron (el idioma sigue allí). El guardado local se comparte entre
   cuentas del mismo usuario del SO; para probar otra cuenta, aísla sus datos.
   macOS no es un depósito entregado en este paso.
   Documentación: [Steam Cloud](https://partner.steamgames.com/doc/features/cloud),
   [app](https://www.electronjs.org/docs/latest/api/app).

6. **Rama privada.** En SteamPipe → Betas crea, por ejemplo, `qa-privada`,
   asígnale contraseña y concede licencia a las cuentas de prueba. La
   contraseña de beta se introduce en Steam, nunca en VDF ni en el repositorio.
   Documentación: [Branches (Betas)](https://partner.steamgames.com/doc/store/application/branches).

7. **Preparar y subir — acciones del autor, con descargas.** Instala SteamCMD
   siguiendo [Uploading to Steam](https://partner.steamgames.com/doc/sdk/uploading)
   y ejecuta desde la raíz del repositorio (dependencias ya instaladas):

   ```sh
   npm run test:escritorio
   npm run escritorio:empaquetar
   npm run escritorio:steam-vdf -- --appid=123456 --depot-windows=123457 --depot-linux=123458 --rama=qa-privada
   steamcmd +login TU_USUARIO +run_app_build "/ruta/absoluta/al/repo/dist/steam/app_build.vdf" +quit
   ```

   Sustituye los tres IDs, el usuario y la ruta. Introduce contraseña y Steam
   Guard cuando SteamCMD los pida; no los guardes en comandos ni archivos.
   Los VDF apuntan a `dist/escritorio/Code Battle Lite-win32-x64` y
   `dist/escritorio/Code Battle Lite-linux-x64`, con rutas absolutas: regenéralos
   si mueves el repositorio. Los registros de subida van a `dist/steam/salida`.
   Con `--rama` SteamPipe activa esa rama tras subir; verifica previamente que
   tiene contraseña. Sin `--rama` omite `setlive`: sube el build sin activarlo
   en ninguna rama. Selecciónalo después en Steamworks si procede.
   El guion comprueba ejecutables y `.node`/bibliotecas Steam en
   `resources/app.asar.unpacked/node_modules/steamworks.js/dist/` de cada build.
   Revisa permisos ejecutables del paquete Linux antes y después de subirlo.

8. **Probar desde Steam en Windows y Linux.** Selecciona la beta privada en
   Propiedades → Betas, introduce su contraseña e instala. Abre desde la
   biblioteca, prueba Mayús+Tab, gana un reto y comprueba el logro. Ciérralo,
   espera a que termine la sincronización y abre en un segundo equipo con la
   misma cuenta; comprueba programas, retos y progreso, también de Windows a
   Linux y de vuelta. Repite con Steam cerrado o sin licencia para comprobar el
   arranque independiente. Ejecuta también `npm run test:escritorio`: fuerza
   Steam inactivo y comprueba las tres series, el contraste War 2/7 (fallo) y
   victoria War 1/7 con el programa en bucle de esa referencia.

9. **Steam Deck, Linux nativo bajo Steam Linux Runtime.** En Installation →
   Linux Runtime selecciona para la rama privada un runtime compatible con
   Electron y el módulo nativo. Instala la versión Linux, sin forzar Proton;
   prueba primero con el sandbox normal. Si Chromium falla dentro del contenedor,
   recoge el error y prueba temporalmente la opción de lanzamiento
   `--no-sandbox` (si usas el campo del cliente: `%command% --no-sandbox`).
   **Solo diagnóstico:** desactiva el aislamiento de procesos de Chromium y
   aumenta el riesgo de ejecutar contenido vulnerable; retírala y resuelve
   permisos/compatibilidad del sandbox antes de distribuir. Revisa arranque,
   2D/3D, superposición, logro y nube; texto/editor legibles a **1280×800**,
   teclado en pantalla, tacto y mando (mapa Steam Input, foco, desplazamiento
   y acceso a ejecutar/parar/editar). El mando aún requiere comprobación y
   configuración; este paso no añade controles ni certifica compatibilidad.
   Documentación: [Developing for SteamOS and Linux](https://partner.steamgames.com/doc/store/application/platforms/linux).

10. **Validación real.** El criterio del plan (ejecutables de Windows y Linux
    generados por un guion y esta lista) ya se cumple; lo que falta es tuyo:
    conserva los resultados de Windows, Linux y Deck y confirma ejecutables,
    logro, superposición y nube reales. Las pruebas de los agentes usan Electron
    real sin Steam, un Steam emulado en Node y un build de macOS empaquetado
    (Steam no instalado: se comprobó que falla con aviso y el juego sigue).
