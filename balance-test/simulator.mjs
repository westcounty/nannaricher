/**
 * Balance Testing Simulator for 菜根人生 (Nannaricher)
 *
 * Runs batch game simulations via Socket.IO against the real server.
 * Adaptive game count: runs until statistical confidence is achieved.
 *
 * Updated for the new training plan system:
 * - No more setup_plans phase (game starts directly in playing)
 * - No more game:confirm-plan event
 * - Plans use majorPlan/minorPlans instead of confirmedPlans
 * - Yearly plan selection happens via choose_option PendingActions
 *
 * Usage: node balance-test/simulator.mjs [options]
 *   --server=URL      Server URL (default: http://localhost:3001)
 *   --min-games=N     Minimum games to run (default: 500)
 *   --max-games=N     Maximum games to run (default: 5000)
 *   --concurrency=N   Concurrent games (default: 8)
 *   --batch-size=N    Games per batch (default: 50)
 *   --players=N       Fixed player count (default: varies 2-6)
 *   --dice=N          Dice option 1 or 2 (default: 1)
 *   --output=PATH     Output file (default: balance-test/report/raw-data.json)
 */

import { io } from 'socket.io-client';
import { createStrategy, randomStrategyName, STRATEGY_NAMES } from './strategies.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ============================================================
// Config
// ============================================================
const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=');
    return [k, v ?? 'true'];
  })
);

const CONFIG = {
  serverUrl: args.server || 'http://localhost:3001',
  minGames: parseInt(args['min-games']) || 500,
  maxGames: parseInt(args['max-games']) || 5000,
  concurrency: parseInt(args.concurrency) || 8,
  batchSize: parseInt(args['batch-size']) || 50,
  fixedPlayers: args.players ? parseInt(args.players) : null,
  diceOption: parseInt(args.dice) || 1,
  outputPath: args.output || 'balance-test/report/raw-data.json',
  gameTimeoutMs: 180_000,  // 3 min max per game
  actionTimeoutMs: 10_000, // 10s max wait for state update
  actionDelayMs: 30,       // brief delay between actions
};

// ============================================================
// Helper: extract player plan info from new data model
// ============================================================
function getPlayerPlanNames(player) {
  const names = [];
  if (player.majorPlan) {
    const plan = (player.trainingPlans || []).find(tp => tp.id === player.majorPlan);
    if (plan) names.push(plan.name);
  }
  for (const minorId of (player.minorPlans || [])) {
    const plan = (player.trainingPlans || []).find(tp => tp.id === minorId);
    if (plan) names.push(plan.name);
  }
  return names;
}

function getPlayerPlanIds(player) {
  const ids = [];
  if (player.majorPlan) ids.push(player.majorPlan);
  ids.push(...(player.minorPlans || []));
  return ids;
}

function getMajorPlanName(player) {
  if (!player.majorPlan) return null;
  const plan = (player.trainingPlans || []).find(tp => tp.id === player.majorPlan);
  return plan ? plan.name : null;
}

// ============================================================
// PlayerAgent
// ============================================================
class PlayerAgent {
  constructor(name, strategy, serverUrl) {
    this.name = name;
    this.strategy = strategy;
    this.socket = null;
    this.playerId = null;
    this.roomId = null;
    this.latestState = null;
    this.winner = null;
    this.errors = [];
    this._stateResolvers = [];
    // Detailed event tracking
    this.resourceChanges = [];  // { turn, round, stat, delta, current, playerId }
    this.eventsTriggers = [];   // { turn, round, title, description, playerId }
    this.cardsDrawn = [];       // { turn, round, deckType, cardName }
    this.roundSnapshots = {};   // { [round]: { money, gpa, exploration } } - end of round values
    // New: enhanced telemetry
    this.planAbilityTriggers = [];  // { turn, round, planId, planName, trigger, message, effects }
    this.lineExitSummaries = [];    // { turn, round, lineId, lineName, entryTurn, exitTurn, deltas }
    this.diceResults = [];          // { playerId, values, total }
    this.voteResults = [];          // { cardId, results, winnerOption, turn, round }
    this.chainResults = [];         // { cardId, chainLength, participants, turn, round }
    this.cardsUsed = [];            // { turn, round, cardId, cardName, targetPlayerId }
    this.hospitalEntries = 0;
    this.bankruptOccurrences = 0;
    this._prevInHospital = false;
    this._prevBankrupt = false;
    this._cardUseCooldown = 0;      // prevent rapid-fire card usage
  }

