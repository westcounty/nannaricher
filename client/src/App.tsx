import { lazy, Suspense } from 'react';
import { AccessibilityProvider } from './a11y/AccessibilityProvider';
import { SocketProvider } from './context/SocketContext';
import { ZustandBridge } from './context/SocketProvider';
import { useGameStore } from './stores/gameStore';
import { ResponsiveProvider } from './ui/layouts/ResponsiveLayout';
import { Lobby } from './components';
import { LoadingScreen } from './components/LoadingScreen';
import './App.css';

// Lazy-load GameScreen — it pulls in pixi.js, framer-motion, and heavy game UI
const LazyGameScreen = lazy(() =>
  import('./components/GameScreen').then(m => ({ default: m.GameScreen }))
);

function GameScreenFallback() {
  return <LoadingScreen type="loading" />;
}

function GameRouter() {
  const gameState = useGameStore((s) => s.gameState);
  const isLoading = useGameStore((s) => s.isLoading);
  const roomId = useGameStore((s) => s.roomId);

  // Show loading screen while connecting
  if (isLoading) {
    return <LoadingScreen type="connecting" />;
  }

  // If we have game state with phase 'playing', 'setup_plans', or 'finished', show the game screen
  // 'finished' keeps the game screen visible so players can view the settlement screen
  if (gameState && (gameState.phase === 'playing' || gameState.phase === 'setup_plans' || gameState.phase === 'finished')) {
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
    <AccessibilityProvider>
      <SocketProvider>
        <ZustandBridge>
          <ResponsiveProvider>
            <div className="app">
              <GameRouter />
            </div>
          </ResponsiveProvider>
        </ZustandBridge>
      </SocketProvider>
    </AccessibilityProvider>
  );
}
