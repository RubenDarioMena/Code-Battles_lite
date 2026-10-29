// Resaltado común a Motion Canvas y Remotion: mismo parser (Lezer JS) y misma
// correspondencia de etiquetas → colores del editor del juego.
import {highlightTree, tagHighlighter, tags, type Tag} from '@lezer/highlight';
import {parser} from '@lezer/javascript';
import {theme} from './theme';

export const tagStyles: {tag: Tag | Tag[]; color: string}[] = [
  {tag: tags.comment, color: theme.tk.com},
  {tag: [tags.string, tags.special(tags.string)], color: theme.tk.str},
  {tag: [tags.number, tags.bool, tags.null], color: theme.tk.num},
  {tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: theme.tk.fn},
  {tag: tags.propertyName, color: theme.tk.prop},
  {tag: [tags.variableName, tags.definition(tags.variableName)], color: theme.tk.var},
  {tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.operatorKeyword, tags.moduleKeyword], color: theme.tk.kw},
];

export interface CodeToken {
  text: string;
  color: string;
}

const highlighter = tagHighlighter(tagStyles.map((s) => ({tag: s.tag, class: s.color})));

/** Divide el código en líneas de tokens coloreados (para renderizar como spans/SVG). */
export function tokenizeLines(code: string): CodeToken[][] {
  const colors: (string | null)[] = new Array(code.length).fill(null);
  highlightTree(parser.parse(code), highlighter, (from, to, classes) => {
    const color = classes.split(' ')[0];
    for (let i = from; i < to; i++) colors[i] = color;
  });
  const lines: CodeToken[][] = [[]];
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '\n') {
      lines.push([]);
      continue;
    }
    const color = colors[i] ?? theme.ink;
    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    if (last && last.color === color) last.text += ch;
    else line.push({text: ch, color});
  }
  return lines;
}
