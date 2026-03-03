import { SocketProvider } from './context/SocketContext';
import { GameProvider, useGameState } from './context/GameContext';
import { Lobby, GameScreen } from './components';
import './App.css';

function GameRouter() {
  const { gameState, isLoading, roomId } = useGameState();

  // Show loading screen while connecting
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Connecting...</p>
      </div>
    );
  }

  // If we have game state with phase 'playing' or 'setup_plans', show the game screen
  if (gameState && (gameState.phase === 'playing' || gameState.phase === 'setup_plans')) {
    return <GameScreen />;
  }

  // If we have a roomId but no game state yet (waiting room)
  if (roomId && gameState?.phase === 'waiting') {
    // The Lobby component will handle the waiting room state
    return <Lobby />;
  }

  // Default: show lobby (create/join options)
  return <Lobby />;
}

export default function App() {
  return (
    <SocketProvider>
      <GameProvider>
        <div className="app">
          <GameRouter />
        </div>
      </GameProvider>
    </SocketProvider>
  );
}
