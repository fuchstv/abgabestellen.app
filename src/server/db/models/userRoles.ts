import { Database } from 'better-sqlite3';
import crypto from 'crypto';
import {
  UserRoleType,
  UserRegionRole,
  TeamMember,
  TeamInviteItem
} from '@shared/types';

export class UserRoleModel {
  constructor(private db: Database) {}

  assignRole(userId: string, regionId: number, role: UserRoleType): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO fs_user_roles (user_id, region_id, role, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(userId, regionId, role);
  }

  removeRole(userId: string, regionId: number, role: UserRoleType): boolean {
    const res = this.db.prepare(`
      DELETE FROM fs_user_roles 
      WHERE user_id = ? AND region_id = ? AND role = ?
    `).run(userId, regionId, role);
    return res.changes > 0;
  }

  removeAllRoles(userId: string): number {
    const res = this.db.prepare('DELETE FROM fs_user_roles WHERE user_id = ?').run(userId);
    return res.changes;
  }

  getUserRoles(userId: string): UserRegionRole[] {
    const stmt = this.db.prepare(`
      SELECT ur.*, r.name as region_name, r.type as region_type
      FROM fs_user_roles ur
      LEFT JOIN fs_bezirk r ON r.id = ur.region_id
      WHERE ur.user_id = ?
      ORDER BY r.type ASC, r.name ASC, ur.role ASC
    `);
    return stmt.all(userId) as UserRegionRole[];
  }

  isGlobalOrga(userId: string, isSuperAdmin: boolean = false): boolean {
    if (isSuperAdmin) return true;
    if (!userId) return false;

    const globalOrga = this.db.prepare(`
      SELECT 1 FROM fs_user_roles WHERE user_id = ? AND role = ? LIMIT 1
    `).get(userId, UserRoleType.ORGA);
    if (globalOrga) return true;

    try {
      const superRow = this.db.prepare(`
        SELECT is_super_admin, is_active FROM fs_user WHERE id = ? LIMIT 1
      `).get(userId) as any;
      if (superRow && Number(superRow.is_active) !== 0 && Number(superRow.is_super_admin) === 1) {
        return true;
      }
    } catch {
      // ignore if fs_user missing in minimal schema test
    }

    return false;
  }

