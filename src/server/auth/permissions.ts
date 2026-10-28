import { Database } from 'better-sqlite3';
import { AuthUser, InternalStore, PublicStore, UserRoleType } from '@shared/types';
import { UserRoleModel } from '../db/models/userRoles';
import { StoreModel } from '../db/models/stores';

export interface StorePermissions {
  canViewPublicDetails: boolean;
  canSubmitSuggestion: boolean;
  canManageStore: boolean;
  canViewContactLog: boolean;
  canViewInternalContacts: boolean;
}

export class PermissionService {
  private userRoleModel: UserRoleModel;
  private storeModel: StoreModel;

  constructor(private db: Database) {
    this.userRoleModel = new UserRoleModel(db);
    this.storeModel = new StoreModel(db);
  }

  getStorePermissions(user: AuthUser | undefined, store: InternalStore): StorePermissions {
    const isPublic = true;
    const canSubmit = !!user;

    if (!user) {
      return {
        canViewPublicDetails: isPublic,
        canSubmitSuggestion: false,
        canManageStore: false,
        canViewContactLog: false,
        canViewInternalContacts: false
      };
    }

    if (user.isSuperAdmin) {
      return {
        canViewPublicDetails: true,
        canSubmitSuggestion: true,
        canManageStore: true,
        canViewContactLog: true,
        canViewInternalContacts: true
      };
    }

    // Check regional upward permission inheritance:
    // User must have WORKGROUP_GIVING_STORES, AMBASSADOR, or ORGA in store.bezirk_id or any ancestor region
    const hasManagerRole = this.userRoleModel.hasPermissionInRegion(
      user.uid,
      store.bezirk_id,
      [UserRoleType.WORKGROUP_GIVING_STORES, UserRoleType.AMBASSADOR, UserRoleType.ORGA]
    );

    return {
      canViewPublicDetails: true,
      canSubmitSuggestion: true,
      canManageStore: hasManagerRole,
      canViewContactLog: hasManagerRole,
      canViewInternalContacts: hasManagerRole
    };
  }

  enforceStoreManager(user: AuthUser | undefined, storeId: number): InternalStore {
    if (!user) {
      const err: any = new Error('Authentifizierung erforderlich');
      err.statusCode = 401;
      throw err;
    }

    const store = this.storeModel.getInternalStoreById(storeId);
    if (!store) {
      const err: any = new Error(`Abgabestelle #${storeId} nicht gefunden`);
      err.statusCode = 404;
      throw err;
    }

    const permissions = this.getStorePermissions(user, store);
    if (!permissions.canManageStore) {
      const err: any = new Error('Zugriff verweigert: Keine Berechtigung für diese Abgabestelle (WORKGROUP_GIVING_STORES erforderlich)');
      err.statusCode = 403;
      throw err;
    }

    return store;
  }

  enforceRegionManager(user: AuthUser | undefined, regionId: number): void {
    if (!user) {
      const err: any = new Error('Authentifizierung erforderlich');
      err.statusCode = 401;
      throw err;
    }

    if (user.isSuperAdmin) return;

    const hasManagerRole = this.userRoleModel.hasPermissionInRegion(
      user.uid,
      regionId,
      [UserRoleType.WORKGROUP_GIVING_STORES, UserRoleType.AMBASSADOR, UserRoleType.ORGA]
    );

    if (!hasManagerRole) {
      const err: any = new Error('Zugriff verweigert: Keine Berechtigung für diese Region (WORKGROUP_GIVING_STORES erforderlich)');
      err.statusCode = 403;
      throw err;
    }
  }

  sanitizeStore(store: InternalStore, permissions: StorePermissions): PublicStore | InternalStore {
    if (permissions.canViewInternalContacts) {
      return store;
    }
    return this.storeModel.sanitizeStoreForPublic(store);
  }
}
