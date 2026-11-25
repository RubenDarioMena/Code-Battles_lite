import assert from 'node:assert/strict';
import { montar } from './campaign-v2-intento-base.mjs';

const textos = { 'LAU-01': 'await esperar(0.1);\n// fallo deliberado\nthrow new Error("prueba");',
  'LAU-02': 'while (true) { regularShoot({x:20,y:6}); await esperar(0.5); }' };
for (const paridad of [true, false]) {
  const { anfitrion, conductor, b, partida, avisos, aplicar } = await montar({ textos,
    consulta: paridad ? 'modo=paridad&batalla=b5' : 'ensayo=b5' });
  await conductor.avanzar(5);
  assert.equal(anfitrion.estado('LAU-01'), 'error');
  if (paridad) {
    assert.deepEqual(conductor.error, { unidad: 'LAU-01', mensaje: 'prueba', linea: 3 });
    assert.equal(conductor.terminada, true);
    assert.equal(aplicar('LAU-01', ''), false);
    assert.ok(!('intento' in partida.serializar()));
  } else {
    assert.equal(conductor.error, null);
    const disparos = b.porId['LAU-02'].st.lanzados;
    await conductor.avanzar(70);
    assert.ok(b.porId['LAU-02'].st.lanzados > disparos);
    assert.deepEqual(avisos.filter(m => m.type === 'errorUnidad'), [
      { type: 'errorUnidad', unidad: 'LAU-01', mensaje: 'prueba', linea: 3 }]);
    assert.equal(anfitrion.estado('LAU-01'), 'error');
    aplicar('LAU-01', 'await esperar(1);');
    await conductor.avanzar(0);
    assert.equal(anfitrion.estado('LAU-01'), 'espera');
  }
  conductor.cerrar();
}
console.log('Error de LAU-01 en línea 3, disparos de LAU-02, recuperación explícita y fin global en paridad.');
