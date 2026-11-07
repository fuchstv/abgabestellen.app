import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server/app';
import { bootstrapProductionState } from '../src/server/index';
import { RegionModel } from '../src/server/db/models/regions';
import { StoreModel } from '../src/server/db/models/stores';
import { SuggestionModel } from '../src/server/db/models/suggestions';
import { UserRoleModel } from '../src/server/db/models/userRoles';
import { GivingStatus, UserRoleType } from '../src/shared/types';

describe('Verification Ampel Priority, Team Admin & Instant Access Revocation', () => {
  let db: DatabaseType;
  let app: FastifyInstance;
  let regionModel: RegionModel;
  let storeModel: StoreModel;
  let suggestionModel: SuggestionModel;
  let userRoleModel: UserRoleModel;

  let berlinId: number;
  let mitteId: number;
  let pankowId: number;

  beforeEach(async () => {
    process.env.INITIAL_ORGA_SECRET = 'test-orga-secret-xyz';
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../src/server/db/schema.sql');
    db.exec(fs.readFileSync(schemaPath, 'utf8'));

    regionModel = new RegionModel(db);
    storeModel = new StoreModel(db);
    suggestionModel = new SuggestionModel(db);
    userRoleModel = new UserRoleModel(db);

    const berlin = regionModel.createRegion({ name: 'Berlin (Landesbezirk)', type: 1 });
    berlinId = berlin.id;
    mitteId = regionModel.createRegion({ name: 'Mitte', parent_id: berlinId, type: 2 }).id;
    pankowId = regionModel.createRegion({ name: 'Pankow', parent_id: berlinId, type: 2 }).id;

    app = buildApp(db, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. bootstrapProductionState provisions fuchstv@googlemail.com as global ORGA and cleans empty Teststadt regions', () => {
    const testCity = regionModel.createRegion({ name: 'Teststadt (Landesbezirk)', type: 1 });
    regionModel.createRegion({ name: 'BezirkA', parent_id: testCity.id, type: 2 });
    userRoleModel.assignRole('berlin_lead', berlinId, UserRoleType.WORKGROUP_GIVING_STORES);

    const changed = bootstrapProductionState(db);
    expect(changed).toBe(true);

    // Teststadt and BezirkA removed
    const remainingNames = regionModel.getAllRegions().map(r => r.name);
    expect(remainingNames).not.toContain('Teststadt (Landesbezirk)');
    expect(remainingNames).not.toContain('BezirkA');
    expect(remainingNames).toContain('Berlin (Landesbezirk)');

    // fuchstv@googlemail.com provisioned as active superadmin with ORGA role
    const adminRow = db
      .prepare('SELECT * FROM fs_user WHERE email = ?')
      .get('fuchstv@googlemail.com') as any;
    expect(adminRow).toBeDefined();
    expect(adminRow.is_super_admin).toBe(1);
    expect(adminRow.is_active).toBe(1);
    expect(userRoleModel.isGlobalOrga(adminRow.id)).toBe(true);
  });

  it('2. Need-Based Sorting ("Nach Bedarf"): orders Urgent -> Overdue/Never -> Yellow -> Green -> Paused/(INAKTIV)', async () => {
    userRoleModel.assignRole('coord_berlin', berlinId, UserRoleType.WORKGROUP_GIVING_STORES);

    const now = Date.now();
    const daysAgo = (d: number) => new Date(now - d * 86400 * 1000).toISOString();

    // Create stores in intentionally scrambled order
    const pausedStore = storeModel.createStore({
      bezirk_id: mitteId,
      name: '(INAKTIV) Alte Ausgabestelle',
      giving_details: { giving_status: GivingStatus.CURRENT, last_contact_at: null }
    });

    const greenStore = storeModel.createStore({
      bezirk_id: mitteId,
      name: 'Frisch Verifizierte Stelle',
      giving_details: { giving_status: GivingStatus.CURRENT, last_contact_at: daysAgo(15) }
    });

    const yellowStore = storeModel.createStore({
      bezirk_id: mitteId,
      name: 'Bald Fällige Stelle',
      giving_details: { giving_status: GivingStatus.CURRENT, last_contact_at: daysAgo(120) }
    });

    const overdueDatedStore = storeModel.createStore({
      bezirk_id: mitteId,
      name: 'Seit 2021 Überfällige Stelle',
      giving_details: { giving_status: GivingStatus.CURRENT, last_contact_at: '2021-01-21 00:00:00' }
    });

    const neverVerifiedStore = storeModel.createStore({
      bezirk_id: mitteId,
      name: 'Nie Kontaktiert Aktiv',
      giving_details: { giving_status: GivingStatus.CURRENT, last_contact_at: null }
    });

    const urgentStore = storeModel.createStore({
      bezirk_id: mitteId,
      name: 'Stelle Mit Offenem Vorschlag',
      giving_details: { giving_status: GivingStatus.CURRENT, last_contact_at: daysAgo(10) }
    });

    suggestionModel.createSuggestion({
      region_id: mitteId,
      store_id: urgentStore.id,
      author_user_id: 'anon_1',
      author_email: 'hinweis@example.org',
      payload: { dropoffTimes: 'Neu: Di 14-16 Uhr' }
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/maintenance/overdue-contacts?region_id=${berlinId}`,
      headers: { authorization: 'Bearer test:coord_berlin:coord@example.org:false' }
    });

    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list.map((s: any) => s.id)).toEqual([
      urgentStore.id,         // Tier 1: Open suggestion
      neverVerifiedStore.id,  // Tier 2: Active + NULL
      overdueDatedStore.id,   // Tier 2: Active + >180 days (2021)
      yellowStore.id,         // Tier 3: Active + 90-180 days
      greenStore.id,          // Tier 4: Active + <90 days
      pausedStore.id          // Tier 5: (INAKTIV) at the bottom despite NULL last_contact_at!
    ]);
  });

  it('3. Sub-district coordinator querying root region with auto_scope=1 gets their district instead of 403', async () => {
    storeModel.createStore({ bezirk_id: mitteId, name: 'Mitte Einrichtung' });
    storeModel.createStore({ bezirk_id: pankowId, name: 'Pankow Einrichtung' });

    // Coordinator ONLY for Mitte (not Berlin root)
    userRoleModel.assignRole('mitte_only', mitteId, UserRoleType.WORKGROUP_GIVING_STORES);

    const res = await app.inject({
      method: 'GET',
      url: `/api/maintenance/overdue-contacts?region_id=${berlinId}&auto_scope=1`,
      headers: { authorization: 'Bearer test:mitte_only:mitte@example.org:false' }
    });

    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('Mitte Einrichtung');
  });

  it('4. Team Admin, Self-Lockout Protection & Instant JWT Revocation on Block / Delete', async () => {
    // 1. Login as ORGA via INITIAL_ORGA_SECRET
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'fuchstv@googlemail.com',
        password: 'admin-password-123',
        inviteOrSecret: 'test-orga-secret-xyz'
      }
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminToken = adminLogin.json().token;
    const adminUid = adminLogin.json().user.uid;

    // 2. Self-lockout guard: Admin cannot block or delete themselves
    const selfBlock = await app.inject({
      method: 'PATCH',
      url: `/api/team/members/${adminUid}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { is_active: false }
    });
    expect(selfBlock.statusCode).toBe(400);

    const selfDelete = await app.inject({
      method: 'DELETE',
      url: `/api/team/members/${adminUid}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(selfDelete.statusCode).toBe(400);

    // 3. Create invite for Pankow coordinator, inspect, and redeem
    const createInv = await app.inject({
      method: 'POST',
      url: '/api/invite/create',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { region_id: pankowId, target_role: UserRoleType.WORKGROUP_GIVING_STORES }
    });
    expect(createInv.statusCode).toBe(201);
    const rawToken = createInv.json().rawToken;

    const helperLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'helfer@example.org',
        password: 'helper-password-123',
        inviteOrSecret: rawToken
      }
    });
    expect(helperLogin.statusCode).toBe(200);
    const helperToken = helperLogin.json().token;
    const helperUid = helperLogin.json().user.uid;

    // Helper can access /api/auth/me, CANNOT access /api/team/members (single-district WORKGROUP)
    const helperMeBefore = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${helperToken}` }
    });
    expect(helperMeBefore.statusCode).toBe(200);
    expect(helperMeBefore.json().canManageTeam).toBe(false);

    const helperTeamForbidden = await app.inject({
      method: 'GET',
      url: '/api/team/members',
      headers: { authorization: `Bearer ${helperToken}` }
    });
    expect(helperTeamForbidden.statusCode).toBe(403);

    // 4. Admin blocks helper -> helper's live JWT is rejected IMMEDIATELY with 401
    const blockRes = await app.inject({
      method: 'PATCH',
      url: `/api/team/members/${helperUid}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { is_active: false }
    });
    expect(blockRes.statusCode).toBe(200);

    const helperMeBlocked = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${helperToken}` }
    });
    expect(helperMeBlocked.statusCode).toBe(401);

    // 5. Admin unblocks helper -> helper's JWT works again; then deletes helper -> 401 permanently
    await app.inject({
      method: 'PATCH',
      url: `/api/team/members/${helperUid}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { is_active: true }
    });
    const helperMeRestored = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${helperToken}` }
    });
    expect(helperMeRestored.statusCode).toBe(200);

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/team/members/${helperUid}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(delRes.statusCode).toBe(200);

    const helperMeDeleted = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${helperToken}` }
    });
    expect(helperMeDeleted.statusCode).toBe(401);
  });

  it('5. Regional AMBASSADOR can manage WORKGROUP roles & revoke open invites in their region, but not ORGA', async () => {
    // Setup ORGA + Pankow AMBASSADOR
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'orga@example.org',
        password: 'pw123456',
        inviteOrSecret: 'test-orga-secret-xyz'
      }
    });
    const adminToken = adminLogin.json().token;
    const adminUid = adminLogin.json().user.uid;

    const ambInvite = await app.inject({
      method: 'POST',
      url: '/api/invite/create',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { region_id: pankowId, target_role: UserRoleType.AMBASSADOR }
    });
    const ambLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'botschafter.pankow@example.org',
        password: 'pw123456',
        inviteOrSecret: ambInvite.json().rawToken
      }
    });
    const ambToken = ambLogin.json().token;

    // Ambassador creates a Pankow WORKGROUP invite and then revokes it
    const wgInv = await app.inject({
      method: 'POST',
      url: '/api/invite/create',
      headers: { authorization: `Bearer ${ambToken}` },
      payload: { region_id: pankowId, target_role: UserRoleType.WORKGROUP_GIVING_STORES }
    });
    expect(wgInv.statusCode).toBe(201);

    const revokeInv = await app.inject({
      method: 'DELETE',
      url: `/api/team/invites/${wgInv.json().id}`,
      headers: { authorization: `Bearer ${ambToken}` }
    });
    expect(revokeInv.statusCode).toBe(200);

    // Revoked invite returns 410 on inspection
    const inspectRevoked = await app.inject({
      method: 'GET',
      url: `/api/invite/${wgInv.json().rawToken}`
    });
    expect(inspectRevoked.statusCode).toBe(410);

    // Ambassador CANNOT create an invite for Mitte (outside Pankow) or strip ORGA
    const wrongRegionInv = await app.inject({
      method: 'POST',
      url: '/api/invite/create',
      headers: { authorization: `Bearer ${ambToken}` },
      payload: { region_id: mitteId }
    });
    expect(wrongRegionInv.statusCode).toBe(403);

    const touchOrga = await app.inject({
      method: 'DELETE',
      url: `/api/team/members/${adminUid}/roles?region_id=${berlinId}&role=ORGA`,
      headers: { authorization: `Bearer ${ambToken}` }
    });
    expect(touchOrga.statusCode).toBe(403);
  });

  it('6. Public visitor can submit suggestion with author_email without needing any Bearer token', async () => {
    const store = storeModel.createStore({ bezirk_id: mitteId, name: 'Suppenküche Mitte' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/giving-stores/${store.id}/suggestions`,
      payload: {
        author_email: 'besucher@example.org',
        author_note: 'Neue Telefonnummer am Aushang',
        payload: { publicPhone: '030 555666' }
      }
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().author_email).toBe('besucher@example.org');
  });
});
