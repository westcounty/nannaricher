// server/src/game/rules/__tests__/card-effects.test.ts
// Comprehensive card effect handler tests — structural validation for all 103 cards
// + detailed behavioral tests for representative cards of each type.

import { describe, it, expect } from 'vitest';
import { CARD_HANDLERS, getCardHandler, CardEffectContext, CardEffectResult } from '../../handlers/card-registry.js';
import type { Card, Player, GameState, Position } from '@nannaricher/shared';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test_card',
    name: 'Test Card',
    description: 'A test card',
    deckType: 'destiny',
    holdable: false,
    singleUse: true,
    returnToDeck: true,
    effects: [],
    ...overrides,
  };
}

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  const startPosition: Position = { type: 'main', index: 0 };
  return {
    id: 'p1',
    socketId: 'socket1',
    name: 'TestPlayer',
    color: '0',
    money: 1000,
    gpa: 3.0,
    exploration: 10,
    position: startPosition,
    diceCount: 1,
    trainingPlans: [],
    majorPlan: null,
    minorPlans: [],
    planSlotLimit: 2,
    heldCards: [],
    effects: [],
    skipNextTurn: false,
    isInHospital: false,
    isAtDing: false,
    isBankrupt: false,
    isDisconnected: false,
    linesVisited: [],
    lineEventsTriggered: {},
    hospitalVisits: 0,
    moneyZeroCount: 0,
    cafeteriaNoNegativeStreak: 0,
    cardsDrawnWithEnglish: 0,
    cardsDrawnWithDigitStart: [],
    chanceCardsUsedOnPlayers: {},
    gulou_endpoint_count: 0,
    modifiedWinThresholds: {},
    maxWinConditionSlots: 3,
    disabledWinConditions: [],
    lawyerShield: false,
    lastDiceValues: [],
    ...overrides,
  };
}

function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  const player = createMockPlayer();
  return {
    roomId: 'test-room',
    phase: 'playing',
    currentPlayerIndex: 0,
    turnNumber: 1,
    roundNumber: 1,
    players: [player],
    cardDecks: { chance: [], destiny: [], training: [] },
    discardPiles: { chance: [], destiny: [] },
    pendingAction: null,
    turnOrder: [0],
    turnOrderReversed: false,
    winner: null,
    log: [],
    ...overrides,
  };
}

