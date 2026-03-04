import { lazy, Suspense } from 'react';
import { SocketProvider } from './context/SocketContext';
import { GameProvider, useGameState } from './context/GameContext';
import { ResponsiveProvider } from './ui/layouts/ResponsiveLayout';
import { Lobby } from './components';
import './App.css';

// Lazy-load GameScreen — it pulls in pixi.js, framer-motion, and heavy game UI
const LazyGameScreen = lazy(() =>
  import('./components/GameScreen').then(m => ({ default: m.GameScreen }))
);

function GameScreenFallback() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Loading game...</p>
    </div>
  );
}

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
    return (
      <Suspense fallback={<GameScreenFallback />}>
        <LazyGameScreen />
      </Suspense>
    );
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
        <ResponsiveProvider>
          <div className="app">
            <GameRouter />
          </div>
        </ResponsiveProvider>
      </GameProvider>
    </SocketProvider>
  );
}
