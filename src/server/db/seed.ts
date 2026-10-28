import { Database } from 'better-sqlite3';
import { RegionModel } from './models/regions';
import { StoreModel } from './models/stores';
import { ContactLogModel } from './models/contactLog';
import { UserRoleModel } from './models/userRoles';
import { GivingStatus, UserRoleType } from '@shared/types';
import { getDatabase } from './index';

export function seedInitialData(db: Database): void {
  const regionModel = new RegionModel(db);
  const storeModel = new StoreModel(db);
  const contactLogModel = new ContactLogModel(db);
  const userRoleModel = new UserRoleModel(db);

  // Check if already seeded
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM fs_bezirk').get() as any).count;
  if (existingCount > 0) {
    return;
  }

  console.log('🌱 Seeding initial Berlin region hierarchy and sample GIVING stores...');

  // 1. Parent Region: Berlin (Landesbezirk)
  const berlin = regionModel.createRegion({
    name: 'Berlin (Landesbezirk)',
    type: 1,
    lat: 52.5200,
    lon: 13.4050,
    external_fs_bezirk_id: 1
  });

  // 2. The 12 Official Berlin Districts (Bezirke)
  const districtsData = [
    { name: 'Mitte', lat: 52.5316, lon: 13.3855, extId: 10 },
    { name: 'Pankow', lat: 52.5689, lon: 13.4024, extId: 11 },
    { name: 'Friedrichshain-Kreuzberg', lat: 52.5150, lon: 13.4350, extId: 12 },
    { name: 'Charlottenburg-Wilmersdorf', lat: 52.5078, lon: 13.2844, extId: 13 },
    { name: 'Tempelhof-Schöneberg', lat: 52.4633, lon: 13.3846, extId: 14 },
    { name: 'Neukölln', lat: 52.4811, lon: 13.4353, extId: 15 },
    { name: 'Spandau', lat: 52.5350, lon: 13.1978, extId: 16 },
    { name: 'Steglitz-Zehlendorf', lat: 52.4333, lon: 13.2500, extId: 17 },
    { name: 'Marzahn-Hellersdorf', lat: 52.5447, lon: 13.5856, extId: 18 },
    { name: 'Treptow-Köpenick', lat: 52.4500, lon: 13.5833, extId: 19 },
    { name: 'Lichtenberg', lat: 52.5333, lon: 13.5000, extId: 20 },
    { name: 'Reinickendorf', lat: 52.5833, lon: 13.3333, extId: 21 },
  ];

  const districtMap = new Map<string, number>();

  for (const d of districtsData) {
    const r = regionModel.createRegion({
      name: d.name,
      parent_id: berlin.id,
      type: 2,
      lat: d.lat,
      lon: d.lon,
      external_fs_bezirk_id: d.extId
    });
    districtMap.set(d.name, r.id);
  }

  // 3. Seed Realistic GIVING Stores
  // Store 1: Suppenküche der Franziskaner (Pankow)
  const store1 = storeModel.createStore({
    bezirk_id: districtMap.get('Pankow')!,
    name: 'Suppenküche der Franziskaner',
    str: 'Wollankstraße 19',
    plz: '13187',
    stadt: 'Berlin',
    lat: 52.5679,
    lon: 13.3976,
    public_info: 'Anlieferung bitte am Seiteneingang Hof klingeln. Zufahrt für PKW/Transporter über Wollankstraße.',
    ansprechpartner: 'Bruder Michael / Schwester Regina',
    telefon: '030 488396-0 (Direktdurchwahl Büro)',
    giving_details: {
      public_contact_name: 'Pforte / Empfang Suppenküche',
      public_phone: '030 488396-12',
      website: 'https://franziskaner-berlin.de/suppenkuche',
      dropoff_times: 'Mo-So 08:30 - 13:00 Uhr',
      accepted_items: 'Backwaren, frisches Obst, Gemüse, Milchprodukte, verpackte Wurst & Käse, Trockenware',
      registration_required: 0, // Ohne Voranmeldung
      recipient_count: 'ca. 250 bis 350 Gäste täglich',
      giving_status: GivingStatus.CURRENT,
      last_contact_at: '2026-10-15T10:30:00Z'
    }
  });

  contactLogModel.addContactLogEntry({
    store_id: store1.id,
    author_user_id: 'berlin_lead',
    author_name: 'Alex Coordinator',
    channel: 'Vor Ort',
    contact_person: 'Bruder Michael',
    note: 'Persönlicher Besuch: Kapazitäten für Backwaren am Wochenende sind hoch. Kühlzelle funktioniert einwandfrei.',
    confirmed_current: true,
    contacted_at: '2026-10-15T10:30:00Z'
  });

  // Store 2: Laib und Seele Kreuzberg (Friedrichshain-Kreuzberg)
  const store2 = storeModel.createStore({
    bezirk_id: districtMap.get('Friedrichshain-Kreuzberg')!,
    name: 'Laib und Seele — Ev. Kirchengemeinde Kreuzberg',
    str: 'Reichenberger Str. 132',
    plz: '10999',
    stadt: 'Berlin',
    lat: 52.4947,
    lon: 13.4285,
    public_info: 'Ausgabe und Annahme im Gemeindesaal im Erdgeschoss.',
    ansprechpartner: 'Frau Becker (Leitung Ausgabestelle)',
    telefon: '030 6112233-4',
    giving_details: {
      public_contact_name: 'Gemeindebüro',
      public_phone: '030 6112233-0',
      website: 'https://berliner-tafel.de/laib-und-seele',
      dropoff_times: 'Mittwoch 14:00 - 17:00 Uhr & Donnerstag 09:00 - 12:00 Uhr\n(telefonische Voranmeldung erforderlich)',
      accepted_items: 'Trockenlebensmittel, Konserven, verpackte Ware, intaktes Obst & Gemüse',
      registration_required: 1, // Voranmeldung nötig
      recipient_count: 'ca. 120 Haushalte',
      giving_status: GivingStatus.CURRENT,
      last_contact_at: '2026-09-20T14:15:00Z'
    }
  });

  contactLogModel.addContactLogEntry({
    store_id: store2.id,
    author_user_id: 'berlin_lead',
    author_name: 'Alex Coordinator',
    channel: 'Telefon',
    contact_person: 'Frau Becker',
    note: 'Frau Becker bittet darum, Großlieferungen mindestens einen Tag vorab anzukündigen.',
    confirmed_current: true,
    contacted_at: '2026-09-20T14:15:00Z'
  });

  // Store 3: Kiez-Verteilerstation Brunnenviertel (Mitte)
  storeModel.createStore({
    bezirk_id: districtMap.get('Mitte')!,
    name: 'Kiez-Verteilerstation Brunnenviertel',
    str: 'Brunnenstraße 115',
    plz: '13355',
    stadt: 'Berlin',
    lat: 52.5412,
    lon: 13.3934,
    public_info: 'Zugang über Nachbarschaftsladen im Hochparterre.',
    ansprechpartner: 'Herr Demir (Freiwilligenkoordination)',
    telefon: '030 456789-9',
    giving_details: {
      public_contact_name: 'Infocafé Brunnenviertel',
      public_phone: '030 456789-0',
      website: 'https://nachbarschaft-brunnenviertel.example.org',
      dropoff_times: 'Mo-Fr 10:00 - 18:00 Uhr',
      accepted_items: 'Obst, Gemüse, Backwaren, ungekühlte Lebensmittel',
      registration_required: 0, // Ohne Voranmeldung
      recipient_count: 'ca. 70 Nachbar:innen täglich',
      giving_status: GivingStatus.CURRENT,
      last_contact_at: '2026-10-01T11:00:00Z'
    }
  });

  // Store 4: Wärmestube & Kleiderkammer Neukölln (Neukölln)
  storeModel.createStore({
    bezirk_id: districtMap.get('Neukölln')!,
    name: 'Wärmestube & Notausgabe Neukölln',
    str: 'Körnerstraße 48',
    plz: '12051',
    stadt: 'Berlin',
    lat: 52.4720,
    lon: 13.4380,
    public_info: 'Hinterer Pavillon im Garten.',
    ansprechpartner: 'Team Wärmestube',
    telefon: '030 68102030',
    giving_details: {
      public_contact_name: 'Diensthabende Schichtleitung',
      public_phone: '030 68102030',
      website: 'https://waermestube-neukoelln.example.org',
      dropoff_times: 'Täglich ab 11:00 bis 19:00 Uhr',
      accepted_items: 'Suppenzutaten, Fleisch, Gemüse, Brot, Süßwaren',
      registration_required: 0, // Ohne Voranmeldung
      recipient_count: 'ca. 180 Personen',
      giving_status: GivingStatus.CURRENT,
      last_contact_at: null // Nie kontaktiert -> erscheint ganz oben in Maintenance
    }
  });

  // 4. Pre-assign Manager Role for Berlin Lead (Parent Region)
  userRoleModel.assignRole('berlin_lead', berlin.id, UserRoleType.WORKGROUP_GIVING_STORES);

  console.log('✅ Seeding completed: 1 parent region, 12 districts, 4 stores, contact logs and manager role initialized.');
}

// CLI execution helper
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  const db = getDatabase();
  seedInitialData(db);
  process.exit(0);
}
