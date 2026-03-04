import { useGameStore } from '../stores/gameStore';

/**
 * Hook to access the current game state.
 * Now backed by Zustand store instead of GameContext.
 * @returns Object containing game state, room ID, player ID, and loading status
 */
export function useGameState() {
  const gameState = useGameStore((s) => s.gameState);
  const roomId = useGameStore((s) => s.roomId);
  const playerId = useGameStore((s) => s.playerId);
  const isLoading = useGameStore((s) => s.isLoading);

  return {
    gameState,
    roomId,
    playerId,
    isLoading,
  };
}
