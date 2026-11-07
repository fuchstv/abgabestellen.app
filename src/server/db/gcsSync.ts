import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from 'better-sqlite3';
import { Storage } from '@google-cloud/storage';

function getBucketName(): string | undefined {
  return process.env.GCS_BUCKET_NAME;
}

export async function syncFromGCS(targetLocalDbPath: string): Promise<boolean> {
  const bucketName = getBucketName();
  if (!bucketName) {
    return false;
  }

  // If local file already exists and is non-empty, keep it
  if (fs.existsSync(targetLocalDbPath) && fs.statSync(targetLocalDbPath).size > 0) {
    console.log(`📁 Lokale Datenbank existiert bereits: ${targetLocalDbPath}`);
    return true;
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file('abgabestellen.db');

  try {
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`ℹ️ Keine bestehende Datenbank im Bucket gs://${bucketName}/abgabestellen.db gefunden. Starte frisch.`);
      return false;
    }

    const dir = path.dirname(targetLocalDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`☁️ Lade SQLite-Datenbank von gs://${bucketName}/abgabestellen.db herunter...`);
    await file.download({ destination: targetLocalDbPath });
    console.log(`✅ Datenbank erfolgreich aus Cloud Storage geladen (${fs.statSync(targetLocalDbPath).size} Bytes).`);
    return true;
  } catch (err: any) {
    console.warn(`⚠️ Konnte Datenbank nicht von GCS synchronisieren:`, err.message);
    return false;
  }
}

export async function syncToGCS(localDbPath: string): Promise<boolean> {
  const bucketName = getBucketName();
  if (!bucketName || !fs.existsSync(localDbPath)) {
    return false;
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  try {
    console.log(`☁️ Sichere SQLite-Datenbank nach gs://${bucketName}/abgabestellen.db...`);
    await bucket.upload(localDbPath, {
      destination: 'abgabestellen.db',
      metadata: {
        cacheControl: 'no-cache'
      }
    });
    console.log(`✅ Datenbank-Backup in Cloud Storage abgeschlossen.`);
    return true;
  } catch (err: any) {
    console.error(`❌ Fehler beim Sichern der Datenbank nach GCS:`, err.message);
    return false;
  }
}

// Single-flight + debounced live WAL-folded backup via better-sqlite3 db.backup()
let syncTimer: NodeJS.Timeout | null = null;
let syncInFlight: Promise<boolean> | null = null;
let syncPendingAgain = false;

export async function syncDatabaseSnapshotToGCS(db: Database): Promise<boolean> {
  const bucketName = getBucketName();
  if (!bucketName || !db || !db.open || (db as any).memory) {
    return false;
  }

  if (syncInFlight) {
    syncPendingAgain = true;
    return syncInFlight;
  }

  syncInFlight = (async () => {
    const tmpPath = path.join(
      os.tmpdir(),
      `abgabestellen-snapshot-${process.pid}-${Date.now()}.db`
    );
    try {
      await db.backup(tmpPath);
      const ok = await syncToGCS(tmpPath);
      return ok;
    } catch (err: any) {
      console.error(`❌ Fehler beim Erstellen des SQLite-Snapshots für GCS:`, err.message);
      return false;
    } finally {
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {
        // ignore temp cleanup errors
      }
      syncInFlight = null;
      if (syncPendingAgain) {
        syncPendingAgain = false;
        void syncDatabaseSnapshotToGCS(db);
      }
    }
  })();

  return syncInFlight;
}

export function scheduleGcsSync(db: Database, delayMs = 350): void {
  const bucketName = getBucketName();
  if (!bucketName || !db || !db.open || (db as any).memory) {
    return;
  }
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncDatabaseSnapshotToGCS(db);
  }, delayMs);
}

export async function flushGcsSync(db: Database): Promise<boolean> {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  return syncDatabaseSnapshotToGCS(db);
}
