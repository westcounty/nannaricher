import type { GameState } from '@nannaricher/shared';

export interface DeferredNotification {
  message: string;
  type: 'info' | 'warning' | 'success';
}

interface ResourceDeltas {
  money: number;
  gpa: number;
  exploration: number;
}

export function collectStateNotifications(
  prev: GameState | null,
  next: GameState,
  localPlayerId: string | null,
): DeferredNotification[] {
  if (!prev) return [];

  const notifications: DeferredNotification[] = [];

  for (const nextPlayer of next.players) {
    if (nextPlayer.id === localPlayerId) continue;
    const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
    if (!prevPlayer) continue;

    const name = nextPlayer.name;

    if (!prevPlayer.isBankrupt && nextPlayer.isBankrupt) {
      notifications.push({ message: `${name} 破产了！`, type: 'warning' });
    }

    if (!prevPlayer.isInHospital && nextPlayer.isInHospital) {
      notifications.push({ message: `${name} 住院了！`, type: 'warning' });
    }
  }

  return notifications;
}

export function buildLineExitSummaryNotification(
  playerName: string,
  lineName: string,
  deltas: ResourceDeltas,
): DeferredNotification {
  const parts: string[] = [];
  if (deltas.money) parts.push(`资金${deltas.money > 0 ? '+' : ''}${deltas.money}`);
  if (deltas.gpa) parts.push(`GPA${deltas.gpa > 0 ? '+' : ''}${deltas.gpa}`);
  if (deltas.exploration) parts.push(`探索${deltas.exploration > 0 ? '+' : ''}${deltas.exploration}`);
  const summary = parts.length > 0 ? parts.join('，') : '无变化';

  return {
    message: `${playerName} 完成 ${lineName}：${summary}`,
    type: 'info',
  };
}

export function buildPlanAbilityNotification(
  playerName: string,
  planName: string,
  message: string,
): DeferredNotification {
  return {
    message: `${playerName}《${planName}》${message}`,
    type: 'info',
  };
}
