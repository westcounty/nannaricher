/**
 * Deep analysis of raw simulation data for 菜根人生 (Nannaricher)
 *
 * Updated for new training plan system (majorPlan/minorPlans).
 *
 * Usage: node balance-test/deep-analysis.mjs [input]
 */
import { readFileSync } from 'fs';

const file = process.argv[2] || 'balance-test/report/raw-data.json';
const raw = JSON.parse(readFileSync(file, 'utf-8'));
const games = raw.filter(g => !g.error && g.players?.length > 0);

console.log('=== 深度数据分析 ===\n');
console.log(`数据文件: ${file}`);
console.log(`有效局数: ${games.length} / ${raw.length}\n`);

// Helpers
function getWinCond(g) { return g.winner?.condition || ''; }
function hasWinner(g) { return !!g.winner; }
function getWinnerPlayer(g) { return g.players.find(p => p.isWinner); }

// Get player's primary plan name (new model: majorPlan; legacy: confirmedPlans[0])
function getMajorPlan(p) {
  if (p.majorPlan) return p.majorPlan;
  if (p.allPlanNames?.length > 0) return p.allPlanNames[0];
  if (p.confirmedPlans?.length > 0) return p.confirmedPlans[0];
  return 'unknown';
}

// Get all plan names
function getAllPlans(p) {
  if (p.allPlanNames?.length > 0) return p.allPlanNames;
  if (p.confirmedPlans?.length > 0) return p.confirmedPlans;
  return [];
}

// Get minor plan names
function getMinorPlans(p) {
  if (p.minorPlans?.length > 0) return p.minorPlans;
  if (p.allPlanNames?.length > 1) return p.allPlanNames.slice(1);
  if (p.confirmedPlans?.length > 1) return p.confirmedPlans.slice(1);
  return [];
}

// 1. Correct base vs plan win classification
let baseWins = 0;
let planWins = 0;
const planWinCounts = {};
const planSpecificWins = {};

for (const g of games) {
  if (!hasWinner(g)) continue;
  const cond = getWinCond(g);
  const isBase = cond.includes('GPA×10+探索值达到') || cond === 'base' || cond === 'base_win';
  if (isBase) baseWins++;
  else planWins++;

  const wp = getWinnerPlayer(g);
  if (wp) {
    const plan = getMajorPlan(wp);
    planWinCounts[plan] = (planWinCounts[plan] || 0) + 1;
    if (!isBase) {
      planSpecificWins[plan] = (planSpecificWins[plan] || 0) + 1;
    }
  }
}

const totalWithWinner = games.filter(g => hasWinner(g)).length;
console.log('--- 1. 胜利条件修正分类 ---');
console.log(`有胜者局数: ${totalWithWinner}`);
console.log(`基础胜利 (GPA×10+探索≥60): ${baseWins} (${(baseWins / totalWithWinner * 100).toFixed(1)}%)`);
console.log(`计划专属胜利: ${planWins} (${(planWins / totalWithWinner * 100).toFixed(1)}%)`);

// 2. Plan win breakdown (using major plan)
console.log('\n--- 2. 各计划总胜场 & 计划专属胜利（按主修计划）---');
const planEntries = Object.entries(planWinCounts).sort((a, b) => b[1] - a[1]);
for (const [plan, total] of planEntries) {
  const specific = planSpecificWins[plan] || 0;
  console.log(`${plan}: ${total}胜, 计划专属${specific}胜 (${(specific / total * 100).toFixed(1)}%)`);
}

// 3. Turn distribution
console.log('\n--- 3. 回合数分布 ---');
const turnBuckets = {};
for (const g of games) {
  const t = g.totalTurns || 0;
  const bucket = Math.floor(t / 5) * 5;
  const key = `${String(bucket).padStart(2, '0')}-${String(bucket + 4).padStart(2, '0')}`;
  turnBuckets[key] = (turnBuckets[key] || 0) + 1;
}
const sortedBuckets = Object.entries(turnBuckets).sort((a, b) => a[0].localeCompare(b[0]));
for (const [range, count] of sortedBuckets) {
  console.log(`${range}回合: ${count}局 (${(count / games.length * 100).toFixed(1)}%)`);
}

