/**
 * Balance Analysis Report Generator for 菜根人生 (Nannaricher)
 *
 * Reads raw simulation data and generates a comprehensive balance report.
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

// ============================================================
// Analysis Functions
// ============================================================

function analyzePlans() {
  const stats = {};
  for (const game of validGames) {
    for (const p of game.players) {
      for (const planName of (p.confirmedPlans || [])) {
        if (!stats[planName]) stats[planName] = {
          total: 0, wins: 0, winConditions: {},
          scores: [], money: [], gpa: [], explore: [],
          strategies: {}, playerCounts: {},
        };
        const s = stats[planName];
        s.total++;
        if (p.isWinner) {
          s.wins++;
          const cond = game.winner?.condition || 'unknown';
          s.winConditions[cond] = (s.winConditions[cond] || 0) + 1;
        }
        s.scores.push(p.finalScore ?? 0);
        s.money.push(p.finalMoney ?? 0);
        s.gpa.push(p.finalGpa ?? 0);
        s.explore.push(p.finalExploration ?? 0);
        s.strategies[p.strategy] = (s.strategies[p.strategy] || 0) + 1;
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
        };
        stats[line].visits++;
        if (p.isWinner) stats[line].visitsByWinners++;
        else stats[line].visitsByLosers++;
        const pc = game.config?.playerCount || game.players.length;
        stats[line].playerCounts[pc] = (stats[line].playerCounts[pc] || 0) + 1;
      }
    }
  }

  // Ensure all lines present
  for (const ln of lineNames) {
    if (!stats[ln]) stats[ln] = { visits: 0, visitsByWinners: 0, visitsByLosers: 0, playerCounts: {} };
  }

  return stats;
}

function analyzeEconomy() {
  const allPlayers = validGames.flatMap(g => g.players || []);
  const byStrategy = {};
  const byPlayerCount = {};

  for (const game of validGames) {
    const pc = game.config?.playerCount || game.players.length;
    if (!byPlayerCount[pc]) byPlayerCount[pc] = { money: [], gpa: [], explore: [], scores: [], turns: [], bankrupts: 0, total: 0 };
    byPlayerCount[pc].turns.push(game.totalTurns || 0);

    for (const p of game.players) {
      // By strategy
      if (!byStrategy[p.strategy]) byStrategy[p.strategy] = { money: [], gpa: [], explore: [], scores: [], wins: 0, total: 0 };
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
  // Check: are resources generated at this ratio?
  const avgMoney = mean(allPlayers.map(p => (p.finalMoney ?? 3000) - 3000)); // delta from start
  const avgGpa = mean(allPlayers.map(p => (p.finalGpa ?? 3.0) - 3.0));
  const avgExplore = mean(allPlayers.map(p => p.finalExploration ?? 0));

  return { byStrategy, byPlayerCount, exchangeRate: { avgMoney, avgGpa, avgExplore } };
}

function analyzeGameOutcomes() {
  let baseWins = 0, planWins = 0, timeoutEnds = 0, bankruptEnds = 0, unknownEnds = 0;
  const winConditions = {};
  const turnDistribution = [];

  for (const game of validGames) {
    turnDistribution.push(game.totalTurns || 0);

    if (game.winner) {
      const cond = game.winner.condition || 'unknown';
      winConditions[cond] = (winConditions[cond] || 0) + 1;
      if (cond === 'base' || cond === 'base_win') baseWins++;
      else planWins++;
    } else if (game.phase === 'finished') {
      timeoutEnds++;
    } else {
      unknownEnds++;
    }
  }

  return { baseWins, planWins, timeoutEnds, unknownEnds, winConditions, turnDistribution };
}

function analyzePlayerCount() {
  const byCount = {};

  for (const game of validGames) {
    const pc = game.config?.playerCount || game.players.length;
    if (!byCount[pc]) byCount[pc] = {
      games: 0, wins: 0, avgTurns: [], avgDuration: [],
      bankrupts: 0, totalPlayers: 0,
    };
    const b = byCount[pc];
    b.games++;
    if (game.winner) b.wins++;
    b.avgTurns.push(game.totalTurns || 0);
    b.avgDuration.push(game.duration || 0);
    for (const p of game.players) {
      b.totalPlayers++;
      if (p.isBankrupt) b.bankrupts++;
    }
  }

  return byCount;
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

  const totalPlayers = validGames.reduce((s, g) => s + (g.players?.length || 0), 0);
  const lines = [];
  const w = (s) => lines.push(s);

  // ---- Header ----
  w('# 菜根人生 - 游戏平衡性分析报告');
  w('');
  w(`> 生成时间: ${new Date().toISOString().slice(0, 19)}`);
  w(`> 有效模拟局数: **${validGames.length}** / ${rawData.length}`);
  w(`> 总玩家数据点: **${totalPlayers}**`);
  w('');

  // ---- Executive Summary ----
  w('## 1. 总体概况');
  w('');
  const winRate = validGames.filter(g => g.winner).length / validGames.length;
  w(`| 指标 | 数值 |`);
  w(`|------|------|`);
  w(`| 总模拟局数 | ${validGames.length} |`);
  w(`| 有胜者局数 | ${validGames.filter(g => g.winner).length} (${pct(validGames.filter(g => g.winner).length, validGames.length)}) |`);
  w(`| 超时结算局数 | ${outcomes.timeoutEnds} (${pct(outcomes.timeoutEnds, validGames.length)}) |`);
  w(`| 基础胜利 (GPA*10+探索>=60) | ${outcomes.baseWins} (${pct(outcomes.baseWins, outcomes.baseWins + outcomes.planWins)}) |`);
  w(`| 培养计划胜利 | ${outcomes.planWins} (${pct(outcomes.planWins, outcomes.baseWins + outcomes.planWins)}) |`);
  w(`| 平均游戏回合数 | ${mean(outcomes.turnDistribution).toFixed(1)} |`);
  w(`| 回合数中位数 | ${median(outcomes.turnDistribution).toFixed(1)} |`);
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
  w('| 排名 | 培养计划 | 胜率 | 样本数 | 胜场 | 95%置信区间 | 评估 |');
  w('|------|---------|------|--------|------|-----------|------|');
  planRanked.forEach((p, i) => {
    let tag = '';
    if (p.winRate > 0.4 && p.total >= 30) tag = '**过强**';
    else if (p.winRate < 0.05 && p.total >= 30) tag = '**过弱**';
    else if (p.winRate > 0.3 && p.total >= 30) tag = '偏强';
    else if (p.winRate < 0.1 && p.total >= 30) tag = '偏弱';
    else if (p.total < 30) tag = '样本不足';
    else tag = '正常';
    w(`| ${i + 1} | ${p.name} | ${pct(p.wins, p.total)} | ${p.total} | ${p.wins} | [${(p.ci.lower * 100).toFixed(1)}%, ${(p.ci.upper * 100).toFixed(1)}%] | ${tag} |`);
  });
  w('');

  // Plan avg scores
  w('### 2.2 培养计划平均终局资源');
  w('');
  w('| 培养计划 | 平均金钱 | 平均GPA | 平均探索值 | 平均综合分 |');
  w('|---------|---------|---------|----------|----------|');
  for (const p of planRanked) {
    w(`| ${p.name} | ${mean(p.money).toFixed(0)} | ${mean(p.gpa).toFixed(2)} | ${mean(p.explore).toFixed(1)} | ${mean(p.scores).toFixed(1)} |`);
  }
  w('');

  // ---- Line Route Analysis ----
  w('## 3. 线路收益分析');
  w('');
  const lineNameMap = {
    pukou: '浦口线(强制)', study: '学习线', money: '赚钱线', suzhou: '苏州线',
    explore: '探索线', xianlin: '仙林线', gulou: '鼓楼线', food: '食堂线(强制)',
  };
  const lineRanked = Object.entries(lineStats)
    .map(([id, s]) => ({
      id, name: lineNameMap[id] || id, ...s,
      winCorrelation: s.visits > 0 ? s.visitsByWinners / s.visits : 0,
    }))
    .sort((a, b) => b.winCorrelation - a.winCorrelation);

  w('| 线路 | 总访问次数 | 胜者访问 | 败者访问 | 胜者占比 |');
  w('|------|----------|---------|---------|---------|');
  for (const l of lineRanked) {
    w(`| ${l.name} | ${l.visits} | ${l.visitsByWinners} | ${l.visitsByLosers} | ${pct(l.visitsByWinners, l.visits)} |`);
  }
  w('');

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
  w(`| 金钱(起始3000) | ${er.avgMoney >= 0 ? '+' : ''}${er.avgMoney.toFixed(0)} | ${(er.avgMoney / 100).toFixed(1)} | — |`);
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

  // By strategy
  w('### 4.2 策略表现对比');
  w('');
  w('| 策略 | 胜率 | 平均金钱 | 平均GPA | 平均探索 | 平均综合分 | 样本数 |');
  w('|------|------|---------|---------|---------|----------|-------|');
  for (const [strat, s] of Object.entries(economy.byStrategy).sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))) {
    w(`| ${strat} | ${pct(s.wins, s.total)} | ${mean(s.money).toFixed(0)} | ${mean(s.gpa).toFixed(2)} | ${mean(s.explore).toFixed(1)} | ${mean(s.scores).toFixed(1)} | ${s.total} |`);
  }
  w('');

  // Bankruptcy
  w('### 4.3 破产率分析');
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
  w('| 人数 | 总局数 | 有胜者 | 胜出率 | 平均回合 | 平均时长(s) | 破产率 |');
  w('|------|--------|--------|--------|---------|-----------|--------|');
  for (const [pc, s] of Object.entries(pcStats).sort((a, b) => a[0] - b[0])) {
    w(`| ${pc}人 | ${s.games} | ${s.wins} | ${pct(s.wins, s.games)} | ${mean(s.avgTurns).toFixed(1)} | ${mean(s.avgDuration).toFixed(1)} | ${pct(s.bankrupts, s.totalPlayers)} |`);
  }
  w('');

  // ---- Win Condition Breakdown ----
  w('## 6. 胜利条件分布');
  w('');
  w('| 胜利条件 | 次数 | 占比 |');
  w('|---------|------|------|');
  const totalWins = Object.values(outcomes.winConditions).reduce((s, v) => s + v, 0);
  for (const [cond, count] of Object.entries(outcomes.winConditions).sort((a, b) => b[1] - a[1])) {
    w(`| ${cond} | ${count} | ${pct(count, totalWins)} |`);
  }
  w('');

  // ---- Balance Recommendations ----
  w('## 7. 平衡性调整建议');
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
  w('## 8. 数据说明');
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
