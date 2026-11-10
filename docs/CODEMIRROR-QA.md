# CodeMirror · comparación y barrido manual

Base: `trunk` y `revision-flujo` tenían exactamente el mismo commit, `8c110b879a28fbe79fd95b3f9a035bc339b3da50`, al comparar ambas por GitHub. Rama de implementación: `codemirror-mobile`, creada desde esa base. El repositorio modificado es **Code-Battles_lite**; todavía no se ha sincronizado el editor en Mobile-Coder ni se ha generado un APK.

## Abrir la comparación

La demo aísla el editor del juego y permite probar JS/Python, dos instancias, documentos, solo lectura y recreación:

- Base: <https://raw.githack.com/RubenDarioMena/Code-Battles_lite/trunk/shared/editor/demo.html>
- CodeMirror: <https://raw.githack.com/RubenDarioMena/Code-Battles_lite/codemirror-mobile/shared/editor/demo.html>
- Base congelada: <https://raw.githack.com/RubenDarioMena/Code-Battles_lite/8c110b879a28fbe79fd95b3f9a035bc339b3da50/shared/editor/demo.html>

Juego completo:

- [War base](https://raw.githack.com/RubenDarioMena/Code-Battles_lite/trunk/Prototypes/Rocket%20Launcher/index.html).
- [War CodeMirror](https://raw.githack.com/RubenDarioMena/Code-Battles_lite/codemirror-mobile/Prototypes/Rocket%20Launcher/index.html).
- [Factory CodeMirror](https://raw.githack.com/RubenDarioMena/Code-Battles_lite/codemirror-mobile/Prototypes/Rocket%20Launcher/index.html?serie=factory).

En Factory, elige **JavaScript** antes de comparar la escritura; Seudo y Bloques siguen siendo vistas propias. En la demo, el selector de lenguaje abre un documento diferente, no convierte el texto. La demo no ejecuta programas. Para comprobar salida usa el juego; los ejemplos no resuelven sus retos.

La misma rama permite activar el motor anterior con `?editor=textarea` (o `&editor=textarea` si la URL ya tiene parámetros). Esto ayuda a aislar una diferencia del motor conservando el resto del código.

Para el ProtoMouse y la distribución completa del teléfono usa los enlaces del juego; la demo autónoma conserva su barra de edición general.

Raw.githack puede conservar caché por nombre de rama. La entrega incluye además un enlace al SHA completo publicado. El almacenamiento del navegador depende del origen y la ruta de rama no garantiza partidas aisladas: compara en perfiles o sesiones separados y usa programas de prueba.

## Ejemplos para copiar

Archivos completos: [JavaScript](qa/codemirror/ejemplo.js) y [Python](qa/codemirror/ejemplo.py).

```js
function resumir(valores) {
  let total = 0;
  for (const valor of valores) {
    if (valor > 1) {
      total += valor;
    }
  }
  return { total, etiqueta: "á 😀 <b> [texto]" };
}
const resultado = resumir([1, 2, 3]);
console.log(resultado.total); // 5
```

```python
def resumir(valores):
    total = 0
    for valor in valores:
        if valor > 1:
            total += valor
    return total

print(resumir([1, 2, 3]))  # 5
```

## Checklist · pasada funcional (móvil real)

Anota teléfono, versión de Android, navegador/WebView, teclado y versión, URL/commit e idioma. Repite con tu teclado habitual y con Gboard si son distintos. La emulación de Chromium no sustituye esta pasada.

- [ ] **Arranque:** aparecen código, numeración, barras y controles; no hay pantalla negra ni texto duplicado.
- [ ] **Escritura:** escribe y borra al principio, en medio y al final; el cursor coincide con el carácter tocado.
- [ ] **Composición:** escribe `condición`, `niño`, comillas, un emoji y una palabra usando sugerencias/deslizamiento del teclado. No se pierde ni se duplica texto.
- [ ] **Salto de línea:** Intro en medio divide la línea; al final de `{` en JS o de `:` en Python conserva la sangría correspondiente (2/4 espacios).
- [ ] **Unir líneas:** Backspace al principio une con la anterior y Delete al final, con la siguiente, si el teclado lo permite.
- [ ] **Selección nativa:** mantén pulsado y arrastra las asas entre varias líneas. Copiar, cortar y sustituir operan sobre el rango exacto.
- [ ] **Pegado:** copia el ejemplo completo y pégalo al principio y dentro de una selección. Comprueba líneas vacías, tildes, emoji y texto `<b>`.
- [ ] **Deshacer/rehacer:** alterna escritura, pegado, botones y modo sin teclado. El historial recupera el documento correcto sin saltar a otro programa.
- [ ] **Barras:** tocar pares, comentar o una plantilla conserva el foco y el teclado; no mueve el cursor por accidente.
- [ ] **ProtoMouse:** arrastra en horizontal y vertical, con y sin teclado. Mueve el cursor; con Selección encendida amplía el rango; cerca del borde desplaza el código.
- [ ] **Sugerencias:** elige un hueco de una plantilla y toca una sugerencia. No queda tapada por el teclado ni inserta una opción al abrirse bajo el dedo.
- [ ] **Sin teclado:** las fichas, las asas y las acciones siguen funcionando. Volver al teclado conserva exactamente el texto y la selección.
- [ ] **Documentos:** cambia entre Principal/Borrador en la demo; en War, entre dos lanzadores. Cada uno recupera su texto e historial.
- [ ] **Lenguaje:** cambia JS/Python y vuelve. No reaparecen callbacks ni contenido del documento anterior.
- [ ] **Solo lectura:** en la demo marca la casilla; en el juego ejecuta. No se puede modificar el programa; al desbloquearlo vuelve la escritura.
- [ ] **Guardado:** modifica un programa del juego, espera un instante y recarga. Recupera el texto exacto.
- [ ] **Multiselección:** en War selecciona dos unidades con programas diferentes; prueba Add, Replace y deshacer. No sobrescribe una unidad fuera de la selección.

## Checklist · legibilidad y geometría

- [ ] **Pares:** sitúa el cursor a ambos lados de `()`, `[]` y `{}` anidados. Se resaltan los dos símbolos correctos; los de cadenas/comentarios no producen emparejamientos de código.
- [ ] **Plegado:** toca el indicador del margen de una función y de un bloque interno. Contraer/expandir no modifica el texto al copiarlo o ejecutarlo.
- [ ] **Edición con plegado:** escribe antes y después de un bloque contraído; despliega y verifica que el contenido oculto sigue intacto. Deshacer conserva el texto completo.
- [ ] **Navegación:** salta a una línea dentro de un bloque contraído mediante un error o la navegación de la aplicación. La línea se muestra con su número original.
- [ ] **Diagnóstico:** elimina un `)` del ejemplo JS, espera aproximadamente un segundo y observa el subrayado/indicador. Consulta el detalle; restaura el símbolo y comprueba que desaparece.
- [ ] **Python:** repite quitando `:`. Los diagnósticos del editor son sintácticos; las restricciones del traductor se comprueban al ejecutar.
- [ ] **Línea larga:** añade una cadena de unas 200 letras. Se ajusta al ancho sin tapar números, cursor o barras.
- [ ] **Letra y colores:** cambia tamaño y activa/desactiva colores. El cursor y las selecciones permanecen alineados.
- [ ] **Pantalla:** abre/cierra teclado, pantalla completa, ficha inferior y vista de revisión. El código ocupa el espacio disponible sin saltos ni controles inaccesibles.
- [ ] **Anchos:** revisa al menos 320–390 px y escritorio. El margen debe seguir siendo legible y los indicadores tocables.
- [ ] **Contraste:** revisa comentarios, cadenas, selección, pares y línea de error con los temas que uses.

## Checklist · integración

- [ ] Ejecuta los ejemplos y comprueba `5` en consola. Ninguno es una solución a un reto.
- [ ] Abre los binoculares/Revisar sin ejecutar; regresa al código. No cambia el texto ni pierde las herramientas.
- [ ] En War ejecuta una orden o `console.log` del programa y observa el pulso sobre el fragmento correcto, también después de desplazar el código.
- [ ] Repite una pasada breve en Factory y en Seudo/Bloques. Estas dos vistas mantienen su representación original.
- [ ] En la demo edita ambos espacios y recrea uno: no duplica motores ni afecta al otro.
- [ ] Una vez cargados los recursos, desconecta la red y sigue editando la página abierta. Servir recursos locales evita un CDN; esto no añade una PWA ni garantiza recarga offline de raw.githack.

## Registrar un fallo

```text
URL/commit:
Teléfono / Android / navegador o WebView:
Teclado / idioma:
Motor: base o CodeMirror
Vista: JS / Python / sin teclado / Seudo / Bloques
Texto exacto antes:
Pasos mínimos:
Resultado esperado:
Resultado observado:
¿Se reproduce en la base?:
Captura o vídeo:
```

Bloqueantes: pérdida/corrupción de texto, cambios en otro documento, imposibilidad de escribir o guardar, cursor persistentemente desalineado y bloqueo del teclado. Las preferencias visuales pueden recogerse aparte con capturas comparativas.

## Verificación automatizada de la entrega

- Suite CodeMirror: **63** comprobaciones de navegador, con escritura real, pegado desde portapapeles, composición IME mediante CDP, parejas, plegado, navegación, diagnósticos, documentos, historial, ProtoMouse con/sin foco, virtualización de 1000 líneas, guardado y ejecución en ambas series.
- Demo actualizada para escribir en `.cm-content`: **73** comprobaciones.
- Integración de revisión y pulsos en el juego: **72** comprobaciones. El harness usó Chromium del entorno y respondió 204 a la petición de favicon para que el recurso ausente no se confundiera con un error de la aplicación.
- Depuración del visor, incluidas ambas series y anchos 320/390/1280: **173** comprobaciones.
- Lógica de interacción **124**, editor Python **34**, traductor Python **64**, contrato del editor e integridad de dependencias correctos. Catálogos ES/EN: **1150** claves y **12737** comprobaciones; sintaxis y `git diff --check` correctos.
- Capturas de editor y visor revisadas en Chromium. **Pendiente: teclado y tacto Android físicos.** No se compiló un APK, porque esta rama modifica el componente de Code Battle Lite.
- La comprobación del paquete Netlify detecta un problema **previo de la base**: `scripts/preparar-netlify.mjs` excluye `educational-animation/revision/motor/`, aunque el juego ya lo carga. No se modificó el empaquetador; los enlaces raw.githack sirven el repositorio completo.

## Alcance de esta rama

CodeMirror sustituye la superficie de edición con teclado e incorpora resaltado sintáctico, parejas, plegado y diagnósticos sintácticos con detalle. Conserva el historial de la aplicación para que teclado y botones no compitan. El textarea queda oculto como puerto de compatibilidad, no como un segundo editor visible. Las fichas sin teclado y las vistas Seudo/Bloques conservan su motor.

No incorpora todavía Indent-Rainbow ni mensajes Error Lens permanentes sobre cada línea. Tampoco añade IA, permisos Android, acceso a archivos del sistema ni cambios al runtime del juego. La decisión sobre sincronizar Mobile-Coder se toma después del QA de esta base.
