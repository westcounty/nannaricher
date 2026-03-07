/**
 * AI Strategies for game balance testing — Plan-Aware Smart Strategies
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
 * - aggressor:      pick PvP plans (法学/社会/人工智能), target leading players
 * - tactician:      pick position/event plans, control movement & card timing
 * - endurance:      pick long-term condition plans (大气/软件/工程管理)
 *
 * All strategies (except random) are plan-aware: they use PLAN_PROFILES to make
 * informed decisions about line entry, card usage, option selection, and plan
 * selection based on their assigned training plan's win condition.
 */

// ============================================================
// Section 1: Constants & Plan Knowledge Base
// ============================================================

// Negate cards — reactive only, never use proactively
const NEGATE_CARD_IDS = new Set([
  'chance_pie_in_sky', 'destiny_stop_loss', 'destiny_how_to_explain',
  'chance_info_blocked', 'chance_false_move',
]);

// Main board cell IDs by index (28 cells)
const CELL_IDS = [
  'start', 'line_study', 'tuition', 'chance_2', 'line_pukou', 'zijing', 'chance_1',
  'hospital', 'line_money', 'qingong', 'chance_3', 'line_suzhou', 'retake', 'chance_4',
  'ding', 'line_explore', 'jiang_gong', 'chance_5', 'line_xianlin', 'society', 'chance_6',
  'waiting_room', 'line_gulou', 'kechuang', 'chance_7', 'line_food', 'nanna_cp', 'chuangmen',
];

// Negative cells for 化学化工学院 disable ability
const NEGATIVE_CELLS = new Set([
  'tuition', 'nanna_cp', 'ding', 'chuangmen', 'society',
]);

/**
 * PLAN_PROFILES — comprehensive strategic knowledge for all 33 plans.
 *
 * Each profile encodes what the strategy needs to know:
 *   focus:    resource category ('gpa'|'money'|'explore'|'lines'|'position'|'pvp'|'special')
 *   weights:  { money, gpa, explore } scoring weights for option evaluation
 *   linePrefs: { lineId: 0-1 probability } for line entry decisions
 *   traits:   special behavioral flags
 */