  // Recursive Upward Permission Check:
  // Checks if the user has any of the required roles in targetRegionId OR ANY ANCESTOR of targetRegionId
  hasPermissionInRegion(
    userId: string,
    targetRegionId: number,
    requiredRoles: UserRoleType[] = [
      UserRoleType.WORKGROUP_GIVING_STORES,
      UserRoleType.AMBASSADOR,
      UserRoleType.ORGA
    ],
    isSuperAdmin: boolean = false
  ): boolean {
    if (this.isGlobalOrga(userId, isSuperAdmin)) return true;
    if (!userId || !targetRegionId) return false;

    const placeholders = requiredRoles.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      WITH RECURSIVE RegionTree AS (
        SELECT id, parent_id FROM fs_bezirk WHERE id = ?
        UNION ALL
        SELECT b.id, b.parent_id FROM fs_bezirk b
        JOIN RegionTree rt ON b.id = rt.parent_id
      )
      SELECT 1 FROM fs_user_roles ur
      JOIN RegionTree rt ON ur.region_id = rt.id
      WHERE ur.user_id = ? AND ur.role IN (${placeholders})
      LIMIT 1;
    `);

    const result = stmt.get(targetRegionId, userId, ...requiredRoles);
    return !!result;
  }

  // Returns all region IDs (including child districts) where the user can manage stores/ampel/inbox
  getManagedRegionIds(userId: string, isSuperAdmin: boolean = false): number[] {
    if (this.isGlobalOrga(userId, isSuperAdmin)) {
      return (this.db.prepare('SELECT id FROM fs_bezirk ORDER BY type ASC, name ASC').all() as Array<{ id: number }>).map(
        r => r.id
      );
    }
    if (!userId) return [];

    const rows = this.db.prepare(`
      WITH RECURSIVE ManagedTree AS (
        SELECT ur.region_id AS id
        FROM fs_user_roles ur
        WHERE ur.user_id = ? AND ur.role IN ('WORKGROUP_GIVING_STORES', 'AMBASSADOR', 'ORGA')
        UNION
        SELECT b.id
        FROM fs_bezirk b
        JOIN ManagedTree mt ON b.parent_id = mt.id
      )
      SELECT DISTINCT id FROM ManagedTree
    `).all(userId) as Array<{ id: number }>;

    return rows.map(r => r.id);
  }

  // Returns all region IDs where the user can manage collaborators & invites:
  // - Global ORGA / SuperAdmin: all regions
  // - AMBASSADOR (or Landesbezirk type=1 lead): their region & descendant districts
  // - Single-district WORKGROUP_GIVING_STORES (type >= 2): empty (cannot revoke/manage other users)
  getTeamAdminRegionIds(userId: string, isSuperAdmin: boolean = false): number[] {
    if (this.isGlobalOrga(userId, isSuperAdmin)) {
      return (this.db.prepare('SELECT id FROM fs_bezirk ORDER BY type ASC, name ASC').all() as Array<{ id: number }>).map(
        r => r.id
      );
    }
    if (!userId) return [];

    const rows = this.db.prepare(`
      WITH RECURSIVE AdminTree AS (
        SELECT ur.region_id AS id
        FROM fs_user_roles ur
        JOIN fs_bezirk r ON r.id = ur.region_id
        WHERE ur.user_id = ?
          AND (
            ur.role IN ('AMBASSADOR', 'ORGA')
            OR (ur.role = 'WORKGROUP_GIVING_STORES' AND r.type = 1)
          )
        UNION
        SELECT b.id
        FROM fs_bezirk b
        JOIN AdminTree at ON b.parent_id = at.id
      )
      SELECT DISTINCT id FROM AdminTree
    `).all(userId) as Array<{ id: number }>;

    return rows.map(r => r.id);
  }

  canManageTeamInRegion(userId: string, regionId: number, isSuperAdmin: boolean = false): boolean {
    if (this.isGlobalOrga(userId, isSuperAdmin)) return true;
    const allowed = new Set(this.getTeamAdminRegionIds(userId, isSuperAdmin));
    return allowed.has(regionId);
  }

  countActiveGlobalAdmins(excludeUserId?: string): number {
    const rows = this.db.prepare(`
      SELECT DISTINCT u.id
      FROM fs_user u
      LEFT JOIN fs_user_roles ur ON ur.user_id = u.id AND ur.role = 'ORGA'
      WHERE u.is_active = 1
        AND (u.is_super_admin = 1 OR ur.role = 'ORGA')
    `).all() as Array<{ id: string }>;

    return rows.filter(r => r.id !== excludeUserId).length;
  }

  listTeamMembers(filterRegionIds?: number[]): TeamMember[] {
    const users = this.db.prepare(`
      SELECT id, email, name, is_super_admin, is_active, revoked_at, last_login_at, created_at
      FROM fs_user
      ORDER BY is_active DESC, is_super_admin DESC, created_at ASC
    `).all() as any[];

    const roleRows = this.db.prepare(`
      SELECT ur.user_id, ur.region_id, ur.role, ur.created_at,
             COALESCE(r.name, 'Region #' || ur.region_id) as region_name,
             COALESCE(r.type, 2) as region_type
      FROM fs_user_roles ur
      LEFT JOIN fs_bezirk r ON r.id = ur.region_id
      ORDER BY r.type ASC, r.name ASC, ur.role ASC
    `).all() as any[];

    const rolesByUser = new Map<string, TeamMember['roles']>();
    for (const rr of roleRows) {
      if (!rolesByUser.has(rr.user_id)) {
        rolesByUser.set(rr.user_id, []);
      }
      rolesByUser.get(rr.user_id)!.push({
        region_id: rr.region_id,
        region_name: rr.region_name,
        region_type: rr.region_type,
        role: rr.role as UserRoleType,
        created_at: rr.created_at
      });
    }

    const seenIds = new Set<string>();
    const members: TeamMember[] = [];

    for (const u of users) {
      seenIds.add(u.id);
      const roles = rolesByUser.get(u.id) || [];
      const hasOrga = roles.some(r => r.role === UserRoleType.ORGA);
      members.push({
        id: u.id,
        email: u.email,
        name: u.name || u.email.split('@')[0],
        is_super_admin: Boolean(u.is_super_admin) || hasOrga,
        is_active: Number(u.is_active) !== 0,
        revoked_at: u.revoked_at || null,
        created_at: u.created_at,
        last_login_at: u.last_login_at || null,
        has_user_record: true,
        roles
      });
    }

    // Include any orphan role holders (e.g. legacy seed accounts without fs_user row)
    for (const [uid, roles] of rolesByUser.entries()) {
      if (seenIds.has(uid)) continue;
      const earliest = roles[0]?.created_at || new Date().toISOString();
      members.push({
        id: uid,
        email: `${uid} (System-/Alt-Rolle)`,
        name: uid,
        is_super_admin: roles.some(r => r.role === UserRoleType.ORGA),
        is_active: true,
        revoked_at: null,
        created_at: earliest,
        last_login_at: null,
        has_user_record: false,
        roles
      });
    }

    if (filterRegionIds) {
      const allowedSet = new Set(filterRegionIds);
      return members.filter(m => m.roles.some(r => allowedSet.has(r.region_id)));
    }

    return members;
  }

  setUserActiveStatus(userId: string, isActive: boolean): boolean {
    const res = this.db.prepare(`
      UPDATE fs_user
      SET is_active = ?,
          revoked_at = CASE WHEN ? = 0 THEN datetime('now') ELSE NULL END
      WHERE id = ?
    `).run(isActive ? 1 : 0, isActive ? 1 : 0, userId);
    return res.changes > 0;
  }

  setUserSuperAdmin(userId: string, isSuperAdmin: boolean): boolean {
    const res = this.db.prepare(`
      UPDATE fs_user
      SET is_super_admin = ?
      WHERE id = ?
    `).run(isSuperAdmin ? 1 : 0, userId);
    return res.changes > 0;
  }

  deleteUserAccount(userId: string): boolean {
    const tx = this.db.transaction(() => {
      const roleChanges = this.db.prepare('DELETE FROM fs_user_roles WHERE user_id = ?').run(userId).changes;
      const userChanges = this.db.prepare('DELETE FROM fs_user WHERE id = ?').run(userId).changes;
      return roleChanges > 0 || userChanges > 0;
    });
    return tx();
  }

  // Creates high-entropy cryptographic one-time invite token
  createInviteToken(data: {
    region_id: number;
    created_by_user_id: string;
    target_role?: UserRoleType;
    expiresInDays?: number;
  }): { id: number; rawToken: string; expiresAt: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const days = data.expiresInDays || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const result = this.db.prepare(`
      INSERT INTO fs_invite_token (
        token_hash, region_id, target_role, created_by_user_id, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      tokenHash,
      data.region_id,
      data.target_role || UserRoleType.WORKGROUP_GIVING_STORES,
      data.created_by_user_id,
      expiresAt
    );

    return { id: Number(result.lastInsertRowid), rawToken, expiresAt };
  }

