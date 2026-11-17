/* Mide cuánto reloj real tarda el presupuesto en cortar bucles sin await (War, reto 1).
 * Uso: node herramientas/espina-interprete/corte.mjs [presupuesto ...] */
import { jugar, prepararEscenario } from '../partida/jugar.mjs';
import { cargar } from '../partida/cargar.mjs';
import { crearTrabajadorInterprete } from '../../paquetes/anfitrion/index.js';

const casos = {
  vacio: 'while (true) {}',
  getter: 'while (true) { const m = yo.missiles; }',
  calculo: 'let s = 0;\nwhile (true) { for (let i = 0; i < 100; i++) s += Math.sqrt(i * s + 1); }',
};
const sesion = cargar();
for (const presupuesto of (process.argv.slice(2).map(Number).filter(Boolean).length ? process.argv.slice(2).map(Number) : [44024, 250000, 1000000])) {
  for (const [nombre, codigo] of Object.entries(casos)) {
    const tiempos = [];
    let linea;
    for (let i = 0; i < 3; i++) {
      const esc = prepararEscenario({ reglas: 'war', reto: 1, semilla: 1 });
      const crearPrograma = crearTrabajadorInterprete({ acorn: sesion.contexto.acorn, piezas: sesion.piezasTrabajador, presupuesto });
      const t0 = performance.now();
      const r = await jugar({ ...esc, sesion, crearPrograma, programas: { 'LAU-01': codigo } });
      tiempos.push(performance.now() - t0);
      linea = r.final.linea;
      if (r.final.fin !== 'error') throw new Error(`${nombre}: se esperaba error, fin ${r.final.fin}`);
    }
    console.log(`${String(presupuesto).padStart(8)} · ${nombre.padEnd(8)} · línea ${linea} · ${tiempos.map(t => t.toFixed(1)).join(' / ')} ms`);
  }
}
