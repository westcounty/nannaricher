// client/src/components/GameScreen.tsx
import React from 'react';
import { useGameState } from '../context/GameContext';
import { StatusBar } from './StatusBar';
import { PlayerPanel } from './PlayerPanel';
import { CurrentPlayerPanel } from './CurrentPlayerPanel';
import '../styles/GameScreen.css';

export function GameScreen() {
  const { gameState, playerId } = useGameState();

  if (!gameState) {
    return <div className="game-screen loading">Loading game...</div>;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const otherPlayers = gameState.players.filter((p) => p.id !== playerId);
  const myPlayer = gameState.players.find((p) => p.id === playerId);

  return (
    <div className="game-screen">
      <StatusBar
        roomId={gameState.roomId}
        turnNumber={gameState.turnNumber}
        currentPlayerName={currentPlayer?.name}
        phase={gameState.phase}
      />

      <div className="game-main">
        <div className="board-area">
          {/* Canvas will be added in Task 13 */}
          <div className="board-placeholder">
            <div className="placeholder-content">
              <span className="placeholder-icon">🎮</span>
              <span className="placeholder-text">棋盘画布</span>
              <span className="placeholder-hint">Board Canvas</span>
            </div>
          </div>
        </div>

        <div className="side-panel">
          <div className="other-players">
            {otherPlayers.map((player) => (
              <PlayerPanel
                key={player.id}
                player={player}
                isCurrentTurn={player.id === currentPlayer?.id}
              />
            ))}
          </div>

          <CurrentPlayerPanel
            player={myPlayer}
            isMyTurn={isMyTurn}
            onRollDice={() => {
              // Will be connected to socket in later tasks
              console.log('Roll dice clicked');
            }}
          />
        </div>
      </div>

      <div className="bottom-bar">
        <div className="bottom-section hand-section">
          <span className="section-title">手牌</span>
          <div className="hand-cards">
            {myPlayer?.heldCards?.map((card) => (
              <div key={card.id} className="hand-card">
                {card.name}
              </div>
            )) || <span className="empty-hand">无手牌</span>}
          </div>
        </div>

        <div className="bottom-section chat-section">
          <span className="section-title">聊天</span>
          <div className="chat-placeholder">聊天功能即将推出</div>
        </div>

        <div className="bottom-section log-section">
          <span className="section-title">日志</span>
          <div className="game-log">
            {gameState.log.slice(-5).map((entry, index) => (
              <div key={index} className="log-entry">
                <span className="log-turn">[{entry.turn}]</span>
                <span className="log-message">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
