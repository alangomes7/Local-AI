content = '''import { useRef } from 'react';

export function useChatRefs() {
  const connectToServerRef = useRef<(isManual?: boolean) => Promise<void>>(() => Promise.resolve());
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabled = useRef(true);

  return {
    connectToServerRef,
    audioPlaybackRef,
    fileInputRef,
    abortControllerRef,
    textareaRef,
    activeChatIdRef,
    mediaRecorderRef,
    audioChunksRef,
    recordingTimerRef,
    scrollContainerRef,
    autoScrollEnabled
  };
}

export type ChatRefs = ReturnType<typeof useChatRefs>;
'''

with open('src/hooks/useChatRefs.ts', 'w', encoding='utf-8') as f:
    f.write(content)
