import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import { Database } from 'better-sqlite3';
import { getDatabase, closeDatabase, ensureMigrations } from './db/index';
import { buildApp } from './app';
import { seedInitialData } from './db/seed';
import { UserRoleModel } from './db/models/userRoles';
import { UserRoleType } from '@shared/types';
import { syncFromGCS, flushGcsSync } from './db/gcsSync';

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

export function bootstrapProductionState(db: Database): boolean {
  ensureMigrations(db);
  const userRoleModel = new UserRoleModel(db);
  let mutated = false;

  // 1. Remove orphaned synthetic test regions (Teststadt, BezirkA, BezirkB) if they hold 0 stores
  const testRegionNames = ['Teststadt (Landesbezirk)', 'Teststadt', 'BezirkA', 'BezirkB'];
  const placeholders = testRegionNames.map(() => '?').join(',');
  const candidateRegions = db
    .prepare(`SELECT id, name FROM fs_bezirk WHERE name IN (${placeholders})`)
    .all(...testRegionNames) as Array<{ id: number; name: string }>;

  if (candidateRegions.length > 0) {
    const emptyIds: number[] = [];
    for (const reg of candidateRegions) {
      const storeCount = (
        db.prepare('SELECT COUNT(*) as c FROM fs_betrieb WHERE bezirk_id = ?').get(reg.id) as { c: number }
      ).c;
      if (storeCount === 0) {
        emptyIds.push(reg.id);
      }
    }

    if (emptyIds.length > 0) {
      const idPlaceholders = emptyIds.map(() => '?').join(',');
      db.transaction(() => {
        db.prepare(`DELETE FROM fs_invite_token WHERE region_id IN (${idPlaceholders})`).run(...emptyIds);
        db.prepare(`DELETE FROM fs_user_roles WHERE region_id IN (${idPlaceholders})`).run(...emptyIds);
        db.prepare(
          `DELETE FROM fs_bezirk_closure WHERE ancestor_id IN (${idPlaceholders}) OR descendant_id IN (${idPlaceholders})`
        ).run(...emptyIds, ...emptyIds);
        db.prepare(`DELETE FROM fs_bezirk WHERE id IN (${idPlaceholders})`).run(...emptyIds);
      })();
      console.log(`🧹 [CLEANUP] Verwaiste Test-Regionen bereinigt (IDs: ${emptyIds.join(', ')})`);
      mutated = true;
    }
  }

  // 2. Ensure configured default Super-Admin email(s) exist as active global ORGA
  const adminEmailsRaw = process.env.SUPER_ADMIN_EMAILS || 'fuchstv@googlemail.com';
  const adminEmails = adminEmailsRaw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const rootRegion = db
    .prepare('SELECT id FROM fs_bezirk ORDER BY type ASC, id ASC LIMIT 1')
    .get() as { id: number } | undefined;

  for (const email of adminEmails) {
    const existing = db.prepare('SELECT * FROM fs_user WHERE lower(email) = ?').get(email) as any;
    let uid: string;

    if (!existing) {
      uid = `usr_${crypto.randomBytes(8).toString('hex')}`;
      const defaultName = email.split('@')[0];
      db.prepare(`
        INSERT INTO fs_user (id, email, name, password_hash, is_super_admin, is_active, created_at)
        VALUES (?, ?, ?, NULL, 1, 1, datetime('now'))
      `).run(uid, email, defaultName);
      console.log(`🛡️ [BOOTSTRAP] Globaler Super-Admin eingerichtet: ${email}`);
      mutated = true;
    } else {
      uid = existing.id;
      if (Number(existing.is_super_admin) !== 1 || Number(existing.is_active) !== 1) {
        db.prepare('UPDATE fs_user SET is_super_admin = 1, is_active = 1, revoked_at = NULL WHERE id = ?').run(uid);
        mutated = true;
      }
    }

    if (rootRegion) {
      const currentRoles = userRoleModel.getUserRoles(uid);
      if (!currentRoles.some(r => r.region_id === rootRegion.id && r.role === UserRoleType.ORGA)) {
        userRoleModel.assignRole(uid, rootRegion.id, UserRoleType.ORGA);
        mutated = true;
      }
      if (
        !currentRoles.some(
          r => r.region_id === rootRegion.id && r.role === UserRoleType.WORKGROUP_GIVING_STORES
        )
      ) {
        userRoleModel.assignRole(uid, rootRegion.id, UserRoleType.WORKGROUP_GIVING_STORES);
        mutated = true;
      }
    }
  }

  // 3. Clean up legacy non-user placeholder role 'berlin_lead' once real ORGA exists
  const legacyPlaceholder = db
    .prepare(
      `SELECT 1 FROM fs_user_roles ur
       LEFT JOIN fs_user u ON u.id = ur.user_id
       WHERE ur.user_id = 'berlin_lead' AND u.id IS NULL LIMIT 1`
    )
    .get();
  if (legacyPlaceholder && adminEmails.length > 0) {
    db.prepare(`DELETE FROM fs_user_roles WHERE user_id = 'berlin_lead'`).run();
    mutated = true;
  }

  return mutated;
}

async function start() {
  const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'abgabestellen.db');

  // Sync latest SQLite database from Cloud Storage if configured
  await syncFromGCS(dbPath);

  const db = getDatabase(dbPath);

  // Run seed check (auto-seeds Berlin regions and sample stores if empty)
  seedInitialData(db);

  // Bootstrap default super-admins & clean orphaned test regions
  const bootstrapped = bootstrapProductionState(db);
  if (bootstrapped) {
    await flushGcsSync(db);
  }

  const app = buildApp(db, { logger: true });

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 abgabestellen.app server running at ${address}`);
    console.log(`📖 OpenAPI documentation available at ${address}/api/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown on Cloud Run container termination
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Gracefully terminating abgabestellen.app...`);
    try {
      await app.close();
      await flushGcsSync(db);
      closeDatabase();
    } catch (e: any) {
      console.error('Error during shutdown sync:', e.message);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Only start HTTP server when executed as entrypoint
if (
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js') ||
  process.argv[1]?.endsWith('index.mjs')
) {
  start();
}