  connect(serverUrl) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connect timeout')), 10_000);
      this.socket = io(serverUrl, { transports: ['websocket'], reconnection: false });
      this.socket.on('connect', () => { clearTimeout(timer); resolve(); });
      this.socket.on('connect_error', (e) => { clearTimeout(timer); reject(e); });
      this._setupListeners();
    });
  }

  _setupListeners() {
    const s = this.socket;
    s.on('game:state-update', (state) => {
      this.latestState = state;
      // Track round snapshots for per-year resource progression
      if (state.roundNumber && state.players) {
        const me = state.players.find(p => p.id === this.playerId);
        if (me) {
          this.roundSnapshots[state.roundNumber] = {
            money: me.money, gpa: me.gpa, exploration: me.exploration,
            turn: state.turnNumber,
          };
          // Track hospital/bankrupt state transitions
          if (me.isInHospital && !this._prevInHospital) this.hospitalEntries++;
          this._prevInHospital = !!me.isInHospital;
          if (me.isBankrupt && !this._prevBankrupt) this.bankruptOccurrences++;
          this._prevBankrupt = !!me.isBankrupt;
        }
      }
      const resolvers = this._stateResolvers.splice(0);
      resolvers.forEach(r => r(state));
    });
    s.on('game:resource-change', (data) => {
      const round = this.latestState?.roundNumber || 0;
      const turn = this.latestState?.turnNumber || 0;
      this.resourceChanges.push({ turn, round, ...data });
    });
    s.on('game:event-trigger', (data) => {
      const round = this.latestState?.roundNumber || 0;
      const turn = this.latestState?.turnNumber || 0;
      this.eventsTriggers.push({ turn, round, title: data.title, description: data.description, playerId: data.playerId });
    });
    s.on('game:card-drawn', (data) => {
      const round = this.latestState?.roundNumber || 0;
      const turn = this.latestState?.turnNumber || 0;
      this.cardsDrawn.push({ turn, round, deckType: data.deckType, cardName: data.card?.name || 'unknown' });
    });
    s.on('game:dice-result', (data) => {
      this.diceResults.push({ playerId: data.playerId, values: data.values, total: data.total });
    });
    s.on('game:plan-ability-trigger', (data) => {
      this.planAbilityTriggers.push(data);
    });
    s.on('game:line-exit-summary', (data) => {
      this.lineExitSummaries.push(data);
    });
    s.on('game:vote-result', (data) => {
      this.voteResults.push(data);
    });
    s.on('game:chain-result', (data) => {
      this.chainResults.push(data);
    });
    s.on('game:player-won', (data) => { this.winner = data; });
    s.on('game:card-use-error', (data) => { /* silently ignore card use errors */ });
    s.on('room:error', (data) => { this.errors.push(data.message); });
    s.on('disconnect', () => {});
  }

  waitForState(pred, timeoutMs = CONFIG.actionTimeoutMs) {
    if (this.latestState && pred(this.latestState)) return Promise.resolve(this.latestState);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._stateResolvers = this._stateResolvers.filter(r => r !== resolver);
        reject(new Error('State timeout'));
      }, timeoutMs);
      const resolver = (state) => {
        if (pred(state)) { clearTimeout(timer); resolve(state); }
        else this._stateResolvers.push(resolver);
      };
      this._stateResolvers.push(resolver);
    });
  }

  createRoom(diceOption) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Create room timeout')), 8000);
      this.socket.once('room:created', (data) => {
        clearTimeout(timer);
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        resolve(data);
      });
      this.socket.emit('room:create', { playerName: this.name, diceOption });
    });
  }

  joinRoom(roomId, diceOption) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Join room timeout')), 20000);
      this.socket.once('room:joined', (data) => {
        clearTimeout(timer);
        this.playerId = data.playerId;
        this.roomId = roomId;
        resolve(data);
      });
      this.socket.emit('room:join', { roomId, playerName: this.name, diceOption });
    });
  }

  startGame() { this.socket.emit('game:start'); }
  rollDice() { this.socket.emit('game:roll-dice'); }
  chooseAction(actionId, choice) { this.socket.emit('game:choose-action', { actionId, choice }); }
  useCard(cardId, targetPlayerId) {
    this.socket.emit('game:use-card', { cardId, targetPlayerId });
    const round = this.latestState?.roundNumber || 0;
    const turn = this.latestState?.turnNumber || 0;
    const card = this.latestState?.players?.find(p => p.id === this.playerId)
      ?.heldCards?.find(c => c.id === cardId);
    this.cardsUsed.push({ turn, round, cardId, cardName: card?.name || cardId, targetPlayerId });
  }
  disconnect() { if (this.socket) this.socket.disconnect(); }
}

