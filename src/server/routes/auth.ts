import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import crypto from 'crypto';
import { UserRoleModel } from '../db/models/userRoles';
import { ensureMigrations } from '../db/index';
import { signToken } from '../auth/jwt';
import { requireAuthMiddleware } from '../auth/authMiddleware';
import { UserRoleType } from '@shared/types';
import { extractCleanToken } from './invites';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export async function authRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const db = options.db;
  ensureMigrations(db);
  const userRoleModel = new UserRoleModel(db);

  function buildAuthMetadata(uid: string, isSuperAdmin: boolean) {
    const roles = userRoleModel.getUserRoles(uid);
    const managedRegionIds = userRoleModel.getManagedRegionIds(uid, isSuperAdmin);
    const teamAdminRegionIds = userRoleModel.getTeamAdminRegionIds(uid, isSuperAdmin);
    const canManageTeam = userRoleModel.isGlobalOrga(uid, isSuperAdmin) || teamAdminRegionIds.length > 0;
    return { roles, managedRegionIds, teamAdminRegionIds, canManageTeam };
  }

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
      inviteOrSecret?: string;
      name?: string;
    };

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return reply.status(400).send({ error: 'E-Mail-Adresse ist erforderlich' });
    }

    const initialSecret = process.env.INITIAL_ORGA_SECRET || '';

    // 1. Login via INITIAL_ORGA_SECRET
    if (body.inviteOrSecret && initialSecret && body.inviteOrSecret.trim() === initialSecret.trim()) {
      const user = db.prepare('SELECT * FROM fs_user WHERE lower(email) = ?').get(email) as any;
      const uid = user ? user.id : `usr_${crypto.randomBytes(8).toString('hex')}`;
      const pwHash = body.password ? hashPassword(body.password) : (user?.password_hash || null);
      const displayName = body.name?.trim() || user?.name || email.split('@')[0];

      if (!user) {
        db.prepare(`
          INSERT INTO fs_user (id, email, name, password_hash, is_super_admin, is_active, revoked_at, last_login_at)
          VALUES (?, ?, ?, ?, 1, 1, NULL, datetime('now'))
        `).run(uid, email, displayName, pwHash);
      } else {
        db.prepare(`
          UPDATE fs_user
          SET password_hash = ?,
              name = ?,
              is_super_admin = 1,
              is_active = 1,
              revoked_at = NULL,
              last_login_at = datetime('now')
          WHERE id = ?
        `).run(pwHash, displayName, uid);
      }

      // Assign ORGA + WORKGROUP roles for Berlin (region 1) if region 1 exists
      const rootRegion = db.prepare('SELECT id FROM fs_bezirk ORDER BY type ASC, id ASC LIMIT 1').get() as
        | { id: number }
        | undefined;
      if (rootRegion) {
        userRoleModel.assignRole(uid, rootRegion.id, UserRoleType.WORKGROUP_GIVING_STORES);
        userRoleModel.assignRole(uid, rootRegion.id, UserRoleType.ORGA);
      }

      const authUser = {
        uid,
        email,
        name: displayName,
        isSuperAdmin: true
      };

      const token = signToken(authUser);
      const meta = buildAuthMetadata(uid, true);

      return {
        user: authUser,
        ...meta,
        token,
        message: 'Erfolgreich als ORGA angemeldet'
      };
    }

    // 2. Login via Invite Token
    if (body.inviteOrSecret) {
      const user = db.prepare('SELECT * FROM fs_user WHERE lower(email) = ?').get(email) as any;
      if (user && Number(user.is_active) === 0) {
        return reply.status(403).send({
          error: 'Dein Konto wurde gesperrt. Bitte wende dich an die ORGA / Regionalkoordination.'
        });
      }

      const uid = user ? user.id : `usr_${crypto.randomBytes(8).toString('hex')}`;
      const pwHash = body.password ? hashPassword(body.password) : (user?.password_hash || null);
      const displayName = body.name?.trim() || user?.name || email.split('@')[0];

      const cleanToken = extractCleanToken(body.inviteOrSecret);
      const redeemResult = userRoleModel.redeemInviteToken(cleanToken, uid);
      if (!redeemResult.success) {
        return reply.status(400).send({ error: redeemResult.error || 'Ungültiger oder abgelaufener Einladungscode' });
      }

      const grantedOrga = redeemResult.role === UserRoleType.ORGA;
      const isSuperAdmin = Boolean(user?.is_super_admin) || grantedOrga;

      if (!user) {
        db.prepare(`
          INSERT INTO fs_user (id, email, name, password_hash, is_super_admin, is_active, last_login_at)
          VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
        `).run(uid, email, displayName, pwHash, isSuperAdmin ? 1 : 0);
      } else {
        db.prepare(`
          UPDATE fs_user
          SET password_hash = ?,
              name = ?,
              is_super_admin = ?,
              last_login_at = datetime('now')
          WHERE id = ?
        `).run(pwHash, displayName, isSuperAdmin ? 1 : 0, uid);
      }

      const authUser = {
        uid,
        email,
        name: displayName,
        isSuperAdmin
      };

      const token = signToken(authUser);
      const meta = buildAuthMetadata(uid, isSuperAdmin);

      return {
        user: authUser,
        ...meta,
        token,
        message: 'Einladung erfolgreich eingelöst'
      };
    }

    // 3. Login via Email & Password
    if (body.password) {
      const user = db.prepare('SELECT * FROM fs_user WHERE lower(email) = ?').get(email) as any;
      if (!user || !user.password_hash) {
        return reply.status(401).send({
          error: 'Kein Konto mit Passwort gefunden. Wenn du neu bist, nutze bitte einen Einladungscode oder das ORGA-Initial-Secret.'
        });
      }

      if (Number(user.is_active) === 0) {
        return reply.status(403).send({
          error: 'Dein Zugang wurde gesperrt oder entzogen. Bitte wende dich an die Koordination.'
        });
      }

      if (!verifyPassword(body.password, user.password_hash)) {
        return reply.status(401).send({ error: 'Das eingegebene Passwort ist ungültig' });
      }

      db.prepare(`UPDATE fs_user SET last_login_at = datetime('now') WHERE id = ?`).run(user.id);

      const isSuperAdmin = userRoleModel.isGlobalOrga(user.id, Boolean(user.is_super_admin));
      const authUser = {
        uid: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        isSuperAdmin
      };

      const token = signToken(authUser);
      const meta = buildAuthMetadata(user.id, isSuperAdmin);

      return {
        user: authUser,
        ...meta,
        token
      };
    }

    return reply.status(400).send({ error: 'Bitte gib ein Passwort oder einen Einladungscode ein' });
  });

  // GET /api/auth/me (Returns logged in user, district roles & team management capability)
  fastify.get('/api/auth/me', {
    preHandler: requireAuthMiddleware
  }, async (request) => {
    const meta = buildAuthMetadata(request.user!.uid, Boolean(request.user!.isSuperAdmin));
    return {
      user: request.user,
      ...meta
    };
  });
}
