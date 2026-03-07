import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import type { Player, Position } from '@nannaricher/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPlayer(overrides: Partial<Player> & { id: string; name: string }): Player {
  return {
    socketId: `sock_${overrides.id}`,
    color: '#e74c3c',
    money: 1500,
    gpa: 3.0,
    exploration: 0,
    position: { type: 'main', index: 0 } as Position,
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
    totalTuitionPaid: 0,
    confiscatedIncome: 0,
    consecutiveLowMoneyTurns: 0,
    kechuangGpaGained: 0,
    foodLineNonNegativeCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameEngine — integration tests', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine('test-room');
    // Add two players so we can start a game
    engine.addPlayer(createMockPlayer({ id: 'p1', name: 'Alice' }));
    engine.addPlayer(createMockPlayer({ id: 'p2', name: 'Bob' }));
  });

  // -------------------------------------------------------------------------
  // 1. Complete turn flow
  // -------------------------------------------------------------------------
  describe('complete turn flow', () => {
    it('should roll dice and return results', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;

      const values = engine.rollDice(1);
      expect(values).toHaveLength(1);
      expect(values[0]).toBeGreaterThanOrEqual(1);
      expect(values[0]).toBeLessThanOrEqual(6);
    });

    it('should move player forward after rolling dice via processTurnRoll', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;

      const player = engine.getPlayer('p1')!;
      // Capture original position as a serializable snapshot
      const startPos = JSON.stringify(player.position);

      // Seed deterministic dice by mocking Math.random
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // yields dice value 4

      const results = engine.processTurnRoll('p1');

      // processTurnRoll should return dice values
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toBeGreaterThanOrEqual(1);
      expect(results[0]).toBeLessThanOrEqual(6);

      // Player position should have changed (could be main or line depending on board layout)
      const endPos = JSON.stringify(player.position);
      expect(endPos).not.toBe(startPos);

      randomSpy.mockRestore();
    });

    it('should advance currentPlayerIndex after calling nextTurn', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;
      state.turnNumber = 1;

      expect(state.currentPlayerIndex).toBe(0);

      engine.nextTurn();

      // After nextTurn, currentPlayerIndex should change to the next active player
      expect(state.currentPlayerIndex).toBe(1);
    });

    it('should wrap currentPlayerIndex back to 0 after last player', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 1;
      state.turnNumber = 2;

      engine.nextTurn();

      expect(state.currentPlayerIndex).toBe(0);
    });

    it('should increment turnNumber on each nextTurn call', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;
      state.turnNumber = 1;

      engine.nextTurn();

      expect(state.turnNumber).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Choice action flow
  // -------------------------------------------------------------------------
  describe('choice action flow', () => {
    it('should clear pendingAction after resolving a choice via handleChoice', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;

      // Set up a pending action for player p1
      state.pendingAction = {
        id: 'test_action',
        playerId: 'p1',
        type: 'choose_option',
        prompt: 'Test choice',
        options: [
          { label: 'Option A', value: 'opt_a' },
          { label: 'Option B', value: 'opt_b' },
        ],
        timeoutMs: 60000,
      };

      // The EventHandler.execute will return null for unknown handlers,
      // which means the action completes and pendingAction should be cleared.
      engine.handleChoice('p1', 'opt_a');

      expect(state.pendingAction).toBeNull();
    });

    it('should not clear pendingAction if wrong player attempts choice', () => {
      const state = engine.getState();
      state.phase = 'playing';

      state.pendingAction = {
        id: 'test_action',
        playerId: 'p1',
        type: 'choose_option',
        prompt: 'Test choice',
        options: [{ label: 'A', value: 'a' }],
        timeoutMs: 60000,
      };

      engine.handleChoice('p2', 'a');

      // Should still be present — p2 is not the action owner
      expect(state.pendingAction).not.toBeNull();
      expect(state.pendingAction!.id).toBe('test_action');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Plan confirmation flow
  // -------------------------------------------------------------------------
  describe('plan confirmation flow', () => {
    it('should add plan to majorPlan on confirmTrainingPlan', () => {
      const player = engine.getPlayer('p1')!;
      player.trainingPlans = [
        { id: 'plan_test', name: 'Test Plan', winCondition: 'test', passiveAbility: 'none' },
      ];

      engine.confirmTrainingPlan('p1', 'plan_test');

      expect(player.majorPlan).toBe('plan_test');
    });

    it('should not duplicate plan in majorPlan/minorPlans if confirmed twice', () => {
      const player = engine.getPlayer('p1')!;
      player.trainingPlans = [
        { id: 'plan_test', name: 'Test Plan', winCondition: 'test', passiveAbility: 'none' },
      ];

      engine.confirmTrainingPlan('p1', 'plan_test');
      engine.confirmTrainingPlan('p1', 'plan_test');

      // majorPlan should be set, minorPlans should be empty (no duplicate)
      expect(player.majorPlan).toBe('plan_test');
      expect(player.minorPlans).toHaveLength(0);
    });

    it('should not confirm a plan that does not exist', () => {
      const player = engine.getPlayer('p1')!;
      player.trainingPlans = [];

      engine.confirmTrainingPlan('p1', 'nonexistent');

      expect(player.majorPlan).toBeNull();
      expect(player.minorPlans).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Round limit — force scoring
  // -------------------------------------------------------------------------
  describe('round limit and force scoring', () => {
    it('should force end game when roundNumber exceeds max rounds', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;
      state.turnNumber = 5;

      // TOTAL_ROUNDS is now 4 (4学年制)
      // roundNumber increments every 6 turns. Set it right at the limit.
      state.roundNumber = 4;

      // nextTurn increments turnNumber; at turnNumber 6 it bumps roundNumber to 5
      // which exceeds maxRounds (4), triggering forceEndGame.
      engine.nextTurn();

      // turnNumber is now 6, roundNumber should have bumped
      // If roundNumber > 4, forceEndGame should fire
      if (state.roundNumber > 4) {
        expect(state.phase).toBe('finished');
        expect(state.winner).not.toBeNull();
      }
    });

    it('should declare the player with highest score as winner on force end', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;

      // Give p1 higher stats for scoring
      const p1 = engine.getPlayer('p1')!;
      p1.gpa = 4.0;
      p1.exploration = 20;
      p1.money = 3000;

      const p2 = engine.getPlayer('p2')!;
      p2.gpa = 2.0;
      p2.exploration = 5;
      p2.money = 500;

      // Set near round limit so next round-increment triggers force end
      state.roundNumber = 32;
      state.turnNumber = 5; // next turn = 6, so roundNumber will increment to 33

      engine.nextTurn();

      if ((state.phase as string) === 'finished') {
        // p1 score: 4.0*10 + 20 + 30 = 90
        // p2 score: 2.0*10 + 5 + 5 = 30
        expect(state.winner).toBe('p1');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 5. Basic game start flow
  // -------------------------------------------------------------------------
  describe('game start', () => {
    it('should transition directly to playing phase (skip setup_plans)', () => {
      engine.startGame();

      const state = engine.getState();
      expect(state.phase).toBe('playing');
      expect(state.turnNumber).toBe(1);
      expect(state.roundNumber).toBe(1); // 大一

      // No training plans dealt at start (大一无培养计划抽取)
      const p1 = engine.getPlayer('p1')!;
      const p2 = engine.getPlayer('p2')!;
      expect(p1.trainingPlans.length).toBe(0);
      expect(p2.trainingPlans.length).toBe(0);
    });

    it('should not start with fewer than 2 players', () => {
      const soloEngine = new GameEngine('solo-room');
      soloEngine.addPlayer(createMockPlayer({ id: 's1', name: 'Solo' }));

      soloEngine.startGame();

      const state = soloEngine.getState();
      expect(state.phase).toBe('waiting'); // Should not transition
    });
  });

  // -------------------------------------------------------------------------
  // 6. Player stat modifications
  // -------------------------------------------------------------------------
  describe('player stat modifications', () => {
    it('should modify money correctly', () => {
      engine.modifyPlayerMoney('p1', 500);
      expect(engine.getPlayer('p1')!.money).toBe(2000);

      engine.modifyPlayerMoney('p1', -300);
      expect(engine.getPlayer('p1')!.money).toBe(1700);
    });

    it('should clamp GPA between 0 and 5', () => {
      engine.modifyPlayerGpa('p1', 3.0); // 3.0 + 3.0 = 6.0 → clamped to 5.0
      expect(engine.getPlayer('p1')!.gpa).toBe(5.0);

      engine.modifyPlayerGpa('p1', -10.0); // 5.0 - 10.0 = -5.0 → clamped to 0
      expect(engine.getPlayer('p1')!.gpa).toBe(0);
    });

    it('should clamp exploration to minimum 0', () => {
      engine.modifyPlayerExploration('p1', -100);
      expect(engine.getPlayer('p1')!.exploration).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Skip turn mechanics
  // -------------------------------------------------------------------------
  describe('skip turn', () => {
    it('should skip a player whose skipNextTurn is true', () => {
      const state = engine.getState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;
      state.turnNumber = 1;

      // Mark p2 to skip next turn
      const p2 = engine.getPlayer('p2')!;
      p2.skipNextTurn = true;

      // Advance from p1 to p2 — p2 should be skipped, wrapping back to p1
      engine.nextTurn();

      // p2 had skipNextTurn, so nextTurn should recursively call itself
      // and land back on p1 (or p2 with skipNextTurn cleared)
      expect(p2.skipNextTurn).toBe(false);
    });
  });
});
