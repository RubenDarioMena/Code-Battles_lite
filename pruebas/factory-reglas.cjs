// Reglas puras: encargos completos, conservación y límites, con paso fijo real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const c = vm.createContext({ window: {} });
for (const f of ['factory-retos', 'factory']) vm.runInContext(fs.readFileSync(`Prototypes/Rocket Launcher/js/${f}.js`, 'utf8'), c);
const { FACTORY: F, FACTORY_RETOS: D } = c.window;
function escenario(reto = 0) {
  const d = JSON.parse(JSON.stringify(D.RETOS[reto]));
  d.metas = [{ id: 'FUN', mat: 'cobre', n: 100 }]; d.maxRechazos = null;
  const m = F.crear(d, 1); m.activo = true;
  let resultado;
  const sim = F.conectar(m, { terminarOrden: r => resultado = r, terminar: (fin, motivo) => { m.fin = fin; m.motivo = motivo; }, programaAcabado: () => false, llamadaPendiente: () => false });
  const orden = (verbo, args) => { resultado = undefined; sim.iniciarOrden(verbo, args); for (let n=0; resultado === undefined && n<2000; n++) sim.paso(.05); assert.notEqual(resultado, undefined); return resultado; };
  return { m, sim, orden };
}
{
  const {m,orden}=escenario();
  const fun=m.porId.FUN; fun.cap=0;
  assert.equal(orden('recoger',['ENT-1','cobre']),'ok');
  const origen=m.robot.cargaOrigen, desde=m.robot.cargaDesde;
  assert.equal(orden('entregar',['FUN']),'lleno');
  assert.equal(m.robot.carga,'cobre'); assert.equal(m.robot.cargaOrigen,origen); assert.equal(m.robot.cargaDesde,desde);
  assert.equal(m.derrames,0); assert.equal(m.rechazos,1); assert.equal(fun.suelo.length,0);
  assert.equal(orden('entregar',['ENT-1']),'ok'); assert.equal(m.porId['ENT-1'].stock.cobre,3);
}
{
  const {m,orden}=escenario(1);
  assert.equal(orden('recoger',['ENT-1','cobre']),'ok');
  assert.equal(orden('entregar',['ENS']),'rechazado'); assert.equal(m.robot.carga,'cobre'); assert.equal(m.rechazos,1);
  m.def.maxRechazos=1; m.porId.FUN.cap=0;
  assert.equal(orden('entregar',['FUN']),'lleno'); assert.equal(m.fin,'fallo'); assert.equal(m.motivo,'rechazo');
}
console.log('OK: carga conservada, rechazo de material, devolución, límite y ausencia de derrames');
{
  const {m,sim}=escenario();
  assert.equal(sim.sensor('NO-EXISTE','cobre'),null);
  assert.equal(sim.sensor('ENT-1','silicio'),0);
  assert.equal(F.validar(m,'cuantos',['NO-EXISTE','cobre']),null);
  assert.match(F.validar(m,'recoger',['NO-EXISTE','cobre']),/No hay/);
}
console.log('OK: null en lugar inexistente, cero en existente vacío; encargos siguen validando destino');
