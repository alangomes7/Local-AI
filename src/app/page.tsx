'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  Loader2,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  Server,
  Square,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';

import TerminalPanel, { LogEntry, LogType } from './components/TerminalPanel';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  isReasoning?: boolean;
  isThinking?: boolean;
  isThinkingExpanded?: boolean;
  thinkingTime?: number;
  tokensPerSecond?: string;
  ttft?: string;
  totalDuration?: string;
  thinkingDuration?: string;
  responseDuration?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  status: 'active' | 'trash';
};

export type LoadedModel = {
  id: string;
  loaded: boolean;
  processor_loaded?: boolean;
  memory_bytes?: number;
  memory_mb?: number;
  memory_human?: string;
  memory?: string;
  timeout?: number;
};

export type DeviceMemoryDetails = {
  device_name?: string;
  device_index?: number;
  total_bytes?: number;
  used_bytes?: number;
  available_bytes?: number;
  allocated_bytes?: number;
  reserved_bytes?: number;
  free_bytes?: number;
  percentage?: number;
  total_human?: string;
  used_human?: string;
  available_human?: string;
  allocated_human?: string;
};

export type SystemMemoryStatus = {
  primary_device?: 'gpu' | 'ram';
  total_bytes?: number;
  used_bytes?: number;
  available_bytes?: number;
  percentage?: number;
  total_human?: string;
  used_human?: string;
  available_human?: string;
  system_ram?: DeviceMemoryDetails | null;
  gpu?: DeviceMemoryDetails | null;
  models_memory_bytes?: number;
  models_memory_human?: string;
};

export type LoadedModelsResponse = {
  data?: LoadedModel[];
  count?: number;
  total_memory_bytes?: number;
  total_memory_human?: string;
  memory_status?: SystemMemoryStatus;
};

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

type ModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

type ChatDelta = {
  content?: string;
  reasoning_content?: string;
  reasoning?: string;
  thinking?: string;
};

type SSEPayload = {
  choices?: Array<{
    delta?: ChatDelta;
    text?: string;
  }>;
};

// ============================================================
// Markdown Export Utilities
// ============================================================

