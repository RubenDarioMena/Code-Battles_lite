/** Proveedores clásicos que la página carga antes de arrancarJuego. */
export {};
declare global {
  interface Window {
    LezerPython: any;
    acorn: any;
    THREE: any;
    CMGTrazador: any;
    CMGFlujo: any;
    CMGPythonRevision: any;
    CMGCatalogoRevision: any;
    CMGRevision: any;
    CMGI18n: any;
    CMGPresentacion: any;
    CMGTerreno: any;
    __banco: any;
    cmg: any;
    __juegoListo: boolean;
  }
}
