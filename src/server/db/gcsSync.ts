import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const bucketName = process.env.GCS_BUCKET_NAME;

export async function syncFromGCS(targetLocalDbPath: string): Promise<boolean> {
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

    // Ensure directory exists
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
  if (!bucketName || !fs.existsSync(localDbPath)) {
    return false;
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file('abgabestellen.db');

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
