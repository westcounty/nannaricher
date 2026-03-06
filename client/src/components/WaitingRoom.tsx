import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { useGameStore } from '../stores/gameStore';
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
    } catch {
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

      <motion.div
        className="room-code-section"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <p className="room-code-label">房间码</p>
        <div className="room-code-display">
          <span className="room-code">{roomId}</span>
          <motion.button
            className="copy-button"
            onClick={handleCopyCode}
            title="复制房间码"
            whileTap={{ scale: 0.92 }}
          >
            {copied ? '已复制!' : '复制'}
          </motion.button>
        </div>
        <p className="share-hint">分享此房间码给好友加入</p>
      </motion.div>

      <div className="players-section">
        <h3>
          玩家 ({players.length}/6)
        </h3>
        <ul className="player-list">
          <AnimatePresence>
            {players.map((player, index) => (
              <motion.li
                key={player.id}
                className={`player-item ${player.id === playerId ? 'is-you' : ''}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06, duration: 0.3 }}
                layout
              >
                <span
                  className="player-color"
                  style={{ backgroundColor: player.color, boxShadow: `0 0 8px ${player.color}` }}
                />
                <span className="player-name">{player.name}</span>
                {player.id === playerId && <span className="you-badge">你</span>}
                {index === 0 && <span className="host-badge">房主</span>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {players.length < MIN_PLAYERS && (
        <p className="waiting-message">
          等待 {MIN_PLAYERS - players.length} 名玩家加入...
        </p>
      )}

      {error && (
        <motion.div
          className="error-message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.div>
      )}

      {isHost ? (
        <motion.button
          className="start-button"
          onClick={handleStartGame}
          disabled={isStarting || players.length < MIN_PLAYERS}
          whileHover={!isStarting && players.length >= MIN_PLAYERS ? { scale: 1.02 } : {}}
          whileTap={!isStarting && players.length >= MIN_PLAYERS ? { scale: 0.98 } : {}}
        >
          {isStarting ? '开始中...' : '开始游戏'}
        </motion.button>
      ) : (
        <p className="waiting-for-host">
          等待房主开始游戏...
        </p>
      )}

      <button
        className="leave-room-button"
        onClick={() => {
          if (!socket) return;
          socket.emit('room:leave');
          sessionStorage.removeItem('nannaricher_roomId');
          sessionStorage.removeItem('nannaricher_playerId');
          localStorage.removeItem('nannaricher_roomId');
          localStorage.removeItem('nannaricher_playerId');
          useGameStore.getState().resetToLobby();
        }}
      >
        离开房间
      </button>
    </div>
  );
}
