/* Campaign · presentación de la serie: inspector, ayuda, sugerencias, hitos e historial.
 * Solo lee el mundo; nunca lo cambia. Los textos salen de shared/i18n/campaign.js. */
(() => {
  "use strict";
  function crear(ctx) {
    const { esc, tk, fila, nota, grupo, tkValor, varDe, t, coma, vital, celdas } = ctx;
    const C = window.CAMPAIGN, { PIEZAS, RECETAS, MAQUINAS, TARIMA_CAP, COSTE, ROBOT, PEDIDO, ARSENAL, TORRETA, HITO_MAESTRO } = C;
    const M = () => ctx.mundo, D = () => ctx.def;
    const pieza = p => t(`campaign.pieza.${p}`);
    const hitoDe = n => D().hitos[n];
    const tituloHito = n => t(`campaign.hito.${n}.titulo`);
    const tarimaDe = e => e.tarima ? M().tarimaPorId[e.tarima] : null;
    const cuenta = lista => { const n = {}; for (const p of lista) n[p] = (n[p] || 0) + 1; return n; };
    const esLugar = e => e.clase === "lugar" || e.clase === "bahia";
    const conPrograma = id => Object.hasOwn(D().inicial, id);
    const sep = `<span class="sep">=</span>`;
    const g = (clave, ...filas) => grupo(esc(t(clave)), ...filas);

    // Instantánea compartida por los valores vivos de un mismo repintado.
    let snapT = -1, snapAhora = 0, snap = null;
    function instantanea() {
      const ahora = performance.now();
      if (!snap || snapT !== M().t || ahora - snapAhora > 120) { snap = C.instantanea(M()); snapT = M().t; snapAhora = ahora; }
      return snap;
    }
    function vivo(clave) {
      const [id, p] = clave.split(":"), d = instantanea().u[id];
      if (!d) return null;
      if (p === "power") return `${d.power.used}/${d.power.max}`;
      return d[p] === null ? "null" : d[p];
    }

    const clase = e => t(`campaign.clase.${e.clase === "lugar" ? e.tipo : e.clase}`);
    function estado(e) {
      const m = M();
      if (C.esRobot(e)) {
        if (e.tarea) return ["activo", t(`campaign.estado.${e.tarea.verbo}`, { lugar: e.tarea.lugar })];
        if (e.carga) return ["", t("campaign.estado.carga", { carga: e.clase === "obrero" ? pieza(e.carga) : e.carga.tipo === "tarima" ? t("campaign.estado.tarima") : e.carga.id })];
        return ["", t("campaign.estado.libre")];
      }
      if (C.esMaquina(e)) {
        const s = C.estadoMaquina(e);
        return [{ working: "activo", blocked: "mal", changeover: "alerta", moving: "activo" }[s] || "", t(`campaign.estado.maquina.${s}`, { receta: e.cambio ? e.cambio.a : e.receta })];
      }
      if (esLugar(e)) {
        if (e.clase === "bahia" && e.pedidos.length && !e.tarima) return ["activo", t("campaign.estado.camion", { s: coma(Math.max(0, e.pedidos[0].llega - m.t)) })];
        const ta = tarimaDe(e);
        return ["", ta ? t("campaign.estado.piezas", { n: ta.piezas.length, cap: TARIMA_CAP }) : t("campaign.estado.sin_tarima")];
      }
      if (e.clase === "pad") return ["", e.maquina ? t("campaign.estado.pad_ocupado", { maquina: e.maquina }) : t("campaign.estado.pad_libre")];
      if (e.clase === "pila") return ["", t("campaign.estado.pila")];
      if (e.clase === "banda") return [e.marcha ? "activo" : "", t(e.marcha ? "campaign.estado.banda_marcha" : "campaign.estado.banda_parada", { n: e.piezas.length })];
      if (e.clase === "arsenal") return ["", t("campaign.estado.misiles", { n: e.misiles })];
      if (e.clase === "torreta") return ["", t("campaign.estado.misiles_de", { n: e.misiles, cap: TORRETA.cap })];
      if (e.clase === "control") return [e.encendida ? "activo" : "", t(e.encendida ? "campaign.estado.en_linea" : "campaign.estado.maquina.off")];
      return ["", ""];
    }
    // Etiqueta sobre el mapa: el nombre y el contador que más importa de esa unidad.
    function etiqueta(e) {
      if (C.esMaquina(e)) return e.encendida ? `${e.id} · ${e.salida.length}/${MAQUINAS[e.clase].salida}${C.estadoMaquina(e) === "blocked" ? " ⚠" : ""}` : e.id;
      if (esLugar(e)) { const ta = tarimaDe(e); const n = ta ? Object.entries(cuenta(ta.piezas)).map(([p, k]) => `${k} ${p}`).join(" · ") : ""; return n ? `${e.id} · ${n}` : e.id; }
      if (e.clase === "obrero") return e.carga ? `${e.id} · ${e.carga}` : e.id;
      if (e.clase === "banda") return `${e.id} · ${e.piezas.length}`;
      if (e.clase === "arsenal" || e.clase === "torreta") return `${e.id} · ${e.misiles}▮`;
      return e.id;
    }
    // Contadores que se ven sin seleccionar: tarimas con piezas, máquinas encendidas y la bodega.
    const siempre = e => (esLugar(e) && !!tarimaDe(e) && tarimaDe(e).piezas.length > 0) || (C.esMaquina(e) && e.encendida && (e.salida.length > 0 || !!e.proceso)) || (e.clase === "arsenal" && e.misiles > 0);
    const ALTO = { obrero: 1.3, montacargas: 2.1, prensa: 2.7, moldeadora: 2.7, mezcladora: 2.9, ensambladora: 3.6, banda: 1.3, control: 4.4, bahia: 2.4, lugar: 1.5, pad: .5, pila: 1.6, arsenal: 3, torreta: 6.2 };
    const altoEtiqueta = e => ALTO[e.clase] || 1.2;

    const seg = v => `${Math.round(v)} s`;
    function metricas(e) {
      const m = M(), k = c => t(`campaign.metrica.${c}`);
      if (C.esRobot(e)) return [[k("encargos"), e.st.encargos], [k("metros"), Math.round(e.st.metros)]];
      if (C.esMaquina(e)) return [[k("hechas"), e.hechos], [k("trabajando"), seg(e.st.tTrabajo)], [k("bloqueada"), seg(e.st.tBloqueo)], [k("sin_material"), seg(e.st.tSinMaterial)]];
      if (esLugar(e)) {
        const ta = tarimaDe(e), n = ta ? Object.entries(cuenta(ta.piezas)) : [];
        const base = n.length ? n.map(([p, c]) => [pieza(p), c]) : [[k("vacia"), ta ? "0" : "—"]];
        return e.clase === "bahia" ? [...base, [k("pedidos"), m.pedidos], [k("gastado"), m.gastado]] : base;
      }
      if (e.clase === "banda") return [[k("movidos"), e.st.movidos]];
      if (e.clase === "arsenal") return [[k("por_banda"), e.porBanda], [k("a_mano"), e.aMano]];
      if (e.clase === "torreta") return [[k("lanzados"), e.lanzados]];
      if (e.clase === "control") return [[k("energia"), `${m.energia.uso}/${m.energia.max}`], [k("presupuesto"), m.presupuesto]];
      return null;
    }
    function vitales(e) {
      const v = c => esc(t(`campaign.vital.${c}`));
      if (C.esMaquina(e)) {
        const c = MAQUINAS[e.clase], capE = c.ranuras ? Object.values(c.ranuras).reduce((a, n) => a + n, 0) : c.entrada, n = C.totalEntrada(e);
        const R = RECETAS[e.proceso ? e.proceso.receta : e.receta], pct = e.proceso ? Math.min(100, Math.round(e.proceso.prog / R.t * 100)) : e.cambio ? Math.round((1 - e.cambio.falta / e.cambio.total) * 100) : 0;
        return vital(v("entrada"), `${n}/${capE}`, celdas(n, capE)) + vital(v("salida"), `${e.salida.length}/${c.salida}`, celdas(e.salida.length, c.salida))
          + `<div class="vital" style="grid-column:1/-1"><div class="k"><span>${v(e.cambio ? "receta" : "ciclo")} · ${esc(e.cambio ? e.cambio.a : e.receta)}</span><b>${pct} %</b></div><div class="medidor"><i style="width:${pct}%"></i></div></div>`;
      }
      if (e.clase === "obrero") return vital(v("carga"), esc(e.carga ? pieza(e.carga) : "—")) + metricas(e).map(([k, x]) => vital(esc(k), esc(x))).join("");
      if (esLugar(e)) { const ta = tarimaDe(e); return vital(v("tarima"), ta ? `${ta.piezas.length}/${TARIMA_CAP}` : "—", ta ? celdas(ta.piezas.length, TARIMA_CAP) : "") + (ta ? Object.entries(cuenta(ta.piezas)).map(([p, c]) => vital(esc(pieza(p)), c)).join("") : ""); }
      if (e.clase === "arsenal" || e.clase === "torreta") return vital(v("misiles"), e.misiles) + (metricas(e) || []).map(([k, x]) => vital(esc(k), esc(x))).join("");
      return (metricas(e) || []).map(([k, x]) => vital(esc(k), esc(x))).join("");
    }

    // ---------- Fichas para el código ----------
    // Quién puede dar órdenes a esa unidad desde el programa abierto.
    function ajenoDe(e) {
      const sel = ctx.progSel, maestro = M().hito >= HITO_MAESTRO;
      if (!conPrograma(e.id) || e.id === sel || (maestro && sel === "CTL-01")) return null;
      return t(maestro ? "campaign.ins.solo_propio_maestro" : "campaign.ins.solo_propio", { unidad: e.id });
    }
    const pre = e => e.id === ctx.progSel ? "" : `${varDe(e.id)}.`;
    const prop = (e, p, valor, extra = "") => fila(tk("prop", `${pre(e)}${p}`, `${pre(e)}${p}`), sep, valor === undefined ? "" : tkValor(valor, `${e.id}:${p}`), extra);
    const propTxt = (e, p, extra = "") => fila(tk("prop", `${pre(e)}${p}`, `${pre(e)}${p}`), sep, `<span class="nota" data-vivo="${e.id}:${p}">${esc(String(vivo(`${e.id}:${p}`)))}</span>`, extra);
    const n_ = c => nota(esc(t(c)));
    function ordenes(e) {
      const p = pre(e), ajeno = ajenoDe(e), o = { ajeno };
      if (C.esRobot(e)) {
        const obrero = e.clase === "obrero";
        return [
          fila(tk("fn", `await ${p}pickUp(${obrero ? "lugar, pieza" : "lugar"})`, obrero ? `await ${p}pickUp(/* lugar */, /* material */);` : `await ${p}pickUp(/* lugar */);`, o), n_(obrero ? "campaign.ins.recoger_pieza" : "campaign.ins.recoger_tarima")),
          fila(tk("fn", `await ${p}deliver(lugar)`, `await ${p}deliver(/* lugar */);`, o), n_(obrero ? "campaign.ins.entregar_pieza" : "campaign.ins.entregar_tarima")),
          fila(tk("fn", `await ${p}goTo(lugar)`, `await ${p}goTo(/* lugar */);`, o), n_("campaign.ins.ir")),
        ];
      }
      if (C.esMaquina(e) || e.clase === "banda") {
        const f = [fila(tk("fn", `${p}start()`, `${p}start();`, o), n_("campaign.ins.arrancar")), fila(tk("fn", `${p}stop()`, `${p}stop();`, o), n_("campaign.ins.parar"))];
        if (e.clase === "banda") return f;
        f.push(fila(tk("fn", `${p}light(color)`, `${p}light("red");`, o), n_("campaign.ins.luz")));
        if (MAQUINAS[e.clase].recetas.length > 1) f.unshift(fila(tk("fn", `${p}setRecipe(receta)`, `${p}setRecipe("${MAQUINAS[e.clase].recetas[1]}");`, o), nota(esc(t("campaign.ins.cambiar_receta", { s: MAQUINAS[e.clase].cambio })))));
        return f;
      }
      if (e.clase === "bahia") return [fila(tk("fn", `${p}request(materia)`, `${p}request("polymer");`), nota(esc(t("campaign.ins.pedir", { ...COSTE, s: PEDIDO.espera }))))];
      return [];
    }
    function propiedades(e) {
      const s = instantanea().u[e.id] || {};
      if (C.esRobot(e)) return [prop(e, "cargo", s.cargo ?? undefined, s.cargo == null ? `<span class="nota" data-vivo="${e.id}:cargo">null</span>` : ""), prop(e, "busy", s.busy)];
      if (C.esMaquina(e)) return [prop(e, "output", s.output, nota(`/ ${MAQUINAS[e.clase].salida}`)), prop(e, "outputFull", s.outputFull), prop(e, "input", s.input), prop(e, "state", s.state), prop(e, "recipe", s.recipe), prop(e, "made", s.made), prop(e, "running", s.running)];
      if (esLugar(e)) return [prop(e, "pallet", s.pallet), prop(e, "items", s.items, nota(`/ ${TARIMA_CAP}`)), prop(e, "free", s.free), ...(e.clase === "bahia" ? [prop(e, "pending", s.pending)] : [])];
      if (e.clase === "pad") return [prop(e, "free", s.free)];
      if (e.clase === "banda") return [prop(e, "items", s.items), prop(e, "running", s.running)];
      if (e.clase === "arsenal" || e.clase === "torreta") return [prop(e, "missiles", s.missiles)];
      if (e.clase === "control") return [propTxt(e, "power"), prop(e, "budget", s.budget)];
      return [];
    }
    const nombre = e => g("campaign.ins.nombre", fila(tk("var", varDe(e.id), varDe(e.id)), nota(esc(t("campaign.ins.en_pantalla", { unidad: e.id }) + (e.id === ctx.progSel ? ` · ${t("campaign.ins.sin_prefijo")}` : "")))));
    const recetaTxt = r => { const R = RECETAS[r]; return t("campaign.ins.ciclo", { entra: Object.keys(R.entra).map(pieza).join(" + "), sale: pieza(R.sale), t: coma(R.t) }); };
    function datos(e) {
      const f = [], m = M(), nn = (c, p) => fila(nota(esc(t(c, p))));
      if (e.clase === "obrero" || e.clase === "montacargas") {
        f.push(nn(e.clase === "obrero" ? "campaign.ins.lleva_una" : "campaign.ins.lleva_tarima", { t: ROBOT.montacargas.cargaMax }), nn("campaign.ins.velocidad", { v: ROBOT[e.clase].vel }), nn("campaign.ins.operacion", { s: coma(ROBOT[e.clase].op) }));
      } else if (C.esMaquina(e)) {
        const c = MAQUINAS[e.clase];
        if (!e.encendida) f.push(nn("campaign.ins.apagada", { hito: hitoDe(e.desde).clave }));
        for (const r of c.recetas) f.push(fila(tk("str", `"${r}"`, `"${r}"`), nota(esc(recetaTxt(r)))));
        f.push(c.ranuras ? nn("campaign.ins.ranuras", c.ranuras) : nn("campaign.ins.entrada_cap", { n: c.entrada }), nn("campaign.ins.salida_cap", { n: c.salida }), nn("campaign.ins.consumo", { kw: c.kw }),
          fila(nota(esc(`${t("campaign.ins.peso", { t: coma(c.peso) })} · ${t(c.peso > ROBOT.montacargas.cargaMax ? "campaign.ins.pesada" : "campaign.ins.ligera")}`))));
      } else if (esLugar(e)) {
        const ta = tarimaDe(e);
        if (e.clase === "bahia") f.push(nn("campaign.ins.bahia"));
        f.push(nn("campaign.ins.capacidad_tarima", { n: TARIMA_CAP }));
        if (ta) for (const [p, c] of Object.entries(cuenta(ta.piezas))) f.push(fila(tk("str", `"${p}"`, `"${p}"`), nota(`× ${c} · ${esc(pieza(p))}`)));
      } else if (e.clase === "pad") f.push(nn("campaign.ins.pad"));
      else if (e.clase === "pila") f.push(nn("campaign.ins.pila"));
      else if (e.clase === "banda") f.push(nn("campaign.ins.banda"));
      else if (e.clase === "arsenal") f.push(nn("campaign.ins.arsenal", { pago: ARSENAL.pago }));
      else if (e.clase === "torreta") f.push(nn("campaign.ins.torreta"));
      else if (e.clase === "control") f.push(nn(m.hito >= HITO_MAESTRO ? "campaign.ins.control" : "campaign.ins.control_off"));
      return grupo("", ...f);
    }
    function ficha(e) {
      const o = ordenes(e), p = propiedades(e);
      const c1 = nombre(e) + (o.length ? g("campaign.ins.ordenes", ...o) : "") + (esLugar(e) || C.esMaquina(e) ? g("campaign.ins.lecturas", fila(tk("fn", `count(${varDe(e.id)}, pieza)`, `count(${varDe(e.id)}, /* material */)`), n_("campaign.ins.cuenta"))) : "");
      const c2 = (p.length ? g("campaign.ins.propiedades", ...p) : "") + datos(e);
      const botones = conPrograma(e.id) && e.encendida && e.id !== ctx.progSel ? `<button type="button" class="btn chico" data-accion="programa">${esc(t("campaign.ins.editar", { unidad: e.id }))}</button>` : "";
      return { c1, c2, botones };
    }
    // Panel bajo el editor: lo que puede usar el programa abierto.
    function pie() {
      const m = M(), e = m && m.porId[ctx.progSel];
      if (!e) return `<p class="nota">${esc(t("campaign.ins.sin_programa"))}</p>`;
      const vars = ctx.variables(), visibles = m.maquinas;
      const chips = lista => fila(...lista.map(u => tk("var", varDe(u.id), varDe(u.id))));
      const maestro = e.clase === "control" && m.hito >= HITO_MAESTRO;
      return `<div class="pie-ins-cols">`
        + g("campaign.ins.ordenes", ...ordenes(e),
          ...(maestro ? [fila(tk("fn", "await BOT_01.pickUp(lugar, pieza)", "await BOT_01.pickUp(/* lugar */, /* material */);")), fila(tk("fn", "await BOT_01.deliver(lugar)", "await BOT_01.deliver(/* lugar */);")),
            fila(tk("fn", "ASM_01.setRecipe(receta)", 'ASM_01.setRecipe("missile");')), fila(tk("fn", "BAY_1.request(materia)", 'BAY_1.request("polymer");'))] : []),
          fila(tk("fn", "await wait(segundos)", "await wait(0.5);"), n_("campaign.ins.pausa")),
          fila(tk("fn", "count(lugar, pieza)", "count(/* lugar */, /* material */)"), n_("campaign.ins.cuenta")))
        + (propiedades(e).length ? g("campaign.ins.propiedades", ...propiedades(e)) : "")
        + g("campaign.ins.variables", vars.length ? fila(...vars.map(([n, k]) => `<span class="var-prog">${tk("var", n, n)}${nota(k)}</span>`)) : fila(n_("campaign.ins.sin_variables")))
        + g("campaign.ins.lugares", chips(visibles.filter(u => esLugar(u) || ["pad", "pila", "arsenal"].includes(u.clase))))
        + g("campaign.ins.maquinas", chips(visibles.filter(u => C.esMaquina(u) || C.esRobot(u) || u.clase === "banda" || u.clase === "control")))
        + g("campaign.ins.piezas", fila(...Object.keys(PIEZAS).map(p => tk("str", `"${p}"`, `"${p}"`))))
        + `</div>`;
    }

    // ---------- Sugerencias para huecos y argumentos ----------
    function sugerencias(c, claseHueco) {
      const m = M(), it = (ins, cls, nota_, ver) => ({ ins, cls, nota: nota_, ver });
      const DE_FUNCION = { setRecipe: "receta", light: "color", request: "materia" };
      const cl = c.funcion && DE_FUNCION[c.funcion] && c.indice === 0 ? DE_FUNCION[c.funcion] : claseHueco;
      const vars = (c.variables || []).map(v => it(v, "var", t("campaign.sug.variable")));
      const donde = c.funcion ? `${c.objeto ? c.objeto + "." : ""}${c.funcion}(…) · ${c.indice + 1}.º` : "";
      const G = k => t(`campaign.sug.g.${k}`);
      const propia = m.porId[ctx.progSel], maquinas = m.estaciones.filter(q => q.encendida), lugares = m.maquinas.filter(esLugar);
      const contenido = l => { const ta = tarimaDe(l); return ta ? Object.entries(cuenta(ta.piezas)).map(([p, k]) => `${k} ${p}`).join(" · ") || t("campaign.metrica.vacia") : t("campaign.sug.sin_tarima"); };
      switch (cl) {
        case "lugar": return { titulo: t("campaign.sug.lugar"), donde, grupos: [
          { titulo: G("tarimas"), items: lugares.map(l => it(varDe(l.id), "var", contenido(l))) },
          { titulo: G("maquinas"), items: maquinas.map(q => it(varDe(q.id), "var", estado(q)[1])) },
          { titulo: G("otros"), items: m.maquinas.filter(u => ["pad", "pila", "banda", "arsenal"].includes(u.clase)).map(u => it(varDe(u.id), "var", u.clase === "pad" ? estado(u)[1] : clase(u))) },
          { titulo: G("programa"), items: vars }] };
        case "material": return { titulo: t("campaign.sug.pieza"), donde, grupos: [{ items: Object.keys(PIEZAS).map(p => it(`"${p}"`, "str", pieza(p))) }, { titulo: G("programa"), items: vars }] };
        case "receta": return { titulo: t("campaign.sug.receta"), donde, grupos: [{ items: MAQUINAS.ensambladora.recetas.map(r => it(`"${r}"`, "str", recetaTxt(r))) }] };
        case "color": return { titulo: t("campaign.sug.color"), donde, grupos: [{ items: C.LUCES.map(x => it(`"${x}"`, "str")) }] };
        case "materia": return { titulo: t("campaign.sug.materia"), donde, grupos: [{ items: Object.keys(COSTE).map(p => it(`"${p}"`, "str", `${pieza(p)} · ₵ ${COSTE[p]}`)) }] };
        case "segundos": return { titulo: t("campaign.sug.segundos"), donde, grupos: [{ items: [["0.1", "rapido"], ["0.25", ""], ["0.5", "habitual"], ["1", ""], ["2", "lento"], ["5", ""]].map(([n, k]) => it(n, "num", k ? t(`campaign.sug.${k}`) : "")) }] };
        case "condición": {
          const propias = C.esMaquina(propia) ? [it("outputFull", "prop", t("campaign.sug.salida_llena")), it("output > 0", "prop", t("campaign.sug.hay_salida")), it("input === 0", "prop", t("campaign.sug.sin_entrada"))]
            : C.esRobot(propia) ? [it("cargo === null", "prop", t("campaign.sug.libre")), it("!busy", "prop", t("campaign.sug.libre"))] : [];
          const OPS = [["&&", "y", "condición"], ["||", "o", "condición"], ["!", "no", "condición"], ["===", "igual", "valor"], ["!==", "distinto", "valor"], [">", "mayor", "valor"], ["<", "menor", "valor"], [">=", "mayor_igual", "valor"], ["<=", "menor_igual", "valor"]];
          return { titulo: t("campaign.sug.condicion"), donde, grupos: [
            { titulo: G("comprobar"), items: [...(c.variables || []).map(v => it(v, "var", t("campaign.sug.existe"))), ...propias,
              ...maquinas.flatMap(q => [it(`${varDe(q.id)}.output > 0`, "prop", t("campaign.sug.hay_salida")), it(`${varDe(q.id)}.input === 0`, "prop", t("campaign.sug.sin_entrada"))]),
              ...lugares.filter(l => tarimaDe(l) && tarimaDe(l).piezas.length).map(l => it(`count(${varDe(l.id)}, "${tarimaDe(l).piezas[0]}") > 0`, "fn", t("campaign.sug.quedan"))),
              it("BAY_1.pallet", "prop", t("campaign.sug.hay_tarima")), it("true", "kw", t("campaign.sug.siempre"))] },
            { titulo: G("combinar"), items: OPS.map(([op, k, h]) => it(op === "!" ? `!/* ${h} */` : `/* ${h} */ ${op} /* ${h} */`, "op", t(`campaign.sug.${k}`), op)) }] };
        }
        case "valor": return { titulo: t("campaign.sug.valor"), donde, grupos: [
          { titulo: G("planta"), items: [...maquinas.flatMap(q => [it(`${varDe(q.id)}.output`, "prop"), it(`${varDe(q.id)}.input`, "prop")]), ...lugares.map(l => it(`${varDe(l.id)}.items`, "prop", contenido(l)))] },
          { titulo: G("programa"), items: vars },
          { titulo: G("numeros"), items: [it("0", "num"), it("1", "num"), it("3", "num"), it("6", "num"), it('"ok"', "str"), it('"lleno"', "str"), it('"viaje_vacio"', "str"), it("null", "kw")] }] };
        case "mensaje": return { titulo: t("campaign.sug.mensaje"), donde, grupos: [
          { titulo: G("propias"), items: C.esMaquina(propia) ? [it("output", "prop"), it("state", "prop"), it("made", "prop")] : C.esRobot(propia) ? [it("cargo", "prop")] : [it("power", "prop"), it("budget", "prop")] },
          { titulo: G("programa"), items: vars },
          { titulo: G("textos"), items: [it('"Salida llena"', "str"), it('"Sin material"', "str"), it('"Listo"', "str")] }] };
      }
      return null;
    }

    // ---------- Hitos, metas e historial ----------
    const nPistas = () => hitoDe(M().hito).pistas || 0;
    const pistas = () => Array.from({ length: nPistas() }, (_, i) => t(`campaign.hito.${M().hito}.pista.${i}`));
    function metas() {
      const m = M();
      return C.metas(m).map(x => ({
        k: `campaign-${x.k}`, nombre: esc(x.tipo === "en" ? t("campaign.meta.en", { pieza: pieza(x.pieza), lugar: x.lugar }) : x.tipo === "lotes" ? t("campaign.meta.lotes", { pieza: pieza(x.pieza) }) : t("campaign.meta.banda")),
        meta: t("campaign.meta.minimo", { n: x.n }), valor: `${Math.min(x.valor, 999)}/${x.n}`, estado: x.cumplida ? "ok" : "pendiente",
      }));
    }
    function hudExtra() {
      const m = M(), e = m.energia, alerta = e.uso > e.max;
      return `<span class="meta optimo" title="${esc(t("campaign.hud.presupuesto", { gastado: m.gastado, ingresado: m.ingresado }))}">₵ <b>${m.presupuesto}</b></span>`
        + `<span class="meta${alerta ? " rota" : ""}" title="${esc(t("campaign.hud.energia"))}">⚡ <b>${e.uso}/${e.max}</b></span>`;
    }
    function chipsHitos(historial) {
      const m = M();
      return D().hitos.map((h, i) => {
        const hecho = i < m.hito || m.completado, hay = historial.some(c => c.hito === i);
        return `<button type="button" class="reto-btn${hecho ? " hecho" : ""}" aria-pressed="${i === m.hito}" data-i="${i}"${hay ? "" : ` disabled title="${esc(t("campaign.hitos.bloqueado", { hito: hitoDe(Math.max(0, i - 1)).clave }))}"`}><span class="n">${hecho ? "✓" : i}</span>${esc(`${h.clave} · ${tituloHito(i)}`)}</button>`;
      }).join("");
    }
    function historial(lista) {
      const m = M(), fecha = c => new Date(c.cuando).toLocaleString(window.CMGI18n && window.CMGI18n.idioma === "en" ? "en" : "es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const filas = [...lista].reverse().map(c => `<li class="cp" data-cp="${c.id}">
          <div class="cp-txt"><b>${esc(t("campaign.historial.fila", { hito: hitoDe(c.hito).clave, titulo: tituloHito(c.hito) }))}</b>${c.hito === m.hito && !m.completado ? ` <span class="cp-actual">${esc(t("campaign.historial.actual"))}</span>` : ""}
            <small>${esc(t("campaign.historial.detalle", { t: coma(c.t), presupuesto: c.mundo.presupuesto, cuando: fecha(c) }))}</small></div>
          <div class="cp-acc"><button type="button" class="btn chico primario" data-cp-volver="${c.id}">${esc(t("campaign.historial.volver"))}</button><button type="button" class="btn chico" data-cp-volver="${c.id}" data-cp-programas="1">${esc(t("campaign.historial.volver_programas"))}</button></div></li>`).join("");
      return `<fieldset><legend>${esc(t("campaign.historial.titulo"))}</legend><p class="fila-bajo">${esc(t("campaign.historial.intro"))}</p>
        ${filas ? `<ol class="cp-lista">${filas}</ol>` : `<p class="fila-bajo">${esc(t("campaign.historial.vacio"))}</p>`}
        <div><button type="button" class="btn chico" data-cp-nuevo="1">${esc(t("campaign.historial.de_nuevo"))}</button></div></fieldset>`;
    }

    // ---------- Órdenes (ayuda) ----------
    function ayuda() {
      const f = (firma, clave, p) => `<div class="firma"><code>${firma}</code><p>${esc(t(clave, p))}</p></div>`;
      const k = (x) => tk("fn", x, x), h = c => `<h3>${esc(t(c))}</h3>`, li = (c, p) => `<li>${esc(t(c, p))}</li>`;
      const ej = ["while (true) {", "  if (PRS_01.output > 0) {", "    await pickUp(PRS_01);", "    await deliver(LOT_1);", '  } else if (PRS_01.input < 2 && count(SUP_1, "steel") > 0) {', '    await pickUp(SUP_1, "steel");', "    await deliver(PRS_01);", "  } else {", "    await wait(0.5);", "  }", "}"].join("\n");
      return `${h("campaign.ayuda.planta.t")}<ul>${li("campaign.ayuda.planta.1")}${li("campaign.ayuda.planta.2")}${li("campaign.ayuda.planta.3")}</ul>
        ${h("campaign.ayuda.ordenes.t")}
        ${f(`await ${k("pickUp")}(lugar, pieza)`, "campaign.ayuda.pickup")}${f(`await ${k("deliver")}(lugar)`, "campaign.ayuda.deliver")}${f(`await ${k("goTo")}(lugar)`, "campaign.ayuda.goto")}
        <p class="leccion" style="margin:0">${esc(t("campaign.ayuda.resultados"))}</p>
        ${h("campaign.ayuda.maquinas.t")}<p>${esc(t("campaign.ayuda.maquinas.1"))}</p>
        ${f(`${k("start")}() · ${k("stop")}()`, "campaign.ayuda.startstop")}${f(`${k("light")}(color)`, "campaign.ayuda.light")}
        ${f(`${k("setRecipe")}(receta)`, "campaign.ayuda.setrecipe", { s: MAQUINAS.ensambladora.cambio })}${f(`BAY_1.${k("request")}(materia)`, "campaign.ayuda.request", { ...COSTE, s: PEDIDO.espera })}
        ${h("campaign.ayuda.lecturas.t")}${f(`${k("count")}(lugar, pieza) → número | null`, "campaign.ayuda.count")}
        <p>${esc(t("campaign.ayuda.props"))}</p>${f(`await ${k("wait")}(segundos)`, "campaign.ayuda.wait")}
        ${h("campaign.ayuda.maestro.t")}<ul>${li("campaign.ayuda.maestro.1")}${li("campaign.ayuda.maestro.2")}</ul>
        ${h("campaign.ayuda.reglas.t")}<ul>${li("campaign.ayuda.reglas.1", { vBot: ROBOT.obrero.vel, opBot: coma(ROBOT.obrero.op), vFrk: ROBOT.montacargas.vel, opFrk: coma(ROBOT.montacargas.op), peso: ROBOT.montacargas.cargaMax, tarima: TARIMA_CAP })}
          ${li("campaign.ayuda.reglas.2")}${li("campaign.ayuda.reglas.3", { energia: D().energia })}${li("campaign.ayuda.reglas.4", { premio: D().premioHito, pago: ARSENAL.pago })}</ul>
        ${h("campaign.ayuda.ejemplo.t")}<pre>${esc(ej)}</pre>`;
    }
    return { clase, estado, etiqueta, siempre, altoEtiqueta, metricas, vitales, ficha, pie, vivo, sugerencias, pistas, metas, hudExtra, chipsHitos, historial, ayuda, tituloHito, pieza };
  }
  window.CAMPAIGN_UI = { crear };
})();
