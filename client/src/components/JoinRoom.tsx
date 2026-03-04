import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';

interface JoinRoomProps {
  onRoomJoined: (roomId: string, playerId: string, playerName: string) => void;
  onBack: () => void;
}

export function JoinRoom({ onRoomJoined, onBack }: JoinRoomProps) {
  const { socket } = useSocket();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [diceOption, setDiceOption] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoomCode(value.slice(0, 6));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!socket) {
      setError('未连接到服务器');
      return;
    }

    if (!roomCode || roomCode.length !== 6) {
      setError('请输入有效的6位房间码');
      return;
    }

    if (!playerName.trim()) {
      setError('请输入你的名字');
      return;
    }

    setIsLoading(true);
    setError(null);

    socket.emit('room:join', {
      roomId: roomCode,
      playerName: playerName.trim(),
      diceOption,
    });

    const handleJoined = (data: { playerId: string }) => {
      socket.off('room:joined', handleJoined);
      socket.off('room:error', handleError);
      setIsLoading(false);
      onRoomJoined(roomCode, data.playerId, playerName.trim());
    };

    const handleError = (data: { message: string }) => {
      socket.off('room:joined', handleJoined);
      socket.off('room:error', handleError);
      setIsLoading(false);
      setError(data.message);
    };

    socket.on('room:joined', handleJoined);
    socket.on('room:error', handleError);
  };

  return (
    <div className="join-room">
      <button className="back-button" onClick={onBack}>
        &larr; 返回
      </button>

      <h2>加入房间</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="roomCode">房间码</label>
          <input
            id="roomCode"
            type="text"
            value={roomCode}
            onChange={handleRoomCodeChange}
            placeholder="请输入6位房间码"
            maxLength={6}
            className="room-code-input"
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="playerName">你的名字</label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="请输入你的名字"
            maxLength={20}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
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
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="submit-button"
          disabled={isLoading || !playerName.trim() || roomCode.length !== 6}
        >
          {isLoading ? '加入中...' : '加入房间'}
        </button>
      </form>
    </div>
  );
}
