import { Database } from 'better-sqlite3';
import { 
  InternalStore, 
  PublicStore, 
  GivingStoreDetails, 
  GivingStatus, 
  StoreStatus, 
  StoreCategoryType 
} from '@shared/types';

export class StoreModel {
  constructor(private db: Database) {}

  createStore(data: {
    bezirk_id: number;
    name: string;
    str?: string;
    plz?: string;
    stadt?: string;
    lat?: number;
    lon?: number;
    public_info?: string;
    ansprechpartner?: string;
    telefon?: string;
    betrieb_status_id?: StoreStatus;
    betrieb_kategorie_id?: StoreCategoryType;
    external_fs_betrieb_id?: number | null;
    giving_details?: Partial<GivingStoreDetails>;
  }): InternalStore {
    const insertStore = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO fs_betrieb (
          bezirk_id, name, str, plz, stadt, lat, lon,
          public_info, ansprechpartner, telefon,
          betrieb_status_id, betrieb_kategorie_id, external_fs_betrieb_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const result = stmt.run(
        data.bezirk_id,
        data.name,
        data.str ?? '',
        data.plz ?? '',
        data.stadt ?? '',
        data.lat ?? 0.0,
        data.lon ?? 0.0,
        data.public_info ?? '',
        data.ansprechpartner ?? '',
        data.telefon ?? '',
        data.betrieb_status_id ?? StoreStatus.COOPERATION,
        data.betrieb_kategorie_id ?? StoreCategoryType.GIVING,
        data.external_fs_betrieb_id ?? null
      );

      const storeId = Number(result.lastInsertRowid);
      const gd = data.giving_details || {};

      const gdStmt = this.db.prepare(`
        INSERT INTO fs_store_giving_details (
          store_id, public_contact_name, public_phone, website,
          dropoff_times, accepted_items, registration_required,
          recipient_count, giving_status, last_contact_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      gdStmt.run(
        storeId,
        gd.public_contact_name ?? '',
        gd.public_phone ?? '',
        gd.website ?? '',
        gd.dropoff_times ?? null,
        gd.accepted_items ?? null,
        gd.registration_required ? 1 : 0,
        gd.recipient_count ?? '',
        gd.giving_status ?? GivingStatus.CURRENT,
        gd.last_contact_at ?? null
      );

      return storeId;
    });

    const storeId = insertStore();
    return this.getInternalStoreById(storeId)!;
  }

  getInternalStoreById(storeId: number): InternalStore | null {
    const stmt = this.db.prepare(`
      SELECT 
        b.*,
        r.name as region_name,
        gd.public_contact_name,
        gd.public_phone,
        gd.website,
        gd.dropoff_times,
        gd.accepted_items,
        gd.registration_required,
        gd.recipient_count,
        gd.giving_status,
        gd.last_contact_at,
        gd.updated_at as gd_updated_at
      FROM fs_betrieb b
      LEFT JOIN fs_bezirk r ON b.bezirk_id = r.id
      LEFT JOIN fs_store_giving_details gd ON gd.store_id = b.id
      WHERE b.id = ?
    `);

    const row = stmt.get(storeId) as any;
    if (!row) return null;

    return this.rowToInternalStore(row);
  }

  getPublicStoreById(storeId: number): PublicStore | null {
    const internal = this.getInternalStoreById(storeId);
    if (!internal) return null;
    return this.sanitizeStoreForPublic(internal);
  }

  getStoresByRegion(regionIds: number[], options?: {
    registrationRequiredOnly?: boolean;
    onlyWithoutRegistration?: boolean;
    givingStatus?: GivingStatus;
    onlyActive?: boolean;
  }): InternalStore[] {
    if (regionIds.length === 0) return [];

    const placeholders = regionIds.map(() => '?').join(',');
    let sql = `
      SELECT 
        b.*,
        r.name as region_name,
        gd.public_contact_name,
        gd.public_phone,
        gd.website,
        gd.dropoff_times,
        gd.accepted_items,
        gd.registration_required,
        gd.recipient_count,
        gd.giving_status,
        gd.last_contact_at,
        gd.updated_at as gd_updated_at
      FROM fs_betrieb b
      LEFT JOIN fs_bezirk r ON b.bezirk_id = r.id
      LEFT JOIN fs_store_giving_details gd ON gd.store_id = b.id
      WHERE b.bezirk_id IN (${placeholders})
    `;

    const params: any[] = [...regionIds];

    if (options?.onlyActive !== false) {
      sql += ` AND b.betrieb_status_id != ${StoreStatus.PERMANENTLY_CLOSED}`;
    }

    if (options?.onlyWithoutRegistration) {
      sql += ` AND COALESCE(gd.registration_required, 0) = 0`;
    } else if (options?.registrationRequiredOnly) {
      sql += ` AND gd.registration_required = 1`;
    }

    if (options?.givingStatus !== undefined) {
      sql += ` AND gd.giving_status = ?`;
      params.push(options.givingStatus);
    }

    sql += ` ORDER BY b.name ASC`;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map(r => this.rowToInternalStore(r));
  }

  updateStore(storeId: number, data: {
    name?: string;
    bezirk_id?: number;
    str?: string;
    plz?: string;
    stadt?: string;
    lat?: number;
    lon?: number;
    public_info?: string;
    ansprechpartner?: string;
    telefon?: string;
    betrieb_status_id?: StoreStatus;
    giving_details?: Partial<GivingStoreDetails>;
  }): InternalStore | null {
    const updateTransaction = this.db.transaction(() => {
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
      if (data.bezirk_id !== undefined) { updates.push('bezirk_id = ?'); params.push(data.bezirk_id); }
      if (data.str !== undefined) { updates.push('str = ?'); params.push(data.str); }
      if (data.plz !== undefined) { updates.push('plz = ?'); params.push(data.plz); }
      if (data.stadt !== undefined) { updates.push('stadt = ?'); params.push(data.stadt); }
      if (data.lat !== undefined) { updates.push('lat = ?'); params.push(data.lat); }
      if (data.lon !== undefined) { updates.push('lon = ?'); params.push(data.lon); }
      if (data.public_info !== undefined) { updates.push('public_info = ?'); params.push(data.public_info); }
      if (data.ansprechpartner !== undefined) { updates.push('ansprechpartner = ?'); params.push(data.ansprechpartner); }
      if (data.telefon !== undefined) { updates.push('telefon = ?'); params.push(data.telefon); }
      if (data.betrieb_status_id !== undefined) { updates.push('betrieb_status_id = ?'); params.push(data.betrieb_status_id); }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        params.push(storeId);
        this.db.prepare(`UPDATE fs_betrieb SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      if (data.giving_details) {
        const gd = data.giving_details;
        const gdUpdates: string[] = [];
        const gdParams: any[] = [];

        if (gd.public_contact_name !== undefined) { gdUpdates.push('public_contact_name = ?'); gdParams.push(gd.public_contact_name); }
        if (gd.public_phone !== undefined) { gdUpdates.push('public_phone = ?'); gdParams.push(gd.public_phone); }
        if (gd.website !== undefined) { gdUpdates.push('website = ?'); gdParams.push(gd.website); }
        if (gd.dropoff_times !== undefined) { gdUpdates.push('dropoff_times = ?'); gdParams.push(gd.dropoff_times); }
        if (gd.accepted_items !== undefined) { gdUpdates.push('accepted_items = ?'); gdParams.push(gd.accepted_items); }
        if (gd.registration_required !== undefined) { gdUpdates.push('registration_required = ?'); gdParams.push(gd.registration_required ? 1 : 0); }
        if (gd.recipient_count !== undefined) { gdUpdates.push('recipient_count = ?'); gdParams.push(gd.recipient_count); }
        if (gd.giving_status !== undefined) { gdUpdates.push('giving_status = ?'); gdParams.push(gd.giving_status); }
        if (gd.last_contact_at !== undefined) { gdUpdates.push('last_contact_at = ?'); gdParams.push(gd.last_contact_at); }

        if (gdUpdates.length > 0) {
          gdUpdates.push("updated_at = datetime('now')");
          gdParams.push(storeId);
          this.db.prepare(`UPDATE fs_store_giving_details SET ${gdUpdates.join(', ')} WHERE store_id = ?`).run(...gdParams);
        }
      }
    });

    updateTransaction();
    return this.getInternalStoreById(storeId);
  }

