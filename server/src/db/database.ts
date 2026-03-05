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
  `);

  console.log('[DB] SQLite database initialized');
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}
