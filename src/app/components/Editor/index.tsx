'use client';

import React, { useRef } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface EditorProps {
  value: string;
  language: string;
  onChange: (val: string) => void;
  onMountInstance?: (editor: editor.IStandaloneCodeEditor) => void;
}

export default function CodeEditor({
  value,
  language,
  onChange,
  onMountInstance,
}: EditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (inst, monaco) => {
    editorRef.current = inst;

    if (onMountInstance) {
      onMountInstance(inst);
    }

    // IDE Keyboard shortcut: Cmd+K / Ctrl+K for inline AI prompt
    inst.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      () => {
        window.dispatchEvent(
          new CustomEvent('trigger-ai-inline')
        );
      }
    );
  };

  return (
    <div className="h-full w-full bg-[#1e1e1e] overflow-hidden">
      <MonacoEditor
        height="100%"
        theme="vs-dark"
        language={language}
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Fira Code, monospace',
          minimap: { enabled: true },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}