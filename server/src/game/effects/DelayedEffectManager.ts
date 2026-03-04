// server/src/game/effects/DelayedEffectManager.ts

export interface DelayedEffect {
  id: string;
  playerId: string;
  type: 'double_event' | 'money_freeze' | 'delayed_gratification'
    | 'reverse_order' | 'double_dice' | 'reverse_move' | 'double_dice_check';
  triggerTurn: number;
  triggerCondition?: 'next_event' | 'next_turn' | 'next_dice';
  data: Record<string, unknown>;
  resolved: boolean;
}

let nextId = 1;

export class DelayedEffectManager {
  private effects: DelayedEffect[] = [];

  add(effect: Omit<DelayedEffect, 'id' | 'resolved'>): string {
    const id = `delayed_${nextId++}`;
    this.effects.push({ ...effect, id, resolved: false });
    return id;
  }

  processStartOfTurn(currentTurn: number, playerId: string): DelayedEffect[] {
    const triggered: DelayedEffect[] = [];
    for (const e of this.effects) {
      if (e.resolved || e.playerId !== playerId) continue;
      if (e.triggerCondition === 'next_turn' && currentTurn >= e.triggerTurn) {
        triggered.push(e);
        e.resolved = true;
      }
    }
    return triggered;
  }

  hasDoubleEvent(playerId: string): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'double_event');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  hasMoneyFreeze(playerId: string): boolean {
    return this.effects.some(e =>
      !e.resolved && e.playerId === playerId && e.type === 'money_freeze');
  }

  hasReverseMove(playerId: string): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'reverse_move');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  hasDoubleDice(playerId: string): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'double_dice');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  hasDoubleDiceCheck(playerId: string): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'double_dice_check');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  hasReverseOrder(): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.type === 'reverse_order');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  getDelayedGratification(playerId: string): DelayedEffect | undefined {
    return this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'delayed_gratification');
  }

  resolve(effectId: string): void {
    const effect = this.effects.find(e => e.id === effectId);
    if (effect) effect.resolved = true;
  }

  cleanup(): void {
    this.effects = this.effects.filter(e => !e.resolved);
  }

  getActiveEffects(playerId: string): DelayedEffect[] {
    return this.effects.filter(e => !e.resolved && e.playerId === playerId);
  }

  getAllActive(): DelayedEffect[] {
    return this.effects.filter(e => !e.resolved);
  }
}
