// client/src/components/ActionPromptBar.tsx
// Persistent guidance bar telling the player what to do right now.

import type { GameState } from '@nannaricher/shared';
import '../styles/action-prompt.css';

interface ActionPromptBarProps {
  gameState: GameState;
  playerId: string | null;
  isMyTurn: boolean;
  canRollDice: boolean;
  currentPlayerName?: string;
}

export function ActionPromptBar({
  gameState,
  playerId,
  isMyTurn,
  canRollDice,
  currentPlayerName,
}: ActionPromptBarProps) {
  const pendingAction = gameState.pendingAction;
  const hasPendingAction =
    pendingAction &&
    (pendingAction.playerId === playerId || pendingAction.playerId === 'all');

  // Check if local player is bankrupt
  const myPlayer = playerId
    ? gameState.players.find((p) => p.id === playerId)
    : null;

  let text: string;
  let isActive = false;

  if (myPlayer?.isBankrupt) {
    text = '\u{1F441}\uFE0F \u89C2\u6218\u6A21\u5F0F \u2014 \u7EE7\u7EED\u89C2\u770B\u6BD4\u8D5B';
  } else if (gameState.phase === 'setup_plans') {
    text = '\u{1F4CB} \u8BF7\u9009\u62E9\u57F9\u517B\u8BA1\u5212';
    isActive = true;
  } else if (gameState.phase === 'finished') {
    text = '\u{1F3C6} \u6E38\u620F\u7ED3\u675F';
  } else if (gameState.phase === 'waiting') {
    text = '\u23F3 \u7B49\u5F85\u5176\u4ED6\u73A9\u5BB6\u52A0\u5165';
  } else if (pendingAction?.type === 'multi_vote' && hasPendingAction) {
    text = '\u{1F5F3}\uFE0F \u8BF7\u6295\u7968';
    isActive = true;
  } else if (pendingAction?.type === 'chain_action' && hasPendingAction) {
    text = '\u26D3\uFE0F \u8FDE\u9501\u884C\u52A8\u8FDB\u884C\u4E2D';
    isActive = true;
  } else if (
    hasPendingAction &&
    pendingAction?.options &&
    pendingAction.options.length > 0
  ) {
    text = '\u2753 \u8BF7\u505A\u51FA\u9009\u62E9';
    isActive = true;
  } else if (isMyTurn && canRollDice) {
    text = '\u{1F3B2} \u8BF7\u6295\u9AB0\u5B50\uFF01';
    isActive = true;
  } else if (isMyTurn && !canRollDice) {
    text = '\u23F3 \u7B49\u5F85\u7ED3\u7B97...';
    isActive = true;
  } else if (!isMyTurn) {
    text = `\u{1F440} ${currentPlayerName ?? '...'} \u6B63\u5728\u64CD\u4F5C... \u2014 \u53EF\u6D4F\u89C8\u68CB\u76D8\u548C\u5361\u724C`;
  } else {
    text = '\u23F3 \u7B49\u5F85\u4E2D...';
  }

  return (
    <div
      className={`action-prompt-bar ${isActive ? 'action-prompt-bar--active' : 'action-prompt-bar--waiting'}`}
    >
      <span className="action-prompt-bar__text">{text}</span>
    </div>
  );
}
