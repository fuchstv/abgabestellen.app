import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { ContactLogModel } from '../db/models/contactLog';
import { RegionModel } from '../db/models/regions';
import { PermissionService } from '../auth/permissions';
import { requireAuthMiddleware } from '../auth/authMiddleware';

export async function maintenanceRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const contactLogModel = new ContactLogModel(options.db);
  const regionModel = new RegionModel(options.db);
  const permissionService = new PermissionService(options.db);

  // GET /api/maintenance/overdue-contacts
  fastify.get('/api/maintenance/overdue-contacts', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const query = request.query as { region_id?: string; limit?: string };
    const limit = query.limit ? Number(query.limit) : 50;

    let targetRegionIds: number[] | undefined = undefined;

    if (query.region_id) {
      const regionId = Number(query.region_id);
      permissionService.enforceRegionManager(request.user, regionId);
      targetRegionIds = regionModel.getRegionDescendantIds(regionId);
    } else {
      // If no specific region given, user must have manager role or superadmin
      if (!request.user?.isSuperAdmin) {
        return reply.status(400).send({ error: 'region_id Abfrageparameter ist erforderlich' });
      }
    }

    const overdueStores = contactLogModel.getOverdueStores(targetRegionIds, limit);
    return overdueStores;
  });
}
