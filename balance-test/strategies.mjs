/**
 * AI Strategies for game balance testing
 *
 * Four strategies simulate different player approaches:
 * - random: baseline, all choices random
 * - greedy_gpa: prioritize GPA growth
 * - greedy_money: prioritize money accumulation
 * - greedy_explore: prioritize exploration value
 */

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

// ============================================================
// Strategy classes
// ============================================================

class BaseStrategy {
  constructor(name) { this.name = name; }

  pickPlan(plans) {
    const unconfirmed = plans.filter(p => !p.confirmed);
    if (unconfirmed.length === 0) return null;
    return rand(unconfirmed).id;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;
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

  pickPlan(plans) {
    const unc = plans.filter(p => !p.confirmed);
    if (unc.length === 0) return null;
    for (const focus of STRATEGY_PLAN_PREFS.greedy_gpa) {
      const m = unc.find(p => PLAN_FOCUS[p.name] === focus);
      if (m) return m.id;
    }
    return unc[0].id;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;

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

  pickPlan(plans) {
    const unc = plans.filter(p => !p.confirmed);
    if (unc.length === 0) return null;
    for (const focus of STRATEGY_PLAN_PREFS.greedy_money) {
      const m = unc.find(p => PLAN_FOCUS[p.name] === focus);
      if (m) return m.id;
    }
    return unc[0].id;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;

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

  pickPlan(plans) {
    const unc = plans.filter(p => !p.confirmed);
    if (unc.length === 0) return null;
    for (const focus of STRATEGY_PLAN_PREFS.greedy_explore) {
      const m = unc.find(p => PLAN_FOCUS[p.name] === focus);
      if (m) return m.id;
    }
    return unc[0].id;
  }

  chooseOption(options, state, pa, playerId) {
    if (!options || options.length === 0) return null;
    if (options.length === 1) return options[0].value;

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

// ============================================================
// Factory
// ============================================================

const STRATEGY_MAP = {
  random: () => new RandomStrategy(),
  greedy_gpa: () => new GreedyGpaStrategy(),
  greedy_money: () => new GreedyMoneyStrategy(),
  greedy_explore: () => new GreedyExploreStrategy(),
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
