// server/src/db/database.ts — SQLite database for game history
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;

export function initDatabase(): Database.Database {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/nannaricher.db');

  // Ensure data directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_results (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      nickname TEXT,
      player_color TEXT,
      final_money INTEGER DEFAULT 0,
      final_gpa REAL DEFAULT 0,
      final_exploration INTEGER DEFAULT 0,
      is_winner INTEGER DEFAULT 0,
      training_plans TEXT DEFAULT '[]',
      lines_visited TEXT DEFAULT '[]',
      rounds_played INTEGER DEFAULT 0,
      total_players INTEGER DEFAULT 0,
      played_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_game_results_user ON game_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_played ON game_results(played_at);

    -- Player unlocked achievements
    CREATE TABLE IF NOT EXISTS player_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT DEFAULT (datetime('now')),
      game_id TEXT,
      UNIQUE(user_id, achievement_id)
    );
    CREATE INDEX IF NOT EXISTS idx_player_achievements_user ON player_achievements(user_id);

    -- Player cumulative stats for cross-game achievement tracking
    CREATE TABLE IF NOT EXISTS player_stats (
      user_id TEXT PRIMARY KEY,
      total_games INTEGER DEFAULT 0,
      total_wins INTEGER DEFAULT 0,
      total_bankruptcies INTEGER DEFAULT 0,
      last_game_bankrupt INTEGER DEFAULT 0,
      current_win_streak INTEGER DEFAULT 0,
      max_win_streak INTEGER DEFAULT 0,
      current_loss_streak INTEGER DEFAULT 0,
      total_money_earned INTEGER DEFAULT 0,
      total_gpa_sum REAL DEFAULT 0,
      total_cards_drawn INTEGER DEFAULT 0,
      total_defense_cards_used INTEGER DEFAULT 0,
      total_dice_rolls INTEGER DEFAULT 0,
      total_dice_six_count INTEGER DEFAULT 0,
      total_hospital_escapes INTEGER DEFAULT 0,
      total_votes_participated INTEGER DEFAULT 0,
      total_redistribution_cards INTEGER DEFAULT 0,
      total_steal_cards INTEGER DEFAULT 0,
      total_start_passes INTEGER DEFAULT 0,
      lines_ever_visited TEXT DEFAULT '[]',
      plans_ever_used TEXT DEFAULT '[]',
      opponents_played TEXT DEFAULT '[]',
      line_visit_counts TEXT DEFAULT '{}',
      food_events_triggered TEXT DEFAULT '[]',
      consecutive_gpa_above_3 INTEGER DEFAULT 0,
      best_gpa REAL DEFAULT 0,
      max_money INTEGER DEFAULT 0,
      max_exploration INTEGER DEFAULT 0,
      plans_won_with TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add plans_won_with column if missing (for existing databases)
  try {
    db.prepare("SELECT plans_won_with FROM player_stats LIMIT 1").get();
  } catch {
    db.exec("ALTER TABLE player_stats ADD COLUMN plans_won_with TEXT DEFAULT '[]'");
    console.log('[DB] Migrated player_stats: added plans_won_with column');
  }

  console.log('[DB] SQLite database initialized');
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}
