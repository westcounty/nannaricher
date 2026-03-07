/**
 * AI Strategies for game balance testing
 *
 * Six strategies simulate different player approaches:
 * - random: baseline, all choices random
 * - greedy_gpa: prioritize GPA growth
 * - greedy_money: prioritize money accumulation
 * - greedy_explore: prioritize exploration value
 * - plan_focused: prioritize resources matching major plan win condition
 * - balanced: prioritize the weakest resource dimension
 */

// Negate cards — can only be used reactively during negate windows, not proactively
const NEGATE_CARD_IDS = new Set([
  'chance_pie_in_sky', 'destiny_stop_loss', 'destiny_how_to_explain',
  'chance_info_blocked', 'chance_false_move',
]);

// Plan categorization by win condition focus
const PLAN_FOCUS = {
  '马克思主义学院': 'gpa',
  '人工智能学院': 'gpa',
  '物理学院': 'gpa',
  '哲学系': 'gpa',
  '商学院': 'money',
  '软件学院': 'money',
  '工程管理学院': 'money',
  '法学院': 'money',
  '文学院': 'money',
  '大气科学学院': 'money',
  '化学化工学院': 'explore',
  '社会学院': 'explore',
  '新闻传播学院': 'explore',
  '环境学院': 'explore',
  '历史学院': 'lines',
  '现代工程与应用科学学院': 'lines',
  '地球科学与工程学院': 'lines',
  '地理与海洋科学学院': 'lines',
  '建筑与城市规划学院': 'lines',
  '数学系': 'lines',
  '艺术学院': 'lines',
  '苏州校区': 'lines',
  '医学院': 'lines',
  '生命科学学院': 'lines',
  '外国语学院': 'special',
  '信息管理学院': 'special',
  '国际关系学院': 'special',
  '计算机科学与技术系': 'special',
  '电子科学与工程学院': 'special',
  '天文与空间科学学院': 'special',
  '匡亚明学院': 'special',
  '海外教育学院': 'special',
  '政府管理学院': 'special',
};

// Strategy plan focus preferences (ordered by priority)
const STRATEGY_PLAN_PREFS = {
  greedy_gpa: ['gpa', 'lines', 'special', 'explore', 'money'],
  greedy_money: ['money', 'special', 'lines', 'gpa', 'explore'],
  greedy_explore: ['explore', 'lines', 'special', 'gpa', 'money'],
};

// Cells that are predominantly negative — 化学化工学院 should prioritize disabling these
const NEGATIVE_CELLS = new Set([
  'tuition',     // 交学费 — always costs money
  'nanna_cp',    // 南哪诚品 — give money to others
  'ding',        // 鼎 — skip turn
  'chuangmen',   // 闯门 — lose GPA or skip turn
  'society',     // 社团 — costs money or GPA to gamble
]);

// Line entry probability per strategy (pukou/food are forced, not listed)
const LINE_ENTER_PREFS = {
  random:        { study: 0.5, money: 0.5, suzhou: 0.5, explore: 0.5, xianlin: 0.5, gulou: 0.5 },
  greedy_gpa:    { study: 0.9, money: 0.2, suzhou: 0.5, explore: 0.3, xianlin: 0.4, gulou: 0.7 },
  greedy_money:  { study: 0.3, money: 0.9, suzhou: 0.4, explore: 0.2, xianlin: 0.4, gulou: 0.3 },
  greedy_explore:{ study: 0.2, money: 0.3, suzhou: 0.7, explore: 0.9, xianlin: 0.6, gulou: 0.8 },
};

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Analyze a Chinese option label for resource impact */
function analyzeLabel(label) {
  if (!label) return { money: 0, gpa: 0, explore: 0 };
  const s = { money: 0, gpa: 0, explore: 0 };

  // Money positive
  if (/金钱[增获]|[获赚领]得.*[金钱元]|金钱?\s*[+＋]|\+\s*\d+.*[金钱元]/.test(label)) s.money += 1;
  // Money negative
  if (/金钱[减失]|[失花支付扣].*[金钱元]|金钱?\s*[-−]|-\s*\d+.*[金钱元]/.test(label)) s.money -= 1;

  // GPA positive
  if (/GPA[增获]|GPA\s*[+＋]|\+.*GPA|学习|补天成功/.test(label)) s.gpa += 1;
  // GPA negative
  if (/GPA[减失]|GPA\s*[-−]|-.*GPA/.test(label)) s.gpa -= 1;

  // Explore positive
  if (/探索值?[增获]|探索\s*[+＋]|\+.*探索/.test(label)) s.explore += 1;
  // Explore negative
  if (/探索值?[减失]|探索\s*[-−]|-.*探索/.test(label)) s.explore -= 1;

  // Penalties
  if (/暂停|停留.*回合|住院/.test(label)) { s.money -= 0.3; s.gpa -= 0.3; s.explore -= 0.3; }
  if (/破产/.test(label)) s.money -= 2;

  return s;
}

