import { describe, it, expect, beforeEach } from 'vitest';
import { DelayedEffectManager } from '../DelayedEffectManager.js';

describe('DelayedEffectManager', () => {
  let manager: DelayedEffectManager;

  beforeEach(() => {
    manager = new DelayedEffectManager();
  });

  it('should add and retrieve active effects', () => {
    manager.add({ playerId: 'p1', type: 'double_event', triggerTurn: 5, data: {} });
    expect(manager.getActiveEffects('p1')).toHaveLength(1);
  });

  it('hasDoubleEvent should return true and auto-resolve', () => {
    manager.add({ playerId: 'p1', type: 'double_event', triggerTurn: 5, data: {} });
    expect(manager.hasDoubleEvent('p1')).toBe(true);
    expect(manager.hasDoubleEvent('p1')).toBe(false); // already consumed
  });

  it('hasMoneyFreeze should not auto-resolve', () => {
    manager.add({ playerId: 'p1', type: 'money_freeze', triggerTurn: 5, data: {} });
    expect(manager.hasMoneyFreeze('p1')).toBe(true);
    expect(manager.hasMoneyFreeze('p1')).toBe(true); // still active
  });

  it('processStartOfTurn should trigger turn-based effects', () => {
    manager.add({ playerId: 'p1', type: 'double_dice', triggerTurn: 3, triggerCondition: 'next_turn', data: {} });
    const triggered = manager.processStartOfTurn(3, 'p1');
    expect(triggered).toHaveLength(1);
    expect(triggered[0].type).toBe('double_dice');
  });

  it('cleanup should remove resolved effects', () => {
    const id = manager.add({ playerId: 'p1', type: 'double_event', triggerTurn: 5, data: {} });
    manager.resolve(id);
    manager.cleanup();
    expect(manager.getAllActive()).toHaveLength(0);
  });

  it('should not return effects for different player', () => {
    manager.add({ playerId: 'p1', type: 'double_event', triggerTurn: 5, data: {} });
    expect(manager.hasDoubleEvent('p2')).toBe(false);
  });
});
