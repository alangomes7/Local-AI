"use client";
import React, { createContext, useContext } from 'react';
import { useChatLogic } from '../hooks/useChatLogic';

export type ChatContextType = ReturnType<typeof useChatLogic>;
const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const chat = useChatLogic();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
};

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
};