/** Check if an option label looks like a plan name */
function isPlanOption(label) {
  return !!PLAN_FOCUS[label];
}

// ============================================================
// Strategy classes
// ============================================================

class BaseStrategy {
  constructor(name) { this.name = name; }

  /** Pick plan from options by focus preference (returns option value) */
  pickPlanFromOptions(options, prefs) {
    if (!prefs) return rand(options).value;
    // Find options that match plan names
    for (const focus of prefs) {
      const match = options.find(o => PLAN_FOCUS[o.label] === focus);
      if (match) return match.value;
    }
    return rand(options).value;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;

    // Negate window: decide whether to use a negate card
    if (options.some(o => o.value?.startsWith('negate_'))) {
      return this._chooseNegate(options, state, pa, playerId);
    }

    // 化学化工学院能力：优先禁用负面格子
    if (options.some(o => o.value?.startsWith('disable_'))) {
      return this._chooseHuaxueDisable(options, state, playerId);
    }

    // Plan selection: options are plan names
    if (options.some(o => isPlanOption(o.label))) {
      return this.pickPlanFromOptions(options);
    }

    // "不调整/调整" choice for yearly plan selection
    if (options.some(o => o.value === 'keep' || o.value === 'adjust')) {
      return Math.random() < 0.4 ? 'adjust' : 'keep';
    }

    // Major plan selection (options labeled 主修:xxx)
    if (pa?.prompt?.includes('主修') && options.length >= 2) {
      return rand(options).value;
    }

    return rand(options).value;
  }

  choosePlayer(targetIds, state, playerId) {
    const others = targetIds.filter(id => id !== playerId);
    if (others.length === 0) return targetIds[0];
    return rand(others);
  }

  chooseVote(options, state, pa, playerId) {
    return this.chooseOption(options, state, pa, playerId);
  }

  chooseChain(options, state, pa, playerId) {
    return Math.random() < 0.6 ? 'continue' : 'pass';
  }

  /**
   * Decide which held cards to use proactively.
   * Returns array of { cardId, targetPlayerId? } to use, in order.
   * Called each iteration of the game loop for the current turn player.
   */
  chooseCardsToUse(heldCards, state, playerId) {
    if (!heldCards || heldCards.length === 0) return [];
    const me = state?.players?.find(p => p.id === playerId);
    if (!me) return [];
    const isMyTurn = state.players[state.currentPlayerIndex]?.id === playerId;
    const actions = [];

    for (const card of heldCards) {
      if (NEGATE_CARD_IDS.has(card.id)) continue; // Negate cards are reactive-only
      const decision = this._evaluateCard(card, me, state, playerId, isMyTurn);
      if (decision) actions.push(decision);
    }
    return actions;
  }

  /** Evaluate a single card for use. Override in subclasses for smarter play. */
  _evaluateCard(card, me, state, playerId, isMyTurn) {
    // Negate cards cannot be used proactively — skip
    if (NEGATE_CARD_IDS.has(card.id)) return null;

    // Always-use cards (pure benefit, any_turn)
    if (card.id === 'destiny_professional_intent') {
      return { cardId: card.id };
    }

    // Hospital escape - use immediately when stuck
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) {
      return { cardId: card.id };
    }

    // Own-turn protective cards - use with some probability
    if (isMyTurn) {
      // Preemptive shields
      if (card.id === 'destiny_maimen_shield' && Math.random() < 0.4) {
        return { cardId: card.id };
      }
      // Line shortcut
      if (card.id === 'destiny_alternative_path' && me.position?.type === 'line' && Math.random() < 0.3) {
        return { cardId: card.id };
      }
    }

