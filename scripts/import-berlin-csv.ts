import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { getDatabase, closeDatabase } from '../src/server/db/index';
import { seedInitialData } from '../src/server/db/seed';
import { RegionModel } from '../src/server/db/models/regions';
import { StoreModel } from '../src/server/db/models/stores';
import { ContactLogModel } from '../src/server/db/models/contactLog';

interface GeocodeResult {
  lat: number;
  lon: number;
  source: 'google' | 'cache' | 'district_fallback';
}

function parseStandColumn(standStr: string): { isoDate: string | null; initials: string } {
  if (!standStr || !standStr.trim()) {
    return { isoDate: null, initials: 'system:csv-import' };
  }

  const match = standStr.match(/(\d{1,2})\.(\d{1,2})\.+(\d{2,4})(?:\s*-?\s*([A-Za-z]+))?/);
  if (!match) {
    return { isoDate: null, initials: 'system:csv-import' };
  }

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  let year = match[3];
  if (year.length === 2) {
    year = '20' + year;
  }

  const initials = match[4] ? match[4].trim() : 'system:csv-import';
  return {
    isoDate: `${year}-${month}-${day} 00:00:00`,
    initials
  };
}

function isBerlinLandline(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[^0-9+]/g, '');
  // Landline Berlin: 030 or +4930 or 004930
  if (clean.startsWith('030') || clean.startsWith('+4930') || clean.startsWith('004930')) {
    return true;
  }
  return false;
}

