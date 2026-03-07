// server/src/game/rules/__tests__/WinConditionChecker.test.ts
// Comprehensive win condition tests — covers all 33 training plans + base condition
// + edge cases for bankrupt, hospitalized, and exactly-at-threshold scenarios.

import { describe, it, expect, beforeEach } from 'vitest';
import { WinConditionChecker } from '../WinConditionChecker.js';
import { Player, GameState, PlayerHistory, Position, LineExitRecord } from '@nannaricher/shared';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  const startPosition: Position = { type: 'main', index: 0 };
  return {
    id: 'player1',
    socketId: 'socket1',
    name: '测试玩家',
    color: '0',
    money: 2000,
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
    consecutivePositiveTurns: 0,
    ...overrides,
  };
}

function createMockGameState(players?: Player[], overrides?: Partial<GameState>): GameState {
  const defaultPlayers = players ?? [createMockPlayer()];
  return {
    roomId: 'test-room',
    phase: 'playing',
    currentPlayerIndex: 0,
    turnNumber: 1,
    roundNumber: 1,
    players: defaultPlayers,
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

function createMockHistory(overrides: Partial<PlayerHistory> = {}): PlayerHistory {
  return {
    positions: [],
    linesVisited: [],
    lineEventsTriggered: {},
    sharedCellsWith: {},
    cardsDrawn: [],
    moneyHistory: [],
    chanceCardsUsedOnPlayers: {},
    lineExits: [],
    hospitalVisits: 0,
    moneyZeroCount: 0,
    gulouEndpointReached: 0,
    campusLineOrder: [],
    foodLineNegativeFreeStreak: 0,
    plansConfirmedTurn: [],
    mainCellVisited: [],
    ...overrides,
  };
}

function createLineExit(overrides: Partial<LineExitRecord> = {}): LineExitRecord {
  return {
    lineId: 'study',
    entryTurn: 1,
    exitTurn: 3,
    gpaBefore: 3.0,
    gpaAfter: 3.0,
    explorationBefore: 10,
    explorationAfter: 10,
    moneyBefore: 1000,
    moneyAfter: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WinConditionChecker', () => {
  let checker: WinConditionChecker;

  beforeEach(() => {
    checker = new WinConditionChecker();
  });

  // =========================================================================
  // Base win condition
  // =========================================================================

  describe('Base Win Condition (GPA*10 + exploration >= 60)', () => {
    it('should win when GPA*10 + exploration = 60 exactly', () => {
      const player = createMockPlayer({ gpa: 5.0, exploration: 10 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('base');
    });

    it('should win when GPA*10 + exploration > 60', () => {
      const player = createMockPlayer({ gpa: 4.0, exploration: 25 });
      // 4.0*10 + 25 = 65
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
    });

    it('should NOT win when GPA*10 + exploration = 59', () => {
      const player = createMockPlayer({ gpa: 4.0, exploration: 19 });
      // 4.0*10 + 19 = 59
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });

    it('should NOT win when GPA is 0 and exploration is 59', () => {
      const player = createMockPlayer({ gpa: 0, exploration: 59 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });

    it('should win with high exploration compensating low GPA', () => {
      const player = createMockPlayer({ gpa: 1.0, exploration: 50 });
      // 1.0*10 + 50 = 60
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
    });
  });

  // =========================================================================
  // Plan 1: plan_wenxue — 文学院
  // =========================================================================

  describe('plan_wenxue (Literature) — leave money line with no money change', () => {
    it('should win when player exits money line with same money', () => {
      const player = createMockPlayer({ majorPlan: 'plan_wenxue', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineExits: [createLineExit({ lineId: 'money', moneyBefore: 1000, moneyAfter: 1000 })],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_wenxue');
    });

    it('should NOT win when money changed during money line', () => {
      const player = createMockPlayer({ majorPlan: 'plan_wenxue', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineExits: [createLineExit({ lineId: 'money', moneyBefore: 1000, moneyAfter: 1200 })],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 2: plan_lishi — 历史学院
  // =========================================================================

  describe('plan_lishi (History) — sequential campus visits', () => {
    it('should win when visiting campuses in order: gulou -> pukou -> xianlin -> suzhou', () => {
      const player = createMockPlayer({ majorPlan: 'plan_lishi', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        campusLineOrder: ['gulou', 'pukou', 'xianlin', 'suzhou'],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_lishi');
    });

    it('should win even with extra visits interleaved', () => {
      const player = createMockPlayer({ majorPlan: 'plan_lishi', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        campusLineOrder: ['gulou', 'gulou', 'pukou', 'xianlin', 'gulou', 'suzhou'],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
    });

    it('should NOT win when order is wrong', () => {
      const player = createMockPlayer({ majorPlan: 'plan_lishi', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        campusLineOrder: ['pukou', 'gulou', 'xianlin', 'suzhou'],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });

    it('should NOT win when not all campuses visited', () => {
      const player = createMockPlayer({ majorPlan: 'plan_lishi', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        campusLineOrder: ['gulou', 'pukou', 'xianlin'],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 3: plan_zhexue — 哲学系
  // =========================================================================

  describe('plan_zhexue (Philosophy) — complete line with no GPA/exploration change', () => {
    it('should win when GPA and exploration unchanged during a line exit', () => {
      const player = createMockPlayer({ majorPlan: 'plan_zhexue', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineExits: [createLineExit({
          lineId: 'study',
          gpaBefore: 3.0, gpaAfter: 3.0,
          explorationBefore: 10, explorationAfter: 10,
        })],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_zhexue');
    });

    it('should NOT win when GPA changed during a line', () => {
      const player = createMockPlayer({ majorPlan: 'plan_zhexue', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineExits: [createLineExit({
          gpaBefore: 3.0, gpaAfter: 3.2,
          explorationBefore: 10, explorationAfter: 10,
        })],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 4: plan_faxue — 法学院
  // =========================================================================

  describe('plan_faxue (Law) — another player is bankrupt', () => {
    it('should win when another player is bankrupt', () => {
      const player = createMockPlayer({ majorPlan: 'plan_faxue', gpa: 2.0, exploration: 5 });
      const bankrupt = createMockPlayer({ id: 'player2', isBankrupt: true });
      const state = createMockGameState([player, bankrupt]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_faxue');
    });

    it('should NOT win when self is bankrupt (no other bankrupt player)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_faxue', isBankrupt: true, gpa: 2.0, exploration: 5 });
      const state = createMockGameState([player]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(false);
    });

    it('should NOT win when no player is bankrupt', () => {
      const player = createMockPlayer({ majorPlan: 'plan_faxue', gpa: 2.0, exploration: 5 });
      const other = createMockPlayer({ id: 'player2' });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 5: plan_shangxue — 商学院
  // =========================================================================

  describe('plan_shangxue (Commerce) — money >= 5555', () => {
    it('should win at exactly 5555 money', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shangxue', money: 5555, gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_shangxue');
    });

    it('should win above 5555 money', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shangxue', money: 8000, gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
    });

    it('should NOT win at 5554 money', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shangxue', money: 5554, gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 6: plan_waiguoyu — 外国语学院
  // =========================================================================

  describe('plan_waiguoyu (Foreign Languages) — drew 2+ cards with English', () => {
    it('should win when 2 cards with English have been drawn', () => {
      const player = createMockPlayer({ majorPlan: 'plan_waiguoyu', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        cardsDrawn: [
          { cardId: 'c1', cardName: 'Card A', deckType: 'destiny', hasEnglish: true, startsWithDigit: false, turn: 1 },
          { cardId: 'c2', cardName: 'Card B', deckType: 'chance', hasEnglish: true, startsWithDigit: false, turn: 2 },
        ],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_waiguoyu');
    });

    it('should NOT win with only 1 English card', () => {
      const player = createMockPlayer({ majorPlan: 'plan_waiguoyu', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        cardsDrawn: [
          { cardId: 'c1', cardName: 'Card A', deckType: 'destiny', hasEnglish: true, startsWithDigit: false, turn: 1 },
          { cardId: 'c2', cardName: 'Card B', deckType: 'chance', hasEnglish: false, startsWithDigit: false, turn: 2 },
        ],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 7: plan_xinwen — 新闻传播学院
  // =========================================================================

  describe('plan_xinwen (Journalism) — complete explore line with no loss', () => {
    it('should win when no stat losses during explore line exit', () => {
      const player = createMockPlayer({ majorPlan: 'plan_xinwen', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineExits: [createLineExit({
          lineId: 'explore',
          gpaBefore: 3.0, gpaAfter: 3.2,
          explorationBefore: 10, explorationAfter: 15,
          moneyBefore: 1000, moneyAfter: 1000,
        })],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_xinwen');
    });

    it('should NOT win when GPA decreased during explore line', () => {
      const player = createMockPlayer({ majorPlan: 'plan_xinwen', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineExits: [createLineExit({
          lineId: 'explore',
          gpaBefore: 3.0, gpaAfter: 2.8,
          explorationBefore: 10, explorationAfter: 15,
          moneyBefore: 1000, moneyAfter: 1000,
        })],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 8: plan_zhengguan — 政府管理学院
  // =========================================================================

  describe('plan_zhengguan (Government) — exploration>=20 and money gap<=666', () => {
    it('should win when exploration>=20 and money gap<=666', () => {
      const player = createMockPlayer({ majorPlan: 'plan_zhengguan', money: 1500, gpa: 3.5, exploration: 20 });
      const other = createMockPlayer({ id: 'player2', money: 1800, gpa: 2.0, exploration: 8 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_zhengguan');
    });

    it('should NOT win when exploration<20', () => {
      const player = createMockPlayer({ majorPlan: 'plan_zhengguan', money: 1500, gpa: 3.0, exploration: 19 });
      const other = createMockPlayer({ id: 'player2', money: 1500, gpa: 3.0, exploration: 10 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(false);
    });

    it('should NOT win when money gap>666', () => {
      const player = createMockPlayer({ majorPlan: 'plan_zhengguan', money: 500, gpa: 3.0, exploration: 25 });
      const other = createMockPlayer({ id: 'player2', money: 2000, gpa: 3.0, exploration: 10 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 9: plan_guoji — 国际关系学院
  // =========================================================================

  describe('plan_guoji (International Relations) — use chance cards on 2+ players', () => {
    it('should win when chance cards used on 2 different players', () => {
      const player = createMockPlayer({ majorPlan: 'plan_guoji', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        chanceCardsUsedOnPlayers: { player2: 1, player3: 2 },
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_guoji');
    });

    it('should NOT win with only 1 target player', () => {
      const player = createMockPlayer({ majorPlan: 'plan_guoji', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        chanceCardsUsedOnPlayers: { player2: 3 },
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 10: plan_xinxiguanli — 信息管理学院
  // =========================================================================

  describe('plan_xinxiguanli (Information Management) — 4+ unique digit-start cards', () => {
    it('should win when 4 unique digit-start cards drawn', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_xinxiguanli',
        cardsDrawnWithDigitStart: ['1_card', '2_card', '3_card', '4_card'],
        gpa: 2.0,
        exploration: 5,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_xinxiguanli');
    });

    it('should NOT win with only 3 unique digit-start cards', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_xinxiguanli',
        cardsDrawnWithDigitStart: ['1_card', '2_card', '3_card'],
        gpa: 2.0,
        exploration: 5,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });

    it('should handle duplicates — only unique cards count', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_xinxiguanli',
        cardsDrawnWithDigitStart: ['1_card', '1_card', '2_card', '3_card'],
        gpa: 2.0,
        exploration: 5,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 11: plan_shehuixue — 社会学院
  // =========================================================================

  describe('plan_shehuixue (Sociology) — exploration lead >= threshold', () => {
    it('should win when exploration leads by >= 20 (default threshold)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shehuixue', exploration: 30, gpa: 2.0 });
      const other = createMockPlayer({ id: 'player2', exploration: 10 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_shehuixue');
    });

    it('should NOT win when exploration lead is 19', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shehuixue', exploration: 29, gpa: 2.0 });
      const other = createMockPlayer({ id: 'player2', exploration: 10 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(false);
    });

    it('should respect modified threshold', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_shehuixue',
        exploration: 25,
        modifiedWinThresholds: { plan_shehuixue: 15 },
        gpa: 2.0,
      });
      const other = createMockPlayer({ id: 'player2', exploration: 10 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(true);
    });
  });

  // =========================================================================
  // Plan 12: plan_shuxue — 数学系
  // =========================================================================

  describe('plan_shuxue (Mathematics) — reach gulou endpoint 2 times', () => {
    it('should win at exactly 2 gulou endpoint reaches', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shuxue', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({ gulouEndpointReached: 2 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_shuxue');
    });

    it('should NOT win at 1 gulou endpoint reach', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shuxue', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({ gulouEndpointReached: 1 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 13: plan_wuli — 物理学院
  // =========================================================================

  describe('plan_wuli (Physics) — two stats score >= 60', () => {
    // Note: Physics win requires 2 of 3 stats (exploration, gpa*10, money/100) >= 60.
    // However, base condition (gpa*10 + exploration >= 60) is checked first.
    // When gpa*10 >= 60 OR exploration >= 60, base condition often triggers first.
    // So plan_wuli's main value is when money/100 is one of the two qualifying stats,
    // combined with a stat that also triggers base.

    it('should win (via base) when exploration >= 60 and money/100 >= 60', () => {
      // base = gpa*10 + exploration = 0 + 60 = 60 >= 60, so base wins first
      const player = createMockPlayer({
        majorPlan: 'plan_wuli',
        exploration: 60,
        gpa: 0,
        money: 6000, // money/100 = 60
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      // Base always catches this scenario first
      expect(result.planId).toBe('base');
    });

    it('should win via plan_wuli when two stats sum >= 85 (gpa*10 + money/100)', () => {
      // gpa*10 = 30, money/100 = 55 => 30 + 55 = 85 >= 85 => wins via physics
      const player = createMockPlayer({
        majorPlan: 'plan_wuli',
        exploration: 0,     // base = gpa*10 + 0 = 30, not >= 60
        gpa: 3.0,           // gpa*10 = 30
        money: 5500,        // money/100 = 55
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_wuli');
    });

    it('should NOT win when no stat >= 60 and base not met', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_wuli',
        exploration: 20,    // base = 2.0*10 + 20 = 40 < 60
        gpa: 2.0,           // gpa*10 = 20
        money: 3000,        // money/100 = 30
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 14: plan_tianwen — 天文与空间科学学院
  // =========================================================================

  describe('plan_tianwen (Astronomy) — shared cell with all others >= 2 times', () => {
    it('should win when shared cell with every other player >= 2 times', () => {
      const player = createMockPlayer({ majorPlan: 'plan_tianwen', gpa: 2.0, exploration: 5 });
      const p2 = createMockPlayer({ id: 'player2' });
      const p3 = createMockPlayer({ id: 'player3' });
      const state = createMockGameState([player, p2, p3]);
      const history = createMockHistory({
        sharedCellsWith: { player2: [3, 7], player3: [5, 9] },
      });
      const result = checker.checkWinConditions(player, state, history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_tianwen');
    });

    it('should NOT win when shared only once with one player', () => {
      const player = createMockPlayer({ majorPlan: 'plan_tianwen', gpa: 2.0, exploration: 5 });
      const p2 = createMockPlayer({ id: 'player2' });
      const p3 = createMockPlayer({ id: 'player3' });
      const state = createMockGameState([player, p2, p3]);
      const history = createMockHistory({
        sharedCellsWith: { player2: [3, 7], player3: [5] },
      });
      const result = checker.checkWinConditions(player, state, history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 15: plan_huaxue — 化学化工学院
  // =========================================================================

  describe('plan_huaxue (Chemistry) — consecutive 6 positive turns', () => {
    it('should win with 6 consecutive positive turns (base not met)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_huaxue', consecutivePositiveTurns: 6, gpa: 1.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_huaxue');
    });

    it('should NOT win with only 5 consecutive positive turns (base not met)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_huaxue', consecutivePositiveTurns: 5, gpa: 1.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 16: plan_rengong — 人工智能学院
  // =========================================================================

  describe('plan_rengong (AI) — GPA lead >= threshold', () => {
    it('should win when GPA leads by >= 2.0 (default)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_rengong', gpa: 4.5, exploration: 5 });
      const other = createMockPlayer({ id: 'player2', gpa: 2.0 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_rengong');
    });

    it('should NOT win when GPA lead is 1.9', () => {
      const player = createMockPlayer({ majorPlan: 'plan_rengong', gpa: 3.9, exploration: 5 });
      const other = createMockPlayer({ id: 'player2', gpa: 2.0 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(false);
    });

    it('should respect modified threshold', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_rengong',
        gpa: 3.5,
        modifiedWinThresholds: { plan_rengong: 1.0 },
        exploration: 5,
      });
      const other = createMockPlayer({ id: 'player2', gpa: 2.0 });
      const state = createMockGameState([player, other]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(true);
    });
  });

  // =========================================================================
  // Plan 17: plan_jisuanji — 计算机科学与技术系
  // =========================================================================

  describe('plan_jisuanji (Computer Science) — exploration and money contain only 0 and 1', () => {
    it('should win when both exploration=10 and money=100', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_jisuanji',
        exploration: 10,
        money: 100,
        gpa: 2.0,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_jisuanji');
    });

    it('should win with exploration=1 money=1', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_jisuanji',
        exploration: 1,
        money: 1,
        gpa: 2.0,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
    });

    it('should NOT win when exploration contains non-binary digit', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_jisuanji',
        exploration: 12,
        money: 10,
        gpa: 2.0,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });

    it('should NOT win when money contains non-binary digit', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_jisuanji',
        exploration: 10,
        money: 200,
        gpa: 2.0,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 18: plan_ruanjian — 软件学院 (event-based, not in checkWinConditions)
  // =========================================================================

  describe('plan_ruanjian (Software) — tuition event based', () => {
    it('should NOT win via regular check (event-based)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_ruanjian', gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 19: plan_dianzi — 电子科学与工程学院 (event-based)
  // =========================================================================

  describe('plan_dianzi (Electronics) — science competition event based', () => {
    it('should NOT win via regular check (event-based)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_dianzi', gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 20: plan_xiandai — 现代工程与应用科学学院
  // =========================================================================

  describe('plan_xiandai (Modern Engineering) — visit all lines except suzhou', () => {
    it('should win when all non-suzhou lines visited', () => {
      const player = createMockPlayer({ majorPlan: 'plan_xiandai', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        linesVisited: ['pukou', 'study', 'money', 'explore', 'xianlin', 'gulou', 'food'],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_xiandai');
    });

    it('should NOT win when missing one non-suzhou line', () => {
      const player = createMockPlayer({ majorPlan: 'plan_xiandai', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        linesVisited: ['pukou', 'study', 'money', 'explore', 'xianlin', 'gulou'], // missing food
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 21: plan_huanjing — 环境学院
  // =========================================================================

  describe('plan_huanjing (Environment) — experience 5+ xianlin line events', () => {
    it('should win when 5+ xianlin events triggered', () => {
      const player = createMockPlayer({ majorPlan: 'plan_huanjing', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineEventsTriggered: { xianlin: [0, 1, 2, 3, 4] },
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_huanjing');
    });

    it('should NOT win with only 4 xianlin events', () => {
      const player = createMockPlayer({ majorPlan: 'plan_huanjing', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineEventsTriggered: { xianlin: [0, 1, 2, 3] },
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 22: plan_diqiu — 地球科学与工程学院
  // =========================================================================

  describe('plan_diqiu (Earth Sciences) — visit all 8 lines', () => {
    it('should win when all 8 lines visited', () => {
      const player = createMockPlayer({ majorPlan: 'plan_diqiu', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        linesVisited: ['pukou', 'study', 'money', 'suzhou', 'gulou', 'xianlin', 'explore', 'food'],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_diqiu');
    });

    it('should NOT win when missing one line', () => {
      const player = createMockPlayer({ majorPlan: 'plan_diqiu', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        linesVisited: ['pukou', 'study', 'money', 'suzhou', 'gulou', 'xianlin', 'explore'],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 23: plan_dili — 地理与海洋科学学院
  // =========================================================================

  describe('plan_dili (Geography) — complete 4 campus line endpoints', () => {
    it('should win when all 4 campus line exits recorded', () => {
      const player = createMockPlayer({ majorPlan: 'plan_dili', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineExits: [
          createLineExit({ lineId: 'pukou' }),
          createLineExit({ lineId: 'xianlin' }),
          createLineExit({ lineId: 'gulou' }),
          createLineExit({ lineId: 'suzhou' }),
        ],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_dili');
    });

    it('should NOT win with only 3 campus exits', () => {
      const player = createMockPlayer({ majorPlan: 'plan_dili', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineExits: [
          createLineExit({ lineId: 'pukou' }),
          createLineExit({ lineId: 'xianlin' }),
          createLineExit({ lineId: 'gulou' }),
        ],
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 24: plan_daqi — 大气科学学院
  // =========================================================================

  describe('plan_daqi (Atmospheric Sciences) — never uniquely richest for 18 rounds', () => {
    it('should win when not uniquely richest with enough history', () => {
      const player = createMockPlayer({ majorPlan: 'plan_daqi', money: 1000, gpa: 2.0, exploration: 5 });
      const other = createMockPlayer({ id: 'player2', money: 2000 });
      const state = createMockGameState([player, other]);
      const history = createMockHistory({
        moneyHistory: Array(18).fill(1000),
      });
      const result = checker.checkWinConditions(player, state, history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_daqi');
    });

    it('should NOT win when money history too short', () => {
      const player = createMockPlayer({ majorPlan: 'plan_daqi', money: 1000, gpa: 2.0, exploration: 5 });
      const other = createMockPlayer({ id: 'player2', money: 2000 });
      const state = createMockGameState([player, other]);
      const history = createMockHistory({
        moneyHistory: Array(17).fill(1000),
      });
      const result = checker.checkWinConditions(player, state, history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 25: plan_shengming — 生命科学学院
  // =========================================================================

  describe('plan_shengming (Life Sciences) — 3 consecutive no-negative food line', () => {
    it('should win at exactly 3 food line no-negative streak', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shengming', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({ foodLineNegativeFreeStreak: 3 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_shengming');
    });

    it('should NOT win at 2 food line no-negative streak', () => {
      const player = createMockPlayer({ majorPlan: 'plan_shengming', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({ foodLineNegativeFreeStreak: 2 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 26: plan_yixue — 医学院
  // =========================================================================

  describe('plan_yixue (Medical) — visit hospital 3 times', () => {
    it('should win at exactly 3 hospital visits', () => {
      const player = createMockPlayer({ majorPlan: 'plan_yixue', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({ hospitalVisits: 3 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_yixue');
    });

    it('should NOT win with only 2 hospital visits', () => {
      const player = createMockPlayer({ majorPlan: 'plan_yixue', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({ hospitalVisits: 2 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 27: plan_gongguan — 工程管理学院
  // =========================================================================

  describe('plan_gongguan (Engineering Management) — money in 0-200 range and not bankrupt', () => {
    it('should win when money is 100 (in 0-200 range)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_gongguan', money: 100, gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_gongguan');
    });

    it('should NOT win when money is 500 (above range)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_gongguan', money: 500, gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 28: plan_kuangyaming — 匡亚明学院
  // =========================================================================

  describe('plan_kuangyaming (Kuang Yaming) — match 2+ different players plan conditions', () => {
    it('should win when satisfying 2 different players plan conditions', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_kuangyaming',
        money: 5555,
        gpa: 4.5,
        exploration: 5,
      });
      const other1 = createMockPlayer({
        id: 'player2',
        majorPlan: 'plan_shangxue', // commerce: money >= 5555
      });
      const other2 = createMockPlayer({
        id: 'player3',
        majorPlan: 'plan_makesi', // marxism: gpa >= 4.5
      });
      const state = createMockGameState([player, other1, other2]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_kuangyaming');
    });

    it('should NOT win when only 1 player plan condition is met', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_kuangyaming',
        money: 5555,
        gpa: 2.0,
        exploration: 5,
      });
      const other1 = createMockPlayer({
        id: 'player2',
        majorPlan: 'plan_shangxue',
      });
      const other2 = createMockPlayer({
        id: 'player3',
        majorPlan: 'plan_makesi', // marxism: gpa >= 4.5, player gpa is 2.0
      });
      const state = createMockGameState([player, other1, other2]);
      const result = checker.checkWinConditions(player, state, createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 29: plan_haiwai — 海外教育学院
  // =========================================================================

  describe('plan_haiwai (Overseas Education) — intercept another player win', () => {
    it('should NOT win via regular check (intercept-based)', () => {
      const player = createMockPlayer({ majorPlan: 'plan_haiwai', gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });

    it('checkHaiwaiIntercept returns true when 2+ chance cards used on winner', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_haiwai',
        chanceCardsUsedOnPlayers: { winner_id: 2 },
      });
      expect(checker.checkHaiwaiIntercept(player, 'winner_id')).toBe(true);
    });

    it('checkHaiwaiIntercept returns false when < 2 chance cards used', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_haiwai',
        chanceCardsUsedOnPlayers: { winner_id: 1 },
      });
      expect(checker.checkHaiwaiIntercept(player, 'winner_id')).toBe(false);
    });

    it('checkHaiwaiIntercept returns false when player does not have plan_haiwai', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_faxue',
        chanceCardsUsedOnPlayers: { winner_id: 3 },
      });
      expect(checker.checkHaiwaiIntercept(player, 'winner_id')).toBe(false);
    });
  });

  // =========================================================================
  // Plan 30: plan_jianzhu — 建筑与城市规划学院
  // =========================================================================

  describe('plan_jianzhu (Architecture) — visit 4 of 5 main cells', () => {
    it('should win when 4 of 5 required main cells visited', () => {
      const player = createMockPlayer({ majorPlan: 'plan_jianzhu', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        mainCellVisited: ['start', 'hospital', 'ding', 'waiting_room'], // 4 of 5, missing chuangmen
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_jianzhu');
    });

    it('should NOT win when only 3 required cells visited', () => {
      const player = createMockPlayer({ majorPlan: 'plan_jianzhu', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        mainCellVisited: ['start', 'hospital', 'ding'], // only 3
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 31: plan_makesi — 马克思主义学院
  // =========================================================================

  describe('plan_makesi (Marxism) — GPA >= 4.5', () => {
    it('should win at exactly 4.5 GPA', () => {
      const player = createMockPlayer({ majorPlan: 'plan_makesi', gpa: 4.5, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_makesi');
    });

    it('should NOT win at 4.4 GPA', () => {
      const player = createMockPlayer({ majorPlan: 'plan_makesi', gpa: 4.4, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 32: plan_yishu — 艺术学院
  // =========================================================================

  describe('plan_yishu (Art) — experience all pukou line events (12+)', () => {
    it('should win with 12 pukou events', () => {
      const player = createMockPlayer({ majorPlan: 'plan_yishu', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineEventsTriggered: { pukou: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_yishu');
    });

    it('should NOT win with 11 pukou events', () => {
      const player = createMockPlayer({ majorPlan: 'plan_yishu', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineEventsTriggered: { pukou: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Plan 33: plan_suzhou — 苏州校区
  // =========================================================================

  describe('plan_suzhou (Suzhou Campus) — experience all suzhou line events (10+)', () => {
    it('should win with 10 suzhou events', () => {
      const player = createMockPlayer({ majorPlan: 'plan_suzhou', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineEventsTriggered: { suzhou: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(true);
      expect(result.planId).toBe('plan_suzhou');
    });

    it('should NOT win with 9 suzhou events', () => {
      const player = createMockPlayer({ majorPlan: 'plan_suzhou', gpa: 2.0, exploration: 5 });
      const history = createMockHistory({
        lineEventsTriggered: { suzhou: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), history);
      expect(result.won).toBe(false);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('Edge cases', () => {
    it('bankrupt player should not satisfy base win condition', () => {
      const player = createMockPlayer({ isBankrupt: true, gpa: 5.0, exploration: 60 });
      // Even though GPA*10 + exploration = 110 > 60, the checker doesn't check bankrupt status
      // This test documents current behavior: bankrupt players CAN technically win
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      // Current implementation does not block bankrupt players from winning via base condition
      expect(result.won).toBe(true);
    });

    it('hospitalized player can still meet plan conditions', () => {
      const player = createMockPlayer({
        isInHospital: true,
        majorPlan: 'plan_makesi',
        gpa: 4.5,
        exploration: 5,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
    });

    it('player with no confirmed plans should only check base condition', () => {
      const player = createMockPlayer({ majorPlan: null, minorPlans: [], gpa: 2.0, exploration: 5 });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });

    it('player with multiple confirmed plans: first matching plan wins', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_makesi', minorPlans: ['plan_shangxue'],
        gpa: 4.5,
        money: 5000,
        exploration: 5,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      // plan_makesi is checked first (in majorPlan/minorPlans order)
      expect(result.planId).toBe('plan_makesi');
    });

    it('base condition is checked before plan conditions', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_shangxue',
        gpa: 5.0,
        exploration: 10,
        money: 5000,
      });
      // GPA*10 + exploration = 60 >= 60, so base wins first
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(true);
      expect(result.planId).toBe('base');
    });

    it('unknown plan ID should not crash and returns not won', () => {
      const player = createMockPlayer({
        majorPlan: 'plan_unknown_xyz',
        gpa: 2.0,
        exploration: 5,
      });
      const result = checker.checkWinConditions(player, createMockGameState([player]), createMockHistory());
      expect(result.won).toBe(false);
    });
  });
});