  // Pure function to sanitize confidential fields
  sanitizeStoreForPublic(store: InternalStore): PublicStore {
    const { ansprechpartner, telefon, contact_logs, ...publicStore } = store;
    return publicStore;
  }

  private rowToInternalStore(row: any): InternalStore {
    return {
      id: row.id,
      bezirk_id: row.bezirk_id,
      region_name: row.region_name,
      name: row.name,
      str: row.str,
      plz: row.plz,
      stadt: row.stadt,
      lat: row.lat,
      lon: row.lon,
      public_info: row.public_info,
      ansprechpartner: row.ansprechpartner,
      telefon: row.telefon,
      betrieb_status_id: row.betrieb_status_id,
      betrieb_kategorie_id: row.betrieb_kategorie_id,
      external_fs_betrieb_id: row.external_fs_betrieb_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      giving_details: {
        store_id: row.id,
        public_contact_name: row.public_contact_name ?? '',
        public_phone: row.public_phone ?? '',
        website: row.website ?? '',
        dropoff_times: row.dropoff_times ?? null,
        accepted_items: row.accepted_items ?? null,
        registration_required: row.registration_required ?? 0,
        recipient_count: row.recipient_count ?? '',
        giving_status: row.giving_status ?? GivingStatus.CURRENT,
        last_contact_at: row.last_contact_at ?? null,
        updated_at: row.gd_updated_at ?? row.updated_at
      }
    };
  }
}
