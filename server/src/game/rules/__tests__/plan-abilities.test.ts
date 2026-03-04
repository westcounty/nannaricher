// server/src/game/rules/__tests__/plan-abilities.test.ts
// Comprehensive plan ability tests — structural validation for all 33 plans
// + detailed behavioral tests for representative abilities of each trigger type.

import { describe, it, expect } from 'vitest';
import { PLAN_ABILITIES, getPlanAbility, PlanAbilityContext, PlanAbilityResult, AbilityTrigger } from '../../handlers/plan-registry.js';
import type { Player, GameState, Position } from '@nannaricher/shared';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

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
    confirmedPlans: [],
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
    lawyerShield: false,
    lastDiceValues: [],
    ...overrides,
  };
}

function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'test-room',
    phase: 'playing',
    currentPlayerIndex: 0,
    turnNumber: 1,
    roundNumber: 1,
    players: [createMockPlayer()],
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

function createAbilityCtx(trigger: AbilityTrigger, overrides: Partial<PlanAbilityContext> = {}): PlanAbilityContext {
  return {
    player: createMockPlayer(),
    state: createMockGameState(),
    trigger,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid trigger types set
// ---------------------------------------------------------------------------

const VALID_TRIGGERS: AbilityTrigger[] = [
  'on_confirm', 'on_cell_enter', 'on_money_loss', 'on_gpa_change',
  'on_line_enter', 'on_dice_roll', 'on_turn_start', 'on_card_draw',
  'on_move', 'passive', 'on_other_win',
];

// ---------------------------------------------------------------------------
// Structural validation: every registered ability has valid shape
// ---------------------------------------------------------------------------

describe('Plan Abilities — structural validation for all 33 registered abilities', () => {
  const allPlanIds = Array.from(PLAN_ABILITIES.keys());

  it(`registry should contain exactly 33 plan abilities (actual: ${allPlanIds.length})`, () => {
    expect(allPlanIds.length).toBe(33);
  });

  describe.each(allPlanIds)('ability "%s"', (planId) => {
    it('should have a valid trigger type', () => {
      const ability = getPlanAbility(planId)!;
      expect(ability).toBeDefined();
      expect(VALID_TRIGGERS).toContain(ability.trigger);
    });

    it('apply function should exist and be callable', () => {
      const ability = getPlanAbility(planId)!;
      expect(typeof ability.apply).toBe('function');
    });

    it('should return null or a valid PlanAbilityResult when triggered correctly', () => {
      const ability = getPlanAbility(planId)!;
      const ctx = createAbilityCtx(ability.trigger);
      const result = ability.apply(ctx);

      if (result !== null) {
        expect(typeof result.activated).toBe('boolean');
        if (result.message !== undefined) expect(typeof result.message).toBe('string');
        if (result.effects) {
          if (result.effects.money !== undefined) expect(typeof result.effects.money).toBe('number');
          if (result.effects.gpa !== undefined) expect(typeof result.effects.gpa).toBe('number');
          if (result.effects.exploration !== undefined) expect(typeof result.effects.exploration).toBe('number');
          if (result.effects.skipEvent !== undefined) expect(typeof result.effects.skipEvent).toBe('boolean');
          if (result.effects.moveToLine !== undefined) expect(typeof result.effects.moveToLine).toBe('string');
          if (result.effects.moveToCell !== undefined) expect(typeof result.effects.moveToCell).toBe('string');
          if (result.effects.skipEntryFee !== undefined) expect(typeof result.effects.skipEntryFee).toBe('boolean');
          if (result.effects.drawCard !== undefined) expect(['chance', 'destiny']).toContain(result.effects.drawCard);
          if (result.effects.customEffect !== undefined) expect(typeof result.effects.customEffect).toBe('string');
          if (result.effects.overrideGpa !== undefined) expect(typeof result.effects.overrideGpa).toBe('number');
          if (result.effects.overrideMoney !== undefined) expect(typeof result.effects.overrideMoney).toBe('number');
          if (result.effects.blockMoneyLoss !== undefined) expect(typeof result.effects.blockMoneyLoss).toBe('boolean');
          if (result.effects.skipTurn !== undefined) expect(typeof result.effects.skipTurn).toBe('boolean');
        }
      }
    });

    it('should return null when triggered with a mismatched trigger type', () => {
      const ability = getPlanAbility(planId)!;
      // Find a trigger that does NOT match this ability
      const wrongTrigger = VALID_TRIGGERS.find(t => t !== ability.trigger)!;
      const ctx = createAbilityCtx(wrongTrigger);
      const result = ability.apply(ctx);
      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Detailed behavioral tests — grouped by trigger type
// ---------------------------------------------------------------------------

describe('Plan Abilities — on_confirm trigger', () => {
  it('plan_lishi (History) moves player to gulou line on confirm', () => {
    const ability = getPlanAbility('plan_lishi')!;
    expect(ability.trigger).toBe('on_confirm');
    const result = ability.apply(createAbilityCtx('on_confirm'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.moveToLine).toBe('gulou');
  });

  it('plan_shangxue (Commerce) moves player to money line and skips entry fee', () => {
    const ability = getPlanAbility('plan_shangxue')!;
    expect(ability.trigger).toBe('on_confirm');
    const result = ability.apply(createAbilityCtx('on_confirm'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.moveToLine).toBe('money');
    expect(result!.effects?.skipEntryFee).toBe(true);
  });

  it('plan_waiguoyu (Foreign Languages) draws a destiny card on confirm', () => {
    const ability = getPlanAbility('plan_waiguoyu')!;
    expect(ability.trigger).toBe('on_confirm');
    const result = ability.apply(createAbilityCtx('on_confirm'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.drawCard).toBe('destiny');
  });

  it('plan_guoji (International Relations) triggers target draw on confirm', () => {
    const ability = getPlanAbility('plan_guoji')!;
    expect(ability.trigger).toBe('on_confirm');
    const result = ability.apply(createAbilityCtx('on_confirm'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('guoji_target_draw');
  });

  it('plan_xinxiguanli (Information Management) redistributes on confirm', () => {
    const ability = getPlanAbility('plan_xinxiguanli')!;
    expect(ability.trigger).toBe('on_confirm');
    const result = ability.apply(createAbilityCtx('on_confirm'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('xinxiguanli_redistribute');
  });

  it('plan_tianwen (Astronomy) moves to waiting room on confirm', () => {
    const ability = getPlanAbility('plan_tianwen')!;
    expect(ability.trigger).toBe('on_confirm');
    const result = ability.apply(createAbilityCtx('on_confirm'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.moveToCell).toBe('waiting_room');
  });

  it('plan_shengming (Life Sciences) gets maimen shield on confirm', () => {
    const ability = getPlanAbility('plan_shengming')!;
    expect(ability.trigger).toBe('on_confirm');
    const result = ability.apply(createAbilityCtx('on_confirm'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('shengming_maimen');
  });

  it('plan_gongguan (Engineering Management) gets negative balance card on confirm', () => {
    const ability = getPlanAbility('plan_gongguan')!;
    expect(ability.trigger).toBe('on_confirm');
    const result = ability.apply(createAbilityCtx('on_confirm'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('gongguan_negative_balance');
  });
});

describe('Plan Abilities — on_cell_enter trigger', () => {
  it('plan_wenxue (Literature) triggers at jiang_gong cell', () => {
    const ability = getPlanAbility('plan_wenxue')!;
    expect(ability.trigger).toBe('on_cell_enter');
    const result = ability.apply(createAbilityCtx('on_cell_enter', { cellId: 'jiang_gong' }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('wenxue_jiang_gong');
  });

  it('plan_wenxue does NOT trigger at other cells', () => {
    const ability = getPlanAbility('plan_wenxue')!;
    const result = ability.apply(createAbilityCtx('on_cell_enter', { cellId: 'hospital' }));
    expect(result).toBeNull();
  });

  it('plan_dianzi (Electronics) triggers at kechuang cell with +0.2 GPA bonus', () => {
    const ability = getPlanAbility('plan_dianzi')!;
    expect(ability.trigger).toBe('on_cell_enter');
    const result = ability.apply(createAbilityCtx('on_cell_enter', { cellId: 'kechuang' }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.gpa).toBe(0.2);
    expect(result!.effects?.customEffect).toBe('dianzi_kechuang');
  });

  it('plan_yixue (Medical) triggers at hospital cell', () => {
    const ability = getPlanAbility('plan_yixue')!;
    expect(ability.trigger).toBe('on_cell_enter');
    const result = ability.apply(createAbilityCtx('on_cell_enter', { cellId: 'hospital' }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('yixue_free_discharge');
  });

  it('plan_makesi (Marxism) triggers at society cell', () => {
    const ability = getPlanAbility('plan_makesi')!;
    expect(ability.trigger).toBe('on_cell_enter');
    const result = ability.apply(createAbilityCtx('on_cell_enter', { cellId: 'society' }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.exploration).toBe(2);
    expect(result!.effects?.skipEvent).toBe(true);
  });

  it('plan_yishu (Art) triggers at pukou_exp_card cell', () => {
    const ability = getPlanAbility('plan_yishu')!;
    expect(ability.trigger).toBe('on_cell_enter');
    const result = ability.apply(createAbilityCtx('on_cell_enter', { cellId: 'pukou_exp_card' }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('yishu_double_exp');
  });
});

describe('Plan Abilities — on_money_loss trigger', () => {
  it('plan_faxue (Law) blocks money loss when lawyerShield is active', () => {
    const ability = getPlanAbility('plan_faxue')!;
    expect(ability.trigger).toBe('on_money_loss');
    const player = createMockPlayer({ lawyerShield: true });
    const result = ability.apply(createAbilityCtx('on_money_loss', { player }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.blockMoneyLoss).toBe(true);
  });

  it('plan_faxue does NOT block when lawyerShield is false', () => {
    const ability = getPlanAbility('plan_faxue')!;
    const player = createMockPlayer({ lawyerShield: false });
    const result = ability.apply(createAbilityCtx('on_money_loss', { player }));
    expect(result).toBeNull();
  });
});

describe('Plan Abilities — on_gpa_change trigger', () => {
  it('plan_zhexue (Philosophy) overrides GPA to 3.0 when dropping below', () => {
    const ability = getPlanAbility('plan_zhexue')!;
    expect(ability.trigger).toBe('on_gpa_change');
    const player = createMockPlayer({ gpa: 2.8, confirmedPlans: ['plan_zhexue'] });
    const result = ability.apply(createAbilityCtx('on_gpa_change', { player, gpaDelta: -0.5 }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.overrideGpa).toBe(3.0);
  });

  it('plan_zhexue does NOT trigger when GPA stays above 3.0', () => {
    const ability = getPlanAbility('plan_zhexue')!;
    const player = createMockPlayer({ gpa: 3.5 });
    const result = ability.apply(createAbilityCtx('on_gpa_change', { player, gpaDelta: -0.2 }));
    expect(result).toBeNull();
  });

  it('plan_zhexue does NOT trigger on GPA increase', () => {
    const ability = getPlanAbility('plan_zhexue')!;
    const player = createMockPlayer({ gpa: 2.5 });
    const result = ability.apply(createAbilityCtx('on_gpa_change', { player, gpaDelta: 0.5 }));
    expect(result).toBeNull();
  });
});

describe('Plan Abilities — on_line_enter trigger', () => {
  it('plan_xinwen (Journalism) skips entry fee for explore line', () => {
    const ability = getPlanAbility('plan_xinwen')!;
    expect(ability.trigger).toBe('on_line_enter');
    const result = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'explore' }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.skipEntryFee).toBe(true);
  });

  it('plan_xinwen does NOT trigger for other lines', () => {
    const ability = getPlanAbility('plan_xinwen')!;
    const result = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'money' }));
    expect(result).toBeNull();
  });

  it('plan_zhengguan (Government) triggers for campus lines only', () => {
    const ability = getPlanAbility('plan_zhengguan')!;
    expect(ability.trigger).toBe('on_line_enter');

    const campusLines = ['pukou', 'suzhou', 'gulou', 'xianlin'];
    for (const lineId of campusLines) {
      const result = ability.apply(createAbilityCtx('on_line_enter', { lineId }));
      expect(result).not.toBeNull();
      expect(result!.activated).toBe(true);
      expect(result!.effects?.customEffect).toBe('zhengguan_discount');
    }

    // Non-campus line should not trigger
    const nonCampusResult = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'study' }));
    expect(nonCampusResult).toBeNull();
  });

  it('plan_diqiu (Earth Sciences) calculates line discount based on unique visits', () => {
    const ability = getPlanAbility('plan_diqiu')!;
    const player = createMockPlayer({ linesVisited: ['pukou', 'study', 'gulou'] });
    const result = ability.apply(createAbilityCtx('on_line_enter', { player, lineId: 'money' }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.money).toBe(300); // 3 unique * 100
  });

  it('plan_jianzhu (Architecture) skips entry fee for gulou line only', () => {
    const ability = getPlanAbility('plan_jianzhu')!;
    expect(ability.trigger).toBe('on_line_enter');
    const gulouResult = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'gulou' }));
    expect(gulouResult).not.toBeNull();
    expect(gulouResult!.effects?.skipEntryFee).toBe(true);

    const otherResult = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'pukou' }));
    expect(otherResult).toBeNull();
  });

  it('plan_suzhou (Suzhou Campus) skips entry fee for suzhou line only', () => {
    const ability = getPlanAbility('plan_suzhou')!;
    expect(ability.trigger).toBe('on_line_enter');
    const suzhouResult = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'suzhou' }));
    expect(suzhouResult).not.toBeNull();
    expect(suzhouResult!.effects?.skipEntryFee).toBe(true);

    const otherResult = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'xianlin' }));
    expect(otherResult).toBeNull();
  });

  it('plan_haiwai (Overseas Education) triggers for food line only', () => {
    const ability = getPlanAbility('plan_haiwai')!;
    expect(ability.trigger).toBe('on_line_enter');
    const foodResult = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'food' }));
    expect(foodResult).not.toBeNull();
    expect(foodResult!.effects?.customEffect).toBe('haiwai_optional_food');

    const otherResult = ability.apply(createAbilityCtx('on_line_enter', { lineId: 'study' }));
    expect(otherResult).toBeNull();
  });

  it('plan_dili (Geography) calculates campus discount based on visited campus lines', () => {
    const ability = getPlanAbility('plan_dili')!;
    const player = createMockPlayer({ linesVisited: ['pukou', 'gulou'] });
    const result = ability.apply(createAbilityCtx('on_line_enter', { player, lineId: 'xianlin' }));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.money).toBe(200); // 2 visited campus lines * 100
  });
});

describe('Plan Abilities — on_dice_roll trigger', () => {
  it('plan_shuxue (Mathematics) activates set dice ability', () => {
    const ability = getPlanAbility('plan_shuxue')!;
    expect(ability.trigger).toBe('on_dice_roll');
    const result = ability.apply(createAbilityCtx('on_dice_roll'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('shuxue_set_dice');
  });
});

describe('Plan Abilities — on_turn_start trigger', () => {
  it('plan_wuli (Physics) offers double move option', () => {
    const ability = getPlanAbility('plan_wuli')!;
    expect(ability.trigger).toBe('on_turn_start');
    const result = ability.apply(createAbilityCtx('on_turn_start'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('wuli_double_move');
  });

  it('plan_huaxue (Chemistry) offers cell disable option', () => {
    const ability = getPlanAbility('plan_huaxue')!;
    expect(ability.trigger).toBe('on_turn_start');
    const result = ability.apply(createAbilityCtx('on_turn_start'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('huaxue_disable');
  });

  it('plan_jisuanji (Computer Science) offers exploration or money bonus', () => {
    const ability = getPlanAbility('plan_jisuanji')!;
    expect(ability.trigger).toBe('on_turn_start');
    const result = ability.apply(createAbilityCtx('on_turn_start'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('jisuanji_bonus');
  });

  it('plan_kuangyaming (Kuang Yaming) offers GPA or exploration bonus', () => {
    const ability = getPlanAbility('plan_kuangyaming')!;
    expect(ability.trigger).toBe('on_turn_start');
    const result = ability.apply(createAbilityCtx('on_turn_start'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('kuangyaming_bonus');
  });
});

describe('Plan Abilities — on_card_draw trigger', () => {
  it('plan_xiandai (Modern Engineering) allows assigning card to other player', () => {
    const ability = getPlanAbility('plan_xiandai')!;
    expect(ability.trigger).toBe('on_card_draw');
    const result = ability.apply(createAbilityCtx('on_card_draw'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('xiandai_assign_card');
  });

  it('plan_daqi (Atmospheric Sciences) draws 3 cards to choose from', () => {
    const ability = getPlanAbility('plan_daqi')!;
    expect(ability.trigger).toBe('on_card_draw');
    const result = ability.apply(createAbilityCtx('on_card_draw'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('daqi_draw_three');
  });
});

describe('Plan Abilities — on_move trigger', () => {
  it('plan_huanjing (Environment) gains +2 exploration on move', () => {
    const ability = getPlanAbility('plan_huanjing')!;
    expect(ability.trigger).toBe('on_move');
    const result = ability.apply(createAbilityCtx('on_move'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.exploration).toBe(2);
  });
});

describe('Plan Abilities — passive trigger', () => {
  it('plan_shehuixue (Sociology) reduces win threshold', () => {
    const ability = getPlanAbility('plan_shehuixue')!;
    expect(ability.trigger).toBe('passive');
    const result = ability.apply(createAbilityCtx('passive'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('shehuixue_reduce_threshold');
  });

  it('plan_rengong (AI) reduces GPA threshold', () => {
    const ability = getPlanAbility('plan_rengong')!;
    expect(ability.trigger).toBe('passive');
    const result = ability.apply(createAbilityCtx('passive'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('rengong_reduce_threshold');
  });

  it('plan_ruanjian (Software) adjusts bankruptcy threshold', () => {
    const ability = getPlanAbility('plan_ruanjian')!;
    expect(ability.trigger).toBe('passive');
    const result = ability.apply(createAbilityCtx('passive'));
    expect(result).not.toBeNull();
    expect(result!.activated).toBe(true);
    expect(result!.effects?.customEffect).toBe('ruanjian_bankruptcy_threshold');
  });
});