    // Targeting cards (any_turn) - target the leading player
    if (card.useTiming === 'any_turn') {
      const leadPlayer = this._findLeadingPlayer(state, playerId);
      if (card.id === 'chance_leap_of_joy' && leadPlayer && Math.random() < 0.25) {
        return { cardId: card.id, targetPlayerId: leadPlayer };
      }
      if (card.id === 'chance_power_outage' && leadPlayer && Math.random() < 0.2) {
        return { cardId: card.id, targetPlayerId: leadPlayer };
      }
    }

    return null;
  }

  /**
   * Decide whether to use a negate card during a negate window.
   * Smart strategy: negate events that hurt self or benefit opponents.
   */
  _chooseNegate(options, state, pa, playerId) {
    const negateOptions = options.filter(o => o.value?.startsWith('negate_use:'));
    if (negateOptions.length === 0) return 'negate_pass';

    const prompt = pa?.prompt || '';
    const isCounterNegate = prompt.includes('反制');

    // Determine who the event affects
    const targetId = pa?.targetPlayerId || this._inferNegateTarget(state, playerId);
    const isTargetSelf = targetId === playerId;

    // Analyze event sentiment from prompt keywords
    const sentiment = this._analyzeEventSentiment(prompt);

    let useProb = 0;

    if (isCounterNegate) {
      // Counter-negate: someone is trying to cancel our negate
      // If we originally negated to help ourselves, counter at moderate rate
      useProb = 0.4;
    } else if (isTargetSelf) {
      // Event targets self
      if (sentiment < 0) {
        // Negative event on self → negate it (save ourselves)
        useProb = 0.7;
      } else if (sentiment > 0) {
        // Positive event on self → don't negate
        useProb = 0.0;
      } else {
        useProb = 0.1; // Unknown → slight chance
      }
    } else {
      // Event targets an opponent
      if (sentiment > 0) {
        // Positive event on opponent → negate it (deny their benefit)
        useProb = 0.5;
      } else if (sentiment < 0) {
        // Negative event on opponent → don't negate (let them suffer)
        useProb = 0.0;
      } else {
        useProb = 0.15;
      }
    }

    if (Math.random() >= useProb) return 'negate_pass';
    return rand(negateOptions).value;
  }

  /** Infer negate target: current turn player is most likely the target */
  _inferNegateTarget(state, selfId) {
    if (!state?.players || state.currentPlayerIndex == null) return selfId;
    return state.players[state.currentPlayerIndex]?.id || selfId;
  }

  /** Analyze event sentiment from prompt text. Returns -1 (negative), 0 (neutral), +1 (positive) */
  _analyzeEventSentiment(prompt) {
    if (!prompt) return 0;
    // Negative keywords
    if (/失去|扣[减除]|损失|罚款|住院|破产|暂停|跳过|减少|负面/.test(prompt)) return -1;
    // Positive keywords
    if (/获得|增[加长]|奖[励金]|领取|收益|免费|翻倍/.test(prompt)) return 1;
    // Card names that are typically negative/positive
    if (/补天|考试|挂科|迟到|逃课|差评|欠费/.test(prompt)) return -1;
    if (/奖学金|实习|推免|科研|志愿|优秀/.test(prompt)) return 1;
    return 0;
  }

  /**
   * 化学化工学院能力：选择禁用哪个格子。
   * 优先禁用自己即将踩到的负面格子；否则禁用已知负面格子。
   */
  _chooseHuaxueDisable(options, state, playerId) {
    const disableOptions = options.filter(o => o.value?.startsWith('disable_'));
    if (disableOptions.length === 0) return options.find(o => o.value === 'huaxue_skip')?.value || rand(options).value;

    // 1. Check if any of the next few cells we'll land on are in the disable list
    const me = state?.players?.find(p => p.id === playerId);
    if (me?.position?.type === 'main') {
      const currentIdx = me.position.index;
      // Look ahead 1-6 cells (dice range)
      for (let step = 1; step <= 6; step++) {
        const futureIdx = (currentIdx + step) % 28;
        const futureCellId = this._getCellIdByIndex(futureIdx);
        if (futureCellId && NEGATIVE_CELLS.has(futureCellId)) {
          const match = disableOptions.find(o => o.value === `disable_${futureCellId}`);
          if (match) return match.value;
        }
      }
    }

    // 2. Fallback: disable any known negative cell from the options
    for (const opt of disableOptions) {
      const cellId = opt.value.replace('disable_', '');
      if (NEGATIVE_CELLS.has(cellId)) return opt.value;
    }

    // 3. Disable a random cell rather than skipping
    return rand(disableOptions).value;
  }

  /** Map board index to cell id */
  _getCellIdByIndex(index) {
    // Main board cells: hardcoded mapping (matches shared/src/board-data.ts)
    const CELL_IDS = [
      'start', 'line_study', 'tuition', 'chance_2', 'line_pukou', 'zijing', 'chance_1',
      'hospital', 'line_money', 'qingong', 'chance_3', 'line_suzhou', 'retake', 'chance_4',
      'ding', 'line_explore', 'jiang_gong', 'chance_5', 'line_xianlin', 'society', 'chance_6',
      'waiting_room', 'line_gulou', 'kechuang', 'chance_7', 'line_food', 'nanna_cp', 'chuangmen',
    ];
    return CELL_IDS[index] || null;
  }

  /** Find the player with highest score (excluding self) */
  _findLeadingPlayer(state, playerId) {
    if (!state?.players) return null;
    let best = null, bestScore = -Infinity;
    for (const p of state.players) {
      if (p.id === playerId || p.isBankrupt) continue;
      const score = (p.gpa || 0) * 10 + (p.exploration || 0);
      if (score > bestScore) { bestScore = score; best = p.id; }
    }
    return best;
  }

  _isLineEntry(options) {
    return options && options.some(o => o.value && o.value.startsWith('enter_'));
  }

  _getLineId(value) {
    return value && value.startsWith('enter_') ? value.slice(6) : null;
  }
}

