'use client';
/* eslint-disable react-hooks/immutability */

import { useCallback } from 'react';
import type { Message, SSEPayload } from '../types/chat';
import { cleanModelResponse } from './logic/cleanModelResponse';
import {
  hasThinkTags,
  parseThinkContent,
  cleanSpeechText,
  getSavedVoice,
  getSavedSpeed,
} from '../utils/chat';
import type { AddLog, ChatRefs, ShowToast, Store } from './chatHookTypes';

export function useChatStreamingActions(
  store: Store,
  refs: ChatRefs,
  showToast: ShowToast,
  addLog: AddLog,
  resizeTextarea: () => void,
  scrollToBottom: (smooth?: boolean) => void,
  handleRetryMessage: (text?: string) => void,
  fetchRam: () => Promise<void>,
  fetchLoadedModels: () => Promise<void>,
  prefetchAudio?: (
    text: string,
    options?: { voice?: string; speed?: number },
  ) => Promise<void>,
) {
  const {
    serverUrl,
    activeChatModel,
    enableThinking,
    prompt,
    messages,
    selectedFile,
    pendingVoiceNote,
    loading,
    conversations,
    activeChatId,
    setMessages,
    setLoading,
    setPrompt,
    setSelectedFile,
    setPendingVoiceNote,
    setActiveChatId,
    setConversations,
    setServerStatus,
    setLastServerError,
    ttsVoice,
    ttsSpeed,
    speechLanguage,
  } = store;
  const handleSend = useCallback(async () => {
    if (loading) return;
    let text = prompt.trim();
    const file = selectedFile ?? pendingVoiceNote?.file ?? null;
    const voice = !selectedFile && Boolean(pendingVoiceNote);
    if (!text && !file) return;
    if (!activeChatModel) {
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: text },
        {
          role: 'assistant',
          content:
            '**No model selected.** Please load and select a model first.',
          isError: true,
          errorMessage: 'No active AI model selected.',
        },
      ]);
      showToast({
        type: 'warning',
        title: 'No Model Selected',
        message:
          'Please load and select a model from the top bar before sending a message.',
      });
      return;
    }

    if (voice && file && !text) {
      setLoading(true);
      try {
        const transcriptionForm = new FormData();
        transcriptionForm.append('file', file);
        transcriptionForm.append('serverUrl', serverUrl);
        transcriptionForm.append('language', speechLanguage);
        const transcriptionResponse = await fetch('/api/audio/transcribe', {
          method: 'POST',
          body: transcriptionForm,
        });
        if (!transcriptionResponse.ok) {
          const detail = await transcriptionResponse.text();
          throw new Error(detail || 'Voice transcription failed.');
        }
        const transcription = (await transcriptionResponse.json()) as {
          text?: string;
        };
        text = transcription.text?.trim() || '';
        if (!text) throw new Error('The transcription model returned no text.');
      } catch (error) {
        setLoading(false);
        showToast({
          type: 'error',
          title: 'Transcription Error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to transcribe the voice message.',
        });
        return;
      }
    }

    const controller = new AbortController();
    refs.abortControllerRef.current = controller;
    const started = Date.now();
    let raw = '';
    let reasoning = '';
    let timer: ReturnType<typeof setInterval> | null = null;
    const update = (content: string, extra: Partial<Message> = {}) =>
      setMessages((previous) => {
        const next = [...previous];
        const index = next.length - 1;
        if (index >= 0 && next[index].role === 'assistant')
          next[index] = { ...next[index], content, ...extra };
        return next;
      });
    try {
      setMessages((previous) => [
        ...previous,
        {
          role: 'user',
          content:
            text + (file && !voice ? `\n\n[Attached: ${file.name}]` : ''),
        },
        {
          role: 'assistant',
          content: '',
          isProcessing: true,
          processingTime: 0,
          isThinking: false,
          isThinkingExpanded: true,
          thinkingTime: 0,
        },
      ]);
      setLoading(true);
      setPrompt('');
      refs.autoScrollEnabled.current = true;
      requestAnimationFrame(() => {
        resizeTextarea();
        scrollToBottom(false);
      });
      let timerElapsed = 0;
      let activePhase: 'processing' | 'thinking' | 'done' = 'processing';
      timer = setInterval(() => {
        timerElapsed += 1;
        setMessages((previous) => {
          const next = [...previous];
          const index = next.length - 1;
          if (next[index]?.role === 'assistant') {
            if (activePhase === 'processing') {
              next[index] = {
                ...next[index],
                processingTime: timerElapsed,
                processingDuration: `${timerElapsed}.00`,
              };
            } else if (activePhase === 'thinking') {
              next[index] = {
                ...next[index],
                thinkingTime: timerElapsed,
              };
            }
          }
          return next;
        });
      }, 1000);
      const form = new FormData();
      form.append('prompt', text);
      form.append('serverUrl', serverUrl);
      form.append('model', activeChatModel);
      form.append('enableThinking', String(enableThinking));
      form.append('speechLanguage', speechLanguage);
      if (file && !voice) {
        form.append('file', file);
      }
      form.append(
        'history',
        JSON.stringify(
          messages
            .filter((message) => !message.isThinking && message.content.trim())
            .map(({ role, content }) => ({ role, content })),
        ),
      );
      const response = await fetch('/api/ai', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error((await response.text()) || `HTTP ${response.status}`);
      if (!response.body)
        throw new Error('The server returned an empty response body.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstChunkTime = 0;
      let reasoningStartTime = 0;
      let reasoningEndTime = 0;
      let answerStartTime = 0;
      let tokenCount = 0;
      let currentlyReasoning = false;

      const process = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) return;
        const rawData = trimmed.slice(5).trim();
        if (!rawData || rawData === '[DONE]') return;
        let payload: SSEPayload;
        try {
          payload = JSON.parse(rawData) as SSEPayload;
        } catch {
          return;
        }
        const choice = payload.choices?.[0];
        const delta = choice?.delta;
        const content = delta?.content ?? choice?.text ?? '';
        const deltaReasoning =
          delta?.reasoning_content ?? delta?.reasoning ?? delta?.thinking ?? '';

        const tokenTime = Date.now();
        if (!firstChunkTime) {
          firstChunkTime = tokenTime;
        }

        if (deltaReasoning) {
          if (!reasoningStartTime) {
            reasoningStartTime = tokenTime;
            activePhase = 'thinking';
            timerElapsed = 0;
          }
          reasoning += deltaReasoning;
          currentlyReasoning = true;
        } else if (content) {
          if (currentlyReasoning && !reasoningEndTime) {
            reasoningEndTime = tokenTime;
            currentlyReasoning = false;
          }
          if (!answerStartTime) {
            answerStartTime = tokenTime;
            if (activePhase !== 'done') {
              activePhase = 'done';
              if (timer) {
                clearInterval(timer);
                timer = null;
              }
            }
          }
          raw += content;
          tokenCount += 1;
        }

        let display = cleanModelResponse(raw);
        let displayReasoning = reasoning;
        if (!reasoning && hasThinkTags(display)) {
          const parsed = parseThinkContent(display);
          display = parsed.answer;
          displayReasoning = parsed.reasoning;
          currentlyReasoning = parsed.isReasoning;
          if (currentlyReasoning && !reasoningStartTime) {
            reasoningStartTime = firstChunkTime || tokenTime;
            activePhase = 'thinking';
          } else if (
            !currentlyReasoning &&
            !reasoningEndTime &&
            reasoningStartTime
          ) {
            reasoningEndTime = tokenTime;
          }
        }

        if (!currentlyReasoning && activePhase === 'thinking') {
          activePhase = 'done';
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }

        const now = Date.now();
        const currentTtft = firstChunkTime
          ? ((firstChunkTime - started) / 1000).toFixed(2)
          : undefined;
        const startGen = reasoningStartTime || answerStartTime;
        const currentProcessingDuration = firstChunkTime
          ? (((startGen || now) - firstChunkTime) / 1000).toFixed(2)
          : '0.00';
        const currentThinkingDuration = reasoningStartTime
          ? (((reasoningEndTime || now) - reasoningStartTime) / 1000).toFixed(2)
          : undefined;
        const currentResponseDuration = answerStartTime
          ? ((now - answerStartTime) / 1000).toFixed(2)
          : undefined;
        const generationDurationSec =
          answerStartTime && now > answerStartTime
            ? (now - answerStartTime) / 1000
            : 0;
        const currentTps =
          generationDurationSec > 0
            ? (tokenCount / generationDurationSec).toFixed(2)
            : '0.00';

        update(display, {
          reasoning: displayReasoning,
          isProcessing: !firstChunkTime,
          isThinking: currentlyReasoning,
          isReasoning: currentlyReasoning,
          processingDuration: currentProcessingDuration,
          totalDuration: ((now - started) / 1000).toFixed(2),
          ttft: currentTtft,
          thinkingDuration: currentThinkingDuration,
          responseDuration: currentResponseDuration,
          tokensPerSecond: currentTps,
        });
      };
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(process);
      }
      buffer += decoder.decode();
      buffer.split('\n').forEach(process);
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (!raw.trim() && !reasoning.trim())
        throw new Error(
          'The inference server closed the stream without generating any response.',
        );
      const finalContent =
        cleanModelResponse(raw) || 'The model returned an empty response.';
      const endNow = Date.now();
      const finalTotalDuration = ((endNow - started) / 1000).toFixed(2);
      const finalStartGen = reasoningStartTime || answerStartTime;
      const finalProcessingDuration =
        firstChunkTime && finalStartGen
          ? ((finalStartGen - firstChunkTime) / 1000).toFixed(2)
          : '0.00';
      const finalTtft = firstChunkTime
        ? ((firstChunkTime - started) / 1000).toFixed(2)
        : undefined;
      const finalThinkingDuration = reasoningStartTime
        ? (((reasoningEndTime || endNow) - reasoningStartTime) / 1000).toFixed(
            2,
          )
        : undefined;
      const finalResponseDuration = answerStartTime
        ? ((endNow - answerStartTime) / 1000).toFixed(2)
        : undefined;
      const finalGenDurationSec =
        answerStartTime && endNow > answerStartTime
          ? (endNow - answerStartTime) / 1000
          : 0;
      const finalTokensPerSecond =
        finalGenDurationSec > 0 && tokenCount > 0
          ? (tokenCount / finalGenDurationSec).toFixed(2)
          : undefined;

      const finalMetrics = {
        tokensPerSecond: finalTokensPerSecond,
        ttft: finalTtft,
        processingDuration: finalProcessingDuration,
        totalDuration: finalTotalDuration,
        thinkingDuration: finalThinkingDuration,
        responseDuration: finalResponseDuration,
      };

      update(finalContent, {
        reasoning,
        isProcessing: false,
        isThinking: false,
        isReasoning: false,
        ...finalMetrics,
      });
      const current = refs.activeChatIdRef.current || activeChatId;
      const id =
        current ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `chat_${Date.now()}`);
      const finalMessages: Message[] = [
        ...messages,
        { role: 'user', content: text },
        {
          role: 'assistant',
          content: finalContent,
          reasoning,
          isThinking: false,
          ...finalMetrics,
        },
      ];
      const next = current
        ? conversations.map((conversation) =>
            conversation.id === id
              ? {
                  ...conversation,
                  messages: finalMessages,
                  updatedAt: Date.now(),
                  voice: ttsVoice,
                  speed: ttsSpeed,
                }
              : conversation,
          )
        : [
            {
              id,
              title: (text || file?.name || 'New Chat').slice(0, 40),
              messages: finalMessages,
              updatedAt: Date.now(),
              status: 'active' as const,
              voice: ttsVoice,
              speed: ttsSpeed,
            },
            ...conversations,
          ];
      setActiveChatId(id);
      refs.activeChatIdRef.current = id;
      setConversations(next);
      localStorage.setItem('conversations', JSON.stringify(next));

      // Asynchronously pre-process and cache the speech audio in local storage using last used voice
      if (prefetchAudio && finalContent) {
        const speechText = cleanSpeechText(finalContent);
        if (speechText) {
          const targetVoice = ttsVoice || getSavedVoice();
          const targetSpeed = ttsSpeed || getSavedSpeed();
          void prefetchAudio(speechText, {
            voice: targetVoice,
            speed: targetSpeed,
          });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        update('_Generation cancelled._', { isThinking: false });
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      setServerStatus('offline');
      setLastServerError(message);
      update(`Error: ${message}`, {
        isThinking: false,
        isError: true,
        errorMessage: message,
      });
      addLog(`Chat Error: ${message}`, 'error');
      showToast({
        type: 'error',
        title: 'Failed to Process Message',
        message,
        action: { label: 'Retry', onClick: () => handleRetryMessage(text) },
      });
    } finally {
      if (timer) clearInterval(timer);
      setLoading(false);
      refs.abortControllerRef.current = null;
      setSelectedFile(null);
      if (pendingVoiceNote) {
        URL.revokeObjectURL(pendingVoiceNote.url);
        setPendingVoiceNote(null);
      }
      if (refs.fileInputRef.current) refs.fileInputRef.current.value = '';
      void fetchLoadedModels();
      void fetchRam();
    }
  }, [
    activeChatId,
    activeChatModel,
    addLog,
    conversations,
    enableThinking,
    fetchLoadedModels,
    fetchRam,
    handleRetryMessage,
    loading,
    messages,
    pendingVoiceNote,
    prompt,
    refs,
    resizeTextarea,
    scrollToBottom,
    selectedFile,
    serverUrl,
    setActiveChatId,
    setConversations,
    setLastServerError,
    setLoading,
    setMessages,
    setPendingVoiceNote,
    setPrompt,
    setSelectedFile,
    setServerStatus,
    showToast,
    prefetchAudio,
    ttsVoice,
    ttsSpeed,
    speechLanguage,
  ]);
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setSelectedFile(file);
      if (file) addLog(`Attached: ${file.name}`);
    },
    [addLog, setSelectedFile],
  );
  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    if (refs.fileInputRef.current) refs.fileInputRef.current.value = '';
  }, [refs.fileInputRef, setSelectedFile]);
  return { handleSend, handleFileChange, handleRemoveFile };
}