  listInviteTokens(filterRegionIds?: number[]): TeamInviteItem[] {
    let sql = `
      SELECT
        t.id,
        t.region_id,
        COALESCE(r.name, 'Region #' || t.region_id) as region_name,
        t.target_role,
        t.created_by_user_id,
        cu.email as created_by_email,
        t.redeemed_by_user_id,
        ru.email as redeemed_by_email,
        t.expires_at,
        t.redeemed_at,
        t.revoked_at,
        t.created_at
      FROM fs_invite_token t
      LEFT JOIN fs_bezirk r ON r.id = t.region_id
      LEFT JOIN fs_user cu ON cu.id = t.created_by_user_id
      LEFT JOIN fs_user ru ON ru.id = t.redeemed_by_user_id
    `;
    const params: any[] = [];
    if (filterRegionIds) {
      if (filterRegionIds.length === 0) return [];
      const placeholders = filterRegionIds.map(() => '?').join(',');
      sql += ` WHERE t.region_id IN (${placeholders})`;
      params.push(...filterRegionIds);
    }
    sql += ` ORDER BY t.id DESC LIMIT 100`;

    const now = Date.now();
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(row => {
      let status: TeamInviteItem['status'] = 'OPEN';
      if (row.revoked_at) {
        status = 'REVOKED';
      } else if (row.redeemed_by_user_id) {
        status = 'REDEEMED';
      } else if (new Date(row.expires_at).getTime() < now) {
        status = 'EXPIRED';
      }
      return {
        id: row.id,
        region_id: row.region_id,
        region_name: row.region_name,
        target_role: row.target_role as UserRoleType,
        created_by_user_id: row.created_by_user_id,
        created_by_email: row.created_by_email || null,
        redeemed_by_user_id: row.redeemed_by_user_id || null,
        redeemed_by_email: row.redeemed_by_email || null,
        expires_at: row.expires_at,
        redeemed_at: row.redeemed_at || null,
        revoked_at: row.revoked_at || null,
        created_at: row.created_at,
        status
      };
    });
  }

