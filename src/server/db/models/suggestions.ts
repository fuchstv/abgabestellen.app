import { Database } from 'better-sqlite3';
import { 
  GivingStoreSuggestion, 
  GivingStoreSuggestionPayload, 
  SuggestionStatus, 
  StoreStatus, 
  StoreCategoryType, 
  GivingStatus 
} from '@shared/types';

export class SuggestionModel {
  constructor(private db: Database) {}

  createSuggestion(data: {
    region_id: number;
    store_id?: number | null;
    author_user_id: string;
    author_email?: string;
    payload: GivingStoreSuggestionPayload;
    author_note?: string | null;
  }): GivingStoreSuggestion {
    const stmt = this.db.prepare(`
      INSERT INTO fs_store_giving_suggestion (
        region_id, store_id, author_user_id, author_email,
        status, payload, author_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      data.region_id,
      data.store_id ?? null,
      data.author_user_id,
      data.author_email ?? '',
      SuggestionStatus.PENDING,
      JSON.stringify(data.payload),
      data.author_note ?? null
    );

    return this.getSuggestionById(Number(result.lastInsertRowid))!;
  }

  getSuggestionById(id: number): GivingStoreSuggestion | null {
    const stmt = this.db.prepare(`
      SELECT 
        s.*,
        r.name as region_name,
        b.name as store_name
      FROM fs_store_giving_suggestion s
      JOIN fs_bezirk r ON s.region_id = r.id
      LEFT JOIN fs_betrieb b ON s.store_id = b.id
      WHERE s.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      payload: JSON.parse(row.payload)
    };
  }

  getSuggestionsByRegions(regionIds: number[], status?: SuggestionStatus): GivingStoreSuggestion[] {
    if (regionIds.length === 0) return [];
    const placeholders = regionIds.map(() => '?').join(',');

    let sql = `
      SELECT 
        s.*,
        r.name as region_name,
        b.name as store_name
      FROM fs_store_giving_suggestion s
      JOIN fs_bezirk r ON s.region_id = r.id
      LEFT JOIN fs_betrieb b ON s.store_id = b.id
      WHERE s.region_id IN (${placeholders})
    `;
    const params: any[] = [...regionIds];

    if (status !== undefined) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY s.created_at DESC`;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(r => ({
      ...r,
      payload: JSON.parse(r.payload)
    }));
  }

  reviewSuggestion(
    id: number,
    reviewerId: string,
    decision: SuggestionStatus.APPROVED | SuggestionStatus.REJECTED,
    reviewNote?: string,
    overrides?: Partial<GivingStoreSuggestionPayload>
  ): { suggestion: GivingStoreSuggestion; storeId?: number } {
    const existing = this.getSuggestionById(id);
    if (!existing) {
      throw new Error(`Suggestion #${id} not found`);
    }
    if (existing.status !== SuggestionStatus.PENDING) {
      throw new Error(`Suggestion #${id} has already been reviewed`);
    }

