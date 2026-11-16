// Laboratorio de batalla: reglas con paso fijo, runtime con eventos (onClick, onDamage) y las cinco pruebas completas.
// Sin navegador: los programas corren en worker_threads con el mismo código de Worker que la página.
"use strict";
const assert = require("node:assert/strict");
const { M, ESCENARIOS, BOTS, correr } = require("./lab-batalla-arnes.cjs");
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); console.log(`OK ${++checks}: ${msg}`); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); console.log(`OK ${++checks}: ${msg}`); };
const TUR = { id: "TUR-01", clase: "torreta", x: 7, y: 13 }, RAD = { id: "RAD-01", clase: "radar", x: 7, y: 13 };
const VEH = { id: "VEH-01", clase: "vehiculo", x: 3, y: 13 }, WHL = { id: "WHL-01", clase: "rueda", x: 5, y: 13 };
const mini = (unidades, oleadas = [], extra = {}) => ({ clave: "mini", muro: 20, puertas: [8, 17], unidades, oleadas, inicial: {}, ...extra });
// Mundo sin programas: las órdenes se dan a mano.
function mundo(def, hooks = {}) {
  const m = M.crear(def, 1); m.activo = true;
  const sim = M.conectar(m, { terminar: (resultado, motivo) => { m.fin = { resultado, motivo }; }, ...hooks });
  const avanzar = (s) => { for (let n = Math.round(s / M.DT); n > 0 && !m.fin; n--) sim.paso(M.DT); };
  return { m, sim, avanzar };
}

