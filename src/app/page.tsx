import { ChatProvider } from '../contexts/ChatContext';
import { MainLayout } from './components/chat/MainLayout';

export default function ChatPage() {
  return (
    <ChatProvider>
      <MainLayout />
    </ChatProvider>
  );
}