class RandomStrategy extends BaseStrategy {
  constructor() { super('random'); }
}

class GreedyGpaStrategy extends BaseStrategy {
  constructor() { super('greedy_gpa'); }

  _evaluateCard(card, me, state, playerId, isMyTurn) {
    // Always use plan slot expansion
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    // Hospital escape
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };
    // GPA-focused: eagerly use GPA protection
    if (card.id === 'destiny_ancestor_exam' && isMyTurn && Math.random() < 0.6) return { cardId: card.id };
    // Line shortcut if in line
    if (card.id === 'destiny_alternative_path' && isMyTurn && me.position?.type === 'line' && Math.random() < 0.4) return { cardId: card.id };
    // Food line shield
    if (card.id === 'destiny_maimen_shield' && isMyTurn && Math.random() < 0.5) return { cardId: card.id };
    // Target leading player with disruptive cards
    const lead = this._findLeadingPlayer(state, playerId);
    if (lead && card.id === 'chance_power_outage' && Math.random() < 0.3) return { cardId: card.id, targetPlayerId: lead };
    return null;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;
    if (options.some(o => o.value?.startsWith('negate_'))) return this._chooseNegate(options, state, pa, playerId);
    if (options.some(o => o.value?.startsWith('disable_'))) return this._chooseHuaxueDisable(options, state, playerId);

    // Plan selection
    if (options.some(o => isPlanOption(o.label))) {
      return this.pickPlanFromOptions(options, STRATEGY_PLAN_PREFS.greedy_gpa);
    }

    // Yearly plan adjustment: GPA strategy adjusts more often
    if (options.some(o => o.value === 'keep' || o.value === 'adjust')) {
      return Math.random() < 0.5 ? 'adjust' : 'keep';
    }

    // Line entry decision
    if (this._isLineEntry(options)) {
      const enter = options.find(o => o.value.startsWith('enter_'));
      if (enter) {
        const lid = this._getLineId(enter.value);
        const prob = LINE_ENTER_PREFS.greedy_gpa[lid] ?? 0.5;
        if (options.find(o => o.value === 'skip')) {
          return Math.random() < prob ? enter.value : 'skip';
        }
        return enter.value;
      }
    }

    // Score each option by GPA preference
    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const a = analyzeLabel(opt.label || '');
      const score = a.gpa * 3 + a.money * 0.5 + a.explore * 0.5 + Math.random() * 0.1;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return (best && bestScore > -Infinity) ? best.value : rand(options).value;
  }
}

