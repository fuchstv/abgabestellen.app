import { describe, it, expect, beforeEach } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server/app';
import { RegionModel } from '../src/server/db/models/regions';
import { UserRoleModel } from '../src/server/db/models/userRoles';
import { UserRoleType } from '../src/shared/types';

describe('Invite Token & Onboarding Workflow', () => {
  let db: DatabaseType;
  let app: FastifyInstance;
  let regionModel: RegionModel;
  let userRoleModel: UserRoleModel;

  let berlinId: number;
  let pankowId: number;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../src/server/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    regionModel = new RegionModel(db);
    userRoleModel = new UserRoleModel(db);

    const berlin = regionModel.createRegion({ name: 'Berlin (Landesbezirk)', type: 1 });
    berlinId = berlin.id;

    const pankow = regionModel.createRegion({ name: 'Pankow', parent_id: berlinId, type: 2 });
    pankowId = pankow.id;

    // Assign Berlin coordinator role
    userRoleModel.assignRole('berlin-coordinator', berlinId, UserRoleType.WORKGROUP_GIVING_STORES);

    app = buildApp(db, { logger: false });
    await app.ready();
  });

  it('1. Coordinator creates invite token for Pankow', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/invite/create',
      headers: {
        authorization: 'Bearer test:berlin-coordinator:lead@foodsharing.berlin:false'
      },
      payload: {
        region_id: pankowId,
        target_role: UserRoleType.WORKGROUP_GIVING_STORES,
        expiresInDays: 7
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.rawToken).toBeDefined();
    expect(body.rawToken.length).toBe(64);
    expect(body.expiresAt).toBeDefined();
  });

  it('2. Public visitor inspects invite token before redemption (GET /api/invite/:token)', async () => {
    const invite = userRoleModel.createInviteToken({
      region_id: pankowId,
      created_by_user_id: 'berlin-coordinator',
      target_role: UserRoleType.WORKGROUP_GIVING_STORES
    });

    // 2.1 Inspect with bare token
    const res = await app.inject({
      method: 'GET',
      url: `/api/invite/${invite.rawToken}`
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(body.region_name).toBe('Pankow');
    expect(body.role).toBe(UserRoleType.WORKGROUP_GIVING_STORES);

    // 2.2 Inspect with full URL or query string passed
    const urlRes = await app.inject({
      method: 'GET',
      url: `/api/invite/https%3A%2F%2Fabgabestellen.app%2Finvite%2F${invite.rawToken}`
    });
    expect(urlRes.statusCode).toBe(200);
    expect(urlRes.json().valid).toBe(true);
  });

  it('3. Inspecting invalid or non-existent token returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/invite/invalid_dummy_token_123'
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().valid).toBe(false);
  });

  it('4. New volunteer registers & redeems invite token via POST /api/auth/login', async () => {
    const invite = userRoleModel.createInviteToken({
      region_id: pankowId,
      created_by_user_id: 'berlin-coordinator',
      target_role: UserRoleType.WORKGROUP_GIVING_STORES
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'claudia.neu@foodsharing.network',
        password: 'secure_password_123',
        inviteOrSecret: `https://abgabestellen.app/invite/${invite.rawToken}` // Full URL pasted
      }
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe('claudia.neu@foodsharing.network');

    // Verify role was granted
    const roles = userRoleModel.getUserRoles(data.user.uid);
    expect(roles.some(r => r.region_id === pankowId && r.role === UserRoleType.WORKGROUP_GIVING_STORES)).toBe(true);

    // 4.1 Token is now marked as redeemed and cannot be used again
    const inspectAfter = await app.inject({
      method: 'GET',
      url: `/api/invite/${invite.rawToken}`
    });
    expect(inspectAfter.statusCode).toBe(410);
    expect(inspectAfter.json().error).toContain('bereits verwendet');

    // 4.2 Second redemption attempt fails
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'attacker@example.org',
        password: 'password',
        inviteOrSecret: invite.rawToken
      }
    });
    expect(secondRes.statusCode).toBe(400);
  });

  it('5. Existing logged-in user redeems token via POST /api/invite/redeem', async () => {
    const invite = userRoleModel.createInviteToken({
      region_id: pankowId,
      created_by_user_id: 'berlin-coordinator',
      target_role: UserRoleType.WORKGROUP_GIVING_STORES
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/invite/redeem',
      headers: {
        authorization: 'Bearer test:existing_user:existing@foodsharing.de:false'
      },
      payload: {
        token: `https://abgabestellen.app/invite?token=${invite.rawToken}`
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().region_id).toBe(pankowId);

    // Verify role assigned
    const roles = userRoleModel.getUserRoles('existing_user');
    expect(roles.some(r => r.region_id === pankowId)).toBe(true);
  });
});
