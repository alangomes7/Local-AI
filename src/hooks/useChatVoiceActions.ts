'use client';
/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */

import { useCallback, useEffect, useRef } from 'react';
import type { ChatRefs, ShowToast, Store, AddLog } from './chatHookTypes';
import {
  getAudioCacheKey,
  getCachedAudio,
  saveCachedAudio,
} from '../utils/audioCache';

const STT_MODEL = 'nvidia/parakeet-tdt-0.6b-v3';
const TTS_MODEL = 'hexgrad/Kokoro-82M';

export function useChatVoiceActions(
  store: Store,
  refs: ChatRefs,
  showToast: ShowToast,
  dismissToast: (id: string) => void,
  addLog: AddLog,
) {
  const {
    serverUrl,
    activeChatModel,
    messages,
    voiceChatState,
    isVoiceChatActive,
    isRecording,
    pendingVoiceNote,
    setVoiceChatState,
    setMessages,
    setIsRecording,
    setRecordingSeconds,
    setIsTranscribingVoiceNote,
    setPendingVoiceNote,
    setPrompt,
    setLoading,
    ttsVoice,
    ttsSpeed,
  } = store;
  const voiceModeRef = useRef(false);
  const ttsRequestsRef = useRef(new Map<string, Promise<Blob>>());
  const audioPlaybackGenerationRef = useRef(0);

  const changeAudioModelState = useCallback(
    async (
      endpoint: '/api/models/load' | '/api/models/unload',
      model: string,
    ) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, serverUrl }),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
    [serverUrl],
  );

  const loadVoiceModels = useCallback(async () => {
    await Promise.all([
      changeAudioModelState('/api/models/load', STT_MODEL),
      changeAudioModelState('/api/models/load', TTS_MODEL),
    ]);
  }, [changeAudioModelState]);

  const unloadVoiceModels = useCallback(async () => {
    await Promise.allSettled([
      changeAudioModelState('/api/models/unload', STT_MODEL),
      changeAudioModelState('/api/models/unload', TTS_MODEL),
    ]);
  }, [changeAudioModelState]);

  const transcribeVoiceNote = useCallback(
    async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('serverUrl', serverUrl);
      formData.append('model', STT_MODEL);
      formData.append('language', 'auto');
      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Voice transcription failed.');
      }
      const data = (await response.json()) as { text?: string };
      const text = data.text?.trim() || '';
      if (!text) throw new Error('The transcription model returned no text.');
      return text;
    },
    [serverUrl],
  );

  useEffect(() => {
    if (isVoiceChatActive && !voiceModeRef.current) {
      voiceModeRef.current = true;
      void loadVoiceModels().catch((error) => {
        setVoiceChatState('error');
        showToast({
          type: 'error',
          title: 'Voice Models Unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to load voice models.',
        });
      });
    } else if (!isVoiceChatActive && voiceModeRef.current) {
      voiceModeRef.current = false;
      void unloadVoiceModels();
    }
  }, [
    isVoiceChatActive,
    loadVoiceModels,
    setVoiceChatState,
    showToast,
    unloadVoiceModels,
  ]);
  const generateLLMResponseText = useCallback(
    async (text: string): Promise<string> => {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map(({ role, content }) => ({ role, content })),
            { role: 'user', content: text },
          ],
          model: activeChatModel,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error('LLM Generation Failed');
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? '';
    },
    [activeChatModel, messages, serverUrl],
  );
  const processVoiceChatTurn = useCallback(
    async (audioBlob: Blob) => {
      setVoiceChatState('transcribing');
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice.webm');
        formData.append('model', STT_MODEL);
        formData.append('language', 'auto');
        const sttResponse = await fetch(
          `${serverUrl.replace(/\/chat\/completions\/?$/, '')}/audio/transcriptions`,
          { method: 'POST', body: formData },
        );
        if (!sttResponse.ok) {
          const detail = await sttResponse.text();
          throw new Error(
            detail || `STT failed with HTTP ${sttResponse.status}`,
          );
        }
        const sttData = (await sttResponse.json()) as {
          text?: string;
          language?: string;
        };
        const userText = sttData.text?.trim() ?? '';
        if (!userText) {
          setVoiceChatState('idle');
          if (isVoiceChatActive) void startContinuousRecording();
          return;
        }
        setMessages((previous) => [
          ...previous,
          { role: 'user', content: userText },
        ]);
        setVoiceChatState('thinking');
        const responseText = await generateLLMResponseText(userText);
        setMessages((previous) => [
          ...previous,
          { role: 'assistant', content: responseText },
        ]);
        setVoiceChatState('synthesizing');
        const ttsResponse = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: responseText,
            language: sttData.language || 'en',
            model: TTS_MODEL,
            serverUrl,
            keepLoaded: isVoiceChatActive,
          }),
        });
        if (!ttsResponse.ok) throw new Error('TTS Failed');
        const url = URL.createObjectURL(
          new Blob([await ttsResponse.arrayBuffer()], { type: 'audio/wav' }),
        );
        const audio = new Audio(url);
        refs.audioPlaybackRef.current = audio;
        setVoiceChatState('playing');
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (isVoiceChatActive) void startContinuousRecording();
          else setVoiceChatState('idle');
        };
        await audio.play();
      } catch (error) {
        console.error(error);
        setVoiceChatState('error');
      }
    },
    [
      generateLLMResponseText,
      isVoiceChatActive,
      refs.audioPlaybackRef,
      serverUrl,
      setMessages,
      setVoiceChatState,
    ],
  );
  const stopVoiceChatRecording = useCallback(() => {
    if (refs.mediaRecorderRef.current?.state === 'recording')
      refs.mediaRecorderRef.current.stop();
  }, [refs.mediaRecorderRef]);
  const startContinuousRecording = useCallback(async () => {
    if (voiceChatState !== 'idle' && voiceChatState !== 'playing') return;
    try {
      await loadVoiceModels();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.minDecibels = -60;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart = Date.now();
      let speaking = false;
      let frame = 0;
      const detectSilence = () => {
        analyser.getByteFrequencyData(data);
        if (data.some((value) => value > 10)) {
          silenceStart = Date.now();
          speaking = true;
        } else if (speaking && Date.now() - silenceStart > 1500) {
          stopVoiceChatRecording();
          return;
        }
        if (refs.mediaRecorderRef.current?.state === 'recording')
          frame = requestAnimationFrame(detectSilence);
      };
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        cancelAnimationFrame(frame);
        await context.close();
        stream.getTracks().forEach((track) => track.stop());
        await processVoiceChatTurn(new Blob(chunks, { type: mimeType }));
      };
      refs.mediaRecorderRef.current = recorder;
      recorder.start(100);
      setVoiceChatState('recording');
      detectSilence();
    } catch {
      setVoiceChatState('error');
      showToast({
        type: 'error',
        title: 'Microphone Error',
        message: 'Permission denied.',
      });
    }
  }, [
    processVoiceChatTurn,
    loadVoiceModels,
    refs.mediaRecorderRef,
    setVoiceChatState,
    showToast,
    stopVoiceChatRecording,
    voiceChatState,
  ]);
  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        [
          'audio/ogg;codecs=opus',
          'audio/webm;codecs=opus',
          'audio/ogg',
          'audio/webm',
        ].find((type) => MediaRecorder.isTypeSupported(type)) ?? 'audio/webm';
      const startedAt = Date.now();
      const recorder = new MediaRecorder(stream, { mimeType });
      refs.audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) refs.audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (refs.recordingTimerRef.current)
          clearInterval(refs.recordingTimerRef.current);
        refs.recordingTimerRef.current = null;
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000),
        );
        const containerType = mimeType.split(';')[0];
        const extension = containerType.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(refs.audioChunksRef.current, {
          type: containerType,
        });
        const audioFile = new File([audioBlob], `voice-message.${extension}`, {
          type: containerType,
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        setPendingVoiceNote({
          file: audioFile,
          durationSeconds,
          url: audioUrl,
        });
        setRecordingSeconds(0);
        setIsRecording(false);
        setIsTranscribingVoiceNote(true);
        setLoading(true);
        try {
          const transcript = await transcribeVoiceNote(audioFile);
          setPrompt((current) =>
            current.trim() ? `${current.trim()}\n${transcript}` : transcript,
          );
          URL.revokeObjectURL(audioUrl);
          setPendingVoiceNote(null);
        } catch (error) {
          showToast({
            type: 'error',
            title: 'Transcription Error',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to transcribe the voice message.',
          });
        } finally {
          setIsTranscribingVoiceNote(false);
          setLoading(false);
        }
      };
      refs.mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      refs.recordingTimerRef.current = setInterval(
        () => setRecordingSeconds((seconds) => seconds + 1),
        1000,
      );
      addLog('Voice recording started');
    } catch {
      showToast({
        type: 'error',
        title: 'Microphone Access Denied',
        message:
          'Could not access your microphone. Please allow microphone access in your browser settings.',
      });
    }
  }, [
    addLog,
    isRecording,
    refs,
    setLoading,
    setIsRecording,
    setIsTranscribingVoiceNote,
    setPendingVoiceNote,
    setPrompt,
    setRecordingSeconds,
    showToast,
    transcribeVoiceNote,
  ]);
  const handleStopRecording = useCallback(() => {
    if (isRecording && refs.mediaRecorderRef.current?.state === 'recording')
      refs.mediaRecorderRef.current.stop();
  }, [isRecording, refs.mediaRecorderRef]);
  const handleCancelVoiceNote = useCallback(() => {
    if (pendingVoiceNote) {
      URL.revokeObjectURL(pendingVoiceNote.url);
      setPendingVoiceNote(null);
    }
  }, [pendingVoiceNote, setPendingVoiceNote]);
  const stopAudioPlayback = useCallback(() => {
    audioPlaybackGenerationRef.current += 1;
    const audio = refs.audioPlaybackRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
    } catch {
      // Best effort audio stop
    }
    refs.audioPlaybackRef.current = null;
  }, [refs.audioPlaybackRef]);

  const requestTtsAudio = useCallback(
    async (
      text: string,
      chosenVoice: string,
      chosenLanguage: string,
      chosenSpeed: number,
    ): Promise<Blob> => {
      const key = getAudioCacheKey(
        text,
        chosenVoice,
        chosenLanguage,
        chosenSpeed,
      );
      const existingRequest = ttsRequestsRef.current.get(key);
      if (existingRequest) return existingRequest;

      const request = (async () => {
        const cached = await getCachedAudio(
          text,
          chosenVoice,
          chosenLanguage,
          chosenSpeed,
        );
        if (cached) return cached;

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model: TTS_MODEL,
            serverUrl,
            keepLoaded: isVoiceChatActive,
            voice: chosenVoice,
            language: chosenLanguage,
            speed: chosenSpeed,
          }),
        });
        if (!response.ok) throw new Error(await response.text());

        const blob = await response.blob();
        await saveCachedAudio(
          text,
          chosenVoice,
          chosenLanguage,
          chosenSpeed,
          blob,
        );
        return blob;
      })();

      ttsRequestsRef.current.set(key, request);
      try {
        return await request;
      } finally {
        if (ttsRequestsRef.current.get(key) === request) {
          ttsRequestsRef.current.delete(key);
        }
      }
    },
    [isVoiceChatActive, serverUrl],
  );

  const prefetchAudio = useCallback(
    async (
      text: string,
      options?: { voice?: string; language?: string; speed?: number },
    ): Promise<void> => {
      if (!text || !text.trim()) return;
      const chosenVoice = options?.voice || ttsVoice || 'af_heart';
      const chosenLanguage = options?.language || 'en';
      const chosenSpeed = options?.speed ?? ttsSpeed ?? 1.0;

      try {
        await requestTtsAudio(text, chosenVoice, chosenLanguage, chosenSpeed);
      } catch {
        // Prefetch is best-effort; ignore errors silently
      }
    },
    [requestTtsAudio, ttsSpeed, ttsVoice],
  );

  const readAloud = useCallback(
    async (
      text: string,
      options?: { voice?: string; language?: string; speed?: number },
    ): Promise<{ audio: HTMLAudioElement; url: string }> => {
      // Immediately stop any currently playing or pending audio
      stopAudioPlayback();

      const chosenVoice = options?.voice || ttsVoice || 'af_heart';
      const chosenLanguage = options?.language || 'en';
      const chosenSpeed = options?.speed ?? ttsSpeed ?? 1.0;
      const playbackGeneration = audioPlaybackGenerationRef.current;
      const blob = await requestTtsAudio(
        text,
        chosenVoice,
        chosenLanguage,
        chosenSpeed,
      );
      if (playbackGeneration !== audioPlaybackGenerationRef.current) {
        throw new DOMException('Audio playback was superseded.', 'AbortError');
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = chosenSpeed;
      refs.audioPlaybackRef.current = audio;
      return { audio, url };
    },
    [
      isVoiceChatActive,
      refs.audioPlaybackRef,
      requestTtsAudio,
      stopAudioPlayback,
      ttsVoice,
      ttsSpeed,
    ],
  );
  return {
    audioPlaybackRef: refs.audioPlaybackRef,
    startContinuousRecording,
    stopVoiceChatRecording,
    generateLLMResponseText,
    processVoiceChatTurn,
    readAloud,
    prefetchAudio,
    stopAudioPlayback,
    handleStartRecording,
    handleStopRecording,
    handleCancelVoiceNote,
  };
}
