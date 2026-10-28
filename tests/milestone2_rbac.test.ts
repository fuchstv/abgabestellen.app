import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server/app';
import { RegionModel } from '../src/server/db/models/regions';
import { StoreModel } from '../src/server/db/models/stores';
import { ContactLogModel } from '../src/server/db/models/contactLog';
import { UserRoleModel } from '../src/server/db/models/userRoles';
import { UserRoleType, GivingStatus } from '@shared/types';

describe('Milestone 2 — Security & RBAC Middleware (Zero Data Leakage Proof)', () => {
  let db: DatabaseType;
  let app: FastifyInstance;
  let regionModel: RegionModel;
  let storeModel: StoreModel;
  let contactLogModel: ContactLogModel;
  let userRoleModel: UserRoleModel;

  let berlinId: number;
  let pankowId: number;
  let hamburgId: number;
  let storePankowId: number;

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

    // Setup regions: Berlin (Parent) -> Pankow (Child), and unrelated Hamburg
    const berlin = regionModel.createRegion({ name: 'Berlin (Landesbezirk)', type: 1 });
    berlinId = berlin.id;

    const pankow = regionModel.createRegion({ name: 'Pankow', parent_id: berlinId, type: 2 });
    pankowId = pankow.id;

    const hamburg = regionModel.createRegion({ name: 'Hamburg', type: 1 });
    hamburgId = hamburg.id;

    // Create a store in Pankow with strictly confidential internal data
    const store = storeModel.createStore({
      bezirk_id: pankowId,
      name: 'Suppenküche Pankow Zentrum',
      str: 'Berliner Str. 42',
      plz: '13187',
      stadt: 'Berlin',
      lat: 52.568,
      lon: 13.402,
      public_info: 'Eingang barrierefrei im Innenhof',
      ansprechpartner: 'Frau Dr. Claudia Vertraulich (Heimleitung)', // CONFIDENTIAL
      telefon: '030 987654321 (Privatdurchwahl)',                    // CONFIDENTIAL
      giving_details: {
        public_contact_name: 'Pforte / Empfang',
        public_phone: '030 111222',
        website: 'https://suppenkueche-pankow.example.org',
        dropoff_times: 'Täglich 09:00 - 14:00 Uhr',
        accepted_items: 'Backwaren, verpackte Lebensmittel',
        registration_required: 0,
        giving_status: GivingStatus.CURRENT
      }
    });
    storePankowId = store.id;

    // Add an internal audit contact log
    contactLogModel.addContactLogEntry({
      store_id: storePankowId,
      author_user_id: 'internal_agent',
      author_name: 'Max Coordinator',
      channel: 'Telefon',
      contact_person: 'Frau Dr. Claudia Vertraulich',
      note: 'Interne Abstimmung: Keine Milchprodukte im Sommer annehmen.',
      confirmed_current: true
    });

    // Assign roles:
    // 1. Volunteer with standard FOODSAVER role only
    userRoleModel.assignRole('volunteer_regular', berlinId, UserRoleType.FOODSAVER);

    // 2. Berlin Region Lead (assigned to parent region Berlin)
    userRoleModel.assignRole('berlin_lead', berlinId, UserRoleType.WORKGROUP_GIVING_STORES);

    // 3. Hamburg Manager (unrelated region)
    userRoleModel.assignRole('hamburg_lead', hamburgId, UserRoleType.WORKGROUP_GIVING_STORES);

    app = buildApp(db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. Public Visitor (No Auth): CAN read public drop-off details, but receives ZERO confidential data', async () => {
    // 1.1 Region store listing
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/regions/${pankowId}/giving-stores`
    });
    expect(listRes.statusCode).toBe(200);
    const stores = listRes.json();
    expect(stores.length).toBe(1);
    const store = stores[0];

    // Public fields present
    expect(store.name).toBe('Suppenküche Pankow Zentrum');
    expect(store.giving_details.public_contact_name).toBe('Pforte / Empfang');
    expect(store.giving_details.dropoff_times).toBe('Täglich 09:00 - 14:00 Uhr');

    // ZERO LEAKAGE: Internal fields must NOT exist in JSON
    expect(store.ansprechpartner).toBeUndefined();
    expect(store.telefon).toBeUndefined();
    expect(store.contact_logs).toBeUndefined();

    // 1.2 Store detail view
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/giving-stores/${storePankowId}`
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.permissions.canManageStore).toBe(false);
    expect(detail.permissions.canViewContactLog).toBe(false);
    expect(detail.permissions.canViewInternalContacts).toBe(false);

    expect(detail.store.ansprechpartner).toBeUndefined();
    expect(detail.store.telefon).toBeUndefined();
    expect(detail.store.contact_logs).toBeUndefined();
  });

  it('2. Regular Foodsaver: CANNOT read internal contacts or contact logs (Zero Leakage)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/giving-stores/${storePankowId}`,
      headers: {
        authorization: 'Bearer test:volunteer_regular:volunteer@foodsharing.de:false'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.permissions.canManageStore).toBe(false);
    expect(body.permissions.canViewInternalContacts).toBe(false);
    expect(body.permissions.canSubmitSuggestion).toBe(true);

    // Verifying zero data leakage
    expect(body.store.ansprechpartner).toBeUndefined();
    expect(body.store.telefon).toBeUndefined();
    expect(body.store.contact_logs).toBeUndefined();
  });

  it('3. Regular Foodsaver: BLOCKED with 403 Forbidden when trying to access or add contact log', async () => {
    // Attempt to GET contact log
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/giving-stores/${storePankowId}/contact-log`,
      headers: {
        authorization: 'Bearer test:volunteer_regular:volunteer@foodsharing.de:false'
      }
    });
    expect(getRes.statusCode).toBe(403);

    // Attempt to POST contact log
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/giving-stores/${storePankowId}/contact-log`,
      headers: {
        authorization: 'Bearer test:volunteer_regular:volunteer@foodsharing.de:false'
      },
      payload: {
        note: 'Versuch als normaler Nutzer ein Protokoll zu erfassen'
      }
    });
    expect(postRes.statusCode).toBe(403);
  });

  it('4. Parent Region Manager (Berlin): INHERITS permission down to Pankow store and CAN view internal contacts & logs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/giving-stores/${storePankowId}`,
      headers: {
        authorization: 'Bearer test:berlin_lead:lead@foodsharing.berlin:false'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.permissions.canManageStore).toBe(true);
    expect(body.permissions.canViewInternalContacts).toBe(true);
    expect(body.permissions.canViewContactLog).toBe(true);

    // Confidential fields ARE visible to authorized manager
    expect(body.store.ansprechpartner).toBe('Frau Dr. Claudia Vertraulich (Heimleitung)');
    expect(body.store.telefon).toBe('030 987654321 (Privatdurchwahl)');
    expect(body.store.contact_logs).toBeDefined();
    expect(body.store.contact_logs.length).toBe(1);
    expect(body.store.contact_logs[0].contact_person).toBe('Frau Dr. Claudia Vertraulich');
  });

  it('5. Unrelated Region Manager (Hamburg): BLOCKED with 403 Forbidden from accessing Pankow internal data', async () => {
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/giving-stores/${storePankowId}/contact-log`,
      headers: {
        authorization: 'Bearer test:hamburg_lead:lead@foodsharing.hamburg:false'
      }
    });
    expect(getRes.statusCode).toBe(403);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/giving-stores/${storePankowId}`,
      headers: {
        authorization: 'Bearer test:hamburg_lead:lead@foodsharing.hamburg:false'
      },
      payload: {
        ansprechpartner: 'Versuch Überschreiben'
      }
    });
    expect(patchRes.statusCode).toBe(403);
  });
});
