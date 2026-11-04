/* Dos anfitriones pequeños y declarativos, sin runtime ni globals del juego. */
(() => {
  "use strict";
  // Cada lenguaje tiene sus propias funciones: el proveedor recibe el lenguaje del documento.
  const funcionesDe = {
    js: ["log", "info", "warn", "error"].map(nombre => ({ grupo: "Mensajes", objeto: "console", nombre, firma: ["mensaje"] })),
    python: [{ grupo: "Mensajes", nombre: "print", firma: ["mensaje"] }],
  };
  const proveedor = {
    funciones: (l = "js") => funcionesDe[l] || [],
    vocabulario: (l = "js") => ({ objetos: l === "js" ? ["console"] : [], funciones: (funcionesDe[l] || []).map(f => f.nombre), propiedades: [] }),
    sugerencias: c => c.funcion && Object.values(funcionesDe).flat().some(f => f.nombre === c.funcion) ? {
      titulo: "Mensaje", grupos: [{ items: [{ ins: '"Hola"', cls: "str" }, { ins: '"Hasta luego"', cls: "str" }] }],
    } : null,
  };
  // Un documento por espacio (Principal, Borrador) y lenguaje. Cambiar de lenguaje abre el del otro
  // lenguaje: la demo no convierte programas.
  const iniciales = {
    js: ['console.log("Hola");\nconsole.info("Listo para empezar");\nconsole.warn("Revisa el mensaje");\n', 'let pasos = 3;\nwhile (pasos > 0) {\n  console.log(pasos);\n  pasos -= 1;\n}\n'],
    python: ['print("Hola")\nprint("Listo para empezar")\nif True:\n    print("Revisa el mensaje")\n', 'pasos = 3\nwhile pasos > 0:\n    print(pasos)\n    pasos -= 1\n'],
  };
  const borrador = { js: "// Tu borrador\n", python: "# Tu borrador\n" };
  const adaptadores = { js: CMGAdaptadorJS, python: CMGAdaptadorPython };
  const extension = { js: ".js", python: ".py" };
  // ?forma=movil o ?forma=escritorio la fuerzan, como en el juego; si no, cada editor la deduce de su ancho.
  const forma = ["movil", "escritorio"].includes(new URLSearchParams(location.search).get("forma")) ? new URLSearchParams(location.search).get("forma") : undefined;
  const instancias = [];
  for (const [i, tarjeta] of [...document.querySelectorAll("[data-demo]")].entries()) {
    const preferencias = new Map(), documentos = new Map();
    const estado = tarjeta.querySelector(".estado"), revision = tarjeta.querySelector(".revision"), selector = tarjeta.querySelector("[data-documento]"), lectura = tarjeta.querySelector("[data-lectura]");
    const raiz = tarjeta.querySelector(".demo-raiz");
    let lenguaje = i === 1 ? "python" : "js";
    const clave = (espacio, l) => espacio + extension[l];
    for (const l of Object.keys(adaptadores)) for (const espacio of ["principal", "borrador"])
      documentos.set(clave(espacio, l), { id: clave(espacio, l), lenguaje: l, texto: espacio === "principal" ? iniciales[l][i] : borrador[l], revision: 0 });
    function crear() {
      instancias[i] = CMGEditor.crear({ raiz, documento: documentos.get(clave(selector.value, lenguaje)), adaptadores, proveedor, forma,
        alPantallaCompleta: si => { estado.textContent = si ? "Pantalla completa: Esc o el botón para salir." : "Listo para editar."; },
        alCambiarLenguaje: ({ documento, lenguaje: otro }) => {
          documentos.set(documento.id, documento); lenguaje = otro;
          estado.textContent = "Documento en " + CMGLenguajes.describir(otro).nombre + ".";
          return documentos.get(clave(selector.value, otro));
        },
        preferencias: { leer: (k,d) => preferencias.has(k) ? preferencias.get(k) : d, escribir: (k,v) => preferencias.set(k,v) },
        soloLectura: () => lectura.checked,
        alCambiar(doc) { documentos.set(doc.id, doc); revision.textContent = "Revisión " + doc.revision; estado.textContent = "Documento actualizado."; },
        alAviso(html) { const tmp = document.createElement("div"); tmp.innerHTML = html; estado.textContent = tmp.textContent; },
      });
    }
    crear();
    selector.addEventListener("change", () => { const actual = instancias[i].documento(); documentos.set(actual.id, actual); instancias[i].abrir(documentos.get(clave(selector.value, lenguaje))); revision.textContent = "Revisión " + instancias[i].documento().revision; estado.textContent = "Documento abierto."; });
    lectura.addEventListener("change", () => { instancias[i].refrescar(); estado.textContent = lectura.checked ? "Solo lectura." : "Listo para editar."; });
    tarjeta.querySelector("[data-recrear]").addEventListener("click", () => {
      const anterior = instancias[i].documento(); documentos.set(anterior.id, anterior);
      instancias[i].destruir(); crear(); revision.textContent = "Revisión " + instancias[i].documento().revision;
      estado.textContent = "Editor recreado con el mismo documento y preferencias.";
    });
  }
  window.demoEditores = instancias;
})();
