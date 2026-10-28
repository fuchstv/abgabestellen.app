import { Database } from 'better-sqlite3';
import { ContactLogEntry, GivingStatus } from '@shared/types';

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
      ORDER BY contacted_at DESC, id DESC
    `);
    return stmt.all(storeId) as ContactLogEntry[];
  }

  // Maintenance query: returns stores ordered by oldest or missing last_contact_at
  getOverdueStores(regionIds?: number[], limit: number = 50): any[] {
    let sql = `
      SELECT 
        b.id, b.name, b.str, b.plz, b.stadt, b.bezirk_id,
        r.name as region_name,
        gd.giving_status,
        gd.registration_required,
        gd.last_contact_at,
        gd.public_phone,
        b.ansprechpartner,
        b.telefon,
        (
          SELECT json_object('author_name', cl.author_name, 'note', cl.note, 'contacted_at', cl.contacted_at)
          FROM fs_store_contact_log cl
          WHERE cl.store_id = b.id
          ORDER BY cl.contacted_at DESC LIMIT 1
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

    sql += `
      ORDER BY (gd.last_contact_at IS NULL) DESC, gd.last_contact_at ASC, b.id ASC
      LIMIT ?
    `;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      ...r,
      latest_contact: r.latest_contact ? JSON.parse(r.latest_contact) : null
    }));
  }
}
