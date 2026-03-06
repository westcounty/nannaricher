// client/src/components/CurrentPlayerPanel.tsx
import type { Player } from '@nannaricher/shared';
import { useGameStore } from '../stores/gameStore';
import { getPlayerPlanIds } from '@nannaricher/shared';
import { boardData } from '../data/board';
import { describeEffect } from '../utils/effectDescriptions';

interface CurrentPlayerPanelProps {
  player: Player | undefined;
  isMyTurn: boolean;
}

export function CurrentPlayerPanel({
  player,
  isMyTurn,
}: CurrentPlayerPanelProps) {
  const isRolling = useGameStore((s) => s.isRolling);
  const diceResult = useGameStore((s) => s.diceResult);
  const gameState = useGameStore((s) => s.gameState);
  const socketActions = useGameStore((s) => s.socketActions);
  const rollDice = socketActions?.rollDice ?? (() => {});

  if (!player) {
    return (
      <div className="current-player-panel">
        <div className="panel-loading">加载中...</div>
      </div>
    );
  }

  const getPositionText = () => {
    if (player.position.type === 'main') {
      const cell = boardData.mainBoard[player.position.index];
      return cell?.name || `主路 ${player.position.index}`;
    }
    const line = boardData.lines[player.position.lineId];
    const cell = line?.cells[player.position.index];
    const lineName = line?.name?.split(' - ')[0] || player.position.lineId;
    return cell?.name ? `${lineName} · ${cell.name}` : `${lineName} 第${player.position.index + 1}格`;
  };

  const currentPlanIds = getPlayerPlanIds(player);

  // Determine if player can roll dice
  const canRollDice = isMyTurn &&
    !player.isBankrupt &&
    !isRolling &&
    gameState?.phase === 'playing' &&
    (!gameState?.pendingAction || gameState?.pendingAction?.type === 'roll_dice');

  // For hospital/ding, player still needs to roll
  const needsToRoll = player.isInHospital || player.isAtDing;

  const handleRollDice = () => {
    if (canRollDice || (isMyTurn && needsToRoll)) {
      rollDice();
    }
  };

  // Get roll button text
  const getRollButtonText = () => {
    if (isRolling) return '🎲 掷骰子中...';
    if (player.isInHospital) return '🎲 投骰子出院';
    if (player.isAtDing) return '🎲 投骰子移动';
    return '🎲 掷骰子';
  };

  return (
    <div className={`current-player-panel ${isMyTurn ? 'my-turn' : ''}`}>
      <div className="panel-header">
        <div
          className="player-color-indicator"
          style={{ backgroundColor: player.color }}
        />
        <span className="player-name">{player.name}</span>
        {isMyTurn && <span className="your-turn-badge">你的回合</span>}
      </div>

      <div className="player-stats-detailed">
        <div className="stat-group">
          <div className="stat-item">
            <span className="stat-icon">💰</span>
            <span className="stat-label">金钱</span>
            <span className={`stat-value ${player.money < 100 ? 'low' : ''}`}>
              ${player.money}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">📚</span>
            <span className="stat-label">GPA</span>
            <span className="stat-value">{player.gpa.toFixed(1)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">🗺️</span>
            <span className="stat-label">探索</span>
            <span className="stat-value">{player.exploration}</span>
          </div>
        </div>

        <div className="stat-extra">
          <div className="extra-item">
            <span className="extra-label">骰子:</span>
            <span className="extra-value">{player.diceCount}个</span>
          </div>
          <div className="extra-item">
            <span className="extra-label">位置:</span>
            <span className="extra-value">{getPositionText()}</span>
          </div>
        </div>
      </div>

      {player.trainingPlans.length > 0 && (
        <div className="training-plans-section">
          <h4>培养计划 ({currentPlanIds.length}/{player.planSlotLimit})</h4>
          <div className="plans-list">
            {player.trainingPlans.map((plan) => {
              const isMajor = plan.id === player.majorPlan;
              const isMinor = player.minorPlans.includes(plan.id);
              return (
                <div
                  key={plan.id}
                  className={`plan-item ${isMajor ? 'confirmed' : isMinor ? 'confirmed' : ''}`}
                  style={{
                    opacity: (isMajor || isMinor) ? 1 : 0.6,
                    borderLeft: isMajor ? '3px solid #2196F3' : isMinor ? '3px solid #9E9E9E' : undefined,
                  }}
                >
                  <div className="plan-header">
                    <span className="plan-name">{plan.name}</span>
                    {isMajor && <span className="confirmed-badge" style={{ background: '#2196F3', color: 'white' }}>主修</span>}
                    {isMinor && <span className="confirmed-badge" style={{ background: '#9E9E9E', color: 'white' }}>辅修</span>}
                  </div>
                  <div className="plan-details">
                    <span className="plan-condition">胜利条件: {plan.winCondition}</span>
                    {isMajor && plan.passiveAbility && (
                      <span className="plan-ability">被动能力: {plan.passiveAbility}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {player.trainingPlans.length === 0 && gameState?.roundNumber === 1 && (
        <div className="training-plans-section empty">
          <h4>培养计划</h4>
          <p className="no-plans">大一阶段，大二起选择培养计划</p>
        </div>
      )}

      {player.heldCards.length > 0 && (
        <div className="held-cards-section">
          <h4>手牌 ({player.heldCards.length})</h4>
          <div className="cards-preview">
            {player.heldCards.map((card) => (
              <div key={card.id} className="card-preview" title={card.description}>
                <span className="card-name">{card.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {player.effects.length > 0 && (
        <div className="effects-section">
          <h4>持续效果</h4>
          <div className="effects-list">
            {player.effects.map((effect) => (
              <div key={effect.id} className="effect-item">
                <span className="effect-type">{describeEffect(effect)}</span>
                {effect.turnsRemaining < 900 && (
                  <span className="effect-turns">{effect.turnsRemaining}回合</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="action-buttons">
        <button
          className="roll-dice-btn"
          onClick={handleRollDice}
          disabled={(!canRollDice && !(isMyTurn && needsToRoll)) || isRolling}
        >
          {getRollButtonText()}
        </button>
      </div>

      {/* Show last dice result */}
      {diceResult && diceResult.playerId === player.id && !isRolling && (
        <div className="last-dice-result">
          上次投掷: {diceResult.values.join(' + ')} = {diceResult.total}
        </div>
      )}

      {player.isBankrupt && (
        <div className="status-overlay bankrupt">
          <span>已破产</span>
        </div>
      )}
      {player.isInHospital && (
        <div className="status-overlay hospital">
          <span>校医院 - 需掷出3点以上出院</span>
        </div>
      )}
      {player.isAtDing && (
        <div className="status-overlay ding">
          <span>在鼎 - 掷骰移动</span>
        </div>
      )}
    </div>
  );
}