// ============================================================
// Single Game Runner
// ============================================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function playOneGame(gameId, playerCount, diceOption, strategyNames) {
  const agents = [];
  for (let i = 0; i < playerCount; i++) {
    const strat = createStrategy(strategyNames[i]);
    agents.push(new PlayerAgent(`P${i + 1}`, strat, CONFIG.serverUrl));
  }

  const startTime = Date.now();
  let result = null;

  try {
    // Connect
    await Promise.all(agents.map(a => a.connect(CONFIG.serverUrl)));

    // Create room & join (stagger joins, longer delays for bigger games)
    const { roomId } = await agents[0].createRoom(diceOption);
    const joinDelay = playerCount >= 5 ? 600 : 200;
    for (let i = 1; i < agents.length; i++) {
      await agents[i].joinRoom(roomId, diceOption);
      await sleep(joinDelay);
    }
    await sleep(500);

    // Start game — goes directly to 'playing' phase (no setup_plans)
    agents[0].startGame();

    // Wait for playing phase
    try {
      await agents[0].waitForState(s => s.phase === 'playing' || s.phase === 'rolling_dice' || s.phase === 'making_choice', 10_000);
    } catch { /* proceed anyway */ }

    await sleep(200);

    // Main game loop - simple poll-based approach for reliability
    let lastActionId = '';
    let lastResponseCount = 0;
    let stallCount = 0;
    const maxIter = 5000;

    for (let iter = 0; iter < maxIter; iter++) {
      // Check end conditions
      if (agents.some(a => a.winner)) break;

      // Use freshest state from any agent
      let state = agents[0].latestState;
      for (const a of agents) {
        if (a.latestState?.turnNumber > (state?.turnNumber || 0)) {
          state = a.latestState;
        }
      }
      if (!state) { await sleep(100); continue; }
      if (state.phase === 'finished') break;

      // Game timeout
      if (Date.now() - startTime > CONFIG.gameTimeoutMs) break;

      // Proactive card usage: check if any agent wants to use held cards
      await tryUseCards(agents, state);

      const pa = state.pendingAction;
      if (!pa) { await sleep(80); continue; }

      // Track progress for multi-step actions (multi_vote, chain_action)
      const responseCount = pa.responses ? Object.keys(pa.responses).length : 0;

      if (pa.id === lastActionId) {
        if (responseCount > lastResponseCount) {
          // Progress was made on a multi-step action — not stalled
          lastResponseCount = responseCount;
          stallCount = 0;
        } else {
          stallCount++;
        }

        if (stallCount > 300) {
          // Record what caused the stall for diagnostics
          agents[0].errors.push(`STALL on ${pa.type} (id=${pa.id}, playerId=${pa.playerId}, responses=${JSON.stringify(pa.responses||{})}, options=${pa.options?.length||0}, turn=${state.turnNumber})`);
          break;
        }

        // Retry action every 10 polls (~1 second)
        if (stallCount % 10 === 0) {
          await handlePendingAction(agents, state, pa);
          await sleep(150);
        } else {
          await sleep(100);
        }
        continue;
      }

      lastActionId = pa.id;
      lastResponseCount = responseCount;
      stallCount = 0;

      // Handle pending action and give server time to process
      await handlePendingAction(agents, state, pa);
      await sleep(200); // Wait for server to process and broadcast new state
    }

    // Collect results
    const finalState = agents[0].latestState;
    const winnerInfo = agents.find(a => a.winner)?.winner || null;

    result = {
      gameId,
      config: { playerCount, diceOption, strategyNames },
      totalTurns: finalState?.turnNumber || 0,
      totalRounds: finalState?.roundNumber || 0,
      duration: (Date.now() - startTime) / 1000,
      phase: finalState?.phase || 'unknown',
      winner: winnerInfo ? {
        playerName: winnerInfo.playerName,
        condition: winnerInfo.condition || 'unknown',
      } : null,
      players: (finalState?.players || []).map((p) => {
        const agent = agents.find(a => a.playerId === p.id);
        const planNames = getPlayerPlanNames(p);
        const planIds = getPlayerPlanIds(p);
        return {
          name: p.name,
          strategy: agent?.strategy?.name || 'unknown',
          majorPlan: getMajorPlanName(p),
          majorPlanId: p.majorPlan || null,
          minorPlans: (p.minorPlans || []).map(id => {
            const plan = (p.trainingPlans || []).find(tp => tp.id === id);
            return plan ? plan.name : id;
          }),
          minorPlanIds: p.minorPlans || [],
          allPlanNames: planNames,
          allPlanIds: planIds,
          planSlotLimit: p.planSlotLimit || 2,
          finalMoney: p.money,
          finalGpa: p.gpa,
          finalExploration: p.exploration,
          finalScore: p.gpa * 10 + p.exploration,
          isBankrupt: p.isBankrupt || false,
          isWinner: winnerInfo?.playerName === p.name,
          linesVisited: p.linesVisited || [],
          lineEventsTriggered: p.lineEventsTriggered || {},
          isInHospital: p.isInHospital || false,
          hospitalVisits: p.hospitalVisits || 0,
          diceCount: p.diceCount || 1,
          heldCards: p.heldCards?.length || 0,
          position: p.position || null,
          effects: (p.effects || []).map(e => e.type),
          // Per-round resource snapshots (end-of-round values)
          roundSnapshots: agent?.roundSnapshots || {},
          // Detailed resource change log
          resourceChanges: (agent?.resourceChanges || []).filter(rc => rc.playerId === p.id),
          // New: enhanced telemetry per player
          planAbilityTriggers: (agent?.planAbilityTriggers || []).filter(t => t.playerId === p.id),
          lineExitSummaries: (agent?.lineExitSummaries || []).filter(s => s.playerId === p.id),
          diceResults: (agent?.diceResults || []).filter(d => d.playerId === p.id),
          hospitalEntries: agent?.hospitalEntries || 0,
          bankruptOccurrences: agent?.bankruptOccurrences || 0,
          cardsUsed: agent?.cardsUsed || [],
          cardsUsedCount: agent?.cardsUsed?.length || 0,
        };
      }),
      // Aggregate event and card data for the whole game
      events: agents.flatMap(a => a.eventsTriggers),
      cardsDrawn: agents.flatMap(a => a.cardsDrawn),
      // New: aggregate game-level telemetry (use only first agent to avoid broadcast duplication)
      allDiceResults: agents[0]?.diceResults || [],
      allPlanAbilityTriggers: agents[0]?.planAbilityTriggers || [],
      allLineExitSummaries: agents[0]?.lineExitSummaries || [],
      voteResults: agents[0]?.voteResults || [],
      chainResults: agents[0]?.chainResults || [],
      allCardsUsed: agents.flatMap(a => a.cardsUsed || []),
      errors: agents.flatMap(a => a.errors),
    };
  } catch (err) {
    result = {
      gameId,
      config: { playerCount, diceOption, strategyNames },
      error: err.message,
      duration: (Date.now() - startTime) / 1000,
      players: [],
    };
  } finally {
    agents.forEach(a => a.disconnect());
    await sleep(50);
  }

  return result;
}

