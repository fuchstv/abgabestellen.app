import { FastifyInstance } from 'fastify';
import { Database } from '../db';

interface WebhookOptions {
  db: Database;
}

interface NormalizedMailEvent {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId?: string;
  size?: number;
}

export async function webhookRoutes(app: FastifyInstance, _options: WebhookOptions) {
  // POST /api/webhooks/mail-event
  app.post<{
    Body: any;
  }>('/api/webhooks/mail-event', async (request, reply) => {
    const expectedSecret = process.env.MAIL_WEBHOOK_SECRET;

    // Verify authentication secret if configured
    if (expectedSecret) {
      const authHeader = request.headers.authorization;
      const customSecretHeader = request.headers['x-webhook-secret'];
      const signatureHeader = request.headers['x-signature'];

      const bearerToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

      const providedToken = bearerToken || customSecretHeader || signatureHeader;

      if (!providedToken || providedToken !== expectedSecret) {
        request.log.warn({ headers: request.headers }, 'Unauthorized mail webhook attempt');
        return reply.status(401).send({ error: 'Unauthorized: Invalid webhook secret' });
      }
    }

    const payload = request.body;
    if (!payload) {
      return reply.status(400).send({ error: 'Empty payload' });
    }

    // Normalize incoming events (supports both Stalwart telemetry array and direct JSON)
    const events: NormalizedMailEvent[] = [];

    if (Array.isArray(payload)) {
      for (const item of payload) {
        // Stalwart telemetry format: { event: "message-ingest.ham", timestamp, data: { from, to, subject, ... } }
        const data = item.data || item;
        const toList: string[] = Array.isArray(data.to) ? data.to : [data.to || ''];
        
        for (const recipient of toList) {
          if (recipient) {
            events.push({
              from: data.from || 'Unbekannt',
              to: recipient,
              subject: data.subject || '(Kein Betreff)',
              date: item.timestamp 
                ? new Date(item.timestamp * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
                : new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
              messageId: data['message-id'] || data.messageId,
              size: data.size
            });
          }
        }
      }
    } else if (typeof payload === 'object') {
      const toList: string[] = Array.isArray(payload.to) ? payload.to : [payload.to || ''];
      for (const recipient of toList) {
        events.push({
          from: payload.from || 'Unbekannt',
          to: recipient || 'info@abgabestellen.app',
          subject: payload.subject || '(Kein Betreff)',
          date: payload.date || new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
          messageId: payload.messageId || payload['message-id'],
          size: payload.size
        });
      }
    }

    if (events.length === 0) {
      return reply.send({ success: true, processed: 0, message: 'No email ingest events found in payload' });
    }

    // Process alerts for each event
    const results = [];
    for (const ev of events) {
      const res = await sendEmailAlert(ev, request.log);
      results.push(res);
    }

    return reply.send({
      success: true,
      processed: results.length,
      results
    });
  });
}

function getMailboxBadge(toEmail: string): { label: string; color: string; badge: string } {
  const emailLower = toEmail.toLowerCase();

  if (emailLower.includes('datenschutz@')) {
    return {
      label: 'DATENSCHUTZ',
      color: '#dc2626', // red
      badge: '🔴 [DATENSCHUTZ]'
    };
  }
  if (emailLower.includes('info@')) {
    return {
      label: 'INFO',
      color: '#d97706', // amber/yellow
      badge: '🟡 [INFO]'
    };
  }
  if (emailLower.includes('berlin@')) {
    return {
      label: 'BERLIN',
      color: '#16a34a', // green
      badge: '🟢 [BERLIN]'
    };
  }
  if (emailLower.includes('noreply@')) {
    return {
      label: 'SYSTEM',
      color: '#64748b', // slate
      badge: '⚪ [SYSTEM]'
    };
  }

  // Fallback for custom/dynamically added mailboxes
  const name = toEmail.split('@')[0].toUpperCase();
  return {
    label: name,
    color: '#2563eb', // blue
    badge: `🔵 [${name}]`
  };
}

async function sendEmailAlert(ev: NormalizedMailEvent, logger: any) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const targetEmail = process.env.ALERT_TARGET_EMAIL || 'fuchstv@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'abgabestellen.app Alarme <onboarding@resend.dev>';

  if (!resendApiKey) {
    logger.warn('RESEND_API_KEY is not set. Skipping outbound alert email.');
    return { status: 'skipped', reason: 'RESEND_API_KEY missing' };
  }

  const { badge, label, color } = getMailboxBadge(ev.to);
  const emailSubject = `${badge} Neue Mail von ${ev.from}: ${ev.subject}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { padding: 18px 24px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 11px; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em; background-color: ${color}; }
    .content { padding: 24px; }
    .field { margin-bottom: 16px; }
    .label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .value { font-size: 14px; font-weight: 500; color: #0f172a; word-break: break-word; }
    .subject { font-size: 16px; font-weight: 700; color: #0f172a; background: #f8fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; }
    .btn { display: inline-block; background-color: #d97706; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; }
    .meta { font-size: 11px; color: #94a3b8; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span style="font-weight: 800; font-size: 15px; color: #d97706;">abgabestellen.app</span>
      <span class="badge">${label}</span>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Betroffenes Postfach</div>
        <div class="value"><strong>${ev.to}</strong></div>
      </div>
      <div class="field">
        <div class="label">Absender</div>
        <div class="value">${ev.from}</div>
      </div>
      <div class="field">
        <div class="label">Betreff</div>
        <div class="subject">${ev.subject}</div>
      </div>
      <div class="field" style="margin-bottom: 0;">
        <div class="label">Eingangszeitpunkt</div>
        <div class="value" style="font-size: 12px; color: #64748b;">${ev.date}</div>
      </div>
    </div>
    <div class="footer">
      <a href="https://mail.abgabestellen.app/" class="btn" target="_blank">Zum Webmail-Login</a>
      <div class="meta">Automatischer E-Mail-Alarm via Google Cloud Run & Resend</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
${badge} Neue E-Mail auf ${ev.to}

Postfach: ${ev.to}
Absender: ${ev.from}
Betreff:  ${ev.subject}
Zeit:     ${ev.date}

Webmail:  https://mail.abgabestellen.app/
  `.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [targetEmail],
        subject: emailSubject,
        html: htmlContent,
        text: textContent
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error({ status: res.status, error: errBody }, 'Resend API returned error');
      return { status: 'error', code: res.status, details: errBody };
    }

    const data = await res.json();
    logger.info({ id: data.id, to: targetEmail }, 'Resend alert email sent successfully');
    return { status: 'sent', id: data.id };
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to send alert via Resend API');
    return { status: 'failed', error: err.message };
  }
}
