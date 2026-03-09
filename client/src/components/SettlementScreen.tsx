// client/src/components/SettlementScreen.tsx
// Full settlement screen shown when the game ends.
// Displays winner, all-player rankings, game stats, and navigation buttons.

import { useState } from 'react';
import { getRoundName, MAX_PLAYERS } from '@nannaricher/shared';
import type { GameState, Player, SpectatorInfo } from '@nannaricher/shared';
import type { WinnerInfo } from '../stores/gameStore';
import { useSocket } from '../context/SocketContext';
import '../styles/settlement.css';

interface SettlementScreenProps {
  winner: WinnerInfo;
  gameState: GameState;
  playerId: string | null;
  onReturnToLobby: () => void;
  readyPlayerIds: string[];
  isHost: boolean;
  spectators: SpectatorInfo[];
  isSpectator: boolean;
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

export function SettlementScreen({ winner, gameState, playerId, onReturnToLobby, readyPlayerIds, isHost, spectators, isSpectator }: SettlementScreenProps) {
  const { socket } = useSocket();
  const [visible, setVisible] = useState(true);

  // Derive ready state from server-synced readyPlayerIds (survives page refresh)
  const isReady = playerId ? readyPlayerIds.includes(playerId) : false;

  const handleReadyToggle = () => {
    if (!socket) return;
    if (isReady) {
      socket.emit('game:ready-cancel');
    } else {
      socket.emit('game:ready-up');
    }
  };

  const handleRestartWithReady = () => {
    if (!socket) return;
    socket.emit('game:restart-with-ready');
  };

  const readyCount = readyPlayerIds.length;
  const nonHostPlayers = gameState.players.filter(p => p.id !== gameState.players[0]?.id);

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

        {/* Ready-up section for new game */}
        <div className="settlement-ready">
          <div className="settlement-ready__title">新一局</div>
          <div className="settlement-ready__players">
            {nonHostPlayers.map(player => {
              const playerReady = player.isBot || readyPlayerIds.includes(player.id);
              return (
                <div key={player.id} className={`settlement-ready__player ${playerReady ? 'settlement-ready__player--ready' : ''}`}>
                  <span className="settlement-color-dot" style={{ backgroundColor: player.color }} />
                  <span className="settlement-ready__player-name">
                    {player.name}
                  </span>
                  <span className={`settlement-ready__status ${playerReady ? 'settlement-ready__status--ready' : ''}`}>
                    {playerReady ? '已准备' : '未准备'}
                  </span>
                  {isHost && (
                    <button
                      className="settlement-btn"
                      style={{ marginLeft: 8, padding: '2px 8px', fontSize: '11px' }}
                      onClick={() => socket?.emit('room:remove-player', { playerId: player.id })}
                    >
                      移除
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && gameState.players.length < MAX_PLAYERS && (
            <button
              className="settlement-btn settlement-btn--restart"
              style={{ marginBottom: 8, fontSize: '13px' }}
              onClick={() => socket?.emit('room:add-bot')}
            >
              🤖 添加机器人
            </button>
          )}

          <div className="settlement-ready__actions">
            {isSpectator ? (
              <button
                className={`settlement-btn ${isReady ? 'settlement-btn--ready-cancel' : 'settlement-btn--ready'}`}
                onClick={() => {
                  if (!socket) return;
                  if (isReady) {
                    socket.emit('room:spectator-cancel-ready');
                  } else {
                    socket.emit('room:spectator-ready');
                  }
                }}
              >
                {isReady ? '取消准备' : '准备加入'}
              </button>
            ) : isHost ? (
              <button
                className="settlement-btn settlement-btn--restart"
                onClick={handleRestartWithReady}
                disabled={readyCount === 0}
              >
                重开游戏 ({readyCount}人准备)
              </button>
            ) : (
              <button
                className={`settlement-btn ${isReady ? 'settlement-btn--ready-cancel' : 'settlement-btn--ready'}`}
                onClick={handleReadyToggle}
              >
                {isReady ? '取消准备' : '准备新一局'}
              </button>
            )}
          </div>

          {spectators.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: 4 }}>观战中</div>
              {spectators.map((s, i) => (
                <span key={i} style={{ fontSize: '13px', color: '#cbd5e1', marginRight: 8 }}>{s.name}</span>
              ))}
            </div>
          )}
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