async function tryUseCards(agents, state) {
  if (!state?.players || state.phase === 'finished') return;

  for (const agent of agents) {
    // Cooldown: don't spam card usage
    if (agent._cardUseCooldown > 0) { agent._cardUseCooldown--; continue; }

    const me = state.players.find(p => p.id === agent.playerId);
    if (!me || !me.heldCards || me.heldCards.length === 0) continue;

    const actions = agent.strategy.chooseCardsToUse(me.heldCards, state, agent.playerId);
    if (actions.length === 0) continue;

    // Use at most one card per iteration to avoid race conditions
    const action = actions[0];
    agent.useCard(action.cardId, action.targetPlayerId);
    agent._cardUseCooldown = 5; // Wait 5 iterations before trying again
    await sleep(150); // Let server process
  }
}

async function handlePendingAction(agents, state, pa) {
  const findAgent = (pid) => agents.find(a => a.playerId === pid);

  switch (pa.type) {
    case 'roll_dice': {
      const agent = findAgent(pa.playerId);
      if (agent) agent.rollDice();
      break;
    }

    case 'choose_option':
    case 'choose_line': {
      const agent = findAgent(pa.playerId);
      if (agent && pa.options?.length > 0) {
        const choice = agent.strategy.chooseOption(pa.options, state, pa, agent.playerId);
        agent.chooseAction(pa.id, choice || pa.options[0].value);
      }
      break;
    }

    case 'choose_player': {
      const agent = findAgent(pa.playerId);
      if (agent) {
        const targets = pa.targetPlayerIds || pa.options?.map(o => o.value) || [];
        if (targets.length > 0) {
          const target = agent.strategy.choosePlayer(targets, state, agent.playerId);
          agent.chooseAction(pa.id, target);
        } else if (pa.options?.length > 0) {
          agent.chooseAction(pa.id, pa.options[0].value);
        } else {
          // No targets available — pick any other player as fallback
          const otherPlayers = state.players?.filter(p => p.id !== agent.playerId) || [];
          if (otherPlayers.length > 0) {
            agent.chooseAction(pa.id, otherPlayers[0].id);
          } else {
            agent.chooseAction(pa.id, 'pass');
          }
        }
      }
      break;
    }

    case 'choose_card': {
      const agent = findAgent(pa.playerId);
      if (agent) {
        if (pa.options?.length > 0) {
          const choice = pa.options[Math.floor(Math.random() * pa.options.length)].value;
          agent.chooseAction(pa.id, choice);
        } else {
          agent.chooseAction(pa.id, 'pass');
        }
      }
      break;
    }

    case 'multi_vote': {
      const responses = pa.responses || {};
      const targetIds = pa.targetPlayerIds || [];
      let sentCount = 0;
      for (const agent of agents) {
        if (!responses[agent.playerId] && pa.options?.length > 0) {
          const choice = agent.strategy.chooseVote(pa.options, state, pa, agent.playerId);
          agent.chooseAction(pa.id, choice || pa.options[0].value);
          sentCount++;
          await sleep(50);
        }
      }
      // If all votes are already in but action not resolved, wait longer for server
      if (sentCount === 0 && Object.keys(responses).length >= targetIds.length) {
        await sleep(500);
      }
      break;
    }

    case 'chain_action': {
      const chainOrder = pa.chainOrder || [];
      const responses = pa.responses || {};
      for (const pid of chainOrder) {
        if (!responses[pid]) {
          const agent = findAgent(pid);
          if (agent && pa.options?.length > 0) {
            const choice = agent.strategy.chooseChain(pa.options, state, pa, agent.playerId);
            agent.chooseAction(pa.id, choice || 'pass');
          }
          break; // Only act for first unresolved
        }
      }
      break;
    }

    case 'draw_training_plan': {
      // Legacy handler — new system uses choose_option for plan selection
      // This handles any remaining draw_training_plan actions via choose_option fallback
      const agent = findAgent(pa.playerId);
      if (agent && pa.options?.length > 0) {
        const choice = agent.strategy.chooseOption(pa.options, state, pa, agent.playerId);
        agent.chooseAction(pa.id, choice || pa.options[0].value);
      }
      break;
    }

    case 'multi_player_choice':
    default: {
      const agent = findAgent(pa.playerId);
      if (agent && pa.options?.length > 0) {
        agent.chooseAction(pa.id, pa.options[0].value);
      } else if (pa.playerId === 'all') {
        for (const a of agents) {
          if (pa.options?.length > 0) {
            a.chooseAction(pa.id, pa.options[0].value);
            await sleep(30);
          }
        }
      }
    }
  }
}