class GreedyMoneyStrategy extends BaseStrategy {
  constructor() { super('greedy_money'); }

  _evaluateCard(card, me, state, playerId, isMyTurn) {
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };
    // Money-focused: eagerly use money protection cards
    if (card.id === 'destiny_negative_balance' && isMyTurn && Math.random() < 0.6) return { cardId: card.id };
    if (card.id === 'destiny_test_waters' && isMyTurn && Math.random() < 0.6) return { cardId: card.id };
    if (card.id === 'destiny_maimen_shield' && isMyTurn && Math.random() < 0.5) return { cardId: card.id };
    // Use line shortcut to save time (time = money)
    if (card.id === 'destiny_alternative_path' && isMyTurn && me.position?.type === 'line' && Math.random() < 0.5) return { cardId: card.id };
    const lead = this._findLeadingPlayer(state, playerId);
    if (lead && card.id === 'chance_leap_of_joy' && Math.random() < 0.3) return { cardId: card.id, targetPlayerId: lead };
    return null;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;
    if (options.some(o => o.value?.startsWith('negate_'))) return this._chooseNegate(options, state, pa, playerId);
    if (options.some(o => o.value?.startsWith('disable_'))) return this._chooseHuaxueDisable(options, state, playerId);

    // Plan selection
    if (options.some(o => isPlanOption(o.label))) {
      return this.pickPlanFromOptions(options, STRATEGY_PLAN_PREFS.greedy_money);
    }

    if (options.some(o => o.value === 'keep' || o.value === 'adjust')) {
      return Math.random() < 0.35 ? 'adjust' : 'keep';
    }

    if (this._isLineEntry(options)) {
      const enter = options.find(o => o.value.startsWith('enter_'));
      if (enter) {
        const lid = this._getLineId(enter.value);
        const prob = LINE_ENTER_PREFS.greedy_money[lid] ?? 0.5;
        if (options.find(o => o.value === 'skip')) {
          return Math.random() < prob ? enter.value : 'skip';
        }
        return enter.value;
      }
    }

    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const a = analyzeLabel(opt.label || '');
      const score = a.money * 3 + a.gpa * 0.5 + a.explore * 0.5 + Math.random() * 0.1;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return (best && bestScore > -Infinity) ? best.value : rand(options).value;
  }
}

class GreedyExploreStrategy extends BaseStrategy {
  constructor() { super('greedy_explore'); }

  _evaluateCard(card, me, state, playerId, isMyTurn) {
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };
    // Explore-focused: protect exploration
    if (card.id === 'destiny_campus_legend' && isMyTurn && Math.random() < 0.6) return { cardId: card.id };
    // Explore players want to visit more lines - use familiar route to re-enter
    if (card.id === 'destiny_familiar_route' && isMyTurn && Math.random() < 0.5) return { cardId: card.id };
    if (card.id === 'destiny_maimen_shield' && isMyTurn && Math.random() < 0.4) return { cardId: card.id };
    const lead = this._findLeadingPlayer(state, playerId);
    if (lead && card.id === 'chance_power_outage' && Math.random() < 0.3) return { cardId: card.id, targetPlayerId: lead };
    return null;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;
    if (options.some(o => o.value?.startsWith('negate_'))) return this._chooseNegate(options, state, pa, playerId);
    if (options.some(o => o.value?.startsWith('disable_'))) return this._chooseHuaxueDisable(options, state, playerId);

    // Plan selection
    if (options.some(o => isPlanOption(o.label))) {
      return this.pickPlanFromOptions(options, STRATEGY_PLAN_PREFS.greedy_explore);
    }

    if (options.some(o => o.value === 'keep' || o.value === 'adjust')) {
      return Math.random() < 0.45 ? 'adjust' : 'keep';
    }

    if (this._isLineEntry(options)) {
      const enter = options.find(o => o.value.startsWith('enter_'));
      if (enter) {
        const lid = this._getLineId(enter.value);
        const prob = LINE_ENTER_PREFS.greedy_explore[lid] ?? 0.5;
        if (options.find(o => o.value === 'skip')) {
          return Math.random() < prob ? enter.value : 'skip';
        }
        return enter.value;
      }
    }

    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const a = analyzeLabel(opt.label || '');
      const score = a.explore * 3 + a.gpa * 0.5 + a.money * 0.5 + Math.random() * 0.1;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return (best && bestScore > -Infinity) ? best.value : rand(options).value;
  }
}

