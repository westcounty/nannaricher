/**
 * Bot Strategy Module — Plan-Aware Smart Strategies (TypeScript port)
 *
 * 10 strategies simulate different player approaches with deep plan awareness:
 *
 * Enhanced existing:
 * - random:         baseline, all choices random
 * - greedy_gpa:     prioritize GPA, pick GPA-focused plans
 * - greedy_money:   prioritize money, pick money-focused plans
 * - greedy_explore: prioritize exploration, pick explore/line plans
 * - plan_focused:   deeply optimize for assigned plan's win condition
 * - balanced:       supplement weakest resource, pick flexible plans
 *
 * New:
 * - specialist:     pick random plan, then deeply optimize with full plan knowledge
 * - aggressor:      pick PvP plans, target leading players
 * - tactician:      pick position/event plans, control movement & card timing
 * - endurance:      pick long-term condition plans
 *
 * All strategies (except random) are plan-aware: they use PLAN_PROFILES to make
 * informed decisions about line entry, card usage, option selection, and plan
 * selection based on their assigned training plan's win condition.
 */

import type {
  Player,
  GameState,
  PendingAction,
  TrainingPlan,
} from '@nannaricher/shared';

// ============================================================
// Section 1: Types
// ============================================================

/** Option as provided in PendingAction.options */
interface OptionItem {
  label: string;
  value: string;
  description?: string;
  group?: string;
  effectPreview?: {
    money?: number | string;
    gpa?: number | string;
    exploration?: number | string;
  };
}

/** Plan selection input data (per-player from parallel_plan_selection) */
interface PlanSelectionData {
  drawnPlans: TrainingPlan[];
  existingPlanIds: string[];
  currentMajor: string | null;
  currentMinors: string[];
  planSlotLimit: number;
}

/** Plan selection result */
type PlanSelectionResult =
  | { action: 'keep' }
  | { action: 'adjust'; keepPlanIds: string[]; majorId: string };

/** Card action result from chooseCardsToUse */
interface CardAction {
  cardId: string;
  targetPlayerId?: string;
}

type PlanFocus = 'gpa' | 'money' | 'explore' | 'lines' | 'position' | 'pvp' | 'special';

interface PlanWeights {
  money: number;
  gpa: number;
  explore: number;
}

interface LinePrefs {
  study: number;
  money: number;
  suzhou: number;
  explore: number;
  xianlin: number;
  gulou: number;
  [key: string]: number;
}

interface PlanTraits {
  skipSociety?: boolean;
  gpaLead?: boolean;
  seekMoney?: boolean;
  avoidSpending?: boolean;
  seekPoverty?: boolean;
  exploreLead?: boolean;
  wealthEquality?: boolean;
  campusLines?: boolean;
  allCampusLines?: boolean;
  allMainLines?: boolean;
  pukouMaster?: boolean;
  suzhouMaster?: boolean;
  xianlinEvents?: boolean;
  cleanExplore?: boolean;
  noMoneyGainInLine?: boolean;
  consecutivePositive?: boolean;
  foodLinePositive?: boolean;
  shareCells?: boolean;
  gulouEndpoint?: boolean;
  visitCorners?: boolean;
  hospitalFrequent?: boolean;
  seekEnglishCards?: boolean;
  seekDigitCards?: boolean;
  cardExchange?: boolean;
  interceptWinner?: boolean;
  seekBankruptcy?: boolean;
  binaryTarget?: boolean;
  avoidRichest?: boolean;
  seekTuition?: boolean;
  neutralLine?: boolean;
  gpaFloor?: boolean;
  flexibleScoring?: boolean;
  hybridScoring?: boolean;
  kechuangFocus?: boolean;
  metaPlayer?: boolean;
  [key: string]: boolean | undefined;
}

interface PlanProfile {
  focus: PlanFocus;
  weights: PlanWeights;
  linePrefs: LinePrefs;
  traits: PlanTraits;
}

interface CardSynergy {
  plans: string[];
  useInLine?: string;
  lineEscape?: boolean;
  lineReentry?: boolean;
  alwaysUse?: boolean;
  hospitalEscape?: boolean;
  moneyProtect?: boolean;
  gpaProtect?: boolean;
  exploreProtect?: boolean;
  offensive?: boolean;
  prob: number;
}

interface RankedPlan {
  id: string;
  name: string;
  isNew: boolean;
}

// ============================================================
// Section 2: Constants & Plan Knowledge Base
// ============================================================

/** Negate cards -- reactive only, never use proactively */
export const NEGATE_CARD_IDS = new Set([
  'chance_pie_in_sky', 'destiny_stop_loss', 'destiny_how_to_explain',
  'chance_info_blocked', 'chance_false_move',
]);

/** Main board cell IDs by index (28 cells) */
const CELL_IDS = [
  'start', 'line_study', 'tuition', 'chance_2', 'line_pukou', 'zijing', 'chance_1',
  'hospital', 'line_money', 'qingong', 'chance_3', 'line_suzhou', 'retake', 'chance_4',
  'ding', 'line_explore', 'jiang_gong', 'chance_5', 'line_xianlin', 'society', 'chance_6',
  'waiting_room', 'line_gulou', 'kechuang', 'chance_7', 'line_food', 'nanna_cp', 'chuangmen',
];

/** Negative cells for huaxue disable ability */
const NEGATIVE_CELLS = new Set([
  'tuition', 'nanna_cp', 'ding', 'chuangmen', 'society',
]);

/**
 * PLAN_PROFILES -- comprehensive strategic knowledge for all 33 plans.
 *
 * Each profile encodes what the strategy needs to know:
 *   focus:    resource category
 *   weights:  { money, gpa, explore } scoring weights for option evaluation
 *   linePrefs: { lineId: 0-1 probability } for line entry decisions
 *   traits:   special behavioral flags
 */
