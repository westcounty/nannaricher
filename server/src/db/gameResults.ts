// server/src/db/gameResults.ts — Save game results to SQLite
import { getDatabase } from './database.js';
import type { Player } from '@nannaricher/shared';

export function saveGameResults(
  roomId: string,
  players: Player[],
  winnerId: string | null,
  roundsPlayed: number,
): void {
  const db = getDatabase();

  const insert = db.prepare(`
    INSERT INTO game_results (id, room_id, user_id, username, nickname, player_color,
      final_money, final_gpa, final_exploration, is_winner,
      training_plans, lines_visited, rounds_played, total_players, played_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const saveAll = db.transaction(() => {
    for (const player of players) {
      // Skip players without userId (guests or legacy players)
      if (!player.userId) continue;

      const id = `${roomId}_${player.id}`;
      const planNames = player.trainingPlans.map(p => p.name);

      insert.run(
        id,
        roomId,
        player.userId,
        player.name,
        player.name, // nickname snapshot
        player.color,
        player.money,
        player.gpa,
        player.exploration,
        player.id === winnerId ? 1 : 0,
        JSON.stringify(planNames),
        JSON.stringify(player.linesVisited),
        roundsPlayed,
        players.length,
      );
    }
  });

  try {
    saveAll();
    console.log(`[DB] Saved game results for room ${roomId} (${players.filter(p => p.userId).length} authenticated players)`);
  } catch (error) {
    console.error('[DB] Failed to save game results:', error);
  }
}
