import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateRoom } from './CreateRoom';
import { JoinRoom } from './JoinRoom';
import { WaitingRoom } from './WaitingRoom';
import { BattleHistory } from './BattleHistory';
import { useSocket } from '../context/SocketContext';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { Player } from '@nannaricher/shared';
import './Lobby.css';

type LobbyMode = 'select' | 'create' | 'join' | 'waiting' | 'history';

interface LobbyState {
  mode: LobbyMode;
  roomId: string | null;
  playerId: string | null;
  playerName: string | null;
  isHost: boolean;
  players: Player[];
}

const pageVariants = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -16, scale: 0.98 },
};

const pageTransition = {
  duration: 0.35,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export function Lobby() {
  const { socket } = useSocket();
  const gameState = useGameStore((s) => s.gameState);
  const contextRoomId = useGameStore((s) => s.roomId);
  const contextPlayerId = useGameStore((s) => s.playerId);
  const { getDisplayName, logout } = useAuthStore();

  const [state, setState] = useState<LobbyState>({
    mode: 'select',
    roomId: null,
    playerId: null,
    playerName: null,
    isHost: false,
    players: [],
  });

  // Sync with context when we get room info
  useEffect(() => {
    if (contextRoomId && contextPlayerId && state.mode !== 'waiting') {
      setState((prev) => ({
        ...prev,
        mode: 'waiting',
        roomId: contextRoomId,
        playerId: contextPlayerId,
      }));
    }
  }, [contextRoomId, contextPlayerId, state.mode]);

  // Update players list from game state
  useEffect(() => {
    if (gameState?.players) {
      setState((prev) => ({
        ...prev,
        players: gameState.players,
        // First player in the list is the host
        isHost: prev.playerId === gameState.players[0]?.id,
      }));
    }
  }, [gameState?.players, state.mode]);

  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoined = (data: { playerName: string }) => {
      console.log(`${data.playerName} joined the room`);
    };

    socket.on('room:player-joined', handlePlayerJoined);

    return () => {
      socket.off('room:player-joined', handlePlayerJoined);
    };
  }, [socket]);

  const handleCreateRoom = () => {
    setState({ ...state, mode: 'create' });
  };

  const handleJoinRoom = () => {
    setState({ ...state, mode: 'join' });
  };

  const handleBackToSelect = () => {
    setState({ ...state, mode: 'select' });
  };

  const handleRoomCreated = (roomId: string, playerId: string, playerName: string) => {
    setState((prev) => ({
      ...prev,
      mode: 'waiting',
      roomId,
      playerId,
      playerName,
      isHost: true,
      // Don't reset players — game:state-update may have already delivered them
    }));
  };

  const handleRoomJoined = (roomId: string, playerId: string, playerName: string) => {
    setState((prev) => ({
      ...prev,
      mode: 'waiting',
      roomId,
      playerId,
      playerName,
      isHost: false,
      // Don't reset players — game:state-update may have already delivered them
    }));
  };

  const handleGameStart = () => {
    console.log('Game starting...');
  };

  if (state.mode === 'history') {
    return <BattleHistory onBack={() => setState({ ...state, mode: 'select' })} />;
  }

  return (
    <div className="lobby">
      {/* User menu bar */}
      <motion.div
        className="lobby-user-bar"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <span className="user-display-name">{getDisplayName()}</span>
        <div className="user-actions">
          <button
            className="user-action-btn"
            onClick={() => setState({ ...state, mode: 'history' })}
          >
            战绩
          </button>
          <button className="user-action-btn user-logout" onClick={logout}>
            登出
          </button>
        </div>
      </motion.div>

      <motion.div
        className="lobby-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        <h1>菜根人生</h1>
        <p className="subtitle">南大版大富翁</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {state.mode === 'select' && (
          <motion.div
            key="select"
            className="lobby-select"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <div className="lobby-buttons">
              <motion.button
                className="lobby-button create"
                onClick={handleCreateRoom}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="button-icon">+</span>
                <span className="button-text">创建房间</span>
              </motion.button>
              <motion.button
                className="lobby-button join"
                onClick={handleJoinRoom}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="button-icon">▷</span>
                <span className="button-text">加入房间</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {state.mode === 'create' && (
          <motion.div
            key="create"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <CreateRoom
              onRoomCreated={handleRoomCreated}
              onBack={handleBackToSelect}
            />
          </motion.div>
        )}

        {state.mode === 'join' && (
          <motion.div
            key="join"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <JoinRoom
              onRoomJoined={handleRoomJoined}
              onBack={handleBackToSelect}
            />
          </motion.div>
        )}

        {state.mode === 'waiting' && state.roomId && state.playerId && state.playerName && (
          <motion.div
            key="waiting"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <WaitingRoom
              roomId={state.roomId}
              playerId={state.playerId}
              playerName={state.playerName}
              isHost={state.isHost}
              players={state.players}
              onGameStart={handleGameStart}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
