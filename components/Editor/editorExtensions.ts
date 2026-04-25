import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting, StreamLanguage } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const asmLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.match(/^#.*/)) {
      return 'comment';
    }
    if (stream.match(/^(ADD|SUB|LW|SW)\b/i)) {
      return 'keyword';
    }
    if (stream.match(/^R\d+\b/i)) {
      return 'variableName';
    }
    if (stream.match(/^-?\d+\b/)) {
      return 'number';
    }
    if (stream.match(/^[,\(\)]/)) {
      return 'bracket';
    }
    stream.next();
    return null;
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c792ea' },
  { tag: tags.variableName, color: '#82cfff' },
  { tag: tags.number, color: '#f78c6c' },
  { tag: tags.comment, color: '#546e7a', fontStyle: 'italic' },
  { tag: tags.bracket, color: '#89ddff' },
]);

export const asmExtensions: Extension[] = [
  asmLanguage,
  syntaxHighlighting(highlightStyle),
];