export const PLAN_PROFILES: Record<string, PlanProfile> = {
  // ---- GPA-focused ----
  '马克思主义学院': {
    focus: 'gpa', weights: { money: 0.3, gpa: 4, explore: 0.5 },
    linePrefs: { study: 0.95, money: 0.25, suzhou: 0.4, explore: 0.2, xianlin: 0.3, gulou: 0.6 },
    traits: { skipSociety: true },
  },
  '人工智能学院': {
    focus: 'gpa', weights: { money: 0.3, gpa: 4, explore: 0.3 },
    linePrefs: { study: 0.9, money: 0.2, suzhou: 0.3, explore: 0.2, xianlin: 0.3, gulou: 0.5 },
    traits: { gpaLead: true },
  },

  // ---- Money-focused ----
  '商学院': {
    focus: 'money', weights: { money: 4, gpa: 0.3, explore: 0.3 },
    linePrefs: { study: 0.2, money: 0.95, suzhou: 0.3, explore: 0.2, xianlin: 0.2, gulou: 0.3 },
    traits: { seekMoney: true, avoidSpending: true },
  },
  '工程管理学院': {
    focus: 'money', weights: { money: -3, gpa: 1, explore: 1 },
    linePrefs: { study: 0.4, money: 0.1, suzhou: 0.3, explore: 0.5, xianlin: 0.4, gulou: 0.4 },
    traits: { seekPoverty: true },
  },

  // ---- Explore-focused ----
  '社会学院': {
    focus: 'explore', weights: { money: 0.3, gpa: 0.5, explore: 4 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.6, explore: 0.9, xianlin: 0.6, gulou: 0.7 },
    traits: { exploreLead: true },
  },
  '政府管理学院': {
    focus: 'explore', weights: { money: 0.5, gpa: 0.5, explore: 3 },
    linePrefs: { study: 0.4, money: 0.4, suzhou: 0.6, explore: 0.85, xianlin: 0.5, gulou: 0.5 },
    traits: { wealthEquality: true },
  },

  // ---- Line-focused ----
  '历史学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.95, explore: 0.3, xianlin: 0.95, gulou: 0.95 },
    traits: { campusLines: true },
  },
  '地球科学与工程学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.95, explore: 0.3, xianlin: 0.95, gulou: 0.95 },
    traits: { allCampusLines: true },
  },
  '地理与海洋科学学院': {
    focus: 'lines', weights: { money: 1, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.95, money: 0.95, suzhou: 0.3, explore: 0.95, xianlin: 0.3, gulou: 0.3 },
    traits: { allMainLines: true },
  },
  '艺术学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { pukouMaster: true },
  },
  '苏州校区': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.2, money: 0.2, suzhou: 0.95, explore: 0.2, xianlin: 0.2, gulou: 0.2 },
    traits: { suzhouMaster: true },
  },
  '环境学院': {
    focus: 'lines', weights: { money: 0.3, gpa: 0.3, explore: 2 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.4, xianlin: 0.95, gulou: 0.4 },
    traits: { xianlinEvents: true },
  },

  // ---- Event/Line condition ----
  '新闻传播学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 1.5, explore: 2 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.95, xianlin: 0.3, gulou: 0.3 },
    traits: { cleanExplore: true },
  },
  '文学院': {
    focus: 'lines', weights: { money: -1, gpa: 1, explore: 2 },
    linePrefs: { study: 0.3, money: 0.85, suzhou: 0.3, explore: 0.4, xianlin: 0.3, gulou: 0.4 },
    traits: { noMoneyGainInLine: true },
  },
  '化学化工学院': {
    focus: 'special', weights: { money: 1, gpa: 1.5, explore: 1.5 },
    linePrefs: { study: 0.6, money: 0.5, suzhou: 0.5, explore: 0.5, xianlin: 0.5, gulou: 0.5 },
    traits: { consecutivePositive: true },
  },
  '生命科学学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1.5 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { foodLinePositive: true },
  },

  // ---- Position-focused ----
  '天文与空间科学学院': {
    focus: 'position', weights: { money: 0.5, gpa: 0.8, explore: 0.8 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { shareCells: true },
  },
  '数学系': {
    focus: 'position', weights: { money: 0.5, gpa: 1, explore: 0.5 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.95 },
    traits: { gulouEndpoint: true },
  },
  '建筑与城市规划学院': {
    focus: 'position', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.7 },
    traits: { visitCorners: true },
  },
  '医学院': {
    focus: 'position', weights: { money: 0.5, gpa: 0.5, explore: 0.5 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { hospitalFrequent: true },
  },

  // ---- Card/Interaction-focused ----
  '外国语学院': {
    focus: 'special', weights: { money: 0.5, gpa: 0.5, explore: 1.5 },
    linePrefs: { study: 0.4, money: 0.3, suzhou: 0.4, explore: 0.5, xianlin: 0.4, gulou: 0.5 },
    traits: { seekEnglishCards: true },
  },
  '信息管理学院': {
    focus: 'special', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.4, money: 0.4, suzhou: 0.4, explore: 0.4, xianlin: 0.4, gulou: 0.4 },
    traits: { seekDigitCards: true },
  },
  '国际关系学院': {
    focus: 'pvp', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.4, money: 0.4, suzhou: 0.4, explore: 0.5, xianlin: 0.4, gulou: 0.4 },
    traits: { cardExchange: true },
  },
  '海外教育学院': {
    focus: 'pvp', weights: { money: 1, gpa: 0.5, explore: 0.5 },
    linePrefs: { study: 0.3, money: 0.4, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { interceptWinner: true },
  },

  // ---- PvP/Relative ----
  '法学院': {
    focus: 'pvp', weights: { money: 1.5, gpa: 0.5, explore: 0.5 },
    linePrefs: { study: 0.3, money: 0.5, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { seekBankruptcy: true },
  },

  // ---- Special condition ----
  '计算机科学与技术系': {
    focus: 'special', weights: { money: 0, gpa: 0.5, explore: 0 },
    linePrefs: { study: 0.3, money: 0.2, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { binaryTarget: true },
  },
  '大气科学学院': {
    focus: 'special', weights: { money: -0.5, gpa: 1, explore: 1 },
    linePrefs: { study: 0.5, money: 0.2, suzhou: 0.4, explore: 0.6, xianlin: 0.5, gulou: 0.5 },
    traits: { avoidRichest: true },
  },
  '软件学院': {
    focus: 'special', weights: { money: 1, gpa: 0.5, explore: 0.5 },
    linePrefs: { study: 0.6, money: 0.6, suzhou: 0.7, explore: 0.6, xianlin: 0.7, gulou: 0.6 },
    traits: { seekTuition: true },
  },
  '哲学系': {
    focus: 'special', weights: { money: 0.5, gpa: 1.5, explore: 0.5 },
    linePrefs: { study: 0.5, money: 0.3, suzhou: 0.5, explore: 0.4, xianlin: 0.4, gulou: 0.5 },
    traits: { neutralLine: true, gpaFloor: true },
  },
  '物理学院': {
    focus: 'special', weights: { money: 1, gpa: 1.5, explore: 1.5 },
    linePrefs: { study: 0.6, money: 0.5, suzhou: 0.5, explore: 0.6, xianlin: 0.5, gulou: 0.5 },
    traits: { flexibleScoring: true },
  },
  '现代工程与应用科学学院': {
    focus: 'special', weights: { money: 1.5, gpa: 2, explore: 1 },
    linePrefs: { study: 0.6, money: 0.6, suzhou: 0.5, explore: 0.5, xianlin: 0.5, gulou: 0.5 },
    traits: { hybridScoring: true },
  },
  '电子科学与工程学院': {
    focus: 'special', weights: { money: 0.5, gpa: 2, explore: 0.5 },
    linePrefs: { study: 0.5, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.5 },
    traits: { kechuangFocus: true },
  },
  '匡亚明学院': {
    focus: 'pvp', weights: { money: 1, gpa: 1, explore: 1 },
    linePrefs: { study: 0.5, money: 0.5, suzhou: 0.5, explore: 0.5, xianlin: 0.5, gulou: 0.5 },
    traits: { metaPlayer: true },
  },
};

/** Cards that have strategic synergy with specific plans */
export const CARD_PLAN_SYNERGY: Record<string, CardSynergy> = {
  // Destiny cards
  'destiny_maimen_shield':      { plans: ['生命科学学院'], useInLine: 'food', prob: 0.9 },
  'destiny_alternative_path':   { plans: ['新闻传播学院', '哲学系'], lineEscape: true, prob: 0.6 },
  'destiny_familiar_route':     { plans: ['历史学院', '地球科学与工程学院', '艺术学院', '苏州校区', '数学系'], lineReentry: true, prob: 0.7 },
  'destiny_cross_college_exit': { plans: ['匡亚明学院'], prob: 0.5 },
  'destiny_professional_intent':{ plans: [], alwaysUse: true, prob: 1.0 },
  'destiny_urgent_deadline':    { plans: [], hospitalEscape: true, prob: 1.0 },
  'destiny_negative_balance':   { plans: ['商学院'], moneyProtect: true, prob: 0.7 },
  'destiny_test_waters':        { plans: ['商学院'], moneyProtect: true, prob: 0.7 },
  'destiny_ancestor_exam':      { plans: ['马克思主义学院', '人工智能学院'], gpaProtect: true, prob: 0.6 },
  'destiny_campus_legend':      { plans: ['社会学院', '环境学院'], exploreProtect: true, prob: 0.6 },
  // Chance cards (offensive)
  'chance_leap_of_joy':         { plans: ['法学院', '社会学院'], offensive: true, prob: 0.4 },
  'chance_power_outage':        { plans: ['法学院'], offensive: true, prob: 0.35 },
};

// ============================================================
// Section 3: Utility Functions
// ============================================================

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRand(items: { item: string; weight: number }[]): string {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const { item, weight } of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

interface AnalyzedEffect {
  money: number;
  gpa: number;
  explore: number;
}

/** Analyze option effects from effectPreview or label text */
function analyzeOption(option: OptionItem): AnalyzedEffect {
  if (option.effectPreview) {
    return {
      money: typeof option.effectPreview.money === 'number' ? option.effectPreview.money : 0,
      gpa: typeof option.effectPreview.gpa === 'number' ? option.effectPreview.gpa : 0,
      explore: typeof option.effectPreview.exploration === 'number' ? option.effectPreview.exploration : 0,
    };
  }
  return analyzeLabel(option.label || option.description || '');
}

/** Analyze a Chinese option label for resource impact (fallback) */
function analyzeLabel(label: string): AnalyzedEffect {
  if (!label) return { money: 0, gpa: 0, explore: 0 };
  const s: AnalyzedEffect = { money: 0, gpa: 0, explore: 0 };
  if (/金钱[增获]|[获赚领]得.*[金钱元]|金钱?\s*[+＋]|\+\s*\d+.*[金钱元]/.test(label)) s.money += 1;
  if (/金钱[减失]|[失花支付扣].*[金钱元]|金钱?\s*[-−]|-\s*\d+.*[金钱元]/.test(label)) s.money -= 1;
  if (/GPA[增获]|GPA\s*[+＋]|\+.*GPA|学习|补天成功/.test(label)) s.gpa += 1;
  if (/GPA[减失]|GPA\s*[-−]|-.*GPA/.test(label)) s.gpa -= 1;
  if (/探索值?[增获]|探索\s*[+＋]|\+.*探索/.test(label)) s.explore += 1;
  if (/探索值?[减失]|探索\s*[-−]|-.*探索/.test(label)) s.explore -= 1;
  if (/暂停|停留.*回合|住院/.test(label)) { s.money -= 0.3; s.gpa -= 0.3; s.explore -= 0.3; }
  if (/破产/.test(label)) s.money -= 2;
  return s;
}

/** Check if an option label is a plan name */
function isPlanOption(label: string): boolean {
  return !!PLAN_PROFILES[label];
}

/** Get player's major plan name from state */
function getMajorPlanName(player: Player | undefined | null): string | null {
  if (!player?.majorPlan) return null;
  const plan = (player.trainingPlans || []).find(tp => tp.id === player.majorPlan);
  return plan ? plan.name : null;
}

/** Get plan profile for player */
function getPlayerProfile(player: Player | undefined | null): PlanProfile | null {
  const name = getMajorPlanName(player);
  return name ? (PLAN_PROFILES[name] ?? null) : null;
}

/** Check if money is a binary-looking number (all digits are 0 or 1) */
function isBinaryLike(n: number): boolean {
  if (n < 0) return false;
  return String(n).split('').every(d => d === '0' || d === '1');
}

/** Get lines the player has visited */
function getVisitedLines(player: Player): Set<string> {
  return new Set(player.linesVisited || []);
}

// ============================================================
// Section 4: Strategy Base Class (Plan-Aware)
// ============================================================

export abstract class Strategy {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  // ---- Plan Selection (parallel mode) ----

  choosePlanSelection(
    planData: PlanSelectionData | null | undefined,
    state: GameState | null | undefined,
    playerId: string,
  ): PlanSelectionResult {
    if (!planData) return { action: 'keep' };

    const { drawnPlans, existingPlanIds, currentMajor, planSlotLimit } = planData;
    const player = state?.players?.find(p => p.id === playerId);

    // Get all available plans with names
    const allAvailable: RankedPlan[] = [];
    if (player) {
      for (const id of existingPlanIds) {
        const plan = (player.trainingPlans || []).find(tp => tp.id === id);
        if (plan) allAvailable.push({ id, name: plan.name, isNew: false });
      }
    }
    for (const plan of drawnPlans) {
      allAvailable.push({ id: plan.id, name: plan.name, isNew: true });
    }

    if (allAvailable.length === 0) return { action: 'keep' };

    // If no current major, must adjust
    if (!currentMajor) {
      return this._selectBestPlans(allAvailable, planSlotLimit, player);
    }

    // Evaluate if any drawn plan is better than current setup
    const currentMajorPlan = allAvailable.find(p => p.id === currentMajor);
    const currentProfile = currentMajorPlan ? PLAN_PROFILES[currentMajorPlan.name] ?? null : null;
    const bestNew = this._rankPlans(drawnPlans.map(p => ({ id: p.id, name: p.name, isNew: true })));

    if (bestNew.length > 0 && this._shouldSwitch(currentProfile, PLAN_PROFILES[bestNew[0].name] ?? null)) {
      return this._selectBestPlans(allAvailable, planSlotLimit, player);
    }

    // Probability-based adjustment
    if (Math.random() < this._adjustProbability()) {
      return this._selectBestPlans(allAvailable, planSlotLimit, player);
    }

    return { action: 'keep' };
  }

  /** Rank plans by preference for this strategy. Override in subclasses. */
  protected _rankPlans(plans: RankedPlan[]): RankedPlan[] {
    const prefs = this._planFocusPrefs();
    if (!prefs) return plans; // no preference, keep order

    return [...plans].sort((a, b) => {
      const aProfile = PLAN_PROFILES[a.name];
      const bProfile = PLAN_PROFILES[b.name];
      const aRank = aProfile ? prefs.indexOf(aProfile.focus) : 99;
      const bRank = bProfile ? prefs.indexOf(bProfile.focus) : 99;
      return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
    });
  }

  /** Plan focus preferences (ordered). Override in subclasses. */
  protected _planFocusPrefs(): PlanFocus[] | null {
    return null;
  }

  /** Probability of adjusting plans at selection time. Override in subclasses. */
  protected _adjustProbability(): number {
    return 0.4;
  }

  /** Should we switch from current to new plan? */
  protected _shouldSwitch(
    currentProfile: PlanProfile | null | undefined,
    newProfile: PlanProfile | null | undefined,
  ): boolean {
    if (!currentProfile && newProfile) return true;
    if (!newProfile) return false;
    const prefs = this._planFocusPrefs();
    if (!prefs) return Math.random() < 0.3;
    const currentRank = currentProfile ? prefs.indexOf(currentProfile.focus) : 99;
    const newRank = prefs.indexOf(newProfile.focus);
    return newRank >= 0 && (currentRank < 0 || newRank < currentRank);
  }

  /** Select best plans from available pool */
  protected _selectBestPlans(
    allAvailable: RankedPlan[],
    limit: number,
    _player: Player | undefined,
  ): PlanSelectionResult {
    const ranked = this._rankPlans(allAvailable);
    const selected = ranked.slice(0, limit);
    const majorId = selected[0]?.id;
    if (!majorId) return { action: 'keep' };
    return {
      action: 'adjust',
      keepPlanIds: selected.map(p => p.id),
      majorId,
    };
  }

  // ---- Option Selection ----

  chooseOption(
    options: OptionItem[] | undefined,
    state: GameState | null | undefined,
    pa: PendingAction | null | undefined,
    playerId: string,
  ): string | null {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;

    // Negate window
    if (options.some(o => o.value?.startsWith('negate_'))) {
      return this._chooseNegate(options, state, pa, playerId);
    }

    // Huaxue disable
    if (options.some(o => o.value?.startsWith('disable_'))) {
      return this._chooseHuaxueDisable(options, state, playerId);
    }

    // Plan selection (old sequential style)
    if (options.some(o => isPlanOption(o.label))) {
      return this._choosePlanFromOptions(options);
    }

    // Keep/adjust
    if (options.some(o => o.value === 'keep' || o.value === 'adjust')) {
      return Math.random() < this._adjustProbability() ? 'adjust' : 'keep';
    }

    // Line entry
    if (options.some(o => o.value?.startsWith('enter_'))) {
      return this._chooseLineEntry(options, state, playerId);
    }

    // Plan-aware scoring
    return this._scoredChoice(options, state, playerId);
  }

  /** Choose from plan name options */
  protected _choosePlanFromOptions(options: OptionItem[]): string {
    const prefs = this._planFocusPrefs();
    if (!prefs) return rand(options).value;
    for (const focus of prefs) {
      const match = options.find(o => PLAN_PROFILES[o.label]?.focus === focus);
      if (match) return match.value;
    }
    return rand(options).value;
  }

  /** Choose whether to enter a line */
  protected _chooseLineEntry(
    options: OptionItem[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const enter = options.find(o => o.value.startsWith('enter_'));
    const skip = options.find(o => o.value === 'skip');
    if (!enter) return skip?.value || options[0].value;
    if (!skip) return enter.value;

    const lineId = enter.value.slice(6); // 'enter_xxx' -> 'xxx'
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Use plan-specific line preference
    let prob = profile?.linePrefs?.[lineId] ?? 0.5;

    // Boost if plan needs this line and we haven't visited it
    if (profile?.traits && me) {
      const visited = getVisitedLines(me);
      const campusLines = ['pukou', 'xianlin', 'suzhou', 'gulou'];
      const mainLines = ['study', 'money', 'explore', 'food'];

      if (profile.traits.campusLines || profile.traits.allCampusLines) {
        if (campusLines.includes(lineId) && !visited.has(lineId)) prob = 0.98;
      }
      if (profile.traits.allMainLines) {
        if (mainLines.includes(lineId) && !visited.has(lineId)) prob = 0.98;
      }
      if (profile.traits.gulouEndpoint && lineId === 'gulou') prob = 0.95;
      if (profile.traits.xianlinEvents && lineId === 'xianlin') prob = 0.95;
      if (profile.traits.suzhouMaster && lineId === 'suzhou') prob = 0.98;
      if (profile.traits.cleanExplore && lineId === 'explore') prob = 0.95;
      if (profile.traits.seekTuition) prob = Math.max(prob, 0.75);
    }

    return Math.random() < prob ? enter.value : 'skip';
  }

  /** Score all options using plan-aware weights */
  protected _scoredChoice(
    options: OptionItem[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;
    const weights = profile?.weights || { money: 1, gpa: 1, explore: 1 };

    // Plan-specific special choices
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    let best: OptionItem | null = null;
    let bestScore = -Infinity;
    for (const opt of options) {
      const fx = analyzeOption(opt);
      const score = fx.money * weights.money + fx.gpa * weights.gpa + fx.explore * weights.explore
        + Math.random() * 0.2;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best ? best.value : rand(options).value;
  }

  /** Plan-specific option selection logic */
  protected _planSpecificChoice(
    options: OptionItem[],
    state: GameState | null | undefined,
    me: Player,
    profile: PlanProfile,
  ): string | null {
    const traits = profile.traits;

    // 工程管理: prefer options that lose money (seek poverty)
    if (traits.seekPoverty) {
      const moneyLoss = options.filter(o => {
        const fx = analyzeOption(o);
        return fx.money < 0;
      });
      if (moneyLoss.length > 0) return rand(moneyLoss).value;
    }

    // 大气科学: avoid gaining too much money if already richest
    if (traits.avoidRichest) {
      const players = state?.players || [];
      const richest = Math.max(...players.map(p => p.money || 0));
      if (me.money >= richest - 100) {
        // We're near richest -- prefer options that don't gain money
        const noMoney = options.filter(o => {
          const fx = analyzeOption(o);
          return fx.money <= 0;
        });
        if (noMoney.length > 0) return rand(noMoney).value;
      }
    }

    // 计算机: prefer options that move money/explore toward binary values
    if (traits.binaryTarget) {
      let bestOpt: OptionItem | null = null;
      let bestDist = Infinity;
      for (const opt of options) {
        const fx = analyzeOption(opt);
        const newMoney = (me.money || 0) + (fx.money || 0);
        const newExplore = (me.exploration || 0) + (fx.explore || 0);
        const dist = this._binaryDistance(newMoney) + this._binaryDistance(newExplore) * 100;
        if (dist < bestDist) { bestDist = dist; bestOpt = opt; }
      }
      if (bestOpt) return bestOpt.value;
    }

    // 文学院: in money line, prefer options that don't gain money
    if (traits.noMoneyGainInLine && me.position?.type === 'line') {
      const noGain = options.filter(o => {
        const fx = analyzeOption(o);
        return fx.money <= 0;
      });
      if (noGain.length > 0) return rand(noGain).value;
    }

    // 商学院: always prefer money gain
    if (traits.seekMoney) {
      let best: OptionItem | null = null;
      let bestGain = -Infinity;
      for (const opt of options) {
        const fx = analyzeOption(opt);
        if (fx.money > bestGain) { bestGain = fx.money; best = opt; }
      }
      if (best && bestGain > 0) return best.value;
    }

    // 马克思 at society: always pick explore option if available
    if (traits.skipSociety) {
      const exploreOpt = options.find(o =>
        /探索/.test(o.label || '') || /不吃/.test(o.label || '') || /探索/.test(o.description || '')
      );
      if (exploreOpt) return exploreOpt.value;
    }

    return null;
  }

  /** Distance from nearest binary-looking number */
  protected _binaryDistance(n: number): number {
    if (n < 0) return 999;
    if (isBinaryLike(n)) return 0;
    for (let d = 1; d <= 50; d++) {
      if (isBinaryLike(n + d) || isBinaryLike(n - d)) return d;
    }
    return 100;
  }

  // ---- Player Selection ----

  choosePlayer(
    targetIds: string[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const others = targetIds.filter(id => id !== playerId);
    if (others.length === 0) return targetIds[0];

    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // PvP plans: target strategically
    if (profile?.traits?.seekBankruptcy) {
      return this._findPoorestPlayer(state, playerId, others) || rand(others);
    }

    if (profile?.traits?.interceptWinner) {
      return this._findLeadingPlayer(state, playerId, others) || rand(others);
    }

    return rand(others);
  }

  // ---- Vote & Chain ----

  chooseVote(
    options: OptionItem[] | undefined,
    state: GameState | null | undefined,
    pa: PendingAction | null | undefined,
    playerId: string,
  ): string | null {
    return this.chooseOption(options, state, pa, playerId);
  }

  chooseChain(
    _options: OptionItem[] | undefined,
    state: GameState | null | undefined,
    _pa: PendingAction | null | undefined,
    playerId: string,
  ): string {
    const player = state?.players?.find(p => p.id === playerId);
    const profile = getPlayerProfile(player);
    // Chain actions are more valuable for card-dependent plans
    if (profile?.traits?.cardExchange || profile?.traits?.interceptWinner) {
      return Math.random() < 0.8 ? 'continue' : 'pass';
    }
    return Math.random() < 0.6 ? 'continue' : 'pass';
  }

  // ---- Card Usage ----

  chooseCardsToUse(
    heldCards: Array<{ id: string; useTiming?: string; [key: string]: unknown }> | undefined,
    state: GameState | null | undefined,
    playerId: string,
  ): CardAction[] {
    if (!heldCards || heldCards.length === 0) return [];
    const me = state?.players?.find(p => p.id === playerId);
    if (!me) return [];
    const isMyTurn = state!.players[state!.currentPlayerIndex]?.id === playerId;
    const profile = getPlayerProfile(me);
    const planName = getMajorPlanName(me);
    const actions: CardAction[] = [];

    for (const card of heldCards) {
      if (NEGATE_CARD_IDS.has(card.id)) continue;
      const decision = this._evaluateCard(card, me, state!, playerId, isMyTurn, profile, planName);
      if (decision) actions.push(decision);
    }
    return actions;
  }

  protected _evaluateCard(
    card: { id: string; useTiming?: string; [key: string]: unknown },
    me: Player,
    state: GameState,
    playerId: string,
    isMyTurn: boolean,
    profile: PlanProfile | null,
    planName: string | null,
  ): CardAction | null {
    if (NEGATE_CARD_IDS.has(card.id)) return null;

    // Always use plan slot expansion
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };

    // Hospital escape
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) {
      return { cardId: card.id };
    }

    // Check plan-specific card synergies
    const synergy = CARD_PLAN_SYNERGY[card.id];
    if (synergy && planName) {
      if (synergy.plans.includes(planName) || synergy.alwaysUse) {
        if (synergy.useInLine && me.position?.type === 'line') {
          if (isMyTurn && Math.random() < synergy.prob) return { cardId: card.id };
        }
        if (synergy.lineReentry && isMyTurn) {
          if (Math.random() < synergy.prob) return { cardId: card.id };
        }
        if (synergy.moneyProtect && isMyTurn && profile?.focus === 'money') {
          if (Math.random() < synergy.prob) return { cardId: card.id };
        }
        if (synergy.gpaProtect && isMyTurn && profile?.focus === 'gpa') {
          if (Math.random() < synergy.prob) return { cardId: card.id };
        }
        if (synergy.exploreProtect && isMyTurn && profile?.focus === 'explore') {
          if (Math.random() < synergy.prob) return { cardId: card.id };
        }
      }
    }

    // Generic card evaluation based on plan focus
    if (isMyTurn) {
      if (profile?.focus === 'gpa' && card.id === 'destiny_ancestor_exam' && Math.random() < 0.5) {
        return { cardId: card.id };
      }
      if (profile?.focus === 'money' && card.id === 'destiny_negative_balance' && Math.random() < 0.5) {
        return { cardId: card.id };
      }
      if (profile?.focus === 'explore' && card.id === 'destiny_campus_legend' && Math.random() < 0.5) {
        return { cardId: card.id };
      }

      // Line shortcut
      if (card.id === 'destiny_alternative_path' && me.position?.type === 'line') {
        const needLines = profile?.traits?.campusLines || profile?.traits?.allCampusLines
          || profile?.traits?.allMainLines || profile?.traits?.gulouEndpoint
          || profile?.traits?.xianlinEvents || profile?.traits?.suzhouMaster
          || profile?.traits?.cleanExplore || profile?.traits?.pukouMaster;
        if (!needLines && Math.random() < 0.35) return { cardId: card.id };
      }

      // Maimen shield in food line
      if (card.id === 'destiny_maimen_shield' && Math.random() < 0.4) {
        return { cardId: card.id };
      }

      // 信息管理: data integration
      if (card.id === 'xinxiguanli_data_integration') {
        const othersWithCards = state.players?.filter(p =>
          p.id !== playerId && !p.isBankrupt && p.heldCards?.length > 0
        );
        if (othersWithCards?.length > 0) return { cardId: card.id };
      }

      // 工程管理: fund dispatch
      if (card.id === 'fund_dispatch') {
        if (profile?.traits?.seekPoverty) {
          return { cardId: card.id };
        } else if (me.money < 500 && Math.random() < 0.4) {
          return { cardId: card.id };
        }
      }
    }

    // Offensive cards (any_turn)
    if (card.useTiming === 'any_turn') {
      const lead = this._findLeadingPlayer(state, playerId);
      if (lead) {
        if (card.id === 'chance_leap_of_joy' && Math.random() < 0.25) {
          return { cardId: card.id, targetPlayerId: lead };
        }
        if (card.id === 'chance_power_outage' && Math.random() < 0.2) {
          return { cardId: card.id, targetPlayerId: lead };
        }
      }
    }

    return null;
  }

  // ---- Negate Logic ----

  protected _chooseNegate(
    options: OptionItem[],
    state: GameState | null | undefined,
    pa: PendingAction | null | undefined,
    playerId: string,
  ): string {
    const negateOptions = options.filter(o => o.value?.startsWith('negate_use:'));
    if (negateOptions.length === 0) return 'negate_pass';

    const prompt = pa?.prompt || '';
    const isCounterNegate = prompt.includes('反制');
    const targetId = (pa as unknown as Record<string, unknown>)?.targetPlayerId as string
      || this._inferNegateTarget(state, playerId);
    const isTargetSelf = targetId === playerId;
    const sentiment = this._analyzeEventSentiment(prompt);

    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    let useProb = 0;

    if (isCounterNegate) {
      useProb = 0.4;
    } else if (isTargetSelf) {
      if (sentiment < 0) {
        useProb = 0.7;
        if (profile?.focus === 'gpa' && /GPA|学业/.test(prompt)) useProb = 0.9;
        if (profile?.focus === 'money' && /金钱|破产/.test(prompt)) useProb = 0.9;
        if (profile?.focus === 'explore' && /探索/.test(prompt)) useProb = 0.85;
      } else if (sentiment > 0) {
        useProb = 0.0;
      } else {
        useProb = 0.1;
      }
    } else {
      if (sentiment > 0) {
        useProb = 0.5;
        if (profile?.traits?.seekBankruptcy || profile?.focus === 'pvp') useProb = 0.6;
      } else if (sentiment < 0) {
        useProb = 0.0;
        if (profile?.traits?.seekBankruptcy && /金钱|破产/.test(prompt)) useProb = 0.0;
      } else {
        useProb = 0.15;
      }
    }

    if (Math.random() >= useProb) return 'negate_pass';
    return rand(negateOptions).value;
  }

  protected _inferNegateTarget(
    state: GameState | null | undefined,
    selfId: string,
  ): string {
    if (!state?.players || state.currentPlayerIndex == null) return selfId;
    return state.players[state.currentPlayerIndex]?.id || selfId;
  }

  protected _analyzeEventSentiment(prompt: string): number {
    if (!prompt) return 0;
    if (/失去|扣[减除]|损失|罚款|住院|破产|暂停|跳过|减少|负面/.test(prompt)) return -1;
    if (/获得|增[加长]|奖[励金]|领取|收益|免费|翻倍/.test(prompt)) return 1;
    if (/补天|考试|挂科|迟到|逃课|差评|欠费/.test(prompt)) return -1;
    if (/奖学金|实习|推免|科研|志愿|优秀/.test(prompt)) return 1;
    return 0;
  }

  // ---- Huaxue Disable ----

  protected _chooseHuaxueDisable(
    options: OptionItem[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const disableOptions = options.filter(o => o.value?.startsWith('disable_'));
    if (disableOptions.length === 0) {
      return options.find(o => o.value === 'huaxue_skip')?.value || rand(options).value;
    }

    const me = state?.players?.find(p => p.id === playerId);
    if (me?.position?.type === 'main') {
      const currentIdx = (me.position as unknown as { index: number }).index;
      for (let step = 1; step <= 6; step++) {
        const futureIdx = (currentIdx + step) % 28;
        const futureCellId = CELL_IDS[futureIdx];
        if (futureCellId && NEGATIVE_CELLS.has(futureCellId)) {
          const match = disableOptions.find(o => o.value === `disable_${futureCellId}`);
          if (match) return match.value;
        }
      }
    }

    for (const opt of disableOptions) {
      const cellId = opt.value.replace('disable_', '');
      if (NEGATIVE_CELLS.has(cellId)) return opt.value;
    }

    return rand(disableOptions).value;
  }

  // ---- Helpers ----

  protected _findLeadingPlayer(
    state: GameState | null | undefined,
    playerId: string,
    pool?: string[],
  ): string | null {
    const candidates = pool
      || state?.players?.filter(p => p.id !== playerId && !p.isBankrupt)?.map(p => p.id)
      || [];
    if (!state?.players) return null;
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const pid of candidates) {
      const p = state.players.find(pl => pl.id === pid);
      if (!p || p.isBankrupt) continue;
      const score = (p.gpa || 0) * 10 + (p.exploration || 0);
      if (score > bestScore) { bestScore = score; best = pid; }
    }
    return best;
  }

  protected _findPoorestPlayer(
    state: GameState | null | undefined,
    playerId: string,
    pool?: string[],
  ): string | null {
    const candidates = pool
      || state?.players?.filter(p => p.id !== playerId)?.map(p => p.id)
      || [];
    if (!state?.players) return null;
    let worst: string | null = null;
    let worstMoney = Infinity;
    for (const pid of candidates) {
      const p = state.players.find(pl => pl.id === pid);
      if (!p) continue;
      if ((p.money || 0) < worstMoney) { worstMoney = p.money || 0; worst = pid; }
    }
    return worst;
  }
}

// ============================================================
// Section 5: Strategy Implementations
// ============================================================

// ---- Random (Baseline) ----
class RandomStrategy extends Strategy {
  constructor() { super('random'); }

  override choosePlanSelection(
    planData: PlanSelectionData | null | undefined,
    _state: GameState | null | undefined,
    _playerId: string,
  ): PlanSelectionResult {
    if (!planData) return { action: 'keep' };
    if (planData.currentMajor && Math.random() < 0.6) return { action: 'keep' };
    const all = [...(planData.existingPlanIds || []), ...(planData.drawnPlans || []).map(p => p.id)];
    if (all.length === 0) return { action: 'keep' };
    const limit = planData.planSlotLimit || 2;
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, limit);
    return { action: 'adjust', keepPlanIds: shuffled, majorId: shuffled[0] };
  }

  override chooseOption(
    options: OptionItem[] | undefined,
    _state: GameState | null | undefined,
    _pa: PendingAction | null | undefined,
    _playerId: string,
  ): string | null {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;
    if (options.some(o => o.value?.startsWith('negate_'))) {
      return Math.random() < 0.15
        ? (options.find(o => o.value?.startsWith('negate_use:'))?.value || 'negate_pass')
        : 'negate_pass';
    }
    return rand(options).value;
  }

  override chooseCardsToUse(
    heldCards: Array<{ id: string; useTiming?: string; [key: string]: unknown }> | undefined,
    state: GameState | null | undefined,
    playerId: string,
  ): CardAction[] {
    if (!heldCards || heldCards.length === 0) return [];
    const me = state?.players?.find(p => p.id === playerId);
    if (!me) return [];
    const actions: CardAction[] = [];
    for (const card of heldCards) {
      if (NEGATE_CARD_IDS.has(card.id)) continue;
      if (card.id === 'destiny_professional_intent') { actions.push({ cardId: card.id }); continue; }
      if (card.id === 'destiny_urgent_deadline' && me.isInHospital) { actions.push({ cardId: card.id }); continue; }
      if (Math.random() < 0.08) actions.push({ cardId: card.id });
    }
    return actions;
  }
}

// ---- Greedy GPA (Academic) ----
class GreedyGpaStrategy extends Strategy {
  constructor() { super('greedy_gpa'); }
  protected override _planFocusPrefs(): PlanFocus[] { return ['gpa', 'lines', 'special', 'explore']; }
  protected override _adjustProbability(): number { return 0.5; }
}

// ---- Greedy Money (Entrepreneur) ----
class GreedyMoneyStrategy extends Strategy {
  constructor() { super('greedy_money'); }
  protected override _planFocusPrefs(): PlanFocus[] { return ['money', 'special', 'lines', 'pvp']; }
  protected override _adjustProbability(): number { return 0.35; }
}

// ---- Greedy Explore (Adventurer) ----
class GreedyExploreStrategy extends Strategy {
  constructor() { super('greedy_explore'); }
  protected override _planFocusPrefs(): PlanFocus[] { return ['explore', 'lines', 'special', 'gpa']; }
  protected override _adjustProbability(): number { return 0.45; }
}

// ---- Plan Focused ----
class PlanFocusedStrategy extends Strategy {
  constructor() { super('plan_focused'); }
  protected override _planFocusPrefs(): PlanFocus[] {
    return ['lines', 'special', 'position', 'pvp', 'gpa', 'money', 'explore'];
  }
  protected override _adjustProbability(): number { return 0.3; }

  protected override _rankPlans(plans: RankedPlan[]): RankedPlan[] {
    const rareFocuses: PlanFocus[] = ['position', 'pvp', 'special'];
    return [...plans].sort((a, b) => {
      const aProfile = PLAN_PROFILES[a.name];
      const bProfile = PLAN_PROFILES[b.name];
      const aRare = aProfile && rareFocuses.includes(aProfile.focus) ? 0 : 1;
      const bRare = bProfile && rareFocuses.includes(bProfile.focus) ? 0 : 1;
      return aRare - bRare || Math.random() - 0.5;
    });
  }
}

// ---- Balanced (Generalist) ----
class BalancedStrategy extends Strategy {
  constructor() { super('balanced'); }
  protected override _planFocusPrefs(): PlanFocus[] {
    return ['special', 'lines', 'gpa', 'explore', 'money'];
  }
  protected override _adjustProbability(): number { return 0.4; }

  protected override _scoredChoice(
    options: OptionItem[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Check plan-specific choices first
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    // Balanced: boost weakest resource
    const moneyNorm = me ? (me.money || 0) / 3000 : 0.5;
    const gpaNorm = me ? (me.gpa || 0) / 5.0 : 0.5;
    const exploreNorm = me ? (me.exploration || 0) / 30 : 0.5;
    const minResource = Math.min(moneyNorm, gpaNorm, exploreNorm);

    let best: OptionItem | null = null;
    let bestScore = -Infinity;
    for (const opt of options) {
      const fx = analyzeOption(opt);
      let score = fx.money + fx.gpa + fx.explore + Math.random() * 0.2;
      if (minResource === moneyNorm) score += fx.money * 2.5;
      else if (minResource === gpaNorm) score += fx.gpa * 2.5;
      else score += fx.explore * 2.5;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best ? best.value : rand(options).value;
  }
}

// ---- Specialist (Deep Plan Optimizer) ----
class SpecialistStrategy extends Strategy {
  constructor() { super('specialist'); }
  protected override _planFocusPrefs(): PlanFocus[] | null { return null; }
  protected override _adjustProbability(): number { return 0.25; }

  protected override _rankPlans(plans: RankedPlan[]): RankedPlan[] {
    // Random preference -- specialist adapts to whatever plan it gets
    return [...plans].sort(() => Math.random() - 0.5);
  }

  protected override _scoredChoice(
    options: OptionItem[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Plan-specific logic first (most important for specialist)
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    // Fall back to weighted scoring
    const weights = profile?.weights || { money: 1, gpa: 1, explore: 1 };
    let best: OptionItem | null = null;
    let bestScore = -Infinity;
    for (const opt of options) {
      const fx = analyzeOption(opt);
      const score = fx.money * weights.money + fx.gpa * weights.gpa + fx.explore * weights.explore
        + Math.random() * 0.15;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best ? best.value : rand(options).value;
  }

  protected override _evaluateCard(
    card: { id: string; useTiming?: string; [key: string]: unknown },
    me: Player,
    state: GameState,
    playerId: string,
    isMyTurn: boolean,
    profile: PlanProfile | null,
    planName: string | null,
  ): CardAction | null {
    if (NEGATE_CARD_IDS.has(card.id)) return null;
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };

    const synergy = CARD_PLAN_SYNERGY[card.id];
    if (synergy && planName && synergy.plans.includes(planName)) {
      // Higher probability for synergistic cards
      if (isMyTurn || card.useTiming === 'any_turn') {
        if (synergy.useInLine) {
          if (me.position?.type === 'line' && Math.random() < 0.9) return { cardId: card.id };
        } else if (synergy.lineReentry && isMyTurn) {
          if (Math.random() < 0.8) return { cardId: card.id };
        } else if (synergy.offensive) {
          const lead = this._findLeadingPlayer(state, playerId);
          if (lead && Math.random() < 0.5) return { cardId: card.id, targetPlayerId: lead };
        } else if (isMyTurn && Math.random() < Math.min(synergy.prob + 0.2, 0.95)) {
          return { cardId: card.id };
        }
      }
    }

    // Fall back to base evaluation
    return super._evaluateCard(card, me, state, playerId, isMyTurn, profile, planName);
  }
}

// ---- Aggressor (PvP Focus) ----
class AggressorStrategy extends Strategy {
  constructor() { super('aggressor'); }
  protected override _planFocusPrefs(): PlanFocus[] { return ['pvp', 'money', 'explore', 'gpa']; }
  protected override _adjustProbability(): number { return 0.45; }

  override choosePlayer(
    targetIds: string[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const others = targetIds.filter(id => id !== playerId);
    if (others.length === 0) return targetIds[0];
    // Always target the leading player
    return this._findLeadingPlayer(state, playerId, others) || rand(others);
  }

  protected override _evaluateCard(
    card: { id: string; useTiming?: string; [key: string]: unknown },
    me: Player,
    state: GameState,
    playerId: string,
    isMyTurn: boolean,
    profile: PlanProfile | null,
    planName: string | null,
  ): CardAction | null {
    if (NEGATE_CARD_IDS.has(card.id)) return null;
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };

    // Aggressor eagerly uses offensive cards
    const lead = this._findLeadingPlayer(state, playerId);
    if (lead) {
      if (card.id === 'chance_leap_of_joy' && Math.random() < 0.5) {
        return { cardId: card.id, targetPlayerId: lead };
      }
      if (card.id === 'chance_power_outage' && Math.random() < 0.45) {
        return { cardId: card.id, targetPlayerId: lead };
      }
    }

    // Moderate defensive card usage
    if (isMyTurn) {
      if (card.id === 'destiny_maimen_shield' && Math.random() < 0.5) return { cardId: card.id };
      if (card.id === 'destiny_ancestor_exam' && Math.random() < 0.3) return { cardId: card.id };
    }

    return super._evaluateCard(card, me, state, playerId, isMyTurn, profile, planName);
  }

  protected override _chooseNegate(
    options: OptionItem[],
    state: GameState | null | undefined,
    pa: PendingAction | null | undefined,
    playerId: string,
  ): string {
    const negateOptions = options.filter(o => o.value?.startsWith('negate_use:'));
    if (negateOptions.length === 0) return 'negate_pass';

    const targetId = (pa as unknown as Record<string, unknown>)?.targetPlayerId as string
      || this._inferNegateTarget(state, playerId);
    const isTargetSelf = targetId === playerId;
    const sentiment = this._analyzeEventSentiment(pa?.prompt || '');

    let useProb = 0;
    if (isTargetSelf && sentiment < 0) useProb = 0.75;
    else if (!isTargetSelf && sentiment > 0) useProb = 0.65;
    else if (!isTargetSelf && sentiment < 0) useProb = 0.0;
    else useProb = 0.2;

    if (Math.random() >= useProb) return 'negate_pass';
    return rand(negateOptions).value;
  }

  override chooseChain(
    _options: OptionItem[] | undefined,
    _state: GameState | null | undefined,
    _pa: PendingAction | null | undefined,
    _playerId: string,
  ): string {
    return Math.random() < 0.8 ? 'continue' : 'pass';
  }
}

// ---- Tactician (Position & Event Control) ----
class TacticianStrategy extends Strategy {
  constructor() { super('tactician'); }
  protected override _planFocusPrefs(): PlanFocus[] { return ['position', 'lines', 'special', 'pvp']; }
  protected override _adjustProbability(): number { return 0.35; }

  protected override _scoredChoice(
    options: OptionItem[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Plan-specific choices first
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    // Tactician: consider position implications of choices
    const weights = profile?.weights || { money: 0.8, gpa: 1, explore: 1 };
    let best: OptionItem | null = null;
    let bestScore = -Infinity;
    for (const opt of options) {
      const fx = analyzeOption(opt);
      let score = fx.money * weights.money + fx.gpa * weights.gpa + fx.explore * weights.explore;

      // Bonus for options involving movement/position
      if (/移动|前进|后退|跳转|传送/.test(opt.label || '')) score += 0.5;
      // Bonus for options avoiding penalties
      if (/免费|免除|保护|屏蔽/.test(opt.label || '')) score += 0.3;

      score += Math.random() * 0.15;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best ? best.value : rand(options).value;
  }

  protected override _evaluateCard(
    card: { id: string; useTiming?: string; [key: string]: unknown },
    me: Player,
    state: GameState,
    playerId: string,
    isMyTurn: boolean,
    profile: PlanProfile | null,
    planName: string | null,
  ): CardAction | null {
    if (NEGATE_CARD_IDS.has(card.id)) return null;
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };

    // Tactician is patient -- lower base probabilities, higher for synergistic use
    const synergy = CARD_PLAN_SYNERGY[card.id];
    if (synergy && planName && synergy.plans.includes(planName)) {
      if (isMyTurn || card.useTiming === 'any_turn') {
        if (Math.random() < synergy.prob) {
          const lead = synergy.offensive ? this._findLeadingPlayer(state, playerId) : null;
          return { cardId: card.id, targetPlayerId: lead || undefined };
        }
      }
    }

    // Use movement cards strategically
    if (card.id === 'destiny_alternative_path' && isMyTurn && me.position?.type === 'line') {
      const needLines = profile?.traits?.campusLines || profile?.traits?.allCampusLines
        || profile?.traits?.allMainLines || profile?.traits?.gulouEndpoint;
      if (!needLines && Math.random() < 0.3) return { cardId: card.id };
    }

    // Familiar route for line-revisit plans
    if (card.id === 'destiny_familiar_route' && isMyTurn) {
      if (profile?.traits?.campusLines || profile?.traits?.gulouEndpoint || profile?.traits?.pukouMaster) {
        if (Math.random() < 0.65) return { cardId: card.id };
      }
    }

    return null; // Tactician is conservative with non-synergistic cards
  }
}

// ---- Endurance (Long-term Condition Plans) ----
class EnduranceStrategy extends Strategy {
  constructor() { super('endurance'); }
  protected override _planFocusPrefs(): PlanFocus[] { return ['special', 'money', 'lines', 'explore']; }
  protected override _adjustProbability(): number { return 0.2; }

  protected override _rankPlans(plans: RankedPlan[]): RankedPlan[] {
    const endurancePlans = ['大气科学学院', '软件学院', '工程管理学院', '化学化工学院', '哲学系'];
    return [...plans].sort((a, b) => {
      const aEnd = endurancePlans.includes(a.name) ? 0 : 1;
      const bEnd = endurancePlans.includes(b.name) ? 0 : 1;
      return aEnd - bEnd || Math.random() - 0.5;
    });
  }

  protected override _scoredChoice(
    options: OptionItem[],
    state: GameState | null | undefined,
    playerId: string,
  ): string {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Plan-specific choices first
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    // Endurance: play conservatively, avoid risky choices
    let best: OptionItem | null = null;
    let bestScore = -Infinity;
    for (const opt of options) {
      const fx = analyzeOption(opt);
      let score = fx.money * 0.8 + fx.gpa * 1.2 + fx.explore * 1;
      if (/破产|暂停|住院|跳过/.test(opt.label || '')) score -= 1;
      if (/安全|保险|稳定|保持/.test(opt.label || '')) score += 0.5;
      score += Math.random() * 0.15;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best ? best.value : rand(options).value;
  }

  protected override _evaluateCard(
    card: { id: string; useTiming?: string; [key: string]: unknown },
    me: Player,
    state: GameState,
    playerId: string,
    isMyTurn: boolean,
    profile: PlanProfile | null,
    planName: string | null,
  ): CardAction | null {
    if (NEGATE_CARD_IDS.has(card.id)) return null;
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };

    // Only use cards with high synergy
    const synergy = CARD_PLAN_SYNERGY[card.id];
    if (synergy && planName && synergy.plans.includes(planName)) {
      if (isMyTurn && Math.random() < synergy.prob * 0.8) {
        return { cardId: card.id };
      }
    }

    return null; // Endurance saves cards for emergencies
  }

  override chooseChain(
    _options: OptionItem[] | undefined,
    _state: GameState | null | undefined,
    _pa: PendingAction | null | undefined,
    _playerId: string,
  ): string {
    return Math.random() < 0.4 ? 'continue' : 'pass';
  }
}

// ============================================================
// Section 6: Factory & Exports
// ============================================================

const STRATEGY_MAP: Record<string, () => Strategy> = {
  random:         () => new RandomStrategy(),
  greedy_gpa:     () => new GreedyGpaStrategy(),
  greedy_money:   () => new GreedyMoneyStrategy(),
  greedy_explore: () => new GreedyExploreStrategy(),
  plan_focused:   () => new PlanFocusedStrategy(),
  balanced:       () => new BalancedStrategy(),
  specialist:     () => new SpecialistStrategy(),
  aggressor:      () => new AggressorStrategy(),
  tactician:      () => new TacticianStrategy(),
  endurance:      () => new EnduranceStrategy(),
};

export const STRATEGY_NAMES: string[] = Object.keys(STRATEGY_MAP);

/** Weighted random strategy selection -- favor smarter strategies */
const STRATEGY_WEIGHTS: { item: string; weight: number }[] = [
  { item: 'random',         weight: 5 },
  { item: 'greedy_gpa',     weight: 10 },
  { item: 'greedy_money',   weight: 10 },
  { item: 'greedy_explore', weight: 10 },
  { item: 'plan_focused',   weight: 10 },
  { item: 'balanced',       weight: 10 },
  { item: 'specialist',     weight: 18 },
  { item: 'aggressor',      weight: 10 },
  { item: 'tactician',      weight: 10 },
  { item: 'endurance',      weight: 7 },
];

export function createStrategy(name: string): Strategy {
  const factory = STRATEGY_MAP[name];
  if (!factory) throw new Error(`Unknown strategy: ${name}`);
  return factory();
}

export function randomStrategyName(): string {
  return weightedRand(STRATEGY_WEIGHTS);
}
