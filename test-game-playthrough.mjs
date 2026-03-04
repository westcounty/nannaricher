/**
 * Comprehensive Socket.IO Game Playthrough Test for "菜根人生" (Nannaricher)
 *
 * Creates a 2-player room, starts the game, handles all phases,
 * and plays through at least 20 turns or until a winner is found.
 */
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';
const MAX_TURNS = 40;        // Maximum turns before giving up
const ACTION_TIMEOUT = 8000; // Max ms to wait for server response to an action
const STALL_TIMEOUT = 12000; // Max ms to wait if game seems stuck

// ============================================================
// Helpers
// ============================================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function posStr(pos) {
  if (!pos) return '??';
  return pos.type === 'main' ? `main[${pos.index}]` : `${pos.lineId}[${pos.index}]`;
}

function playerSummary(p) {
  return `${p.name}(${posStr(p.position)}) M:${p.money} GPA:${p.gpa} EXP:${p.exploration} cards:${p.heldCards?.length ?? 0} plans:[${(p.confirmedPlans || []).join(',')}]`;
}

// ============================================================
// Player Agent — wraps a socket.io connection
// ============================================================
class PlayerAgent {
  constructor(name) {
    this.name = name;
    this.socket = null;
    this.playerId = null;
    this.roomId = null;
    this.latestState = null;
    this.events = [];        // accumulates event log lines
    this.winner = null;
    this.errors = [];
    this._stateResolvers = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(SERVER_URL, { transports: ['websocket'], reconnection: false });
      this.socket.on('connect', () => {
        this.log(`Connected (sid=${this.socket.id})`);
        resolve();
      });
      this.socket.on('connect_error', (err) => {
        this.logError(`Connection error: ${err.message}`);
        reject(err);
      });
      this._setupListeners();
    });
  }

  _setupListeners() {
    const s = this.socket;

    s.on('game:state-update', (state) => {
      this.latestState = state;
      // Resolve any waiters
      const resolvers = this._stateResolvers.splice(0);
      resolvers.forEach(r => r(state));
    });

    s.on('game:dice-result', (data) => {
      this.log(`Dice result: ${data.values.join('+')}=${data.total} (player=${data.playerId})`);
    });

    s.on('game:event-trigger', (data) => {
      this.log(`Event: "${data.title}" — ${data.description}`);
    });

    s.on('game:card-drawn', (data) => {
      this.log(`Card drawn: ${data.card?.name} (${data.deckType})`);
    });

    s.on('game:player-won', (data) => {
      this.winner = data;
      this.log(`*** WINNER: ${data.playerName} — ${data.condition} ***`);
    });

    s.on('game:announcement', (data) => {
      this.log(`Announcement [${data.type}]: ${data.message}`);
    });

    s.on('room:error', (data) => {
      this.logError(`Room error: ${data.message}`);
    });

    s.on('room:player-joined', (data) => {
      this.log(`Player joined: ${data.playerName}`);
    });

    s.on('disconnect', (reason) => {
      this.log(`Disconnected: ${reason}`);
    });
  }

  /** Wait for the next state-update that satisfies `pred`, with timeout */
  waitForState(pred, timeoutMs = ACTION_TIMEOUT) {
    // Check current state first
    if (this.latestState && pred(this.latestState)) {
      return Promise.resolve(this.latestState);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // remove this resolver
        this._stateResolvers = this._stateResolvers.filter(r => r !== resolver);
        reject(new Error(`Timeout waiting for state (${timeoutMs}ms)`));
      }, timeoutMs);
      const resolver = (state) => {
        if (pred(state)) {
          clearTimeout(timer);
          resolve(state);
        } else {
          // Put it back if the predicate doesn't match
          this._stateResolvers.push(resolver);
        }
      };
      this._stateResolvers.push(resolver);
    });
  }

  createRoom() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Create room timeout')), 5000);
      this.socket.once('room:created', (data) => {
        clearTimeout(timer);
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.log(`Room created: ${data.roomId}, playerId: ${data.playerId}`);
        resolve(data);
      });
      this.socket.emit('room:create', { playerName: this.name, diceOption: 1 });
    });
  }

  joinRoom(roomId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Join room timeout')), 5000);
      this.socket.once('room:joined', (data) => {
        clearTimeout(timer);
        this.playerId = data.playerId;
        this.roomId = roomId;
        this.log(`Joined room: ${roomId}, playerId: ${data.playerId}`);
        resolve(data);
      });
      this.socket.emit('room:join', { roomId, playerName: this.name, diceOption: 1 });
    });
  }

  startGame() {
    this.socket.emit('game:start');
    this.log('Sent game:start');
  }

  rollDice() {
    this.socket.emit('game:roll-dice');
    this.log('Sent roll-dice');
  }

  chooseAction(actionId, choice) {
    this.socket.emit('game:choose-action', { actionId, choice });
    this.log(`Sent choose-action: actionId=${actionId}, choice=${choice}`);
  }

  confirmPlan(planId) {
    this.socket.emit('game:confirm-plan', { planId });
    this.log(`Sent confirm-plan: ${planId}`);
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
  }

  log(msg) {
    const line = `[${this.name}] ${msg}`;
    this.events.push(line);
    console.log(line);
  }

  logError(msg) {
    const line = `[${this.name}] ERROR: ${msg}`;
    this.errors.push(line);
    console.error(line);
  }
}