// ============================================================
// Confidence check
// ============================================================
function wilsonInterval(successes, total, z = 1.96) {
  if (total === 0) return { lower: 0, upper: 1, center: 0, margin: 1 };
  const p = successes / total;
  const denom = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denom;
  const hw = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denom;
  return { lower: Math.max(0, center - hw), upper: Math.min(1, center + hw), center, margin: hw };
}

function checkConfidence(results) {
  // Count plan appearances and wins (using new majorPlan/minorPlans model)
  const planStats = {};
  for (const game of results) {
    if (!game.players) continue;
    for (const p of game.players) {
      for (const planName of (p.allPlanNames || [])) {
        if (!planStats[planName]) planStats[planName] = { total: 0, wins: 0 };
        planStats[planName].total++;
        if (p.isWinner) planStats[planName].wins++;
      }
    }
  }

  const plans = Object.entries(planStats);
  if (plans.length === 0) return { ready: false, reason: 'No plan data' };

  const minSamples = 50;
  const maxMargin = 0.08; // 8% margin

  let allReady = true;
  let worstPlan = null;
  let worstSamples = Infinity;

  for (const [name, stat] of plans) {
    if (stat.total < minSamples) {
      allReady = false;
      if (stat.total < worstSamples) { worstSamples = stat.total; worstPlan = name; }
    } else {
      const ci = wilsonInterval(stat.wins, stat.total);
      if (ci.margin > maxMargin) {
        allReady = false;
      }
    }
  }

  const totalPlans = plans.length;
  const readyPlans = plans.filter(([, s]) => s.total >= minSamples).length;

  return {
    ready: allReady && totalPlans >= 20, // At least 20 of 33 plans seen
    totalPlans,
    readyPlans,
    worstPlan,
    worstSamples,
    totalGames: results.length,
  };
}

