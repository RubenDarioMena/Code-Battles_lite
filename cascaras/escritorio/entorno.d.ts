export {};
declare global {
  var cblCascara: {
    nombre: 'escritorio';
    version: string;
    plataforma: import('../../paquetes/app/index.js').Plataforma;
  } | undefined;
}
