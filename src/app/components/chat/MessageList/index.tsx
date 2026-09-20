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
  Volume2,
  VolumeX,
  X,
  Clock,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import TerminalPanel, { LogEntry, LogType } from '../../TerminalPanel';
import CodeBlock from '../../CodeBlock';
import ReadAloudPlayer from '../ReadAloudPlayer';

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
  cleanSpeechText,
  hasThinkTags,
  parseThinkContent,
  preprocessCodeBlocks,
  preprocessWhatsApp,
  exportChatToMarkdown,
  sanitizeFilename,
  downloadConversationAsMarkdown,
} from '../../../../utils/chat';
import { useChatContext } from '../../../../contexts/ChatContext';
export function MessageList() {
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const {
    messages,
    loading,
    setShowLogs,
    scrollContainerRef,
    showScrollBottom,
    scrollToBottom,
    handleScroll,
    handleWheel,
    handleTouchMove,
    toggleThinking,
    formatMarkdownContent,
    markdownComponents,
    handleRetryMessage,
    readAloud,
    stopAudioPlayback,
    audioPlaybackRef,
    ttsVoice,
    setTtsVoice,
    ttsSpeed,
    setTtsSpeed,
    activeChatId,
    conversations,
    setConversations,
  } = useChatContext();

  const [activePlayerIndex, setActivePlayerIndex] = useState<number | null>(
    null,
  );

  const cleanMessageForSpeech = useCallback((content: string) => {
    return cleanSpeechText(content);
  }, []);

  const handleVoiceChange = useCallback(
    (newVoice: string) => {
      setTtsVoice(newVoice);
      try {
        localStorage.setItem('last_tts_voice', newVoice);
      } catch {
        // Ignore storage error
      }
      if (activeChatId) {
        const nextConversations = conversations.map((conv) =>
          conv.id === activeChatId
            ? { ...conv, voice: newVoice, updatedAt: Date.now() }
            : conv,
        );
        setConversations(nextConversations);
        try {
          localStorage.setItem(
            'conversations',
            JSON.stringify(nextConversations),
          );
        } catch (err) {
          console.error('Failed to save voice in conversations:', err);
        }
      }
    },
    [activeChatId, conversations, setConversations, setTtsVoice],
  );

  const toggleReadAloud = useCallback(
    (index: number) => {
      if (activePlayerIndex === index) {
        stopAudioPlayback();
        setActivePlayerIndex(null);
      } else {
        stopAudioPlayback();
        setActivePlayerIndex(index);
      }
    },
    [activePlayerIndex, stopAudioPlayback],
  );

  return (
    <>
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
                        className={`text-[10px] font-medium uppercase tracking-wide mb-1 flex items-center gap-2 ${
                          isUser
                            ? 'text-sky-400 text-right justify-end'
                            : 'text-neutral-500 justify-start'
                        }`}
                      >
                        <span>{isUser ? 'You' : 'AI'}</span>
                        {!isUser &&
                          loading &&
                          index === messages.length - 1 && (
                            <span className="flex items-center gap-1 text-sky-400 font-semibold normal-case tracking-normal">
                              <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                              <span>
                                {msg.isProcessing
                                  ? `Processing message${msg.processingTime ? ` (${msg.processingTime}s)` : '...'}`
                                  : msg.isReasoning
                                    ? `Thinking${msg.thinkingTime ? ` (${msg.thinkingTime}s)` : '...'}`
                                    : 'Generating answer...'}
                              </span>
                            </span>
                          )}
                      </div>

                      <div
                        className={`break-words ${
                          isUser
                            ? 'bg-sky-900/80 text-sky-50 rounded-2xl rounded-tr-md px-4 py-3'
                            : 'text-neutral-200 px-1 py-2'
                        }`}
                      >
                        {/* PROCESSING STATE (WAITING FOR FIRST TOKEN / PREPARING) */}
                        {msg.isProcessing && !msg.reasoning && !msg.content && (
                          <div className="flex items-center gap-2 text-neutral-400 text-sm py-1">
                            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                            <span>
                              Processing message
                              {msg.processingDuration
                                ? ` ${msg.processingDuration}s`
                                : msg.processingTime
                                  ? ` ${msg.processingTime}s`
                                  : '...'}
                            </span>
                          </div>
                        )}

                        {/* INITIAL THINKING */}
                        {!msg.isProcessing &&
                          msg.isThinking &&
                          !msg.reasoning &&
                          !msg.content && (
                            <div className="flex items-center gap-2 text-neutral-400 text-sm py-1">
                              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
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
                                    remarkGfm,
                                    remarkMath,
                                    remarkBreaks,
                                  ]}
                                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                                  components={markdownComponents}
                                >
                                  {formatMarkdownContent(msg.reasoning)}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ANSWER */}

                        {/* ANIMATED LOADING ICON IN FRONT OF GENERATING ANSWERS */}
                        {!isUser &&
                          loading &&
                          index === messages.length - 1 &&
                          !msg.isReasoning && (
                            <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-2 py-1 px-2.5 bg-sky-950/40 border border-sky-800/50 rounded-md w-fit animate-pulse">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
                              <span>Generating answer...</span>
                            </div>
                          )}

                        {/* PLACEHOLDER WHILE WAITING FOR FIRST ANSWER TOKEN */}
                        {!isUser &&
                          loading &&
                          index === messages.length - 1 &&
                          !msg.isReasoning &&
                          !msg.content && (
                            <div className="flex items-center gap-2 text-neutral-400 text-xs py-2 px-3 bg-neutral-900/40 border border-neutral-800/60 rounded-lg mb-2">
                              <Loader2 className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
                              <span className="text-neutral-300">
                                Model is writing response...
                              </span>
                            </div>
                          )}

                        {msg.content &&
                          !msg.isError &&
                          !msg.content.startsWith('Error: ') &&
                          msg.content !==
                            'The model returned an empty response.' && (
                            <div className="prose prose-invert prose-sm max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-950 [&_pre]:p-3 [&_code]:text-sm [&_p]:my-1">
                              <ReactMarkdown
                                remarkPlugins={[
                                  remarkGfm,
                                  remarkMath,
                                  remarkBreaks,
                                ]}
                                rehypePlugins={[rehypeRaw, rehypeKatex]}
                                components={markdownComponents}
                              >
                                {formatMarkdownContent(msg.content)}
                              </ReactMarkdown>
                              {!isUser &&
                                loading &&
                                index === messages.length - 1 &&
                                !msg.isReasoning && (
                                  <span className="inline-flex items-center ml-1.5 align-middle text-sky-400">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  </span>
                                )}
                            </div>
                          )}

                        {!isUser &&
                          !loading &&
                          !msg.isError &&
                          msg.content &&
                          msg.totalDuration && (
                            <>
                              {activePlayerIndex === index ? (
                                <ReadAloudPlayer
                                  text={cleanMessageForSpeech(msg.content)}
                                  voice={ttsVoice}
                                  speed={ttsSpeed}
                                  onVoiceChange={handleVoiceChange}
                                  onSpeedChange={setTtsSpeed}
                                  onClose={() => setActivePlayerIndex(null)}
                                  audioPlaybackRef={audioPlaybackRef}
                                  readAloud={readAloud}
                                  stopAudioPlayback={stopAudioPlayback}
                                />
                              ) : (
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => toggleReadAloud(index)}
                                    className="inline-flex items-center gap-1.5 text-[10px] text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                                    title="Read this assistant response aloud"
                                    aria-label="Read this assistant response aloud"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>Read aloud</span>
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                        {/* PARTIAL CONTENT BEFORE ERROR (IF ANY) */}
                        {msg.isError && msg.content.includes('\n\nError: ') && (
                          <div className="prose prose-invert prose-sm max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-950 [&_pre]:p-3 [&_code]:text-sm [&_p]:my-1 mb-2 opacity-90">
                            <ReactMarkdown
                              remarkPlugins={[
                                remarkGfm,
                                remarkMath,
                                remarkBreaks,
                              ]}
                              rehypePlugins={[rehypeRaw, rehypeKatex]}
                              components={markdownComponents}
                            >
                              {formatMarkdownContent(
                                msg.content.split('\n\nError: ')[0],
                              )}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* ERROR CARD */}
                        {(msg.isError ||
                          msg.content.startsWith('Error: ') ||
                          msg.content ===
                            'The model returned an empty response.') && (
                          <div className="my-2 p-3.5 bg-red-950/40 border border-red-800/80 rounded-lg text-red-200 text-xs shadow-md">
                            <div className="flex items-center gap-2 font-semibold text-red-300 mb-1.5">
                              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                              <span>Server Error</span>
                            </div>
                            <p className="text-red-200/90 leading-relaxed mb-3 break-words whitespace-pre-wrap">
                              {msg.errorMessage ||
                                (msg.content.includes('\n\nError: ')
                                  ? msg.content.split('\n\nError: ')[1]
                                  : msg.content.startsWith('Error: ')
                                    ? msg.content.replace(/^Error:\s*/, '')
                                    : msg.content)}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleRetryMessage()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/70 hover:bg-red-800 border border-red-700 rounded text-red-100 text-xs font-medium transition cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Retry Message
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowLogs(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 text-xs transition cursor-pointer"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                                View Server Logs
                              </button>
                            </div>
                          </div>
                        )}

                        {/* METRICS */}

                        {(msg.tokensPerSecond ||
                          msg.ttft ||
                          msg.processingDuration ||
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

                            {msg.processingDuration && (
                              <span title="Initial Processing / Prompt Evaluation Time">
                                Proc: {msg.processingDuration}s
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
    </>
  );
}
