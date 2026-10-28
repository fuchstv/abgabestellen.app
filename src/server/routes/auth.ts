import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import crypto from 'crypto';
import { UserRoleModel } from '../db/models/userRoles';
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
  const userRoleModel = new UserRoleModel(db);

  // Ensure fs_user table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS fs_user (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NULL,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
      inviteOrSecret?: string;
    };

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return reply.status(400).send({ error: 'E-Mail-Adresse ist erforderlich' });
    }

    const initialSecret = process.env.INITIAL_ORGA_SECRET || '';

    // 1. Login via INITIAL_ORGA_SECRET
    if (body.inviteOrSecret && initialSecret && body.inviteOrSecret.trim() === initialSecret.trim()) {
      let user = db.prepare('SELECT * FROM fs_user WHERE email = ?').get(email) as any;
      const uid = user ? user.id : `usr_${crypto.randomBytes(8).toString('hex')}`;
      const pwHash = body.password ? hashPassword(body.password) : (user?.password_hash || null);

      if (!user) {
        db.prepare(`
          INSERT INTO fs_user (id, email, name, password_hash, is_super_admin)
          VALUES (?, ?, ?, ?, 1)
        `).run(uid, email, email.split('@')[0], pwHash);
      } else if (body.password) {
        db.prepare('UPDATE fs_user SET password_hash = ? WHERE id = ?').run(pwHash, uid);
      }

      // Assign ORGA + WORKGROUP roles for Berlin (region 1)
      userRoleModel.assignRole(uid, 1, UserRoleType.WORKGROUP_GIVING_STORES);
      userRoleModel.assignRole(uid, 1, UserRoleType.ORGA);

      const authUser = {
        uid,
        email,
        name: email.split('@')[0],
        isSuperAdmin: true
      };

      const token = signToken(authUser);
      const roles = userRoleModel.getUserRoles(uid);

      return {
        user: authUser,
        roles,
        token,
        message: 'Erfolgreich als ORGA angemeldet'
      };
    }

    // 2. Login via Invite Token
    if (body.inviteOrSecret) {
      let user = db.prepare('SELECT * FROM fs_user WHERE email = ?').get(email) as any;
      const uid = user ? user.id : `usr_${crypto.randomBytes(8).toString('hex')}`;
      const pwHash = body.password ? hashPassword(body.password) : (user?.password_hash || null);

      const cleanToken = extractCleanToken(body.inviteOrSecret);
      const redeemResult = userRoleModel.redeemInviteToken(cleanToken, uid);
      if (!redeemResult.success) {
        return reply.status(400).send({ error: redeemResult.error || 'Ungültiger oder abgelaufener Einladungscode' });
      }

      if (!user) {
        db.prepare(`
          INSERT INTO fs_user (id, email, name, password_hash, is_super_admin)
          VALUES (?, ?, ?, ?, 0)
        `).run(uid, email, email.split('@')[0], pwHash);
      } else if (body.password) {
        db.prepare('UPDATE fs_user SET password_hash = ? WHERE id = ?').run(pwHash, uid);
      }

      const authUser = {
        uid,
        email,
        name: email.split('@')[0],
        isSuperAdmin: false
      };

      const token = signToken(authUser);
      const roles = userRoleModel.getUserRoles(uid);

      return {
        user: authUser,
        roles,
        token,
        message: 'Einladung erfolgreich eingelöst'
      };
    }

    // 3. Login via Email & Password
    if (body.password) {
      const user = db.prepare('SELECT * FROM fs_user WHERE email = ?').get(email) as any;
      if (!user || !user.password_hash) {
        return reply.status(401).send({
          error: 'Kein Konto mit Passwort gefunden. Wenn du neu bist, nutze bitte einen Einladungscode oder das ORGA-Initial-Secret.'
        });
      }

      if (!verifyPassword(body.password, user.password_hash)) {
        return reply.status(401).send({ error: 'Das eingegebene Passwort ist ungültig' });
      }

      const authUser = {
        uid: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        isSuperAdmin: Boolean(user.is_super_admin)
      };

      const token = signToken(authUser);
      const roles = userRoleModel.getUserRoles(user.id);

      return {
        user: authUser,
        roles,
        token
      };
    }

    return reply.status(400).send({ error: 'Bitte gib ein Passwort oder einen Einladungscode ein' });
  });

  // GET /api/auth/me (Returns logged in user & their district roles)
  fastify.get('/api/auth/me', {
    preHandler: requireAuthMiddleware
  }, async (request) => {
    const roles = userRoleModel.getUserRoles(request.user!.uid);
    return {
      user: request.user,
      roles
    };
  });
}
