import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import './CardDrawModal.css';

export function CardDrawModal() {
  const drawnCard = useGameStore((s) => s.drawnCard);
  const playerId = useGameStore((s) => s.playerId);
  const gameState = useGameStore((s) => s.gameState);
  const currentEvent = useGameStore((s) => s.currentEvent);
  const clearCard = useCallback(() => useGameStore.getState().setDrawnCard(null), []);

  const [phase, setPhase] = useState<'flipping' | 'revealed' | 'closing'>('flipping');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if this is for the local player or another player
  const isMyCard = drawnCard?.playerId === playerId || !drawnCard?.playerId;
  const drawerName = drawnCard?.playerId && gameState
    ? gameState.players.find(p => p.id === drawnCard.playerId)?.name
    : undefined;

  // If an EventModal (pendingAction) arrived while we're showing, auto-dismiss faster
  // so the player can interact with the choice dialog
  useEffect(() => {
    if (currentEvent?.pendingAction && drawnCard && phase === 'revealed') {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setPhase('closing');
        timerRef.current = setTimeout(clearCard, 300);
      }, 800);
    }
  }, [currentEvent, drawnCard, phase, clearCard]);

  useEffect(() => {
    if (!drawnCard) {
      setPhase('flipping');
      return;
    }

    // Phase 1: flip animation (600ms)
    setPhase('flipping');
    timerRef.current = setTimeout(() => {
      setPhase('revealed');

      // Phase 2: auto-dismiss after delay
      // Longer for own cards, shorter for other players
      const dismissDelay = isMyCard ? 3500 : 2500;
      timerRef.current = setTimeout(() => {
        setPhase('closing');
        timerRef.current = setTimeout(clearCard, 300);
      }, dismissDelay);
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [drawnCard, isMyCard, clearCard]);

  const handleDismiss = useCallback(() => {
    if (phase === 'closing') return;
    setPhase('closing');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(clearCard, 300);
  }, [phase, clearCard]);

  if (!drawnCard) return null;

  const { card, addedToHand } = drawnCard;
  const isChance = card.deckType === 'chance';
  const deckLabel = isChance ? '机会卡' : '命运卡';
  const deckIcon = isChance ? '?' : '!';

  // Build effect summary from card.effects
  const effectItems: { icon: string; label: string; value: string; positive: boolean }[] = [];
  if (card.effects) {
    for (const eff of card.effects) {
      if (eff.stat && eff.delta) {
        const icons: Record<string, string> = { money: '💰', gpa: '📚', exploration: '🔍' };
        const labels: Record<string, string> = { money: '金钱', gpa: 'GPA', exploration: '探索值' };
        effectItems.push({
          icon: icons[eff.stat] || '⚡',
          label: labels[eff.stat] || eff.stat,
          value: `${eff.delta > 0 ? '+' : ''}${eff.delta}`,
          positive: eff.delta > 0,
        });
      }
    }
  }

  return (
    <div
      className={`card-draw-overlay ${phase} ${isMyCard ? '' : 'other-player'}`}
      onClick={phase === 'revealed' ? handleDismiss : undefined}
    >
      <div className={`card-draw-container ${phase}`} onClick={e => e.stopPropagation()}>
        {/* Card flip wrapper */}
        <div className={`card-flip ${phase === 'flipping' ? 'flipping' : 'done'}`}>
          {/* Card back */}
          <div className={`card-face card-back ${isChance ? 'chance' : 'destiny'}`}>
            <div className="card-back-pattern">
              <span className="card-back-icon">{deckIcon}</span>
            </div>
          </div>

          {/* Card front */}
          <div className={`card-face card-front ${isChance ? 'chance' : 'destiny'}`}>
            {/* Header */}
            <div className="card-draw-header">
              <span className={`card-deck-badge ${isChance ? 'chance' : 'destiny'}`}>
                {deckIcon} {deckLabel}
              </span>
              {!isMyCard && drawerName && (
                <span className="card-drawer-name">{drawerName}</span>
              )}
            </div>

            {/* Card name */}
            <h2 className="card-draw-name">{card.name}</h2>

            {/* Description */}
            <p className="card-draw-desc">{card.description}</p>

            {/* Effect pills */}
            {effectItems.length > 0 && (
              <div className="card-draw-effects">
                {effectItems.map((eff, i) => (
                  <div key={i} className={`card-effect-pill ${eff.positive ? 'positive' : 'negative'}`}>
                    <span>{eff.icon}</span>
                    <span>{eff.label}</span>
                    <span className="card-effect-value">{eff.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Destination badge */}
            <div className={`card-destination ${addedToHand ? 'to-hand' : 'immediate'}`}>
              {addedToHand ? '📥 已加入手牌' : '⚡ 立即生效'}
            </div>
          </div>
        </div>

        {/* Tap to dismiss hint */}
        {phase === 'revealed' && isMyCard && (
          <div className="card-draw-hint" onClick={handleDismiss}>点击关闭</div>
        )}
      </div>
    </div>
  );
}

export default CardDrawModal;
