// server/src/services/achievementService.ts — Achievement checking and stats tracking
import { getDatabase } from '../db/database.js';
import { ACHIEVEMENTS, getRank } from '@nannaricher/shared';
import type { Player, GameState } from '@nannaricher/shared';
import type {
  AchievementDef,
  AchievementProgress,
  PlayerAchievement,
  PlayerAchievementSummary,
  GameSessionStats,
} from '@nannaricher/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerStatsRow {
  user_id: string;
  total_games: number;
  total_wins: number;
  total_bankruptcies: number;
  last_game_bankrupt: number;
  current_win_streak: number;
  max_win_streak: number;
  current_loss_streak: number;
  total_money_earned: number;
  total_gpa_sum: number;
  total_cards_drawn: number;
  total_defense_cards_used: number;
  total_dice_rolls: number;
  total_dice_six_count: number;
  total_hospital_escapes: number;
  total_votes_participated: number;
  total_redistribution_cards: number;
  total_steal_cards: number;
  total_start_passes: number;
  lines_ever_visited: string;   // JSON string[]
  plans_ever_used: string;      // JSON string[]
  opponents_played: string;     // JSON string[]
  line_visit_counts: string;    // JSON Record<string,number>
  food_events_triggered: string; // JSON string[]
  consecutive_gpa_above_3: number;
  best_gpa: number;
  max_money: number;
  max_exploration: number;
  plans_won_with: string;     // JSON string[] — plan IDs used when winning
  updated_at: string;
}