  getInviteById(inviteId: number): any | null {
    return (this.db.prepare('SELECT * FROM fs_invite_token WHERE id = ?').get(inviteId) as any) || null;
  }

  revokeInviteToken(inviteId: number): boolean {
    const res = this.db.prepare(`
      UPDATE fs_invite_token
      SET revoked_at = datetime('now')
      WHERE id = ? AND redeemed_by_user_id IS NULL AND revoked_at IS NULL
    `).run(inviteId);
    return res.changes > 0;
  }

  // Redeems invite token (atomic verification + double opt-in role assignment)
  redeemInviteToken(
    rawToken: string,
    redeemingUserId: string
  ): { success: boolean; region_id?: number; role?: UserRoleType; error?: string } {
    let cleanToken = (rawToken || '').trim();
    if (cleanToken.includes('token=')) {
      const m = cleanToken.match(/token=([a-fA-F0-9]+)/);
      if (m) cleanToken = m[1];
    } else if (cleanToken.includes('/invite/')) {
      const m = cleanToken.match(/\/invite\/([a-fA-F0-9]+)/);
      if (m) cleanToken = m[1];
    }
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const redeemTransaction = this.db.transaction(() => {
      const tokenRecord = this.db.prepare(`
        SELECT * FROM fs_invite_token 
        WHERE token_hash = ?
      `).get(tokenHash) as any;

      if (!tokenRecord) {
        return { success: false, error: 'Ungültiger oder bereits verwendeter Einladungslink' };
      }

      if (tokenRecord.revoked_at) {
        return { success: false, error: 'Dieser Einladungslink wurde widerrufen und ist nicht mehr gültig' };
      }

      if (tokenRecord.redeemed_by_user_id) {
        return { success: false, error: 'Ungültiger oder bereits verwendeter Einladungslink' };
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        return { success: false, error: 'Dieser Einladungslink ist abgelaufen' };
      }

      // Mark token redeemed
      this.db.prepare(`
        UPDATE fs_invite_token 
        SET redeemed_by_user_id = ?, redeemed_at = datetime('now')
        WHERE id = ?
      `).run(redeemingUserId, tokenRecord.id);

      // Assign role in target region
      this.assignRole(redeemingUserId, tokenRecord.region_id, tokenRecord.target_role as UserRoleType);

      // If target_role is ORGA, also mark fs_user.is_super_admin = 1 when user exists
      if (tokenRecord.target_role === UserRoleType.ORGA) {
        try {
          this.db.prepare('UPDATE fs_user SET is_super_admin = 1 WHERE id = ?').run(redeemingUserId);
        } catch {
          // ignore if user row inserted right after in auth.ts
        }
      }

      return {
        success: true,
        region_id: tokenRecord.region_id,
        role: tokenRecord.target_role as UserRoleType
      };
    });

    return redeemTransaction();
  }
}