// 4. Plan stats (all plans, not just major)
console.log('\n--- 4. 各计划玩家平均终局数据 ---');
const planStats = {};
for (const g of games) {
  for (const p of g.players) {
    for (const planName of getAllPlans(p)) {
      if (!planStats[planName]) planStats[planName] = { count: 0, money: 0, gpa: 0, explore: 0, wins: 0, hospital: 0, cards: 0, asMajor: 0, asMinor: 0 };
      const s = planStats[planName];
      s.count++;
      s.money += p.finalMoney || 0;
      s.gpa += p.finalGpa || 0;
      s.explore += p.finalExploration || 0;
      s.wins += p.isWinner ? 1 : 0;
      s.hospital += p.hospitalVisits || 0;
      s.cards += p.heldCards || 0;
      if (getMajorPlan(p) === planName) s.asMajor++;
      else s.asMinor++;
    }
  }
}

const planStatEntries = Object.entries(planStats).sort((a, b) => (b[1].wins / b[1].count) - (a[1].wins / a[1].count));
console.log('计划 | 样本 | 胜率 | 平均金钱 | 平均GPA | 平均探索 | 综合分 | 主修/辅修 | 医院');
for (const [plan, s] of planStatEntries) {
  const wr = (s.wins / s.count * 100).toFixed(1);
  const avgMoney = (s.money / s.count).toFixed(0);
  const avgGpa = (s.gpa / s.count).toFixed(2);
  const avgExplore = (s.explore / s.count).toFixed(1);
  const score = (s.gpa / s.count * 10 + s.explore / s.count).toFixed(1);
  const avgHospital = (s.hospital / s.count).toFixed(2);
  console.log(`${plan}: ${s.count}样本, 胜率${wr}%, 金钱${avgMoney}, GPA${avgGpa}, 探索${avgExplore}, 综合${score}, 主修${s.asMajor}/辅修${s.asMinor}, 医院${avgHospital}`);
}

// 5. Win condition grouped
console.log('\n--- 5. 胜利条件大类统计 ---');
const condGroups = { base: 0, plan_specific: {} };
for (const g of games) {
  if (!hasWinner(g)) continue;
  const cond = getWinCond(g);
  if (cond.includes('GPA×10+探索值达到') || cond === 'base' || cond === 'base_win') {
    condGroups.base++;
  } else {
    const match = cond.match(/^(.+?)[:：]/);
    const planName = match ? match[1] : 'other';
    condGroups.plan_specific[planName] = (condGroups.plan_specific[planName] || 0) + 1;
  }
}
console.log(`基础胜利: ${condGroups.base} (${(condGroups.base / totalWithWinner * 100).toFixed(1)}%)`);
const planCondEntries = Object.entries(condGroups.plan_specific).sort((a, b) => b[1] - a[1]);
for (const [plan, count] of planCondEntries) {
  console.log(`${plan}: ${count} (${(count / totalWithWinner * 100).toFixed(1)}%)`);
}

// 6. Strategy vs plan correlation for top 5 plans
console.log('\n--- 6. 策略与计划胜率交叉分析 (前5计划) ---');
const topPlans = planStatEntries.slice(0, 5).map(e => e[0]);
const stratPlanStats = {};
for (const g of games) {
  for (const p of g.players) {
    for (const planName of getAllPlans(p)) {
      const strat = p.strategy || 'unknown';
      if (!topPlans.includes(planName)) continue;
      const key = `${planName}|${strat}`;
      if (!stratPlanStats[key]) stratPlanStats[key] = { wins: 0, total: 0 };
      stratPlanStats[key].total++;
      if (p.isWinner) stratPlanStats[key].wins++;
    }
  }
}
for (const plan of topPlans) {
  const strats = Object.entries(stratPlanStats)
    .filter(([k]) => k.startsWith(plan + '|'))
    .map(([k, v]) => ({ strat: k.split('|')[1], wr: (v.wins / v.total * 100).toFixed(1), n: v.total }));
  console.log(`${plan}: ${strats.map(s => `${s.strat}=${s.wr}%(n=${s.n})`).join(', ')}`);
}