(async () => {
  // ---------- Reglas ----------
  {
    // Un vehículo cruza el muro solo por una puerta.
    const { m, sim, avanzar } = mundo(mini([VEH]));
    const u = m.porId["VEH-01"]; let cruce = null, llegada = null;
    sim.ordenar("VEH-01", "moveTo", { x: 20.5, y: 3.5 });
    for (let n = 0; n < 400 && u.moviendo; n++) { sim.paso(M.DT); if (cruce == null && u.cx >= M.MURO_X && u.cx <= M.MURO_X + 1) cruce = u.cy; }
    ok(cruce != null && Math.abs(cruce - 9) <= .8, "el vehículo cruza el muro por la puerta más cercana a su ruta");
    eq([Math.round(u.cx * 10) / 10, Math.round(u.cy * 10) / 10, u.moviendo], [20.5, 3.5, false], "y llega al destino pedido");
    const d2 = mundo(mini([VEH]), { alLlegar: (id, res) => { llegada = res; } });
    d2.sim.ordenar("VEH-01", "moveTo", { x: 20, y: 13 }); d2.avanzar(1); d2.sim.ordenar("VEH-01", "moveTo", { x: 3.5, y: 5 });
    eq(llegada, "redirigida", "una orden nueva de movimiento sustituye a la anterior y avisa a quien esperaba la llegada");
    avanzar(0);
  }
  {
    // Muro: cada enemigo que llega resta lo suyo; sin integridad se pierde, sin enemigos se gana.
    const a = mundo(mini([TUR], [{ tipo: "crawler", n: 1, t: 0, cada: 1, carriles: [3], vel: 5 }], { muro: 5 }));
    a.avanzar(12);
    eq([a.m.muro, a.m.fin && a.m.fin.resultado], [3, "victoria"], "una oruga que llega resta 2 al muro; sin enemigos, victoria");
    const b = mundo(mini([TUR], [{ tipo: "siege", n: 1, t: 0, cada: 1, carriles: [13], vel: 5 }], { muro: 2 }));
    b.avanzar(40);
    eq([b.m.muro, b.m.fin && b.m.fin.motivo], [0, "muro"], "el cañón de asedio se aposta fuera de alcance y derriba el muro a distancia");
    ok(b.m.enemigos[0].apostado && b.m.enemigos[0].x > M.MURO_X + M.CLASES.torreta.alcance, "el cañón apostado queda más lejos que el alcance de las torretas");
  }
  {
    // El tirador dispara al punto de encuentro: recto acierta, un cambio de rumbo lo esquiva.
    const duelo = (girar) => {
      const { m, sim, avanzar } = mundo(mini([WHL], [{ tipo: "gunner", n: 1, t: 0, cada: 1, carriles: [13], vel: 6, para: 30 }]));
      avanzar(4);
      const u = m.porId["WHL-01"]; u.cx = 16; u.cy = 5.5;
      sim.ordenar("WHL-01", "moveTo", { x: 40, y: 5.5 });
      // Solo cuenta el primer proyectil: se mira si la rueda sigue viva cuando cae.
      let obus = null;
      for (let n = 0; n < 200 && u.viva && !(obus && obus.hecho); n++) {
        sim.paso(M.DT);
        if (!obus && m.obuses.length) { obus = m.obuses[0]; if (girar) sim.ordenar("WHL-01", "moveTo", { x: u.cx + 1, y: 0.5 }); }
      }
      return u.viva;
    };
    eq([duelo(false), duelo(true)], [false, true], "el tirador acierta a la rueda que sigue recta y falla a la que cambia de rumbo tras el disparo");
  }
  {
    // Carga: daña a enemigos y a vehículos propios cercanos; la rueda desaparece y la base la repone.
    const { m, sim, avanzar } = mundo(mini([{ ...WHL, reponer: 3 }, VEH, { id: "WHL-02", clase: "rueda", x: 5, y: 14 }], [{ tipo: "siege", n: 1, t: 0, cada: 1, carriles: [13], vel: 6, para: 20 }, { tipo: "crawler", n: 1, t: 300, cada: 1, carriles: [1] }]));
    avanzar(6);
    const w = m.porId["WHL-01"], v = m.porId["VEH-01"], w2 = m.porId["WHL-02"], e = m.enemigos[0];
    w.cx = e.x - 1.5; w.cy = e.y; v.cx = e.x - 3; v.cy = e.y; w2.cx = e.x - 2; w2.cy = e.y + 1;
    sim.ordenar("WHL-01", "detonate"); avanzar(.1);
    eq([m.enemigos.length, w.viva, v.hp, w2.viva], [0, false, 2, true], "la carga destruye el cañón, daña al vehículo cercano y no a otra rueda");
    avanzar(3.1);
    eq([w.viva, w.cx, w.vida], [true, w.hx, 2], "la base repone la rueda en su sitio");
  }
  {
    // Recarga y reparación solo dentro del muro.
    const { m, sim, avanzar } = mundo(mini([VEH], [{ tipo: "crawler", n: 1, t: 300, cada: 1, carriles: [1] }]));
    const u = m.porId["VEH-01"]; u.misiles = 2; u.hp = 2; u.cx = 20;
    avanzar(4); eq([u.misiles, u.hp], [2, 2], "fuera del muro el vehículo no recarga ni se repara");
    u.cx = 3.5; avanzar(4); eq([u.misiles, u.hp], [10, 4], "dentro del muro recarga 2 misiles/s y repara 1 de vida cada 2 s");
  }
  {
    // Clic: marca al enemigo y queda grabado como entrada del jugador.
    const { m, sim, avanzar } = mundo(mini([TUR], [{ tipo: "crawler", n: 1, t: 0, cada: 1, carriles: [13] }]));
    avanzar(2);
    const e = m.enemigos[0], ev = sim.clic(e.x + .3, e.y, sim.enemigoEn(e.x + .3, e.y).id, null);
    eq([ev.target, ev.enemy.id, sim.marcado(e), m.entradas.length, m.nClics], ["enemy", "O1", true, 1, 1], "un clic sobre un enemigo lo marca y se graba con su paso");
    avanzar(M.MARCA + .1); eq(sim.marcado(e), false, `la marca caduca a los ${M.MARCA} s`);
    eq(sim.clic(20, 5, null, ["TUR-01"]).target, "terrain", "un clic lejos de todo enemigo es un clic de terreno");
  }

  // ---------- Runtime: hilos, eventos y errores ----------
  const batalla = (unidades, codigos, opciones = {}, oleadas = [{ tipo: "crawler", n: 1, t: 0, cada: 1, carriles: [20] }]) =>
    correr(mini(unidades, oleadas, opciones.def), { codigos, hasta: 12, ...opciones });
  const alPaso = (acciones) => (m, sim, rt) => { for (const [paso, f] of acciones) if (m.pasos === paso && !f.hecho) { f.hecho = true; f(m, sim, rt); } };
  {
    const r = await batalla([VEH, RAD], { "VEH-01": "terrain.onClick((lugar) => { moveTo(lugar); console.log('voy', lugar.x); });\nenemies.onClick((e) => { console.log('enemigo', e.id, e.type); });" },
      { bot: alPaso([[40, (m, sim, rt) => rt.clic(15, 9, null, null)], [80, (m, sim, rt) => { const e = m.enemigos[0]; rt.clic(e.x, e.y, e.id, null); }]]) });
    const u = r.mundo.porId["VEH-01"];
    eq(r.consola.map(c => c.texto), ["voy 15", "enemigo O1 crawler"], "un programa hecho solo de oyentes sigue vivo y recibe el clic de terreno y el de enemigo");
    eq([Math.round(u.cx), Math.round(u.cy), r.errores.length], [15, 9, 0], "el oyente del terreno mueve el vehículo adonde se hizo clic");
  }
  {
    // Un oyente cambia una variable que lee el bucle; un oyente con await corre a la vez que el bucle.
    const codigo = "let n = 0, modo = 'a';\nterrain.onClick(async () => { modo = 'b'; await wait(1); modo = 'c'; });\nwhile (n < 6) { n++; console.log(modo); await wait(0.5); }";
    const r = await batalla([TUR], { "TUR-01": codigo }, { bot: alPaso([[15, (m, sim, rt) => rt.clic(20, 5, null, null)]]) });
    eq(r.consola.map(c => c.texto).join(""), "aabbcc", "el oyente cambia el estado que lee el bucle, y su await no detiene al bucle");
  }
  {
    const codigo = (n) => `terrain.onClick(() => console.log("${n}"));`;
    const r = await batalla([TUR, { id: "TUR-02", clase: "torreta", x: 7, y: 5 }], { "TUR-01": codigo("uno"), "TUR-02": codigo("dos") },
      { bot: alPaso([[10, (m, sim, rt) => rt.clic(20, 5, null, ["TUR-02"])], [20, (m, sim, rt) => rt.clic(20, 5, null, null)]]) });
    eq(r.consola.map(c => c.texto).sort().join(","), "dos,dos,uno", "con unidades elegidas el clic llega solo a ellas; sin elegir, a todas las que escuchan");
  }
  {
    const codigo = "moveTo({ x: 14, y: 13 });\nconst a = await arrive();\nmoveTo({ x: 30, y: 13 });\nconst b = await arrive();\nconsole.log(a, b, moving);";
    const r = await batalla([VEH], { "VEH-01": "terrain.onClick((l) => moveTo(l));\n" + codigo }, { bot: alPaso([[100, (m, sim, rt) => rt.clic(12, 20, null, null)]]) });
    eq(r.consola.map(c => c.texto), ["ok redirigida true"], "arrive() devuelve ok al llegar y redirigida si un clic cambió el destino");
  }
  {
    // onDamage: evento del mundo. El vehículo se retira al recibir un impacto.
    const r = await batalla([VEH], { "VEH-01": "onDamage((ev) => { console.log('hp', ev.hp); moveTo(home); });\nmoveTo({ x: 22, y: 13 });" },
      { hasta: 14 }, [{ tipo: "gunner", n: 1, t: 0, cada: 1, carriles: [13], vel: 6 }]);
    const u = r.mundo.porId["VEH-01"];
    ok(r.consola.length >= 1 && r.consola[0].texto === "hp 3" && u.cx < 12, "onDamage corre al recibir un impacto y su orden (volver a la base) se cumple");
  }
  {
    const r = await batalla([TUR, RAD, VEH], { "TUR-01": "let p = null;\nenemies.onClick((e) => { p = e.id; });\nwhile (true) { const t = track(p); if (t) { console.log(t.id, VEH_01.hp, RAD_01.count); break; } await wait(0.2); }" },
      { def: { niebla: true }, hasta: 16, bot: alPaso([[260, (m, sim, rt) => { const e = m.enemigos[0]; rt.clic(e.x, e.y, e.id, null); }]]) });
    eq(r.consola.map(c => c.texto), ["O1 4 1"], "track() sigue a un enemigo marcado aunque el sensor no lo vea (niebla); se leen el radar y otras unidades");
  }
  {
    const error = async (codigo, unidades = [TUR]) => { const r = await batalla(unidades, { [unidades[0].id]: codigo }, { hasta: 3 }); return r.errores[0] || null; };
    let e = await error("await wait(0.2);\nmoveTo({ x: 9, y: 9 });");
    ok(e && e.linea === 2 && /TUR-01 es una torreta: no tiene moveTo/.test(e.mensaje), "una orden que la unidad no tiene da un error con su línea y lo que sí puede hacer");
    e = await error("autoTarget(\"tanque\");");
    ok(e && /tipo de enemigo/.test(e.mensaje), "un tipo de enemigo desconocido se explica");
    e = await error("while (true) { wait(0.5); }");
    ok(e && /falta un await/.test(e.mensaje), "un bucle con wait() sin await se corta con un aviso claro");
    e = await error("terrain.onClick(5);");
    ok(e && /necesita una función/.test(e.mensaje), "onClick sin función se explica");
    e = await error("console.log(VEH_01.fuel);", [TUR, VEH]);
    ok(e && /VEH_01\.fuel no existe/.test(e.mensaje), "leer una propiedad inexistente de otra unidad se explica");
    const r = await batalla([TUR, { id: "TUR-02", clase: "torreta", x: 7, y: 5 }], { "TUR-01": "noExiste();", "TUR-02": "while (true) { regularShoot(autoTarget()); await wait(0.3); }" }, { hasta: 60 }, [{ tipo: "crawler", n: 1, t: 0, cada: 1, carriles: [6] }]);
    ok(r.errores.length === 1 && r.mundo.porId["TUR-02"].st.lanzados > 0 && r.mundo.t > 3, "el error de un programa no detiene la batalla ni a las demás unidades");
  }
  {
    const t0 = Date.now(), r = await batalla([TUR], { "TUR-01": "while (true) {}" }, { hasta: 2 });
    ok(r.errores.length === 1 && /sin ceder el turno/.test(r.errores[0].mensaje) && Date.now() - t0 < 6000, "un bucle sin esperas se detiene por el vigía y la batalla sigue");
  }
  {
    // Reprogramar en caliente y repetir la batalla con las mismas entradas.
    const viejo = "while (true) { console.log('viejo'); await wait(1); }", nuevo = "while (true) { console.log('nuevo'); await wait(1); }";
    const bot = () => alPaso([[50, (m, sim, rt) => rt.reprogramar("TUR-01", nuevo)], [70, (m, sim, rt) => rt.clic(20, 5, null, null)]]);
    const a = await batalla([TUR], { "TUR-01": viejo }, { hasta: 5, bot: bot() });
    eq(a.consola.map(c => c.texto).join(","), "viejo,viejo,viejo,nuevo,nuevo,nuevo", "reprogramar en caliente reinicia solo esa unidad con el código nuevo");
    eq(a.mundo.entradas.map(e => [e.paso, e.programa ? "programa" : "clic"]), [[50, "programa"], [70, "clic"]], "clics y reprogramaciones quedan grabados con su paso");
    const b = await batalla([TUR], { "TUR-01": viejo }, { hasta: 5, entradas: a.mundo.entradas });
    eq(b.consola.map(c => c.texto + "@" + c.t.toFixed(2)), a.consola.map(c => c.texto + "@" + c.t.toFixed(2)), "repetir las entradas grabadas reproduce la misma batalla");
  }
  {
    // Destruida: su programa termina; repuesta: vuelve a empezar desde la primera línea.
    const r = await batalla([{ ...WHL, reponer: 2 }, RAD], { "WHL-01": "console.log('empiezo', time);\nawait wait(1);\ndetonate();\nawait wait(30);\nconsole.log('nunca');" }, { hasta: 5 });
    eq(r.consola.map(c => c.texto), ["empiezo 0", "empiezo 3.05"], "al destruirse la unidad su programa termina y al reponerse empieza de nuevo");
  }

  // ---------- Las cinco pruebas con sus programas de partida ----------
  const res = {};
  for (const e of ESCENARIOS) {
    res[e.clave] = { solo: await correr(e.clave) };
    if (BOTS[e.clave]) res[e.clave].clics = await correr(e.clave, { bot: BOTS[e.clave]() });
    eq([res[e.clave].solo.errores.length, res[e.clave].clics ? res[e.clave].clics.errores.length : 0], [0, 0], `«${e.titulo}»: los programas de partida corren sin errores`);
  }
  const fin = (r) => r.fin && r.fin.resultado, perdidas = (r) => r.mundo.unidades.reduce((s, u) => s + u.st.bajas - u.st.detonaciones, 0);
  eq(fin(res.salida.solo), "victoria", "Salida: los vehículos salen solos según el radar y la prueba se gana sin clics");
  const sinVehiculos = await correr("salida", { codigos: { "VEH-01": "", "VEH-02": "" } });
  eq([fin(sinVehiculos), sinVehiculos.fin.motivo], ["fallo", "muro"], "Salida: sin vehículos las torretas no alcanzan al cañón y el muro cae");
  ok(res.salida.solo.mundo.unidades.filter(u => u.clase === "vehiculo").every(u => u.st.lanzados > 10 && u.st.recorrido > 60), "Salida: los dos vehículos salen, disparan y vuelven a recargar");
  eq(fin(res.rueda.solo), "victoria", "Rueda kamikaze: el zigzag de partida gana la prueba");
  const recta = await correr("rueda", { codigos: Object.fromEntries(["WHL-01", "WHL-02", "WHL-03"].map(id => [id, ESCENARIOS[1].inicial[id].replace("DESVIO = 2", "DESVIO = 0")])) });
  ok(perdidas(recta) > perdidas(res.rueda.solo) && recta.mundo.muro < res.rueda.solo.mundo.muro, `Rueda kamikaze: en línea recta se pierden más ruedas (${perdidas(recta)} frente a ${perdidas(res.rueda.solo)}) y el muro sufre más`);
  eq([fin(res.observador.solo), fin(res.observador.clics)], ["fallo", "victoria"], "Observador: sin clics el muro cae; señalando enemigos se gana");
  eq([fin(res.ordenes.solo), fin(res.ordenes.clics)], ["fallo", "victoria"], "Órdenes: sin clics nadie sale del muro; mandando con clics se gana");
  ok(fin(res.campana.clics) === "victoria" && res.campana.clics.mundo.muro > res.campana.solo.mundo.muro + 5, `Campaña 1: los clics conservan mucho más muro (${res.campana.clics.mundo.muro} frente a ${res.campana.solo.mundo.muro} de ${res.campana.solo.mundo.muroMax})`);
  ok(res.campana.clics.mundo.t > 240, "Campaña 1: la batalla dura más de cuatro minutos");
  const repetida = await correr("ordenes", { entradas: res.ordenes.clics.mundo.entradas });
  eq(repetida.resumen, res.ordenes.clics.resumen, "Órdenes: repetir los clics grabados da exactamente el mismo resultado");
  const otra = await correr("campana", { bot: BOTS.campana() });
  eq(otra.resumen, res.campana.clics.resumen, "Campaña 1: dos ejecuciones con los mismos clics son idénticas (paso fijo y semilla)");

  console.log(`${checks} comprobaciones del laboratorio de batalla correctas`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
