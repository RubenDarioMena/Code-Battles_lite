/* Contrato inicial D1/D2. Las reglas de nombres llegan como datos del proveedor. */
(() => {
  "use strict";
  const python = Object.freeze({ awaitExplicito: true, asyncDef: true, awaitSuperior: true });
  function llamada(fn, lenguaje = "js") {
    const nombre = fn.nombres?.[lenguaje] || fn.nombre;
    const objeto = fn.objeto ? fn.objeto + "." : "";
    const argumentos = (fn.firma || []).map(n => lenguaje === "python"
      ? "__" + n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_") + "__"
      : "/* " + n + " */");
    const inicio = (fn.await ? "await " : "") + objeto + nombre + "(";
    const texto = inicio + argumentos.join(", ") + ")" + (lenguaje === "python" ? "" : ";");
    return { texto, sel: [inicio.length, inicio.length + (argumentos[0]?.length || 0)] };
  }
  window.CMGLenguajes = { python, llamada };
})();
