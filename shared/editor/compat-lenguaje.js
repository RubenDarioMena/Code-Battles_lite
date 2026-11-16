// Puente autónomo: la demo no carga la app ni los reglamentos del juego.
import { CMGEditorJS, ESTRUCTURA, crearPython, crearJSaPython } from '../../paquetes/lenguaje/index.js';
window.CMGEditorJS = CMGEditorJS;
window.ESTRUCTURA = ESTRUCTURA;
window.CMGPythonJS = crearPython({ lezer: window.LezerPython,
  hueco: nombre => window.CMGEditorPython.nombreDe(nombre) });
window.CMGJSaPython = crearJSaPython({ acorn: window.acorn });
