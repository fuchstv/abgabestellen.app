import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server/app';
import { RegionModel } from '../src/server/db/models/regions';
import { StoreModel } from '../src/server/db/models/stores';
import { UserRoleModel } from '../src/server/db/models/userRoles';
import { GivingStatus, UserRoleType } from '@shared/types';

describe('Milestone 3 — Workflow APIs & Opt-In District Updates', () => {
  let db: DatabaseType;
  let app: FastifyInstance;
  let regionModel: RegionModel;
  let storeModel: StoreModel;
  let userRoleModel: UserRoleModel;

  let berlinId: number;
  let mitteId: number;
  let openStoreId: number;
  let regRequiredStoreId: number;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../src/server/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    regionModel = new RegionModel(db);
    storeModel = new StoreModel(db);
    userRoleModel = new UserRoleModel(db);

    const berlin = regionModel.createRegion({ name: 'Berlin', type: 1 });
    berlinId = berlin.id;

    const mitte = regionModel.createRegion({ name: 'Mitte', parent_id: berlinId, type: 2 });
    mitteId = mitte.id;

    // Store 1: Open without registration required
    const openStore = storeModel.createStore({
      bezirk_id: mitteId,
      name: 'Freie Verteilerstation Mitte',
      giving_details: {
        registration_required: 0,
        giving_status: GivingStatus.CURRENT,
        dropoff_times: '24/7 zugänglich'
      }
    });
    openStoreId = openStore.id;

    // Store 2: Phone registration strictly required
    const regStore = storeModel.createStore({
      bezirk_id: mitteId,
      name: 'Sozialzentrum Torstraße',
      giving_details: {
        registration_required: 1,
        giving_status: GivingStatus.CURRENT,
        dropoff_times: 'Mo-Fr 10-12 Uhr nach Voranmeldung'
      }
    });
    regRequiredStoreId = regStore.id;

    // Assign manager role
    userRoleModel.assignRole('manager_berlin', berlinId, UserRoleType.WORKGROUP_GIVING_STORES);

    app = buildApp(db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. GET /api/regions/:id/giving-stores filter: ?registration_required=false returns only drop-off points without prior notice', async () => {
    // Filter without registration
    const resFiltered = await app.inject({
      method: 'GET',
      url: `/api/regions/${mitteId}/giving-stores?registration_required=false`
    });

    expect(resFiltered.statusCode).toBe(200);
    const stores = resFiltered.json();
    expect(stores.length).toBe(1);
    expect(stores[0].id).toBe(openStoreId);
    expect(stores[0].giving_details.registration_required).toBe(0);

    // Filter with registration only
    const resRegOnly = await app.inject({
      method: 'GET',
      url: `/api/regions/${mitteId}/giving-stores?registration_required=true`
    });

    expect(resRegOnly.statusCode).toBe(200);
    const regStores = resRegOnly.json();
    expect(regStores.length).toBe(1);
    expect(regStores[0].id).toBe(regRequiredStoreId);
  });

  it('2. Suggestion Workflow: submit change -> manager approves -> auto-applies to store details and updates feed', async () => {
    // Submit change suggestion as foodsaver
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/giving-stores/${openStoreId}/suggestions`,
      headers: {
        authorization: 'Bearer test:volunteer_1:v1@foodsharing.de:false'
      },
      payload: {
        payload: {
          dropoffTimes: 'Neue Zeiten: Mo-So 08:00 - 20:00 Uhr',
          acceptedItems: 'Obst, Gemüse, Backwaren, keine Kühlware',
          publicContactName: 'Kiezkoordination'
        },
        author_note: 'Öffnungszeiten am Eingangsschild fotografiert'
      }
    });

    expect(submitRes.statusCode).toBe(201);
    const suggestion = submitRes.json();
    expect(suggestion.id).toBeDefined();
    expect(suggestion.status).toBe(0); // PENDING

    // Manager reviews and approves
    const reviewRes = await app.inject({
      method: 'POST',
      url: `/api/suggestions/${suggestion.id}/review`,
      headers: {
        authorization: 'Bearer test:manager_berlin:manager@foodsharing.berlin:false'
      },
      payload: {
        decision: 'APPROVED',
        review_note: 'Foto verifiziert und übernommen'
      }
    });

    expect(reviewRes.statusCode).toBe(200);

    // Verify store has new details
    const storeRes = await app.inject({
      method: 'GET',
      url: `/api/giving-stores/${openStoreId}`
    });
    const store = storeRes.json().store;
    expect(store.giving_details.dropoff_times).toBe('Neue Zeiten: Mo-So 08:00 - 20:00 Uhr');
    expect(store.giving_details.public_contact_name).toBe('Kiezkoordination');

    // Verify item appeared in regional update feed (GIVING_STORES_UPDATES)
    const feedRes = await app.inject({
      method: 'GET',
      url: `/api/regions/${mitteId}/feed`
    });
    const feed = feedRes.json();
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items[0].store_id).toBe(openStoreId);
  });

  it('3. Maintenance Dashboard: GET /api/maintenance/overdue-contacts sorts by oldest/missing contact', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maintenance/overdue-contacts?region_id=${mitteId}`,
      headers: {
        authorization: 'Bearer test:manager_berlin:manager@foodsharing.berlin:false'
      }
    });

    expect(res.statusCode).toBe(200);
    const overdue = res.json();
    expect(overdue.length).toBe(2);
    // Uncontacted stores appear first
    expect(overdue[0].last_contact_at).toBeNull();
  });

  it('4. District Feeds & Subscription: GeoJSON feed and subscriber registration', async () => {
    // GeoJSON feed
    const geoRes = await app.inject({
      method: 'GET',
      url: `/api/regions/${mitteId}/feed.geojson`
    });
    expect(geoRes.statusCode).toBe(200);
    expect(geoRes.headers['content-type']).toContain('application/geo+json');
    const geojson = geoRes.json();
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBe(2);

    // Email subscription
    const subRes = await app.inject({
      method: 'POST',
      url: `/api/regions/${mitteId}/subscribe`,
      payload: {
        email: 'buerger@mitte-berlin.de'
      }
    });
    expect(subRes.statusCode).toBe(200);
    expect(subRes.json().success).toBe(true);
  });
});
