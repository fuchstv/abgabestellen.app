import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { Database } from 'better-sqlite3';

import { regionRoutes } from './routes/regions';
import { givingStoreRoutes } from './routes/givingStores';
import { contactLogRoutes } from './routes/contactLog';
import { suggestionRoutes } from './routes/suggestions';
import { maintenanceRoutes } from './routes/maintenance';
import { inviteRoutes } from './routes/invites';
import { feedRoutes } from './routes/feeds';
import { authRoutes } from './routes/auth';

export function buildApp(db: Database, options: { logger?: boolean } = {}): FastifyInstance {
  const app = fastify({
    logger: options.logger ?? false
  });

  // CORS
  app.register(cors, {
    origin: (origin, cb) => {
      // Allow localhost, abgabestellen.app, foodsharing.de
      cb(null, true);
    },
    credentials: true
  });

  // OpenAPI 3.1 Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: 'abgabestellen.app API',
        description: 'Multi-region REST API for food drop-off points (1:1 compatible with foodsharing-dev/foodsharing)',
        version: '1.0.0'
      },
      servers: [
        { url: 'https://abgabestellen.app', description: 'Production' },
        { url: 'http://localhost:8080', description: 'Local Development' }
      ]
    }
  });

  app.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });

  // Healthcheck endpoint for Cloud Run
  app.get('/healthz', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Client runtime configuration
  app.get('/api/config', async () => {
    return {
      googleMapsApiKey: process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
    };
  });

  // Register API Routes
  app.register(authRoutes, { db });
  app.register(regionRoutes, { db });
  app.register(givingStoreRoutes, { db });
  app.register(contactLogRoutes, { db });
  app.register(suggestionRoutes, { db });
  app.register(maintenanceRoutes, { db });
  app.register(inviteRoutes, { db });
  app.register(feedRoutes, { db });

  // Serve Frontend in Production with Cache-Busting on index.html
  const clientDistPath = path.resolve(process.cwd(), 'dist', 'client');
  if (fs.existsSync(clientDistPath)) {
    app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    });

    // SPA fallback to index.html for non-API routes (Always fresh, no browser caching)
    app.setNotFoundHandler((request, reply) => {
      if (!request.raw.url?.startsWith('/api/')) {
        reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ error: 'Endpoint nicht gefunden' });
    });
  }

  return app;
}
