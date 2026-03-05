import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { useAuthStore } from '../stores/authStore';

interface CreateRoomProps {
  onRoomCreated: (roomId: string, playerId: string, playerName: string) => void;
  onBack: () => void;
}

export function CreateRoom({ onRoomCreated, onBack }: CreateRoomProps) {
  const { socket } = useSocket();
  const { getDisplayName } = useAuthStore();
  const [playerName, setPlayerName] = useState(getDisplayName());
  const [diceOption, setDiceOption] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!socket) {
      setError('未连接到服务器');
      return;
    }

    if (!playerName.trim()) {
      setError('请输入你的名字');
      return;
    }

    setIsLoading(true);
    setError(null);

    socket.emit('room:create', {
      playerName: playerName.trim(),
      diceOption,
    });

    const handleCreated = (data: { roomId: string; playerId: string }) => {
      socket.off('room:created', handleCreated);
      socket.off('room:error', handleError);
      setIsLoading(false);
      onRoomCreated(data.roomId, data.playerId, playerName.trim());
    };

    const handleError = (data: { message: string }) => {
      socket.off('room:created', handleCreated);
      socket.off('room:error', handleError);
      setIsLoading(false);
      setError(data.message);
    };

    socket.on('room:created', handleCreated);
    socket.on('room:error', handleError);
  };

  return (
    <div className="create-room">
      <button className="back-button" onClick={onBack}>
        ← 返回
      </button>

      <h2>创建房间</h2>

      <form onSubmit={handleSubmit}>
        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <label htmlFor="playerName">你的名字</label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="请输入你的名字"
            maxLength={20}
            disabled={isLoading}
            autoFocus
          />
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <label>骰子选项</label>
          <div className="dice-options">
            <button
              type="button"
              className={`dice-option ${diceOption === 1 ? 'selected' : ''}`}
              onClick={() => setDiceOption(1)}
              disabled={isLoading}
            >
              <span className="dice-icon">⚀</span>
              <span className="dice-label">1个骰子</span>
              <span className="dice-hint">初始资金 $3000</span>
            </button>
            <button
              type="button"
              className={`dice-option ${diceOption === 2 ? 'selected' : ''}`}
              onClick={() => setDiceOption(2)}
              disabled={isLoading}
            >
              <span className="dice-icon">⚁⚂</span>
              <span className="dice-label">2个骰子</span>
              <span className="dice-hint">初始资金 $2000</span>
            </button>
          </div>
        </motion.div>

        {error && (
          <motion.div
            className="error-message"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            {error}
          </motion.div>
        )}

        <motion.button
          type="submit"
          className="submit-button"
          disabled={isLoading || !playerName.trim()}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          whileHover={!isLoading && playerName.trim() ? { scale: 1.02 } : {}}
          whileTap={!isLoading && playerName.trim() ? { scale: 0.98 } : {}}
        >
          {isLoading ? '创建中...' : '创建房间'}
        </motion.button>
      </form>
    </div>
  );
}
