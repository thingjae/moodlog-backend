import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

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

/**
 * DATABASE_URL 이 있으면 Postgres(배포용), 없으면 SQLite 파일(로컬 개발용)을 쓴다.
 */
@Injectable()
export class MoodsService implements OnModuleDestroy {
  private readonly pool = process.env.DATABASE_URL
    ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
    : null;
  private readonly sqlite = this.pool
    ? null
    : new DatabaseSync(process.env.DB_PATH ?? 'moods.db');
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  private async init() {
    if (this.pool) {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS moods (
          id SERIAL PRIMARY KEY,
          score INTEGER NOT NULL,
          emoji TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          day TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS moods_day_idx ON moods (day);
      `);
      return;
    }
    const db = this.sqlite!;
    db.exec(`
      CREATE TABLE IF NOT EXISTS moods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        score INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      )
    `);
    const cols = db.prepare('PRAGMA table_info(moods)').all() as { name: string }[];
    if (!cols.some((c) => c.name === 'day')) {
      db.exec(`
        ALTER TABLE moods ADD COLUMN day TEXT;
        UPDATE moods SET day = substr(createdAt, 1, 10);
      `);
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
    this.sqlite?.close();
  }

  async findAll(): Promise<Mood[]> {
    await this.ready;
    if (this.pool) {
      const { rows } = await this.pool.query(
        'SELECT * FROM moods ORDER BY "createdAt" DESC, id DESC',
      );
      return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() }));
    }
    return this.sqlite!
      .prepare('SELECT * FROM moods ORDER BY createdAt DESC, id DESC')
      .all() as unknown as Mood[];
  }

  /** 하루에 하나만 유지: 같은 날짜 기록이 있으면 덮어쓴다. */
  async upsert(input: MoodInput): Promise<Mood> {
    await this.ready;
    if (this.pool) {
      const { rows } = await this.pool.query(
        `INSERT INTO moods (score, emoji, note, day) VALUES ($1, $2, $3, $4)
         ON CONFLICT (day) DO UPDATE
           SET score = EXCLUDED.score, emoji = EXCLUDED.emoji, note = EXCLUDED.note
         RETURNING *`,
        [input.score, input.emoji, input.note, input.day],
      );
      return { ...rows[0], createdAt: new Date(rows[0].createdAt).toISOString() };
    }
    const db = this.sqlite!;
    const existing = db
      .prepare('SELECT id FROM moods WHERE day = ? ORDER BY id DESC LIMIT 1')
      .get(input.day) as { id: number } | undefined;
    if (existing) {
      db.prepare('UPDATE moods SET score = ?, emoji = ?, note = ? WHERE id = ?').run(
        input.score,
        input.emoji,
        input.note,
        existing.id,
      );
      return this.findOneSqlite(existing.id);
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO moods (score, emoji, note, day) VALUES (?, ?, ?, ?)')
      .run(input.score, input.emoji, input.note, input.day);
    return this.findOneSqlite(Number(lastInsertRowid));
  }

  async remove(id: number) {
    await this.ready;
    const changes = this.pool
      ? (await this.pool.query('DELETE FROM moods WHERE id = $1', [id])).rowCount
      : this.sqlite!.prepare('DELETE FROM moods WHERE id = ?').run(id).changes;
    if (!changes) throw new NotFoundException();
  }

  private findOneSqlite(id: number): Mood {
    const row = this.sqlite!.prepare('SELECT * FROM moods WHERE id = ?').get(id);
    if (!row) throw new NotFoundException();
    return row as unknown as Mood;
  }
}