function createCtx(cardId: string, overrides: Partial<CardEffectContext> = {}): CardEffectContext {
  const player = createMockPlayer();
  return {
    card: createMockCard({ id: cardId, name: cardId }),
    player,
    state: createMockGameState({ players: [player, createMockPlayer({ id: 'p2', name: 'Player2' })] }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Structural validation: every registered handler returns a valid result shape
// ---------------------------------------------------------------------------

describe('Card Effects — structural validation for all registered handlers', () => {
  const allCardIds = Array.from(CARD_HANDLERS.keys());

  it(`registry should contain at least 80 card handlers (actual: ${allCardIds.length})`, () => {
    expect(allCardIds.length).toBeGreaterThanOrEqual(80);
  });

  describe.each(allCardIds)('handler "%s"', (cardId) => {
    it('should return a result with success (boolean) and message (string)', () => {
      const handler = getCardHandler(cardId)!;
      expect(handler).toBeDefined();

      const ctx = createCtx(cardId);
      const result: CardEffectResult = handler(ctx);

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('should have valid effects types when effects are present', () => {
      const handler = getCardHandler(cardId)!;
      const ctx = createCtx(cardId);
      const result = handler(ctx);

      if (result.effects) {
        if (result.effects.money !== undefined) expect(typeof result.effects.money).toBe('number');
        if (result.effects.gpa !== undefined) expect(typeof result.effects.gpa).toBe('number');
        if (result.effects.exploration !== undefined) expect(typeof result.effects.exploration).toBe('number');
        if (result.effects.skipTurn !== undefined) expect(typeof result.effects.skipTurn).toBe('boolean');
        if (result.effects.moveTo !== undefined) expect(typeof result.effects.moveTo).toBe('string');
        if (result.effects.moveToLine !== undefined) expect(typeof result.effects.moveToLine).toBe('string');
        if (result.effects.drawCard !== undefined) expect(['chance', 'destiny', 'any']).toContain(result.effects.drawCard);
        if (result.effects.custom !== undefined) expect(typeof result.effects.custom).toBe('string');
      }

      // pendingAction, if present, must have required fields
      if (result.pendingAction) {
        expect(typeof result.pendingAction.id).toBe('string');
        expect(typeof result.pendingAction.playerId).toBe('string');
        expect(typeof result.pendingAction.type).toBe('string');
        expect(typeof result.pendingAction.prompt).toBe('string');
        expect(typeof result.pendingAction.timeoutMs).toBe('number');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Detailed behavioral tests
// ---------------------------------------------------------------------------

describe('Card Effects — detailed behavioral tests', () => {
  describe('Money cards', () => {
    it('destiny_sustainability gives +300 money', () => {
      const handler = getCardHandler('destiny_sustainability')!;
      const result = handler(createCtx('destiny_sustainability'));
      expect(result.success).toBe(true);
      expect(result.effects?.money).toBe(300);
    });

    it('destiny_survival takes -300 money', () => {
      const handler = getCardHandler('destiny_survival')!;
      const result = handler(createCtx('destiny_survival'));
      expect(result.success).toBe(true);
      expect(result.effects?.money).toBe(-300);
    });

    it('destiny_anniversary_coupon gives +100 money', () => {
      const handler = getCardHandler('destiny_anniversary_coupon')!;
      const result = handler(createCtx('destiny_anniversary_coupon'));
      expect(result.success).toBe(true);
      expect(result.effects?.money).toBe(100);
    });

    it('destiny_light_reporting takes -480 money', () => {
      const handler = getCardHandler('destiny_light_reporting')!;
      const result = handler(createCtx('destiny_light_reporting'));
      expect(result.success).toBe(true);
      expect(result.effects?.money).toBe(-480);
    });

    it('destiny_eight_directions_wealth gives +200 money', () => {
      const handler = getCardHandler('destiny_eight_directions_wealth')!;
      const result = handler(createCtx('destiny_eight_directions_wealth'));
      expect(result.success).toBe(true);
      expect(result.effects?.money).toBe(200);
    });
  });

  describe('GPA cards', () => {
    it('destiny_precision_instrument gives +0.2 GPA', () => {
      const handler = getCardHandler('destiny_precision_instrument')!;
      const result = handler(createCtx('destiny_precision_instrument'));
      expect(result.success).toBe(true);
      expect(result.effects?.gpa).toBe(0.2);
    });

    it('destiny_fragmented_life takes -0.2 GPA', () => {
      const handler = getCardHandler('destiny_fragmented_life')!;
      const result = handler(createCtx('destiny_fragmented_life'));
      expect(result.success).toBe(true);
      expect(result.effects?.gpa).toBe(-0.2);
    });

    it('destiny_love_at_first_sight gives +0.3 GPA', () => {
      const handler = getCardHandler('destiny_love_at_first_sight')!;
      const result = handler(createCtx('destiny_love_at_first_sight'));
      expect(result.success).toBe(true);
      expect(result.effects?.gpa).toBe(0.3);
    });
  });

  describe('Exploration cards', () => {
    it('destiny_happy_new_year gives +3 exploration', () => {
      const handler = getCardHandler('destiny_happy_new_year')!;
      const result = handler(createCtx('destiny_happy_new_year'));
      expect(result.success).toBe(true);
      expect(result.effects?.exploration).toBe(3);
    });

    it('destiny_three_idles gives +5 exploration', () => {
      const handler = getCardHandler('destiny_three_idles')!;
      const result = handler(createCtx('destiny_three_idles'));
      expect(result.success).toBe(true);
      expect(result.effects?.exploration).toBe(5);
    });

    it('destiny_with_light gives +1 exploration', () => {
      const handler = getCardHandler('destiny_with_light')!;
      const result = handler(createCtx('destiny_with_light'));
      expect(result.success).toBe(true);
      expect(result.effects?.exploration).toBe(1);
    });
  });

  describe('Holdable / custom effect cards', () => {
    it('destiny_maimen_shield returns maimen_shield_active custom marker', () => {
      const handler = getCardHandler('destiny_maimen_shield')!;
      const result = handler(createCtx('destiny_maimen_shield'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('maimen_shield_active');
    });

    it('destiny_stop_loss returns stop_loss custom marker', () => {
      const handler = getCardHandler('destiny_stop_loss')!;
      const result = handler(createCtx('destiny_stop_loss'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('stop_loss');
    });

    it('destiny_inherited_papers returns gpa_shield custom marker', () => {
      const handler = getCardHandler('destiny_inherited_papers')!;
      const result = handler(createCtx('destiny_inherited_papers'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('gpa_shield');
    });

    it('chance_info_blocked returns block_chance custom marker', () => {
      const handler = getCardHandler('chance_info_blocked')!;
      const result = handler(createCtx('chance_info_blocked'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('block_chance');
    });
  });

  describe('Voting cards', () => {
    const votingCardIds = [
      'destiny_four_schools',
      'chance_swimming_pool_regular',
      'chance_meeting_is_fate',
      'chance_first_snow',
      'chance_strange_tales',
      'chance_root_finding_moment',
      'chance_rest_moment',
      'chance_light_shadow',
      'chance_course_group',
      'chance_transfer_moment',
      'chance_wit_words',
      'chance_school_sports_meet',
      'chance_travel_method',
    ];

    it.each(votingCardIds)('%s should return a custom marker containing "voting_"', (cardId) => {
      const handler = getCardHandler(cardId)!;
      expect(handler).toBeDefined();
      const result = handler(createCtx(cardId));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toContain('voting_');
    });
  });

  describe('Chain cards', () => {
    const chainCardIds = [
      'chance_delivery_theft',
      'chance_southbound_rose',
      'chance_gossip_secret',
    ];

    it.each(chainCardIds)('%s should return a custom marker containing "chain_"', (cardId) => {
      const handler = getCardHandler(cardId)!;
      expect(handler).toBeDefined();
      const result = handler(createCtx(cardId));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toContain('chain_');
    });
  });

  describe('Movement cards', () => {
    it('destiny_beijing_university moves to pukou line', () => {
      const handler = getCardHandler('destiny_beijing_university')!;
      const result = handler(createCtx('destiny_beijing_university'));
      expect(result.success).toBe(true);
      expect(result.effects?.moveToLine).toBe('pukou');
    });

    it('destiny_chew_vegetable_root moves to study line', () => {
      const handler = getCardHandler('destiny_chew_vegetable_root')!;
      const result = handler(createCtx('destiny_chew_vegetable_root'));
      expect(result.success).toBe(true);
      expect(result.effects?.moveToLine).toBe('study');
    });

    it('destiny_more_the_better moves to money line', () => {
      const handler = getCardHandler('destiny_more_the_better')!;
      const result = handler(createCtx('destiny_more_the_better'));
      expect(result.success).toBe(true);
      expect(result.effects?.moveToLine).toBe('money');
    });

    it('destiny_campus_legend_move moves to ding', () => {
      const handler = getCardHandler('destiny_campus_legend_move')!;
      const result = handler(createCtx('destiny_campus_legend_move'));
      expect(result.success).toBe(true);
      expect(result.effects?.moveTo).toBe('ding');
    });
  });

  describe('Dice-dependent cards', () => {
    it('destiny_boss_recruit returns pendingAction when no dice value', () => {
      const handler = getCardHandler('destiny_boss_recruit')!;
      const result = handler(createCtx('destiny_boss_recruit'));
      expect(result.success).toBe(true);
      expect(result.pendingAction).toBeDefined();
      expect(result.pendingAction?.type).toBe('roll_dice');
    });

    it('destiny_boss_recruit calculates exploration change when dice provided', () => {
      const handler = getCardHandler('destiny_boss_recruit')!;
      const player = createMockPlayer({ exploration: 20 });
      const ctx = createCtx('destiny_boss_recruit', { player, diceValue: 5 });
      const result = handler(ctx);
      expect(result.success).toBe(true);
      // newExp = 5 * 0.1 * 20 = 10, delta = 10 - 20 = -10
      expect(result.effects?.exploration).toBe(-10);
    });

    it('destiny_swallowing_elevator returns pendingAction when no dice value', () => {
      const handler = getCardHandler('destiny_swallowing_elevator')!;
      const result = handler(createCtx('destiny_swallowing_elevator'));
      expect(result.success).toBe(true);
      expect(result.pendingAction).toBeDefined();
      expect(result.pendingAction?.type).toBe('roll_dice');
    });

    it('destiny_swallowing_elevator: roll 6 means safe', () => {
      const handler = getCardHandler('destiny_swallowing_elevator')!;
      const result = handler(createCtx('destiny_swallowing_elevator', { diceValue: 6 }));
      expect(result.success).toBe(true);
      expect(result.effects?.skipTurn).toBeUndefined();
      expect(result.effects?.gpa).toBeUndefined();
    });

    it('destiny_swallowing_elevator: roll non-6 means skip turn and GPA -0.1', () => {
      const handler = getCardHandler('destiny_swallowing_elevator')!;
      const result = handler(createCtx('destiny_swallowing_elevator', { diceValue: 3 }));
      expect(result.success).toBe(true);
      expect(result.effects?.skipTurn).toBe(true);
      expect(result.effects?.gpa).toBe(-0.1);
    });
  });

  describe('Choice cards (pendingAction)', () => {
    it('destiny_mutual_help returns a choose_option action', () => {
      const handler = getCardHandler('destiny_mutual_help')!;
      const result = handler(createCtx('destiny_mutual_help'));
      expect(result.success).toBe(true);
      expect(result.pendingAction).toBeDefined();
      expect(result.pendingAction?.type).toBe('choose_option');
      expect(result.pendingAction?.options).toHaveLength(2);
    });

    it('destiny_questionnaire returns a choose_option action with two options', () => {
      const handler = getCardHandler('destiny_questionnaire')!;
      const result = handler(createCtx('destiny_questionnaire'));
      expect(result.success).toBe(true);
      expect(result.pendingAction?.type).toBe('choose_option');
      expect(result.pendingAction?.options).toHaveLength(2);
    });
  });

  describe('Player targeting cards', () => {
    it('chance_robin_hood returns choose_player action with other players as targets', () => {
      const handler = getCardHandler('chance_robin_hood')!;
      const player = createMockPlayer();
      const otherPlayer = createMockPlayer({ id: 'p2', name: 'Other' });
      const state = createMockGameState({ players: [player, otherPlayer] });
      const result = handler({ card: createMockCard({ id: 'chance_robin_hood' }), player, state });
      expect(result.pendingAction?.type).toBe('choose_player');
      expect(result.pendingAction?.targetPlayerIds).toEqual(['p2']);
    });
  });

  describe('Redistribution cards', () => {
    it('chance_steal_rich_help_poor identifies richest and poorest', () => {
      const handler = getCardHandler('chance_steal_rich_help_poor')!;
      const p1 = createMockPlayer({ id: 'p1', name: 'Rich', money: 5000 });
      const p2 = createMockPlayer({ id: 'p2', name: 'Poor', money: 100 });
      const state = createMockGameState({ players: [p1, p2] });
      const result = handler({ card: createMockCard({ id: 'chance_steal_rich_help_poor' }), player: p1, state });
      expect(result.success).toBe(true);
      expect(result.effects?.targetPlayerId).toBe('p1'); // richest
      expect(result.effects?.targetEffects?.money).toBe(-200);
    });

    it('chance_score_conversion identifies highest and lowest GPA', () => {
      const handler = getCardHandler('chance_score_conversion')!;
      const p1 = createMockPlayer({ id: 'p1', name: 'High', gpa: 4.5 });
      const p2 = createMockPlayer({ id: 'p2', name: 'Low', gpa: 2.0 });
      const state = createMockGameState({ players: [p1, p2] });
      const result = handler({ card: createMockCard({ id: 'chance_score_conversion' }), player: p1, state });
      expect(result.success).toBe(true);
      expect(result.effects?.targetPlayerId).toBe('p1'); // highest GPA
      expect(result.effects?.targetEffects?.gpa).toBe(-0.2);
    });

    it('chance_reorganize_dorm identifies highest and lowest exploration', () => {
      const handler = getCardHandler('chance_reorganize_dorm')!;
      const p1 = createMockPlayer({ id: 'p1', name: 'Explorer', exploration: 30 });
      const p2 = createMockPlayer({ id: 'p2', name: 'Newbie', exploration: 5 });
      const state = createMockGameState({ players: [p1, p2] });
      const result = handler({ card: createMockCard({ id: 'chance_reorganize_dorm' }), player: p1, state });
      expect(result.success).toBe(true);
      expect(result.effects?.targetPlayerId).toBe('p1'); // highest exploration
      expect(result.effects?.targetEffects?.exploration).toBe(-2);
    });
  });

  describe('Draw card effect', () => {
    it('destiny_thank_you draws another destiny card', () => {
      const handler = getCardHandler('destiny_thank_you')!;
      const result = handler(createCtx('destiny_thank_you'));
      expect(result.success).toBe(true);
      expect(result.effects?.drawCard).toBe('destiny');
      expect(result.effects?.drawCardCount).toBe(1);
    });
  });

  describe('Special mechanic cards', () => {
    it('destiny_fengshui_rotation reverses turn order', () => {
      const handler = getCardHandler('destiny_fengshui_rotation')!;
      const result = handler(createCtx('destiny_fengshui_rotation'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('reverse_turn_order');
    });

    it('destiny_skateboard_genius activates double dice', () => {
      const handler = getCardHandler('destiny_skateboard_genius')!;
      const result = handler(createCtx('destiny_skateboard_genius'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('double_dice');
    });

    it('destiny_closing_music activates double event', () => {
      const handler = getCardHandler('destiny_closing_music')!;
      const result = handler(createCtx('destiny_closing_music'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('double_event');
    });

    it('destiny_system_failure activates system fault', () => {
      const handler = getCardHandler('destiny_system_failure')!;
      const result = handler(createCtx('destiny_system_failure'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('system_fault');
    });

    it('chance_budget_sharing resets all money to 800', () => {
      const handler = getCardHandler('chance_budget_sharing')!;
      const result = handler(createCtx('chance_budget_sharing'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('budget_sharing_800');
    });

    it('chance_garbage_collection returns cards to deck', () => {
      const handler = getCardHandler('chance_garbage_collection')!;
      const result = handler(createCtx('chance_garbage_collection'));
      expect(result.success).toBe(true);
      expect(result.effects?.custom).toBe('garbage_collection');
    });
  });
});
