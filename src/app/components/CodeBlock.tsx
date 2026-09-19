'use client';

import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import hljs from 'highlight.js';

interface CodeBlockProps {
  language?: string;
  code: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  'c++': 'C++',
  c: 'C',
  cs: 'C#',
  csharp: 'C#',
  py: 'Python',
  python: 'Python',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TypeScript (React)',
  jsx: 'JavaScript (React)',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  bash: 'Bash',
  sh: 'Shell',
  zsh: 'Zsh',
  sql: 'SQL',
  rust: 'Rust',
  rs: 'Rust',
  go: 'Go',
  golang: 'Go',
  java: 'Java',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  php: 'PHP',
  rb: 'Ruby',
  ruby: 'Ruby',
  swift: 'Swift',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  md: 'Markdown',
  dockerfile: 'Dockerfile',
  diff: 'Diff',
};

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const cleanLang = (language || '').toLowerCase().trim();
  const displayLang =
    LANGUAGE_LABELS[cleanLang] || cleanLang.toUpperCase() || 'CODE';

  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const highlightedHtml = useMemo(() => {
    try {
      if (cleanLang && hljs.getLanguage(cleanLang)) {
        return hljs.highlight(code, {
          language: cleanLang,
          ignoreIllegals: true,
        }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return escapeHtml(code);
    }
  }, [code, cleanLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-lg shadow-black/40 not-prose">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-neutral-900/90 border-b border-neutral-800/80 text-xs select-none">
        <span className="font-mono text-[11px] font-semibold text-neutral-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          {displayLang}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-700/40"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-neutral-400" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="overflow-x-auto p-4 text-[13px] leading-relaxed font-mono">
        <pre className="!bg-transparent !p-0 !m-0 font-mono">
          <code
            className="hljs !bg-transparent !p-0 font-mono text-[13px]"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
}
