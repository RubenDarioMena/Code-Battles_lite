/* Dos anfitriones pequeños y declarativos, sin runtime ni globals del juego. */
(() => {
  "use strict";
  const funciones = ["log", "info", "warn", "error"].map(nombre => ({ grupo: "Mensajes", objeto: "console", nombre, firma: ["mensaje"] }));
  const proveedor = {
    funciones: () => funciones,
    vocabulario: () => ({ objetos: ["console"], funciones: funciones.map(f => f.nombre), propiedades: [] }),
    sugerencias: c => c.funcion && funciones.some(f => f.nombre === c.funcion) ? {
      titulo: "Mensaje", grupos: [{ items: [{ ins: '"Hola"', cls: "str" }, { ins: '"Hasta luego"', cls: "str" }] }],
    } : null,
  };
  // La demo es un IDE de un solo lenguaje por ahora: JavaScript. Python llega con su adaptador (E4).
  const iniciales = ['console.log("Hola");\nconsole.info("Listo para empezar");\nconsole.warn("Revisa el mensaje");\n', 'let pasos = 3;\nwhile (pasos > 0) {\n  console.log(pasos);\n  pasos -= 1;\n}\n'];
  // ?forma=movil o ?forma=escritorio la fuerzan, como en el juego; si no, cada editor la deduce de su ancho.
  const forma = ["movil", "escritorio"].includes(new URLSearchParams(location.search).get("forma")) ? new URLSearchParams(location.search).get("forma") : undefined;
  const instancias = [];
  for (const [i, tarjeta] of [...document.querySelectorAll("[data-demo]")].entries()) {
    const preferencias = new Map(), documentos = new Map();
    const estado = tarjeta.querySelector(".estado"), revision = tarjeta.querySelector(".revision"), selector = tarjeta.querySelector("[data-documento]"), lectura = tarjeta.querySelector("[data-lectura]");
    const raiz = tarjeta.querySelector(".demo-raiz");
    for (const id of ["principal", "borrador"]) documentos.set(id, { id, lenguaje: "js", texto: id === "principal" ? iniciales[i] : "// Tu borrador\n", revision: 0 });
    function crear() {
      instancias[i] = CMGEditor.crear({ raiz, documento: documentos.get(selector.value), adaptadores: { js: CMGAdaptadorJS }, proveedor, forma,
        alPantallaCompleta: si => { estado.textContent = si ? "Pantalla completa: Esc o el botón para salir." : "Listo para editar."; },
        preferencias: { leer: (k,d) => preferencias.has(k) ? preferencias.get(k) : d, escribir: (k,v) => preferencias.set(k,v) },
        soloLectura: () => lectura.checked,
        alCambiar(doc) { documentos.set(doc.id, doc); revision.textContent = "Revisión " + doc.revision; estado.textContent = "Documento actualizado."; },
        alAviso(html) { const tmp = document.createElement("div"); tmp.innerHTML = html; estado.textContent = tmp.textContent; },
      });
    }
    crear();
    selector.addEventListener("change", () => { instancias[i].abrir(documentos.get(selector.value)); revision.textContent = "Revisión " + instancias[i].documento().revision; estado.textContent = "Documento abierto."; });
    lectura.addEventListener("change", () => { instancias[i].refrescar(); estado.textContent = lectura.checked ? "Solo lectura." : "Listo para editar."; });
    tarjeta.querySelector("[data-recrear]").addEventListener("click", () => {
      const anterior = instancias[i].documento(); documentos.set(anterior.id, anterior);
      instancias[i].destruir(); crear(); revision.textContent = "Revisión " + instancias[i].documento().revision;
      estado.textContent = "Editor recreado con el mismo documento y preferencias.";
    });
  }
  window.demoEditores = instancias;
})();