interface EvaluationContext {
  player: Player;
  isWinner: boolean;
  gameState: GameState;
  stats: PlayerStatsRow;
  preUpdateStats: PlayerStatsRow; // stats BEFORE this game's update (for streak checks)
  sessionStats: Partial<GameSessionStats>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Compute composite score: GPA×10 + exploration (matches game's base win condition) */
function compositeScore(player: Player): number {
  return player.gpa * 10 + player.exploration;
}

// ─── Function 1: ensurePlayerStats ───────────────────────────────────────────

function ensurePlayerStats(userId: string): PlayerStatsRow {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO player_stats (user_id)
    VALUES (?)
  `).run(userId);
  return db.prepare('SELECT * FROM player_stats WHERE user_id = ?').get(userId) as PlayerStatsRow;
}

// ─── Function 2: updatePlayerStats ───────────────────────────────────────────

export function updatePlayerStats(
  userId: string,
  player: Player,
  isWinner: boolean,
  gameState: GameState,
  sessionStats?: Partial<GameSessionStats>,
): { stats: PlayerStatsRow; preUpdateStats: PlayerStatsRow } {
  const db = getDatabase();
  const existing = ensurePlayerStats(userId);
  // Snapshot pre-update stats for streak-based achievements (surv_05, surv_14)
  const preUpdateStats = { ...existing };

  // Merge lines_ever_visited
  const linesEver = new Set<string>(parseJSON<string[]>(existing.lines_ever_visited, []));
  for (const line of player.linesVisited ?? []) {
    linesEver.add(line);
  }

  // Merge line_visit_counts
  const visitCounts = parseJSON<Record<string, number>>(existing.line_visit_counts, {});
  for (const line of player.linesVisited ?? []) {
    visitCounts[line] = (visitCounts[line] ?? 0) + 1;
  }

  // Merge plans_ever_used
  const plansEver = new Set<string>(parseJSON<string[]>(existing.plans_ever_used, []));
  for (const plan of player.trainingPlans ?? []) {
    if (plan?.id) plansEver.add(plan.id);
  }

  // Merge opponents_played (other authenticated player userIds)
  const opponentsEver = new Set<string>(parseJSON<string[]>(existing.opponents_played, []));
  for (const p of gameState.players) {
    if (p.id !== player.id && p.userId && p.authVerified) {
      opponentsEver.add(p.userId);
    }
  }

  // Streaks
  let winStreak = existing.current_win_streak;
  let lossStreak = existing.current_loss_streak;
  let maxWinStreak = existing.max_win_streak;

  if (isWinner) {
    winStreak += 1;
    lossStreak = 0;
    if (winStreak > maxWinStreak) maxWinStreak = winStreak;
  } else {
    lossStreak += 1;
    winStreak = 0;
  }

  // Consecutive GPA above 3
  let consecutiveGpa = existing.consecutive_gpa_above_3;
  if (player.gpa >= 3.0) {
    consecutiveGpa += 1;
  } else {
    consecutiveGpa = 0;
  }

  // Best GPA, max money, max exploration
  const bestGpa = Math.max(existing.best_gpa, player.gpa ?? 0);
  const maxMoney = Math.max(existing.max_money, player.money ?? 0);
  const maxExploration = Math.max(existing.max_exploration, player.exploration ?? 0);

  // Merge plans_won_with: append current plan IDs if player won
  const plansWonWith = parseJSON<string[]>(existing.plans_won_with, []);
  if (isWinner && player.trainingPlans?.length) {
    for (const plan of player.trainingPlans) {
      if (plan?.id && !plansWonWith.includes(plan.id)) {
        plansWonWith.push(plan.id);
      }
    }
  }

  // Merge food_events_triggered (keep existing; new food events tracked elsewhere)
  const existingFoodEvents = parseJSON<string[]>(existing.food_events_triggered, []);
  const foodEventsJson = JSON.stringify(existingFoodEvents);

  db.prepare(`
    UPDATE player_stats SET
      total_games = total_games + 1,
      total_wins = total_wins + ?,
      total_bankruptcies = total_bankruptcies + ?,
      last_game_bankrupt = ?,
      current_win_streak = ?,
      max_win_streak = ?,
      current_loss_streak = ?,
      total_money_earned = total_money_earned + ?,
      total_gpa_sum = total_gpa_sum + ?,
      total_cards_drawn = total_cards_drawn + ?,
      total_defense_cards_used = total_defense_cards_used + ?,
      total_dice_rolls = total_dice_rolls + ?,
      total_dice_six_count = total_dice_six_count + ?,
      total_hospital_escapes = total_hospital_escapes + ?,
      total_votes_participated = total_votes_participated + ?,
      total_redistribution_cards = total_redistribution_cards + ?,
      total_steal_cards = total_steal_cards + ?,
      total_start_passes = total_start_passes + ?,
      food_events_triggered = ?,
      lines_ever_visited = ?,
      line_visit_counts = ?,
      plans_ever_used = ?,
      opponents_played = ?,
      consecutive_gpa_above_3 = ?,
      best_gpa = ?,
      max_money = ?,
      max_exploration = ?,
      plans_won_with = ?,
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(
    isWinner ? 1 : 0,
    player.isBankrupt ? 1 : 0,
    player.isBankrupt ? 1 : 0,
    winStreak,
    maxWinStreak,
    lossStreak,
    player.money ?? 0,
    player.gpa ?? 0,
    sessionStats?.cardsDrawn?.length ?? 0,
    sessionStats?.defenseCardsUsed ?? 0,
    sessionStats?.diceRolls?.length ?? 0,
    sessionStats?.diceRolls?.filter(v => v === 6).length ?? 0,
    sessionStats?.hospitalEscapes ?? 0,
    sessionStats?.votesMajoritySide ?? 0,
    sessionStats?.redistributionCardsUsed ?? 0,
    sessionStats?.stealCardsUsed ?? 0,
    sessionStats?.startPassCount ?? 0,
    foodEventsJson,
    JSON.stringify([...linesEver]),
    JSON.stringify(visitCounts),
    JSON.stringify([...plansEver]),
    JSON.stringify([...opponentsEver]),
    consecutiveGpa,
    bestGpa,
    maxMoney,
    maxExploration,
    JSON.stringify(plansWonWith),
    userId,
  );

  const updatedStats = db.prepare('SELECT * FROM player_stats WHERE user_id = ?').get(userId) as PlayerStatsRow;
  return { stats: updatedStats, preUpdateStats };
}

// ─── Achievement Evaluator ────────────────────────────────────────────────────

function evaluateAchievement(
  achievement: AchievementDef,
  ctx: EvaluationContext,
): boolean {
  const { player, isWinner, gameState, stats, sessionStats } = ctx;

  const linesEver = parseJSON<string[]>(stats.lines_ever_visited, []);
  const visitCounts = parseJSON<Record<string, number>>(stats.line_visit_counts, {});
  const plansEver = parseJSON<string[]>(stats.plans_ever_used, []);
  const opponentsEver = parseJSON<string[]>(stats.opponents_played, []);

  switch (achievement.id) {

    // ── Beginner ──────────────────────────────────────────────────────────────
    case 'new_01':
      return stats.total_games >= 1;
    case 'new_02':
      return stats.total_wins >= 1;
    case 'new_03':
      return stats.total_games >= 10;
    case 'new_04':
      return stats.total_games >= 50;
    case 'new_05':
      return stats.total_games >= 100;
    case 'new_06':
      return stats.current_win_streak >= 3;
    case 'new_07':
      return stats.current_win_streak >= 5;
    case 'new_08':
      return gameState.players.length >= 6;

    // ── Academic ──────────────────────────────────────────────────────────────
    case 'gpa_01':
      return player.gpa >= 2.0;
    case 'gpa_02':
      return player.gpa >= 3.5;
    case 'gpa_03':
      return player.gpa >= 4.0;
    case 'gpa_04':
      return player.gpa >= 4.5;
    case 'gpa_05':
      return player.gpa >= 5.0;
    case 'gpa_06':
      return stats.best_gpa >= 4.0;
    case 'gpa_07':
      return stats.consecutive_gpa_above_3 >= 5;
    case 'gpa_08':
      return stats.total_gpa_sum >= 50;

    // ── Wealth ────────────────────────────────────────────────────────────────
    case 'money_01':
      return player.money >= 3500;
    case 'money_02':
      return player.money >= 4500;
    case 'money_03':
      return player.money >= 5555;
    case 'money_04':
      return player.money >= 7000;
    case 'money_05':
      return (sessionStats?.lowestMoney ?? player.money) < 500;
    case 'money_06': {
      const lowest = sessionStats?.lowestMoney ?? player.money;
      return lowest < 500 && player.money >= 3000;
    }
    case 'money_07':
      return stats.total_start_passes >= 10;
    case 'money_08':
      // nannaCPGifts: gifts distributed at 南哪诚品
      return (sessionStats?.nannaCPGifts ?? 0) >= 2;
    case 'money_09':
      return (sessionStats?.totalTuitionPaid ?? player.totalTuitionPaid ?? 0) >= 800;
    case 'money_10':
      return stats.total_money_earned >= 50000;

    // ── Explorer ──────────────────────────────────────────────────────────────
    case 'explore_01':
      return player.exploration >= 5;
    case 'explore_02':
      return player.exploration >= 15;
    case 'explore_03':
      return player.exploration >= 25;
    case 'explore_04':
      return player.exploration >= 30;

    // ── Lines ─────────────────────────────────────────────────────────────────
    case 'line_01':
      return (player.linesVisited?.length ?? 0) >= 1;
    case 'line_02':
      return (player.linesVisited?.length ?? 0) >= 3;
    case 'line_03':
      return (player.linesVisited?.length ?? 0) >= 5;
    case 'line_04':
      return (player.linesVisited?.length ?? 0) >= 8;
    case 'line_05':
      return (visitCounts['pukou'] ?? 0) >= 10;
    case 'line_06':
      return (visitCounts['food'] ?? 0) >= 10;
    case 'line_07':
      return (visitCounts['gulou'] ?? 0) >= 10;
    case 'line_08':
      return linesEver.length >= 8;
    case 'line_09': {
      // 仙林一日游: walked all 8 cells of the xianlin line in a single game
      const xianlinEvents = player.lineEventsTriggered?.['xianlin'] ?? [];
      return xianlinEvents.length >= 8;
    }
    case 'line_10': {
      // 四校区线: pukou, gulou, xianlin, suzhou
      const campusLines = ['pukou', 'gulou', 'xianlin', 'suzhou'];
      return campusLines.every(l => (player.linesVisited ?? []).includes(l));
    }

    // ── Cards ─────────────────────────────────────────────────────────────────
    case 'card_01':
      return stats.total_cards_drawn >= 10;
    case 'card_02':
      return stats.total_cards_drawn >= 100;
    case 'card_03':
      return stats.total_defense_cards_used >= 10;
    case 'card_04':
      return (sessionStats?.maxHandSize ?? (player.heldCards?.length ?? 0)) >= 4;
    case 'card_05':
      // 空城计: drew card immediately after using all held cards
      return sessionStats?.emptyHandThenDrew === true;
    case 'card_06':
      // 连锁反应: a single event triggered 2+ defense cards in a chain
      return (sessionStats?.maxDefenseChainLength ?? 0) >= 2;
    case 'card_07':
      return stats.total_dice_six_count >= 20;
    case 'card_08':
      // 蛇眼: single game rolled 1 three or more times
      return (sessionStats?.diceRolls ?? []).filter(v => v === 1).length >= 3;
    case 'card_09':
      return sessionStats?.allPositiveChanceCards ?? false;
    case 'card_10':
      return (sessionStats?.maxConsecutiveHighDice ?? sessionStats?.consecutiveHighDice ?? 0) >= 3;

    // ── Plans ─────────────────────────────────────────────────────────────────
    case 'plan_01':
      return isWinner && (player.trainingPlans?.length ?? 0) >= 1;
    case 'plan_02':
      return isWinner && (player.trainingPlans?.length ?? 0) >= 2;
    case 'plan_03':
      return (player.trainingPlans?.length ?? 0) >= 3;
    case 'plan_04': {
      // 文理兼修: won at least once with an arts plan AND once with a science plan
      const artsIds = ['wenxue', 'lishi', 'zhexue', 'falv', 'jingji', 'shehui', 'xinwenxueyuan', 'waiguoyu', 'yishu'];
      const scienceIds = ['wuli', 'huaxue', 'shengming', 'tianwen', 'diqiu', 'jisuanji', 'dianzi', 'ruanjian', 'xinxi', 'jixie', 'jianzhu', 'kechuang', 'gongguan', 'yixue'];
      const plansWon = parseJSON<string[]>(stats.plans_won_with, []);
      const wonArts = plansWon.some(p => artsIds.includes(p));
      const wonScience = plansWon.some(p => scienceIds.includes(p));
      return wonArts && wonScience;
    }
    case 'plan_05':
      return isWinner && (player.trainingPlans ?? []).some(p => p.id === 'falv' || p.name?.includes('法'));
    case 'plan_06':
      return isWinner && (player.trainingPlans ?? []).some(p => p.id === 'yixue' || p.name?.includes('医'));
    case 'plan_07': {
      // 代码之神: 使用计算机系获胜，且金钱和探索都只含 0 和 1
      const isCS07 = (player.trainingPlans ?? []).some(p => p.id === 'jisuanji' || p.name?.includes('计算机'));
      if (!isCS07 || !isWinner) return false;
      const moneyDigits07 = new Set(player.money.toString().split(''));
      const expDigits07 = new Set(player.exploration.toString().split(''));
      const allowed07 = new Set(['0', '1']);
      return [...moneyDigits07].every(d => allowed07.has(d)) && [...expDigits07].every(d => allowed07.has(d));
    }
    case 'plan_08':
      return isWinner && (player.trainingPlans ?? []).some(p => p.id === 'tianwen' || p.name?.includes('天文'));
    case 'plan_09':
      return plansEver.length >= 10;
    case 'plan_10':
      return plansEver.length >= 32;
    case 'plan_11':
      return sessionStats?.usedPlanSwap ?? false;
    case 'plan_12':
      return (sessionStats?.samePlanOpponentWin ?? false) && isWinner;

    // ── Survival ──────────────────────────────────────────────────────────────
    case 'surv_01':
      return (player.hospitalVisits ?? 0) >= 3;
    case 'surv_02':
      // 鼎惩罚 — tracked via sessionStats.dingPenalties
      return (sessionStats?.dingPenalties ?? 0) >= 2;
    case 'surv_03': {
      const lowest = sessionStats?.lowestMoney ?? player.money;
      return lowest < 500 && isWinner;
    }
    case 'surv_04':
      return sessionStats?.wasLowestAtYear3End === true && isWinner;
    case 'surv_05':
      return isWinner && ctx.preUpdateStats.current_loss_streak >= 3;
    case 'surv_06':
      return (sessionStats?.totalTuitionPaid ?? player.totalTuitionPaid ?? 0) >= 500;
    case 'surv_07':
      return stats.total_hospital_escapes >= 10;
    case 'surv_08': {
      const lowest = sessionStats?.lowestMoney ?? player.money;
      return lowest < 100 && !player.isBankrupt;
    }
    case 'surv_09':
      return sessionStats?.othersWentBankrupt ?? false;
    case 'surv_10':
      return (sessionStats?.turnsSkipped ?? 0) === 0;
    case 'surv_11':
      // First time going bankrupt
      return player.isBankrupt && stats.total_bankruptcies === 1;
    case 'surv_12':
      return stats.total_bankruptcies >= 5;
    case 'surv_13':
      return stats.total_bankruptcies >= 10;
    case 'surv_14':
      // Previous game was bankrupt, this game won (use pre-update last_game_bankrupt)
      return ctx.preUpdateStats.last_game_bankrupt === 1 && isWinner;

    // ── Social ────────────────────────────────────────────────────────────────
    case 'social_01':
      return stats.total_votes_participated >= 10;
    case 'social_02':
      return (sessionStats?.votesMajoritySide ?? 0) >= 3;
    case 'social_03':
      return stats.total_redistribution_cards >= 5;
    case 'social_04':
      return stats.total_steal_cards >= 5;
    case 'social_05':
      return (sessionStats?.chanceCardsTargetedBy ?? 0) >= 5;
    case 'social_06':
      return (sessionStats?.offensiveCardsUsed ?? 0) === 0;
    case 'social_07':
      return (sessionStats?.chainCardParticipated ?? false) && (sessionStats?.chainCardPositive ?? false);
    case 'social_08':
      return opponentsEver.length >= 20;

    // ── Food ──────────────────────────────────────────────────────────────────
    case 'food_01':
      // First time visiting food line (check cumulative or current game)
      return linesEver.includes('food') || (player.linesVisited ?? []).includes('food');
    case 'food_02':
      return (sessionStats?.cafeteriaNoNegativeStreak ?? player.cafeteriaNoNegativeStreak ?? 0) >= 3;
    case 'food_03':
      return sessionStats?.usedMaimenShield ?? false;
    case 'food_04': {
      const foodEvents = parseJSON<string[]>(stats.food_events_triggered, []);
      return foodEvents.length >= 30;
    }
    case 'food_05':
      return sessionStats?.foodLineCompleted ?? false;
    case 'food_06':
      return sessionStats?.foodLineAllPositive ?? false;

    // ── Composite ─────────────────────────────────────────────────────────────
    case 'comp_01':
      return player.gpa >= 3.0 && player.money >= 3000 && player.exploration >= 8;
    case 'comp_02':
      return player.gpa >= 3.8 && player.money >= 4000 && player.exploration >= 12;
    case 'comp_03':
      return player.gpa >= 4.0 && player.money >= 5000 && player.exploration >= 18;
    case 'comp_04':
      // 大二结束 = round 2, turnNumber ≤ 12
      return isWinner && gameState.turnNumber <= 12;
    case 'comp_05':
      // 大一结束 = round 1, turnNumber ≤ 6
      return isWinner && gameState.turnNumber <= 6;
    case 'comp_06': {
      const score = compositeScore(player);
      return score >= 70;
    }
    case 'comp_07': {
      if (!isWinner) return false;
      const scores = gameState.players
        .filter(p => p.id !== player.id)
        .map(p => compositeScore(p));
      const secondBest = Math.max(...scores, 0);
      return compositeScore(player) - secondBest >= 15;
    }
    case 'comp_08': {
      if (!isWinner) return false;
      const scores = gameState.players
        .filter(p => p.id !== player.id)
        .map(p => compositeScore(p));
      const secondBest = Math.max(...scores, 0);
      const margin = compositeScore(player) - secondBest;
      return margin >= 0 && margin < 3;
    }

    // ── Hidden ────────────────────────────────────────────────────────────────
    case 'hidden_01':
      return player.money === 0;
    case 'hidden_02': {
      const score = compositeScore(player);
      return Math.abs(score - 60.0) < 0.05;
    }
    case 'hidden_03': {
      const isCS = (player.trainingPlans ?? []).some(p => p.id === 'jisuanji' || p.name?.includes('计算机'));
      if (!isCS) return false;
      const moneyDigits = new Set(player.money.toString().split(''));
      const expDigits = new Set(player.exploration.toString().split(''));
      const allowed = new Set(['0', '1']);
      return [...moneyDigits].every(d => allowed.has(d)) && [...expDigits].every(d => allowed.has(d));
    }
    case 'hidden_04':
      return (player.hospitalVisits ?? 0) >= 5;
    case 'hidden_05':
      // 满员局南哪诚品给5个玩家发钱
      return gameState.players.length >= 6 && (sessionStats?.nannaCPGifts ?? 0) >= 5;
    case 'hidden_06':
      return (sessionStats?.waitingRoomTeleports ?? 0) >= 3;
    case 'hidden_07': {
      const moneyStr = player.money.toString();
      const lastDigit = moneyStr[moneyStr.length - 1];
      return lastDigit === '7' && player.exploration.toString().includes('7');
    }
    case 'hidden_08':
      return sessionStats?.reverseOrderBenefit ?? false;
    case 'hidden_09':
      return (sessionStats?.maxConsecutiveLowDice ?? sessionStats?.consecutiveLowDice ?? 0) >= 5;
    case 'hidden_10':
      return (sessionStats?.usedDelayedGratification ?? false) && isWinner;
    case 'hidden_11':
      return sessionStats?.wasHighestAtYear1End === true && !isWinner;
    case 'hidden_12':
      return (sessionStats?.consecutiveRedraws ?? 0) >= 3;

    default:
      return false;
  }
}

// ─── Function 3: checkAchievements ───────────────────────────────────────────

export function checkAchievements(
  userId: string,
  player: Player,
  isWinner: boolean,
  gameState: GameState,
  sessionStats: Partial<GameSessionStats> | undefined,
  preUpdateStats?: PlayerStatsRow,
): string[] {
  const db = getDatabase();

  // Get already-unlocked achievement IDs for this user
  const unlocked = db.prepare(
    'SELECT achievement_id FROM player_achievements WHERE user_id = ?'
  ).all(userId) as { achievement_id: string }[];
  const unlockedSet = new Set(unlocked.map(r => r.achievement_id));

  // Get updated stats (should already be updated before calling this)
  const stats = ensurePlayerStats(userId);

  const ctx: EvaluationContext = {
    player,
    isWinner,
    gameState,
    stats,
    preUpdateStats: preUpdateStats ?? stats,
    sessionStats: sessionStats ?? {},
  };

  const newlyUnlocked: string[] = [];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO player_achievements (user_id, achievement_id, game_id)
    VALUES (?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const achievement of ACHIEVEMENTS) {
      if (unlockedSet.has(achievement.id)) continue;
      try {
        if (evaluateAchievement(achievement, ctx)) {
          insertStmt.run(userId, achievement.id, gameState.roomId);
          newlyUnlocked.push(achievement.id);
        }
      } catch (err) {
        console.error(`[Achievements] Error evaluating ${achievement.id}:`, err);
      }
    }
  });