class PlanFocusedStrategy extends BaseStrategy {
  constructor() { super('plan_focused'); }

  _evaluateCard(card, me, state, playerId, isMyTurn) {
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };
    // Plan-focused: use cross-college swap if it benefits plan completion
    if (card.id === 'destiny_cross_college_exit' && (me.minorPlans || []).length > 0 && Math.random() < 0.4) {
      return { cardId: card.id };
    }
    // Use protection cards moderately
    if (card.id === 'destiny_maimen_shield' && isMyTurn && Math.random() < 0.4) return { cardId: card.id };
    // Line shortcut for line-focused plans
    const planName = getMajorPlanNameFromState(me);
    const focus = planName ? PLAN_FOCUS[planName] : null;
    if (card.id === 'destiny_alternative_path' && isMyTurn && me.position?.type === 'line') {
      // Lines-focused plans don't want to skip lines
      if (focus !== 'lines' && Math.random() < 0.4) return { cardId: card.id };
    }
    // Familiar route is great for lines-focused plans
    if (card.id === 'destiny_familiar_route' && isMyTurn && focus === 'lines' && Math.random() < 0.6) {
      return { cardId: card.id };
    }
    return null;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;
    if (options.some(o => o.value?.startsWith('negate_'))) return this._chooseNegate(options, state, pa, playerId);
    if (options.some(o => o.value?.startsWith('disable_'))) return this._chooseHuaxueDisable(options, state, playerId);

    // Plan selection — pick a plan matching our focus
    if (options.some(o => isPlanOption(o.label))) {
      // Try to pick a plan with a unique win condition type
      const focuses = options.map(o => ({ opt: o, focus: PLAN_FOCUS[o.label] || 'special' }));
      // Prefer lines/special — they have unique plan-specific win conditions
      const preferred = focuses.find(f => f.focus === 'lines') || focuses.find(f => f.focus === 'special');
      if (preferred) return preferred.opt.value;
      return rand(options).value;
    }

    if (options.some(o => o.value === 'keep' || o.value === 'adjust')) {
      return Math.random() < 0.3 ? 'adjust' : 'keep';
    }

    // Determine our plan's resource focus from state
    const me = state?.players?.find(p => p.id === playerId);
    const planName = me?.majorPlan ? getMajorPlanNameFromState(me) : null;
    const myFocus = planName ? PLAN_FOCUS[planName] : null;

    if (this._isLineEntry(options)) {
      const enter = options.find(o => o.value.startsWith('enter_'));
      if (enter) {
        // Always enter lines if plan focuses on lines
        if (myFocus === 'lines') return enter.value;
        const lid = this._getLineId(enter.value);
        const prob = (myFocus === 'gpa' && lid === 'study') ? 0.9
          : (myFocus === 'money' && lid === 'money') ? 0.9
          : (myFocus === 'explore' && lid === 'explore') ? 0.9
          : 0.4;
        if (options.find(o => o.value === 'skip')) {
          return Math.random() < prob ? enter.value : 'skip';
        }
        return enter.value;
      }
    }

    // Score options by plan focus
    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const a = analyzeLabel(opt.label || '');
      let score = a.money + a.gpa + a.explore + Math.random() * 0.1;
      if (myFocus === 'gpa') score += a.gpa * 2;
      else if (myFocus === 'money') score += a.money * 2;
      else if (myFocus === 'explore') score += a.explore * 2;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return (best && bestScore > -Infinity) ? best.value : rand(options).value;
  }
}

class BalancedStrategy extends BaseStrategy {
  constructor() { super('balanced'); }

