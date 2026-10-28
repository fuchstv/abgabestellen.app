import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { SuggestionModel } from '../db/models/suggestions';
import { StoreModel } from '../db/models/stores';
import { RegionModel } from '../db/models/regions';
import { PermissionService } from '../auth/permissions';
import { requireAuthMiddleware } from '../auth/authMiddleware';
import { GivingStoreSuggestionPayload, SuggestionStatus } from '@shared/types';

export async function suggestionRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const suggestionModel = new SuggestionModel(options.db);
  const storeModel = new StoreModel(options.db);
  const regionModel = new RegionModel(options.db);
  const permissionService = new PermissionService(options.db);

  // POST /api/giving-stores/:id/suggestions (Change report on existing store)
  fastify.post('/api/giving-stores/:id/suggestions', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const storeId = Number(id);

    const store = storeModel.getInternalStoreById(storeId);
    if (!store) {
      return reply.status(404).send({ error: `Abgabestelle #${storeId} nicht gefunden` });
    }

    const body = request.body as {
      payload: GivingStoreSuggestionPayload;
      author_note?: string;
    };

    if (!body.payload) {
      return reply.status(400).send({ error: 'Payload ist erforderlich' });
    }

    const suggestion = suggestionModel.createSuggestion({
      region_id: store.bezirk_id,
      store_id: store.id,
      author_user_id: request.user!.uid,
      author_email: request.user!.email,
      payload: body.payload,
      author_note: body.author_note
    });

    return reply.status(201).send(suggestion);
  });

  // POST /api/regions/:id/suggestions (Propose new drop-off store)
  fastify.post('/api/regions/:id/suggestions', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const regionId = Number(id);

    const region = regionModel.getRegionById(regionId);
    if (!region) {
      return reply.status(404).send({ error: `Region #${regionId} nicht gefunden` });
    }

    const body = request.body as {
      payload: GivingStoreSuggestionPayload;
      author_note?: string;
    };

    if (!body.payload || !body.payload.name) {
      return reply.status(400).send({ error: 'Name der Abgabestelle ist erforderlich' });
    }

    const suggestion = suggestionModel.createSuggestion({
      region_id: regionId,
      store_id: null,
      author_user_id: request.user!.uid,
      author_email: request.user!.email,
      payload: body.payload,
      author_note: body.author_note
    });

    return reply.status(201).send(suggestion);
  });

  // GET /api/regions/:id/suggestions (Manager review inbox)
  fastify.get('/api/regions/:id/suggestions', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const regionId = Number(id);

    // Enforce manager permission
    permissionService.enforceRegionManager(request.user, regionId);

    const query = request.query as { status?: string };
    let statusFilter: SuggestionStatus | undefined = undefined;
    if (query.status === 'pending') statusFilter = SuggestionStatus.PENDING;
    else if (query.status === 'approved') statusFilter = SuggestionStatus.APPROVED;
    else if (query.status === 'rejected') statusFilter = SuggestionStatus.REJECTED;

    const descendantRegionIds = regionModel.getRegionDescendantIds(regionId);
    return suggestionModel.getSuggestionsByRegions(descendantRegionIds, statusFilter);
  });

  // POST /api/suggestions/:id/review (Approve or Reject suggestion)
  fastify.post('/api/suggestions/:id/review', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const suggestionId = Number(id);

    const suggestion = suggestionModel.getSuggestionById(suggestionId);
    if (!suggestion) {
      return reply.status(404).send({ error: `Vorschlag #${suggestionId} nicht gefunden` });
    }

    // Enforce manager permission on target region
    permissionService.enforceRegionManager(request.user, suggestion.region_id);

    const body = request.body as {
      decision: 'APPROVED' | 'REJECTED';
      review_note?: string;
      overrides?: Partial<GivingStoreSuggestionPayload>;
    };

    if (body.decision !== 'APPROVED' && body.decision !== 'REJECTED') {
      return reply.status(400).send({ error: "Entscheidung muss 'APPROVED' oder 'REJECTED' sein" });
    }

    const decisionStatus = body.decision === 'APPROVED' 
      ? SuggestionStatus.APPROVED 
      : SuggestionStatus.REJECTED;

    const result = suggestionModel.reviewSuggestion(
      suggestionId,
      request.user!.uid,
      decisionStatus,
      body.review_note,
      body.overrides
    );

    return result;
  });
}