  insertMany();
  return newlyUnlocked;
}

// ─── Function 4: getPlayerAchievements ───────────────────────────────────────

export function getPlayerAchievements(userId: string): PlayerAchievementSummary {
  const db = getDatabase();

  const rows = db.prepare(
    'SELECT achievement_id, unlocked_at, game_id FROM player_achievements WHERE user_id = ? ORDER BY unlocked_at ASC'
  ).all(userId) as { achievement_id: string; unlocked_at: string; game_id: string | null }[];

  const unlocked: PlayerAchievement[] = rows.map(r => ({
    achievementId: r.achievement_id,
    unlockedAt: r.unlocked_at,
    gameId: r.game_id ?? undefined,
  }));

  const unlockedSet = new Set(rows.map(r => r.achievement_id));

  // Total points
  let totalPoints = 0;
  for (const a of ACHIEVEMENTS) {
    if (unlockedSet.has(a.id)) {
      totalPoints += a.points;
    }
  }

  const rank = getRank(totalPoints);

  // Progress for achievements with maxProgress that are not yet unlocked
  const stats = ensurePlayerStats(userId);
  const progress = computeProgress(stats, unlockedSet);

  return {
    unlocked,
    progress,
    totalPoints,
    rank: rank.title,
    rankIcon: rank.icon,
  };
}

