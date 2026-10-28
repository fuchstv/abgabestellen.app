import 'dotenv/config';
import { getDatabase, closeDatabase } from './db/index';
import { buildApp } from './app';
import { seedInitialData } from './db/seed';

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const db = getDatabase();

  // Run seed check (auto-seeds Berlin regions and sample stores if empty)
  seedInitialData(db);

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
    await app.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
