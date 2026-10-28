import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { UserRoleModel } from '../db/models/userRoles';
import { PermissionService } from '../auth/permissions';
import { requireAuthMiddleware } from '../auth/authMiddleware';
import { UserRoleType } from '@shared/types';

export async function inviteRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const userRoleModel = new UserRoleModel(options.db);
  const permissionService = new PermissionService(options.db);

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

    const result = userRoleModel.redeemInviteToken(body.token, request.user!.uid);
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return result;
  });
}