// ─── Function 5: getAchievementProgress ──────────────────────────────────────

export function getAchievementProgress(userId: string): AchievementProgress[] {
  const stats = ensurePlayerStats(userId);
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT achievement_id FROM player_achievements WHERE user_id = ?'
  ).all(userId) as { achievement_id: string }[];
  const unlockedSet = new Set(rows.map(r => r.achievement_id));

  return computeProgress(stats, unlockedSet);
}

// ─── Internal: computeProgress ───────────────────────────────────────────────

function computeProgress(stats: PlayerStatsRow, unlockedSet: Set<string>): AchievementProgress[] {
  const progress: AchievementProgress[] = [];
  const linesEver = parseJSON<string[]>(stats.lines_ever_visited, []);
  const visitCounts = parseJSON<Record<string, number>>(stats.line_visit_counts, {});
  const plansEver = parseJSON<string[]>(stats.plans_ever_used, []);
  const opponentsEver = parseJSON<string[]>(stats.opponents_played, []);
  const foodEvents = parseJSON<string[]>(stats.food_events_triggered, []);

  for (const a of ACHIEVEMENTS) {
    if (!a.maxProgress) continue;
    if (unlockedSet.has(a.id)) continue;

    let current = 0;

    switch (a.id) {
      case 'new_01': current = Math.min(stats.total_games, 1); break;
      case 'new_02': current = Math.min(stats.total_wins, 1); break;
      case 'new_03': current = stats.total_games; break;
      case 'new_04': current = stats.total_games; break;
      case 'new_05': current = stats.total_games; break;
      case 'new_06': current = stats.current_win_streak; break;
      case 'new_07': current = stats.current_win_streak; break;
      case 'gpa_07': current = stats.consecutive_gpa_above_3; break;
      case 'gpa_08': current = Math.floor(stats.total_gpa_sum); break;
      case 'money_07': current = stats.total_start_passes; break;
      case 'money_10': current = stats.total_money_earned; break;
      case 'line_05': current = visitCounts['pukou'] ?? 0; break;
      case 'line_06': current = visitCounts['food'] ?? 0; break;
      case 'line_07': current = visitCounts['gulou'] ?? 0; break;
      case 'line_08': current = linesEver.length; break;
      case 'card_01': current = stats.total_cards_drawn; break;
      case 'card_02': current = stats.total_cards_drawn; break;
      case 'card_03': current = stats.total_defense_cards_used; break;
      case 'card_07': current = stats.total_dice_six_count; break;
      case 'plan_09': current = plansEver.length; break;
      case 'plan_10': current = plansEver.length; break;
      case 'surv_07': current = stats.total_hospital_escapes; break;
      case 'surv_12': current = stats.total_bankruptcies; break;
      case 'surv_13': current = stats.total_bankruptcies; break;
      case 'social_01': current = stats.total_votes_participated; break;
      case 'social_03': current = stats.total_redistribution_cards; break;
      case 'social_04': current = stats.total_steal_cards; break;
      case 'social_08': current = opponentsEver.length; break;
      case 'food_04': current = foodEvents.length; break;
      default: current = 0;
    }

    progress.push({
      achievementId: a.id,
      current: Math.min(current, a.maxProgress),
      max: a.maxProgress,
    });
  }

  return progress;
}