export async function importBerlinCsv(csvPath?: string, databaseInstance?: any, options?: { skipGeocoding?: boolean }) {
  const filePath = csvPath || path.resolve(
    process.cwd(),
    'data/Abgabestellen Berlin - Neues_ Änderungen_abgabestellen.berlin@foodsharing.network - Abgabestellen.csv'
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV-Datei nicht gefunden: ${filePath}`);
  }

  const rawCsv = fs.readFileSync(filePath, 'utf-8');
  const records: string[][] = parse(rawCsv, {
    skip_empty_lines: true,
    relax_column_count: true
  });

  const header = records[0];
  const dataRows = records.slice(1).filter(r => (r[0] && r[0].trim()) || (r[1] && r[1].trim()));

  console.log(`\n📂 Gefundene Datensätze in CSV: ${dataRows.length} (Kopfzeile und Leerzeilen ignoriert)`);

  const db = databaseInstance || getDatabase();
  const regionModel = new RegionModel(db);
  const storeModel = new StoreModel(db);
  const contactLogModel = new ContactLogModel(db);

  // Load regions to map Großbezirk -> id
  let regions = regionModel.getAllRegions();
  if (regions.length === 0) {
    console.log('🌱 Seede initiale Berliner Bezirke...');
    seedInitialData(db);
    regions = regionModel.getAllRegions();
  }

  const districtMap = new Map<string, any>();
  for (const reg of regions) {
    districtMap.set(reg.name.toLowerCase().trim(), reg);
  }

  // Load geocode cache
  const cachePath = path.resolve(process.cwd(), 'data/geocode_cache.json');
  let geocodeCache: Record<string, { lat: number; lon: number }> = {};
  if (fs.existsSync(cachePath)) {
    try {
      geocodeCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch {
      geocodeCache = {};
    }
  }

  const apiKey = options?.skipGeocoding ? '' : (process.env.GOOGLE_GEOCODING_API_KEY || '');

  async function resolveCoordinates(
    address: string,
    plz: string,
    districtName: string,
    fallbackLat: number,
    fallbackLon: number
  ): Promise<GeocodeResult> {
    const cleanAddress = address.trim();
    const cleanPlz = plz.trim();
    const queryKey = `${cleanAddress}, ${cleanPlz} Berlin`.toLowerCase();

    // 1. Check cache
    if (geocodeCache[queryKey]) {
      return {
        lat: geocodeCache[queryKey].lat,
        lon: geocodeCache[queryKey].lon,
        source: 'cache'
      };
    }

    // 2. Query Google Geocoding API if key is present and address has a street name
    if (apiKey && cleanAddress.length > 3) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          `${cleanAddress}, ${cleanPlz} Berlin, Germany`
        )}&key=${apiKey}`;

        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'OK' && json.results?.[0]?.geometry?.location) {
            const loc = json.results[0].geometry.location;
            geocodeCache[queryKey] = { lat: loc.lat, lon: loc.lng };
            return {
              lat: loc.lat,
              lon: loc.lng,
              source: 'google'
            };
          }
        }
      } catch (err) {
        // Geocoding error -> fallback to district center
      }
    }

    // 3. Fallback to district center
    return {
      lat: fallbackLat,
      lon: fallbackLon,
      source: 'district_fallback'
    };
  }

  // Clear existing Berlin stores to prevent duplicates on re-import
  db.exec(`
    DELETE FROM fs_store_giving_details WHERE store_id IN (SELECT id FROM fs_betrieb WHERE stadt = 'Berlin');
    DELETE FROM fs_store_contact_log WHERE store_id IN (SELECT id FROM fs_betrieb WHERE stadt = 'Berlin');
    DELETE FROM fs_betrieb WHERE stadt = 'Berlin';
  `);

  let importedCount = 0;
  let landlineCount = 0;
  let confidentialPhoneCount = 0;
  let confidentialContactPersonCount = 0;
  let geocodedCount = 0;
  let fallbackCount = 0;

  console.log(`⏳ Löse Koordinaten auf (Google Geocoding & Cache)...`);
  const preparedRows = [];
  for (const row of dataRows) {
    const name = (row[0] || 'Unbenannte Abgabestelle').trim();
    const strasse = (row[1] || '').trim();
    const plz = (row[2] || '').trim();
    const grossbezirk = (row[3] || '').trim();
    const ortsteil = (row[4] || '').trim();
    const ansprechpartner = (row[5] || '').trim() || null;
    const telefon = (row[6] || '').trim() || null;
    const dropoffTimes = (row[7] || '').trim() || null;
    const acceptedItems = (row[8] || '').trim() || null;
    const registrationRequired = (row[9] || '').trim().toUpperCase() === 'TRUE';
    const recipientCountRaw = (row[10] || '').trim();
    const bemerkungen = (row[11] || '').trim() || null;
    const website = (row[12] || '').trim() || null;
    const stand = (row[13] || '').trim();

    // Find matching district or default to Berlin root
    const district = districtMap.get(grossbezirk.toLowerCase()) || districtMap.get('berlin (landesbezirk)') || { id: 1, lat: 52.52, lon: 13.405 };

    // Geocoding
    const geo = await resolveCoordinates(
      strasse,
      plz,
      grossbezirk,
      district.lat || 52.52,
      district.lon || 13.405
    );

    if (geo.source === 'google' || geo.source === 'cache') {
      geocodedCount++;
    } else {
      fallbackCount++;
    }

    preparedRows.push({
      name,
      strasse,
      plz,
      district,
      ansprechpartner,
      telefon,
      dropoffTimes,
      acceptedItems,
      registrationRequired,
      recipientCountRaw,
      bemerkungen,
      website,
      stand,
      lat: geo.lat,
      lon: geo.lon
    });
  }

  console.log(`⏳ Schreibe 275 Abgabestellen synchron in die Datenbank...`);

  const importTx = db.transaction(() => {
    for (const item of preparedRows) {
      // Status check
      const isInactive = item.name.includes('INAKTIV') || 
        item.name.includes('außer Betrieb') || 
        (item.bemerkungen && item.bemerkungen.toLowerCase().includes('keinerlei lm'));
      const status = isInactive ? 'INACTIVE' : 'ACTIVE';

      // Parse recipient count
      const parsedRecipients = item.recipientCountRaw ? parseInt(item.recipientCountRaw.replace(/[^0-9]/g, ''), 10) : null;
      const recipientCount = isNaN(parsedRecipients as any) ? null : parsedRecipients;

      // Parse stand date and coordinator initials
      const { isoDate, initials } = parseStandColumn(item.stand);

      // DSGVO Phone Logic: Only publish landlines (030...) if registration is required. Mobile numbers are strictly confidential.
      let publicPhone: string | null = null;
      if (item.registrationRequired && item.telefon && isBerlinLandline(item.telefon)) {
        publicPhone = item.telefon;
        landlineCount++;
      }
      if (item.telefon) {
        confidentialPhoneCount++;
      }
      if (item.ansprechpartner) {
        confidentialContactPersonCount++;
      }

      // 1. Create Core Store & Giving Details atomically via StoreModel
      let store;
      try {
        store = storeModel.createStore({
          name: item.name,
          bezirk_id: item.district.id,
          str: item.strasse || '',
          plz: item.plz || '',
          stadt: 'Berlin',
          lat: item.lat,
          lon: item.lon,
          ansprechpartner: item.ansprechpartner || '', // STRICTLY CONFIDENTIAL
          telefon: item.telefon || '',                 // STRICTLY CONFIDENTIAL
          giving_details: {
            dropoff_times: item.dropoffTimes || '',
            accepted_items: item.acceptedItems || '',
            registration_required: item.registrationRequired ? 1 : 0,
            public_phone: publicPhone || '',
            public_contact_name: '',
            website: item.website || '',
            recipient_count: recipientCount !== null ? String(recipientCount) : '',
            last_contact_at: isoDate
          }
        });
      } catch (err: any) {
        console.error(`❌ FEHLER bei Zeile [${item.name}] | Bezirk:`, item.district, '| Error:', err.message);
        throw err;
      }

      // 2. Create initial CRM Contact Log entry (fs_store_contact_log)
      if (item.bemerkungen || item.stand) {
        contactLogModel.addContactLogEntry({
          store_id: store.id,
          author_user_id: `coordinator:${initials}`,
          author_name: `Koordinator (${initials})`,
          channel: item.telefon ? 'Telefon' : 'Sonstiges',
          note: [
            item.bemerkungen ? `Bemerkungen: ${item.bemerkungen}` : '',
            item.stand ? `Stand: ${item.stand}` : ''
          ].filter(Boolean).join(' | '),
          contacted_at: isoDate || new Date().toISOString()
        });
      }

      importedCount++;
    }
  });

  importTx();

  // Save updated geocode cache to disk
  fs.writeFileSync(cachePath, JSON.stringify(geocodeCache, null, 2), 'utf-8');

  console.log(`\n🎉 Import erfolgreich abgeschlossen:`);
  console.log(`   ──────────────────────────────────────────────────`);
  console.log(`   Gesamt importierte Abgabestellen:       ${importedCount}`);
  console.log(`   Geocodierte / gecachte Adressen:        ${geocodedCount}`);
  console.log(`   Fallback auf Bezirks-Koordinaten:       ${fallbackCount}`);
  console.log(`   ──────────────────────────────────────────────────`);
  console.log(`   🔒 DSGVO / Zero-Leakage Schutz:`);
  console.log(`   Vertrauliche Ansprechpartner (intern):  ${confidentialContactPersonCount}`);
  console.log(`   Vertrauliche Telefonnummern (intern):   ${confidentialPhoneCount}`);
  console.log(`   Öffentliche Festnetznummern (030):      ${landlineCount}`);
  console.log(`   Öffentliche Mobilnummern (015/016/017): 0 (Strikter PII-Schutz)`);
  console.log(`   ──────────────────────────────────────────────────\n`);

  return {
    importedCount,
    geocodedCount,
    fallbackCount,
    landlineCount,
    confidentialContactPersonCount,
    confidentialPhoneCount
  };
}

// CLI Execution
if (process.argv[1]?.endsWith('import-berlin-csv.ts')) {
  importBerlinCsv()
    .then(() => {
      closeDatabase();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Fehler beim CSV-Import:', err);
      closeDatabase();
      process.exit(1);
    });
}
