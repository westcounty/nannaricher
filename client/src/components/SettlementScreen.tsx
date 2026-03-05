// client/src/components/SettlementScreen.tsx
// Full settlement screen shown when the game ends.
// Displays winner, all-player rankings, game stats, and navigation buttons.

import { useState } from 'react';
import { getRoundName } from '@nannaricher/shared';
import type { GameState, Player } from '@nannaricher/shared';
import type { WinnerInfo } from '../stores/gameStore';
import '../styles/settlement.css';

interface SettlementScreenProps {
  winner: WinnerInfo;
  gameState: GameState;
  playerId: string | null;
  onReturnToLobby: () => void;
}

/** Compute a composite score for ranking (winner excluded from sorting — always first). */
function computeScore(player: Player): number {
  return player.gpa * 10 + player.exploration;
}

/** Sort players: winner first, then by composite score descending. */
function rankPlayers(players: Player[], winnerId: string): Player[] {
  const sorted = [...players].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    return computeScore(b) - computeScore(a);
  });
  return sorted;
}

export function SettlementScreen({ winner, gameState, playerId, onReturnToLobby }: SettlementScreenProps) {
  const [visible, setVisible] = useState(true);

  const ranked = rankPlayers(gameState.players, winner.playerId);

  const dismiss = () => setVisible(false);
  const reopen = () => setVisible(true);

  if (!visible) {
    return (
      <button className="settlement-reopen-btn" onClick={reopen}>
        查看结算
      </button>
    );
  }

  return (
    <div className="settlement-overlay">
      <div className="settlement-container">
        {/* Title */}
        <h1 className="settlement-title">游戏结束</h1>

        {/* Winner highlight */}
        <div className="settlement-winner">
          <div className="settlement-winner__label">WINNER</div>
          <div className="settlement-winner__name">{winner.playerName}</div>
          <div className="settlement-winner__condition">{winner.condition}</div>
        </div>

        {/* Rankings table */}
        <div className="settlement-rankings">
          <div className="settlement-rankings__title">全部玩家排名</div>
          <table className="settlement-rankings__table">
            <thead>
              <tr className="settlement-rankings__header">
                <th>#</th>
                <th>玩家</th>
                <th>金钱</th>
                <th>GPA</th>
                <th>探索</th>
                <th>手牌</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((player, idx) => {
                const isWinner = player.id === winner.playerId;
                const isLocal = player.id === playerId;
                const rowClasses = [
                  'settlement-rankings__row',
                  isWinner ? 'settlement-rankings__row--winner' : '',
                  isLocal ? 'settlement-rankings__row--local' : '',
                ].filter(Boolean).join(' ');

                const rankNum = idx + 1;
                const rankClass = rankNum <= 3
                  ? `settlement-rank settlement-rank--${rankNum}`
                  : 'settlement-rank';

                return (
                  <tr key={player.id} className={rowClasses}>
                    <td className={rankClass}>{rankNum}</td>
                    <td>
                      <div className="settlement-player-cell">
                        <span
                          className="settlement-color-dot"
                          style={{ backgroundColor: player.color }}
                        />
                        <span className="settlement-player-name">
                          {player.name}
                          {isLocal ? ' (你)' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="settlement-stat">{player.money}</td>
                    <td className="settlement-stat">{player.gpa.toFixed(1)}</td>
                    <td className="settlement-stat">{player.exploration}</td>
                    <td className="settlement-stat">{player.heldCards.length}</td>
                    <td>
                      <div className="settlement-badges">
                        {isWinner && (
                          <span className="settlement-badge settlement-badge--winner">MVP</span>
                        )}
                        {player.isBankrupt && (
                          <span className="settlement-badge settlement-badge--bankrupt">破产</span>
                        )}
                        {player.isInHospital && (
                          <span className="settlement-badge settlement-badge--hospital">住院</span>
                        )}
                        {player.majorPlan && (
                          <span className="settlement-badge" style={{ background: '#2196F3', color: 'white', fontSize: '10px' }}>
                            主修: {player.trainingPlans.find(p => p.id === player.majorPlan)?.name || ''}
                          </span>
                        )}
                        {player.minorPlans.map(id => (
                          <span key={id} className="settlement-badge" style={{ background: '#9E9E9E', color: 'white', fontSize: '10px' }}>
                            辅修: {player.trainingPlans.find(p => p.id === id)?.name || ''}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Game stats footer */}
        <div className="settlement-footer">
          {getRoundName(gameState.roundNumber)} · 共 {gameState.turnNumber} 回合
        </div>

        {/* Action buttons */}
        <div className="settlement-actions">
          <button className="settlement-btn settlement-btn--primary" onClick={onReturnToLobby}>
            返回大厅
          </button>
          <button className="settlement-btn settlement-btn--secondary" onClick={dismiss}>
            查看棋盘
          </button>
        </div>
      </div>
    </div>
  );
}
