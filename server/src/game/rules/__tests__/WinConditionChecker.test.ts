// server/src/game/rules/__tests__/WinConditionChecker.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { WinConditionChecker } from '../WinConditionChecker.js';
import { Player, GameState, PlayerHistory, Position } from '@nannaricher/shared';

describe('WinConditionChecker', () => {
  let checker: WinConditionChecker;
  let mockPlayer: Player;
  let mockState: GameState;
  let mockHistory: PlayerHistory;

  beforeEach(() => {
    checker = new WinConditionChecker();

    const startPosition: Position = { type: 'main', index: 0 };

    mockPlayer = {
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
    };

    mockState = {
      roomId: 'test-room',
      phase: 'playing',
      currentPlayerIndex: 0,
      turnNumber: 1,
      roundNumber: 1,
      players: [mockPlayer],
      cardDecks: { chance: [], destiny: [], training: [] },
      discardPiles: { chance: [], destiny: [] },
      pendingAction: null,
      turnOrder: [0],
      turnOrderReversed: false,
      winner: null,
      log: [],
    };

    mockHistory = {
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
    };
  });

  describe('基础胜利条件', () => {
    it('GPA×10+探索值≥60时应该胜利', () => {
      mockPlayer.gpa = 5.0;
      mockPlayer.exploration = 10;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
      expect(result.condition).toContain('60');
    });

    it('GPA×10+探索值<60时不应该胜利', () => {
      mockPlayer.gpa = 3.0;
      mockPlayer.exploration = 10;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(false);
    });
  });

  describe('商学院胜利条件', () => {
    it('金钱达到5000时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_shangxue'];
      mockPlayer.money = 5000;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
      expect(result.condition).toContain('5000');
    });

    it('金钱4999时不应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_shangxue'];
      mockPlayer.money = 4999;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(false);
    });
  });

  describe('化学化工学院胜利条件', () => {
    it('探索值达到45时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_huaxue'];
      mockPlayer.exploration = 45;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
    });
  });

  describe('马克思主义学院胜利条件', () => {
    it('GPA达到4.5时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_makesi'];
      mockPlayer.gpa = 4.5;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
    });
  });

  describe('法学院胜利条件', () => {
    it('场上出现破产玩家且不是自己时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_faxue'];
      const bankruptPlayer = { ...mockPlayer, id: 'player2', isBankrupt: true };
      mockState.players = [mockPlayer, bankruptPlayer];

      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
    });

    it('自己破产时不能胜利', () => {
      mockPlayer.confirmedPlans = ['plan_faxue'];
      mockPlayer.isBankrupt = true;

      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(false);
    });
  });
});
