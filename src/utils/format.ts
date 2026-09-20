import { Conversation, LoadedModel } from '../types/chat';

export function formatModelMemory(model: LoadedModel): string {
  if (model.memory_human) {
    return model.memory_human;
  }
  if (model.memory) {
    return model.memory;
  }
  if (typeof model.memory_bytes === 'number' && model.memory_bytes > 0) {
    const gb = model.memory_bytes / (1024 * 1024 * 1024);
    if (gb >= 1.0) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = model.memory_bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }
  if (typeof model.memory_mb === 'number' && model.memory_mb > 0) {
    if (model.memory_mb >= 1024) {
      return `${(model.memory_mb / 1024).toFixed(2)} GB`;
    }
    return `${model.memory_mb.toFixed(1)} MB`;
  }
  return '0 MB';
}

export function isVoiceOrToolModel(modelId: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return (
    lower.includes('parakeet') ||
    lower.includes('kokoro') ||
    lower.includes('whisper') ||
    lower.includes('silero') ||
    lower.includes('tts') ||
    lower.includes('stt')
  );
}

export function cleanSpeechText(content: string): string {
  if (!content) return '';
  return (
    content
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove markdown links but keep text: [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images: ![alt](url) -> ''
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      // Remove HTML tags: <tag>...</tag> or <tag/>
      .replace(/<[^>]+>/g, '')
      // Remove all Unicode emojis and pictographs
      .replace(/\p{Extended_Pictographic}/gu, '')
      // Remove emoji variations and symbols like symbols/dingbats
      .replace(
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu,
        '',
      )
      // Remove markdown headers, bullets, blockquotes, bold/italic, tilde, pipe
      .replace(/[#*_~`>[\]|]/g, '')
      // Remove leftover decorative symbols, bullets, asterisks
      .replace(/[•●■◆★☆✓✔✕✖]/g, '')
      // Normalize repeated punctuation (e.g., "....", "----", "====")
      .replace(/[-=_]{2,}/g, ' ')
      // Collapse excess whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export type SpeechLanguage =
  | 'pt'
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'it'
  | 'ja'
  | 'zh'
  | 'hi';

export function detectSpeechLanguage(text: string): SpeechLanguage | null {
  const normalized = text.toLowerCase();
  const indicators: Record<SpeechLanguage, RegExp> = {
    pt: /\b(uma|um|que|não|nao|para|com|você|voce|olá|ola|como|está|esta)\b/gu,
    en: /\b(the|a|an|is|are|and|for|with|you|hello|how|what)\b/gu,
    fr: /\b(une|un|le|la|les|est|et|pour|avec|vous|bonjour|comment)\b/gu,
    es: /\b(una|un|el|la|los|es|y|para|con|usted|hola|cómo|como)\b/gu,
    de: /\b(der|die|das|ist|und|für|mit|sie|hallo|wie|was)\b/gu,
    it: /\b(una|uno|il|lo|la|è|e|per|con|ciao|come|cosa)\b/gu,
    ja: /[ぁ-ゖァ-ヺ]/gu,
    zh: /[一-龯]/gu,
    hi: /[ऀ-ॿ]/gu,
  };
  const scores = Object.fromEntries(
    (Object.keys(indicators) as SpeechLanguage[]).map((language) => [
      language,
      normalized.match(indicators[language])?.length || 0,
    ]),
  ) as Record<SpeechLanguage, number>;

  const accentedLanguage = /[ãõç]/u.test(normalized)
    ? 'pt'
    : /[àâçéèêëîïôùûüÿœ]/u.test(normalized)
      ? 'fr'
      : /[áíóúñ¿¡]/u.test(normalized)
        ? 'es'
        : null;
  if (accentedLanguage) scores[accentedLanguage] += 2;

  const bestMatch = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return bestMatch && bestMatch[1] > 0
    ? (bestMatch[0] as SpeechLanguage)
    : null;
}

export const hasThinkTags = (text?: string): boolean => {
  if (!text) return false;
  return (
    text.includes('<think>') ||
    text.includes('</think>') ||
    text.includes('<thought>') ||
    text.includes('</thought>') ||
    text.includes('[THINK]') ||
    text.includes('[/THINK]') ||
    text.includes('<reasoning>') ||
    text.includes('</reasoning>') ||
    text.includes('<reason>') ||
    text.includes('</reason>') ||
    text.includes('<|thought|>') ||
    text.includes('<|end_of_thought|>') ||
    text.includes('<|thought_end|>')
  );
};

export const parseThinkContent = (
  content: string,
): {
  reasoning: string;
  answer: string;
  isReasoning: boolean;
} => {
  if (!content) {
    return {
      reasoning: '',
      answer: '',
      isReasoning: false,
    };
  }

  const closeTags = [
    '</think>',
    '</thought>',
    '[/THINK]',
    '</reasoning>',
    '</reason>',
    '<|end_of_thought|>',
    '<|thought_end|>',
  ];

  const openTags = [
    '<think>',
    '<thought>',
    '[THINK]',
    '<reasoning>',
    '<reason>',
    '<|thought|>',
    '<|begin_of_thought|>',
  ];

  // Check if any closing tag is present
  let foundCloseTag = '';
  let closeIndex = -1;

  for (const tag of closeTags) {
    const idx = content.indexOf(tag);
    if (idx !== -1 && (closeIndex === -1 || idx < closeIndex)) {
      closeIndex = idx;
      foundCloseTag = tag;
    }
  }

  // Check if any opening tag is present
  let foundOpenTag = '';
  let openIndex = -1;

  for (const tag of openTags) {
    const idx = content.indexOf(tag);
    if (idx !== -1 && (openIndex === -1 || idx < openIndex)) {
      openIndex = idx;
      foundOpenTag = tag;
    }
  }

  // Case 1: Has closing tag (even without opening tag, e.g. prompt template prefilled <think>)
  if (closeIndex !== -1) {
    let reasoning = '';
    let answer = '';

    if (openIndex !== -1 && openIndex < closeIndex) {
      // Both open and close tags present: <think>thought</think>answer
      const prefix = content.slice(0, openIndex).trim();
      reasoning = content
        .slice(openIndex + foundOpenTag.length, closeIndex)
        .trim();
      const suffix = content.slice(closeIndex + foundCloseTag.length).trim();
      answer = prefix ? `${prefix}\n\n${suffix}`.trim() : suffix;
    } else {
      // ONLY closing tag present: thought</think>answer
      reasoning = content.slice(0, closeIndex).trim();
      answer = content.slice(closeIndex + foundCloseTag.length).trim();
    }

    // Recursively check if there are further think blocks in answer
    if (
      closeTags.some((t) => answer.includes(t)) ||
      openTags.some((t) => answer.includes(t))
    ) {
      const rest = parseThinkContent(answer);
      reasoning = `${reasoning}\n\n${rest.reasoning}`.trim();
      answer = rest.answer;
    }

    return {
      reasoning,
      answer,
      isReasoning: false,
    };
  }

  // Case 2: Has opening tag but NO closing tag yet (currently streaming thoughts)
  if (openIndex !== -1) {
    const prefix = content.slice(0, openIndex).trim();
    const reasoning = content.slice(openIndex + foundOpenTag.length).trim();

    return {
      reasoning,
      answer: prefix,
      isReasoning: true,
    };
  }

  // Case 3: No tags at all
  return {
    reasoning: '',
    answer: content,
    isReasoning: false,
  };
};

// ============================================================
// Code Block & Syntax Highlighting Preprocessing
// ============================================================

export const detectCodeLanguage = (codeLines: string[]): string => {
  const text = codeLines.join('\n');
  if (
    /#include\s+[<"]|std::|cout\s*<<|cin\s*>>|nullptr|\bint\s+main\s*\(/.test(
      text,
    )
  ) {
    return 'cpp';
  }
  if (
    /\bdef\s+\w+\s*\(|\bimport\s+[\w.]+|\bfrom\s+\w+\s+import|if\s+__name__\s*==\s*['"]__main__['"]|elif\s+|print\(/.test(
      text,
    )
  ) {
    return 'python';
  }
  if (
    /\bimport\s+.*\s+from\s+['"]|\bexport\s+(default\s+)?(function|const|class)|\bconsole\.(log|error|warn)\s*\(|\bconst\s+\w+\s*=\s*require\(|=>\s*\{/.test(
      text,
    )
  ) {
    return 'javascript';
  }
  if (
    /\bpublic\s+class\s+|\bpublic\s+static\s+void\s+main|\bSystem\.out\.println/.test(
      text,
    )
  ) {
    return 'java';
  }
  if (/\busing\s+System|\bnamespace\s+\w+|\bConsole\.WriteLine/.test(text)) {
    return 'csharp';
  }
  if (/\bfn\s+main\s*\(|\blet\s+mut\s+|\bimpl\s+\w+|println!\s*\(/.test(text)) {
    return 'rust';
  }
  if (/\bpackage\s+main|\bfunc\s+main\s*\(|\bfmt\.Println/.test(text)) {
    return 'go';
  }
  if (/^<!DOCTYPE\s+html>|<html|<head>|<body>|<div\s+/i.test(text)) {
    return 'html';
  }
  if (
    /\bSELECT\s+.+\s+FROM\s+|\bINSERT\s+INTO\s+|\bCREATE\s+TABLE\s+/i.test(text)
  ) {
    return 'sql';
  }
  return '';
};

export const preprocessCodeBlocks = (content: string): string => {
  if (!content) {
    return '';
  }

  let text = content;

  // Auto-close trailing unclosed code fences (e.g. while streaming)
  const backtickMatches = text.match(/```/g);
  if (backtickMatches && backtickMatches.length % 2 !== 0) {
    text += '\n```';
  }

  const parts = text.split(/(```[\s\S]*?```)/g);

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      continue;
    }

    const lines = parts[i].split('\n');
    const newLines: string[] = [];
    let inCode = false;
    let codeLines: string[] = [];

    const isCodeStart = (lineIdx: number): boolean => {
      const line = lines[lineIdx];
      const trimmed = line.trim();
      if (!trimmed) return false;

      if (
        /^(#include\s*[<"]|using\s+namespace\s+\w+|import\s+[\w.*]+\s+from|from\s+\w+\s+import|def\s+\w+\s*\(|class\s+\w+[:\s{]|public\s+class\s+|fn\s+main\s*\(|package\s+\w+|func\s+\w+\s*\(|using\s+System;|const\s+\w+\s*=\s*require\(|function\s+\w+\s*\()/.test(
          trimmed,
        ) ||
        /^(int|void|float|double|char|bool|string|auto)\s+\w+\s*\([^)]*\)\s*\{?$/.test(
          trimmed,
        )
      ) {
        return true;
      }

      if (/^(\/\/|\/\*)/.test(trimmed)) {
        for (
          let k = lineIdx + 1;
          k < Math.min(lineIdx + 4, lines.length);
          k++
        ) {
          const nextTrimmed = lines[k].trim();
          if (
            nextTrimmed &&
            (/^(#include|using|import|from|def|class|public|fn|package|func|int|void|const|let|var|function)\b/.test(
              nextTrimmed,
            ) ||
              nextTrimmed.endsWith('{') ||
              nextTrimmed.endsWith(';'))
          ) {
            return true;
          }
        }
      }

      return false;
    };

    const isProseBoundary = (trimmed: string): boolean => {
      if (
        /^(#+\s*|[-*]\s+|\d+\.\s+)?(Explanation|Output|Note|Notes|Usage|How it works|Key points|Result|Summary):?/i.test(
          trimmed,
        )
      ) {
        return true;
      }
      if (/^[A-Z][a-zA-Z\s]{20,}\.$/.test(trimmed) && !/[;{}]/.test(trimmed)) {
        return true;
      }
      return false;
    };

    const isCodeContinuation = (line: string): boolean => {
      const trimmed = line.trim();
      if (!trimmed) return true;

      if (isProseBoundary(trimmed)) return false;

      if (
        /^(return|if|else|for|while|switch|case|break|continue|try|catch|throw|cout|cin|std::|printf|console\.|System\.out|print\()/.test(
          trimmed,
        ) ||
        /^[{}();]+$/.test(trimmed) ||
        trimmed.endsWith(';') ||
        trimmed.endsWith('{') ||
        trimmed.endsWith('}') ||
        /^\/\//.test(trimmed) ||
        /^\/\*|\*\/|^\*/.test(trimmed) ||
        /^\s{2,}|\t/.test(line)
      ) {
        return true;
      }

      if (
        /^(int|float|double|char|bool|string|auto|const|let|var)\s+\w+/.test(
          trimmed,
        )
      ) {
        return true;
      }

      return false;
    };

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];

      if (!inCode) {
        if (isCodeStart(j)) {
          inCode = true;
          codeLines = [line];
        } else {
          const escapedLine = line.replace(
            /(^|[\s(])(#include\s*<[^>]+>)([\s),.;]|$)/g,
            '$1`$2`$3',
          );
          newLines.push(escapedLine);
        }
      } else {
        if (isCodeContinuation(line)) {
          codeLines.push(line);
        } else {
          while (
            codeLines.length > 0 &&
            !codeLines[codeLines.length - 1].trim()
          ) {
            codeLines.pop();
          }
          const lang = detectCodeLanguage(codeLines) || '';
          newLines.push(`\`\`\`${lang}`);
          newLines.push(...codeLines);
          newLines.push('```');
          const escapedLine = line.replace(
            /(^|[\s(])(#include\s*<[^>]+>)([\s),.;]|$)/g,
            '$1`$2`$3',
          );
          newLines.push(escapedLine);
          inCode = false;
          codeLines = [];
        }
      }
    }

    if (inCode && codeLines.length > 0) {
      while (codeLines.length > 0 && !codeLines[codeLines.length - 1].trim()) {
        codeLines.pop();
      }
      const lang = detectCodeLanguage(codeLines) || '';
      newLines.push(`\`\`\`${lang}`);
      newLines.push(...codeLines);
      newLines.push('```');
    }

    parts[i] = newLines.join('\n');
  }

  return parts.join('');
};

// ============================================================
// WhatsApp Styles & Emoji Preprocessing
// ============================================================
