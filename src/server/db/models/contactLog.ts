import { Database } from 'better-sqlite3';
import { ContactLogEntry, GivingStatus } from '@shared/types';

function parseContactTimestampMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes('T')
    ? trimmed
    : `${trimmed.replace(' ', 'T')}${trimmed.endsWith('Z') ? '' : 'Z'}`;
  const ms = Date.parse(normalized);
  if (!Number.isNaN(ms)) return ms;
  const fallback = Date.parse(trimmed);
  return Number.isNaN(fallback) ? null : fallback;
}

export class ContactLogModel {
  constructor(private db: Database) {}

  addContactLogEntry(data: {
    store_id: number;
    author_user_id: string;
    author_name: string;
    channel?: 'Telefon' | 'E-Mail' | 'Vor Ort' | 'Messenger' | 'Sonstiges';
    contact_person?: string;
    note: string;
    confirmed_current?: boolean;
    contacted_at?: string;
  }): ContactLogEntry {
    const contactedAt = data.contacted_at || new Date().toISOString();
    const confirmedCurrent = data.confirmed_current ? 1 : 0;

    const insertTransaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO fs_store_contact_log (
          store_id, author_user_id, author_name, channel,
          contact_person, note, confirmed_current, contacted_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const result = stmt.run(
        data.store_id,
        data.author_user_id,
        data.author_name,
        data.channel || 'Telefon',
        data.contact_person || '',
        data.note,
        confirmedCurrent,
        contactedAt
      );

      const entryId = Number(result.lastInsertRowid);

      // Auto-update fs_store_giving_details.last_contact_at
      let updateSql = `
        UPDATE fs_store_giving_details 
        SET last_contact_at = ?, updated_at = datetime('now')
      `;
      const updateParams: any[] = [contactedAt];

      if (confirmedCurrent === 1) {
        updateSql += `, giving_status = ?`;
        updateParams.push(GivingStatus.CURRENT);
      }

      updateSql += ` WHERE store_id = ?`;
      updateParams.push(data.store_id);

      this.db.prepare(updateSql).run(...updateParams);

      return entryId;
    });