// 7. Major vs Minor win analysis
console.log('\n--- 7. 主修 vs 辅修胜利分析 ---');
let majorWins = 0, majorTotal = 0, minorWins = 0, minorTotal = 0;
for (const g of games) {
  for (const p of g.players) {
    const major = getMajorPlan(p);
    if (major && major !== 'unknown') {
      majorTotal++;
      if (p.isWinner) majorWins++;
    }
    for (const minor of getMinorPlans(p)) {
      minorTotal++;
      if (p.isWinner) minorWins++;
    }
  }
}
console.log(`主修玩家: ${majorTotal}样本, ${majorWins}胜 (${(majorWins / majorTotal * 100).toFixed(1)}%)`);
console.log(`辅修玩家: ${minorTotal}样本, ${minorWins}胜 (${(minorWins / minorTotal * 100).toFixed(1)}%)`);

// 8. Plan slot usage
console.log('\n--- 8. 培养计划槽位使用情况 ---');
const slotUsage = { 0: 0, 1: 0, 2: 0, 3: 0 };
for (const g of games) {
  for (const p of g.players) {
    const count = getAllPlans(p).length;
    slotUsage[count] = (slotUsage[count] || 0) + 1;
  }
}
for (const [slots, count] of Object.entries(slotUsage)) {
  const total = games.reduce((s, g) => s + g.players.length, 0);
  console.log(`${slots}个计划: ${count}人次 (${(count / total * 100).toFixed(1)}%)`);
}

// 9. Early game vs late game win analysis
console.log('\n--- 9. 早期/晚期胜利分析 ---');
const earlyGames = games.filter(g => hasWinner(g) && g.totalTurns <= 12);
const midGames = games.filter(g => hasWinner(g) && g.totalTurns > 12 && g.totalTurns <= 20);
const lateGames = games.filter(g => hasWinner(g) && g.totalTurns > 20);
console.log(`早期 (<=12回合, 大一-大二初): ${earlyGames.length}局`);
console.log(`中期 (13-20回合, 大二-大三): ${midGames.length}局`);
console.log(`后期 (>20回合, 大四): ${lateGames.length}局`);

for (const plan of ['政府管理学院', '匡亚明学院', '计算机科学与技术系', '大气科学学院', '商学院', '马克思主义学院']) {
  const earlyWins = earlyGames.filter(g => getMajorPlan(getWinnerPlayer(g)) === plan).length;
  const earlyTotal = earlyGames.filter(g => g.players.some(p => getAllPlans(p).includes(plan))).length;
  const lateWins = lateGames.filter(g => getMajorPlan(getWinnerPlayer(g)) === plan).length;
  const lateTotal = lateGames.filter(g => g.players.some(p => getAllPlans(p).includes(plan))).length;
  const er = earlyTotal > 0 ? (earlyWins / earlyTotal * 100).toFixed(0) : 'N/A';
  const lr = lateTotal > 0 ? (lateWins / lateTotal * 100).toFixed(0) : 'N/A';
  console.log(`${plan}: 早期${er}%(${earlyWins}/${earlyTotal}), 后期${lr}%(${lateWins}/${lateTotal})`);
}

// 10. Player count impact
console.log('\n--- 10. 玩家人数对强弱计划影响 ---');
for (const plan of ['政府管理学院', '匡亚明学院', '大气科学学院', '商学院', '马克思主义学院']) {
  const byCount = {};
  for (const g of games) {
    const n = g.players.length;
    const hasPlan = g.players.some(p => getAllPlans(p).includes(plan));
    if (!hasPlan) continue;
    if (!byCount[n]) byCount[n] = { wins: 0, total: 0 };
    byCount[n].total++;
    if (hasWinner(g)) {
      const wp = getWinnerPlayer(g);
      if (wp && getAllPlans(wp).includes(plan)) byCount[n].wins++;
    }
  }
  const details = Object.entries(byCount).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([n, v]) => `${n}人=${(v.wins / v.total * 100).toFixed(0)}%(${v.wins}/${v.total})`)
    .join(', ');
  console.log(`${plan}: ${details}`);
}

