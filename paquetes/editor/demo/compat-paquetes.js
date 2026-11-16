// Puente autónomo: la demo no carga la app ni los reglamentos del juego.
import { configurar, CMGEditor, CMGAdaptadorJS, CMGAdaptadorPython, CMGLenguajes } from '../index.js';
import { CMGEditorJS, ESTRUCTURA, crearPython, crearJSaPython } from '../../lenguaje/index.js';
import { CMGEditorPython } from '../index.js';
const globales = /** @type {any} */ (window);
configurar({ lezer: globales.LezerPython, acorn: globales.acorn });
Object.assign(window, { CMGEditor, CMGAdaptadorJS, CMGAdaptadorPython, CMGLenguajes, CMGEditorJS, ESTRUCTURA });
globales.CMGPythonJS = crearPython({ lezer: globales.LezerPython,
  hueco: CMGEditorPython.nombreDe });
globales.CMGJSaPython = crearJSaPython({ acorn: globales.acorn });
