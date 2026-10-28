import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import crypto from 'crypto';
import { UserRoleModel } from '../db/models/userRoles';
import { PermissionService } from '../auth/permissions';
import { requireAuthMiddleware } from '../auth/authMiddleware';
import { UserRoleType } from '@shared/types';

export function extractCleanToken(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.includes('token=')) {
    const m = trimmed.match(/token=([a-fA-F0-9]+)/);
    if (m) return m[1];
  }
  if (trimmed.includes('/invite/')) {
    const m = trimmed.match(/\/invite\/([a-fA-F0-9]+)/);
    if (m) return m[1];
  }
  return trimmed;
}

export async function inviteRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const userRoleModel = new UserRoleModel(options.db);
  const permissionService = new PermissionService(options.db);

  // GET /api/invite/:token (Inspect invite token before redemption)
  fastify.get('/api/invite/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    if (!token) {
      return reply.status(400).send({ valid: false, error: 'Token ist erforderlich' });
    }

    const cleanToken = extractCleanToken(token);
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const tokenRecord = options.db.prepare(`
      SELECT t.*, r.name as region_name, r.type as region_type
      FROM fs_invite_token t
      LEFT JOIN fs_bezirk r ON t.region_id = r.id
      WHERE t.token_hash = ?
    `).get(tokenHash) as any;

    if (!tokenRecord) {
      return reply.status(404).send({
        valid: false,
        error: 'Ungültiger Einladungslink. Bitte prüfe die URL oder fordere einen neuen Link an.'
      });
    }

    if (tokenRecord.redeemed_by_user_id) {
      return reply.status(410).send({
        valid: false,
        error: 'Dieser Einladungslink wurde bereits verwendet und ist nicht mehr gültig.'
      });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return reply.status(410).send({
        valid: false,
        error: 'Dieser Einladungslink ist leider abgelaufen.'
      });
    }

    return {
      valid: true,
      token: cleanToken,
      region_id: tokenRecord.region_id,
      region_name: tokenRecord.region_name || `Region #${tokenRecord.region_id}`,
      role: tokenRecord.target_role,
      expires_at: tokenRecord.expires_at
    };
  });

  // POST /api/invite/create (District Coordinator creates invite link)
  fastify.post('/api/invite/create', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const body = request.body as {
      region_id: number;
      target_role?: UserRoleType;
      expiresInDays?: number;
    };

    if (!body.region_id) {
      return reply.status(400).send({ error: 'region_id ist erforderlich' });
    }

    // Enforce coordinator permissions on region
    permissionService.enforceRegionManager(request.user, body.region_id);

    const invite = userRoleModel.createInviteToken({
      region_id: body.region_id,
      created_by_user_id: request.user!.uid,
      target_role: body.target_role || UserRoleType.WORKGROUP_GIVING_STORES,
      expiresInDays: body.expiresInDays || 7
    });

    return reply.status(201).send(invite);
  });

  // POST /api/invite/redeem (New volunteer redeems invite token)
  fastify.post('/api/invite/redeem', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const body = request.body as { token: string };

    if (!body.token) {
      return reply.status(400).send({ error: 'token ist erforderlich' });
    }

    const cleanToken = extractCleanToken(body.token);
    const result = userRoleModel.redeemInviteToken(cleanToken, request.user!.uid);
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return result;
  });

  // POST /api/invite/redeem-initial-orga (Bootstrap first ORGA user via secret)
  fastify.post('/api/invite/redeem-initial-orga', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const configuredSecret = process.env.INITIAL_ORGA_SECRET;
    if (!configuredSecret) {
      return reply.status(400).send({ error: 'Initiales ORGA-Bootstrapping ist auf diesem Server nicht aktiviert' });
    }

    const body = request.body as { secret: string; region_id?: number };
    if (!body.secret || body.secret !== configuredSecret) {
      return reply.status(403).send({ error: 'Ungültiges Initial-ORGA-Secret' });
    }

    const targetRegionId = body.region_id || 1; // Default to root Landesbezirk (e.g., Berlin)
    userRoleModel.assignRole(request.user!.uid, targetRegionId, UserRoleType.ORGA);

    return {
      success: true,
      message: `Rolle ${UserRoleType.ORGA} für Region #${targetRegionId} erfolgreich zugewiesen.`,
      user_id: request.user!.uid,
      region_id: targetRegionId,
      role: UserRoleType.ORGA
    };
  });
}
