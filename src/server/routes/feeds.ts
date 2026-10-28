import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { StoreModel } from '../db/models/stores';
import { RegionModel } from '../db/models/regions';

export async function feedRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const storeModel = new StoreModel(options.db);
  const regionModel = new RegionModel(options.db);

  // GET /api/regions/:id/feed (District updates feed / GIVING_STORES_UPDATES)
  fastify.get('/api/regions/:id/feed', async (request, reply) => {
    const { id } = request.params as { id: string };
    const regionId = Number(id);

    const region = regionModel.getRegionById(regionId);
    if (!region) {
      return reply.status(404).send({ error: 'Region nicht gefunden' });
    }

    const descendantIds = regionModel.getRegionDescendantIds(regionId);
    const placeholders = descendantIds.map(() => '?').join(',');

    const stmt = options.db.prepare(`
      SELECT 
        f.*,
        b.name as store_name,
        r.name as region_name
      FROM fs_store_updates_feed f
      JOIN fs_betrieb b ON f.store_id = b.id
      JOIN fs_bezirk r ON f.region_id = r.id
      WHERE f.region_id IN (${placeholders})
      ORDER BY f.created_at DESC
      LIMIT 50
    `);

    const feedItems = stmt.all(...descendantIds);
    return {
      region,
      items: feedItems
    };
  });

  // GET /api/regions/:id/feed.geojson (Open GeoJSON FeatureCollection for community mapping)
  fastify.get('/api/regions/:id/feed.geojson', async (request, reply) => {
    const { id } = request.params as { id: string };
    const regionId = Number(id);

    const descendantIds = regionModel.getRegionDescendantIds(regionId);
    const stores = storeModel.getStoresByRegion(descendantIds, { onlyActive: true });

    const geojson = {
      type: 'FeatureCollection',
      features: stores.map(store => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [store.lon, store.lat]
        },
        properties: {
          id: store.id,
          name: store.name,
          address: `${store.str}, ${store.plz} ${store.stadt}`.trim(),
          registration_required: store.giving_details.registration_required === 1,
          dropoff_times: store.giving_details.dropoff_times,
          accepted_items: store.giving_details.accepted_items,
          giving_status: store.giving_details.giving_status,
          public_phone: store.giving_details.public_phone,
          website: store.giving_details.website
        }
      }))
    };

    return reply.type('application/geo+json').send(geojson);
  });

  // POST /api/regions/:id/subscribe (Opt-in email digest subscription)
  fastify.post('/api/regions/:id/subscribe', async (request, reply) => {
    const { id } = request.params as { id: string };
    const regionId = Number(id);

    const body = request.body as { email: string };
    if (!body.email || !body.email.includes('@')) {
      return reply.status(400).send({ error: 'Gültige E-Mail-Adresse erforderlich' });
    }

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

    options.db.prepare(`
      INSERT OR REPLACE INTO fs_district_subscribers (region_id, email, verified, token, created_at)
      VALUES (?, ?, 1, ?, datetime('now'))
    `).run(regionId, body.email, token);

    return {
      success: true,
      message: 'Erfolgreich für regionale Aktualisierungen angemeldet'
    };
  });
}
