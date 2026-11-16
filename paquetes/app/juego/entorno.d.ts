/** Proveedores clásicos que la página carga antes de arrancarJuego. */
export {};
declare global {
  interface Window {
    LezerPython: any;
    acorn: any;
    THREE: any;
    CMGI18n: any;
    CMGPresentacion: any;
    CMGPaleta: any;
    CMGPulsos: any;
    CMGProveedor: any;
    CMGProgramas: any;
    CMGTerreno: any;
    CAMPAIGN_UI: any;
    FACTORY_FORM: any;
    __banco: any;
    cmg: any;
    __juegoListo: boolean;
  }
}
