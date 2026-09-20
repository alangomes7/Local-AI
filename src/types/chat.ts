export type ToastNotification = {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  isProcessing?: boolean;
  processingTime?: number;
  processingDuration?: string;
  isReasoning?: boolean;
  isThinking?: boolean;
  isThinkingExpanded?: boolean;
  thinkingTime?: number;
  tokensPerSecond?: string;
  ttft?: string;
  totalDuration?: string;
  thinkingDuration?: string;
  responseDuration?: string;
  isError?: boolean;
  errorMessage?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  status: 'active' | 'trash';
  voice?: string;
  speed?: number;
};

export type VoiceChatState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'synthesizing'
  | 'playing'
  | 'error';

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

export type ModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

export type ChatDelta = {
  content?: string;
  reasoning_content?: string;
  reasoning?: string;
  thinking?: string;
};

export type SSEPayload = {
  choices?: Array<{
    delta?: ChatDelta;
    text?: string;
  }>;
};

// ============================================================
// Thinking & Reasoning Tags Parser
// ============================================================
