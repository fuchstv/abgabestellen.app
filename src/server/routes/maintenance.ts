import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { ContactLogModel } from '../db/models/contactLog';
import { RegionModel } from '../db/models/regions';
import { SuggestionModel } from '../db/models/suggestions';
import { UserRoleModel } from '../db/models/userRoles';
import { PermissionService } from '../auth/permissions';
import { requireAuthMiddleware } from '../auth/authMiddleware';
import { AuthUser, SuggestionStatus } from '@shared/types';

export async function maintenanceRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const contactLogModel = new ContactLogModel(options.db);
  const regionModel = new RegionModel(options.db);
  const suggestionModel = new SuggestionModel(options.db);
  const userRoleModel = new UserRoleModel(options.db);
  const permissionService = new PermissionService(options.db);

  function resolveScopedRegions(
    user: AuthUser | undefined,
    regionIdParam?: string,
    autoScope?: string
  ): number[] {
    if (!user) {
      const err: any = new Error('Authentifizierung erforderlich');
      err.statusCode = 401;
      throw err;
    }

    const managedIds = userRoleModel.getManagedRegionIds(user.uid, Boolean(user.isSuperAdmin));
    if (managedIds.length === 0) {
      const err: any = new Error(
        'Zugriff verweigert: Deinem Konto ist aktuell keine aktive Koordinator-Region zugewiesen'
      );
      err.statusCode = 403;
      throw err;
    }

    const managedSet = new Set(managedIds);

    if (regionIdParam) {
      const regionId = Number(regionIdParam);
      const requestedDescendants = regionModel.getRegionDescendantIds(regionId);
      const intersection = requestedDescendants.filter(id => managedSet.has(id));

      if (intersection.length > 0) {
        return intersection;
      }

      if (autoScope === '1' || autoScope === 'true') {
        return managedIds;
      }

      // Strict check throws 403 when explicitly querying an unauthorized region without auto_scope
      permissionService.enforceRegionManager(user, regionId);
      return requestedDescendants;
    }

    return managedIds;
  }

  // GET /api/maintenance/overdue-contacts
  fastify.get('/api/maintenance/overdue-contacts', {
    preHandler: requireAuthMiddleware
  }, async (request) => {
    const query = request.query as { region_id?: string; limit?: string; auto_scope?: string };
    const limit = query.limit ? Math.max(1, Number(query.limit)) : 1000;

    const targetRegionIds = resolveScopedRegions(request.user, query.region_id, query.auto_scope);
    return contactLogModel.getOverdueStores(targetRegionIds, limit);
  });

  // GET /api/maintenance/suggestions
  fastify.get('/api/maintenance/suggestions', {
    preHandler: requireAuthMiddleware
  }, async (request) => {
    const query = request.query as { region_id?: string; status?: string; auto_scope?: string };
    const targetRegionIds = resolveScopedRegions(request.user, query.region_id, query.auto_scope);

    let statusFilter: SuggestionStatus | undefined = undefined;
    if (query.status === 'pending') statusFilter = SuggestionStatus.PENDING;
    else if (query.status === 'approved') statusFilter = SuggestionStatus.APPROVED;
    else if (query.status === 'rejected') statusFilter = SuggestionStatus.REJECTED;

    return suggestionModel.getSuggestionsByRegions(targetRegionIds, statusFilter);
  });
}
