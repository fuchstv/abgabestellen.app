import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { importBerlinCsv } from '../scripts/import-berlin-csv';
import { RegionModel } from '../src/server/db/models/regions';
import { StoreModel } from '../src/server/db/models/stores';
import { ContactLogModel } from '../src/server/db/models/contactLog';
import { PermissionService } from '../src/server/auth/permissions';
import { UserRoleModel } from '../src/server/db/models/userRoles';
import { UserRoleType } from '../src/shared/types';

describe('Milestone 2 — Berlin CSV Import & Zero PII Leakage', () => {
  let db: Database.Database;
  let regionModel: RegionModel;
  let storeModel: StoreModel;
  let contactLogModel: ContactLogModel;
  let permissionService: PermissionService;
  let userRoleModel: UserRoleModel;

  beforeEach(() => {
    // In-memory SQLite database initialized with production schema
    db = new Database(':memory:');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/server/db/schema.sql'), 'utf-8');
    db.exec(schemaSql);

    regionModel = new RegionModel(db);
    storeModel = new StoreModel(db);
    contactLogModel = new ContactLogModel(db);
    permissionService = new PermissionService(db);
    userRoleModel = new UserRoleModel(db);

    // Seed Berlin Landesbezirk and 12 districts
    const berlin = regionModel.createRegion({ name: 'Berlin (Landesbezirk)', type: 1, lat: 52.52, lon: 13.405 });
    const districts = [
      'Charlottenburg-Wilmersdorf', 'Friedrichshain-Kreuzberg', 'Lichtenberg',
      'Marzahn-Hellersdorf', 'Mitte', 'Neukölln', 'Pankow', 'Reinickendorf',
      'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Treptow-Köpenick'
    ];
    for (const d of districts) {
      regionModel.createRegion({ name: d, parent_id: berlin.id, type: 2, lat: 52.52, lon: 13.405 });
    }
  });

  const defaultCsvPath = path.resolve(
    process.cwd(),
    'data/Abgabestellen Berlin - Neues_ Änderungen_abgabestellen.berlin@foodsharing.network - Abgabestellen.csv'
  );
  const fixtureCsvPath = path.resolve(__dirname, 'fixtures/sample_berlin.csv');
  const hasRealCsv = !process.env.TEST_FORCE_FIXTURE && fs.existsSync(defaultCsvPath);
  const targetCsvPath = hasRealCsv ? defaultCsvPath : fixtureCsvPath;

  it('1. Imports stores from Berlin CSV ignoring trailing empty rows', async () => {
    const result = await importBerlinCsv(targetCsvPath, db, { skipGeocoding: true });

    if (hasRealCsv) {
      expect(result.importedCount).toBe(275);
      expect(result.confidentialContactPersonCount).toBeGreaterThan(100);
      expect(result.confidentialPhoneCount).toBeGreaterThan(150);
    } else {
      expect(result.importedCount).toBe(5);
      expect(result.confidentialContactPersonCount).toBeGreaterThan(0);
      expect(result.confidentialPhoneCount).toBeGreaterThan(0);
    }

    const count = db.prepare('SELECT COUNT(*) as cnt FROM fs_betrieb').get() as { cnt: number };
    expect(count.cnt).toBe(hasRealCsv ? 275 : 5);

    const givingCount = db.prepare('SELECT COUNT(*) as cnt FROM fs_store_giving_details').get() as { cnt: number };
    expect(givingCount.cnt).toBe(hasRealCsv ? 275 : 5);
  });

  it('2. Zero PII Leakage: Public visitors receive NO private contacts or mobile numbers', async () => {
    await importBerlinCsv(targetCsvPath, db, { skipGeocoding: true });

    const allDistrictIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    const stores = storeModel.getStoresByRegion(allDistrictIds);
    expect(stores.length).toBe(hasRealCsv ? 275 : 5);

    for (const store of stores) {
      const perms = permissionService.getStorePermissions(undefined, store);
      const publicView: any = permissionService.sanitizeStore(store, perms);

      // Verify STRICT confidential fields are NEVER present in public view
      expect(publicView.ansprechpartner).toBeUndefined();
      expect(publicView.telefon).toBeUndefined();

      // If public_phone exists, it MUST be a landline (030...), NEVER a mobile number (015/016/017)
      if (publicView.giving_details?.public_phone) {
        const clean = publicView.giving_details.public_phone.replace(/[^0-9+]/g, '');
        expect(clean.startsWith('030') || clean.startsWith('+4930') || clean.startsWith('004930')).toBe(true);
        expect(clean.startsWith('015') || clean.startsWith('016') || clean.startsWith('017')).toBe(false);
      }
    }
  });

  it('3. Internal CRM: Managers with WORKGROUP_GIVING_STORES can view internal contacts & logs', async () => {
    await importBerlinCsv(targetCsvPath, db, { skipGeocoding: true });

    const managerUser = { uid: 'manager-alice', email: 'alice@abgabestellen.app', isSuperAdmin: false };
    userRoleModel.assignRole('manager-alice', 1, UserRoleType.WORKGROUP_GIVING_STORES);

    const sampleStore = storeModel.getInternalStoreById(1);
    expect(sampleStore).not.toBeNull();

    const perms = permissionService.getStorePermissions(managerUser, sampleStore!);
    expect(perms.canManageStore).toBe(true);
    expect(perms.canViewContactLog).toBe(true);
    expect(perms.canViewInternalContacts).toBe(true);

    const internalView = permissionService.sanitizeStore(sampleStore!, perms);
    expect(internalView.id).toBe(1);

    const logs = contactLogModel.getContactLogsByStoreId(1);
    expect(Array.isArray(logs)).toBe(true);
  });
});
