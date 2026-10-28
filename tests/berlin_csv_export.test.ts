import { describe, it, expect, beforeEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse/sync';
import { buildApp } from '../src/server/app';
import { RegionModel } from '../src/server/db/models/regions';
import { StoreModel } from '../src/server/db/models/stores';
import { ContactLogModel } from '../src/server/db/models/contactLog';
import { UserRoleModel } from '../src/server/db/models/userRoles';
import { UserRoleType } from '../src/shared/types';

describe('Feature 1 & 2 — 1-Click Berlin CSV Export & Suggestion Confirmation', () => {
  let db: DatabaseType;
  let app: FastifyInstance;
  let regionModel: RegionModel;
  let storeModel: StoreModel;
  let contactLogModel: ContactLogModel;
  let userRoleModel: UserRoleModel;

  let berlinId: number;
  let pankowId: number;
  let hamburgId: number;
  let store1Id: number;
  let store2Id: number;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../src/server/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    regionModel = new RegionModel(db);
    storeModel = new StoreModel(db);
    contactLogModel = new ContactLogModel(db);
    userRoleModel = new UserRoleModel(db);

    // 1. Setup Regions: Berlin (Parent) -> Pankow (Child), plus separate Hamburg
    const berlin = regionModel.createRegion({ name: 'Berlin (Landesbezirk)', type: 1, lat: 52.52, lon: 13.405 });
    berlinId = berlin.id;

    const pankow = regionModel.createRegion({ name: 'Pankow', parent_id: berlinId, type: 2, lat: 52.56, lon: 13.40 });
    pankowId = pankow.id;

    const hamburg = regionModel.createRegion({ name: 'Hamburg', type: 1, lat: 53.55, lon: 9.99 });
    hamburgId = hamburg.id;

    // 2. Assign Manager Roles
    userRoleModel.assignRole('berlin-coordinator', berlinId, UserRoleType.WORKGROUP_GIVING_STORES);
    userRoleModel.assignRole('hamburg-coordinator', hamburgId, UserRoleType.WORKGROUP_GIVING_STORES);

    // 3. Create sample stores in Pankow with internal confidential details
    const store1 = storeModel.createStore({
      bezirk_id: pankowId,
      name: 'Suppenküche Pankow Zentrum',
      str: 'Berliner Str. 42',
      plz: '13187',
      stadt: 'Berlin',
      lat: 52.568,
      lon: 13.402,
      public_info: 'Eingang im Hinterhof barrierefrei',
      ansprechpartner: 'Frau Dr. Claudia Müller (Heimleitung)', // STRICTLY CONFIDENTIAL
      telefon: '030 987654321 (Privatdurchwahl)',                 // STRICTLY CONFIDENTIAL
      giving_details: {
        dropoff_times: 'Mo-Fr 08:00 - 15:00 Uhr',
        accepted_items: 'Obst, Gemüse, Backwaren, ungekühlte Lebensmittel',
        registration_required: 1,
        public_phone: '030 987654321',
        public_contact_name: 'Pforte',
        website: 'https://suppenkueche-pankow.example.org',
        recipient_count: '65',
        last_contact_at: '2026-02-20'
      }
    });
    store1Id = store1.id;

    // Add contact log with remarks & stand
    contactLogModel.addContactLogEntry({
      store_id: store1Id,
      author_user_id: 'coordinator:AG',
      author_name: 'Koordinator (AG)',
      channel: 'Telefon',
      note: 'Bemerkungen: 2 große Kühlschränke vorhanden | Stand: 20.2.26 AG',
      contacted_at: '2026-02-20'
    });

    const store2 = storeModel.createStore({
      bezirk_id: pankowId,
      name: 'Verteilerstation Prenzlauer Berg',
      str: 'Danziger Str. 10',
      plz: '10435',
      stadt: 'Berlin',
      lat: 52.539,
      lon: 13.419,
      public_info: '',
      ansprechpartner: 'Herr Alexander Vertraulich',
      telefon: '0171 99887766', // Mobile number
      giving_details: {
        dropoff_times: 'Rund um die Uhr',
        accepted_items: 'Alles essbare',
        registration_required: 0,
        public_phone: '',
        website: '',
        recipient_count: '120',
        last_contact_at: '2026-06-15'
      }
    });
    store2Id = store2.id;

    app = buildApp(db, { logger: false });
    await app.ready();
  });

  // --- FEATURE 1: 1-CLICK BERLIN CSV EXPORT ---

  it('1. CSV Export: Unauthenticated public visitor is BLOCKED with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/regions/${berlinId}/export-berlin.csv`
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('2. CSV Export: Standard Foodsaver (non-manager) is BLOCKED with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/regions/${berlinId}/export-berlin.csv`,
      headers: {
        authorization: 'Bearer test:volunteer_bob:bob@foodsharing.de:false'
      }
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('3. CSV Export: Hamburg manager CANNOT export Berlin stores (Blocked with 403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/regions/${berlinId}/export-berlin.csv`,
      headers: {
        authorization: 'Bearer test:hamburg-coordinator:hamburg@foodsharing.de:false'
      }
    });

    expect(res.statusCode).toBe(403);
  });

  it('4. CSV Export: Authorized Berlin Manager receives valid 16-column CSV with UTF-8 BOM & confidential fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/regions/${berlinId}/export-berlin.csv`,
      headers: {
        authorization: 'Bearer test:berlin-coordinator:berlin@foodsharing.de:false'
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.csv');

    const csvRaw = res.body;

    // Check UTF-8 BOM (\uFEFF) for Excel compatibility
    expect(csvRaw.charCodeAt(0)).toBe(0xFEFF);

    // Strip BOM and parse CSV
    const parsed: string[][] = parse(csvRaw.slice(1), {
      relax_column_count: false
    });

    // Verify 16 EXACT column headers matching original Berlin spreadsheet
    const expectedHeaders = [
      'Abgabestelle (schwarz:aktualisiert, rot:in Aktualisierung, lila: momentan außer Betrieb)',
      'Anschrift',
      'PLZ',
      'Großbezirk',
      'Ortsteil',
      'AnsprechpartnerIn',
      'Telefon',
      'Wann können Lebensmittel abgegeben werden?',
      'Was wird angenommen?',
      'vorherige telefon. Anmeldung nötig?',
      'Anzahl Abnehmer*innen',
      'Bemerkungen',
      'Webseite',
      'Stand',
      'latitude',
      'longitude'
    ];

    expect(parsed[0]).toEqual(expectedHeaders);
    expect(parsed[0].length).toBe(16);

    // 2 data rows exported
    expect(parsed.length).toBe(3); // 1 header + 2 stores

    // Check store 1 row
    const row1 = parsed.find(r => r[0] === 'Suppenküche Pankow Zentrum');
    expect(row1).toBeDefined();
    expect(row1!.length).toBe(16);
    expect(row1![1]).toBe('Berliner Str. 42');
    expect(row1![2]).toBe('13187');
    expect(row1![3]).toBe('Pankow'); // Sub-district inherited down from Berlin
    expect(row1![5]).toBe('Frau Dr. Claudia Müller (Heimleitung)'); // Strictly confidential included for manager!
    expect(row1![6]).toBe('030 987654321 (Privatdurchwahl)');        // Strictly confidential included for manager!
    expect(row1![7]).toBe('Mo-Fr 08:00 - 15:00 Uhr');
    expect(row1![8]).toBe('Obst, Gemüse, Backwaren, ungekühlte Lebensmittel');
    expect(row1![9]).toBe('TRUE');
    expect(row1![10]).toBe('65');
    expect(row1![11]).toBe('2 große Kühlschränke vorhanden');
    expect(row1![12]).toBe('https://suppenkueche-pankow.example.org');
    expect(row1![13]).toBe('20.2.26 AG');
    expect(row1![14]).toBe('52.568');
    expect(row1![15]).toBe('13.402');

    // Check store 2 row
    const row2 = parsed.find(r => r[0] === 'Verteilerstation Prenzlauer Berg');
    expect(row2).toBeDefined();
    expect(row2![5]).toBe('Herr Alexander Vertraulich');
    expect(row2![6]).toBe('0171 99887766'); // Confidential mobile phone included for manager
    expect(row2![9]).toBe('FALSE');
  });

  // --- FEATURE 2: SUBMITTER CONFIRMATION & DIRECT EDIT ---

  it('5. Submitter Confirmation: POST /api/giving-stores/:id/suggestions returns clear confirmation message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/giving-stores/${store1Id}/suggestions`,
      headers: {
        authorization: 'Bearer test:volunteer_alice:alice@foodsharing.de:false'
      },
      payload: {
        payload: {
          name: 'Suppenküche Pankow Zentrum',
          dropoffTimes: 'Mo-So 07:00 - 18:00 Uhr',
          acceptedItems: 'Alles frische',
          registrationRequired: true
        },
        author_note: 'Habe heute mit der Leitung gesprochen'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message).toBe('Vielen Dank! Dein Vorschlag wurde gespeichert und liegt nun im Prüf-Eingang der AG Abgabestellen.');
    expect(body.author_user_id).toBe('volunteer_alice');
    expect(body.author_email).toBe('alice@foodsharing.de');
  });

  it('6. Submitter Confirmation: POST /api/regions/:id/suggestions returns clear confirmation message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/regions/${pankowId}/suggestions`,
      headers: {
        authorization: 'Bearer test:volunteer_bob:bob@foodsharing.de:false'
      },
      payload: {
        payload: {
          name: 'Neue Kiez-Abgabestelle Florastr.',
          street: 'Florastr. 12',
          postalCode: '13187',
          dropoffTimes: 'Di 10-12',
          acceptedItems: 'Backwaren',
          registrationRequired: false
        },
        author_note: 'Neu gegründet'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message).toBe('Vielen Dank! Dein Vorschlag wurde gespeichert und liegt nun im Prüf-Eingang der AG Abgabestellen.');
    expect(body.author_user_id).toBe('volunteer_bob');
  });

  it('7. Direct Edit (AG-Modus): Manager can directly and atomically update core & giving details via PATCH', async () => {
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/giving-stores/${store1Id}`,
      headers: {
        authorization: 'Bearer test:berlin-coordinator:berlin@foodsharing.de:false'
      },
      payload: {
        name: 'Suppenküche Pankow (Aktualisiert durch AG)',
        ansprechpartner: 'Frau Dr. Claudia Müller (Neu ernannt)',
        telefon: '030 11223344',
        giving_details: {
          dropoff_times: 'Täglich 09:00 - 18:00 Uhr (Neuer Plan)',
          accepted_items: 'Obst, Gemüse, Backwaren & Konserven',
          registration_required: 0
        }
      }
    });

    expect(patchRes.statusCode).toBe(200);
    const updated = patchRes.json();
    expect(updated.name).toBe('Suppenküche Pankow (Aktualisiert durch AG)');
    expect(updated.ansprechpartner).toBe('Frau Dr. Claudia Müller (Neu ernannt)');
    expect(updated.telefon).toBe('030 11223344');
    expect(updated.giving_details.dropoff_times).toBe('Täglich 09:00 - 18:00 Uhr (Neuer Plan)');
    expect(updated.giving_details.registration_required).toBe(0);

    // Verify it is directly updated in the database without any pending suggestion
    const rawDb = db.prepare('SELECT name, ansprechpartner FROM fs_betrieb WHERE id = ?').get(store1Id) as any;
    expect(rawDb.name).toBe('Suppenküche Pankow (Aktualisiert durch AG)');
    expect(rawDb.ansprechpartner).toBe('Frau Dr. Claudia Müller (Neu ernannt)');
  });
});
