'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  Loader2,
  Paperclip,
  Send,
  Server,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
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

type LoadedModel = {
  id: string;
  loaded: boolean;
  processor_loaded?: boolean;
};

type ModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

type LoadedModelsResponse = {
  data?: LoadedModel[];
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

  const [showRam, setShowRam] = useState(false);
  const [ramStats, setRamStats] = useState({
    used: '0',
    total: '0',
    percentage: '0',
  });

  const [loadedModels, setLoadedModels] = useState<LoadedModel[]>([]);
  const [showLoadedPanel, setShowLoadedPanel] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [enableThinking, setEnableThinking] = useState(true);

  // ============================================================
  // Refs
  // ============================================================

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabled = useRef(true);

  // ============================================================
  // Smart Auto-Scroll
  // ============================================================

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    autoScrollEnabled.current = distanceFromBottom <= 24;
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

  useEffect(() => {
    if (!showRam) {
      return;
    }

    const fetchRam = async () => {
      try {
        const response = await fetch('/api/system/ram', {
          cache: 'no-store',
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        setRamStats({
          used: String(data.used ?? '0'),
          total: String(data.total ?? '0'),
          percentage: String(data.percentage ?? '0'),
        });
      } catch {
        // Ignore RAM polling errors.
      }
    };

    fetchRam();

    const interval = setInterval(fetchRam, 2000);

    return () => clearInterval(interval);
  }, [showRam]);

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
    return content
      .replace(
        /\\\[([\s\S]*?)\\\]/g,
        (_match, expression: string) => `$$${expression}$$`,
      )
      .replace(
        /\\\(([\s\S]*?)\\\)/g,
        (_match, expression: string) => `$${expression}$`,
      );
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

      requestAnimationFrame(() => {
        resizeTextarea();
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

        return updated;
      });
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
    <main className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans">
      {/* ======================================================
          HEADER
      ======================================================= */}

      <header className="py-3 px-3 lg:py-0 h-auto shrink-0 border-b border-neutral-800 lg:px-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between bg-neutral-900 gap-3 lg:gap-0">
        <div className="flex items-center gap-2 font-semibold tracking-wide justify-center lg:justify-start">
          <Bot className="w-5 h-5 text-sky-400" />

          <span className="text-sm lg:text-base">Transformers AI Chat</span>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full lg:w-auto">
          {/* MODEL CONTROLS */}

          <div className="flex flex-wrap items-center justify-center gap-2 w-full lg:w-auto">
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={loadingModels || loading}
              className="flex-1 lg:flex-none bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500 min-w-[120px] max-w-full lg:max-w-[200px] truncate"
            >
              {loadingModels ? (
                <option value="">Loading...</option>
              ) : models.length === 0 ? (
                <option value="">No models found</option>
              ) : (
                models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={handleLoadModel}
              disabled={modelStatus !== 'unloaded' || !selectedModel || loading}
              className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-xs text-neutral-200 rounded-md transition disabled:opacity-50"
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
              className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 text-xs text-red-400 rounded-md transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Unload
            </button>
          </div>

          {/* SERVER CONTROLS */}

          <div className="flex items-center justify-between lg:justify-start gap-2 border-t lg:border-t-0 lg:border-l border-neutral-800 pt-3 lg:pt-0 lg:pl-3 w-full lg:w-auto">
            <Server className="hidden lg:block w-4 h-4 text-neutral-400 shrink-0" />

            <input
              type="text"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              className="flex-1 lg:w-48 bg-neutral-800 border border-neutral-700 rounded p-1.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500 min-w-[100px]"
              placeholder="Server URL"
            />

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowLoadedPanel((value) => !value)}
                className={`p-1.5 rounded transition ${
                  showLoadedPanel ? 'text-sky-400' : 'text-neutral-400'
                }`}
                title="Loaded models"
              >
                <Layers className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowRam((value) => !value)}
                className={`p-1.5 rounded transition ${
                  showRam ? 'text-sky-400' : 'text-neutral-400'
                }`}
                title="System RAM"
              >
                <Activity className="w-4 h-4" />
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

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          {/* CHAT */}

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-6 lg:p-6"
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

                        <div className="min-w-0">
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
                                  <div className="px-4 pb-3 pt-1 text-neutral-400 text-sm whitespace-pre-wrap leading-relaxed font-mono opacity-80 border-t border-neutral-800/50 mt-1">
                                    {msg.reasoning}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ANSWER */}

                            {msg.content && (
                              <div className="prose prose-invert prose-sm max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-950 [&_pre]:p-3 [&_code]:text-sm [&_p]:my-1">
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath]}
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

          {/* ==================================================
              COMPOSER
          =================================================== */}

          <div className="p-2 lg:p-4 border-t border-neutral-800 bg-neutral-900 flex justify-center pb-safe">
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

              <div className="w-full flex items-end gap-2">
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
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-40 transition"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* THINKING BUTTON */}

                <button
                  type="button"
                  onClick={() => setEnableThinking((value) => !value)}
                  disabled={loading}
                  className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition disabled:opacity-40 ${
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
                  <Brain className="w-5 h-5" />
                </button>

                {/* CHAT MODEL SELECTOR */}

                <select
                  value={activeChatModel}
                  onChange={(event) => setActiveChatModel(event.target.value)}
                  disabled={
                    loadedModels.filter((model) => model.loaded).length === 0 ||
                    loading
                  }
                  className="shrink-0 w-[130px] lg:w-[190px] h-10 bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500 disabled:opacity-50 truncate"
                  title={activeChatModel || 'No model loaded'}
                >
                  {loadedModels.filter((model) => model.loaded).length === 0 ? (
                    <option value="">No model loaded</option>
                  ) : (
                    loadedModels
                      .filter((model) => model.loaded)
                      .map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.id.split('/').pop()}
                        </option>
                      ))
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
                    className="w-full min-h-[50px] max-h-[200px] resize-none overflow-y-auto bg-transparent border-0 outline-none px-4 py-3 pr-14 text-sm text-neutral-100 placeholder:text-neutral-500 leading-6 disabled:opacity-50"
                  />

                  {/* SEND / CANCEL */}

                  {loading ? (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="absolute right-1 bottom-1 w-9 h-9 flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-500 transition"
                      title="Cancel generation"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!prompt.trim() && !selectedFile}
                      className="absolute right-1 bottom-1 w-9 h-9 flex items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed transition"
                      title="Send message"
                    >
                      <Send className="w-4 h-4" />
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

        {(showLogs || showRam || showLoadedPanel) && (
          <div className="w-full lg:w-80 h-auto shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-900 flex flex-col max-h-[50vh] lg:max-h-full">
            {/* LOADED MODELS */}

            {showLoadedPanel && (
              <div className="flex flex-col bg-neutral-900 border-b border-neutral-800 max-h-64 overflow-y-auto">
                <div className="p-3 border-b border-neutral-800 text-xs font-semibold text-neutral-400 uppercase flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    VRAM Memory
                  </span>

                  <button
                    type="button"
                    onClick={handleUnloadAll}
                    disabled={loading}
                    className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Unload All
                  </button>
                </div>

                <div className="p-2 space-y-2">
                  {loadedModels.length === 0 ? (
                    <div className="text-xs text-neutral-600 text-center py-2">
                      No models loaded.
                    </div>
                  ) : (
                    loadedModels.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-2 bg-neutral-950 border border-neutral-800 rounded-md"
                      >
                        <span
                          className="text-xs text-neutral-300 truncate w-3/4"
                          title={model.id}
                        >
                          {model.id.split('/').pop()}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleUnloadModel(model.id)}
                          disabled={loading}
                          className="text-neutral-500 hover:text-red-400 p-1 disabled:opacity-40"
                          title="Unload model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* RAM */}

            {showRam && (
              <div className="flex flex-col bg-neutral-900 border-b border-neutral-800">
                <div className="p-3 border-b border-neutral-800 text-xs font-semibold text-neutral-400 uppercase flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  System RAM
                </div>

                <div className="p-4 flex flex-col justify-center gap-3">
                  <div className="flex justify-between text-xs text-neutral-300 font-mono">
                    <span>
                      {ramStats.used} / {ramStats.total} GB
                    </span>

                    <span>{ramStats.percentage}%</span>
                  </div>

                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all"
                      style={{
                        width: `${Math.min(
                          Math.max(Number(ramStats.percentage) || 0, 0),
                          100,
                        )}%`,
                      }}
                    />
                  </div>
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
    </main>
  );
}
