import { readFileSync } from 'fs';
const file = process.argv[2] || 'balance-test/report/test-run4.json';
const data = JSON.parse(readFileSync(file, 'utf-8'));
const errors = data.filter(g => g.error);
console.log('Error games:');
for (const g of errors) {
  console.log(`  Game ${g.gameId}: ${g.error} (players: ${g.config?.playerCount}, duration: ${g.duration?.toFixed(1)}s)`);
}
const valid = data.filter(g => !g.error);
console.log('\nValid games:');
for (const g of valid) {
  console.log(`  Game ${g.gameId}: ${g.totalTurns} turns, phase=${g.phase}, winner=${g.winner?.playerName || 'none'}`);
  if (g.errors?.length) {
    for (const e of g.errors) console.log(`    err: ${e}`);
  }
}
