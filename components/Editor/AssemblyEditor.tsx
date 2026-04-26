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
            fontSize: '13px',
            color: '#c8d6e5',
          },
          '.cm-content': {
            fontFamily: 'var(--font-geist-mono), monospace',
            padding: '12px',
            caretColor: '#00d4ff',
          },
          '.cm-gutters': {
            backgroundColor: 'oklch(0.1 0.02 260)',
            borderRight: '1px solid oklch(0.25 0.02 260 / 50%)',
            color: 'oklch(0.4 0.02 260)',
          },
          '.cm-lineNumbers .cm-gutterElement': {
            color: 'oklch(0.4 0.02 260)',
            padding: '0 8px 0 12px',
          },
          '.cm-activeLine': {
            backgroundColor: 'oklch(0.7 0.18 195 / 3%)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'oklch(0.7 0.18 195 / 5%)',
          },
          '&.cm-focused .cm-cursor': {
            borderLeftColor: '#00d4ff',
            borderLeftWidth: '2px',
          },
          '&.cm-focused .cm-selectionBackground, ::selection': {
            backgroundColor: 'oklch(0.7 0.18 195 / 15%)',
          },
          '.cm-selectionBackground': {
            backgroundColor: 'oklch(0.7 0.18 195 / 15%)',
          },
          '.cm-placeholder': {
            color: 'oklch(0.35 0.02 260)',
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
      className="h-full w-full flex flex-col overflow-hidden rounded-lg"
      style={{
        border: '1px solid oklch(0.3 0.02 260 / 50%)',
        background: 'oklch(0.1 0.02 260)',
      }}
    >
      {/* Terminal header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
        style={{
          background: 'oklch(0.12 0.015 260)',
          borderBottom: '1px solid oklch(0.25 0.02 260 / 50%)',
        }}
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(0.6 0.22 25)' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(0.75 0.15 85)' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(0.7 0.2 155)' }} />
        </div>
        <span
          className="text-[10px] font-medium tracking-wide ml-1"
          style={{ color: 'oklch(0.45 0.02 260)', fontFamily: 'var(--font-geist-mono), monospace' }}
        >
          assembly.asm
        </span>
      </div>

      {/* Editor body */}
      <div ref={editorRef} className="flex-1 overflow-auto" />
    </div>
  );
}
