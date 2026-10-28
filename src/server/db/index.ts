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
      return;
    }
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
