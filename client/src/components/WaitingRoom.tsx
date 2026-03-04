import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Player, MIN_PLAYERS } from '@nannaricher/shared';

interface WaitingRoomProps {
  roomId: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
  players: Player[];
  onGameStart: () => void;
}

export function WaitingRoom({
  roomId,
  playerId,
  playerName: _playerName,
  isHost,
  players,
  onGameStart: _onGameStart,
}: WaitingRoomProps) {
  const { socket } = useSocket();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleError = (data: { message: string }) => {
      setError(data.message);
      setIsStarting(false);
    };

    socket.on('room:error', handleError);
    return () => {
      socket.off('room:error', handleError);
    };
  }, [socket]);

  const handleStartGame = () => {
    if (!socket) return;

    if (players.length < MIN_PLAYERS) {
      setError(`至少需要 ${MIN_PLAYERS} 名玩家才能开始`);
      return;
    }

    setIsStarting(true);
    setError(null);
    socket.emit('game:start');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="waiting-room">
      <h2>等待室</h2>

      <div className="room-code-section">
        <p className="room-code-label">房间码</p>
        <div className="room-code-display">
          <span className="room-code">{roomId}</span>
          <button
            className="copy-button"
            onClick={handleCopyCode}
            title="复制房间码"
          >
            {copied ? '已复制!' : '复制'}
          </button>
        </div>
        <p className="share-hint">分享此房间码给好友加入</p>
      </div>

      <div className="players-section">
        <h3>
          玩家 ({players.length}/6)
        </h3>
        <ul className="player-list">
          {players.map((player, index) => (
            <li
              key={player.id}
              className={`player-item ${player.id === playerId ? 'is-you' : ''}`}
            >
              <span
                className="player-color"
                style={{ backgroundColor: player.color }}
              />
              <span className="player-name">{player.name}</span>
              {player.id === playerId && <span className="you-badge">你</span>}
              {index === 0 && <span className="host-badge">房主</span>}
            </li>
          ))}
        </ul>
      </div>

      {players.length < MIN_PLAYERS && (
        <p className="waiting-message">
          等待 {MIN_PLAYERS - players.length} 名玩家加入...
        </p>
      )}

      {error && <div className="error-message">{error}</div>}

      {isHost ? (
        <button
          className="start-button"
          onClick={handleStartGame}
          disabled={isStarting || players.length < MIN_PLAYERS}
        >
          {isStarting ? '开始中...' : '开始游戏'}
        </button>
      ) : (
        <p className="waiting-for-host">
          等待房主开始游戏...
        </p>
      )}
    </div>
  );
}