// 11. Line visit patterns for winners vs losers
console.log('\n--- 11. 线路访问模式分析 ---');
const lineStatsLocal = {};
for (const g of games) {
  for (const p of g.players) {
    const linesList = p.linesVisited || [];
    for (const line of linesList) {
      if (!lineStatsLocal[line]) lineStatsLocal[line] = { winVisits: 0, loseVisits: 0, avgVisitsPerPlayer: 0, totalPlayers: 0 };
      if (p.isWinner) lineStatsLocal[line].winVisits++;
      else lineStatsLocal[line].loseVisits++;
    }
    // Track visit frequency
    const uniqueLines = [...new Set(linesList)];
    for (const line of uniqueLines) {
      lineStatsLocal[line].totalPlayers++;
    }
  }
}
console.log('线路 | 胜者访问 | 败者访问 | 胜者占比 | 独立玩家数');
for (const [line, s] of Object.entries(lineStatsLocal).sort((a, b) =>
  (b[1].winVisits / (b[1].winVisits + b[1].loseVisits)) - (a[1].winVisits / (a[1].winVisits + a[1].loseVisits))
)) {
  const total = s.winVisits + s.loseVisits;
  console.log(`${line}: 胜${s.winVisits}, 败${s.loseVisits}, 胜者占比${(s.winVisits / total * 100).toFixed(1)}%, 独立玩家${s.totalPlayers}`);
}

// 12. Bankruptcy analysis
console.log('\n--- 12. 破产分析 ---');
let totalBankrupt = 0;
const bankruptByPlan = {};
for (const g of games) {
  for (const p of g.players) {
    if (p.isBankrupt) {
      totalBankrupt++;
      const plan = getMajorPlan(p);
      bankruptByPlan[plan] = (bankruptByPlan[plan] || 0) + 1;
    }
  }
}
console.log(`总破产次数: ${totalBankrupt}`);
const bpEntries = Object.entries(bankruptByPlan).sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [plan, count] of bpEntries) {
  const total = planStats[plan]?.count || 1;
  console.log(`${plan}: ${count}次破产 (${(count / total * 100).toFixed(1)}%)`);
}

// 13. Round progression: resource averages by round
console.log('\n--- 13. 学年资源增长趋势 ---');
const byRound = {};
for (const g of games) {
  const r = g.totalRounds || 0;
  if (!byRound[r]) byRound[r] = { money: [], gpa: [], explore: [], count: 0 };
  byRound[r].count++;
  for (const p of g.players) {
    byRound[r].money.push(p.finalMoney || 0);
    byRound[r].gpa.push(p.finalGpa || 0);
    byRound[r].explore.push(p.finalExploration || 0);
  }
}
const roundNames = { 1: '大一', 2: '大二', 3: '大三', 4: '大四' };
for (const [r, s] of Object.entries(byRound).sort((a, b) => a[0] - b[0])) {
  if (parseInt(r) === 0) continue;
  const name = roundNames[r] || `第${r}年`;
  const avgM = (s.money.reduce((a, b) => a + b, 0) / s.money.length).toFixed(0);
  const avgG = (s.gpa.reduce((a, b) => a + b, 0) / s.gpa.length).toFixed(2);
  const avgE = (s.explore.reduce((a, b) => a + b, 0) / s.explore.length).toFixed(1);
  console.log(`${name}结束(${s.count}局): 平均金钱${avgM}, GPA${avgG}, 探索${avgE}`);
}

// 14. Freshman buff impact analysis
console.log('\n--- 14. 大一Buff影响分析 ---');
const gamesEndingY1 = games.filter(g => g.totalRounds === 1);
const gamesEndingY2Plus = games.filter(g => (g.totalRounds || 0) >= 2);
console.log(`大一结束的局数: ${gamesEndingY1.length}`);
console.log(`大二+结束的局数: ${gamesEndingY2Plus.length}`);
if (gamesEndingY1.length > 0) {
  const y1Players = gamesEndingY1.flatMap(g => g.players);
  const avgGpa = (y1Players.reduce((s, p) => s + (p.finalGpa || 0), 0) / y1Players.length).toFixed(2);
  const avgMoney = (y1Players.reduce((s, p) => s + (p.finalMoney || 0), 0) / y1Players.length).toFixed(0);
  const avgExplore = (y1Players.reduce((s, p) => s + (p.finalExploration || 0), 0) / y1Players.length).toFixed(1);
  console.log(`大一结束时平均: GPA=${avgGpa}, 金钱=${avgMoney}, 探索=${avgExplore}`);
}

console.log('\n=== 分析完成 ===');
