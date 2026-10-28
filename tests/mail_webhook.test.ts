import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server/app';

describe('Mail Webhook & Resend Notification Route', () => {
  let db: DatabaseType;
  let app: FastifyInstance;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../src/server/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    process.env.MAIL_WEBHOOK_SECRET = 'test_secret_12345';
    process.env.RESEND_API_KEY = 're_test_key_abc';
    process.env.ALERT_TARGET_EMAIL = 'fuchstv@gmail.com';

    app = buildApp(db);
    await app.ready();
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    delete process.env.MAIL_WEBHOOK_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.ALERT_TARGET_EMAIL;
    await app.close();
  });

  it('1. Blocks unauthorized requests when secret is missing or invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/mail-event',
      payload: { from: 'someone@example.com', to: 'info@abgabestellen.app', subject: 'Hi' }
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toContain('Unauthorized');
  });

  it('2. Accepts authorized requests and dispatches Resend alert with color badge', async () => {
    let sentPayload: any = null;
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url === 'https://api.resend.com/emails') {
        sentPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'email_test_123' })
        };
      }
      return { ok: false, status: 404 };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/mail-event',
      headers: {
        authorization: 'Bearer test_secret_12345'
      },
      payload: {
        from: 'max@muster.de',
        to: 'datenschutz@abgabestellen.app',
        subject: 'Löschanfrage DSGVO'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
    expect(body.results[0].status).toBe('sent');

    expect(sentPayload).not.toBeNull();
    expect(sentPayload.to).toEqual(['fuchstv@gmail.com']);
    expect(sentPayload.subject).toContain('🔴 [DATENSCHUTZ]');
    expect(sentPayload.subject).toContain('max@muster.de');
    expect(sentPayload.subject).toContain('Löschanfrage DSGVO');
    expect(sentPayload.html).toContain('DATENSCHUTZ');
  });

  it('3. Supports Stalwart telemetry array payload format', async () => {
    let sentCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      sentCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `email_${sentCount}` })
      };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/mail-event',
      headers: {
        'x-webhook-secret': 'test_secret_12345'
      },
      payload: [
        {
          event: 'message-ingest.ham',
          timestamp: 1729000000,
          data: {
            from: 'koordinator@berlin.de',
            to: ['berlin@abgabestellen.app'],
            subject: 'Neuer Partnerladen'
          }
        }
      ]
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().processed).toBe(1);
    expect(sentCount).toBe(1);
  });

  it('4. Supports Stalwart MTA Hook stage="data" payload and returns {"action":"Accept"}', async () => {
    let sentPayload: any = null;
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      if (url === 'https://api.resend.com/emails') {
        sentPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'email_hook_456' })
        };
      }
      return { ok: false, status: 404 };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/mail-event',
      headers: {
        authorization: 'Bearer test_secret_12345'
      },
      payload: {
        context: {
          stage: 'data',
          client: { ip: '1.2.3.4' }
        },
        envelope: {
          from: { address: 'partner@berlin-food.de' },
          to: [{ address: 'berlin@abgabestellen.app' }]
        },
        message: {
          headers: [
            ['Subject', 'Neue Kiste abgegeben\r\n'],
            ['From', 'partner@berlin-food.de\r\n'],
            ['To', 'berlin@abgabestellen.app\r\n']
          ],
          contents: 'Hallo Team, wir haben heute 3 Kisten Bananen bekommen.',
          size: 320
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.action).toBe('accept');
    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);

    expect(sentPayload).not.toBeNull();
    expect(sentPayload.to).toEqual(['fuchstv@gmail.com']);
    expect(sentPayload.subject).toContain('🟢 [BERLIN]');
    expect(sentPayload.subject).toContain('partner@berlin-food.de');
    expect(sentPayload.subject).toContain('Neue Kiste abgegeben');
    expect(sentPayload.html).toContain('BERLIN');
    expect(sentPayload.html).toContain('3 Kisten Bananen');
    expect(sentPayload.text).toContain('3 Kisten Bananen');
  });
});