export function exportChatToMarkdown(conversation: Conversation): string {
  const title = conversation.title?.trim() || 'Untitled Conversation';
  const sections: string[] = [`# ${title}`];

  for (const message of conversation.messages || []) {
    const roleHeading = message.role === 'user' ? '## User' : '## AI';
    const content = (message.content || '').trim();
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

export default function ChatPage() {
  // ============================================================
  // State
  // ============================================================

  const [serverUrl, setServerUrl] = useState(
    'http://localhost:8000/v1/chat/completions',
  );

  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [activeChatModel, setActiveChatModel] = useState('');

  const [loadingModels, setLoadingModels] = useState(false);
  const [modelStatus, setModelStatus] = useState<
    'unloaded' | 'loading' | 'loaded'
  >('unloaded');

  const [ramStats, setRamStats] = useState({
    used: '0',
    total: '0',
    available: '0',
    percentage: '0',
    availablePercentage: '100',
  });

  const [systemMemory, setSystemMemory] = useState<SystemMemoryStatus | null>(
    null,
  );

  const [loadedModels, setLoadedModels] = useState<LoadedModel[]>([]);
  const [showLoadedPanel, setShowLoadedPanel] = useState(false);

  const totalLoadedBytes = useMemo(() => {
    return loadedModels.reduce(
      (acc, m) =>
        acc +
        (m.memory_bytes ||
          (m.memory_mb ? Math.round(m.memory_mb * 1024 * 1024) : 0)),
      0,
    );
  }, [loadedModels]);

  const totalLoadedMemory = useMemo(() => {
    if (totalLoadedBytes > 0) {
      const gb = totalLoadedBytes / (1024 * 1024 * 1024);
      if (gb >= 1.0) {
        return `${gb.toFixed(2)} GB`;
      }
      return `${(totalLoadedBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return null;
  }, [totalLoadedBytes]);

  const memoryOverview = useMemo(() => {
    const activeMem =
      systemMemory?.primary_device === 'gpu' && systemMemory.gpu
        ? systemMemory.gpu
        : (systemMemory?.system_ram ?? null);

    let totalBytes = activeMem?.total_bytes ?? 0;
    let usedBytes = activeMem?.used_bytes ?? 0;
    let availableBytes = activeMem?.available_bytes ?? 0;

    if (totalBytes === 0) {
      const totalParsed = Number(ramStats.total) || 0;
      const usedParsed = Number(ramStats.used) || 0;
      const availParsed = Number(ramStats.available) || 0;
      totalBytes = Math.round(totalParsed * 1024 ** 3);
      usedBytes = Math.round(usedParsed * 1024 ** 3);
      availableBytes = Math.round(availParsed * 1024 ** 3);
    }

    const totalGb =
      totalBytes > 0
        ? (totalBytes / 1024 ** 3).toFixed(2)
        : ramStats.total || '0';
    const usedGb =
      usedBytes > 0 ? (usedBytes / 1024 ** 3).toFixed(2) : ramStats.used || '0';
    const availableGb =
      availableBytes > 0
        ? (availableBytes / 1024 ** 3).toFixed(2)
        : ramStats.available || '0';

    const modelsBytes = totalLoadedBytes;
    const modelsGb = (modelsBytes / 1024 ** 3).toFixed(2);
    const otherUsedBytes = Math.max(usedBytes - modelsBytes, 0);
    const otherUsedGb = (otherUsedBytes / 1024 ** 3).toFixed(2);

    const usedPercent =
      totalBytes > 0
        ? Math.min(Math.max((usedBytes / totalBytes) * 100, 0), 100)
        : Number(ramStats.percentage) || 0;
    const modelPercent =
      totalBytes > 0
        ? Math.min(Math.max((modelsBytes / totalBytes) * 100, 0), 100)
        : 0;
    const otherUsedPercent =
      totalBytes > 0
        ? Math.min(Math.max((otherUsedBytes / totalBytes) * 100, 0), 100)
        : 0;
    const availablePercent =
      totalBytes > 0
        ? Math.min(Math.max((availableBytes / totalBytes) * 100, 0), 100)
        : Math.max(100 - usedPercent, 0);

    const deviceLabel =
      systemMemory?.primary_device === 'gpu' && systemMemory.gpu
        ? `GPU VRAM (${systemMemory.gpu.device_name || 'CUDA'})`
        : 'System Memory (RAM)';

    return {
      totalBytes,
      totalGb,
      usedGb,
      availableGb,
      modelsGb,
      otherUsedGb,
      usedPercent: usedPercent.toFixed(1),
      modelPercent: modelPercent.toFixed(1),
      otherUsedPercent: otherUsedPercent.toFixed(1),
      availablePercent: availablePercent.toFixed(1),
      deviceLabel,
      isGpu: systemMemory?.primary_device === 'gpu',
      gpu: systemMemory?.gpu,
      systemRam: systemMemory?.system_ram,
    };
  }, [systemMemory, ramStats, totalLoadedBytes]);

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [enableThinking, setEnableThinking] = useState(true);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarView, setSidebarView] = useState<'chats' | 'trash'>('chats');
  const [conversationToDelete, setConversationToDelete] =
    useState<Conversation | null>(null);
  const [conversationToPermanentlyDelete, setConversationToPermanentlyDelete] =
    useState<Conversation | null>(null);

  // ============================================================
  // Refs
  // ============================================================

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // ============================================================
  // Initialization: Load conversations from localStorage
  // ============================================================

  useEffect(() => {
    try {
      const stored = localStorage.getItem('conversations');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setConversations(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load conversations from localStorage:', error);
    }
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabled = useRef(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // ============================================================
  // Smart Auto-Scroll
  // ============================================================

  const scrollToBottom = useCallback((smooth = false) => {
    const container = scrollContainerRef.current;
    if (container) {
      if (smooth) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
      autoScrollEnabled.current = true;
      setShowScrollBottom(false);
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    const isNearBottom = distanceFromBottom <= 40;
    autoScrollEnabled.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      autoScrollEnabled.current = false;
      setShowScrollBottom(true);
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 40) {
      autoScrollEnabled.current = false;
      setShowScrollBottom(true);
    }
  }, []);

  useEffect(() => {
    if (!autoScrollEnabled.current) {
      return;
    }

    const container = scrollContainerRef.current;

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // ============================================================
  // Logging
  // ============================================================

  const addLog = useCallback((message: string, type: LogType = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
      },
    ]);
  }, []);

  // ============================================================
  // Textarea auto resize
  // ============================================================

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';

    const newHeight = Math.min(Math.max(textarea.scrollHeight, 50), 200);

    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [prompt, resizeTextarea]);

  // ============================================================
  // RAM monitoring
  // ============================================================

  const fetchRam = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/system/ram?serverUrl=${encodeURIComponent(serverUrl)}`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      const total = String(data.total ?? '0');
      const used = String(data.used ?? '0');
      const available = String(
        data.available ??
          (Number(total) - Number(used) > 0
            ? (Number(total) - Number(used)).toFixed(2)
            : '0'),
      );
      const percentage = String(data.percentage ?? '0');
      const availablePercentage = String(
        data.availablePercentage ??
          (100 - (Number(percentage) || 0)).toFixed(1),
      );

      setRamStats({
        used,
        total,
        available,
        percentage,
        availablePercentage,
      });

      if (data.system_ram || data.gpu) {
        setSystemMemory(data);
      }
    } catch {
      // Ignore RAM polling errors.
    }
  }, [serverUrl]);

  useEffect(() => {
    fetchRam();
  }, [fetchRam]);

  useEffect(() => {
    if (!showLoadedPanel) {
      return;
    }

    const interval = setInterval(fetchRam, 2500);

    return () => clearInterval(interval);
  }, [showLoadedPanel, fetchRam]);

  // ============================================================
  // Loaded models
  // ============================================================

  const fetchLoadedModels = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/models/loaded?serverUrl=${encodeURIComponent(serverUrl)}`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        return;
      }

      const data: LoadedModelsResponse = await response.json();

      const loaded = Array.isArray(data.data) ? data.data : [];

      setLoadedModels(loaded);

      if (data.memory_status) {
        setSystemMemory(data.memory_status);
        if (data.memory_status.system_ram) {
          const sr = data.memory_status.system_ram;
          setRamStats((prev) => ({
            ...prev,
            used: sr.used_bytes
              ? (sr.used_bytes / 1024 ** 3).toFixed(2)
              : prev.used,
            total: sr.total_bytes
              ? (sr.total_bytes / 1024 ** 3).toFixed(2)
              : prev.total,
            available: sr.available_bytes
              ? (sr.available_bytes / 1024 ** 3).toFixed(2)
              : prev.available,
            percentage: String(sr.percentage ?? prev.percentage),
            availablePercentage:
              sr.total_bytes && sr.available_bytes
                ? ((sr.available_bytes / sr.total_bytes) * 100).toFixed(1)
                : prev.availablePercentage,
          }));
        }
      }

      if (selectedModel) {
        const selectedBase = selectedModel.split('@')[0];

        const isSelectedLoaded = loaded.some(
          (model) => model.loaded && model.id.split('@')[0] === selectedBase,
        );

        setModelStatus(isSelectedLoaded ? 'loaded' : 'unloaded');
      }
    } catch {
      // Ignore polling errors.
    }
  }, [serverUrl, selectedModel]);

  useEffect(() => {
    fetchLoadedModels();
  }, [fetchLoadedModels]);

  useEffect(() => {
    if (!showLoadedPanel) {
      return;
    }

    const interval = setInterval(fetchLoadedModels, 3000);

    return () => clearInterval(interval);
  }, [showLoadedPanel, fetchLoadedModels]);

  // ============================================================
  // Determine active chat model
  // ============================================================

  useEffect(() => {
    const loaded = loadedModels.filter((model) => model.loaded);

    if (loaded.length === 0) {
      setActiveChatModel('');
      return;
    }

    // Never override a model the user picked manually,
    // as long as it is still loaded.
    const currentLoadedModel = loaded.find(
      (model) => model.id === activeChatModel,
    );

    if (currentLoadedModel) {
      return;
    }

    const selectedBase = selectedModel.split('@')[0];

    const selectedLoadedModel = loaded.find(
      (model) => model.id.split('@')[0] === selectedBase,
    );

    setActiveChatModel(
      selectedLoadedModel ? selectedLoadedModel.id : loaded[0].id,
    );
  }, [loadedModels, selectedModel, activeChatModel]);

  // ============================================================
  // Load available models
  // ============================================================

  const loadModels = useCallback(async () => {
    try {
      setLoadingModels(true);

      const response = await fetch('/api/models', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ModelsResponse = await response.json();

      const modelIds =
        data.data
          ?.map((model) => model.id)
          .filter((id): id is string => Boolean(id)) ?? [];

      setModels(modelIds);

      setSelectedModel((current) => {
        if (current && modelIds.includes(current)) {
          return current;
        }

        return modelIds[0] || '';
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      addLog(`Model Load Error: ${message}`, 'error');
      setModels([]);
      setSelectedModel('');
    } finally {
      setLoadingModels(false);
    }
  }, [addLog]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // ============================================================
  // Load model
  // ============================================================

  const handleLoadModel = async () => {
    if (!selectedModel || loading) {
      return;
    }

    setModelStatus('loading');

    addLog(`Loading ${selectedModel}...`, 'info');

    try {
      const response = await fetch('/api/models/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          serverUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      await fetchLoadedModels();

      setModelStatus('loaded');

      addLog(`${selectedModel} loaded.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      setModelStatus('unloaded');

      addLog(`Load Error: ${message}`, 'error');
    }
  };

  // ============================================================
  // Unload model
  // ============================================================

  const handleUnloadModel = async (modelId: string) => {
    if (!modelId) {
      return;
    }

    addLog(`Unloading ${modelId}...`, 'info');

    try {
      const response = await fetch('/api/models/unload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          serverUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(errorText || `HTTP ${response.status}`);
      }

      await fetchLoadedModels();

      if (
        modelId === selectedModel ||
        modelId.split('@')[0] === selectedModel.split('@')[0]
      ) {
        setModelStatus('unloaded');
      }

      if (modelId === activeChatModel) {
        setActiveChatModel('');
      }

      addLog(`${modelId} unloaded.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      addLog(`Unload Error: ${message}`, 'error');
    }
  };

  // ============================================================
  // Unload all models
  // ============================================================

  const handleUnloadAll = async () => {
    addLog('Unloading all models...', 'info');

    try {
      const response = await fetch('/api/models/unload-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(errorText || `HTTP ${response.status}`);
      }

      setLoadedModels([]);
      setActiveChatModel('');
      setModelStatus('unloaded');

      addLog('All models unloaded.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      addLog(`Unload All Error: ${message}`, 'error');
    }
  };

  // ============================================================
  // Thinking toggle
  // ============================================================

  const toggleThinking = (index: number) => {
    setMessages((prev) => {
      const updated = [...prev];

      if (!updated[index]) {
        return prev;
      }

      updated[index] = {
        ...updated[index],
        isThinkingExpanded: !updated[index].isThinkingExpanded,
      };

      return updated;
    });
  };

  // ============================================================
  // LaTeX preprocessing
  // ============================================================

  const preprocessLaTeX = (content: string) => {
    if (!content) {
      return '';
    }

    let text = content;

    // 1. Normalize LaTeX display math \[ ... \] to \n\n$$ ... $$\n\n
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr: string) => {
      return `\n\n$$\n${expr.trim()}\n$$\n\n`;
    });

    // 2. Normalize LaTeX inline math \( ... \) to $ ... $
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr: string) => {
      return `$${expr.trim()}$`;
    });

    // 3. Wrap unadorned LaTeX environments (\begin{aligned}...\end{aligned}, etc.) in $$
    const envRegex =
      /\\begin\{(aligned|align|align\*|equation|equation\*|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|gather|gather\*)\}([\s\S]*?)\\end\{\1\}/g;
    text = text.replace(envRegex, (match: string) => {
      return `\n\n$$\n${match.trim()}\n$$\n\n`;
    });

    // 4. Split code blocks so we NEVER touch anything inside ``` ... ```
    const parts = text.split(/(```[\s\S]*?```)/g);

    for (let i = 0; i < parts.length; i++) {
      // Odd indexes are fenced code blocks
      if (i % 2 === 1) {
        continue;
      }

      let chunk = parts[i];

      // Separate multiple chained equations on a single line (e.g. ") k2 = ")
      chunk = chunk.replace(
        /(\))\s+([a-zA-Z][a-zA-Z0-9_{}+\-]*\s*=[^=])/g,
        '$1\n$2',
      );

      // Split lines to detect standalone equation lines and inline math
      const lines = chunk.split('\n');
      let inDisplayMath = false;

      const processedLines = lines.map((line) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('$$')) {
          inDisplayMath = !inDisplayMath;
          return line;
        }
        if (inDisplayMath || !trimmed) {
          return line;
        }

        // Detect if line is a standalone formula equation like:
        // k1 = f(x_n, y_n) or y_{n+1} = y_n + (h/6)(k1 + 3k2 + 3k3 + k4)
        const isFormulaLine =
          /^[a-zA-Z][a-zA-Z0-9_{}+\-]*\s*=\s*[^=]+$/.test(trimmed) &&
          /[_{^+\-*/()\\0-9]/.test(trimmed) &&
          !trimmed.startsWith('http') &&
          !trimmed.includes('**') &&
          !trimmed.includes('##') &&
          !trimmed.includes('$');

        if (isFormulaLine) {
          // Convert k1 -> k_1, hk2 -> hk_2, 3k2 -> 3k_2 while preserving existing subscripts
          const mathContent = trimmed.replace(
            /(?<!_|\w_[^{}\s]+)([a-zA-Z])(\d+)(?!})/g,
            '$1_$2',
          );
          return `$$${mathContent}$$`;
        }

        // Convert standalone subscripts/superscripts in text that aren't wrapped in $
        // e.g. y_{n+1}, (x_n, y_n), k_1
        const lineWithMath = line.replace(
          /(^|[\s(,;])([a-zA-Z])_([a-zA-Z0-9]+|\{[^{}]+\})([\s),;.!?]|$)/g,
          (_match, p1: string, p2: string, p3: string, p4: string) => {
            return `${p1}$${p2}_${p3}$${p4}`;
          },
        );

        return lineWithMath;
      });

      parts[i] = processedLines.join('\n');
    }

    return parts.join('');
  };

  // ============================================================
  // Clean leaked model chat-template tokens
  // ============================================================

  const cleanModelResponse = (content: string): string => {
    if (!content) {
      return '';
    }

    let cleaned = content;

    const assistantMarkers = [
      '<｜Assistant｜>',
      '<|assistant|>',
      '### Assistant:',
    ];

    let assistantMarkerFound = false;

    for (const marker of assistantMarkers) {
      const index = cleaned.lastIndexOf(marker);

      if (index !== -1) {
        cleaned = cleaned.slice(index + marker.length);
        assistantMarkerFound = true;
        break;
      }
    }

    const templateStartMarkers = [
      '<｜begin▁of▁sentence｜>',
      '<|begin_of_text|>',
      '<|begin▁of▁sentence|>',
      '<|system|>',
      '<|user|>',
    ];

    const containsTemplateStart = templateStartMarkers.some((marker) =>
      content.includes(marker),
    );

    if (containsTemplateStart && !assistantMarkerFound) {
      return '';
    }

    cleaned = cleaned
      .replaceAll('<｜begin▁of▁sentence｜>', '')
      .replaceAll('<｜end▁of▁sentence｜>', '')
      .replaceAll('<|begin_of_text|>', '')
      .replaceAll('<|endoftext|>', '')
      .replaceAll('<|end|>', '')
      .replaceAll('<|eot_id|>', '')
      .replaceAll('<|eot|>', '')
      .trim();

    return cleaned;
  };

  // ============================================================
  // Parse <think> blocks
  // ============================================================

  const parseThinkContent = (
    content: string,
  ): {
    reasoning: string;
    answer: string;
    isReasoning: boolean;
  } => {
    if (!content.includes('<think>')) {
      return {
        reasoning: '',
        answer: content,
        isReasoning: false,
      };
    }

    const start = content.indexOf('<think>');
    const end = content.indexOf('</think>');

    if (end === -1) {
      return {
        reasoning: content.slice(start + 7).trim(),
        answer: '',
        isReasoning: true,
      };
    }

    return {
      reasoning: content.slice(start + 7, end).trim(),
      answer: content.slice(end + 8).trim(),
      isReasoning: false,
    };
  };

  // ============================================================
  // Cancel generation
  // ============================================================

  const handleCancel = () => {
    abortControllerRef.current?.abort();

    addLog('Cancelled.', 'warning');

    setLoading(false);
  };

  // ============================================================
  // Chat History / Conversation Management
  // ============================================================

  const handleNewChat = () => {
    setMessages([]);
    setActiveChatId(null);
    activeChatIdRef.current = null;
    setShowMobileSidebar(false);
    autoScrollEnabled.current = true;
    setShowScrollBottom(false);
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveChatId(conv.id);
    activeChatIdRef.current = conv.id;
    setMessages(conv.messages);
    setShowMobileSidebar(false);
    autoScrollEnabled.current = true;
    setShowScrollBottom(false);
    requestAnimationFrame(() => {
      scrollToBottom(false);
    });
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const activeConversations = conversations
    .filter((conv) => {
      if (conv.status !== 'active') {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const matchesTitle = (conv.title || '')
        .toLowerCase()
        .includes(normalizedQuery);

      if (matchesTitle) {
        return true;
      }

      return conv.messages.some((msg) =>
        (msg.content || '').toLowerCase().includes(normalizedQuery),
      );
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const confirmMoveToTrash = () => {
    if (!conversationToDelete) {
      return;
    }

    const targetId = conversationToDelete.id;
    const updatedConversations: Conversation[] = conversations.map((conv) => {
      if (conv.id === targetId) {
        return {
          ...conv,
          status: 'trash',
          updatedAt: Date.now(),
        };
      }
      return conv;
    });

    setConversations(updatedConversations);
    try {
      localStorage.setItem(
        'conversations',
        JSON.stringify(updatedConversations),
      );
    } catch (error) {
      console.error(
        'Failed to move conversation to trash in localStorage:',
        error,
      );
    }

    if (activeChatId === targetId) {
      setActiveChatId(null);
      activeChatIdRef.current = null;
      setMessages([]);
    }

    setConversationToDelete(null);
  };

  const handleRestore = (id: string) => {
    const updatedConversations: Conversation[] = conversations.map((conv) => {
      if (conv.id === id) {
        return {
          ...conv,
          status: 'active',
          updatedAt: Date.now(),
        };
      }
      return conv;
    });

    setConversations(updatedConversations);
    try {
      localStorage.setItem(
        'conversations',
        JSON.stringify(updatedConversations),
      );
    } catch (error) {
      console.error('Failed to restore conversation in localStorage:', error);
    }
  };

  const confirmPermanentDelete = () => {
    if (!conversationToPermanentlyDelete) {
      return;
    }

    const targetId = conversationToPermanentlyDelete.id;
    const updatedConversations: Conversation[] = conversations.filter(
      (conv) => conv.id !== targetId,
    );

    setConversations(updatedConversations);
    try {
      localStorage.setItem(
        'conversations',
        JSON.stringify(updatedConversations),
      );
    } catch (error) {
      console.error(
        'Failed to delete conversation permanently from localStorage:',
        error,
      );
    }

    if (activeChatId === targetId) {
      setActiveChatId(null);
      activeChatIdRef.current = null;
      setMessages([]);
    }

    setConversationToPermanentlyDelete(null);
  };

  const trashConversations = conversations
    .filter((conv) => conv.status === 'trash')
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // ============================================================
  // Send message
  // ============================================================

  const handleSend = async () => {
    if (loading) {
      return;
    }

    const userMessage = prompt.trim();
    const file = selectedFile;

    if (!userMessage && !file) {
      return;
    }

    // ----------------------------------------------------------
    // No active model
    // ----------------------------------------------------------

    if (!activeChatModel) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: userMessage + (file ? `\n\n[Attached: ${file.name}]` : ''),
        },
        {
          role: 'assistant',
          content:
            '**No model selected.** Please load and select a model first.',
          isThinking: false,
        },
      ]);

      return;
    }

    // ----------------------------------------------------------
    // Request state
    // ----------------------------------------------------------

    const controller = new AbortController();

    abortControllerRef.current = controller;

    const requestStartTime = Date.now();

    let firstTokenTime = 0;
    let reasoningEndTime = 0;
    let timerInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // --------------------------------------------------------
      // Add user message + temporary assistant message
      // --------------------------------------------------------

      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: userMessage + (file ? `\n\n[Attached: ${file.name}]` : ''),
        },
        {
          role: 'assistant',
          content: '',
          isThinking: true,
          isThinkingExpanded: true,
          thinkingTime: 0,
        },
      ]);

      setLoading(true);
      setPrompt('');
      autoScrollEnabled.current = true;
      setShowScrollBottom(false);

      requestAnimationFrame(() => {
        resizeTextarea();
        scrollToBottom(false);
      });

      // --------------------------------------------------------
      // Thinking timer
      // --------------------------------------------------------

      let currentThinkingTime = 0;

      timerInterval = setInterval(() => {
        currentThinkingTime += 1;

        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;

          if (lastIndex >= 0 && updated[lastIndex]?.role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              thinkingTime: currentThinkingTime,
            };
          }

          return updated;
        });
      }, 1000);

      // --------------------------------------------------------
      // Build request
      // --------------------------------------------------------

      const formData = new FormData();

      formData.append('prompt', userMessage);
      formData.append('serverUrl', serverUrl);
      formData.append('model', activeChatModel);
      formData.append('enableThinking', String(enableThinking));

      if (file) {
        formData.append('file', file);
      }

      // IMPORTANT:
      // Do not send the temporary assistant message.
      const chatHistory = messages
        .filter(
          (message) =>
            !message.isThinking &&
            message.content.trim().length > 0 &&
            !message.content.startsWith('Error: ') &&
            !message.content.startsWith('**No model selected.**'),
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      formData.append('history', JSON.stringify(chatHistory));

      // --------------------------------------------------------
      // Request
      // --------------------------------------------------------

      const response = await fetch('/api/ai', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      // --------------------------------------------------------
      // HTTP error
      // --------------------------------------------------------

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;

        try {
          const text = await response.text();

          if (text) {
            try {
              const parsed = JSON.parse(text);

              errorMessage =
                parsed.error || parsed.details || text || errorMessage;
            } catch {
              errorMessage = text;
            }
          }
        } catch {
          // Keep default HTTP error.
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('The server returned an empty response body.');
      }

      // --------------------------------------------------------
      // Streaming state
      // --------------------------------------------------------

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';

      let rawAssistantContent = '';
      let rawReasoningContent = '';

      let firstChunkReceived = false;
      let tokenCount = 0;
      let generationStartTime = 0;
      let isCurrentlyReasoning = false;

      // --------------------------------------------------------
      // Update assistant message
      // --------------------------------------------------------

      const updateAssistantMessage = (
        content: string,
        extra: Partial<Message> = {},
      ) => {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;

          if (lastIndex >= 0 && updated[lastIndex]?.role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content,
              ...extra,
            };
          }

          return updated;
        });
      };

      // --------------------------------------------------------
      // Process one SSE line
      // --------------------------------------------------------

      const processSSELine = (rawLine: string) => {
        const line = rawLine.trim();

        if (!line || !line.startsWith('data:')) {
          return;
        }

        const data = line.slice(5).trim();

        if (!data || data === '[DONE]') {
          return;
        }

        let parsed: SSEPayload;

        try {
          parsed = JSON.parse(data) as SSEPayload;
        } catch {
          return;
        }

        const choice = parsed.choices?.[0];

        if (!choice) {
          return;
        }

        const delta = choice.delta ?? {};

        const deltaContent = delta.content ?? choice.text ?? '';

        const deltaReasoning =
          delta.reasoning_content ?? delta.thinking ?? delta.reasoning ?? '';

        // ------------------------------------------------------
        // Reasoning
        // ------------------------------------------------------

        if (deltaReasoning) {
          rawReasoningContent += deltaReasoning;
          isCurrentlyReasoning = true;
        } else if (deltaContent && rawReasoningContent) {
          // If we start receiving normal content after native reasoning, reasoning is done.
          isCurrentlyReasoning = false;
        }

        // ------------------------------------------------------
        // Answer
        // ------------------------------------------------------

        if (deltaContent) {
          rawAssistantContent += deltaContent;
        }

        // ------------------------------------------------------
        // First token/chunk
        // ------------------------------------------------------

        if (!firstChunkReceived) {
          firstChunkReceived = true;
          firstTokenTime = Date.now();
        }

        // Count answer chunks only, so tokens/s is not diluted
        // by the reasoning phase.
        if (deltaContent) {
          if (generationStartTime === 0) {
            generationStartTime = Date.now();
          }

          tokenCount += 1;
        }

        // ------------------------------------------------------
        // Clean response
        // ------------------------------------------------------

        let displayContent = cleanModelResponse(rawAssistantContent);
        let displayReasoning = rawReasoningContent;

        // ------------------------------------------------------
        // Fallback <think> parsing
        // ------------------------------------------------------

        if (!rawReasoningContent && displayContent.includes('<think>')) {
          const parsedThink = parseThinkContent(displayContent);
          displayReasoning = parsedThink.reasoning;
          displayContent = parsedThink.answer;
          isCurrentlyReasoning = parsedThink.isReasoning;
        } else if (!rawReasoningContent) {
          // No native reasoning and no <think> tag
          isCurrentlyReasoning = false;
        }

        // ------------------------------------------------------
        // Stop thinking timer when reasoning ends
        // ------------------------------------------------------

        if (firstChunkReceived && !isCurrentlyReasoning && timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }

        // Record exact end time only if we actually had reasoning
        if (
          !isCurrentlyReasoning &&
          reasoningEndTime === 0 &&
          displayReasoning.trim()
        ) {
          reasoningEndTime = Date.now();
        }

        // ------------------------------------------------------
        // Metrics
        // ------------------------------------------------------

        const now = Date.now();

        const generationDuration =
          generationStartTime > 0 ? (now - generationStartTime) / 1000 : 0;

        const tokensPerSecond =
          generationDuration > 0
            ? (tokenCount / generationDuration).toFixed(2)
            : '0.00';

        const ttft =
          firstTokenTime > 0
            ? ((firstTokenTime - requestStartTime) / 1000).toFixed(2)
            : undefined;

        const totalDuration = ((now - requestStartTime) / 1000).toFixed(2);

        let thinkingDuration: string | undefined;
        let responseDuration: string | undefined;

        const hasReasoning = displayReasoning.trim().length > 0;

        if (hasReasoning) {
          const thinkEnd = reasoningEndTime > 0 ? reasoningEndTime : now;
          // Think time starts from the first token, not the request start
          thinkingDuration = ((thinkEnd - firstTokenTime) / 1000).toFixed(2);

          if (reasoningEndTime > 0) {
            responseDuration = ((now - reasoningEndTime) / 1000).toFixed(2);
          }
        } else if (firstTokenTime > 0) {
          responseDuration = ((now - firstTokenTime) / 1000).toFixed(2);
        }

        updateAssistantMessage(displayContent, {
          isThinking: !firstChunkReceived,
          isReasoning: isCurrentlyReasoning,
          reasoning: displayReasoning,
          tokensPerSecond,
          ttft,
          totalDuration,
          thinkingDuration,
          responseDuration,
        });
      };

      // --------------------------------------------------------
      // Read SSE stream
      //
      // IMPORTANT:
      // This loop MUST be outside processSSELine().
      // --------------------------------------------------------

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split('\n');

        buffer = lines.pop() ?? '';

        for (const line of lines) {
          processSSELine(line);
        }
      }

      // --------------------------------------------------------
      // Flush decoder
      // --------------------------------------------------------

      buffer += decoder.decode();

      if (buffer.trim()) {
        const remainingLines = buffer.split('\n');

        for (const line of remainingLines) {
          processSSELine(line);
        }
      }

      // --------------------------------------------------------
      // Finish generation
      // --------------------------------------------------------

      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      let finalContent = cleanModelResponse(rawAssistantContent);
      let finalReasoning = rawReasoningContent;

      if (!finalReasoning && finalContent.includes('<think>')) {
        const parsedThink = parseThinkContent(finalContent);
        finalReasoning = parsedThink.reasoning;
        finalContent = parsedThink.answer;
      }

      const finalTime = Date.now();

      let finalThinkingDuration: string | undefined;
      let finalResponseDuration: string | undefined;

      const hasFinalReasoning = finalReasoning.trim().length > 0;

      if (hasFinalReasoning) {
        const thinkEnd = reasoningEndTime > 0 ? reasoningEndTime : finalTime;
        finalThinkingDuration = ((thinkEnd - firstTokenTime) / 1000).toFixed(2);

        if (reasoningEndTime > 0) {
          finalResponseDuration = (
            (finalTime - reasoningEndTime) /
            1000
          ).toFixed(2);
        } else {
          finalResponseDuration = '0.00';
        }
      } else if (firstTokenTime > 0) {
        finalResponseDuration = ((finalTime - firstTokenTime) / 1000).toFixed(
          2,
        );
      }

      let updatedMessages: Message[] = [];

      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;

        if (lastIndex >= 0 && updated[lastIndex]?.role === 'assistant') {
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: finalContent || 'The model returned an empty response.',
            reasoning: finalReasoning,
            isThinking: false,
            isReasoning: false,
            thinkingDuration:
              finalThinkingDuration ?? updated[lastIndex].thinkingDuration,
            responseDuration:
              finalResponseDuration ?? updated[lastIndex].responseDuration,
            totalDuration: ((finalTime - requestStartTime) / 1000).toFixed(2),
          };
        }

        updatedMessages = updated;
        return updated;
      });

      const finalAssistantMessage: Message = {
        role: 'assistant',
        content: finalContent || 'The model returned an empty response.',
        reasoning: finalReasoning,
        isThinking: false,
        isReasoning: false,
        thinkingDuration: finalThinkingDuration,
        responseDuration: finalResponseDuration,
        totalDuration: ((finalTime - requestStartTime) / 1000).toFixed(2),
      };

      const finalUserMessage: Message = {
        role: 'user',
        content: userMessage + (file ? `\n\n[Attached: ${file.name}]` : ''),
      };

      const messagesToSave: Message[] =
        updatedMessages.length > 0
          ? updatedMessages
          : [...messages, finalUserMessage, finalAssistantMessage];

      // --------------------------------------------------------
      // Save conversation to localStorage
      // --------------------------------------------------------

      try {
        let storedConversations: Conversation[] = [];
        const stored = localStorage.getItem('conversations');

        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            storedConversations = parsed;
          }
        } else if (conversations.length > 0) {
          storedConversations = conversations;
        }

        const currentActiveId = activeChatIdRef.current || activeChatId;
        const isNewChat =
          !currentActiveId ||
          !storedConversations.some((conv) => conv.id === currentActiveId);

        const chatId =
          !isNewChat && currentActiveId
            ? currentActiveId
            : typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `chat_${Date.now()}`;

        if (isNewChat) {
          setActiveChatId(chatId);
          activeChatIdRef.current = chatId;
        }

        let nextConversations: Conversation[];

        if (isNewChat) {
          const rawTitle = userMessage || (file ? file.name : 'New Chat');
          const cleanedTitle = rawTitle.trim().replace(/\s+/g, ' ');
          const title =
            cleanedTitle.length > 40
              ? `${cleanedTitle.slice(0, 40)}...`
              : cleanedTitle || 'New Chat';

          const newConversation: Conversation = {
            id: chatId,
            title,
            messages: messagesToSave,
            updatedAt: Date.now(),
            status: 'active',
          };

          nextConversations = [newConversation, ...storedConversations];
        } else {
          nextConversations = storedConversations.map((conv) => {
            if (conv.id === chatId) {
              return {
                ...conv,
                messages: messagesToSave,
                updatedAt: Date.now(),
              };
            }
            return conv;
          });
        }

        setConversations(nextConversations);
        localStorage.setItem(
          'conversations',
          JSON.stringify(nextConversations),
        );
      } catch (storageError) {
        console.error(
          'Failed to save conversation to localStorage:',
          storageError,
        );
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';

      if (aborted) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;

          if (lastIndex >= 0 && updated[lastIndex]?.role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              isThinking: false,
              isReasoning: false,
              content: updated[lastIndex].content || '_Generation cancelled._',
            };
          }

          return updated;
        });

        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';

      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;

        if (lastIndex >= 0 && updated[lastIndex]?.role === 'assistant') {
          updated[lastIndex] = {
            ...updated[lastIndex],
            isThinking: false,
            isReasoning: false,
            content: `Error: ${message}`,
          };
        }

        return updated;
      });

      addLog(`Chat Error: ${message}`, 'error');
    } finally {
      if (timerInterval) {
        clearInterval(timerInterval);
      }

      setLoading(false);

      abortControllerRef.current = null;

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ============================================================
  // File selection
  // ============================================================

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    setSelectedFile(file);

    if (file) {
      addLog(`Attached: ${file.name}`, 'info');
    }
  };

  // ============================================================
  // Remove attachment
  // ============================================================

  const handleRemoveFile = () => {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <main className="h-screen max-h-screen w-screen max-w-full flex flex-col bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      {/* ======================================================
          HEADER
      ======================================================= */}

      <header className="py-2.5 px-3 lg:py-0 h-auto shrink-0 border-b border-neutral-800 lg:px-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between bg-neutral-900 gap-2.5 lg:gap-0">
        <div className="flex items-center justify-between lg:justify-start gap-2 lg:gap-4 font-semibold tracking-wide w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMobileSidebar((prev) => !prev)}
              className="lg:hidden p-1.5 -ml-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition"
              title={showMobileSidebar ? 'Close sidebar' : 'Open sidebar'}
              aria-label="Toggle chat history sidebar"
            >
              {showMobileSidebar ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            <Bot className="w-5 h-5 text-sky-400" />

            <span className="text-sm lg:text-base">Transformers AI Chat</span>
          </div>

          {(activeChatId || messages.length > 0) && (
            <button
              type="button"
              onClick={() => {
                const activeConv = conversations.find(
                  (conv) => conv.id === activeChatId,
                );
                const convToExport: Conversation = activeConv
                  ? { ...activeConv, messages }
                  : {
                      id: activeChatId || 'current',
                      title: messages[0]?.content
                        ? messages[0].content.slice(0, 30)
                        : 'Current Conversation',
                      messages,
                      updatedAt: Date.now(),
                      status: 'active',
                    };
                downloadConversationAsMarkdown(convToExport);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-xs text-neutral-200 rounded-md transition shrink-0"
              title="Export as Markdown"
              aria-label="Export as Markdown"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export as Markdown</span>
              <span className="sm:hidden">Export</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:gap-3 w-full lg:w-auto">
          {/* MODEL CONTROLS */}

          <div className="flex items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={loadingModels || loading}
              className="flex-1 lg:flex-none bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500 min-w-0 max-w-full lg:max-w-[200px] truncate"
            >
              {loadingModels ? (
                <option value="">Loading...</option>
              ) : models.length === 0 ? (
                <option value="">No models found</option>
              ) : (
                models.map((model) => {
                  const baseModel = model.split('@')[0];
                  const loadedInfo = loadedModels.find(
                    (m) => m.loaded && m.id.split('@')[0] === baseModel,
                  );
                  const mem = loadedInfo ? formatModelMemory(loadedInfo) : null;
                  const suffix =
                    mem && mem !== '0 MB'
                      ? ` (${mem})`
                      : loadedInfo
                        ? ' (Loaded)'
                        : '';

                  return (
                    <option key={model} value={model}>
                      {model}
                      {suffix}
                    </option>
                  );
                })
              )}
            </select>

            <button
              type="button"
              onClick={handleLoadModel}
              disabled={modelStatus !== 'unloaded' || !selectedModel || loading}
              className="shrink-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-xs text-neutral-200 rounded-md transition disabled:opacity-50"
            >
              {modelStatus === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Load
            </button>

            <button
              type="button"
              onClick={() => {
                const selectedBase = selectedModel.split('@')[0];

                const target =
                  loadedModels.find(
                    (model) =>
                      model.loaded && model.id.split('@')[0] === selectedBase,
                  )?.id ?? selectedModel;

                handleUnloadModel(target);
              }}
              disabled={modelStatus !== 'loaded' || !selectedModel || loading}
              className="shrink-0 flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 text-xs text-red-400 rounded-md transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Unload
            </button>
          </div>

          {/* SERVER CONTROLS */}

          <div className="flex items-center justify-between lg:justify-start gap-1.5 sm:gap-2 border-t sm:border-t-0 lg:border-l border-neutral-800 pt-2 sm:pt-0 lg:pl-3 w-full lg:w-auto">
            <Server className="hidden lg:block w-4 h-4 text-neutral-400 shrink-0" />

            <input
              type="text"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              className="flex-1 min-w-0 lg:w-48 bg-neutral-800 border border-neutral-700 rounded p-1.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500"
              placeholder="Server URL"
            />

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowLoadedPanel((value) => !value)}
                className={`p-1.5 rounded transition relative ${
                  showLoadedPanel ? 'text-sky-400' : 'text-neutral-400'
                }`}
                title={
                  loadedModels.length > 0
                    ? `Loaded models: ${loadedModels.length} (${totalLoadedMemory || '0 MB'}) · Available: ${memoryOverview.availableGb} GB`
                    : `Loaded models · Available: ${memoryOverview.availableGb} GB`
                }
              >
                <Layers className="w-4 h-4" />
                {loadedModels.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-sky-400 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowLogs((value) => !value)}
                className={`p-1.5 rounded transition ${
                  showLogs ? 'text-sky-400' : 'text-neutral-400'
                }`}
                title="Server logs"
              >
                <Terminal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ======================================================
          MAIN
      ======================================================= */}

      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative">
        {/* MOBILE SIDEBAR BACKDROP */}
        {showMobileSidebar && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setShowMobileSidebar(false)}
            aria-hidden="true"
          />
        )}

        {/* LEFT SIDEBAR (CHAT HISTORY) */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-64 sm:w-72 lg:w-64 xl:w-72 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0 transition-transform duration-200 ease-in-out ${
            showMobileSidebar
              ? 'translate-x-0 shadow-2xl'
              : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* TOP BAR / NEW CHAT BUTTON */}
          <div className="p-3 border-b border-neutral-800 flex items-center justify-between gap-2">
            {sidebarView === 'trash' ? (
              <div className="flex-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSidebarView('chats')}
                  className="flex items-center gap-2 text-xs font-semibold text-neutral-200 hover:text-white transition"
                >
                  <ArrowLeft className="w-4 h-4 text-sky-400" />
                  <span>Trash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarView('chats')}
                  className="text-[11px] text-sky-400 hover:underline"
                >
                  Back to chats
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleNewChat}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMobileSidebar(false)}
              className="lg:hidden p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* SEARCH INPUT (ACTIVE CHATS ONLY) */}
          {sidebarView === 'chats' && (
            <div className="p-2 border-b border-neutral-800">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search chats..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-neutral-400 hover:text-neutral-200 p-0.5 rounded"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* CONVERSATIONS LIST */}
          {sidebarView === 'trash' ? (
            /* TRASH VIEW */
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                <span>Deleted Chats</span>
                <span className="text-[10px] text-neutral-500">
                  {trashConversations.length}{' '}
                  {trashConversations.length === 1 ? 'chat' : 'chats'}
                </span>
              </div>

              {trashConversations.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  <Trash2 className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p>Trash is empty</p>
                </div>
              ) : (
                trashConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 flex flex-col gap-2 group hover:border-neutral-700 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span
                        className="truncate flex-1 text-xs text-neutral-300 font-medium"
                        title={conv.title}
                      >
                        {conv.title || 'Untitled Chat'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-800/60">
                      <button
                        type="button"
                        onClick={() => handleRestore(conv.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-sky-400 rounded text-[11px] font-medium transition"
                        title="Restore conversation"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConversationToPermanentlyDelete(conv)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/30 text-red-400 rounded text-[11px] font-medium transition"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete Permanently</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* ACTIVE CHATS VIEW */
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {searchQuery.trim() ? 'Search Results' : 'Chats'}
              </div>

              {activeConversations.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p>
                    {searchQuery.trim()
                      ? 'No matching conversations'
                      : 'No active chats'}
                  </p>
                </div>
              ) : (
                activeConversations.map((conv) => {
                  const isActive = conv.id === activeChatId;

                  return (
                    <div
                      key={conv.id}
                      className={`w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition group ${
                        isActive
                          ? 'bg-neutral-800 text-sky-400 font-medium'
                          : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-neutral-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectConversation(conv)}
                        className="flex-1 flex items-center gap-2.5 min-w-0 text-left py-1.5"
                        title={conv.title}
                      >
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive
                              ? 'text-sky-400'
                              : 'text-neutral-500 group-hover:text-neutral-300'
                          }`}
                        />
                        <span className="truncate flex-1">
                          {conv.title || 'Untitled Chat'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const targetConv =
                            conv.id === activeChatId && messages.length > 0
                              ? { ...conv, messages }
                              : conv;
                          downloadConversationAsMarkdown(targetConv);
                        }}
                        className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-neutral-500 hover:text-sky-400 hover:bg-neutral-700/50 transition shrink-0"
                        title="Export as Markdown"
                        aria-label="Export as Markdown"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setConversationToDelete(conv);
                        }}
                        className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-700/50 transition shrink-0"
                        title="Delete conversation"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SIDEBAR FOOTER: TRASH TOGGLE */}
          <div className="p-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setSidebarView((prev) =>
                  prev === 'trash' ? 'chats' : 'trash',
                );
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                sidebarView === 'trash'
                  ? 'bg-neutral-800 text-sky-400'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
              title={sidebarView === 'trash' ? 'Back to Chats' : 'Open Trash'}
            >
              <div className="flex items-center gap-2">
                {sidebarView === 'trash' ? (
                  <>
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Chats</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 text-neutral-500" />
                    <span>Trash</span>
                  </>
                )}
              </div>

              {sidebarView !== 'trash' && trashConversations.length > 0 && (
                <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-full border border-neutral-700 font-mono">
                  {trashConversations.length}
                </span>
              )}
            </button>
          </div>
        </aside>

        {/* CHAT AREA + RIGHT SIDEBAR */}
        <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden h-full relative">
            {/* CHAT */}

            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              onWheel={handleWheel}
              onTouchMove={handleTouchMove}
              className="flex-1 min-h-0 w-full overflow-y-auto px-4 py-6 lg:p-6 overscroll-contain"
            >
              <div className="max-w-4xl mx-auto w-full space-y-7">
                {messages.length === 0 ? (
                  <div className="h-full min-h-[300px] flex items-center justify-center text-neutral-600">
                    <div className="text-center">
                      <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />

                      <p className="text-sm">
                        Start a conversation with your local model.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isUser = msg.role === 'user';

                    return (
                      <div
                        key={index}
                        className={`flex w-full ${
                          isUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`flex gap-3 max-w-full ${
                            isUser
                              ? 'flex-row-reverse lg:max-w-[80%]'
                              : 'flex-row lg:max-w-[80%]'
                          }`}
                        >
                          {/* AVATAR */}

                          <div
                            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                              isUser ? 'bg-sky-600' : 'bg-neutral-700'
                            }`}
                          >
                            {isUser ? (
                              <span className="text-[10px] font-semibold text-white">
                                You
                              </span>
                            ) : (
                              <Bot className="w-4 h-4 text-neutral-200" />
                            )}
                          </div>

                          {/* MESSAGE */}

                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-[10px] font-medium uppercase tracking-wide mb-1 ${
                                isUser
                                  ? 'text-sky-400 text-right'
                                  : 'text-neutral-500'
                              }`}
                            >
                              {isUser ? 'You' : 'AI'}
                            </div>

                            <div
                              className={`break-words ${
                                isUser
                                  ? 'bg-sky-900/80 text-sky-50 rounded-2xl rounded-tr-md px-4 py-3'
                                  : 'text-neutral-200 px-1 py-2'
                              }`}
                            >
                              {/* INITIAL THINKING */}

                              {msg.isThinking &&
                                !msg.reasoning &&
                                !msg.content && (
                                  <div className="flex items-center gap-2 text-neutral-500 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />

                                    <span>
                                      Thinking
                                      {msg.thinkingTime
                                        ? ` ${msg.thinkingTime}s`
                                        : '...'}
                                    </span>
                                  </div>
                                )}

                              {/* REASONING */}

                              {msg.reasoning && (
                                <div className="mb-4 border-l-2 border-neutral-700/80 bg-neutral-900/30 rounded-r-lg overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => toggleThinking(index)}
                                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-neutral-800/50 transition-colors text-left"
                                  >
                                    <div className="flex items-center gap-2 text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                                      {msg.isReasoning ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Bot className="w-3.5 h-3.5" />
                                      )}

                                      <span>
                                        {msg.isReasoning
                                          ? 'Thinking Process...'
                                          : 'Thinking Process'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-neutral-500">
                                      {msg.thinkingTime !== undefined &&
                                        msg.thinkingTime > 0 && (
                                          <span className="font-mono text-[10px] bg-neutral-950/50 px-1.5 py-0.5 rounded">
                                            {msg.thinkingTime}s
                                          </span>
                                        )}

                                      {msg.isThinkingExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </div>
                                  </button>

                                  {msg.isThinkingExpanded && (
                                    <div className="px-4 pb-3 pt-1 text-neutral-400 text-sm leading-relaxed opacity-80 border-t border-neutral-800/50 mt-1 prose prose-invert prose-sm max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-950 [&_pre]:p-3 [&_code]:text-sm [&_p]:my-1">
                                      <ReactMarkdown
                                        remarkPlugins={[
                                          remarkMath,
                                          remarkBreaks,
                                        ]}
                                        rehypePlugins={[rehypeKatex]}
                                      >
                                        {preprocessLaTeX(msg.reasoning)}
                                      </ReactMarkdown>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ANSWER */}

                              {msg.content && (
                                <div className="prose prose-invert prose-sm max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-950 [&_pre]:p-3 [&_code]:text-sm [&_p]:my-1">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkMath, remarkBreaks]}
                                    rehypePlugins={[rehypeKatex]}
                                  >
                                    {preprocessLaTeX(msg.content)}
                                  </ReactMarkdown>
                                </div>
                              )}

                              {/* METRICS */}

                              {(msg.tokensPerSecond ||
                                msg.ttft ||
                                msg.totalDuration) && (
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-neutral-500/70 font-mono border-t border-neutral-800/50 pt-2">
                                  {msg.tokensPerSecond && (
                                    <span>{msg.tokensPerSecond} tokens/s</span>
                                  )}

                                  {msg.ttft && (
                                    <span title="Time To First Token">
                                      TTFT: {msg.ttft}s
                                    </span>
                                  )}

                                  {msg.thinkingDuration && (
                                    <span title="Exact Thinking Time">
                                      Think: {msg.thinkingDuration}s
                                    </span>
                                  )}

                                  {msg.responseDuration && (
                                    <span title="Answer Generation Time">
                                      Gen: {msg.responseDuration}s
                                    </span>
                                  )}

                                  {msg.totalDuration && (
                                    <span title="Total Request Duration">
                                      Total: {msg.totalDuration}s
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* FLOATING SCROLL TO BOTTOM BUTTON */}
            {showScrollBottom && (
              <div className="absolute bottom-24 right-6 z-30">
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/95 hover:bg-neutral-700 text-sky-400 hover:text-sky-300 border border-neutral-700 rounded-full shadow-xl text-xs font-medium backdrop-blur-xs transition-all animate-in fade-in slide-in-from-bottom-2 duration-150 cursor-pointer"
                  title="Scroll to bottom"
                  aria-label="Scroll to bottom"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>Scroll to bottom</span>
                </button>
              </div>
            )}

            {/* ==================================================
              COMPOSER
          =================================================== */}

            <div className="shrink-0 p-2 lg:p-4 border-t border-neutral-800 bg-neutral-900 flex justify-center pb-safe">
              <div className="relative w-full max-w-5xl">
                {/* ATTACHMENT */}

                {selectedFile && (
                  <div className="mb-2 flex items-center">
                    <div className="flex items-center gap-2 max-w-full px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
                      <Paperclip className="w-3.5 h-3.5 text-sky-400 shrink-0" />

                      <span
                        className="text-xs text-neutral-300 truncate max-w-[250px]"
                        title={selectedFile.name}
                      >
                        {selectedFile.name}
                      </span>

                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        disabled={loading}
                        className="text-neutral-500 hover:text-red-400 text-sm leading-none disabled:opacity-40"
                        title="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}

                {/* COMPOSER ROW */}

                <div className="w-full flex items-end gap-1.5 sm:gap-2 max-w-full">
                  {/* FILE INPUT */}

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.txt,.md,.csv,.json,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileChange}
                  />

                  {/* ATTACHMENT BUTTON */}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-40 transition"
                    title="Attach file"
                  >
                    <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* THINKING BUTTON */}

                  <button
                    type="button"
                    onClick={() => setEnableThinking((value) => !value)}
                    disabled={loading}
                    className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg transition disabled:opacity-40 ${
                      enableThinking
                        ? 'text-sky-400 bg-sky-900/20 hover:bg-sky-900/40'
                        : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                    }`}
                    title={
                      enableThinking
                        ? 'Thinking Process: Enabled'
                        : 'Thinking Process: Disabled'
                    }
                  >
                    <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* CHAT MODEL SELECTOR */}

                  <select
                    value={activeChatModel}
                    onChange={(event) => setActiveChatModel(event.target.value)}
                    disabled={
                      loadedModels.filter((model) => model.loaded).length ===
                        0 || loading
                    }
                    className="shrink-0 w-24 sm:w-32 lg:w-44 h-9 sm:h-10 bg-neutral-800 border border-neutral-700 rounded-lg px-2 sm:px-2.5 text-[11px] sm:text-xs text-neutral-100 focus:outline-none focus:border-sky-500 disabled:opacity-50 truncate"
                    title={activeChatModel || 'No model loaded'}
                  >
                    {loadedModels.filter((model) => model.loaded).length ===
                    0 ? (
                      <option value="">No model loaded</option>
                    ) : (
                      loadedModels
                        .filter((model) => model.loaded)
                        .map((model) => {
                          const mem = formatModelMemory(model);
                          const memText = mem !== '0 MB' ? ` (${mem})` : '';

                          return (
                            <option key={model.id} value={model.id}>
                              {model.id.split('/').pop()}
                              {memText}
                            </option>
                          );
                        })
                    )}
                  </select>

                  {/* CHATGPT-STYLE COMPOSER */}

                  <div className="flex-1 min-w-0 relative flex items-end bg-neutral-800 border border-neutral-700 rounded-2xl focus-within:border-sky-500 transition-colors">
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      onKeyDown={(event) => {
                        /*
                         * Enter:
                         *   New line
                         *
                         * Shift + Enter:
                         *   New line
                         *
                         * Ctrl + Enter:
                         *   Send
                         *
                         * Cmd + Enter:
                         *   Send
                         */

                        if (
                          event.key === 'Enter' &&
                          (event.ctrlKey || event.metaKey)
                        ) {
                          event.preventDefault();

                          if (!loading && (prompt.trim() || selectedFile)) {
                            handleSend();
                          }
                        }

                        // Normal Enter intentionally does
                        // NOT preventDefault().
                      }}
                      placeholder="Message the model..."
                      disabled={loading}
                      rows={1}
                      className="w-full min-h-[44px] sm:min-h-[50px] max-h-[200px] resize-none overflow-y-auto bg-transparent border-0 outline-none px-3 sm:px-4 py-2.5 sm:py-3 pr-11 sm:pr-14 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-500 leading-5 sm:leading-6 disabled:opacity-50"
                    />

                    {/* SEND / CANCEL */}

                    {loading ? (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="absolute right-1 bottom-1 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-500 transition"
                        title="Cancel generation"
                      >
                        <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!prompt.trim() && !selectedFile}
                        className="absolute right-1 bottom-1 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed transition"
                        title="Send message"
                      >
                        <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* HINT */}

                <div className="mt-1.5 text-center text-[10px] text-neutral-600">
                  Enter for a new line · Ctrl+Enter to send
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================
            RIGHT SIDEBAR
        ======================================================= */}

          {(showLogs || showLoadedPanel) && (
            <div className="w-full lg:w-80 h-auto shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-900 flex flex-col max-h-[50vh] lg:max-h-full">
              {/* LOADED MODELS & MEMORY */}

              {showLoadedPanel && (
                <div className="flex flex-col bg-neutral-900 border-b border-neutral-800 max-h-[36rem] overflow-y-auto">
                  <div className="p-3 border-b border-neutral-800 text-xs font-semibold text-neutral-400 uppercase flex items-center justify-between sticky top-0 bg-neutral-900/95 backdrop-blur-xs z-10">
                    <span className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      Loaded Models & Memory
                    </span>

                    <button
                      type="button"
                      onClick={handleUnloadAll}
                      disabled={loading || loadedModels.length === 0}
                      className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Unload All
                    </button>
                  </div>

                  {/* MEMORY USAGE BREAKDOWN WITH SECTION PERCENTAGES */}
                  <div className="p-3 bg-neutral-950/80 border-b border-neutral-800 flex flex-col gap-3">
                    {/* DEVICE TITLE & OVERALL USAGE */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-300 font-medium flex items-center gap-1.5 truncate">
                        <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">
                          {memoryOverview.deviceLabel}
                        </span>
                      </span>
                      <span className="font-mono text-neutral-300 font-semibold text-[11px] shrink-0">
                        {memoryOverview.usedPercent}% used
                      </span>
                    </div>

                    {/* MULTI-SEGMENTED PROGRESS BAR */}
                    <div className="flex flex-col gap-1">
                      <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex p-0.5">
                        {/* Models segment */}
                        {Number(memoryOverview.modelPercent) > 0 && (
                          <div
                            className="h-full bg-sky-400 rounded-l-full transition-all"
                            style={{ width: `${memoryOverview.modelPercent}%` }}
                            title={`AI Models: ${totalLoadedMemory || '0 MB'} (${memoryOverview.modelPercent}%)`}
                          />
                        )}
                        {/* System / other processes segment */}
                        <div
                          className={`h-full bg-amber-500/80 transition-all ${
                            Number(memoryOverview.modelPercent) === 0
                              ? 'rounded-l-full'
                              : ''
                          }`}
                          style={{
                            width: `${memoryOverview.otherUsedPercent}%`,
                          }}
                          title={`System & Apps: ${memoryOverview.otherUsedGb} GB (${memoryOverview.otherUsedPercent}%)`}
                        />
                        {/* Available segment */}
                        <div
                          className="h-full bg-emerald-500/20 rounded-r-full transition-all"
                          style={{
                            width: `${memoryOverview.availablePercent}%`,
                          }}
                          title={`Available: ${memoryOverview.availableGb} GB (${memoryOverview.availablePercent}%)`}
                        />
                      </div>
                    </div>

                    {/* 4-SECTION CARDS WITH EXACT PERCENTAGE OF EACH SECTION */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* 1. MODELS USED */}
                      <div className="bg-neutral-900/90 border border-sky-900/40 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-sky-400 uppercase tracking-wider font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            AI Models
                          </span>
                          <span className="font-mono text-[11px] text-sky-300 font-semibold">
                            {memoryOverview.modelPercent}%
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-sm font-mono font-bold text-neutral-100">
                            {totalLoadedMemory || '0 MB'}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            of total
                          </span>
                        </div>
                      </div>

                      {/* 2. SYSTEM & APPS */}
                      <div className="bg-neutral-900/90 border border-amber-900/40 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-amber-400 uppercase tracking-wider font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            System & Apps
                          </span>
                          <span className="font-mono text-[11px] text-amber-300 font-semibold">
                            {memoryOverview.otherUsedPercent}%
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-sm font-mono font-bold text-neutral-100">
                            {memoryOverview.otherUsedGb} GB
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            of total
                          </span>
                        </div>
                      </div>

                      {/* 3. AVAILABLE HEADROOM */}
                      <div className="bg-neutral-900/90 border border-emerald-900/40 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Available
                          </span>
                          <span className="font-mono text-[11px] text-emerald-300 font-semibold">
                            {memoryOverview.availablePercent}%
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-sm font-mono font-bold text-emerald-400">
                            {memoryOverview.availableGb} GB
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            free
                          </span>
                        </div>
                      </div>

                      {/* 4. TOTAL CAPACITY */}
                      <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                            Total Capacity
                          </span>
                          <span className="font-mono text-[11px] text-neutral-400 font-semibold">
                            100%
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-sm font-mono font-bold text-neutral-200">
                            {memoryOverview.totalGb} GB
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            installed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECONDARY DEVICE BREAKDOWN (e.g. GPU VRAM if primary is RAM) */}
                    {memoryOverview.gpu && !memoryOverview.isGpu && (
                      <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-neutral-400">
                          <span className="truncate font-medium">
                            GPU VRAM ({memoryOverview.gpu.device_name || 'CUDA'}
                            )
                          </span>
                          <span className="font-mono text-sky-400 font-semibold">
                            {memoryOverview.gpu.percentage}% used
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-[10px] text-neutral-400">
                          <span>
                            Used: {memoryOverview.gpu.used_human} (
                            {memoryOverview.gpu.percentage}%)
                          </span>
                          <span className="text-emerald-400">
                            Free: {memoryOverview.gpu.available_human}
                          </span>
                          <span>Total: {memoryOverview.gpu.total_human}</span>
                        </div>
                      </div>
                    )}

                    {memoryOverview.systemRam && memoryOverview.isGpu && (
                      <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-neutral-400">
                          <span className="truncate font-medium">
                            Host System RAM
                          </span>
                          <span className="font-mono text-neutral-300 font-semibold">
                            {memoryOverview.systemRam.percentage}% used
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-[10px] text-neutral-400">
                          <span>
                            Used: {memoryOverview.systemRam.used_human} (
                            {memoryOverview.systemRam.percentage}%)
                          </span>
                          <span className="text-emerald-400">
                            Free: {memoryOverview.systemRam.available_human}
                          </span>
                          <span>
                            Total: {memoryOverview.systemRam.total_human}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* INDIVIDUAL LOADED MODELS LIST */}
                  <div className="p-2 space-y-2">
                    <div className="px-1 pt-1 pb-0.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Loaded Models ({loadedModels.length})</span>
                      {loadedModels.length > 0 && (
                        <span className="font-mono text-sky-400 font-normal">
                          {totalLoadedMemory} total
                        </span>
                      )}
                    </div>

                    {loadedModels.length === 0 ? (
                      <div className="text-xs text-neutral-600 text-center py-4 bg-neutral-950/40 rounded-lg border border-neutral-800/60">
                        No models loaded.
                      </div>
                    ) : (
                      loadedModels.map((model) => {
                        const mem = formatModelMemory(model);
                        const displayName =
                          model.id.split('/').pop() || model.id;

                        const modelBytes =
                          model.memory_bytes ||
                          (model.memory_mb
                            ? Math.round(model.memory_mb * 1024 * 1024)
                            : 0);

                        const modelPercentOfTotal =
                          memoryOverview.totalBytes > 0 && modelBytes > 0
                            ? (
                                (modelBytes / memoryOverview.totalBytes) *
                                100
                              ).toFixed(1)
                            : null;

                        return (
                          <div
                            key={model.id}
                            className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg gap-2 hover:border-neutral-700 transition"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span
                                  className="text-xs font-medium text-neutral-200 truncate"
                                  title={model.id}
                                >
                                  {displayName}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] font-mono">
                                <span className="text-sky-300 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.5 rounded">
                                  {mem !== '0 MB' ? mem : 'Loaded'}
                                </span>
                                {modelPercentOfTotal && (
                                  <span className="text-neutral-400 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
                                    {modelPercentOfTotal}% of total
                                  </span>
                                )}
                                {model.processor_loaded && (
                                  <span className="text-neutral-500 px-1 py-0.5">
                                    + tokenizer
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUnloadModel(model.id)}
                              disabled={loading}
                              className="text-neutral-500 hover:text-red-400 p-1.5 hover:bg-neutral-900 rounded transition disabled:opacity-40 shrink-0"
                              title={`Unload ${displayName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* LOGS */}

              {showLogs && (
                <div className="flex-1 overflow-hidden flex flex-col min-h-[12rem]">
                  <div className="p-3 border-b border-neutral-800 text-xs font-semibold text-neutral-400 uppercase">
                    Server Logs
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col p-3">
                    <TerminalPanel logs={logs} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          CONFIRMATION MODALS
      ======================================================= */}

      {/* SOFT DELETE CONFIRMATION MODAL */}
      {conversationToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setConversationToDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-100">
                Delete conversation?
              </h3>
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-300 font-medium truncate">
                &ldquo;{conversationToDelete.title || 'Untitled Chat'}&rdquo;
              </p>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              This conversation will be moved to Trash. You can recover it
              later.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmMoveToTrash}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {conversationToPermanentlyDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setConversationToPermanentlyDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-neutral-900 border border-red-900/40 rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-red-400">
                Permanently delete conversation?
              </h3>
              <button
                type="button"
                onClick={() => setConversationToPermanentlyDelete(null)}
                className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-300 font-medium truncate">
                &ldquo;
                {conversationToPermanentlyDelete.title || 'Untitled Chat'}
                &rdquo;
              </p>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              This action cannot be undone. All conversation data will be
              deleted.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConversationToPermanentlyDelete(null)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmPermanentDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
