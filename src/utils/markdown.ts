import { Conversation } from '../types/chat';
import {
  hasThinkTags,
  parseThinkContent,
  preprocessCodeBlocks,
} from './format';

export const EMOJI_MAP: Record<string, string> = {
  ':)': '😊',
  ':-)': '😊',
  ':(': '😞',
  ':-(': '😞',
  ':D': '😃',
  ':-D': '😃',
  ';)': '😉',
  ';-)': '😉',
  ':P': '😛',
  ':-P': '😛',
  ':p': '😛',
  ':-p': '😛',
  '<3': '❤️',
  '</3': '💔',
  ':+1:': '👍',
  ':-1:': '👎',
  ':smile:': '😊',
  ':grinning:': '😀',
  ':joy:': '😂',
  ':rofl:': '🤣',
  ':heart:': '❤️',
  ':fire:': '🔥',
  ':rocket:': '🚀',
  ':check:': '✅',
  ':white_check_mark:': '✅',
  ':x:': '❌',
  ':cross_mark:': '❌',
  ':warning:': '⚠️',
  ':bulb:': '💡',
  ':star:': '⭐',
  ':tada:': '🎉',
  ':party:': '🎉',
  ':sparkles:': '✨',
  ':100:': '💯',
  ':eyes:': '👀',
  ':memo:': '📝',
  ':lock:': '🔒',
  ':thinking:': '🤔',
  ':sunglasses:': '😎',
  ':cool:': '😎',
  ':clap:': '👏',
  ':pray:': '🙏',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':ok_hand:': '👌',
  ':wave:': '👋',
  ':muscle:': '💪',
  ':zap:': '⚡',
  ':coffee:': '☕',
  ':pin:': '📌',
  ':hourglass:': '⏳',
};

export const preprocessWhatsApp = (content: string): string => {
  if (!content) return '';

  const text = content;

  // Protect code blocks
  const codeParts = text.split(/(```[\s\S]*?```)/g);

  for (let c = 0; c < codeParts.length; c++) {
    if (c % 2 === 1) continue; // Skip code blocks

    let chunk = codeParts[c];

    // Escape currency symbols so remarkMath doesn't mistake prices for LaTeX equations
    // e.g. R$ 100,00 -> R\$ 100,00, $50 -> \$50
    chunk = chunk.replace(/R\$/g, 'R\\$');
    chunk = chunk.replace(/(?<!\\)\$(\s*\d+)/g, (_match, p1) => '\\$' + p1);

    // Split by LaTeX math
    const mathRegex =
      /(\$\$[\s\S]*?\$\$|(?<![a-zA-Z\\])\$(?!\s|\d)(?:[^\$\n]|\\\$)+?(?<!\s)\$(?!\d))/g;
    const parts = chunk.split(mathRegex);

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) continue;

      let subChunk = parts[i];

      // 1. WhatsApp Strikethrough: ~text~ -> ~~text~~
      subChunk = subChunk.replace(
        /(?<![~])~([^~\s\n](?:[^~\n]*?[^~\s\n])?)~(?![~])/g,
        '~~$1~~',
      );

      // 2. Underline ("sublined"): __text__ -> <u>text</u>
      subChunk = subChunk.replace(
        /(?<!_)__([^\s_\n](?:[^_\n]*?[^\s_\n])?)__(?!_)/g,
        '<u>$1</u>',
      );

      // 3. WhatsApp Bold: *text* -> **text**
      subChunk = subChunk.replace(
        /(?<!\*)\*([^\s*\n](?:[^*\n]*?[^\s*\n])?)\*(?!\*)/g,
        (_match, inner) => {
          return `**${inner}**`;
        },
      );

      // 4. Emojis and shortcodes
      for (const [code, emoji] of Object.entries(EMOJI_MAP)) {
        if (code.startsWith(':') && code.endsWith(':')) {
          subChunk = subChunk.split(code).join(emoji);
        } else {
          const escaped = code.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(
            `(?<=^|[\\s(])${escaped}(?=[\\s),.!?]|$)`,
            'g',
          );
          subChunk = subChunk.replace(regex, emoji);
        }
      }

      parts[i] = subChunk;
    }

    codeParts[c] = parts.join('');
  }

  return codeParts.join('');
};

// ============================================================
// Markdown Export Utilities
// ============================================================

export function exportChatToMarkdown(conversation: Conversation): string {
  const title = conversation.title?.trim() || 'Untitled Conversation';
  const sections: string[] = [`# ${title}`];

  for (const message of conversation.messages || []) {
    const roleHeading = message.role === 'user' ? '## User' : '## AI';
    let rawContent = (message.content || '').trim();
    if (message.role === 'assistant' && hasThinkTags(rawContent)) {
      const parsed = parseThinkContent(rawContent);
      rawContent = parsed.answer.trim();
    }
    const content =
      message.role === 'assistant'
        ? preprocessWhatsApp(preprocessCodeBlocks(rawContent))
        : rawContent;
    if (content) {
      sections.push(`${roleHeading}\n${content}`);
    } else {
      sections.push(roleHeading);
    }
  }

  return sections.join('\n\n') + '\n';
}

export function sanitizeFilename(name: string): string {
  const sanitized = name
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return sanitized || 'conversation';
}

export function downloadConversationAsMarkdown(
  conversation: Conversation,
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const markdown = exportChatToMarkdown(conversation);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const baseName = sanitizeFilename(conversation.title || 'conversation');
  const filename = `${baseName}.md`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
