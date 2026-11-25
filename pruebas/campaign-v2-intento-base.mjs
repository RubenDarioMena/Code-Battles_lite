import { createRequire } from 'node:module';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { componerCampaignV2, crearConductor } from '../paquetes/app/index.js';
import { crearAnfitrion, crearTrabajadorInterprete } from '../paquetes/anfitrion/index.js';
import { instrumentar } from '../paquetes/lenguaje/index.js';

const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
export async function montar({ consulta = 'ensayo=b1', textos = {}, semilla = 29, alPaso, checkpoint } = {}) {
  const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2&' + consulta));
  const { reglas } = config;
  const escenario = { ...config.escenario(checkpoint ? config.batallas.indexOf(checkpoint.hito) : config.indiceInicial),
    checkpoint, semillaIntento: semilla };
  const partida = crearPartida({ reglas, escenario, semilla: 71 });
  const b = partida.mundo.batalla;
  const pantalla = config.mundoPantalla(partida.mundo);
  const objetos = [...pantalla.programables, ...b.sensores].map(e => e.id.replace(/-/g, '_'));
  for (const e of config.runtime?.crearExtension(k => k).eventos ?? []) if (e.objeto) objetos.push(e.objeto);
  const preparar = fuente => ({ codigo: instrumentar(fuente, { objetos, acorn }), lenguaje: 'js', fuente });
  const programas = Object.fromEntries(pantalla.programables.map(l => [l.id, preparar(textos[l.id] ?? (l.programable ? partida.mundo.programas[l.id] : ''))]));
  const opciones = { ...config.runtime, reglas: config.reglasProgramas, crearTrabajador: crearTrabajadorInterprete({ acorn }),
    contexto: { nombres: pantalla.maquinas.map(l => l.id) } };
  const anfitrion = crearAnfitrion(opciones);
  for (const [id, p] of Object.entries(programas)) await anfitrion.cargar(id, p.codigo, p);
  const avisos = [], control = { pausa: false };
  const conductor = crearConductor({ reglas, partida, anfitrion, alPaso, alTurno: t => avisos.push(...t.avisos),
    detener: () => partida.mundo.hito !== escenario.hito,
    intento: config.runtime && { semillaIntento: partida.mundo.semillaIntento, programas, enPausa: () => control.pausa } });
  await conductor.iniciar();
  return { partida, b, anfitrion, conductor, avisos, control, opciones, reglas,
    aplicar: (unidad, fuente) => conductor.encolar({ tipo: 'programa', unidad, ...preparar(fuente) }),
    ordenar: (verbo, ...args) => conductor.encolar({ tipo: 'orden', unidad: 'LAU-01', verbo, args }) };
}
