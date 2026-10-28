import 'dotenv/config';
import path from 'path';
import { getDatabase, closeDatabase } from './db/index';
import { buildApp } from './app';
import { seedInitialData } from './db/seed';
import { UserRoleModel } from './db/models/userRoles';
import { UserRoleType } from '@shared/types';
import { syncFromGCS, syncToGCS } from './db/gcsSync';

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'abgabestellen.db');

  // Sync latest SQLite database from Cloud Storage if configured
  await syncFromGCS(dbPath);

  const db = getDatabase(dbPath);

  // Run seed check (auto-seeds Berlin regions and sample stores if empty)
  seedInitialData(db);

  // Check for INITIAL_ORGA_SECRET bootstrapping
  if (process.env.INITIAL_ORGA_SECRET) {
    const hasOrga = db.prepare('SELECT 1 FROM fs_user_roles WHERE role = ? LIMIT 1').get(UserRoleType.ORGA);
    if (!hasOrga) {
      const userRoleModel = new UserRoleModel(db);
      const invite = userRoleModel.createInviteToken({
        region_id: 1,
        created_by_user_id: 'system:bootstrap',
        target_role: UserRoleType.ORGA,
        expiresInDays: 30
      });
      console.log(`🔑 [BOOTSTRAP] Initial ORGA Invite Link generated: /invite?token=${invite.rawToken}`);
    }
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
      closeDatabase();
      await syncToGCS(dbPath);
    } catch (e: any) {
      console.error('Error during shutdown sync:', e.message);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
