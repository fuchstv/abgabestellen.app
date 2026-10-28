import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { ContactLogModel } from '../db/models/contactLog';
import { PermissionService } from '../auth/permissions';
import { requireAuthMiddleware } from '../auth/authMiddleware';

export async function contactLogRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const contactLogModel = new ContactLogModel(options.db);
  const permissionService = new PermissionService(options.db);

  // GET /api/giving-stores/:id/contact-log
  fastify.get('/api/giving-stores/:id/contact-log', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const storeId = Number(id);

    // Enforce manager permissions (Throws 403 Forbidden if not authorized)
    permissionService.enforceStoreManager(request.user, storeId);

    return contactLogModel.getContactLogsByStoreId(storeId);
  });

  // POST /api/giving-stores/:id/contact-log
  fastify.post('/api/giving-stores/:id/contact-log', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const storeId = Number(id);

    // Enforce manager permissions (Throws 403 Forbidden if not authorized)
    permissionService.enforceStoreManager(request.user, storeId);

    const body = request.body as {
      channel?: 'Telefon' | 'E-Mail' | 'Vor Ort' | 'Messenger' | 'Sonstiges';
      contact_person?: string;
      note: string;
      confirmed_current?: boolean;
      contacted_at?: string;
    };

    if (!body.note || body.note.trim().length === 0) {
      return reply.status(400).send({ error: 'Gesprächsnotiz (note) ist erforderlich' });
    }

    const newEntry = contactLogModel.addContactLogEntry({
      store_id: storeId,
      author_user_id: request.user!.uid,
      author_name: request.user!.name || request.user!.email,
      channel: body.channel || 'Telefon',
      contact_person: body.contact_person,
      note: body.note,
      confirmed_current: body.confirmed_current,
      contacted_at: body.contacted_at
    });

    return reply.status(201).send(newEntry);
  });
}
