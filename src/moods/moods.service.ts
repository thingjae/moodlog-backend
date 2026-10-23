import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';

export interface Mood {
  id: number;
  score: number;
  emoji: string;
  note: string;
  day: string;
  createdAt: string;
}

export interface MoodInput {
  score: number;
  emoji: string;
  note: string;
  day: string;
}

@Injectable()
export class MoodsService implements OnModuleDestroy {
  private readonly db = new DatabaseSync(process.env.DB_PATH ?? 'moods.db');

  constructor() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS moods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        score INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      )
    `);
    const cols = this.db.prepare('PRAGMA table_info(moods)').all() as { name: string }[];
    if (!cols.some((c) => c.name === 'day')) {
      this.db.exec(`
        ALTER TABLE moods ADD COLUMN day TEXT;
        UPDATE moods SET day = substr(createdAt, 1, 10);
      `);
    }
  }

  onModuleDestroy() {
    this.db.close();
  }

  findAll(): Mood[] {
    return this.db
      .prepare('SELECT * FROM moods ORDER BY createdAt DESC, id DESC')
      .all() as unknown as Mood[];
  }

  /** 하루에 하나만 유지: 같은 날짜 기록이 있으면 덮어쓴다. */
  upsert(input: MoodInput): Mood {
    const existing = this.db
      .prepare('SELECT id FROM moods WHERE day = ? ORDER BY id DESC LIMIT 1')
      .get(input.day) as { id: number } | undefined;
    if (existing) {
      this.db
        .prepare('UPDATE moods SET score = ?, emoji = ?, note = ? WHERE id = ?')
        .run(input.score, input.emoji, input.note, existing.id);
      return this.findOne(existing.id);
    }
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO moods (score, emoji, note, day) VALUES (?, ?, ?, ?)')
      .run(input.score, input.emoji, input.note, input.day);
    return this.findOne(Number(lastInsertRowid));
  }

  remove(id: number) {
    const { changes } = this.db.prepare('DELETE FROM moods WHERE id = ?').run(id);
    if (!changes) throw new NotFoundException();
  }

  private findOne(id: number): Mood {
    const row = this.db.prepare('SELECT * FROM moods WHERE id = ?').get(id);
    if (!row) throw new NotFoundException();
    return row as unknown as Mood;
  }
}
