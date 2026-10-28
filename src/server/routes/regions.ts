import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { RegionModel } from '../db/models/regions';

export async function regionRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const model = new RegionModel(options.db);

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
}
