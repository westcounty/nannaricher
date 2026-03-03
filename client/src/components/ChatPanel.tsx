// client/src/components/ChatPanel.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export interface ChatMessage {
  id: string;
  playerName: string;
  playerColor: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend?: (message: string) => void;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Use socket directly if no onSend callback provided
    if (onSend) {
      onSend(input.trim());
    } else if (socket) {
      socket.emit('game:chat', { message: input.trim() });
    }
    setInput('');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>聊天</h3>
        <span className="message-count">{messages.length} 条消息</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-icon">💬</span>
            <span className="empty-text">暂无消息，发送第一条消息吧！</span>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <span className="message-time">{formatTime(msg.timestamp)}</span>
              <span
                className="message-author"
                style={{ color: msg.playerColor }}
              >
                {msg.playerName}
              </span>
              <span className="message-colon">:</span>
              <span className="message-text">{msg.text}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="发送消息..."
          maxLength={200}
        />
        <button
          type="submit"
          className="chat-send-button"
          disabled={!input.trim()}
        >
          发送
        </button>
      </form>
    </div>
  );
}
