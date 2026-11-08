// Caso de representación sin navegador: lo que el motor dibuja y dice de un programa, en texto comparable.
//   node educational-animation/revision/pruebas/caso.cjs programa.js [--en] [--lectura] [--traza]
//   node educational-animation/revision/pruebas/caso.cjs revision-debug.json [--en] [--lectura] [--traza]
// Con un .js lo ejecuta (traza con valores, como «Tu código»). Con un informe de Depurar vuelve a montar
// su entrada (todos los programas, con sus eventos) y usa su modo, salvo --lectura/--traza.
// Salida: por programa, sus filas (número, código, etiqueta, frase de lectura, a dónde sigue), la consola y
// la narración de cada paso. Dos salidas se comparan con diff: es la evidencia de los ciclos de revisión.
const fs = require('node:fs');
const { plano } = require('./cargar.cjs');
const FL = globalThis.CMGFlujo, E = globalThis.CMGExplicar, EJ = globalThis.CMGEjecutar, I18N = globalThis.CMGI18n;

const args = process.argv.slice(2), ruta = args.find(a => !a.startsWith('--'));
if (!ruta) { console.error('Uso: caso.cjs <programa.js | revision-debug.json> [--en] [--lectura] [--traza]'); process.exit(2); }
const revivir = (_, v) => v && v.$ === 'bigint' ? BigInt(v.v) : v && v.$ === 'number' && Object.keys(v).length === 2 ? Number(v.v) : v;

(async () => {
  let G, modo = args.includes('--lectura') ? 'lectura' : args.includes('--traza') ? 'traza' : null, idioma = args.includes('--en') ? 'en' : null;
  const texto = fs.readFileSync(ruta, 'utf8');
  if (/\.json$/i.test(ruta)) {
    const inf = JSON.parse(texto, revivir);
    G = inf.entrada; modo ??= inf.contexto.modo; idioma ??= inf.contexto.idioma;
  } else {
    const r = await EJ.ejecutar(texto, { acorn });
    G = { programas: { prog: r.programa }, salida: r.salida, error: r.error, cortado: r.cortado };
    modo ??= 'traza';
  }
  I18N.cambiarIdioma(idioma || 'es');
  const out = [];
  for (const id of Object.keys(G.programas)) {
    const P = FL.preparar(G.programas[id], { id: G.serie ? id : null, serie: G.serie || 'libre' });
    const F = FL.construir(P), R = modo === 'lectura' ? FL.estructura(P, F) : FL.recorrer(P, F);
    E.lenguaje(P);
    const t = (s) => plano(P, F, s).replace(/\s+/g, ' ').trim(), num = (x) => x == null ? '·' : F.filas[x].num;
    out.push(`# ${id} · ${P.lenguaje} · ${modo} · ${I18N.idioma}`);
    for (const f of F.filas) {
      out.push(`${f.num} ${f.tipo}${f.lateral ? ' (lateral)' : ''} n${f.nivel} | ${P.txt(f.nodo).replace(/\s+/g, ' ').slice(0, 70)}`);
      out.push(`    etiqueta: ${t(E.etiqueta(P, F, f.i))}`);
      out.push(`    lectura:  ${t(E.describir(P, F, f.i))}`);
      out.push(`    sigue: sig=${num(f.sig)} si=${num(f.si)} no=${num(f.no)}${f.salida ? ` salida=${f.salida.tipo}${f.salida.fila != null ? ':' + num(f.salida.fila) : ''}` : ''}`);
    }
    out.push(`rieles: ${F.rieles.map(x => `${num(x.de)}→${num(x.a)}`).join(' ') || '—'}`);
    if (G.salida) out.push(`consola: ${G.salida.map(x => x.texto).join(' / ') || '—'}${G.error ? `  ERROR ${G.error.tipo}: ${G.error.mensaje}` : ''}`);
    out.push(`resumen: ${t(E.resumen(P, F, R))}`);
    out.push('pasos:');
    for (const p of R.pasos) out.push(`  ${num(p.fila)} ${t(E.detalle(P, F, R, p, G))}`);
    out.push('');
  }
  process.stdout.write(out.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
