/** Editor reutilizable; importa solo la entrada pública de lenguaje. */
export interface Documento {
  id: string; lenguaje: string; texto: string; revision: number;
}
export interface Preferencias {
  leer(clave: string, defecto?: any): any;
  escribir(clave: string, valor: any): void;
}
export interface Proveedor {
  funciones?(lenguaje?: string): any[];
  vocabulario?(lenguaje?: string): Record<string, any>;
  atajos?(lenguaje?: string): any[];
  sugerencias?(contexto: any): any;
}
export interface Adaptador {
  id: string; nombre: string; lexico(texto: string): any[];
  clasificar(fichas: any[], indice: number, vocabulario?: any): string | null;
  estructura: any; hueco: any; comentario: any; sangria: any;
  teclas: any[]; readonly plantillas: any[];
  crearEdicion(opciones: any): any;
  llamada(funcion: any): { texto: string; sel: number[] };
  [extension: string]: any;
}
export interface OpcionesEditor {
  raiz: HTMLElement; documento?: Documento;
  adaptadores?: Record<string, Adaptador>; proveedor?: Proveedor;
  preferencias?: Preferencias; preferenciasVistas?: Preferencias;
  alCambiar?(documento: Documento): void; alAviso?(mensaje: string): void;
  soloLectura?(): boolean;
  lenguajes?: string[]; forma?: 'movil' | 'escritorio';
  alCambiarLenguaje?(peticion: { documento: Documento; lenguaje: string }):
    Documento | { motivo: string } | Promise<Documento | { motivo: string }>;
  /** Integración con el marcado y los controles del anfitrión. */
  adoptar?: boolean; elemento?(id: string): any; ambito?: HTMLElement; app?: HTMLElement;
  serie?: string; datos?(): any; inicial?: any; aplazarVistas?: boolean;
  atajosGlobales?: boolean; pantallaNavegador?: boolean;
}
export interface Editor {
  documento(): Documento; abrir(documento: Documento): void;
  insertar(texto: string, desde?: number, hasta?: number): any;
  marcas(revision: number, lista: any[]): any;
  irALinea(linea: number): void;
  modoSinTeclado(activo?: boolean): any;
  refrescar(): void; destruir(): void;
  lenguajes(): any[]; iniciarVistas(): any;
  readonly codigo: HTMLTextAreaElement; readonly fachada: any;
  pantallaCompleta(activa?: boolean): boolean; forma(): string | null;
}
/** Contrato estructural de texto; no importa app ni conoce la plataforma. */
export interface AlmacenSesion {
  leer(clave: string): string | null;
  escribir(clave: string, texto: string): void;
  borrar(clave: string): void;
}
export interface ServiciosEditor {
  sesion?: AlmacenSesion;
  lezer?: import('../lenguaje/index.js').AnalizadorPython;
  acorn?: import('../lenguaje/index.js').AnalizadorJS;
  i18n?: { t(clave: string, parametros?: any): string };
  presentacion?: {
    html(texto: string): string; texto(texto: string): string;
    rotular(nodo: HTMLElement, texto: string): void;
  };
  /** Las vistas heredadas del juego se habilitan explícitamente; la demo solo edita texto. */
  vistas?: boolean;
}
/** Configuración de los servicios de la página; no monta ni registra oyentes. */
export function configurar(servicios?: ServiciosEditor): void;
export const CMGEditor: { crear(opciones: OpcionesEditor): Editor };
export const CMGAdaptadorJS: Adaptador;
export const CMGAdaptadorPython: Adaptador;
export const CMGLenguajes: {
  python: { awaitExplicito: boolean; asyncDef: boolean; awaitSuperior: boolean };
  catalogo: Record<string, any>;
  describir(id: string, adaptador?: any): any;
  disponibles(adaptadores?: Record<string, Adaptador>, pedidos?: string[]): any[];
  llamada(funcion: any, lenguaje?: string): { texto: string; sel: number[] };
};
export const CMGCatalogo: {
  atajos(lenguaje: string, opciones?: { pausa?: string }): any[];
  textoAtajo(atajo: any): string; lenguajes: string[]; entradas: any[];
};
export const CMGPlantillasJS: { crear(opciones?: { pausa?: string }): { atajos: any[]; textoAtajo: (atajo: any) => string } };
export const CMGEditorPython: Record<string, any>;
export const ESTRUCTURA_PYTHON: Record<string, any>;
export const CMGEditorVida: { crear(raiz: HTMLElement, ambito?: HTMLElement, globales?: boolean): any };
export const CMGEditorUI: { crear(opciones: any): any };
export const CMGEdicion: { crear(opciones: any): any };
export const CMGSeudo: { crear(opciones: any): any };
export const CMGTips: {
  crear(opciones?: { tip?: HTMLElement }): any;
  adquirir(): () => void; readonly activo: any;
};
export const ICONOS: Record<string, { c1: string; c2?: string; c3?: string; svg: string }>;
