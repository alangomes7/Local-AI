'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Speech,
  Info,
  Layers,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  PlugZap,
  Plus,
  RefreshCw,
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
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import TerminalPanel, { LogEntry, LogType } from '../../TerminalPanel';
import CodeBlock from '../../CodeBlock';
import VoiceNotePlayer from '../../VoiceNotePlayer';

import {
  ToastNotification,
  Message,
  Conversation,
  VoiceChatState,
  LoadedModel,
  SystemMemoryStatus,
  LoadedModelsResponse,
  ModelsResponse,
} from '../../../../types/chat';
import {
  formatModelMemory,
  isVoiceOrToolModel,
  hasThinkTags,
  parseThinkContent,
  preprocessCodeBlocks,
  preprocessWhatsApp,
  exportChatToMarkdown,
  sanitizeFilename,
  downloadConversationAsMarkdown,
} from '../../../../utils/chat';
import { useChatContext } from '../../../../contexts/ChatContext';
export function Composer() {
  const {
    activeChatModel,
    setActiveChatModel,
    sortedLoadedModels,
    prompt,
    setPrompt,
    loading,
    voiceChatState,
    setVoiceChatState,
    isVoiceChatActive,
    setIsVoiceChatActive,
    audioPlaybackRef,
    startContinuousRecording,
    stopVoiceChatRecording,
    selectedFile,
    isRecording,
    recordingSeconds,
    isTranscribingVoiceNote,
    pendingVoiceNote,
    enableThinking,
    setEnableThinking,
    fileInputRef,
    textareaRef,
    handleCancel,
    handleStartRecording,
    handleStopRecording,
    handleCancelVoiceNote,
    handleSend,
    handleFileChange,
    handleRemoveFile,
  } = useChatContext();

  return (
    <>
      <div className="shrink-0 p-2 lg:p-4 border-t border-neutral-800 bg-neutral-900 flex justify-center pb-safe">
        <div className="relative w-full max-w-5xl">
          {/* PENDING VOICE NOTE PREVIEW */}

          {isRecording && (
            <div className="mb-2 flex items-center gap-3 px-3 py-2 rounded-xl bg-red-950/30 border border-red-800/50 text-red-300">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Recording
              </span>
              <span className="ml-auto font-mono text-sm">
                {Math.floor(recordingSeconds / 60)}:
                {String(recordingSeconds % 60).padStart(2, '0')}
              </span>
            </div>
          )}

          {isTranscribingVoiceNote && pendingVoiceNote && (
            <div className="mb-2 flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-800/50 text-amber-300">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Transcribing audio...
              </span>
              <span className="ml-auto font-mono text-sm">
                {Math.floor(pendingVoiceNote.durationSeconds / 60)}:
                {String(pendingVoiceNote.durationSeconds % 60).padStart(2, '0')}
              </span>
            </div>
          )}

          {pendingVoiceNote && !isRecording && !isTranscribingVoiceNote && (
            <div className="mb-2 flex items-center gap-2">
              <VoiceNotePlayer
                url={pendingVoiceNote.url}
                duration={pendingVoiceNote.durationSeconds}
                fileName={pendingVoiceNote.file.name}
              />
              <button
                type="button"
                onClick={handleCancelVoiceNote}
                disabled={loading}
                className="shrink-0 p-2 text-neutral-500 hover:text-red-400 disabled:opacity-40"
                title="Discard voice message"
                aria-label="Discard voice message"
              >
                ×
              </button>
            </div>
          )}

          {/* FILE ATTACHMENT PREVIEW */}

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

          {isVoiceChatActive && (
            <div className="absolute bottom-full left-0 w-full mb-3 px-4 flex justify-center animate-in slide-in-from-bottom-2">
              <div className="bg-neutral-900/95 border border-neutral-700/80 shadow-2xl rounded-2xl p-4 w-full max-w-sm flex flex-col items-center gap-3 backdrop-blur-md">
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                  Voice Chat
                </div>

                {voiceChatState === 'idle' && (
                  <span className="text-neutral-300">Ready to listen...</span>
                )}
                {voiceChatState === 'recording' && (
                  <span className="text-red-400 animate-pulse">
                    🎙️ Listening...
                  </span>
                )}
                {voiceChatState === 'transcribing' && (
                  <span className="text-amber-400">⏳ Transcribing...</span>
                )}
                {voiceChatState === 'thinking' && (
                  <span className="text-sky-400">🧠 Thinking...</span>
                )}
                {voiceChatState === 'synthesizing' && (
                  <span className="text-purple-400">
                    ⚙️ Generating Voice...
                  </span>
                )}
                {voiceChatState === 'playing' && (
                  <span className="text-emerald-400">🔊 Speaking...</span>
                )}
                {voiceChatState === 'error' && (
                  <span className="text-red-500">❌ Connection Error</span>
                )}

                <div className="flex gap-4 mt-2">
                  <button
                    onClick={startContinuousRecording}
                    disabled={
                      voiceChatState !== 'idle' && voiceChatState !== 'error'
                    }
                    className="p-3 bg-red-600/20 text-red-400 rounded-full hover:bg-red-600/30 disabled:opacity-30"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsVoiceChatActive(false);
                      audioPlaybackRef.current?.pause();
                      stopVoiceChatRecording();
                      setVoiceChatState('idle');
                    }}
                    className="p-3 bg-neutral-800 text-neutral-300 rounded-full hover:bg-neutral-700"
                    title="Exit voice chat mode"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="w-full bg-neutral-800/80 border border-neutral-700/80 rounded-2xl p-2.5 focus-within:border-sky-500/80 focus-within:ring-1 focus-within:ring-sky-500/20 transition-all shadow-sm">
            {/* TEXTAREA CONTAINER (ABOVE BUTTONS) */}
            <div className="w-full">
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

                    if (
                      !loading &&
                      (prompt.trim() || selectedFile || pendingVoiceNote)
                    ) {
                      handleSend();
                    }
                  }

                  // Normal Enter intentionally does
                  // NOT preventDefault().
                }}
                placeholder="Message the model..."
                disabled={loading}
                rows={2}
                className="w-full min-h-[44px] sm:min-h-[52px] max-h-[220px] resize-none overflow-y-auto bg-transparent border-0 outline-none px-2 py-1 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-500 leading-5 sm:leading-6 disabled:opacity-50"
              />
            </div>

            {/* BUTTONS TOOLBAR ROW (BELOW INPUT) */}
            <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2 pt-1 border-t border-neutral-700/40 mt-1">
              {/* FILE INPUT (HIDDEN) */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="*/*"
                onChange={handleFileChange}
              />

              {/* LEFT ACTIONS GROUP */}
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-wrap">
                {/* ATTACHMENT BUTTON */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || isRecording}
                  className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/60 disabled:opacity-40 transition"
                  title="Attach file (any type)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* MIC BUTTON */}
                {isRecording ? (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition relative"
                    title={`Recording… ${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, '0')} — click to stop`}
                  >
                    <MicOff className="w-4 h-4" />
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={loading || !!pendingVoiceNote}
                    className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-emerald-900/20 disabled:opacity-40 transition"
                    title="Record voice message"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}

                {/* VOICE CHAT BUTTON */}
                <button
                  type="button"
                  onClick={() => setIsVoiceChatActive((prev) => !prev)}
                  className={`shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition ${
                    isVoiceChatActive
                      ? 'bg-sky-600/20 text-sky-400 border border-sky-500/50'
                      : 'text-neutral-400 hover:text-sky-400 hover:bg-sky-900/20'
                  }`}
                  title="Toggle Voice Chat Mode"
                >
                  <Speech className="w-4 h-4" />
                </button>

                {/* THINKING BUTTON */}
                <button
                  type="button"
                  onClick={() => setEnableThinking((value) => !value)}
                  disabled={loading}
                  className={`shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition disabled:opacity-40 ${
                    enableThinking
                      ? 'text-sky-400 bg-sky-900/20 hover:bg-sky-900/40'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700/60'
                  }`}
                  title={
                    enableThinking
                      ? 'Thinking Process: Enabled'
                      : 'Thinking Process: Disabled'
                  }
                >
                  <Brain className="w-4 h-4" />
                </button>

                {/* CHAT MODEL SELECTOR */}
                {(() => {
                  const chatModels = sortedLoadedModels.filter(
                    (model) => model.loaded && !isVoiceOrToolModel(model.id),
                  );
                  return (
                    <select
                      value={activeChatModel}
                      onChange={(event) =>
                        setActiveChatModel(event.target.value)
                      }
                      disabled={chatModels.length === 0 || loading}
                      className="shrink-0 w-28 sm:w-36 lg:w-44 h-8 sm:h-9 bg-neutral-900/80 border border-neutral-700 rounded-lg px-2 text-[11px] sm:text-xs text-neutral-100 focus:outline-none focus:border-sky-500 disabled:opacity-50 truncate"
                      title={activeChatModel || 'No model loaded'}
                    >
                      {chatModels.length === 0 ? (
                        <option value="">No model loaded</option>
                      ) : (
                        chatModels.map((model) => {
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
                  );
                })()}
              </div>

              {/* RIGHT ACTIONS GROUP (SEND / CANCEL) */}
              <div className="flex items-center shrink-0">
                {loading ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-500 transition shadow-sm"
                    title="Cancel generation"
                    aria-label="Cancel generation"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    id="chat-submit-btn"
                    type="button"
                    onClick={handleSend}
                    disabled={
                      !prompt.trim() && !selectedFile && !pendingVoiceNote
                    }
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed transition shadow-sm"
                    title="Send message"
                    aria-label="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* HINT */}

          <div className="mt-1.5 text-center text-[10px] text-neutral-600">
            Enter for a new line · Ctrl+Enter to send
          </div>
        </div>
      </div>
    </>
  );
}
