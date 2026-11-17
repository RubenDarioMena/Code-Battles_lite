import { execFileSync } from 'node:child_process';
// El paquete no depende de lenguaje, reglamentos ni anfitrión. Este arnés externo
// proporciona sus programas reales y salidas actuales del traductor, sin fixtures duplicadas.
process.stdout.write(execFileSync(process.execPath,
  [new URL('../../../herramientas/espina-interprete/corpus-diferencial.mjs',import.meta.url).pathname],
  {encoding:'utf8',timeout:120000}));