const PLAN_PROFILES = {
  // ---- GPA-focused ----
  '马克思主义学院': {
    focus: 'gpa', weights: { money: 0.3, gpa: 4, explore: 0.5 },
    linePrefs: { study: 0.95, money: 0.25, suzhou: 0.4, explore: 0.2, xianlin: 0.3, gulou: 0.6 },
    traits: { skipSociety: true }, // passive: skip society for +2 explore
  },
  '人工智能学院': {
    focus: 'gpa', weights: { money: 0.3, gpa: 4, explore: 0.3 },
    linePrefs: { study: 0.9, money: 0.2, suzhou: 0.3, explore: 0.2, xianlin: 0.3, gulou: 0.5 },
    traits: { gpaLead: true }, // win by GPA gap ≥ 2.0
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
    traits: { seekPoverty: true }, // win by money ≤ 500 for 6 turns
  },

  // ---- Explore-focused ----
  '社会学院': {
    focus: 'explore', weights: { money: 0.3, gpa: 0.5, explore: 4 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.6, explore: 0.9, xianlin: 0.6, gulou: 0.7 },
    traits: { exploreLead: true }, // win by explore lead ≥ 20
  },
  '政府管理学院': {
    focus: 'explore', weights: { money: 0.5, gpa: 0.5, explore: 3 },
    linePrefs: { study: 0.4, money: 0.4, suzhou: 0.6, explore: 0.85, xianlin: 0.5, gulou: 0.5 },
    traits: { wealthEquality: true }, // win by explore ≥ 20 AND wealth gap ≤ 666
  },

  // ---- Line-focused ----
  '历史学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.95, explore: 0.3, xianlin: 0.95, gulou: 0.95 },
    traits: { campusLines: true }, // win by 12 cells across 4 campus lines
  },
  '地球科学与工程学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.95, explore: 0.3, xianlin: 0.95, gulou: 0.95 },
    traits: { allCampusLines: true }, // win by entering all 4 campus lines
  },
  '地理与海洋科学学院': {
    focus: 'lines', weights: { money: 1, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.95, money: 0.95, suzhou: 0.3, explore: 0.95, xianlin: 0.3, gulou: 0.3 },
    traits: { allMainLines: true }, // win by entering all 4 main lines (money/study/explore/food)
  },
  '艺术学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { pukouMaster: true }, // win by all events in Pukou
  },
  '苏州校区': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.2, money: 0.2, suzhou: 0.95, explore: 0.2, xianlin: 0.2, gulou: 0.2 },
    traits: { suzhouMaster: true }, // win by all events in Suzhou
  },
  '环境学院': {
    focus: 'lines', weights: { money: 0.3, gpa: 0.3, explore: 2 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.4, xianlin: 0.95, gulou: 0.4 },
    traits: { xianlinEvents: true }, // win by 5 different Xianlin events
  },

  // ---- Event/Line condition ----
  '新闻传播学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 1.5, explore: 2 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.95, xianlin: 0.3, gulou: 0.3 },
    traits: { cleanExplore: true }, // complete Explore Line without deductions
  },
  '文学院': {
    focus: 'lines', weights: { money: -1, gpa: 1, explore: 2 },
    linePrefs: { study: 0.3, money: 0.85, suzhou: 0.3, explore: 0.4, xianlin: 0.3, gulou: 0.4 },
    traits: { noMoneyGainInLine: true }, // leave Money Line with no gain
  },
  '化学化工学院': {
    focus: 'special', weights: { money: 1, gpa: 1.5, explore: 1.5 },
    linePrefs: { study: 0.6, money: 0.5, suzhou: 0.5, explore: 0.5, xianlin: 0.5, gulou: 0.5 },
    traits: { consecutivePositive: true }, // 6 consecutive positive-effect turns
  },
  '生命科学学院': {
    focus: 'lines', weights: { money: 0.5, gpa: 0.5, explore: 1.5 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { foodLinePositive: true }, // 3 non-negative effects in Food Line
  },

  // ---- Position-focused ----
  '天文与空间科学学院': {
    focus: 'position', weights: { money: 0.5, gpa: 0.8, explore: 0.8 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { shareCells: true }, // share cell with every player ≥ 2x
  },
  '数学系': {
    focus: 'position', weights: { money: 0.5, gpa: 1, explore: 0.5 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.95 },
    traits: { gulouEndpoint: true }, // reach Gulou endpoint 2x
  },
  '建筑与城市规划学院': {
    focus: 'position', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.7 },
    traits: { visitCorners: true }, // visit 4 of 5 corners (start/hospital/ding/waiting/chuangmen)
  },
  '医学院': {
    focus: 'position', weights: { money: 0.5, gpa: 0.5, explore: 0.5 },
    linePrefs: { study: 0.3, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { hospitalFrequent: true }, // enter Hospital 3x
  },

  // ---- Card/Interaction-focused ----
  '外国语学院': {
    focus: 'special', weights: { money: 0.5, gpa: 0.5, explore: 1.5 },
    linePrefs: { study: 0.4, money: 0.3, suzhou: 0.4, explore: 0.5, xianlin: 0.4, gulou: 0.5 },
    traits: { seekEnglishCards: true }, // draw 2 English-containing cards
  },
  '信息管理学院': {
    focus: 'special', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.4, money: 0.4, suzhou: 0.4, explore: 0.4, xianlin: 0.4, gulou: 0.4 },
    traits: { seekDigitCards: true }, // 4 digit-starting cards
  },
  '国际关系学院': {
    focus: 'pvp', weights: { money: 0.5, gpa: 0.5, explore: 1 },
    linePrefs: { study: 0.4, money: 0.4, suzhou: 0.4, explore: 0.5, xianlin: 0.4, gulou: 0.4 },
    traits: { cardExchange: true }, // give/receive cards 3x
  },
  '海外教育学院': {
    focus: 'pvp', weights: { money: 1, gpa: 0.5, explore: 0.5 },
    linePrefs: { study: 0.3, money: 0.4, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { interceptWinner: true }, // use 2+ chance cards on winner to co-win
  },

  // ---- PvP/Relative ----
  '法学院': {
    focus: 'pvp', weights: { money: 1.5, gpa: 0.5, explore: 0.5 },
    linePrefs: { study: 0.3, money: 0.5, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { seekBankruptcy: true }, // another player bankrupt OR confiscate ≥ 1000
  },

  // ---- Special condition ----
  '计算机科学与技术系': {
    focus: 'special', weights: { money: 0, gpa: 0.5, explore: 0 },
    linePrefs: { study: 0.3, money: 0.2, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.3 },
    traits: { binaryTarget: true }, // money & explore both binary digits only
  },
  '大气科学学院': {
    focus: 'special', weights: { money: -0.5, gpa: 1, explore: 1 },
    linePrefs: { study: 0.5, money: 0.2, suzhou: 0.4, explore: 0.6, xianlin: 0.5, gulou: 0.5 },
    traits: { avoidRichest: true }, // 18 turns not uniquely richest
  },
  '软件学院': {
    focus: 'special', weights: { money: 1, gpa: 0.5, explore: 0.5 },
    linePrefs: { study: 0.6, money: 0.6, suzhou: 0.7, explore: 0.6, xianlin: 0.7, gulou: 0.6 },
    traits: { seekTuition: true }, // total tuition ≥ 4200
  },
  '哲学系': {
    focus: 'special', weights: { money: 0.5, gpa: 1.5, explore: 0.5 },
    linePrefs: { study: 0.5, money: 0.3, suzhou: 0.5, explore: 0.4, xianlin: 0.4, gulou: 0.5 },
    traits: { neutralLine: true, gpaFloor: true }, // complete line with no stat changes
  },
  '物理学院': {
    focus: 'special', weights: { money: 1, gpa: 1.5, explore: 1.5 },
    linePrefs: { study: 0.6, money: 0.5, suzhou: 0.5, explore: 0.6, xianlin: 0.5, gulou: 0.5 },
    traits: { flexibleScoring: true }, // best 2 of 3 stats ≥ 85
  },
  '现代工程与应用科学学院': {
    focus: 'special', weights: { money: 1.5, gpa: 2, explore: 1 },
    linePrefs: { study: 0.6, money: 0.6, suzhou: 0.5, explore: 0.5, xianlin: 0.5, gulou: 0.5 },
    traits: { hybridScoring: true }, // GPA≥4 AND money≥4000, OR mixed ≥60
  },
  '电子科学与工程学院': {
    focus: 'special', weights: { money: 0.5, gpa: 2, explore: 0.5 },
    linePrefs: { study: 0.5, money: 0.3, suzhou: 0.3, explore: 0.3, xianlin: 0.3, gulou: 0.5 },
    traits: { kechuangFocus: true }, // ≥0.6 GPA from Innovation Space
  },
  '匡亚明学院': {
    focus: 'pvp', weights: { money: 1, gpa: 1, explore: 1 },
    linePrefs: { study: 0.5, money: 0.5, suzhou: 0.5, explore: 0.5, xianlin: 0.5, gulou: 0.5 },
    traits: { metaPlayer: true }, // satisfy 2+ other players' conditions
  },
};

// Strategy archetype → preferred plan focus categories
const ARCHETYPE_PLAN_PREFS = {
  greedy_gpa:    ['gpa', 'lines', 'special', 'explore'],
  greedy_money:  ['money', 'special', 'lines', 'pvp'],
  greedy_explore:['explore', 'lines', 'special', 'gpa'],
  balanced:      ['special', 'lines', 'gpa', 'explore', 'money'],
  specialist:    null, // picks any plan, then optimizes
  aggressor:     ['pvp', 'money', 'explore'],
  tactician:     ['position', 'lines', 'special'],
  endurance:     ['special', 'money', 'lines'],
};

// Cards that have strategic synergy with specific plans
const CARD_PLAN_SYNERGY = {
  // Destiny cards
  'destiny_maimen_shield':     { plans: ['生命科学学院'], useInLine: 'food', prob: 0.9 },
  'destiny_alternative_path':  { plans: ['新闻传播学院', '哲学系'], lineEscape: true, prob: 0.6 },
  'destiny_familiar_route':    { plans: ['历史学院', '地球科学与工程学院', '艺术学院', '苏州校区', '数学系'], lineReentry: true, prob: 0.7 },
  'destiny_cross_college_exit':{ plans: ['匡亚明学院'], prob: 0.5 },
  'destiny_professional_intent':{ plans: [], alwaysUse: true, prob: 1.0 },
  'destiny_urgent_deadline':   { plans: [], hospitalEscape: true, prob: 1.0 },
  'destiny_negative_balance':  { plans: ['商学院'], moneyProtect: true, prob: 0.7 },
  'destiny_test_waters':       { plans: ['商学院'], moneyProtect: true, prob: 0.7 },
  'destiny_ancestor_exam':     { plans: ['马克思主义学院', '人工智能学院'], gpaProtect: true, prob: 0.6 },
  'destiny_campus_legend':     { plans: ['社会学院', '环境学院'], exploreProtect: true, prob: 0.6 },
  // Chance cards (offensive)
  'chance_leap_of_joy':        { plans: ['法学院', '社会学院'], offensive: true, prob: 0.4 },
  'chance_power_outage':       { plans: ['法学院'], offensive: true, prob: 0.35 },
};

// ============================================================
// Section 2: Utility Functions
// ============================================================

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRand(items) {
  // items = [{ item, weight }]
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const { item, weight } of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

/** Analyze option effects from effectPreview or label text */
function analyzeOption(option) {
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
function analyzeLabel(label) {
  if (!label) return { money: 0, gpa: 0, explore: 0 };
  const s = { money: 0, gpa: 0, explore: 0 };
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
function isPlanOption(label) {
  return !!PLAN_PROFILES[label];
}

/** Get player's major plan name from state */
function getMajorPlanName(player) {
  if (!player?.majorPlan) return null;
  const plan = (player.trainingPlans || []).find(tp => tp.id === player.majorPlan);
  return plan ? plan.name : null;
}

/** Get plan profile for player */
function getPlayerProfile(player) {
  const name = getMajorPlanName(player);
  return name ? PLAN_PROFILES[name] : null;
}

/** Check if money is a binary-looking number (all digits are 0 or 1) */
function isBinaryLike(n) {
  if (n < 0) return false;
  return String(n).split('').every(d => d === '0' || d === '1');
}

/** Get lines the player has visited */
function getVisitedLines(player) {
  return new Set(player.linesVisited || []);
}

// ============================================================
// Section 3: BaseStrategy (Plan-Aware)
// ============================================================

class BaseStrategy {
  constructor(name) { this.name = name; }

  // ---- Plan Selection (parallel mode) ----

  /**
   * Choose plans during parallel_plan_selection.
   * @param {Object} myData - { drawnPlans, existingPlanIds, currentMajor, currentMinors, planSlotLimit }
   * @param {Object} state - full game state
   * @param {string} playerId
   * @returns {{ action: 'keep' } | { action: 'adjust', keepPlanIds: string[], majorId: string }}
   */
  choosePlanSelection(myData, state, playerId) {
    if (!myData) return { action: 'keep' };

    const { drawnPlans, existingPlanIds, currentMajor, planSlotLimit } = myData;
    const player = state?.players?.find(p => p.id === playerId);

    // Get all available plans with names
    const allAvailable = [];
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
    const currentProfile = currentMajorPlan ? PLAN_PROFILES[currentMajorPlan.name] : null;
    const bestNew = this._rankPlans(drawnPlans.map(p => ({ id: p.id, name: p.name, isNew: true })));

    if (bestNew.length > 0 && this._shouldSwitch(currentProfile, PLAN_PROFILES[bestNew[0].name])) {
      return this._selectBestPlans(allAvailable, planSlotLimit, player);
    }

    // Probability-based adjustment
    if (Math.random() < this._adjustProbability()) {
      return this._selectBestPlans(allAvailable, planSlotLimit, player);
    }

    return { action: 'keep' };
  }

  /** Rank plans by preference for this strategy. Override in subclasses. */
  _rankPlans(plans) {
    const prefs = this._planFocusPrefs();
    if (!prefs) return plans; // no preference, keep order

    return [...plans].sort((a, b) => {
      const aProfile = PLAN_PROFILES[a.name];
      const bProfile = PLAN_PROFILES[b.name];
      const aRank = aProfile ? prefs.indexOf(aProfile.focus) : 99;
      const bRank = bProfile ? prefs.indexOf(bProfile.focus) : 99;
      if (aRank !== bRank) return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
      return 0;
    });
  }

  /** Plan focus preferences (ordered). Override in subclasses. */
  _planFocusPrefs() { return null; }

  /** Probability of adjusting plans at selection time. Override in subclasses. */
  _adjustProbability() { return 0.4; }

  /** Should we switch from current to new plan? */
  _shouldSwitch(currentProfile, newProfile) {
    if (!currentProfile && newProfile) return true;
    if (!newProfile) return false;
    const prefs = this._planFocusPrefs();
    if (!prefs) return Math.random() < 0.3;
    const currentRank = currentProfile ? prefs.indexOf(currentProfile.focus) : 99;
    const newRank = prefs.indexOf(newProfile.focus);
    return newRank >= 0 && (currentRank < 0 || newRank < currentRank);
  }

  /** Select best plans from available pool */
  _selectBestPlans(allAvailable, limit, player) {
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

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;

    // Negate window
    if (options.some(o => o.value?.startsWith('negate_'))) {
      return this._chooseNegate(options, state, pa, playerId);
    }

    // 化学化工学院 disable
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
  _choosePlanFromOptions(options) {
    const prefs = this._planFocusPrefs();
    if (!prefs) return rand(options).value;
    for (const focus of prefs) {
      const match = options.find(o => PLAN_PROFILES[o.label]?.focus === focus);
      if (match) return match.value;
    }
    return rand(options).value;
  }

  /** Choose whether to enter a line */
  _chooseLineEntry(options, state, playerId) {
    const enter = options.find(o => o.value.startsWith('enter_'));
    const skip = options.find(o => o.value === 'skip');
    if (!enter) return skip?.value || options[0].value;
    if (!skip) return enter.value;

    const lineId = enter.value.slice(6); // 'enter_xxx' → 'xxx'
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Use plan-specific line preference
    let prob = profile?.linePrefs?.[lineId] ?? 0.5;

    // Boost if plan needs this line and we haven't visited it
    if (profile?.traits) {
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
      if (profile.traits.seekTuition) prob = Math.max(prob, 0.75); // enter more lines for tuition
    }

    return Math.random() < prob ? enter.value : 'skip';
  }

  /** Score all options using plan-aware weights */
  _scoredChoice(options, state, playerId) {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;
    const weights = profile?.weights || { money: 1, gpa: 1, explore: 1 };

    // Plan-specific special choices
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const fx = analyzeOption(opt);
      const score = fx.money * weights.money + fx.gpa * weights.gpa + fx.explore * weights.explore
        + Math.random() * 0.2;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best ? best.value : rand(options).value;
  }

  /** Plan-specific option selection logic */
  _planSpecificChoice(options, state, me, profile) {
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
        // We're near richest — prefer options that don't gain money
        const noMoney = options.filter(o => {
          const fx = analyzeOption(o);
          return fx.money <= 0;
        });
        if (noMoney.length > 0) return rand(noMoney).value;
      }
    }

    // 计算机: prefer options that move money/explore toward binary values
    if (traits.binaryTarget) {
      let bestOpt = null, bestDist = Infinity;
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
      let best = null, bestGain = -Infinity;
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
  _binaryDistance(n) {
    if (n < 0) return 999;
    if (isBinaryLike(n)) return 0;
    // Check nearby binary numbers
    for (let d = 1; d <= 50; d++) {
      if (isBinaryLike(n + d) || isBinaryLike(n - d)) return d;
    }
    return 100;
  }

  // ---- Player Selection ----

  choosePlayer(targetIds, state, playerId) {
    const others = targetIds.filter(id => id !== playerId);
    if (others.length === 0) return targetIds[0];

    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // PvP plans: target strategically
    if (profile?.traits?.seekBankruptcy) {
      // 法学: target poorest player (most likely to bankrupt)
      return this._findPoorestPlayer(state, playerId, others) || rand(others);
    }

    if (profile?.traits?.interceptWinner) {
      // 海外: target leading player to use chance cards on them
      return this._findLeadingPlayer(state, playerId, others) || rand(others);
    }

    return rand(others);
  }

  // ---- Vote & Chain ----

  chooseVote(options, state, pa, playerId) {
    return this.chooseOption(options, state, pa, playerId);
  }

  chooseChain(options, state, pa, playerId) {
    const profile = getPlayerProfile(state?.players?.find(p => p.id === playerId));
    // Chain actions are more valuable for card-dependent plans
    if (profile?.traits?.cardExchange || profile?.traits?.interceptWinner) {
      return Math.random() < 0.8 ? 'continue' : 'pass';
    }
    return Math.random() < 0.6 ? 'continue' : 'pass';
  }

  // ---- Card Usage ----

  chooseCardsToUse(heldCards, state, playerId) {
    if (!heldCards || heldCards.length === 0) return [];
    const me = state?.players?.find(p => p.id === playerId);
    if (!me) return [];
    const isMyTurn = state.players[state.currentPlayerIndex]?.id === playerId;
    const profile = getPlayerProfile(me);
    const planName = getMajorPlanName(me);
    const actions = [];

    for (const card of heldCards) {
      if (NEGATE_CARD_IDS.has(card.id)) continue;
      const decision = this._evaluateCard(card, me, state, playerId, isMyTurn, profile, planName);
      if (decision) actions.push(decision);
    }
    return actions;
  }

  _evaluateCard(card, me, state, playerId, isMyTurn, profile, planName) {
    if (NEGATE_CARD_IDS.has(card.id)) return null;

    // Always use plan slot expansion
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };

    // Hospital escape — use immediately when stuck
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) {
      return { cardId: card.id };
    }

    // Check plan-specific card synergies
    const synergy = CARD_PLAN_SYNERGY[card.id];
    if (synergy && planName) {
      // If this card has special synergy with our plan
      if (synergy.plans.includes(planName) || synergy.alwaysUse) {
        // Line-specific cards: only use when in the right line
        if (synergy.useInLine && me.position?.type === 'line') {
          if (isMyTurn && Math.random() < synergy.prob) return { cardId: card.id };
        }
        // Line reentry: use when we need to revisit completed lines
        if (synergy.lineReentry && isMyTurn) {
          if (Math.random() < synergy.prob) return { cardId: card.id };
        }
        // Protection cards: use when they match our focus
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
      // Protection cards based on resource focus
      if (profile?.focus === 'gpa' && card.id === 'destiny_ancestor_exam' && Math.random() < 0.5) {
        return { cardId: card.id };
      }
      if (profile?.focus === 'money' && card.id === 'destiny_negative_balance' && Math.random() < 0.5) {
        return { cardId: card.id };
      }
      if (profile?.focus === 'explore' && card.id === 'destiny_campus_legend' && Math.random() < 0.5) {
        return { cardId: card.id };
      }

      // Line shortcut — use for non-line-focused plans
      if (card.id === 'destiny_alternative_path' && me.position?.type === 'line') {
        const needLines = profile?.traits?.campusLines || profile?.traits?.allCampusLines
          || profile?.traits?.allMainLines || profile?.traits?.gulouEndpoint
          || profile?.traits?.xianlinEvents || profile?.traits?.suzhouMaster
          || profile?.traits?.cleanExplore || profile?.traits?.pukouMaster;
        if (!needLines && Math.random() < 0.35) return { cardId: card.id };
      }

      // Maimen shield in food line
      if (card.id === 'destiny_maimen_shield' && isMyTurn && Math.random() < 0.4) {
        return { cardId: card.id };
      }

      // 信息管理专属: 数据整合
      if (card.id === 'xinxiguanli_data_integration') {
        const othersWithCards = state.players?.filter(p =>
          p.id !== playerId && !p.isBankrupt && p.heldCards?.length > 0
        );
        if (othersWithCards?.length > 0) return { cardId: card.id };
      }

      // 工程管理专属: 资金调度令
      if (card.id === 'fund_dispatch') {
        if (profile?.traits?.seekPoverty) {
          // Want low money — use to set to minimum
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

  _chooseNegate(options, state, pa, playerId) {
    const negateOptions = options.filter(o => o.value?.startsWith('negate_use:'));
    if (negateOptions.length === 0) return 'negate_pass';

    const prompt = pa?.prompt || '';
    const isCounterNegate = prompt.includes('反制');
    const targetId = pa?.targetPlayerId || this._inferNegateTarget(state, playerId);
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
        // Higher urgency if event threatens plan-critical resources
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
        // Higher urgency against strong opponents
        if (profile?.traits?.seekBankruptcy || profile?.focus === 'pvp') useProb = 0.6;
      } else if (sentiment < 0) {
        useProb = 0.0;
        // 法学: let opponents suffer money loss (we get confiscation)
        if (profile?.traits?.seekBankruptcy && /金钱|破产/.test(prompt)) useProb = 0.0;
      } else {
        useProb = 0.15;
      }
    }

    if (Math.random() >= useProb) return 'negate_pass';
    return rand(negateOptions).value;
  }

  _inferNegateTarget(state, selfId) {
    if (!state?.players || state.currentPlayerIndex == null) return selfId;
    return state.players[state.currentPlayerIndex]?.id || selfId;
  }

  _analyzeEventSentiment(prompt) {
    if (!prompt) return 0;
    if (/失去|扣[减除]|损失|罚款|住院|破产|暂停|跳过|减少|负面/.test(prompt)) return -1;
    if (/获得|增[加长]|奖[励金]|领取|收益|免费|翻倍/.test(prompt)) return 1;
    if (/补天|考试|挂科|迟到|逃课|差评|欠费/.test(prompt)) return -1;
    if (/奖学金|实习|推免|科研|志愿|优秀/.test(prompt)) return 1;
    return 0;
  }

  // ---- 化学化工学院 Disable ----

  _chooseHuaxueDisable(options, state, playerId) {
    const disableOptions = options.filter(o => o.value?.startsWith('disable_'));
    if (disableOptions.length === 0) {
      return options.find(o => o.value === 'huaxue_skip')?.value || rand(options).value;
    }

    const me = state?.players?.find(p => p.id === playerId);
    if (me?.position?.type === 'main') {
      const currentIdx = me.position.index;
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

  _findLeadingPlayer(state, playerId, pool) {
    const candidates = pool || state?.players?.filter(p => p.id !== playerId && !p.isBankrupt)?.map(p => p.id) || [];
    if (!state?.players) return null;
    let best = null, bestScore = -Infinity;
    for (const pid of candidates) {
      const p = state.players.find(pl => pl.id === pid);
      if (!p || p.isBankrupt) continue;
      const score = (p.gpa || 0) * 10 + (p.exploration || 0);
      if (score > bestScore) { bestScore = score; best = pid; }
    }
    return best;
  }

  _findPoorestPlayer(state, playerId, pool) {
    const candidates = pool || state?.players?.filter(p => p.id !== playerId)?.map(p => p.id) || [];
    if (!state?.players) return null;
    let worst = null, worstMoney = Infinity;
    for (const pid of candidates) {
      const p = state.players.find(pl => pl.id === pid);
      if (!p) continue;
      if ((p.money || 0) < worstMoney) { worstMoney = p.money || 0; worst = pid; }
    }
    return worst;
  }
}


// ============================================================
// Section 4: Strategy Implementations
// ============================================================

// ---- Random (Baseline) ----
class RandomStrategy extends BaseStrategy {
  constructor() { super('random'); }

  choosePlanSelection(myData, state, playerId) {
    if (!myData) return { action: 'keep' };
    if (myData.currentMajor && Math.random() < 0.6) return { action: 'keep' };
    // Random plan from available
    const all = [...(myData.existingPlanIds || []), ...(myData.drawnPlans || []).map(p => p.id)];
    if (all.length === 0) return { action: 'keep' };
    const limit = myData.planSlotLimit || 2;
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, limit);
    return { action: 'adjust', keepPlanIds: shuffled, majorId: shuffled[0] };
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;
    if (options.some(o => o.value?.startsWith('negate_'))) {
      return Math.random() < 0.15 ? (options.find(o => o.value?.startsWith('negate_use:'))?.value || 'negate_pass') : 'negate_pass';
    }
    return rand(options).value;
  }

  chooseCardsToUse(heldCards, state, playerId) {
    // Random uses cards with low probability
    if (!heldCards || heldCards.length === 0) return [];
    const me = state?.players?.find(p => p.id === playerId);
    if (!me) return [];
    const actions = [];
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
class GreedyGpaStrategy extends BaseStrategy {
  constructor() { super('greedy_gpa'); }
  _planFocusPrefs() { return ['gpa', 'lines', 'special', 'explore']; }
  _adjustProbability() { return 0.5; }
}

// ---- Greedy Money (Entrepreneur) ----
class GreedyMoneyStrategy extends BaseStrategy {
  constructor() { super('greedy_money'); }
  _planFocusPrefs() { return ['money', 'special', 'lines', 'pvp']; }
  _adjustProbability() { return 0.35; }
}

// ---- Greedy Explore (Adventurer) ----
class GreedyExploreStrategy extends BaseStrategy {
  constructor() { super('greedy_explore'); }
  _planFocusPrefs() { return ['explore', 'lines', 'special', 'gpa']; }
  _adjustProbability() { return 0.45; }
}

// ---- Plan Focused ----
class PlanFocusedStrategy extends BaseStrategy {
  constructor() { super('plan_focused'); }
  _planFocusPrefs() { return ['lines', 'special', 'position', 'pvp', 'gpa', 'money', 'explore']; }
  _adjustProbability() { return 0.3; }

  // Override: plan_focused prefers rare/interesting plans
  _rankPlans(plans) {
    const rareFocuses = ['position', 'pvp', 'special'];
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
class BalancedStrategy extends BaseStrategy {
  constructor() { super('balanced'); }
  _planFocusPrefs() { return ['special', 'lines', 'gpa', 'explore', 'money']; }
  _adjustProbability() { return 0.4; }

  _scoredChoice(options, state, playerId) {
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

    let best = null, bestScore = -Infinity;
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
class SpecialistStrategy extends BaseStrategy {
  constructor() { super('specialist'); }
  _planFocusPrefs() { return null; } // accepts any plan
  _adjustProbability() { return 0.25; } // low — committed to current plan

  _rankPlans(plans) {
    // Random preference — specialist adapts to whatever plan it gets
    return plans.sort(() => Math.random() - 0.5);
  }

  // Override: specialist deeply evaluates based on plan profile
  _scoredChoice(options, state, playerId) {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Plan-specific logic first (most important for specialist)
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    // Fall back to weighted scoring
    const weights = profile?.weights || { money: 1, gpa: 1, explore: 1 };
    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const fx = analyzeOption(opt);
      const score = fx.money * weights.money + fx.gpa * weights.gpa + fx.explore * weights.explore
        + Math.random() * 0.15;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best ? best.value : rand(options).value;
  }

  // Override: specialist uses cards more aggressively for plan synergy
  _evaluateCard(card, me, state, playerId, isMyTurn, profile, planName) {
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
class AggressorStrategy extends BaseStrategy {
  constructor() { super('aggressor'); }
  _planFocusPrefs() { return ['pvp', 'money', 'explore', 'gpa']; }
  _adjustProbability() { return 0.45; }

  // Override: aggressor targets opponents more aggressively
  choosePlayer(targetIds, state, playerId) {
    const others = targetIds.filter(id => id !== playerId);
    if (others.length === 0) return targetIds[0];

    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Always target the leading player
    return this._findLeadingPlayer(state, playerId, others) || rand(others);
  }

  _evaluateCard(card, me, state, playerId, isMyTurn, profile, planName) {
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

  // Aggressor negates more aggressively
  _chooseNegate(options, state, pa, playerId) {
    const negateOptions = options.filter(o => o.value?.startsWith('negate_use:'));
    if (negateOptions.length === 0) return 'negate_pass';

    const targetId = pa?.targetPlayerId || this._inferNegateTarget(state, playerId);
    const isTargetSelf = targetId === playerId;
    const sentiment = this._analyzeEventSentiment(pa?.prompt || '');

    let useProb = 0;
    if (isTargetSelf && sentiment < 0) useProb = 0.75;
    else if (!isTargetSelf && sentiment > 0) useProb = 0.65; // deny opponent benefits
    else if (!isTargetSelf && sentiment < 0) useProb = 0.0; // let opponents suffer
    else useProb = 0.2;

    if (Math.random() >= useProb) return 'negate_pass';
    return rand(negateOptions).value;
  }

  chooseChain(options, state, pa, playerId) {
    // Aggressor always continues chains (more interaction)
    return Math.random() < 0.8 ? 'continue' : 'pass';
  }
}

// ---- Tactician (Position & Event Control) ----
class TacticianStrategy extends BaseStrategy {
  constructor() { super('tactician'); }
  _planFocusPrefs() { return ['position', 'lines', 'special', 'pvp']; }
  _adjustProbability() { return 0.35; }

  _scoredChoice(options, state, playerId) {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Plan-specific choices first
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    // Tactician: consider position implications of choices
    // Prefer options that give movement control or avoid negative cells
    const weights = profile?.weights || { money: 0.8, gpa: 1, explore: 1 };
    let best = null, bestScore = -Infinity;
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

  // Tactician saves cards more carefully, uses them at optimal moments
  _evaluateCard(card, me, state, playerId, isMyTurn, profile, planName) {
    if (NEGATE_CARD_IDS.has(card.id)) return null;
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };

    // Tactician is patient — lower base probabilities, higher for synergistic use
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
      // Only use if we don't need this line
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
class EnduranceStrategy extends BaseStrategy {
  constructor() { super('endurance'); }
  _planFocusPrefs() { return ['special', 'money', 'lines', 'explore']; }
  _adjustProbability() { return 0.2; } // very committed to current plan

  _rankPlans(plans) {
    // Prefer endurance-type plans
    const endurancePlans = ['大气科学学院', '软件学院', '工程管理学院', '化学化工学院', '哲学系'];
    return [...plans].sort((a, b) => {
      const aEnd = endurancePlans.includes(a.name) ? 0 : 1;
      const bEnd = endurancePlans.includes(b.name) ? 0 : 1;
      return aEnd - bEnd || Math.random() - 0.5;
    });
  }

  _scoredChoice(options, state, playerId) {
    const me = state?.players?.find(p => p.id === playerId);
    const profile = me ? getPlayerProfile(me) : null;

    // Plan-specific choices first
    if (profile?.traits && me) {
      const special = this._planSpecificChoice(options, state, me, profile);
      if (special) return special;
    }

    // Endurance: play conservatively, avoid risky choices
    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const fx = analyzeOption(opt);
      // Conservative: slightly prefer safe/positive options
      let score = fx.money * 0.8 + fx.gpa * 1.2 + fx.explore * 1;
      // Penalty for risky options
      if (/破产|暂停|住院|跳过/.test(opt.label || '')) score -= 1;
      if (/安全|保险|稳定|保持/.test(opt.label || '')) score += 0.5;
      score += Math.random() * 0.15;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best ? best.value : rand(options).value;
  }

  // Endurance is very conservative with card usage
  _evaluateCard(card, me, state, playerId, isMyTurn, profile, planName) {
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

    // Endurance saves cards for emergencies
    // Only use defensive cards when really needed
    if (isMyTurn && me.isInHospital && card.id === 'destiny_urgent_deadline') {
      return { cardId: card.id };
    }

    return null;
  }

  chooseChain(options, state, pa, playerId) {
    // Endurance avoids risk — pass more often
    return Math.random() < 0.4 ? 'continue' : 'pass';
  }
}


// ============================================================
// Section 5: Factory & Exports
// ============================================================

const STRATEGY_MAP = {
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

export const STRATEGY_NAMES = Object.keys(STRATEGY_MAP);

// Weighted random strategy selection — favor smarter strategies
const STRATEGY_WEIGHTS = [
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

export function createStrategy(name) {
  const factory = STRATEGY_MAP[name];
  if (!factory) throw new Error(`Unknown strategy: ${name}`);
  return factory();
}

export function randomStrategyName() {
  return weightedRand(STRATEGY_WEIGHTS);
}

export { PLAN_PROFILES };