    const reviewTransaction = this.db.transaction(() => {
      let finalStoreId = existing.store_id;

      if (decision === SuggestionStatus.APPROVED) {
        const mergedPayload: GivingStoreSuggestionPayload = {
          ...existing.payload,
          ...overrides
        };

        if (!finalStoreId) {
          // 1. Create NEW Store
          const storeStmt = this.db.prepare(`
            INSERT INTO fs_betrieb (
              bezirk_id, name, str, plz, stadt, lat, lon,
              public_info, ansprechpartner, betrieb_status_id, betrieb_kategorie_id,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `);

          const result = storeStmt.run(
            existing.region_id,
            mergedPayload.name || 'Unbenannte Abgabestelle',
            mergedPayload.street || '',
            mergedPayload.postalCode || '',
            mergedPayload.city || '',
            mergedPayload.lat ?? 0.0,
            mergedPayload.lon ?? 0.0,
            mergedPayload.publicInfo || '',
            mergedPayload.internalContactName || '',
            mergedPayload.permanentlyClosed ? StoreStatus.PERMANENTLY_CLOSED : StoreStatus.COOPERATION,
            StoreCategoryType.GIVING
          );

          finalStoreId = Number(result.lastInsertRowid);

          // Insert giving details
          const gdStmt = this.db.prepare(`
            INSERT INTO fs_store_giving_details (
              store_id, public_contact_name, public_phone, website,
              dropoff_times, accepted_items, registration_required,
              recipient_count, giving_status, last_contact_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `);

          gdStmt.run(
            finalStoreId,
            mergedPayload.publicContactName || '',
            mergedPayload.publicPhone || '',
            mergedPayload.website || '',
            mergedPayload.dropoffTimes || null,
            mergedPayload.acceptedItems || null,
            mergedPayload.registrationRequired ? 1 : 0,
            mergedPayload.recipientCount || '',
            mergedPayload.givingStatus ?? GivingStatus.CURRENT
          );

          // Add to regional update feed
          this.db.prepare(`
            INSERT INTO fs_store_updates_feed (
              region_id, store_id, author_user_id, title, content, update_type, created_at
            ) VALUES (?, ?, ?, ?, ?, 'CREATED', datetime('now'))
          `).run(
            existing.region_id,
            finalStoreId,
            reviewerId,
            `Neue Abgabestelle: ${mergedPayload.name}`,
            `In ${mergedPayload.street || ''}, ${mergedPayload.postalCode || ''} ${mergedPayload.city || ''} wurde eine neue Abgabestelle hinzugefügt.`
          );

        } else {
          // 2. Update EXISTING Store
          const storeUpdates: string[] = [];
          const storeParams: any[] = [];

          if (mergedPayload.name !== undefined && mergedPayload.name !== null) {
            storeUpdates.push('name = ?'); storeParams.push(mergedPayload.name);
          }
          if (mergedPayload.street !== undefined && mergedPayload.street !== null) {
            storeUpdates.push('str = ?'); storeParams.push(mergedPayload.street);
          }
          if (mergedPayload.postalCode !== undefined && mergedPayload.postalCode !== null) {
            storeUpdates.push('plz = ?'); storeParams.push(mergedPayload.postalCode);
          }
          if (mergedPayload.city !== undefined && mergedPayload.city !== null) {
            storeUpdates.push('stadt = ?'); storeParams.push(mergedPayload.city);
          }
          if (mergedPayload.lat !== undefined && mergedPayload.lat !== null) {
            storeUpdates.push('lat = ?'); storeParams.push(mergedPayload.lat);
          }
          if (mergedPayload.lon !== undefined && mergedPayload.lon !== null) {
            storeUpdates.push('lon = ?'); storeParams.push(mergedPayload.lon);
          }
          if (mergedPayload.publicInfo !== undefined && mergedPayload.publicInfo !== null) {
            storeUpdates.push('public_info = ?'); storeParams.push(mergedPayload.publicInfo);
          }
          if (mergedPayload.internalContactName !== undefined && mergedPayload.internalContactName !== null) {
            storeUpdates.push('ansprechpartner = ?'); storeParams.push(mergedPayload.internalContactName);
          }
          if (mergedPayload.permanentlyClosed === true) {
            storeUpdates.push('betrieb_status_id = ?'); storeParams.push(StoreStatus.PERMANENTLY_CLOSED);
          }

          if (storeUpdates.length > 0) {
            storeUpdates.push("updated_at = datetime('now')");
            storeParams.push(finalStoreId);
            this.db.prepare(`UPDATE fs_betrieb SET ${storeUpdates.join(', ')} WHERE id = ?`).run(...storeParams);
          }

          // Update giving details
          const gdUpdates: string[] = [];
          const gdParams: any[] = [];

          if (mergedPayload.publicContactName !== undefined && mergedPayload.publicContactName !== null) {
            gdUpdates.push('public_contact_name = ?'); gdParams.push(mergedPayload.publicContactName);
          }
          if (mergedPayload.publicPhone !== undefined && mergedPayload.publicPhone !== null) {
            gdUpdates.push('public_phone = ?'); gdParams.push(mergedPayload.publicPhone);
          }
          if (mergedPayload.website !== undefined && mergedPayload.website !== null) {
            gdUpdates.push('website = ?'); gdParams.push(mergedPayload.website);
          }
          if (mergedPayload.dropoffTimes !== undefined && mergedPayload.dropoffTimes !== null) {
            gdUpdates.push('dropoff_times = ?'); gdParams.push(mergedPayload.dropoffTimes);
          }
          if (mergedPayload.acceptedItems !== undefined && mergedPayload.acceptedItems !== null) {
            gdUpdates.push('accepted_items = ?'); gdParams.push(mergedPayload.acceptedItems);
          }
          if (mergedPayload.registrationRequired !== undefined && mergedPayload.registrationRequired !== null) {
            gdUpdates.push('registration_required = ?'); gdParams.push(mergedPayload.registrationRequired ? 1 : 0);
          }
          if (mergedPayload.recipientCount !== undefined && mergedPayload.recipientCount !== null) {
            gdUpdates.push('recipient_count = ?'); gdParams.push(mergedPayload.recipientCount);
          }
          if (mergedPayload.givingStatus !== undefined && mergedPayload.givingStatus !== null) {
            gdUpdates.push('giving_status = ?'); gdParams.push(mergedPayload.givingStatus);
          }

          if (gdUpdates.length > 0) {
            gdUpdates.push("updated_at = datetime('now')");
            gdParams.push(finalStoreId);
            this.db.prepare(`UPDATE fs_store_giving_details SET ${gdUpdates.join(', ')} WHERE store_id = ?`).run(...gdParams);
          }

          // Add to regional update feed
          this.db.prepare(`
            INSERT INTO fs_store_updates_feed (
              region_id, store_id, author_user_id, title, content, update_type, created_at
            ) VALUES (?, ?, ?, ?, ?, 'CHANGE', datetime('now'))
          `).run(
            existing.region_id,
            finalStoreId,
            reviewerId,
            `Abgabestelle aktualisiert: ${mergedPayload.name || existing.store_name}`,
            `Änderungsvorschlag wurde geprüft und übernommen.`
          );
        }
      }

      // Update suggestion status
      this.db.prepare(`
        UPDATE fs_store_giving_suggestion
        SET status = ?, reviewed_by_user_id = ?, review_note = ?, reviewed_at = datetime('now')
        WHERE id = ?
      `).run(decision, reviewerId, reviewNote ?? null, id);

      return {
        suggestion: this.getSuggestionById(id)!,
        storeId: finalStoreId ?? undefined
      };
    });

    return reviewTransaction();
  }
}
