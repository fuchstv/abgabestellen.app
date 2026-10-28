import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { StoreModel } from '../db/models/stores';
import { RegionModel } from '../db/models/regions';
import { ContactLogModel } from '../db/models/contactLog';
import { PermissionService } from '../auth/permissions';
import { optionalAuthMiddleware, requireAuthMiddleware } from '../auth/authMiddleware';
import { GivingStatus } from '@shared/types';

export async function givingStoreRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const storeModel = new StoreModel(options.db);
  const regionModel = new RegionModel(options.db);
  const contactLogModel = new ContactLogModel(options.db);
  const permissionService = new PermissionService(options.db);

  // GET /api/regions/:id/giving-stores
  fastify.get('/api/regions/:id/giving-stores', {
    preHandler: optionalAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const regionId = Number(id);

    const query = request.query as {
      registration_required?: string;
      onlyWithoutRegistration?: string;
      status?: string;
      include_subdistricts?: string;
    };

    const includeSubdistricts = query.include_subdistricts !== 'false';
    const regionIds = includeSubdistricts 
      ? regionModel.getRegionDescendantIds(regionId)
      : [regionId];

    const onlyWithoutRegistration = query.onlyWithoutRegistration === 'true' || query.registration_required === 'false';
    const registrationRequiredOnly = query.registration_required === 'true';

    let givingStatus: GivingStatus | undefined = undefined;
    if (query.status === 'active' || query.status === 'current') {
      givingStatus = GivingStatus.CURRENT;
    } else if (query.status === 'review' || query.status === 'in_review') {
      givingStatus = GivingStatus.IN_REVIEW;
    } else if (query.status === 'paused') {
      givingStatus = GivingStatus.PAUSED;
    }

    const internalStores = storeModel.getStoresByRegion(regionIds, {
      onlyWithoutRegistration,
      registrationRequiredOnly,
      givingStatus,
      onlyActive: true
    });

    // Sanitize each store according to caller permissions
    const sanitizedStores = internalStores.map(store => {
      const perms = permissionService.getStorePermissions(request.user, store);
      return permissionService.sanitizeStore(store, perms);
    });

    return sanitizedStores;
  });

  // GET /api/giving-stores/:id
  fastify.get('/api/giving-stores/:id', {
    preHandler: optionalAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const storeId = Number(id);

    const internalStore = storeModel.getInternalStoreById(storeId);
    if (!internalStore) {
      return reply.status(404).send({ error: `Abgabestelle #${storeId} nicht gefunden` });
    }

    const perms = permissionService.getStorePermissions(request.user, internalStore);
    const storeResponse: any = permissionService.sanitizeStore(internalStore, perms);

    // If manager, attach contact logs
    if (perms.canViewContactLog) {
      storeResponse.contact_logs = contactLogModel.getContactLogsByStoreId(storeId);
    }

    return {
      store: storeResponse,
      permissions: perms
    };
  });

  // PATCH /api/giving-stores/:id (Manager only)
  fastify.patch('/api/giving-stores/:id', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const storeId = Number(id);

    // Enforce manager permissions (403 if unauthorized)
    permissionService.enforceStoreManager(request.user, storeId);

    const body = request.body as any;
    const updatedStore = storeModel.updateStore(storeId, body);

    if (!updatedStore) {
      return reply.status(404).send({ error: 'Aktualisierung fehlgeschlagen' });
    }

    const perms = permissionService.getStorePermissions(request.user, updatedStore);
    return permissionService.sanitizeStore(updatedStore, perms);
  });
}
