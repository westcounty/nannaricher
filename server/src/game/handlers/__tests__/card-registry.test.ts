import { describe, it, expect } from 'vitest';
import { CARD_HANDLERS, getCardHandler } from '../card-registry.js';

describe('CardRegistry', () => {
  it('should have at least 80 registered handlers', () => {
    expect(CARD_HANDLERS.size).toBeGreaterThanOrEqual(80);
  });

  it('getCardHandler returns undefined for unknown card', () => {
    expect(getCardHandler('nonexistent_card')).toBeUndefined();
  });

  it('simple stat card returns correct effects', () => {
    const handler = getCardHandler('destiny_sustainability');
    expect(handler).toBeDefined();
    const result = handler!({
      card: { id: 'destiny_sustainability', name: '可持续性', description: '', deckType: 'destiny', holdable: false, singleUse: true, returnToDeck: true, effects: [] },
      player: { id: 'p1', money: 1000, gpa: 3.5, exploration: 10 } as any,
      state: { players: [] } as any,
    });
    expect(result.success).toBe(true);
    expect(result.effects?.money).toBe(300);
  });

  it('holdable card returns custom effect marker', () => {
    const handler = getCardHandler('destiny_maimen_shield');
    expect(handler).toBeDefined();
    const result = handler!({
      card: { id: 'destiny_maimen_shield', name: '麦门护盾', description: '', deckType: 'destiny', holdable: true, singleUse: false, returnToDeck: true, effects: [] },
      player: { id: 'p1' } as any,
      state: { players: [] } as any,
    });
    expect(result.effects?.custom).toBe('maimen_shield_active');
  });

  it('voting card returns voting custom marker', () => {
    const handler = getCardHandler('chance_swimming_pool_regular');
    expect(handler).toBeDefined();
    const result = handler!({
      card: { id: 'chance_swimming_pool_regular', name: '泳馆常客', description: '', deckType: 'chance', holdable: false, singleUse: true, returnToDeck: true, effects: [] },
      player: { id: 'p1' } as any,
      state: { players: [] } as any,
    });
    expect(result.effects?.custom).toContain('voting_');
  });

  it('chain card returns chain custom marker', () => {
    const handler = getCardHandler('chance_gossip_secret');
    expect(handler).toBeDefined();
    const result = handler!({
      card: { id: 'chance_gossip_secret', name: '八卦秘闻', description: '', deckType: 'chance', holdable: false, singleUse: true, returnToDeck: true, effects: [] },
      player: { id: 'p1' } as any,
      state: { players: [] } as any,
    });
    expect(result.effects?.custom).toContain('chain_');
  });
});
