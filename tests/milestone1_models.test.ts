import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { RegionModel } from '../src/server/db/models/regions';
import { StoreModel } from '../src/server/db/models/stores';
import { ContactLogModel } from '../src/server/db/models/contactLog';
import { SuggestionModel } from '../src/server/db/models/suggestions';
import { UserRoleModel } from '../src/server/db/models/userRoles';
import { GivingStatus, StoreStatus, SuggestionStatus, UserRoleType } from '@shared/types';

describe('Milestone 1 — Database Schema & Core Entities (1:1 FS-Compatible)', () => {
  let db: DatabaseType;
  let regionModel: RegionModel;
  let storeModel: StoreModel;
  let contactLogModel: ContactLogModel;
  let suggestionModel: SuggestionModel;
  let userRoleModel: UserRoleModel;

  beforeEach(() => {
    // In-memory SQLite for isolated, ultra-fast tests
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../src/server/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    regionModel = new RegionModel(db);
    storeModel = new StoreModel(db);
    contactLogModel = new ContactLogModel(db);
    suggestionModel = new SuggestionModel(db);
    userRoleModel = new UserRoleModel(db);
  });

  afterEach(() => {
    db.close();
  });

  it('1. Region Hierarchy: correctly links parent/child regions and traverses ancestors', () => {
    const berlin = regionModel.createRegion({ name: 'Berlin (Landesbezirk)', type: 1, external_fs_bezirk_id: 1 });
    const pankow = regionModel.createRegion({ name: 'Pankow', parent_id: berlin.id, type: 2, external_fs_bezirk_id: 11 });
    const pberg = regionModel.createRegion({ name: 'Prenzlauer Berg', parent_id: pankow.id, type: 3 });

    expect(berlin.id).toBeDefined();
    expect(pankow.parent_id).toBe(berlin.id);
    expect(pberg.parent_id).toBe(pankow.id);

    // Test Ancestors for Prenzlauer Berg
    const ancestors = regionModel.getRegionAncestorIds(pberg.id);
    expect(ancestors).toEqual([pberg.id, pankow.id, berlin.id]);

    // Test Descendants for Berlin
    const descendants = regionModel.getRegionDescendantIds(berlin.id);
    expect(descendants).toContain(berlin.id);
    expect(descendants).toContain(pankow.id);
    expect(descendants).toContain(pberg.id);
  });

  it('2. Store & 1:1 Giving Details: creates store and isolates internal contacts', () => {
    const berlin = regionModel.createRegion({ name: 'Berlin' });

    const store = storeModel.createStore({
      bezirk_id: berlin.id,
      name: 'Suppenküche Pankow',
      str: 'Berliner Str. 12',
      plz: '13187',
      stadt: 'Berlin',
      lat: 52.56,
      lon: 13.41,
      public_info: 'Hinterhof, linke Tür',
      ansprechpartner: 'Frau Schmidt (Personal)', // CONFIDENTIAL
      telefon: '030 12345678 (Direktwahl)',      // CONFIDENTIAL
      giving_details: {
        public_contact_name: 'Pforte',
        public_phone: '030 999999',
        website: 'https://example.org',
        dropoff_times: 'Mo-Fr 10-14 Uhr',
        accepted_items: 'Backwaren, Obst',
        registration_required: 0,
        recipient_count: 'ca. 50 Gäste',
        giving_status: GivingStatus.CURRENT
      }
    });

    expect(store.id).toBeDefined();
    expect(store.ansprechpartner).toBe('Frau Schmidt (Personal)');
    expect(store.giving_details.public_contact_name).toBe('Pforte');
    expect(store.giving_details.giving_status).toBe(GivingStatus.CURRENT);

    // Verify sanitization for public access
    const publicStore = storeModel.sanitizeStoreForPublic(store);
    expect((publicStore as any).ansprechpartner).toBeUndefined();
    expect((publicStore as any).telefon).toBeUndefined();
    expect(publicStore.giving_details.public_contact_name).toBe('Pforte');
  });

  it('3. Contact Log & Auto-Update: logs outreach and auto-updates last_contact_at', () => {
    const berlin = regionModel.createRegion({ name: 'Berlin' });
    const store = storeModel.createStore({
      bezirk_id: berlin.id,
      name: 'Kiezküche Mitte',
      giving_details: {
        giving_status: GivingStatus.IN_REVIEW,
        last_contact_at: null
      }
    });

    expect(store.giving_details.last_contact_at).toBeNull();
    expect(store.giving_details.giving_status).toBe(GivingStatus.IN_REVIEW);

    const logEntry = contactLogModel.addContactLogEntry({
      store_id: store.id,
      author_user_id: 'user_123',
      author_name: 'Alex Coordinator',
      channel: 'Telefon',
      contact_person: 'Herr Meyer',
      note: 'Hat bestätigt, dass weiterhin Lebensmittel angenommen werden.',
      confirmed_current: true,
      contacted_at: '2026-10-28T14:00:00Z'
    });

    expect(logEntry.id).toBeDefined();

    // Verify store's last_contact_at was updated and status became CURRENT
    const updatedStore = storeModel.getInternalStoreById(store.id)!;
    expect(updatedStore.giving_details.last_contact_at).toBe('2026-10-28T14:00:00Z');
    expect(updatedStore.giving_details.giving_status).toBe(GivingStatus.CURRENT);
  });

  it('4. Suggestions & Approval: reviews suggestion and mutates store in atomic transaction', () => {
    const berlin = regionModel.createRegion({ name: 'Berlin' });

    // Submit a suggestion for a new store
    const suggestion = suggestionModel.createSuggestion({
      region_id: berlin.id,
      author_user_id: 'volunteer_42',
      author_email: 'volunteer@example.org',
      payload: {
        name: 'Neue Ausgabestelle Neukölln',
        street: 'Karl-Marx-Str. 50',
        city: 'Berlin',
        postalCode: '12043',
        dropoffTimes: 'Sa 12:00-16:00 Uhr',
        registrationRequired: false,
        givingStatus: GivingStatus.CURRENT
      },
      author_note: 'Vor Ort mit den Betreibern gesprochen'
    });

    expect(suggestion.status).toBe(SuggestionStatus.PENDING);

    // Review & Approve
    const { suggestion: approved, storeId } = suggestionModel.reviewSuggestion(
      suggestion.id,
      'manager_99',
      SuggestionStatus.APPROVED,
      'Geprüft und freigegeben'
    );

    expect(approved.status).toBe(SuggestionStatus.APPROVED);
    expect(approved.reviewed_by_user_id).toBe('manager_99');
    expect(storeId).toBeDefined();

    // Verify store was created
    const createdStore = storeModel.getInternalStoreById(storeId!)!;
    expect(createdStore.name).toBe('Neue Ausgabestelle Neukölln');
    expect(createdStore.giving_details.dropoff_times).toBe('Sa 12:00-16:00 Uhr');
  });

  it('5. RBAC & Parent-Region Inheritance: parent role inherits down to all child districts', () => {
    const berlin = regionModel.createRegion({ name: 'Berlin (Landesbezirk)' });
    const mitte = regionModel.createRegion({ name: 'Mitte', parent_id: berlin.id });
    const wedding = regionModel.createRegion({ name: 'Wedding', parent_id: mitte.id });
    const hamburg = regionModel.createRegion({ name: 'Hamburg' });

    // Assign AG Abgabestellen role ONLY to Berlin (Landesbezirk)
    userRoleModel.assignRole('user_berlin_lead', berlin.id, UserRoleType.WORKGROUP_GIVING_STORES);

    // Check permissions
    // 1. Should have permission in Berlin
    expect(userRoleModel.hasPermissionInRegion('user_berlin_lead', berlin.id)).toBe(true);
    // 2. Should inherit permission down to Mitte
    expect(userRoleModel.hasPermissionInRegion('user_berlin_lead', mitte.id)).toBe(true);
    // 3. Should inherit permission down to Wedding (grandchild)
    expect(userRoleModel.hasPermissionInRegion('user_berlin_lead', wedding.id)).toBe(true);
    // 4. Must NOT have permission in unrelated Hamburg
    expect(userRoleModel.hasPermissionInRegion('user_berlin_lead', hamburg.id)).toBe(false);
  });

  it('6. Cryptographic Invite Tokens: creates high-entropy token and redeems once', () => {
    const berlin = regionModel.createRegion({ name: 'Berlin' });

    const { rawToken, expiresAt } = userRoleModel.createInviteToken({
      region_id: berlin.id,
      created_by_user_id: 'admin_1',
      target_role: UserRoleType.WORKGROUP_GIVING_STORES
    });

    expect(rawToken.length).toBe(64); // 32 bytes hex
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Redeem token
    const result = userRoleModel.redeemInviteToken(rawToken, 'new_volunteer_101');
    expect(result.success).toBe(true);
    expect(result.role).toBe(UserRoleType.WORKGROUP_GIVING_STORES);

    // Verify role is now assigned
    expect(userRoleModel.hasPermissionInRegion('new_volunteer_101', berlin.id)).toBe(true);

    // Attempting to redeem again must fail
    const replay = userRoleModel.redeemInviteToken(rawToken, 'imposter_999');
    expect(replay.success).toBe(false);
  });
});
