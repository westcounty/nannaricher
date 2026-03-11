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
  /** When true, skip the collapsible header and always show messages + input */
  alwaysExpanded?: boolean;
}

export function ChatPanel({ messages, onSend, alwaysExpanded }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [chatCollapsed, setChatCollapsed] = useState(true);
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

  const isExpanded = alwaysExpanded || !chatCollapsed;

  return (
    <div className={`chat-panel ${isExpanded ? '' : 'chat-panel--collapsed'}`}>
      {!alwaysExpanded && (
        <div
          className="chat-header chat-header--clickable"
          onClick={() => setChatCollapsed((prev) => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setChatCollapsed((prev) => !prev); }}
        >
          <h3>{chatCollapsed ? `\uD83D\uDCAC 聊天 (${messages.length}条)` : '聊天'}</h3>
          <span className="chat-collapse-indicator">{chatCollapsed ? '\u25B2' : '\u25BC'}</span>
        </div>
      )}

      {isExpanded && (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <span className="empty-icon">{'\uD83D\uDCAC'}</span>
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
        </>
      )}
    </div>
  );
}
