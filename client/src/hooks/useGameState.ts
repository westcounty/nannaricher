import { useGameState as useGameStateContext } from '../context/GameContext';

/**
 * Hook to access the current game state
 * @returns Object containing game state, room ID, player ID, and loading status
 */
export function useGameState() {
  const { gameState, roomId, playerId, isLoading } = useGameStateContext();

  return {
    gameState,
    roomId,
    playerId,
    isLoading,
  };
}
