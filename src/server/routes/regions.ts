import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { RegionModel } from '../db/models/regions';
import { UserRoleModel } from '../db/models/userRoles';
import { optionalAuthMiddleware } from '../auth/authMiddleware';
import { UserRoleType } from '@shared/types';

export async function regionRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const model = new RegionModel(options.db);
  const userRoleModel = new UserRoleModel(options.db);

  // List all regions or hierarchical tree
  fastify.get('/api/regions', async (request, reply) => {
    const { tree } = request.query as { tree?: string };
    if (tree === 'true' || tree === '1') {
      return model.getTree();
    }
    return model.getAllRegions();
  });

  // Get specific region
  fastify.get('/api/regions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const region = model.getRegionById(Number(id));
    if (!region) {
      return reply.status(404).send({ error: 'Region nicht gefunden' });
    }
    return region;
  });

  // POST /api/admin/regions (Onboard new city or district)
  fastify.post('/api/admin/regions', {
    preHandler: optionalAuthMiddleware
  }, async (request, reply) => {
    const orgaSecretHeader = request.headers['x-orga-secret'];
    const configuredSecret = process.env.INITIAL_ORGA_SECRET;

    const isAuthorizedBySecret = configuredSecret && orgaSecretHeader === configuredSecret;
    const isAuthorizedByUser = request.user && (
      request.user.isSuperAdmin || 
      userRoleModel.hasPermissionInRegion(request.user.uid, 1, [UserRoleType.ORGA], true)
    );

    if (!isAuthorizedBySecret && !isAuthorizedByUser) {
      return reply.status(403).send({ error: 'Zugriff verweigert: Nur für ORGA autorisiert' });
    }

    const body = request.body as {
      name: string;
      parent_id?: number | null;
      type?: number;
      lat?: number | null;
      lon?: number | null;
      external_fs_bezirk_id?: number | null;
      create_invite?: boolean;
    };

    if (!body.name) {
      return reply.status(400).send({ error: 'name ist erforderlich' });
    }

    const newRegion = model.createRegion({
      name: body.name,
      parent_id: body.parent_id ?? null,
      type: body.type ?? (body.parent_id ? 2 : 1),
      lat: body.lat ?? null,
      lon: body.lon ?? null,
      external_fs_bezirk_id: body.external_fs_bezirk_id ?? null
    });

    let invite = null;
    if (body.create_invite) {
      const creatorId = request.user?.uid || 'system:initial-orga';
      invite = userRoleModel.createInviteToken({
        region_id: newRegion.id,
        created_by_user_id: creatorId,
        target_role: UserRoleType.WORKGROUP_GIVING_STORES,
        expiresInDays: 14
      });
    }

    return reply.status(201).send({
      region: newRegion,
      invite: invite ? {
        token: invite.rawToken,
        expiresAt: invite.expiresAt,
        inviteUrl: `/invite?token=${invite.rawToken}`
      } : null
    });
  });
}
