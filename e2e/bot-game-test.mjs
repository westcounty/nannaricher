/**
 * Bot Game E2E Test — Plays 20 complete games with 1 human + 5 bots.
 *
 * Tests that:
 * 1. Bots can be added to rooms
 * 2. Game starts and runs with bots
 * 3. Bots execute all actions (dice, choices, votes, chains, plan selection)
 * 4. Games complete with a winner
 * 5. Restart with bots works
 */
import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const TOTAL_GAMES = 20;
const MAX_WAIT_MS = 300_000; // 5 min max per game (bots have 0.8s delay each)

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================
// Player Agent
// ============================================================
class PlayerAgent {
  constructor(name) {
    this.name = name;
    this.socket = null;
    this.playerId = null;
    this.roomId = null;
    this.latestState = null;
    this.winner = null;
    this.errors = [];
    this._stateResolvers = [];
    this._wonResolvers = [];
    this._handledActionIds = new Set(); // dedup action handling
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: false,
        auth: { token: 'test-bot-e2e' },
      });
      this.socket.on('connect', () => resolve());
      this.socket.on('connect_error', (err) => reject(err));
      this._setupListeners();
    });
  }

  _setupListeners() {
    const s = this.socket;

    s.on('game:state-update', (state) => {
      this.latestState = state;

      // Handle pending actions for the human player
      if (state.pendingAction && state.pendingAction.playerId === this.playerId) {
        this._handleAction(state.pendingAction);
      }
      // Also handle multi-player actions where we need to respond
      if (state.pendingAction && state.pendingAction.type === 'multi_vote') {
        const responses = state.pendingAction.responses || {};
        if (this.playerId && !responses[this.playerId]) {
          this._handleAction(state.pendingAction);
        }
      }
      if (state.pendingAction && state.pendingAction.type === 'chain_action') {
        const chainOrder = state.pendingAction.chainOrder || [];
        const responses = state.pendingAction.responses || {};
        const nextInChain = chainOrder.find(pid => !responses[pid]);
        if (nextInChain === this.playerId) {
          this._handleAction(state.pendingAction);
        }
      }
      if (state.pendingAction && state.pendingAction.type === 'parallel_plan_selection') {
        const responses = state.pendingAction.responses || {};
        if (this.playerId && !responses[this.playerId]) {
          this._handleAction(state.pendingAction);
        }
      }

      // Resolve waiters
      const resolvers = this._stateResolvers.splice(0);
      resolvers.forEach(r => r(state));
    });

    s.on('game:player-won', (data) => {
      this.winner = data;
      const resolvers = this._wonResolvers.splice(0);
      resolvers.forEach(r => r(data));
    });

    s.on('room:error', (data) => {
      this.errors.push(data.message);
      console.log(`  [ERROR] ${data.message}`);
    });

    s.on('room:created', (data) => {
      this.playerId = data.playerId;
      this.roomId = data.roomId;
    });

    s.on('room:joined', (data) => {
      this.playerId = data.playerId;
      this.roomId = data.roomId;
    });

    s.on('game:event-trigger', (data) => {
      // Handle pending actions for the human player
      if (data.pendingAction && data.pendingAction.playerId === this.playerId) {
        this._handleAction(data.pendingAction);
      }
    });

    s.on('game:restarting', () => {
      this._handledActionIds.clear();
      this.winner = null;
    });
  }

  _handleAction(pa) {
    // Dedup: don't handle the same action twice
    const actionKey = `${pa.id}_${pa.type}_${this.playerId}`;
    if (this._handledActionIds.has(actionKey)) return;
    this._handledActionIds.add(actionKey);

    setTimeout(() => {
      if (!this.socket?.connected) return;

      if (pa.type === 'roll_dice') {
        this.socket.emit('game:roll-dice');
      } else if (pa.type === 'multi_vote') {
        const choice = pa.options?.[0]?.value || 'skip';
        this.socket.emit('game:choose-action', { actionId: pa.id, choice });
      } else if (pa.type === 'chain_action') {
        const choice = pa.options?.[0]?.value || 'skip';
        this.socket.emit('game:choose-action', { actionId: pa.id, choice });
      } else if (pa.type === 'parallel_plan_selection') {
        const response = JSON.stringify({ action: 'keep' });
        this.socket.emit('game:choose-action', { actionId: pa.id, choice: response });
      } else {
        const options = pa.options || [];
        const choice = options[Math.floor(Math.random() * options.length)]?.value || 'skip';
        this.socket.emit('game:choose-action', { actionId: pa.id, choice });
      }
    }, 150);
  }

  waitForState(predicate, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (this.latestState && predicate(this.latestState)) {
        return resolve(this.latestState);
      }

      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for state'));
      }, timeoutMs);

      const resolver = (state) => {
        if (predicate(state)) {
          clearTimeout(timer);
          resolve(state);
        } else {
          this._stateResolvers.push(resolver);
        }
      };
      this._stateResolvers.push(resolver);
    });
  }

  waitForWin(timeoutMs = MAX_WAIT_MS) {
    return new Promise((resolve, reject) => {
      if (this.winner) return resolve(this.winner);

      const timer = setTimeout(() => {
        reject(new Error(`Game did not finish within ${timeoutMs / 1000}s`));
      }, timeoutMs);

      this._wonResolvers.push((data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  reset() {
    this.winner = null;
    this.errors = [];
    this._stateResolvers = [];
    this._wonResolvers = [];
    this._handledActionIds.clear();
  }
}

// ============================================================
// Test Runner
// ============================================================
async function runTest() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Bot Game E2E Test — ${TOTAL_GAMES} games`);
  console.log(`Server: ${SERVER_URL}`);
  console.log(`${'='.repeat(60)}\n`);

  const results = {
    total: TOTAL_GAMES,
    completed: 0,
    failed: 0,
    botWins: 0,
    humanWins: 0,
    errors: [],
    gameTurns: [],
    gameTimesMs: [],
  };

  let host = new PlayerAgent('E2E测试员');
  let needNewRoom = true;

  try {
    await host.connect();
    console.log('Connected to server');
  } catch (err) {
    console.error('Failed to connect to server:', err.message);
    console.error('Make sure the server is running on', SERVER_URL);
    process.exit(1);
  }

  for (let gameNum = 1; gameNum <= TOTAL_GAMES; gameNum++) {
    const startTime = Date.now();
    console.log(`\n--- Game ${gameNum}/${TOTAL_GAMES} ---`);

    try {
      host.reset();

      if (needNewRoom) {
        // Create room and add bots
        host.socket.emit('room:create', { playerName: 'E2E测试员', diceOption: 1 });
        await sleep(800);

        if (!host.roomId) {
          throw new Error('Failed to create room');
        }
        console.log(`  Room created: ${host.roomId}`);

        // Add 5 bots one at a time
        for (let i = 0; i < 5; i++) {
          host.socket.emit('room:add-bot');
          await sleep(800); // Wait for async bot name generation
        }

        // Wait for state with 6 players
        try {
          await host.waitForState(s => s.players.length >= 6, 15000);
        } catch {
          // Check what we got
          const count = host.latestState?.players?.length || 0;
          console.log(`  Only ${count} players after adding bots, retrying...`);
          // Try adding more bots
          for (let i = count; i < 6; i++) {
            host.socket.emit('room:add-bot');
            await sleep(800);
          }
          await host.waitForState(s => s.players.length >= 6, 10000);
        }

        const players = host.latestState.players;
        console.log(`  Players (${players.length}): ${players.map(p => p.name + (p.isBot ? '' : ' (人类)')).join(', ')}`);

        // Start game
        host.socket.emit('game:start');
        needNewRoom = false;
      } else {
        // Restart with ready players (bots auto-ready)
        host.socket.emit('game:restart-with-ready');
      }

      await sleep(500);

      // Wait for game to be in playing phase
      await host.waitForState(s => s.phase === 'playing', 5000);
      console.log(`  Game started (turn ${host.latestState.turnNumber})`);

      // Wait for winner
      const winResult = await host.waitForWin(MAX_WAIT_MS);
      const elapsed = Date.now() - startTime;

      const winnerPlayer = host.latestState?.players.find(p => p.id === winResult.playerId);
      const isBot = winnerPlayer?.isBot || false;
      const turns = host.latestState?.turnNumber || 0;

      console.log(`  Winner: ${winResult.playerName}${isBot ? '' : ' (human)'}`);
      console.log(`  Condition: ${winResult.condition}`);
      console.log(`  Turns: ${turns}, Time: ${(elapsed / 1000).toFixed(1)}s`);

      results.completed++;
      results.gameTurns.push(turns);
      results.gameTimesMs.push(elapsed);
      if (isBot) results.botWins++;
      else results.humanWins++;

    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.error(`  FAILED: ${err.message} (${(elapsed / 1000).toFixed(1)}s)`);
      results.failed++;
      results.errors.push(`Game ${gameNum}: ${err.message}`);

      // Debug info
      if (host.latestState) {
        const state = host.latestState;
        console.error(`  State: phase=${state.phase}, turn=${state.turnNumber}, round=${state.roundNumber}, players=${state.players.length}`);
        if (state.pendingAction) {
          const pa = state.pendingAction;
          const targetPlayer = state.players.find(p => p.id === pa.playerId);
          console.error(`  PendingAction: type=${pa.type}, player=${targetPlayer?.name || pa.playerId}, isBot=${targetPlayer?.isBot}`);
        }
        if (host.errors.length > 0) {
          console.error(`  Room errors: ${host.errors.join(', ')}`);
        }
      }

      // Try recovery
      if (gameNum < TOTAL_GAMES) {
        console.log('  Attempting recovery with new room...');
        host.disconnect();
        await sleep(1000);
        host = new PlayerAgent('E2E测试员');
        try {
          await host.connect();
          needNewRoom = true;
        } catch {
          console.error('  Recovery failed, aborting');
          break;
        }
      }
    }
  }

  host.disconnect();

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('RESULTS SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total games: ${results.total}`);
  console.log(`Completed: ${results.completed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Bot wins: ${results.botWins}`);
  console.log(`Human wins: ${results.humanWins}`);
  if (results.gameTurns.length > 0) {
    const avgTurns = results.gameTurns.reduce((a, b) => a + b, 0) / results.gameTurns.length;
    const avgTime = results.gameTimesMs.reduce((a, b) => a + b, 0) / results.gameTimesMs.length;
    console.log(`Avg turns per game: ${avgTurns.toFixed(1)}`);
    console.log(`Avg time per game: ${(avgTime / 1000).toFixed(1)}s`);
  }
  if (results.errors.length > 0) {
    console.log(`\nErrors:`);
    results.errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log();

  if (results.failed > results.total * 0.3) {
    console.error('Too many failures (>30%). Test FAILED.');
    process.exit(1);
  }
  if (results.completed === 0) {
    console.error('No games completed. Test FAILED.');
    process.exit(1);
  }
  console.log('Test PASSED.');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