    const entryId = insertTransaction();
    return this.getContactLogById(entryId)!;
  }

  getContactLogById(id: number): ContactLogEntry | null {
    const stmt = this.db.prepare('SELECT * FROM fs_store_contact_log WHERE id = ?');
    return (stmt.get(id) as ContactLogEntry) || null;
  }

  getContactLogsByStoreId(storeId: number): ContactLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM fs_store_contact_log 
      WHERE store_id = ? 
      ORDER BY datetime(contacted_at) DESC, id DESC
    `);
    return stmt.all(storeId) as ContactLogEntry[];
  }

  // Maintenance query: returns stores ordered by multi-tier verification need ("Nach Bedarf")
  getOverdueStores(regionIds?: number[], limit: number = 1000): any[] {
    if (regionIds && regionIds.length === 0) {
      return [];
    }

    let sql = `
      SELECT 
        b.id, b.name, b.str, b.plz, b.stadt, b.bezirk_id,
        r.name as region_name,
        gd.giving_status,
        gd.registration_required,
        gd.last_contact_at,
        gd.public_phone,
        gd.public_contact_name,
        gd.dropoff_times,
        gd.accepted_items,
        b.ansprechpartner,
        b.telefon,
        (
          SELECT COUNT(*)
          FROM fs_store_giving_suggestion s
          WHERE s.store_id = b.id AND s.status = 0
        ) as pending_suggestions_count,
        (
          SELECT json_object('author_name', cl.author_name, 'note', cl.note, 'contacted_at', cl.contacted_at, 'channel', cl.channel)
          FROM fs_store_contact_log cl
          WHERE cl.store_id = b.id
          ORDER BY datetime(cl.contacted_at) DESC, cl.id DESC LIMIT 1
        ) as latest_contact
      FROM fs_betrieb b
      JOIN fs_store_giving_details gd ON gd.store_id = b.id
      JOIN fs_bezirk r ON b.bezirk_id = r.id
      WHERE b.betrieb_status_id != 6
    `;

    const params: any[] = [];
    if (regionIds && regionIds.length > 0) {
      const placeholders = regionIds.map(() => '?').join(',');
      sql += ` AND b.bezirk_id IN (${placeholders})`;
      params.push(...regionIds);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    const nowMs = Date.now();

    const enriched = rows.map(r => {
      const contactMs = parseContactTimestampMs(r.last_contact_at);
      const daysSinceContact =
        contactMs === null ? null : Math.max(0, Math.floor((nowMs - contactMs) / (1000 * 60 * 60 * 24)));
      const isPaused = Number(r.giving_status) === GivingStatus.PAUSED || /\binaktiv\b/i.test(r.name || '');
      const pendingCount = Number(r.pending_suggestions_count || 0);
      const inReview = Number(r.giving_status) === GivingStatus.IN_REVIEW;

      let needTier = 4;
      let trafficLight: 'urgent' | 'red' | 'yellow' | 'green' | 'paused' = 'green';
      let needReason = 'Aktuell verifiziert';

      if (isPaused) {
        needTier = 5;
        trafficLight = 'paused';
        needReason = 'Pausiert / Inaktiv';
      } else if (pendingCount > 0 || inReview) {
        needTier = 1;
        trafficLight = 'urgent';
        needReason =
          pendingCount > 0
            ? `${pendingCount} offene${pendingCount === 1 ? 'r Vorschlag' : ' Vorschläge'}`
            : 'In Aktualisierung';
      } else if (daysSinceContact === null || daysSinceContact >= 180) {
        needTier = 2;
        trafficLight = 'red';
        needReason = daysSinceContact === null ? 'Nie verifiziert' : `Überfällig (${daysSinceContact} Tage)`;
      } else if (daysSinceContact >= 90) {
        needTier = 3;
        trafficLight = 'yellow';
        needReason = `Bald fällig (${daysSinceContact} Tage)`;
      } else {
        needTier = 4;
        trafficLight = 'green';
        needReason = daysSinceContact === 0 ? 'Heute verifiziert' : `Vor ${daysSinceContact} Tagen`;
      }

      const missingCoreInfo = (!r.dropoff_times || !String(r.dropoff_times).trim()) ? 1 : 0;

      return {
        ...r,
        pending_suggestions_count: pendingCount,
        days_since_contact: daysSinceContact,
        is_paused: isPaused,
        need_tier: needTier,
        traffic_light: trafficLight,
        need_reason: needReason,
        _sort_contact_ms: contactMs,
        _missing_core_info: missingCoreInfo,
        latest_contact: r.latest_contact ? JSON.parse(r.latest_contact) : null
      };
    });

    enriched.sort((a, b) => {
      if (a.need_tier !== b.need_tier) return a.need_tier - b.need_tier;

      // Within tier 1, prioritize higher open suggestion count first
      if (a.need_tier === 1 && a.pending_suggestions_count !== b.pending_suggestions_count) {
        return b.pending_suggestions_count - a.pending_suggestions_count;
      }

      // Never-verified (null) comes before dated entries
      const aNull = a._sort_contact_ms === null ? 0 : 1;
      const bNull = b._sort_contact_ms === null ? 0 : 1;
      if (aNull !== bNull) return aNull - bNull;

      // Oldest contact timestamp comes first
      if (a._sort_contact_ms !== null && b._sort_contact_ms !== null && a._sort_contact_ms !== b._sort_contact_ms) {
        return a._sort_contact_ms - b._sort_contact_ms;
      }

      // Stores missing dropoff times bubble slightly ahead
      if (a._missing_core_info !== b._missing_core_info) {
        return b._missing_core_info - a._missing_core_info;
      }

      return a.id - b.id;
    });

    return enriched.slice(0, limit).map(({ _sort_contact_ms, _missing_core_info, ...clean }) => clean);
  }
}
