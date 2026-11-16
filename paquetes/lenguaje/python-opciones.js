export function opcionesPython(objetos, funciones, propiedades) {
  return { funciones, objetos: ["yo", ...objetos], propiedades: [...propiedades] };
}
  function mensajePython(m, nombresPython) {
    let r = String(m);
    for (const [js, py] of nombresPython) r = r.replace(new RegExp(`\\b${js}\\b`, "g"), py);
    return r.replace(/\bnull\b/g, "None").replace(/\bundefined\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/while \(true\)/g, "while True");
  }

export { mensajePython };