  _evaluateCard(card, me, state, playerId, isMyTurn) {
    if (card.id === 'destiny_professional_intent') return { cardId: card.id };
    if (card.id === 'destiny_urgent_deadline' && isMyTurn && me.isInHospital) return { cardId: card.id };
    // Balanced: use protection cards for weakest resource
    const moneyNorm = (me.money || 0) / 3000;
    const gpaNorm = (me.gpa || 0) / 5.0;
    const exploreNorm = (me.exploration || 0) / 30;
    const minResource = Math.min(moneyNorm, gpaNorm, exploreNorm);
    if (isMyTurn) {
      if (card.id === 'destiny_negative_balance' && minResource === moneyNorm && Math.random() < 0.5) return { cardId: card.id };
      if (card.id === 'destiny_test_waters' && minResource === moneyNorm && Math.random() < 0.5) return { cardId: card.id };
      if (card.id === 'destiny_ancestor_exam' && minResource === gpaNorm && Math.random() < 0.5) return { cardId: card.id };
      if (card.id === 'destiny_campus_legend' && minResource === exploreNorm && Math.random() < 0.5) return { cardId: card.id };
      if (card.id === 'destiny_maimen_shield' && Math.random() < 0.4) return { cardId: card.id };
      if (card.id === 'destiny_alternative_path' && me.position?.type === 'line' && Math.random() < 0.3) return { cardId: card.id };
    }
    const lead = this._findLeadingPlayer(state, playerId);
    if (lead && card.id === 'chance_leap_of_joy' && Math.random() < 0.25) return { cardId: card.id, targetPlayerId: lead };
    return null;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;
    if (options.some(o => o.value?.startsWith('negate_'))) return this._chooseNegate(options, state, pa, playerId);
    if (options.some(o => o.value?.startsWith('disable_'))) return this._chooseHuaxueDisable(options, state, playerId);

    if (options.some(o => isPlanOption(o.label))) {
      // Pick a plan with balanced focus
      const focuses = options.map(o => ({ opt: o, focus: PLAN_FOCUS[o.label] || 'special' }));
      const balanced = focuses.find(f => f.focus === 'gpa') || focuses.find(f => f.focus === 'explore');
      if (balanced) return balanced.opt.value;
      return rand(options).value;
    }

    if (options.some(o => o.value === 'keep' || o.value === 'adjust')) {
      return Math.random() < 0.4 ? 'adjust' : 'keep';
    }

    if (this._isLineEntry(options)) {
      const enter = options.find(o => o.value.startsWith('enter_'));
      if (enter) {
        // Balanced: enter most lines at moderate probability
        const lid = this._getLineId(enter.value);
        const prob = { study: 0.6, money: 0.6, suzhou: 0.5, explore: 0.6, xianlin: 0.5, gulou: 0.6 }[lid] ?? 0.5;
        if (options.find(o => o.value === 'skip')) {
          return Math.random() < prob ? enter.value : 'skip';
        }
        return enter.value;
      }
    }

    // Score each option — prioritize the resource we have least of
    const me = state?.players?.find(p => p.id === playerId);
    const moneyNorm = me ? me.money / 3000 : 0.5;
    const gpaNorm = me ? me.gpa / 5.0 : 0.5;
    const exploreNorm = me ? me.exploration / 30 : 0.5;
    const minResource = Math.min(moneyNorm, gpaNorm, exploreNorm);

    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const a = analyzeLabel(opt.label || '');
      let score = a.money + a.gpa + a.explore + Math.random() * 0.1;
      // Boost the weakest resource
      if (minResource === moneyNorm) score += a.money * 2;
      else if (minResource === gpaNorm) score += a.gpa * 2;
      else score += a.explore * 2;
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return (best && bestScore > -Infinity) ? best.value : rand(options).value;
  }
}

/** Helper to get major plan name from player state object */
function getMajorPlanNameFromState(player) {
  if (!player?.majorPlan) return null;
  const plan = (player.trainingPlans || []).find(tp => tp.id === player.majorPlan);
  return plan ? plan.name : null;
}

// ============================================================
// Factory
// ============================================================

const STRATEGY_MAP = {
  random: () => new RandomStrategy(),
  greedy_gpa: () => new GreedyGpaStrategy(),
  greedy_money: () => new GreedyMoneyStrategy(),
  greedy_explore: () => new GreedyExploreStrategy(),
  plan_focused: () => new PlanFocusedStrategy(),
  balanced: () => new BalancedStrategy(),
};

export const STRATEGY_NAMES = Object.keys(STRATEGY_MAP);

export function createStrategy(name) {
  const factory = STRATEGY_MAP[name];
  if (!factory) throw new Error(`Unknown strategy: ${name}`);
  return factory();
}

export function randomStrategyName() {
  return rand(STRATEGY_NAMES);
}

export { PLAN_FOCUS };
