'use client';
/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useMemo } from 'react';
import type { Conversation, Message } from '../types/chat';
import { hasThinkTags, parseThinkContent } from '../utils/chat';
import type { ChatRefs, Store } from './chatHookTypes';

const normalizeMessages = (messages: Message[]): Message[] =>
  messages.map((message) => {
    if (
      message.role === 'assistant' &&
      !message.reasoning &&
      hasThinkTags(message.content)
    ) {
      const parsed = parseThinkContent(message.content);
      return {
        ...message,
        content: parsed.answer,
        reasoning: parsed.reasoning,
        isReasoning: false,
      };
    }
    return message;
  });

export function useChatHistoryActions(
  store: Store,
  refs: ChatRefs,
  scrollToBottom: (smooth?: boolean) => void,
) {
  const {
    conversations,
    activeChatId,
    searchQuery,
    conversationToDelete,
    conversationToPermanentlyDelete,
    setConversations,
    setActiveChatId,
    setMessages,
    setShowMobileSidebar,
    setShowScrollBottom,
    setConversationToDelete,
    setConversationToPermanentlyDelete,
    setPrompt,
    setTtsVoice,
    setTtsSpeed,
  } = store;
  useEffect(() => {
    refs.activeChatIdRef.current = activeChatId;
    try {
      const stored = localStorage.getItem('conversations');
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed))
          setConversations(
            (parsed as Conversation[]).map((conversation) => ({
              ...conversation,
              messages: normalizeMessages(conversation.messages || []),
            })),
          );
      }
      const savedVoice = localStorage.getItem('last_tts_voice');
      if (savedVoice) {
        setTtsVoice(savedVoice);
      }
      const savedSpeed = localStorage.getItem('last_tts_speed');
      if (savedSpeed) {
        const parsedSpeed = parseFloat(savedSpeed);
        if (!isNaN(parsedSpeed) && parsedSpeed > 0) {
          setTtsSpeed(parsedSpeed);
        }
      }
    } catch (error) {
      console.error('Failed to load conversations from localStorage:', error);
    }
  }, [
    activeChatId,
    refs.activeChatIdRef,
    setConversations,
    setTtsVoice,
    setTtsSpeed,
  ]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveChatId(null);
    refs.activeChatIdRef.current = null;
    setShowMobileSidebar(false);
    refs.autoScrollEnabled.current = true;
    setShowScrollBottom(false);
  }, [
    refs,
    setActiveChatId,
    setMessages,
    setShowMobileSidebar,
    setShowScrollBottom,
  ]);
  const handleSelectConversation = useCallback(
    (conversation: Conversation) => {
      setActiveChatId(conversation.id);
      refs.activeChatIdRef.current = conversation.id;
      setMessages(normalizeMessages(conversation.messages || []));
      if (conversation.voice) {
        setTtsVoice(conversation.voice);
      }
      if (conversation.speed) {
        setTtsSpeed(conversation.speed);
      }
      setShowMobileSidebar(false);
      refs.autoScrollEnabled.current = true;
      setShowScrollBottom(false);
      requestAnimationFrame(() => scrollToBottom(false));
    },
    [
      refs,
      scrollToBottom,
      setActiveChatId,
      setMessages,
      setShowMobileSidebar,
      setShowScrollBottom,
      setTtsVoice,
      setTtsSpeed,
    ],
  );
  const updateStored = useCallback(
    (next: Conversation[]) => {
      setConversations(next);
      try {
        localStorage.setItem('conversations', JSON.stringify(next));
      } catch (error) {
        console.error('Failed to persist conversations:', error);
      }
    },
    [setConversations],
  );
  const confirmMoveToTrash = useCallback(() => {
    if (!conversationToDelete) return;
    const next = conversations.map((conversation) =>
      conversation.id === conversationToDelete.id
        ? { ...conversation, status: 'trash' as const, updatedAt: Date.now() }
        : conversation,
    );
    updateStored(next);
    if (activeChatId === conversationToDelete.id) {
      setActiveChatId(null);
      refs.activeChatIdRef.current = null;
      setMessages([]);
    }
    setConversationToDelete(null);
  }, [
    activeChatId,
    conversationToDelete,
    conversations,
    refs,
    setActiveChatId,
    setConversationToDelete,
    setMessages,
    updateStored,
  ]);
  const handleRestore = useCallback(
    (id: string) =>
      updateStored(
        conversations.map((conversation) =>
          conversation.id === id
            ? {
                ...conversation,
                status: 'active' as const,
                updatedAt: Date.now(),
              }
            : conversation,
        ),
      ),
    [conversations, updateStored],
  );
  const confirmPermanentDelete = useCallback(() => {
    if (!conversationToPermanentlyDelete) return;
    const next = conversations.filter(
      (conversation) => conversation.id !== conversationToPermanentlyDelete.id,
    );
    updateStored(next);
    if (activeChatId === conversationToPermanentlyDelete.id) {
      setActiveChatId(null);
      refs.activeChatIdRef.current = null;
      setMessages([]);
    }
    setConversationToPermanentlyDelete(null);
  }, [
    activeChatId,
    conversationToPermanentlyDelete,
    conversations,
    refs,
    setActiveChatId,
    setConversationToPermanentlyDelete,
    setMessages,
    updateStored,
  ]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const activeConversations = useMemo(
    () =>
      conversations
        .filter(
          (conversation) =>
            conversation.status === 'active' &&
            (!normalizedQuery ||
              conversation.title.toLowerCase().includes(normalizedQuery) ||
              conversation.messages.some((message) =>
                message.content.toLowerCase().includes(normalizedQuery),
              )),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, normalizedQuery],
  );
  const trashConversations = useMemo(
    () =>
      conversations
        .filter((conversation) => conversation.status === 'trash')
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );
  const handleRetryMessage = useCallback(
    (textToRetry?: string) => {
      if (textToRetry) {
        setPrompt(textToRetry);
        setTimeout(
          () => document.getElementById('chat-submit-btn')?.click(),
          50,
        );
        return;
      }
      setMessages((previous) => {
        const index = [...previous]
          .reverse()
          .findIndex((message) => message.role === 'user');
        if (index < 0) return previous;
        const actual = previous.length - 1 - index;
        setPrompt(
          previous[actual].content.replace(/\n\n\[Attached: .*\]$/, ''),
        );
        return previous.slice(0, actual);
      });
    },
    [setMessages, setPrompt],
  );
  const toggleThinking = useCallback(
    (index: number) =>
      setMessages((previous) =>
        previous.map((message, messageIndex) =>
          messageIndex === index
            ? { ...message, isThinkingExpanded: !message.isThinkingExpanded }
            : message,
        ),
      ),
    [setMessages],
  );
  return {
    handleNewChat,
    handleSelectConversation,
    confirmMoveToTrash,
    handleRestore,
    confirmPermanentDelete,
    normalizedQuery,
    activeConversations,
    trashConversations,
    handleRetryMessage,
    toggleThinking,
  };
}