// ============================================================
// Batch runner
// ============================================================
function getPlayerCount() {
  if (CONFIG.fixedPlayers) return CONFIG.fixedPlayers;
  // Weighted distribution: 2-6 player games
  const weights = [
    { count: 2, weight: 15 },
    { count: 3, weight: 25 },
    { count: 4, weight: 25 },
    { count: 5, weight: 20 },
    { count: 6, weight: 15 },
  ];
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.count;
  }
  return 4;
}

function assignStrategies(playerCount) {
  const strats = [];
  // Ensure at least one random strategy for baseline data
  strats.push('random');
  for (let i = 1; i < playerCount; i++) {
    strats.push(randomStrategyName());
  }
  // Shuffle
  for (let i = strats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [strats[i], strats[j]] = [strats[j], strats[i]];
  }
  return strats;
}

async function runBatch(batchNum, batchSize, allResults) {
  const startId = allResults.length + 1;
  const promises = [];
  let completed = 0;

  // Run games with concurrency limit
  const semaphore = { running: 0 };

  const runWithLimit = async (gameId) => {
    while (semaphore.running >= CONFIG.concurrency) {
      await sleep(100);
    }
    semaphore.running++;
    try {
      const pc = getPlayerCount();
      const strats = assignStrategies(pc);
      const result = await playOneGame(gameId, pc, CONFIG.diceOption, strats);
      completed++;
      return result;
    } finally {
      semaphore.running--;
    }
  };

  for (let i = 0; i < batchSize; i++) {
    promises.push(runWithLimit(startId + i));
  }

  const batchResults = await Promise.all(promises);

  // Progress reporting
  const wins = batchResults.filter(r => r.winner).length;
  const errors = batchResults.filter(r => r.error).length;
  const avgTurns = batchResults.filter(r => r.totalTurns).reduce((s, r) => s + r.totalTurns, 0)
    / (batchResults.filter(r => r.totalTurns).length || 1);

  console.log(
    `  Batch ${batchNum}: ${batchSize} games | ` +
    `${wins} wins (${(wins / batchSize * 100).toFixed(0)}%) | ` +
    `${errors} errors | ` +
    `avg ${avgTurns.toFixed(1)} turns | ` +
    `total: ${allResults.length + batchResults.length}`
  );

  return batchResults;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('='.repeat(60));
  console.log('  菜根人生 Balance Testing Simulator');
  console.log('='.repeat(60));
  console.log(`  Server:      ${CONFIG.serverUrl}`);
  console.log(`  Concurrency: ${CONFIG.concurrency}`);
  console.log(`  Min games:   ${CONFIG.minGames}`);
  console.log(`  Max games:   ${CONFIG.maxGames}`);
  console.log(`  Dice option: ${CONFIG.diceOption}`);
  console.log(`  Players:     ${CONFIG.fixedPlayers || '2-6 (varied)'}`);
  console.log('');

  // Verify server is reachable
  try {
    const testSocket = io(CONFIG.serverUrl, { transports: ['websocket'], reconnection: false, timeout: 5000 });
    await new Promise((resolve, reject) => {
      testSocket.on('connect', () => { testSocket.disconnect(); resolve(); });
      testSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Server not reachable')), 5000);
    });
    console.log('  Server connection verified.\n');
  } catch (err) {
    console.error(`  ERROR: Cannot connect to server at ${CONFIG.serverUrl}`);
    console.error('  Make sure the game server is running first.');
    process.exit(1);
  }

  const allResults = [];
  let batchNum = 0;
  const overallStart = Date.now();

  while (allResults.length < CONFIG.maxGames) {
    batchNum++;
    const remaining = CONFIG.maxGames - allResults.length;
    const batchSize = Math.min(CONFIG.batchSize, remaining);

    const batchResults = await runBatch(batchNum, batchSize, allResults);
    allResults.push(...batchResults);

    // Check confidence after minimum games
    if (allResults.length >= CONFIG.minGames) {
      const conf = checkConfidence(allResults.filter(r => !r.error));
      console.log(
        `  Confidence: ${conf.readyPlans}/${conf.totalPlans} plans ready | ` +
        `worst: "${conf.worstPlan}" (${conf.worstSamples} samples)`
      );

      if (conf.ready) {
        console.log('\n  Statistical confidence achieved!');
        break;
      }
    }

    // Save intermediate results every 5 batches
    if (batchNum % 5 === 0) {
      saveResults(allResults);
      console.log(`  [Intermediate save: ${allResults.length} games]`);
    }
  }

  const elapsed = ((Date.now() - overallStart) / 1000).toFixed(1);

  // Final save
  saveResults(allResults);

  // Print summary
  const validGames = allResults.filter(r => !r.error);
  const errorGames = allResults.filter(r => r.error);
  const winGames = validGames.filter(r => r.winner);

  console.log('\n' + '='.repeat(60));
  console.log('  SIMULATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Total games:     ${allResults.length}`);
  console.log(`  Valid games:     ${validGames.length}`);
  console.log(`  Error games:     ${errorGames.length}`);
  const earlyWins = winGames.filter(r => r.winner.condition !== '毕业结算');
  const graduationWins = winGames.filter(r => r.winner.condition === '毕业结算');
  console.log(`  Games with win:  ${winGames.length} (${(winGames.length / validGames.length * 100).toFixed(1)}%)`);
  console.log(`    Early wins:    ${earlyWins.length} (${(earlyWins.length / validGames.length * 100).toFixed(1)}%)`);
  console.log(`    Graduation:    ${graduationWins.length} (${(graduationWins.length / validGames.length * 100).toFixed(1)}%)`);
  const avgTurns = validGames.reduce((s, r) => s + (r.totalTurns || 0), 0) / validGames.length;
  console.log(`  Avg turns/game:  ${avgTurns.toFixed(1)}`);
  console.log(`  Duration:        ${elapsed}s`);
  console.log(`  Output:          ${CONFIG.outputPath}`);

  // Quick plan win rate preview (using new data model)
  const planStats = {};
  for (const game of validGames) {
    for (const p of game.players || []) {
      for (const planName of (p.allPlanNames || [])) {
        if (!planStats[planName]) planStats[planName] = { total: 0, wins: 0 };
        planStats[planName].total++;
        if (p.isWinner) planStats[planName].wins++;
      }
    }
  }

  // Card usage summary
  const totalCardsUsed = validGames.reduce((s, g) => s + (g.allCardsUsed?.length || 0), 0);
  console.log(`  Cards used:      ${totalCardsUsed} (avg ${(totalCardsUsed / validGames.length).toFixed(1)}/game)`);

  console.log('\n  Top 5 highest win-rate plans:');
  const ranked = Object.entries(planStats)
    .map(([name, s]) => ({ name, rate: s.wins / s.total, ...s }))
    .sort((a, b) => b.rate - a.rate);
  for (const p of ranked.slice(0, 5)) {
    console.log(`    ${p.name}: ${(p.rate * 100).toFixed(1)}% (${p.wins}/${p.total})`);
  }

  console.log('\n  Bottom 5 lowest win-rate plans:');
  for (const p of ranked.slice(-5).reverse()) {
    console.log(`    ${p.name}: ${(p.rate * 100).toFixed(1)}% (${p.wins}/${p.total})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Run "node balance-test/analyzer.mjs" to generate the full report.');
  console.log('='.repeat(60));

  process.exit(0);
}

function saveResults(results) {
  try {
    mkdirSync(dirname(CONFIG.outputPath), { recursive: true });
    writeFileSync(CONFIG.outputPath, JSON.stringify(results, null, 2));
  } catch (err) {
    console.error(`  Error saving results: ${err.message}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
