import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface GameLogRecord {
  timestamp: number;
  turn: number;
  playerId: string;
  type: 'dice_roll' | 'move' | 'event' | 'card' | 'resource_change' | 'choice' | 'phase_change' | 'system';
  message: string;
  data?: Record<string, unknown>;
}

export class GameLogger {
  private records: GameLogRecord[] = [];
  private roomId: string;
  private startTime: number;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.startTime = Date.now();
  }

  log(record: Omit<GameLogRecord, 'timestamp'>): void {
    this.records.push({ ...record, timestamp: Date.now() });
  }

  async persist(): Promise<string> {
    const dir = join(process.cwd(), 'logs');
    await mkdir(dir, { recursive: true });

    const filename = `game-${this.roomId}-${this.startTime}.json`;
    const filepath = join(dir, filename);

    await writeFile(filepath, JSON.stringify({
      roomId: this.roomId,
      startTime: this.startTime,
      endTime: Date.now(),
      totalRecords: this.records.length,
      records: this.records,
    }, null, 2));

    return filepath;
  }

  getRecords(): GameLogRecord[] {
    return [...this.records];
  }
}
