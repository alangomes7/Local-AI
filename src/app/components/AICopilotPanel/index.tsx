'use client';

import { useState } from 'react';
import { Send, Bot, Copy, Check, ArrowRightToLine } from 'lucide-react';

interface AICopilotProps {
  codeContext: string;
  language: string;
  onInsertCode: (code: string) => void;
}

export default function AICopilotPanel({ codeContext, language, onInsertCode }: AICopilotProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResponse('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          codeContext,
          language,
          mode: 'complete',
        }),
      });

      if (!res.ok || !res.body) throw new Error('Generation error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Handling standard SSE chunks (data: {...})
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.replace('data: ', ''));
              const delta = parsed.choices?.[0]?.delta?.content || '';
              streamText += delta;
              setResponse(streamText);
            } catch {
              // Raw text chunk fallback
              streamText += line;
              setResponse(streamText);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setResponse('Error generating code. Please check your API credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-l border-neutral-800 text-neutral-200">
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="w-4 h-4 text-sky-400" />
          <span>Copilot Workspace</span>
        </div>
        <span className="text-xs text-neutral-400 uppercase tracking-wider">{language}</span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {response ? (
          <div className="space-y-3">
            <div className="p-3 bg-neutral-950 rounded border border-neutral-800 text-neutral-100">
              {response}
            </div>
            <button
              onClick={() => onInsertCode(response)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 rounded text-xs text-white transition-colors"
            >
              <ArrowRightToLine className="w-3.5 h-3.5" />
              Insert into Active File
            </button>
          </div>
        ) : (
          <p className="text-neutral-500 italic">Ask for refactoring, bug fixes, or algorithm generation...</p>
        )}
      </div>

      <div className="p-3 border-t border-neutral-800 bg-neutral-950">
        <div className="relative">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder="Ask AI Copilot (Enter to send)..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500 resize-none pr-10"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="absolute right-2.5 bottom-3.5 p-1.5 rounded-md bg-sky-500 text-white disabled:opacity-40 hover:bg-sky-400 transition"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}