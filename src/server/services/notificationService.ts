export interface NewSuggestionNotificationParams {
  regionName: string;
  storeName?: string;
  authorEmail: string;
  authorNote?: string;
  payload: any;
  logger?: any;
}

export async function notifyNewSuggestion(params: NewSuggestionNotificationParams) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const targetEmail = process.env.ALERT_TARGET_EMAIL || 'fuchstv@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'abgabestellen.app Alarme <onboarding@resend.dev>';

  if (!resendApiKey) {
    if (params.logger?.debug) {
      params.logger.debug('RESEND_API_KEY is not set. Skipping suggestion email alert.');
    }
    return { status: 'skipped', reason: 'RESEND_API_KEY missing' };
  }

  const storeDisplay = params.storeName || params.payload?.name || 'Neue Abgabestelle';
  const emailSubject = `📬 [VORSCHLAG] Neuer Änderungsvorschlag für ${storeDisplay} (${params.regionName})`;

  const textContent = `
Neuer Änderungsvorschlag eingegangen!

Region:        ${params.regionName}
Abgabestelle:  ${storeDisplay}
Eingereicht:   ${params.authorEmail}
${params.authorNote ? `Notiz:         ${params.authorNote}\n` : ''}

Details:
- Abgabezeiten: ${params.payload?.dropoffTimes || '-'}
- Angenommen:   ${params.payload?.acceptedItems || '-'}
- Voranmeldung: ${params.payload?.registrationRequired ? 'Ja' : 'Nein'}
- Telefon:      ${params.payload?.publicPhone || '-'}
- Webseite:     ${params.payload?.website || '-'}

Prüfen und freigeben:
https://abgabestellen.app/maintenance
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { padding: 18px 24px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 11px; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em; background-color: #d97706; }
    .content { padding: 24px; }
    .field { margin-bottom: 14px; }
    .label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
    .value { font-size: 14px; font-weight: 500; color: #0f172a; word-break: break-word; }
    .note { font-size: 13px; color: #334155; background: #fffbeb; padding: 10px 14px; border-radius: 8px; border-left: 4px solid #d97706; font-style: italic; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; }
    .btn { display: inline-block; background-color: #d97706; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span style="font-weight: 800; font-size: 15px; color: #d97706;">abgabestellen.app</span>
      <span class="badge">Änderungsvorschlag</span>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Abgabestelle</div>
        <div class="value" style="font-size: 16px; font-weight: 700;">${escapeHtml(storeDisplay)}</div>
      </div>
      <div class="field">
        <div class="label">Region</div>
        <div class="value">${escapeHtml(params.regionName)}</div>
      </div>
      <div class="field">
        <div class="label">Eingereicht von</div>
        <div class="value">${escapeHtml(params.authorEmail)}</div>
      </div>
      ${params.authorNote ? `
      <div class="field">
        <div class="label">Notiz für das Team</div>
        <div class="note">"${escapeHtml(params.authorNote)}"</div>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <a href="https://abgabestellen.app/maintenance" class="btn" target="_blank">Zur Prüf-Inbox</a>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 10px;">Automatischer Alarm via Google Cloud Run &amp; Resend</div>
    </div>
  </div>
</body>
</html>
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
      const errText = await res.text();
      params.logger?.warn?.({ status: res.status, err: errText }, 'Resend API failed to dispatch suggestion alert');
      return { status: 'error', code: res.status };
    }

    const data = await res.json();
    params.logger?.info?.({ id: data.id }, 'Dispatched suggestion alert via Resend');
    return { status: 'sent', id: data.id };
  } catch (err: any) {
    params.logger?.warn?.({ err: err.message }, 'Failed to send suggestion alert');
    return { status: 'failed', error: err.message };
  }
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
