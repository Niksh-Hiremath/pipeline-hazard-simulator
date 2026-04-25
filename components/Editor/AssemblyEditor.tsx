'use client';

import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
import { asmExtensions } from './editorExtensions';
import { parseInstructions } from '@/lib/parser';
import type { ParseError } from '@/lib/types';

interface AssemblyEditorProps {
  value: string;
  onChange: (value: string) => void;
  onErrors: (errors: ParseError[]) => void;
}

const placeholderText = `# Example program
ADD R1, R2, R3
LW R4, 0(R1)
SUB R5, R4, R1`;

function createLinter(onErrors: (errors: ParseError[]) => void) {
  return linter((view) => {
    const code = view.state.doc.toString();
    const { errors } = parseInstructions(code);
    onErrors(errors);

    const diagnostics: Diagnostic[] = errors.map((error) => {
      const line = view.state.doc.line(Math.min(error.line, view.state.doc.lines));
      return {
        from: line.from,
        to: line.to,
        severity: 'error',
        message: error.message,
      };
    });

    return diagnostics;
  }, { delay: 300 });
}

export function AssemblyEditor({ value, onChange, onErrors }: AssemblyEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onErrorsRef = useRef(onErrors);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onErrorsRef.current = onErrors;
  }, [onErrors]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    const linterExtension = createLinter((errors) => {
      onErrorsRef.current(errors);
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        keymap.of(defaultKeymap),
        asmExtensions,
        linterExtension,
        lintGutter(),
        placeholder(placeholderText),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
            color: '#e4e4e7',
          },
          '.cm-content': {
            fontFamily: 'var(--font-geist-mono), monospace',
            padding: '16px',
            caretColor: '#c792ea',
          },
          '.cm-gutters': {
            backgroundColor: '#18181b',
            borderRight: '1px solid #27272a',
            color: '#71717a',
          },
          '.cm-lineNumbers .cm-gutterElement': {
            color: '#71717a',
            padding: '0 8px 0 16px',
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
          '&.cm-focused .cm-cursor': {
            borderLeftColor: '#c792ea',
            borderLeftWidth: '2px',
          },
          '&.cm-focused .cm-selectionBackground, ::selection': {
            backgroundColor: 'rgba(199, 146, 234, 0.2)',
          },
          '.cm-selectionBackground': {
            backgroundColor: 'rgba(199, 146, 234, 0.2)',
          },
          '.cm-placeholder': {
            color: '#71717a',
            fontStyle: 'italic',
          },
          '.cm-focused': {
            outline: 'none',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="h-full w-full overflow-auto rounded-lg border border-border bg-card"
    />
  );
}
