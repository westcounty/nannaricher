/**
 * Comprehensive Balance Analysis Report Generator for 菜根人生 (Nannaricher)
 *
 * Reads raw simulation data and generates a multi-dimensional balance report.
 * Covers: plans, lines, events, resources, player counts, strategies, economy.
 *
 * Updated for the new training plan system (majorPlan/minorPlans).
 *
 * Usage: node balance-test/analyzer.mjs [input] [output]
 *   input:  Path to raw-data.json (default: balance-test/report/raw-data.json)
 *   output: Path for report (default: balance-test/report/balance-report.md)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const inputPath = process.argv[2] || 'balance-test/report/raw-data.json';
const outputPath = process.argv[3] || 'balance-test/report/balance-report.md';

// ============================================================
// Load Data
// ============================================================
let rawData;
try {
  rawData = JSON.parse(readFileSync(inputPath, 'utf-8'));
} catch (err) {
  console.error(`Cannot read ${inputPath}: ${err.message}`);
  console.error('Run the simulator first: node balance-test/simulator.mjs');
  process.exit(1);
}

const validGames = rawData.filter(g => !g.error && g.players?.length > 0);
console.log(`Loaded ${rawData.length} games (${validGames.length} valid)`);

// ============================================================
// Helper: extract plan names from new data model (backward compat)
// ============================================================
function getPlayerAllPlans(p) {
  // New model: allPlanNames
  if (p.allPlanNames?.length > 0) return p.allPlanNames;
  // Legacy model: confirmedPlans
  if (p.confirmedPlans?.length > 0) return p.confirmedPlans;
  return [];
}

function getPlayerMajorPlan(p) {
  if (p.majorPlan) return p.majorPlan;
  // Legacy: first confirmed plan as major
  if (p.confirmedPlans?.length > 0) return p.confirmedPlans[0];
  return null;
}

function getPlayerMinorPlans(p) {
  if (p.minorPlans?.length > 0) return p.minorPlans;
  // Legacy: remaining confirmed plans
  if (p.confirmedPlans?.length > 1) return p.confirmedPlans.slice(1);
  return [];
}

// ============================================================
// Statistics Utilities
// ============================================================
function wilsonInterval(successes, total, z = 1.96) {
  if (total === 0) return { lower: 0, upper: 1, center: 0, margin: 1 };
  const p = successes / total;
  const d = 1 + z * z / total;
  const c = (p + z * z / (2 * total)) / d;
  const hw = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / d;
  return { lower: Math.max(0, c - hw), upper: Math.min(1, c + hw), center: c, margin: hw };
}

function mean(arr) { return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length; }
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function stdev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length || 1));
}
function pct(n, d) { return d === 0 ? '0.0%' : (n / d * 100).toFixed(1) + '%'; }
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

// ============================================================
// Analysis Functions
// ============================================================

function analyzePlans() {
  const stats = {};
  for (const game of validGames) {
    for (const p of game.players) {
      const plans = getPlayerAllPlans(p);
      const majorPlan = getPlayerMajorPlan(p);
      for (const planName of plans) {
        if (!stats[planName]) stats[planName] = {
          total: 0, wins: 0, winConditions: {},
          asMajor: 0, asMinor: 0, majorWins: 0, minorWins: 0,
          scores: [], money: [], gpa: [], explore: [],
          strategies: {}, playerCounts: {},
          rounds: [], // what round the game ends
        };
        const s = stats[planName];
        s.total++;
        const isMajor = planName === majorPlan;
        if (isMajor) s.asMajor++;
        else s.asMinor++;

        if (p.isWinner) {
          s.wins++;
          if (isMajor) s.majorWins++;
          else s.minorWins++;
          const cond = game.winner?.condition || 'unknown';
          s.winConditions[cond] = (s.winConditions[cond] || 0) + 1;
        }
        s.scores.push(p.finalScore ?? 0);
        s.money.push(p.finalMoney ?? 0);
        s.gpa.push(p.finalGpa ?? 0);
        s.explore.push(p.finalExploration ?? 0);
        s.strategies[p.strategy] = (s.strategies[p.strategy] || 0) + 1;
        s.rounds.push(game.totalRounds ?? 0);
        const pc = game.config?.playerCount || game.players.length;
        s.playerCounts[pc] = (s.playerCounts[pc] || 0) + 1;
      }
    }
  }
  return stats;
}

function analyzeLines() {
  const stats = {};
  const lineNames = ['pukou', 'study', 'money', 'suzhou', 'explore', 'xianlin', 'gulou', 'food'];

  for (const game of validGames) {
    for (const p of game.players) {
      for (const line of (p.linesVisited || [])) {
        if (!stats[line]) stats[line] = {
          visits: 0, visitsByWinners: 0, visitsByLosers: 0,
          playerCounts: {},
          avgMoneyOnVisit: [], avgGpaOnVisit: [], avgExploreOnVisit: [],
          eventCounts: {},
        };
        stats[line].visits++;
        if (p.isWinner) stats[line].visitsByWinners++;
        else stats[line].visitsByLosers++;
        const pc = game.config?.playerCount || game.players.length;
        stats[line].playerCounts[pc] = (stats[line].playerCounts[pc] || 0) + 1;

        // Track resource state of visitors for correlation
        stats[line].avgMoneyOnVisit.push(p.finalMoney ?? 0);
        stats[line].avgGpaOnVisit.push(p.finalGpa ?? 0);
        stats[line].avgExploreOnVisit.push(p.finalExploration ?? 0);
      }

      // Event trigger counts per line
      const evts = p.lineEventsTriggered || {};
      for (const [lineId, indices] of Object.entries(evts)) {
        if (!stats[lineId]) stats[lineId] = {
          visits: 0, visitsByWinners: 0, visitsByLosers: 0,
          playerCounts: {}, avgMoneyOnVisit: [], avgGpaOnVisit: [], avgExploreOnVisit: [],
          eventCounts: {},
        };
        for (const idx of (indices || [])) {
          const key = `${lineId}_${idx}`;
          stats[lineId].eventCounts[key] = (stats[lineId].eventCounts[key] || 0) + 1;
        }
      }
    }
  }

  // Ensure all lines present
  for (const ln of lineNames) {
    if (!stats[ln]) stats[ln] = {
      visits: 0, visitsByWinners: 0, visitsByLosers: 0, playerCounts: {},
      avgMoneyOnVisit: [], avgGpaOnVisit: [], avgExploreOnVisit: [], eventCounts: {},
    };
  }

  return stats;
}

function analyzeEconomy() {
  const allPlayers = validGames.flatMap(g => g.players || []);
  const byStrategy = {};
  const byPlayerCount = {};

  for (const game of validGames) {
    const pc = game.config?.playerCount || game.players.length;
    if (!byPlayerCount[pc]) byPlayerCount[pc] = {
      money: [], gpa: [], explore: [], scores: [], turns: [],
      bankrupts: 0, total: 0, wins: 0,
    };
    byPlayerCount[pc].turns.push(game.totalTurns || 0);
    if (game.winner) byPlayerCount[pc].wins++;

    for (const p of game.players) {
      // By strategy
      if (!byStrategy[p.strategy]) byStrategy[p.strategy] = {
        money: [], gpa: [], explore: [], scores: [], wins: 0, total: 0,
      };
      const bs = byStrategy[p.strategy];
      bs.money.push(p.finalMoney ?? 0);
      bs.gpa.push(p.finalGpa ?? 0);
      bs.explore.push(p.finalExploration ?? 0);
      bs.scores.push(p.finalScore ?? 0);
      bs.total++;
      if (p.isWinner) bs.wins++;

      // By player count
      const bpc = byPlayerCount[pc];
      bpc.money.push(p.finalMoney ?? 0);
      bpc.gpa.push(p.finalGpa ?? 0);
      bpc.explore.push(p.finalExploration ?? 0);
      bpc.scores.push(p.finalScore ?? 0);
      bpc.total++;
      if (p.isBankrupt) bpc.bankrupts++;
    }
  }

  // Resource exchange rate analysis
  // Design: 1 explore = 0.1 GPA = 100 money
  const initialMoney = allPlayers[0]?.diceCount === 2 ? 2000 : 3000;
  const avgMoney = mean(allPlayers.map(p => (p.finalMoney ?? initialMoney) - initialMoney));
  const avgGpa = mean(allPlayers.map(p => (p.finalGpa ?? 3.0) - 3.0));
  const avgExplore = mean(allPlayers.map(p => p.finalExploration ?? 0));

  return { byStrategy, byPlayerCount, exchangeRate: { avgMoney, avgGpa, avgExplore, initialMoney } };
}

function analyzeGameOutcomes() {
  let baseWins = 0, planWins = 0, timeoutEnds = 0, unknownEnds = 0;
  const winConditions = {};
  const turnDistribution = [];
  const roundDistribution = [];

  for (const game of validGames) {
    turnDistribution.push(game.totalTurns || 0);
    roundDistribution.push(game.totalRounds || 0);

    if (game.winner) {
      const cond = game.winner.condition || 'unknown';
      winConditions[cond] = (winConditions[cond] || 0) + 1;
      if (cond === 'base' || cond === 'base_win' || cond.includes('GPA×10+探索值达到')) baseWins++;
      else planWins++;
    } else if (game.phase === 'finished') {
      timeoutEnds++;
    } else {
      unknownEnds++;
    }
  }

  return { baseWins, planWins, timeoutEnds, unknownEnds, winConditions, turnDistribution, roundDistribution };
}

function analyzePlayerCount() {
  const byCount = {};

  for (const game of validGames) {
    const pc = game.config?.playerCount || game.players.length;
    if (!byCount[pc]) byCount[pc] = {
      games: 0, wins: 0, avgTurns: [], avgDuration: [],
      bankrupts: 0, totalPlayers: 0,
      baseWins: 0, planWins: 0,
    };
    const b = byCount[pc];
    b.games++;
    if (game.winner) {
      b.wins++;
      const cond = game.winner.condition || '';
      if (cond.includes('GPA×10') || cond === 'base' || cond === 'base_win') b.baseWins++;
      else b.planWins++;
    }
    b.avgTurns.push(game.totalTurns || 0);
    b.avgDuration.push(game.duration || 0);
    for (const p of game.players) {
      b.totalPlayers++;
      if (p.isBankrupt) b.bankrupts++;
    }
  }

  return byCount;
}

function analyzeMajorVsMinor() {
  let majorTotal = 0, majorWins = 0, minorTotal = 0, minorWins = 0;
  const majorPlanStats = {};
  const minorPlanStats = {};

  for (const game of validGames) {
    for (const p of game.players) {
      const major = getPlayerMajorPlan(p);
      const minors = getPlayerMinorPlans(p);

      if (major) {
        majorTotal++;
        if (p.isWinner) majorWins++;
        if (!majorPlanStats[major]) majorPlanStats[major] = { total: 0, wins: 0 };
        majorPlanStats[major].total++;
        if (p.isWinner) majorPlanStats[major].wins++;
      }
      for (const minor of minors) {
        minorTotal++;
        if (p.isWinner) minorWins++;
        if (!minorPlanStats[minor]) minorPlanStats[minor] = { total: 0, wins: 0 };
        minorPlanStats[minor].total++;
        if (p.isWinner) minorPlanStats[minor].wins++;
      }
    }
  }

  return { majorTotal, majorWins, minorTotal, minorWins, majorPlanStats, minorPlanStats };
}

function analyzeRoundProgression() {
  // Resource growth per round (end-of-game stats grouped by which round game ended)
  const byRound = {};
  for (const game of validGames) {
    const r = game.totalRounds || 0;
    if (!byRound[r]) byRound[r] = { money: [], gpa: [], explore: [], scores: [], count: 0 };
    byRound[r].count++;
    for (const p of game.players) {
      byRound[r].money.push(p.finalMoney ?? 0);
      byRound[r].gpa.push(p.finalGpa ?? 0);
      byRound[r].explore.push(p.finalExploration ?? 0);
      byRound[r].scores.push(p.finalScore ?? 0);
    }
  }
  return byRound;
}

function analyzePerYearSnapshots() {
  // Per-round resource snapshots (from each player's roundSnapshots)
  const byYear = {}; // { [year]: { money: [], gpa: [], explore: [] } }
  const byPlanYear = {}; // { [planName]: { [year]: { money: [], gpa: [], explore: [] } } }

  for (const game of validGames) {
    for (const p of game.players) {
      const snaps = p.roundSnapshots || {};
      const majorPlan = getPlayerMajorPlan(p);
      const allPlans = getPlayerAllPlans(p);

      for (const [year, snap] of Object.entries(snaps)) {
        const y = parseInt(year);
        if (!byYear[y]) byYear[y] = { money: [], gpa: [], explore: [] };
        byYear[y].money.push(snap.money ?? 0);
        byYear[y].gpa.push(snap.gpa ?? 0);
        byYear[y].explore.push(snap.exploration ?? 0);

        // Track by plan (major only for simplicity)
        if (majorPlan) {
          if (!byPlanYear[majorPlan]) byPlanYear[majorPlan] = {};
          if (!byPlanYear[majorPlan][y]) byPlanYear[majorPlan][y] = { money: [], gpa: [], explore: [] };
          byPlanYear[majorPlan][y].money.push(snap.money ?? 0);
          byPlanYear[majorPlan][y].gpa.push(snap.gpa ?? 0);
          byPlanYear[majorPlan][y].explore.push(snap.exploration ?? 0);
        }
      }
    }
  }
  return { byYear, byPlanYear };
}

function analyzeEventEffects() {
  // Analyze resource changes by event type
  const eventEffects = {}; // { [eventTitle]: { money: [], gpa: [], explore: [], count: 0 } }
  const roundEffects = {}; // { [round]: { money: [], gpa: [], explore: [] } }

  for (const game of validGames) {
    // Aggregate events
    for (const evt of (game.events || [])) {
      const title = evt.title || 'unknown';
      if (!eventEffects[title]) eventEffects[title] = { money: [], gpa: [], explore: [], count: 0 };
      eventEffects[title].count++;
    }

    // Aggregate resource changes by round
    for (const p of game.players) {
      for (const rc of (p.resourceChanges || [])) {
        const round = rc.round || 0;
        if (!roundEffects[round]) roundEffects[round] = { money: [], gpa: [], explore: [] };
        if (rc.stat === 'money') roundEffects[round].money.push(rc.delta);
        else if (rc.stat === 'gpa') roundEffects[round].gpa.push(rc.delta);
        else if (rc.stat === 'exploration') roundEffects[round].explore.push(rc.delta);
      }
    }
  }

  return { eventEffects, roundEffects };
}

function analyzeWinTiming() {
  let earlyWins = 0, graduationWins = 0, baseWins = 0, planWins = 0;
  const earlyByRound = {};

  for (const game of validGames) {
    if (!game.winner) continue;
    const cond = game.winner.condition || '';
    if (cond === '毕业结算') {
      graduationWins++;
    } else {
      earlyWins++;
      const round = game.totalRounds || 0;
      earlyByRound[round] = (earlyByRound[round] || 0) + 1;
      if (cond.includes('GPA×10') || cond === 'base' || cond === 'base_win') baseWins++;
      else planWins++;
    }
  }

  return { earlyWins, graduationWins, baseWins, planWins, earlyByRound };
}

// ============================================================
// Report Generation
// ============================================================
function generateReport() {
  const planStats = analyzePlans();
  const lineStats = analyzeLines();
  const economy = analyzeEconomy();
  const outcomes = analyzeGameOutcomes();
  const pcStats = analyzePlayerCount();
  const mvmStats = analyzeMajorVsMinor();
  const roundStats = analyzeRoundProgression();
  const yearSnapshots = analyzePerYearSnapshots();
  const eventEffects = analyzeEventEffects();
  const winTiming = analyzeWinTiming();

  const totalPlayers = validGames.reduce((s, g) => s + (g.players?.length || 0), 0);
  const lines = [];
  const w = (s) => lines.push(s);

  // ---- Header ----
  w('# 菜根人生 - 综合游戏平衡性分析报告');
  w('');
  w(`> 生成时间: ${new Date().toISOString().slice(0, 19)}`);
  w(`> 有效模拟局数: **${validGames.length}** / ${rawData.length}`);
  w(`> 总玩家数据点: **${totalPlayers}**`);
  w('');

  // ---- Executive Summary ----
  w('## 1. 总体概况');
  w('');
  w(`| 指标 | 数值 |`);
  w(`|------|------|`);
  w(`| 总模拟局数 | ${validGames.length} |`);
  w(`| 有胜者局数 | ${validGames.filter(g => g.winner).length} (${pct(validGames.filter(g => g.winner).length, validGames.length)}) |`);
  w(`| 超时结算局数 | ${outcomes.timeoutEnds} (${pct(outcomes.timeoutEnds, validGames.length)}) |`);
  const totalWinGames = validGames.filter(g => g.winner).length;
  w(`| 提前胜利（非毕业结算） | ${winTiming.earlyWins} (${pct(winTiming.earlyWins, totalWinGames)}) |`);
  w(`| 毕业结算胜利 | ${winTiming.graduationWins} (${pct(winTiming.graduationWins, totalWinGames)}) |`);
  w(`| 提前-基础胜利 (GPA×10+探索≥60) | ${winTiming.baseWins} (${pct(winTiming.baseWins, winTiming.earlyWins || 1)}) |`);
  w(`| 提前-培养计划胜利 | ${winTiming.planWins} (${pct(winTiming.planWins, winTiming.earlyWins || 1)}) |`);
  w(`| 平均游戏回合数 | ${mean(outcomes.turnDistribution).toFixed(1)} |`);
  w(`| 回合数中位数 | ${median(outcomes.turnDistribution).toFixed(1)} |`);
  w(`| 回合数标准差 | ${stdev(outcomes.turnDistribution).toFixed(1)} |`);
  w(`| 25%分位回合数 | ${percentile(outcomes.turnDistribution, 0.25).toFixed(0)} |`);
  w(`| 75%分位回合数 | ${percentile(outcomes.turnDistribution, 0.75).toFixed(0)} |`);
  w('');

  // Health score
  let healthScore = 'A';
  const issues = [];
  if (outcomes.timeoutEnds / validGames.length > 0.5) { healthScore = 'C'; issues.push('超时结算率过高'); }
  if (outcomes.baseWins / (outcomes.baseWins + outcomes.planWins + 0.01) > 0.7) { healthScore = 'B'; issues.push('基础胜利占比过高，培养计划存在感不足'); }
  if (outcomes.baseWins / (outcomes.baseWins + outcomes.planWins + 0.01) < 0.2) { healthScore = 'B'; issues.push('基础胜利占比过低'); }

  w(`**总体健康度评分: ${healthScore}**`);
  if (issues.length > 0) {
    w('');
    w('主要问题:');
    for (const iss of issues) w(`- ${iss}`);
  }
  w('');

  // ---- Plan Balance ----
  w('## 2. 培养计划平衡性分析');
  w('');
  const planRanked = Object.entries(planStats)
    .map(([name, s]) => {
      const ci = wilsonInterval(s.wins, s.total);
      return { name, ...s, winRate: s.total > 0 ? s.wins / s.total : 0, ci };
    })
    .sort((a, b) => b.winRate - a.winRate);

  w('### 2.1 培养计划胜率排名');
  w('');
  w('| 排名 | 培养计划 | 胜率 | 样本 | 胜场 | 95%CI | 主修次 | 辅修次 | 评估 |');
  w('|------|---------|------|------|------|-------|--------|--------|------|');
  planRanked.forEach((p, i) => {
    let tag = '';
    if (p.winRate > 0.4 && p.total >= 30) tag = '**过强**';
    else if (p.winRate < 0.05 && p.total >= 30) tag = '**过弱**';
    else if (p.winRate > 0.3 && p.total >= 30) tag = '偏强';
    else if (p.winRate < 0.1 && p.total >= 30) tag = '偏弱';
    else if (p.total < 30) tag = '样本不足';
    else tag = '正常';
    w(`| ${i + 1} | ${p.name} | ${pct(p.wins, p.total)} | ${p.total} | ${p.wins} | [${(p.ci.lower * 100).toFixed(1)}%, ${(p.ci.upper * 100).toFixed(1)}%] | ${p.asMajor} | ${p.asMinor} | ${tag} |`);
  });
  w('');

  // Plan avg scores
  w('### 2.2 培养计划平均终局资源');
  w('');
  w('| 培养计划 | 平均金钱 | 平均GPA | 平均探索值 | 平均综合分 | 金钱σ | 探索σ |');
  w('|---------|---------|---------|----------|----------|-------|-------|');
  for (const p of planRanked) {
    w(`| ${p.name} | ${mean(p.money).toFixed(0)} | ${mean(p.gpa).toFixed(2)} | ${mean(p.explore).toFixed(1)} | ${mean(p.scores).toFixed(1)} | ${stdev(p.money).toFixed(0)} | ${stdev(p.explore).toFixed(1)} |`);
  }
  w('');

  // ---- Major vs Minor ----
  w('### 2.3 主修 vs 辅修效果');
  w('');
  w(`| 方向 | 总次数 | 胜次 | 胜率 |`);
  w(`|------|--------|------|------|`);
  w(`| 主修 | ${mvmStats.majorTotal} | ${mvmStats.majorWins} | ${pct(mvmStats.majorWins, mvmStats.majorTotal)} |`);
  w(`| 辅修 | ${mvmStats.minorTotal} | ${mvmStats.minorWins} | ${pct(mvmStats.minorWins, mvmStats.minorTotal)} |`);
  w('');

  // Top plans as major vs minor
  w('#### 主修/辅修胜率差异（前10计划）');
  w('');
  w('| 计划 | 主修胜率 | 主修次数 | 辅修胜率 | 辅修次数 | 差异 |');
  w('|------|---------|---------|---------|---------|------|');
  for (const p of planRanked.slice(0, 10)) {
    const majorRate = p.asMajor > 0 ? p.majorWins / p.asMajor : 0;
    const minorRate = p.asMinor > 0 ? p.minorWins / p.asMinor : 0;
    const diff = ((majorRate - minorRate) * 100).toFixed(1);
    w(`| ${p.name} | ${pct(p.majorWins, p.asMajor)} | ${p.asMajor} | ${pct(p.minorWins, p.asMinor)} | ${p.asMinor} | ${diff}pp |`);
  }
  w('');

  // ---- Plan by Player Count ----
  w('### 2.4 培养计划胜率（按玩家人数）');
  w('');
  const playerCounts = [...new Set(validGames.map(g => g.config?.playerCount || g.players.length))].sort();
  const pcHeader = playerCounts.map(pc => `${pc}人`).join(' | ');
  w(`| 培养计划 | ${pcHeader} |`);
  w(`|---------|${playerCounts.map(() => '------').join('|')}|`);
  for (const p of planRanked.slice(0, 15)) {
    const cells = playerCounts.map(pc => {
      const count = p.playerCounts[pc] || 0;
      if (count < 10) return `- (${count})`;
      // Compute win rate for this plan at this player count
      let wins = 0;
      for (const game of validGames) {
        if ((game.config?.playerCount || game.players.length) !== pc) continue;
        for (const pl of game.players) {
          if (getPlayerAllPlans(pl).includes(p.name) && pl.isWinner) wins++;
        }
      }
      return `${pct(wins, count)} (${count})`;
    });
    w(`| ${p.name} | ${cells.join(' | ')} |`);
  }
  w('');

  // ---- Line Route Analysis ----
  w('## 3. 线路平衡性分析');
  w('');
  const lineNameMap = {
    pukou: '浦口线(强制)', study: '学习线', money: '赚钱线', suzhou: '苏州线',
    explore: '探索线', xianlin: '仙林线', gulou: '鼓楼线', food: '食堂线(强制)',
  };

  w('### 3.1 线路访问与胜率关联');
  w('');
  const lineRanked = Object.entries(lineStats)
    .map(([id, s]) => ({
      id, name: lineNameMap[id] || id, ...s,
      winCorrelation: s.visits > 0 ? s.visitsByWinners / s.visits : 0,
    }))
    .sort((a, b) => b.winCorrelation - a.winCorrelation);

  w('| 线路 | 总访问 | 胜者访问 | 败者访问 | 胜者占比 | 平均金钱 | 平均GPA | 平均探索 |');
  w('|------|--------|---------|---------|---------|---------|---------|---------|');
  for (const l of lineRanked) {
    w(`| ${l.name} | ${l.visits} | ${l.visitsByWinners} | ${l.visitsByLosers} | ${pct(l.visitsByWinners, l.visits)} | ${mean(l.avgMoneyOnVisit).toFixed(0)} | ${mean(l.avgGpaOnVisit).toFixed(2)} | ${mean(l.avgExploreOnVisit).toFixed(1)} |`);
  }
  w('');

  // Line visit by player count
  w('### 3.2 线路访问（按玩家人数）');
  w('');
  w(`| 线路 | ${pcHeader} |`);
  w(`|------|${playerCounts.map(() => '------').join('|')}|`);
  for (const l of lineRanked) {
    const cells = playerCounts.map(pc => {
      const count = l.playerCounts[pc] || 0;
      return `${count}`;
    });
    w(`| ${l.name} | ${cells.join(' | ')} |`);
  }
  w('');

  // ---- Event Trigger Analysis ----
  w('### 3.3 线路事件触发频率');
  w('');
  for (const l of lineRanked) {
    const events = Object.entries(l.eventCounts).sort((a, b) => b[1] - a[1]);
    if (events.length === 0) continue;
    w(`**${l.name}：**`);
    const total = events.reduce((s, [, c]) => s + c, 0);
    const eventLines = events.map(([key, count]) => {
      const idx = key.split('_').pop();
      return `格${parseInt(idx) + 1}: ${count}次 (${pct(count, total)})`;
    });
    w(eventLines.join(' | '));
    w('');
  }

  // ---- Economy Analysis ----
  w('## 4. 经济系统分析');
  w('');
  w('### 4.1 资源汇率验证');
  w('');
  w('设计汇率: **1探索值 = 0.1GPA = 100金钱**');
  w('');
  const er = economy.exchangeRate;
  w(`| 指标 | 平均变化量 | 等价探索值 | 偏差 |`);
  w(`|------|----------|----------|------|`);
  w(`| 金钱(起始${er.initialMoney}) | ${er.avgMoney >= 0 ? '+' : ''}${er.avgMoney.toFixed(0)} | ${(er.avgMoney / 100).toFixed(1)} | — |`);
  w(`| GPA(起始3.0) | ${er.avgGpa >= 0 ? '+' : ''}${er.avgGpa.toFixed(2)} | ${(er.avgGpa * 10).toFixed(1)} | — |`);
  w(`| 探索值(起始0) | +${er.avgExplore.toFixed(1)} | ${er.avgExplore.toFixed(1)} | 基准 |`);
  w('');

  // Actual exchange rate
  const moneyAsExplore = er.avgMoney / 100;
  const gpaAsExplore = er.avgGpa * 10;
  if (er.avgExplore > 0) {
    const moneyRatio = moneyAsExplore / er.avgExplore;
    const gpaRatio = gpaAsExplore / er.avgExplore;
    w(`实际资源生成比例 (以探索值为基准):  `);
    w(`- 金钱产出效率: ${(moneyRatio * 100).toFixed(0)}% (${moneyRatio > 1.3 ? '金钱过多' : moneyRatio < 0.7 ? '金钱不足' : '基本平衡'})`);
    w(`- GPA产出效率: ${(gpaRatio * 100).toFixed(0)}% (${gpaRatio > 1.3 ? 'GPA过多' : gpaRatio < 0.7 ? 'GPA不足' : '基本平衡'})`);
    w('');
  }

  // ---- Resource Progression by Round ----
  w('### 4.2 资源随学年增长趋势');
  w('');
  w('| 学年 | 局数 | 平均金钱 | 平均GPA | 平均探索 | 平均综合分 |');
  w('|------|------|---------|---------|---------|----------|');
  const roundNames = { 1: '大一', 2: '大二', 3: '大三', 4: '大四' };
  for (const [r, s] of Object.entries(roundStats).sort((a, b) => a[0] - b[0])) {
    if (parseInt(r) === 0) continue;
    const name = roundNames[r] || `第${r}年`;
    w(`| ${name} | ${s.count} | ${mean(s.money).toFixed(0)} | ${mean(s.gpa).toFixed(2)} | ${mean(s.explore).toFixed(1)} | ${mean(s.scores).toFixed(1)} |`);
  }
  w('');

  // By strategy
  w('### 4.3 策略表现对比');
  w('');
  w('| 策略 | 胜率 | 平均金钱 | 平均GPA | 平均探索 | 平均综合分 | 金钱σ | GPA σ | 样本数 |');
  w('|------|------|---------|---------|---------|----------|-------|-------|-------|');
  for (const [strat, s] of Object.entries(economy.byStrategy).sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))) {
    w(`| ${strat} | ${pct(s.wins, s.total)} | ${mean(s.money).toFixed(0)} | ${mean(s.gpa).toFixed(2)} | ${mean(s.explore).toFixed(1)} | ${mean(s.scores).toFixed(1)} | ${stdev(s.money).toFixed(0)} | ${stdev(s.gpa).toFixed(2)} | ${s.total} |`);
  }
  w('');

  // Bankruptcy
  w('### 4.4 破产率分析');
  w('');
  w('| 人数 | 总玩家 | 破产数 | 破产率 |');
  w('|------|--------|--------|--------|');
  for (const [pc, s] of Object.entries(economy.byPlayerCount).sort((a, b) => a[0] - b[0])) {
    w(`| ${pc}人 | ${s.total} | ${s.bankrupts} | ${pct(s.bankrupts, s.total)} |`);
  }
  w('');

  // ---- Player Count Analysis ----
  w('## 5. 玩家人数影响分析');
  w('');
  w('| 人数 | 总局数 | 有胜者 | 胜出率 | 基础胜利 | 计划胜利 | 平均回合 | 平均时长(s) | 破产率 |');
  w('|------|--------|--------|--------|---------|---------|---------|-----------|--------|');
  for (const [pc, s] of Object.entries(pcStats).sort((a, b) => a[0] - b[0])) {
    w(`| ${pc}人 | ${s.games} | ${s.wins} | ${pct(s.wins, s.games)} | ${s.baseWins} | ${s.planWins} | ${mean(s.avgTurns).toFixed(1)} | ${mean(s.avgDuration).toFixed(1)} | ${pct(s.bankrupts, s.totalPlayers)} |`);
  }
  w('');

  // ---- Win Condition Breakdown ----
  w('## 6. 胜利条件分布');
  w('');
  w('| 胜利条件 | 次数 | 占比 |');
  w('|---------|------|------|');
  const totalWins = Object.values(outcomes.winConditions).reduce((s, v) => s + v, 0);
  for (const [cond, count] of Object.entries(outcomes.winConditions).sort((a, b) => b[1] - a[1])) {
    const shortCond = cond.length > 70 ? cond.substring(0, 67) + '...' : cond;
    w(`| ${shortCond} | ${count} | ${pct(count, totalWins)} |`);
  }
  w('');

  // ---- Turn Distribution ----
  w('## 7. 回合数分布');
  w('');
  const turnBuckets = {};
  for (const g of validGames) {
    const t = g.totalTurns || 0;
    const bucket = Math.floor(t / 3) * 3;
    const key = `${String(bucket).padStart(2, '0')}-${String(bucket + 2).padStart(2, '0')}`;
    turnBuckets[key] = (turnBuckets[key] || 0) + 1;
  }
  w('| 回合区间 | 局数 | 占比 | 柱状图 |');
  w('|---------|------|------|--------|');
  for (const [range, count] of Object.entries(turnBuckets).sort((a, b) => a[0].localeCompare(b[0]))) {
    const bar = '█'.repeat(Math.round(count / validGames.length * 50));
    w(`| ${range} | ${count} | ${pct(count, validGames.length)} | ${bar} |`);
  }
  w('');

  // ---- Per-Year Resource Snapshots ----
  w('## 8. 每年末资源快照');
  w('');
  w('基于每年末的资源快照数据，展示各年度平均资源状态。');
  w('');
  {
    const roundNames = { 1: '大一', 2: '大二', 3: '大三', 4: '大四' };
    w('### 8.1 全体玩家平均资源');
    w('');
    w('| 学年 | 样本 | 平均金钱 | 平均GPA | 平均探索 | 金钱σ | GPA σ | 探索σ |');
    w('|------|------|---------|---------|---------|-------|-------|-------|');
    for (const [y, s] of Object.entries(yearSnapshots.byYear).sort((a, b) => a[0] - b[0])) {
      if (s.money.length === 0) continue;
      const name = roundNames[y] || `第${y}年`;
      w(`| ${name} | ${s.money.length} | ${mean(s.money).toFixed(0)} | ${mean(s.gpa).toFixed(2)} | ${mean(s.explore).toFixed(1)} | ${stdev(s.money).toFixed(0)} | ${stdev(s.gpa).toFixed(2)} | ${stdev(s.explore).toFixed(1)} |`);
    }
    w('');

    // Year-over-year deltas
    const years = Object.keys(yearSnapshots.byYear).map(Number).sort((a, b) => a - b);
    if (years.length >= 2) {
      w('### 8.2 各年增长量');
      w('');
      w('| 年度变化 | 金钱增量 | GPA增量 | 探索值增量 |');
      w('|---------|---------|---------|----------|');
      for (let i = 1; i < years.length; i++) {
        const prev = yearSnapshots.byYear[years[i - 1]];
        const curr = yearSnapshots.byYear[years[i]];
        if (!prev || !curr || prev.money.length === 0 || curr.money.length === 0) continue;
        const fromName = roundNames[years[i - 1]] || `第${years[i - 1]}年`;
        const toName = roundNames[years[i]] || `第${years[i]}年`;
        const dMoney = mean(curr.money) - mean(prev.money);
        const dGpa = mean(curr.gpa) - mean(prev.gpa);
        const dExplore = mean(curr.explore) - mean(prev.explore);
        w(`| ${fromName}→${toName} | ${dMoney >= 0 ? '+' : ''}${dMoney.toFixed(0)} | ${dGpa >= 0 ? '+' : ''}${dGpa.toFixed(2)} | ${dExplore >= 0 ? '+' : ''}${dExplore.toFixed(1)} |`);
      }
      w('');
    }

    // Per-plan per-year
    w('### 8.3 各培养计划持有者每年末资源（主修）');
    w('');
    const planYearEntries = Object.entries(yearSnapshots.byPlanYear)
      .filter(([, ys]) => Object.values(ys).some(y => y.money.length >= 3))
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (planYearEntries.length > 0) {
      w('| 培养计划 | 大一末金钱 | 大一末GPA | 大一末探索 | 大二末金钱 | 大二末GPA | 大二末探索 | 大三末金钱 | 大三末GPA | 大三末探索 |');
      w('|---------|----------|----------|----------|----------|----------|----------|----------|----------|----------|');
      for (const [plan, ys] of planYearEntries) {
        const cells = [1, 2, 3].map(y => {
          const s = ys[y];
          if (!s || s.money.length < 2) return '- | - | -';
          return `${mean(s.money).toFixed(0)} | ${mean(s.gpa).toFixed(2)} | ${mean(s.explore).toFixed(1)}`;
        });
        w(`| ${plan} | ${cells.join(' | ')} |`);
      }
      w('');
    } else {
      w('样本数据不足，需要更多模拟局数。');
      w('');
    }
  }

  // ---- Event Effects Analysis ----
  w('## 9. 事件触发与效果分析');
  w('');
  {
    w('### 9.1 事件触发频率（Top 20）');
    w('');
    const eventRanked = Object.entries(eventEffects.eventEffects)
      .sort((a, b) => b[1].count - a[1].count);
    const totalEvents = eventRanked.reduce((s, [, e]) => s + e.count, 0);
    w('| 事件 | 触发次数 | 占比 |');
    w('|------|---------|------|');
    for (const [title, e] of eventRanked.slice(0, 20)) {
      w(`| ${title} | ${e.count} | ${pct(e.count, totalEvents)} |`);
    }
    w('');

    // Resource change per round
    w('### 9.2 各学年资源变化量（所有变化事件汇总）');
    w('');
    const roundNames = { 1: '大一', 2: '大二', 3: '大三', 4: '大四' };
    w('| 学年 | 金钱变化次数 | 平均金钱变化 | GPA变化次数 | 平均GPA变化 | 探索变化次数 | 平均探索变化 |');
    w('|------|------------|----------|-----------|----------|-----------|----------|');
    for (const [r, s] of Object.entries(eventEffects.roundEffects).sort((a, b) => a[0] - b[0])) {
      if (parseInt(r) === 0) continue;
      const name = roundNames[r] || `第${r}年`;
      w(`| ${name} | ${s.money.length} | ${s.money.length > 0 ? (mean(s.money) >= 0 ? '+' : '') + mean(s.money).toFixed(0) : '-'} | ${s.gpa.length} | ${s.gpa.length > 0 ? (mean(s.gpa) >= 0 ? '+' : '') + mean(s.gpa).toFixed(2) : '-'} | ${s.explore.length} | ${s.explore.length > 0 ? (mean(s.explore) >= 0 ? '+' : '') + mean(s.explore).toFixed(1) : '-'} |`);
    }
    w('');
  }

  // ---- Early Win Timing ----
  w('## 10. 提前胜利时机分析');
  w('');
  {
    const totalEarly = winTiming.earlyWins;
    const roundNames = { 1: '大一', 2: '大二', 3: '大三', 4: '大四', 5: '毕业' };
    w(`提前获胜占比: **${pct(totalEarly, totalEarly + winTiming.graduationWins)}** (${totalEarly}/${totalEarly + winTiming.graduationWins})`);
    w('');
    if (totalEarly > 0) {
      w('| 获胜学年 | 局数 | 占提前胜利比 |');
      w('|---------|------|------------|');
      for (const [r, count] of Object.entries(winTiming.earlyByRound).sort((a, b) => a[0] - b[0])) {
        const name = roundNames[r] || `第${r}年`;
        w(`| ${name} | ${count} | ${pct(count, totalEarly)} |`);
      }
      w('');
    }
  }

  // ---- Balance Recommendations ----
  w('## 11. 平衡性调整建议');
  w('');
  const recommendations = [];

  // Overpowered plans
  const overpowered = planRanked.filter(p => p.winRate > 0.35 && p.total >= 30);
  if (overpowered.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: '培养计划过强',
      details: overpowered.map(p => `- **${p.name}** (胜率${pct(p.wins, p.total)}): 建议提高达成难度或削弱被动能力`),
    });
  }

  // Underpowered plans
  const underpowered = planRanked.filter(p => p.winRate < 0.05 && p.total >= 30);
  if (underpowered.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: '培养计划过弱',
      details: underpowered.map(p => `- **${p.name}** (胜率${pct(p.wins, p.total)}): 建议降低达成难度或增强被动能力`),
    });
  }

  // Major/minor imbalance
  if (mvmStats.majorTotal >= 100 && mvmStats.minorTotal >= 100) {
    const majorWR = mvmStats.majorWins / mvmStats.majorTotal;
    const minorWR = mvmStats.minorWins / mvmStats.minorTotal;
    if (majorWR > minorWR * 3) {
      recommendations.push({
        priority: 'MEDIUM',
        category: '主修/辅修失衡',
        details: [`- 主修胜率(${pct(mvmStats.majorWins, mvmStats.majorTotal)})远高于辅修(${pct(mvmStats.minorWins, mvmStats.minorTotal)})`, '- 辅修计划胜利条件可能太难达成'],
      });
    }
  }

  // Timeout rate
  if (outcomes.timeoutEnds / validGames.length > 0.4) {
    recommendations.push({
      priority: 'MEDIUM',
      category: '超时结算率过高',
      details: [`- 超时率: ${pct(outcomes.timeoutEnds, validGames.length)}`, '- 建议: 降低基础胜利阈值（当前60）或增加资源获取速度'],
    });
  }

  // Economy imbalance
  if (er.avgExplore > 0) {
    const moneyRatio = (er.avgMoney / 100) / er.avgExplore;
    const gpaRatio = (er.avgGpa * 10) / er.avgExplore;
    if (moneyRatio > 1.5) {
      recommendations.push({ priority: 'MEDIUM', category: '金钱产出偏高', details: ['- 建议: 减少金钱奖励或增加支出事件'] });
    } else if (moneyRatio < 0.5) {
      recommendations.push({ priority: 'MEDIUM', category: '金钱产出偏低', details: ['- 建议: 增加金钱奖励或减少费用'] });
    }
    if (gpaRatio > 1.5) {
      recommendations.push({ priority: 'MEDIUM', category: 'GPA产出偏高', details: ['- 建议: 减少GPA奖励或增加GPA扣减事件'] });
    } else if (gpaRatio < 0.5) {
      recommendations.push({ priority: 'MEDIUM', category: 'GPA产出偏低', details: ['- 建议: 增加GPA奖励或减少扣减力度'] });
    }
  }

  // High bankruptcy rate
  for (const [pc, s] of Object.entries(economy.byPlayerCount)) {
    if (s.total > 0 && s.bankrupts / s.total > 0.3) {
      recommendations.push({
        priority: 'MEDIUM',
        category: `${pc}人局破产率过高`,
        details: [`- 破产率: ${pct(s.bankrupts, s.total)}`, '- 建议: 增加金钱获取途径或降低支出'],
      });
    }
  }

  // Strategy dominance
  const stratRanks = Object.entries(economy.byStrategy)
    .map(([name, s]) => ({ name, winRate: s.total > 0 ? s.wins / s.total : 0, total: s.total }))
    .filter(s => s.total >= 50)
    .sort((a, b) => b.winRate - a.winRate);
  if (stratRanks.length >= 2) {
    const best = stratRanks[0], worst = stratRanks[stratRanks.length - 1];
    if (best.winRate > worst.winRate * 2.5 && worst.winRate > 0) {
      recommendations.push({
        priority: 'LOW',
        category: '策略不平衡',
        details: [`- ${best.name}策略胜率(${pct(best.winRate * best.total, best.total)})远高于${worst.name}(${pct(worst.winRate * worst.total, worst.total)})`, '- 说明某类资源路线明显优于其他'],
      });
    }
  }

  if (recommendations.length === 0) {
    w('暂无明显的平衡性问题，整体表现良好。');
  } else {
    recommendations.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });
    for (const rec of recommendations) {
      w(`### [${rec.priority}] ${rec.category}`);
      w('');
      for (const d of rec.details) w(d);
      w('');
    }
  }

  // ---- Raw Data Summary ----
  w('## 12. 数据说明');
  w('');
  w(`- 数据来源: ${inputPath}`);
  w(`- 总模拟局数: ${rawData.length} (有效: ${validGames.length})`);
  w(`- 错误局数: ${rawData.length - validGames.length}`);
  w(`- 骰子配置: ${validGames[0]?.config?.diceOption || '未知'}`);
  w(`- 玩家人数: ${[...new Set(validGames.map(g => g.config?.playerCount))].sort().join(', ')}人`);
  w(`- 策略: ${[...new Set(validGames.flatMap(g => g.config?.strategyNames || []))].join(', ')}`);
  w('');

  return lines.join('\n');
}

// ============================================================
// Main
// ============================================================
const report = generateReport();

try {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, report, 'utf-8');
  console.log(`Report generated: ${outputPath}`);
} catch (err) {
  console.error(`Error writing report: ${err.message}`);
  // Print to stdout as fallback
  console.log(report);
}
