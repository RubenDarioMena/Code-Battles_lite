
/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarSugerencias(ctx) {
  // ---------- Sugerencias para huecos, argumentos y condiciones ----------
  // Salen de los datos de la máquina cuyo programa se edita, como los del inspector:
  // sus sensores, los enemigos del reto, sus propiedades y la red de sensores.
  const FIRMAS = {
    autoTarget: ["tipo de enemigo", "sensor"], detect: ["tipo de enemigo"], regularShoot: ["lugar"], burstFire: ["lugar"], stopFire: [],
    pickUp: ["lugar", "material"], deliver: ["lugar"], wait: ["segundos"], count: ["lugar", "material"],
    goTo: ["lugar"], irA: ["lugar"], setRecipe: ["receta"], light: ["color"], request: ["materia"], start: [], stop: [],
    recoger: ["lugar", "material"], entregar: ["lugar"], cuantos: ["lugar", "material"],
    esperar: ["segundos"], log: ["mensaje"], info: ["mensaje"], warn: ["mensaje"], error: ["mensaje"],
  };

  const OPERADORES_COND = [["&&", "y · se cumplen las dos", "condición"], ["||", "o · basta una", "condición"], ["!", "no · lo contrario", "condición"],
    ["===", "igual", "valor"], ["!==", "distinto", "valor"], [">", "mayor", "valor"], ["<", "menor", "valor"], [">=", "mayor o igual", "valor"], ["<=", "menor o igual", "valor"]];
  function sugerencias(c) {
    const clase = c.hueco ? (c.hueco === "tipo" ? "tipo de enemigo" : c.hueco)
      : c.tipo === "argumento" ? (FIRMAS[c.funcion] || [])[c.indice]
      : c.tipo === "condicion" ? "condición" : c.tipo === "valor" ? "valor" : null;
    if (ctx.ES_CAMPAIGN) return ctx.def && ctx.mundo ? ctx.uiC.sugerencias(c, clase) : null;
    const evento = ctx.extension?.eventos.find(e => e.nombre === c.funcion && (!c.objeto || c.objeto === e.objeto));
    if (evento && c.tipo === "argumento") return { titulo: evento.evento, grupos: [{ items: (c.variables || [])
      .map(ins => ({ ins, cls: "var", nota: ctx.ti18n(evento.nota) })) }] };
    if (!clase || !ctx.def) return null;
    if (ctx.ES_FACTORY && ["lugar", "material", "valor", "condición"].includes(clase)) {
      const items = clase === "lugar" ? ctx.mundo.entidades.map(e => ({ ins: ctx.varFactory(e.id), cls: "var", nota: e.nombre }))
        : clase === "material" ? ctx.factory.MATERIALES.map(m => ({ ins: JSON.stringify(m), cls: "str" }))
        : ctx.mundo.entidades.flatMap(e => ctx.factory.MATERIALES.map(mat => ({ ins: `count(${ctx.varFactory(e.id)}, ${JSON.stringify(mat)})${clase === "condición" ? " > 0" : ""}`, cls: "fn" })));
      return { titulo: clase, grupos: [{ items }, { titulo: "Del programa", items: (c.variables || []).map(v => ({ ins: v, cls: "var" })) }] };
    }
    const it = (ins, cls, nota, ver) => ({ ins, cls, nota, ver });
    const enReto = new Set(ctx.def.oleadas.map(o => o.tipo));
    const vars = (c.variables || []).map(v => it(v, "var", "variable del programa"));
    const red = ctx.mundo ? ctx.mundo.sensores : [];
    const donde = c.funcion ? `${c.objeto ? c.objeto + "." : ""}${c.funcion}(…) · ${c.indice + 1}.º valor` : "";
    switch (clase) {
      case "tipo de enemigo": {
        const oye = c.funcion === "detect";
        const tipos = Object.keys(ctx.TIPOS).sort((x, y) => /** @type {any} */ (enReto.has(y)) - /** @type {any} */ (enReto.has(x)));
        return { titulo: "Tipo de enemigo", donde, grupos: [{ items: tipos.map(t => it(`"${t}"`, "str", `${ctx.TIPOS[t].nombre}${enReto.has(t) ? " · en este reto" : ""}${oye && !ctx.TIPOS[t].suelo ? " · no se oye" : ""}`)) }] };
      }
      case "sensor":
        return { titulo: "Sensor", donde, grupos: [{ items: Object.keys(ctx.SENSOR).map(s => it(`"${s}"`, "str", `${ctx.SENSOR[s].nombre} · alcance ${ctx.def.niebla ? ctx.SENSOR[s].niebla : ctx.SENSOR[s].alcance}`)) }] };
      case "lugar": {
        const manual = ctx.$("coordenadas").value.trim();
        return { titulo: "Lugar", donde, grupos: [
          { titulo: "Del programa", items: vars },
          { titulo: "Apuntar ahora", items: [...enReto].map(t => it(`autoTarget("${t}", "visual")`, "fn", ctx.TIPOS[t].nombre)) },
          { titulo: "Red de sensores", items: red.map(s => it(`${ctx.varDe(s.id)}.detect("crawler")`, "fn", "posición actual")) },
          { titulo: "Otros", items: [it("target", "prop", "a donde apunta ahora"), it("null", "kw", "deja de disparar"), ...(manual ? [it(manual, "num", "lugar manual")] : [])] },
        ] };
      }
      case "condición":
        return { titulo: "Condición", donde, grupos: [
          { titulo: "Comprobar", items: [
            ...(c.variables || []).flatMap(v => [it(v, "var", "existe (no es null)"), it(`${v} === null`, "var", "no hay")]),
            it("!jammed", "prop", "no está atascado"), it("jammed", "prop", "está atascado"), it("missiles > 0", "prop", "quedan misiles"),
            it("failureRate < 0.25", "prop", "fallo bajo"), it("failureRate >= 0.35", "prop", "fallo alto"), it('mode === "burst"', "prop", "en ráfaga"),
            ...red.map(s => it(`${ctx.varDe(s.id)}.count > 0`, "fn", "oye enemigos")),
            it("true", "kw", "siempre"),
          ] },
          { titulo: "Combinar o comparar", items: OPERADORES_COND.map(([op, nota, h]) => it(op === "!" ? `!/* ${h} */` : `/* ${h} */ ${op} /* ${h} */`, "op", nota, op)) },
        ] };
      case "valor":
        return { titulo: "Valor", donde, grupos: [
          { titulo: "Propiedades", items: [it("failureRate", "prop", "0 a 1"), it("missiles", "prop", `0 a ${ctx.def.cargador}`), it("fireRate", "prop", "disparos/s"), it("mode", "prop", '"idle", "regular" o "burst"'), ...red.map(s => it(`${ctx.varDe(s.id)}.count`, "fn", "enemigos oídos"))] },
          { titulo: "Del programa", items: vars },
          { titulo: "Números y textos", items: [it("0", "num"), it("0.25", "num"), it("0.35", "num"), it("1", "num"), it('"idle"', "str"), it('"regular"', "str"), it('"burst"', "str"), it("null", "kw")] },
        ] };
      case "segundos":
        return { titulo: "Segundos de espera", donde, grupos: [{ items: [["0.1", "muy rápido"], ["0.25", ""], ["0.4", ""], ["0.5", "lo habitual"], ["1", ""], ["2", "lento"]].map(([n, nota]) => it(n, "num", nota)) }] };
      case "mensaje":
        return { titulo: "Mensaje", donde, grupos: [
          { titulo: "Datos de la máquina", items: [it("failureRate", "prop"), it("missiles", "prop"), it("mode", "prop"), it("target", "prop")] },
          { titulo: "Del programa", items: vars },
          { titulo: "Textos", items: [it('"Atascado"', "str"), it('"Sin misiles"', "str"), it('"Fallo alto"', "str")] },
        ] };
    }
    return null;
  }

  return {
    get FIRMAS() { return FIRMAS; },
    get OPERADORES_COND() { return OPERADORES_COND; },
    get sugerencias() { return sugerencias; }
  };
}
