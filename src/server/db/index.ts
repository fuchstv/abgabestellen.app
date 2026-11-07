import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: DatabaseType | null = null;

export function getDatabase(dbPath?: string): DatabaseType {
  if (dbInstance && !dbPath) {
    return dbInstance;
  }

  const resolvedPath = dbPath || process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'abgabestellen.db');

  // Ensure data directory exists if not in-memory
  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);

  // High-performance concurrency settings for SQLite
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Initialize schema if not present
  initSchema(db);

  if (!dbPath) {
    dbInstance = db;
  }
  return db;
}

export function ensureMigrations(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fs_user (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NULL,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      revoked_at TEXT NULL DEFAULT NULL,
      last_login_at TEXT NULL DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fs_user_email ON fs_user(email);
  `);

  const userCols = new Set(
    (db.prepare(`PRAGMA table_info('fs_user')`).all() as Array<{ name: string }>).map(c => c.name)
  );
  if (!userCols.has('is_active')) {
    db.exec(`ALTER TABLE fs_user ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!userCols.has('revoked_at')) {
    db.exec(`ALTER TABLE fs_user ADD COLUMN revoked_at TEXT NULL DEFAULT NULL;`);
  }
  if (!userCols.has('last_login_at')) {
    db.exec(`ALTER TABLE fs_user ADD COLUMN last_login_at TEXT NULL DEFAULT NULL;`);
  }

  const inviteTableExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'fs_invite_token'`)
    .get();
  if (inviteTableExists) {
    const inviteCols = new Set(
      (db.prepare(`PRAGMA table_info('fs_invite_token')`).all() as Array<{ name: string }>).map(c => c.name)
    );
    if (!inviteCols.has('revoked_at')) {
      db.exec(`ALTER TABLE fs_invite_token ADD COLUMN revoked_at TEXT NULL DEFAULT NULL;`);
    }
  }
}

export function initSchema(db: DatabaseType): void {
  const possiblePaths = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, 'db', 'schema.sql'),
    path.resolve(process.cwd(), 'src', 'server', 'db', 'schema.sql'),
    path.resolve(__dirname, '..', '..', 'src', 'server', 'db', 'schema.sql')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const schemaSql = fs.readFileSync(p, 'utf8');
      db.exec(schemaSql);
      ensureMigrations(db);
      return;
    }
  }
  ensureMigrations(db);
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
