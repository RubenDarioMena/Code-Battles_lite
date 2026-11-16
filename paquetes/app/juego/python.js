
/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarPythonJuego(ctx) {
  // ---------- Python (E4b) ----------
  // Los fragmentos del juego (inspector, sugerencias, paleta) están escritos en JS y son cortos:
  // llamadas, valores, huecos y operadores. Con un documento Python se pasan, ficha a ficha, a su forma
  // Python (nombres del proveedor por D1, huecos __x__ por D4, sin «;»). Los bloques usan las plantillas Python.
  let nombresPython = null;
  const NOMBRES_LIT = { true: "True", false: "False", null: "None", undefined: "None" };
  function aPython(t) {
    if (t == null) return t;
    nombresPython ||= new Map(ctx.proveedorEditor.funciones().filter(f => f.nombres && f.nombres.python).map(f => [f.nombre, f.nombres.python]));
    const toks = ctx.lexico(String(t));
    let out = "";
    for (let i = 0; i < toks.length; i++) {
      const [k, v] = toks[i];
      if (k === "com") { const m = v.match(/^\/\*\s*([\s\S]*?)\s*\*\/$/); out += m ? ctx.CMGEditorPython.aHueco(m[1]) : v.startsWith("//") ? "#" + v.slice(2) : v; continue; }
      if (k === "id") {
        if (["const", "let", "var"].includes(v) && toks[i + 1] && toks[i + 1][0] === "esp") { i++; continue; }
        out += nombresPython.get(v) || NOMBRES_LIT[v] || v; continue;
      }
      if (k === "p") {
        const tres = toks.slice(i, i + 3).map(x => x[1]).join(""), dos = tres.slice(0, 2);
        if (tres === "===" || tres === "!==") { out += tres === "===" ? "==" : "!="; i += 2; continue; }
        if (dos === "&&" || dos === "||") { out += dos === "&&" ? "and" : "or"; i += 1; continue; }
        if (dos === "??") { out += "or"; i += 1; continue; }
        if (v === "!" && toks[i + 1]?.[1] !== "=") { out += "not "; continue; }
        if (v === ";") continue;
      }
      out += v;
    }
    return out;
  }
  // E5: lo que el traductor necesita del juego. Tabla de alias del proveedor (D1), objetos y propiedades.
  let opcionesPy = null, clavePy = "";
  function opcionesPython() {
    const objetos = ["yo", ...ctx.nombresVar()], clave = objetos.join("|");
    if (!opcionesPy || clavePy !== clave) { clavePy = clave; opcionesPy = ctx.lenguaje.opcionesPython(ctx.nombresVar(), ctx.proveedorEditor.alias("python"), ctx.PROPS); }
    return opcionesPy;
  }
  // Los mensajes del runtime nombran la API en JS; para una unidad en Python, con sus nombres y literales.
  function mensajePython(m) {
    nombresPython ||= new Map(ctx.proveedorEditor.funciones().filter(f => f.nombres && f.nombres.python).map(f => [f.nombre, f.nombres.python]));
    return ctx.lenguaje.mensajePython(m, nombresPython);
  }
  const jsDePython = n => { const f = ctx.proveedorEditor.funciones().find(x => x.nombres && x.nombres.python === n); return f ? f.nombre : n; };
  // Las sugerencias del juego, con el nombre JS de la función y el resultado en Python.
  function sugerenciasPython(c) {
    const r = ctx.sugerencias({ ...c, funcion: c.funcion ? jsDePython(c.funcion) : c.funcion });
    if (!r) return r;
    return { ...r, grupos: r.grupos.map(g => ({ ...g, items: g.items.map(x => ({ ...x, ins: aPython(x.ins), ver: x.ver && aPython(x.ver) })) })) };
  }
  function vocabularioPython() {
    const v = ctx.proveedorEditor.vocabulario("python"), py = ctx.proveedorEditor.funciones().map(f => (f.nombres && f.nombres.python) || f.nombre);
    return { objetos: ["yo", ...ctx.nombresVar()], funciones: v.funciones, miembros: [...new Set([...py, ...ctx.FN_MIEMBRO])], propiedades: [...ctx.PROPS] };
  }
  let atajosPy = null, atajosPySensor = undefined;
  function atajosPython() {
    const sensor = ctx.mundo && ctx.mundo.sensores[0] ? ctx.varDe(ctx.mundo.sensores[0].id) : null;
    if (atajosPy && atajosPySensor === sensor) return atajosPy;
    atajosPySensor = sensor;
    atajosPy = ctx.paletaSegura(() => window.CMGPaleta.crearPython({ serie: ctx.SERIE, sensor: () => sensor, aPython })).atajos;
    return atajosPy;
  }

  return {
    get nombresPython() { return nombresPython; }, set nombresPython(v) { nombresPython = v; },
    get NOMBRES_LIT() { return NOMBRES_LIT; },
    get aPython() { return aPython; },
    get opcionesPy() { return opcionesPy; }, set opcionesPy(v) { opcionesPy = v; },
    get clavePy() { return clavePy; }, set clavePy(v) { clavePy = v; },
    get opcionesPython() { return opcionesPython; },
    get mensajePython() { return mensajePython; },
    get jsDePython() { return jsDePython; },
    get sugerenciasPython() { return sugerenciasPython; },
    get vocabularioPython() { return vocabularioPython; },
    get atajosPy() { return atajosPy; }, set atajosPy(v) { atajosPy = v; },
    get atajosPySensor() { return atajosPySensor; }, set atajosPySensor(v) { atajosPySensor = v; },
    get atajosPython() { return atajosPython; }
  };
}