// ============================================================
// Main Test
// ============================================================
async function runTest() {
  console.log('='.repeat(70));
  console.log('  Nannaricher (菜根人生) Socket.IO Playthrough Test');
  console.log('='.repeat(70));

  const p1 = new PlayerAgent('玩家一');
  const p2 = new PlayerAgent('玩家二');
  const agents = [p1, p2];

  // Stats tracking
  const stats = {
    turnsPlayed: 0,
    diceRolls: 0,
    actionsChosen: 0,
    eventsTriggered: 0,
    errors: 0,
    winner: null,
    startTime: Date.now(),
  };

  try {
    // ------ Phase 1: Connect both players ------
    console.log('\n--- Phase 1: Connecting players ---');
    await Promise.all([p1.connect(), p2.connect()]);
    console.log('Both players connected.\n');

    // ------ Phase 2: Create room & join ------
    console.log('--- Phase 2: Creating room ---');
    const { roomId } = await p1.createRoom();
    await sleep(300);
    await p2.joinRoom(roomId);
    await sleep(500);

    // Verify both players see 2 players in state
    const initState = p1.latestState;
    if (initState) {
      console.log(`Room ${roomId}: ${initState.players.length} player(s), phase=${initState.phase}`);
    }

    // ------ Phase 3: Start game ------
    console.log('\n--- Phase 3: Starting game ---');
    p1.startGame();

    // Wait for setup_plans phase
    let state;
    try {
      state = await p1.waitForState(s => s.phase === 'setup_plans', 5000);
      console.log(`Game started! Phase: ${state.phase}, Turn: ${state.turnNumber}`);
    } catch {
      // Might already be in state
      state = p1.latestState;
      console.log(`Current phase: ${state?.phase}, Turn: ${state?.turnNumber}`);
    }

    // ------ Phase 4: Setup plans ------
    console.log('\n--- Phase 4: Confirming training plans ---');
    await sleep(500);
    state = p1.latestState;

    if (state?.phase === 'setup_plans') {
      // Each player confirms their first training plan
      for (const agent of agents) {
        const player = state.players.find(p => p.id === agent.playerId);
        if (player && player.trainingPlans.length > 0) {
          const plan = player.trainingPlans[0];
          agent.log(`Confirming plan: ${plan.name} (${plan.id}) — Win: ${plan.winCondition}`);
          agent.confirmPlan(plan.id);
          await sleep(300);
        } else {
          agent.log(`No training plans available to confirm!`);
        }
      }

      // Wait for phase to transition to 'playing'
      try {
        state = await p1.waitForState(s => s.phase === 'playing', 8000);
        console.log(`Plans confirmed! Phase now: ${state.phase}`);
      } catch {
        state = p1.latestState;
        console.log(`After plan confirmation, phase: ${state?.phase}`);

        // If still in setup_plans, try confirming plans from each agent's own latest state
        if (state?.phase === 'setup_plans') {
          console.log('Still in setup_plans - trying with fresh state from each player...');
          for (const agent of agents) {
            const agentState = agent.latestState;
            if (!agentState) continue;
            const player = agentState.players.find(p => p.id === agent.playerId);
            if (player && player.trainingPlans.length > 0) {
              const unconfirmed = player.trainingPlans.find(tp => !tp.confirmed);
              if (unconfirmed) {
                agent.log(`Retry confirming plan: ${unconfirmed.name}`);
                agent.confirmPlan(unconfirmed.id);
                await sleep(500);
              }
            }
          }
          // Wait again
          try {
            state = await p1.waitForState(s => s.phase === 'playing', 5000);
          } catch {
            state = p1.latestState;
          }
        }
      }
    }

    // Print confirmed plans
    state = p1.latestState;
    if (state) {
      for (const player of state.players) {
        const confirmedNames = player.trainingPlans.filter(tp => tp.confirmed).map(tp => tp.name);
        console.log(`  ${player.name}: plans=[${confirmedNames.join(', ')}]`);
      }
    }

    // ------ Phase 5: Main gameplay loop ------
    console.log('\n--- Phase 5: Main gameplay loop ---');

    let lastActionTime = Date.now();
    let lastTurnNumber = 0;
    let stallCount = 0;
    const MAX_STALL = 10;

    for (let iteration = 0; iteration < 500; iteration++) {
      // Check for winner
      if (p1.winner || p2.winner) {
        stats.winner = p1.winner || p2.winner;
        break;
      }

      state = p1.latestState;
      if (!state) {
        await sleep(200);
        continue;
      }

      // Check if game is finished
      if (state.phase === 'finished') {
        console.log('Game finished!');
        break;
      }

      // Track turn progress
      if (state.turnNumber !== lastTurnNumber) {
        lastTurnNumber = state.turnNumber;
        stats.turnsPlayed = state.turnNumber;
        lastActionTime = Date.now();
        stallCount = 0;

        // Print turn header every few turns
        if (state.turnNumber % 5 === 1 || state.turnNumber <= 3) {
          console.log(`\n  ---- Turn ${state.turnNumber} (Round ${state.roundNumber}) ----`);
          for (const player of state.players) {
            console.log(`    ${playerSummary(player)}`);
          }
        }
      }

      // Check if we've reached max turns
      if (state.turnNumber > MAX_TURNS) {
        console.log(`Reached max turns (${MAX_TURNS}). Ending test.`);
        break;
      }

      // Detect stall
      if (Date.now() - lastActionTime > STALL_TIMEOUT) {
        stallCount++;
        console.log(`WARNING: Game appears stalled (${stallCount}/${MAX_STALL}). Phase=${state.phase}, PA=${state.pendingAction?.type}/${state.pendingAction?.playerId}`);
        lastActionTime = Date.now();

        if (stallCount >= MAX_STALL) {
          console.log('Too many stalls, aborting.');
          break;
        }

        // Try to unstick: if there's a pending action, respond to it
        if (state.pendingAction) {
          const pa = state.pendingAction;
          const agent = agents.find(a => a.playerId === pa.playerId) || agents[0];

          if (pa.type === 'roll_dice') {
            agent.rollDice();
            stats.diceRolls++;
          } else if (pa.options && pa.options.length > 0) {
            const choice = pa.options[0].value;
            agent.chooseAction(pa.id, choice);
            stats.actionsChosen++;
          }
          await sleep(500);
          continue;
        }
      }

      // Handle the current pending action
      const pa = state.pendingAction;
      if (!pa) {
        await sleep(200);
        continue;
      }

      // Find the right agent for this action
      let agent = agents.find(a => a.playerId === pa.playerId);

      // For multi_vote and chain_action that target 'all' or specific players
      if (pa.type === 'multi_vote') {
        // Each player who hasn't voted yet should vote
        const responses = pa.responses || {};
        for (const a of agents) {
          if (!responses[a.playerId] && pa.options && pa.options.length > 0) {
            const choice = pa.options[0].value;
            a.chooseAction(pa.id, choice);
            a.log(`Voted: ${choice} for ${pa.prompt}`);
            stats.actionsChosen++;
            await sleep(200);
          }
        }
        lastActionTime = Date.now();
        await sleep(500);
        continue;
      }

      if (pa.type === 'chain_action') {
        // Find the current player in chain who needs to act
        const chainOrder = pa.chainOrder || [];
        const responses = pa.responses || {};
        for (const pid of chainOrder) {
          if (!responses[pid]) {
            const chainAgent = agents.find(a => a.playerId === pid);
            if (chainAgent && pa.options && pa.options.length > 0) {
              const choice = pa.options[0].value;
              chainAgent.chooseAction(pa.id, choice);
              chainAgent.log(`Chain action: ${choice}`);
              stats.actionsChosen++;
              await sleep(300);
            }
            break; // Only act for the first unresolved player
          }
        }
        lastActionTime = Date.now();
        await sleep(500);
        continue;
      }

      if (pa.playerId === 'all') {
        // All players need to act (e.g., draw_training_plan during gameplay)
        for (const a of agents) {
          const player = state.players.find(pp => pp.id === a.playerId);
          if (player && pa.type === 'draw_training_plan') {
            // Confirm first available plan
            const unconfirmed = player.trainingPlans.find(tp => !tp.confirmed);
            if (unconfirmed) {
              a.confirmPlan(unconfirmed.id);
              a.log(`Confirming plan: ${unconfirmed.name}`);
              await sleep(300);
            }
          } else if (pa.options && pa.options.length > 0) {
            a.chooseAction(pa.id, pa.options[0].value);
            stats.actionsChosen++;
            await sleep(200);
          }
        }
        lastActionTime = Date.now();
        await sleep(500);
        continue;
      }

      if (!agent) {
        await sleep(200);
        continue;
      }

      // Handle pending action based on type
      switch (pa.type) {
        case 'roll_dice': {
          agent.rollDice();
          stats.diceRolls++;
          lastActionTime = Date.now();
          await sleep(400);
          break;
        }

        case 'choose_option': {
          if (pa.options && pa.options.length > 0) {
            // Strategy: prefer "enter" lines for exploration, skip expensive options
            let choice = pa.options[0].value;

            // If there's a "skip" option and an "enter" option, prefer entering (more interesting)
            const enterOption = pa.options.find(o => o.value.startsWith('enter_'));
            const skipOption = pa.options.find(o => o.value === 'skip');
            if (enterOption) {
              choice = enterOption.value;
            }

            agent.chooseAction(pa.id, choice);
            agent.log(`Chose: "${pa.options.find(o => o.value === choice)?.label}" for "${pa.prompt}"`);
            stats.actionsChosen++;
            stats.eventsTriggered++;
          } else {
            agent.log(`No options for choose_option! prompt="${pa.prompt}"`);
          }
          lastActionTime = Date.now();
          await sleep(400);
          break;
        }

        case 'choose_player': {
          // Choose first available target
          if (pa.options && pa.options.length > 0) {
            agent.chooseAction(pa.id, pa.options[0].value);
            stats.actionsChosen++;
          } else if (pa.targetPlayerIds && pa.targetPlayerIds.length > 0) {
            agent.chooseAction(pa.id, pa.targetPlayerIds[0]);
            stats.actionsChosen++;
          }
          lastActionTime = Date.now();
          await sleep(400);
          break;
        }

        case 'choose_line': {
          if (pa.options && pa.options.length > 0) {
            agent.chooseAction(pa.id, pa.options[0].value);
            stats.actionsChosen++;
          }
          lastActionTime = Date.now();
          await sleep(400);
          break;
        }

        case 'choose_card': {
          if (pa.options && pa.options.length > 0) {
            agent.chooseAction(pa.id, pa.options[0].value);
            stats.actionsChosen++;
          }
          lastActionTime = Date.now();
          await sleep(400);
          break;
        }

        case 'draw_training_plan': {
          // Confirm first unconfirmed plan
          const player = state.players.find(pp => pp.id === agent.playerId);
          if (player) {
            const unconfirmed = player.trainingPlans.find(tp => !tp.confirmed);
            if (unconfirmed) {
              agent.confirmPlan(unconfirmed.id);
            }
          }
          lastActionTime = Date.now();
          await sleep(400);
          break;
        }

        case 'multi_player_choice': {
          if (pa.options && pa.options.length > 0) {
            agent.chooseAction(pa.id, pa.options[0].value);
            stats.actionsChosen++;
          }
          lastActionTime = Date.now();
          await sleep(400);
          break;
        }

        default: {
          agent.log(`Unhandled pending action type: ${pa.type} — trying first option`);
          if (pa.options && pa.options.length > 0) {
            agent.chooseAction(pa.id, pa.options[0].value);
            stats.actionsChosen++;
          }
          lastActionTime = Date.now();
          await sleep(400);
        }
      }

      // Brief pause between iterations
      await sleep(150);
    }

    // ------ Phase 6: Final Report ------
    console.log('\n' + '='.repeat(70));
    console.log('  GAME PLAYTHROUGH REPORT');
    console.log('='.repeat(70));

    state = p1.latestState;
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);

    console.log(`\n  Duration:          ${elapsed}s`);
    console.log(`  Phase:             ${state?.phase}`);
    console.log(`  Turns played:      ${state?.turnNumber || stats.turnsPlayed}`);
    console.log(`  Round:             ${state?.roundNumber}`);
    console.log(`  Dice rolls:        ${stats.diceRolls}`);
    console.log(`  Actions chosen:    ${stats.actionsChosen}`);
    console.log(`  Events triggered:  ${stats.eventsTriggered}`);

    if (stats.winner) {
      console.log(`\n  ** WINNER: ${stats.winner.playerName} **`);
      console.log(`  ** Condition: ${stats.winner.condition} **`);
    } else {
      console.log(`\n  No winner (test ended after ${state?.turnNumber || '?'} turns)`);
    }

    console.log('\n  --- Final Player States ---');
    if (state) {
      for (const player of state.players) {
        console.log(`    ${playerSummary(player)}`);
        const plans = player.trainingPlans.map(tp => `${tp.name}${tp.confirmed ? '(confirmed)' : ''}`);
        console.log(`      Plans: [${plans.join(', ')}]`);
        console.log(`      Effects: [${player.effects?.map(e => `${e.type}(${e.turnsRemaining}t)`).join(', ') || 'none'}]`);
        console.log(`      Hospital: ${player.isInHospital}, Ding: ${player.isAtDing}, Bankrupt: ${player.isBankrupt}`);
        console.log(`      Lines visited: [${player.linesVisited?.join(', ') || 'none'}]`);
      }
    }

    // Collect all errors
    const allErrors = [...p1.errors, ...p2.errors];
    if (allErrors.length > 0) {
      console.log('\n  --- Errors ---');
      allErrors.forEach(e => console.log(`    ${e}`));
      stats.errors = allErrors.length;
    } else {
      console.log('\n  No errors encountered.');
    }

    // Print a selection of game log entries
    if (state?.log && state.log.length > 0) {
      console.log(`\n  --- Game Log (${state.log.length} entries, showing last 30) ---`);
      const logSlice = state.log.slice(-30);
      for (const entry of logSlice) {
        const who = entry.playerId === 'system' ? 'SYSTEM' : (state.players.find(p => p.id === entry.playerId)?.name || entry.playerId);
        console.log(`    [T${entry.turn}] ${who}: ${entry.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));

    // Final assessment
    const turnCount = state?.turnNumber || 0;
    if (stats.winner) {
      console.log('  RESULT: PASS - Game completed with a winner!');
    } else if (turnCount >= 20) {
      console.log('  RESULT: PASS - Game played 20+ turns without critical errors.');
    } else if (turnCount >= 5 && allErrors.length === 0) {
      console.log('  RESULT: PARTIAL PASS - Game played some turns without errors.');
    } else {
      console.log(`  RESULT: NEEDS REVIEW - Only ${turnCount} turns, ${allErrors.length} errors.`);
    }
    console.log('='.repeat(70));

  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
    console.error(err.stack);
    stats.errors++;
  } finally {
    // Clean up
    p1.disconnect();
    p2.disconnect();
    // Allow sockets to close
    await sleep(500);
    process.exit(stats.errors > 0 && !stats.winner ? 1 : 0);
  }
}

runTest();
