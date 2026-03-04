// client/src/hooks/useChat.ts
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useGameState } from '../context/GameContext';
import type { ChatMessage } from '../components/ChatPanel';

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (message: string) => void;
  isConnected: boolean;
}

export function useChat(): UseChatReturn {
  const { socket, isConnected } = useSocket();
  const { gameState } = useGameState();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Listen for chat messages from server
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data: { playerName: string; message: string }) => {
      // Find player info for color
      const player = gameState?.players.find((p) => p.name === data.playerName);
      const newMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        playerName: data.playerName,
        playerColor: player?.color || '#666666',
        text: data.message,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newMessage]);
    };

    socket.on('game:chat', handleChatMessage);

    return () => {
      socket.off('game:chat', handleChatMessage);
    };
  }, [socket, gameState?.players]);

  // Send message function
  const sendMessage = useCallback(
    (message: string) => {
      if (!socket || !message.trim()) return;
      socket.emit('game:chat', { message: message.trim() });
    },
    [socket]
  );

  return {
    messages,
    sendMessage,
    isConnected,
  };
}
