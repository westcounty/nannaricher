import { useState, useEffect } from 'react';
import { CreateRoom } from './CreateRoom';
import { JoinRoom } from './JoinRoom';
import { WaitingRoom } from './WaitingRoom';
import { useSocket } from '../context/SocketContext';
import { useGameStore } from '../stores/gameStore';
import { Player } from '@nannaricher/shared';
import './Lobby.css';

type LobbyMode = 'select' | 'create' | 'join' | 'waiting';

interface LobbyState {
  mode: LobbyMode;
  roomId: string | null;
  playerId: string | null;
  playerName: string | null;
  isHost: boolean;
  players: Player[];
}

export function Lobby() {
  const { socket } = useSocket();
  const gameState = useGameStore((s) => s.gameState);
  const contextRoomId = useGameStore((s) => s.roomId);
  const contextPlayerId = useGameStore((s) => s.playerId);

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
  }, [gameState?.players]);

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
    setState({
      mode: 'waiting',
      roomId,
      playerId,
      playerName,
      isHost: true,
      players: [],
    });
  };

  const handleRoomJoined = (roomId: string, playerId: string, playerName: string) => {
    setState({
      mode: 'waiting',
      roomId,
      playerId,
      playerName,
      isHost: false,
      players: [],
    });
  };

  const handleGameStart = () => {
    // The parent component (App) handles transitioning to the game screen
    // via the gameState.phase change detected in GameRouter
    console.log('Game starting...');
  };

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1>菜根人生</h1>
        <p className="subtitle">南大版大富翁</p>
      </div>

      {state.mode === 'select' && (
        <div className="lobby-select">
          <div className="lobby-buttons">
            <button className="lobby-button create" onClick={handleCreateRoom}>
              <span className="button-icon">+</span>
              <span className="button-text">创建房间</span>
            </button>
            <button className="lobby-button join" onClick={handleJoinRoom}>
              <span className="button-icon">&#916;</span>
              <span className="button-text">加入房间</span>
            </button>
          </div>
        </div>
      )}

      {state.mode === 'create' && (
        <CreateRoom
          onRoomCreated={handleRoomCreated}
          onBack={handleBackToSelect}
        />
      )}

      {state.mode === 'join' && (
        <JoinRoom
          onRoomJoined={handleRoomJoined}
          onBack={handleBackToSelect}
        />
      )}

      {state.mode === 'waiting' && state.roomId && state.playerId && state.playerName && (
        <WaitingRoom
          roomId={state.roomId}
          playerId={state.playerId}
          playerName={state.playerName}
          isHost={state.isHost}
          players={state.players}
          onGameStart={handleGameStart}
        />
      )}
    </div>
  );
}
