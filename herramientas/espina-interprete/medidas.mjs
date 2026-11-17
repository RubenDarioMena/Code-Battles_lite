import { writeFileSync } from 'node:fs';
// JSON de máquina con un registro por línea: las muestras no crean archivos de miles de líneas.
export function guardarMedidas(nombre, datos) {
  function formato(v, nivel = 0) {
    if (!v || typeof v !== 'object' || nivel >= 2) return JSON.stringify(v);
    if (Array.isArray(v)) return '[\n' + v.map(x => '  '.repeat(nivel + 1) + JSON.stringify(x)).join(',\n') + '\n' + '  '.repeat(nivel) + ']';
    return '{\n' + Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) =>
      '  '.repeat(nivel + 1) + JSON.stringify(k) + ': ' + formato(x, nivel + 1)).join(',\n') + '\n' + '  '.repeat(nivel) + '}';
  }
  writeFileSync(new URL(`../../docs/qa/interprete-2026-11-17/${nombre}.json`, import.meta.url), formato(datos) + '\n');
}
