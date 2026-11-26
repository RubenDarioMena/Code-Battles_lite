/* Masa de las piezas (P7, opcional): solo se activa si alguna pieza del catálogo declara `masa` (kg).
 * Una receta lleva masa en todas sus piezas o en ninguna, y nunca crea materia: lo que entra y no sale en la pieza
 * ni en sus subproductos (`sub`) es pérdida registrada (escoria, humo). Consolidado del 23-nov, secciones 6.2 y 12.2. */

/** @param {{ PIEZAS: Record<string, any>, RECETAS: Record<string, any> }} cat
 * @param {{ esMaquina: (u: any) => boolean, esRobot: (u: any) => boolean }} clases */
export function crearMasa({ PIEZAS, RECETAS }, { esMaquina, esRobot }) {
  const kg = p => PIEZAS[p]?.masa ?? 0;
  const masaDe = lista => Object.entries(lista).reduce((a, [p, n]) => a + kg(p) * n, 0);
  const piezasDe = R => [...Object.keys(R.entra), R.sale, ...Object.keys(R.sub || {})];
  const conMasaReceta = R => piezasDe(R).every(p => PIEZAS[p]?.masa != null);
  /** Masa que la receta pierde en cada ciclo. */
  const perdidaDe = R => masaDe(R.entra) - kg(R.sale) - masaDe(R.sub || {});
  const conMasa = Object.values(PIEZAS).some(p => p.masa != null);
  if (conMasa) for (const [k, R] of Object.entries(RECETAS)) {
    const conDato = piezasDe(R).filter(p => PIEZAS[p]?.masa != null).length;
    if (conDato && conDato < piezasDe(R).length) throw new Error(`Receta ${k}: o todas sus piezas tienen masa o ninguna`);
    if (conDato && perdidaDe(R) < -1e-9) throw new Error(`Receta ${k}: sale más masa de la que entra`);
  }
  /** Masa (kg) de lo que hay en la planta: tarimas (también las que lleva un montacargas o tiene una máquina),
   * entradas, salidas, lo que está en proceso, la carga de los obreros y la banda. */
  function masaEnPlanta(m) {
    let total = 0;
    for (const t of m.tarimas) for (const p of t.piezas) total += kg(p);
    for (const u of m.unidades) {
      if (esMaquina(u)) {
        total += masaDe(u.entrada);
        for (const p of u.salida) total += kg(p);
        if (u.proceso) total += masaDe(RECETAS[u.proceso.receta].entra);
      } else if (esRobot(u) && typeof u.carga === "string") total += kg(u.carga);
      else if (u.clase === "banda") for (const x of u.piezas) total += kg(x.pieza);
    }
    return total;
  }
  return { conMasa, conMasaReceta, perdidaDe, masaEnPlanta };
}
