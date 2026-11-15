// ---------- Validación (también corre dentro del worker: no usa nada de fuera) ----------
// Devuelve el texto del error o null. `snap` es instantanea(m).campaign; `propia`, la unidad del programa.
export function validar(snap, propia, unidad, verbo, args) {
  const u = snap.u, v = id => String(id).replace(/-/g, "_");
  const lista = a => a.map(x => '"' + x + '"').join(", ");
  const d = u[unidad];
  if (!d) return `No existe ninguna unidad ${v(unidad)} en la planta.`;
  const ordenes = { robot: ["pickUp", "deliver", "goTo"], carretilla: ["pickUp", "deliver", "goTo"], maquina: ["start", "stop", "light", ...(d.recetas && d.recetas.length > 1 ? ["setRecipe"] : [])], banda: ["start", "stop"], bahia: ["request"] }[d.k] || [];
  if (verbo === "count") {
    const [lugar, pieza] = args;
    if (typeof lugar !== "string") return `count necesita un lugar, por ejemplo count(LOT_1, "nose").`;
    if (pieza === undefined) return `count necesita la pieza, por ejemplo count(${v(lugar)}, "nose").`;
    if (!snap.piezas.includes(pieza)) return `No existe la pieza ${JSON.stringify(pieza)}. Hay ${lista(snap.piezas)}.`;
    return null;
  }
  if (!ordenes.includes(verbo)) return `${v(unidad)} no tiene la orden ${verbo}. ${ordenes.length ? `Sus órdenes son ${ordenes.join(", ")}.` : "No recibe órdenes: solo se lee."}`;
  // Solo las unidades con programa propio reservan sus órdenes; la bahía atiende a cualquiera.
  if (d.prog && unidad !== propia && snap.maestro !== propia) {
    return `Las órdenes de ${unidad} van en su propio programa${snap.maestro ? " o en el de CTL-01, el control maestro" : ""}. Desde aquí puedes leer sus datos, como ${v(unidad)}.${d.k === "maquina" ? "output" : d.k === "bahia" ? "pallet" : d.k === "banda" ? "items" : "busy"}.`;
  }
  if (d.on === false) return `${unidad} está apagada: se enciende al llegar su hito.`;
  if (verbo === "pickUp" || verbo === "deliver" || verbo === "goTo") {
    const [lugar, pieza] = args;
    if (typeof lugar !== "string") return `${verbo} necesita un lugar de la planta, por ejemplo ${verbo}(${verbo === "pickUp" ? 'SUP_1, "steel"' : "LOT_1"}).`;
    if (!u[lugar]) return `No hay ningún lugar ${JSON.stringify(lugar)} en la planta. Elige uno del inspector.`;
    if (verbo === "pickUp" && pieza !== undefined && d.k === "robot" && !snap.piezas.includes(pieza)) return `No existe la pieza ${JSON.stringify(pieza)}. Hay ${lista(snap.piezas)}.`;
  } else if (verbo === "setRecipe") {
    if (!d.recetas.includes(args[0])) return `${v(unidad)} no conoce la receta ${JSON.stringify(args[0])}. Sus recetas son ${lista(d.recetas)}.`;
  } else if (verbo === "light") {
    if (!snap.luces.includes(args[0])) return `light necesita un color: ${lista(snap.luces)}. Recibió ${JSON.stringify(args[0])}.`;
  } else if (verbo === "request") {
    if (!Object.hasOwn(snap.coste, args[0])) return `request necesita una materia prima: ${lista(Object.keys(snap.coste))}. Recibió ${JSON.stringify(args[0])}.`;
  }
  return null;
}
// Resultado de un modo, calculado sobre la instantánea para devolverlo al programa sin esperar.
// El mundo aplica la misma regla (aplicarModo); aquí la instantánea se actualiza para las lecturas siguientes.
export function modoEnSnap(snap, unidad, verbo, args) {
  const d = snap.u[unidad];
  if (verbo === "start" || verbo === "stop") { d.running = verbo === "start"; return "ok"; }
  if (verbo === "light") return "ok";
  if (verbo === "setRecipe") {
    if (d.recipe === args[0]) return "ok";
    if (d.state === "working" || d.state === "changeover") return "ocupado";
    d.recipe = args[0]; d.state = "changeover"; return "ok";
  }
  if (verbo === "request") {
    if (d.pending >= 2) return "ocupado";
    if (snap.presupuesto < snap.coste[args[0]]) return "sin_fondos";
    snap.presupuesto -= snap.coste[args[0]]; d.pending++; return "ok";
  }
  return "ok";
}

