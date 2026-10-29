// Tokens copiados de Prototypes/Tres vistas/css/base.css (editor propio del juego, no CodeMirror).
// Si el juego cambia su paleta, actualizar aquí: ambos motores leen este archivo.
export const theme = {
  bg: '#0B0F13',
  surface: '#131A20',
  surface2: '#19222A',
  codeBg: '#0E1419',
  line: '#26313A',
  grid: '#1E2830',
  suelo: '#121A20',
  ink: '#DCE3E6',
  muted: '#8C99A3',
  accent: '#7FA3FF',
  ok: '#5FC28A',
  bad: '#F07A70',
  warn: '#E0AE4A',
  cobre: '#E2894F',
  laton: '#B4935A',
  explosion: '#F7B94A',
  tk: {
    kw: '#E2E7E2',
    fn: '#CFA2FF',
    var: '#7FA3FF',
    num: '#F27AB0',
    str: '#9BD56B',
    prop: '#63D2E0',
    com: '#7D8B94',
  },
  font: {
    display: '"Archivo", "Helvetica Neue", Arial, sans-serif',
    code: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },
} as const;

export const googleFontsUrl =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=JetBrains+Mono:ital,wght@0,400;0,600;1,400&display=swap';
