import { Database } from 'better-sqlite3';
import crypto from 'crypto';
import { UserRoleType, UserRegionRole } from '@shared/types';

export class UserRoleModel {
  constructor(private db: Database) {}

  assignRole(userId: string, regionId: number, role: UserRoleType): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO fs_user_roles (user_id, region_id, role, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(userId, regionId, role);
  }

  removeRole(userId: string, regionId: number, role: UserRoleType): void {
    this.db.prepare(`
      DELETE FROM fs_user_roles 
      WHERE user_id = ? AND region_id = ? AND role = ?
    `).run(userId, regionId, role);
  }

  getUserRoles(userId: string): UserRegionRole[] {
    const stmt = this.db.prepare('SELECT * FROM fs_user_roles WHERE user_id = ?');
    return stmt.all(userId) as UserRegionRole[];
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
    if (isSuperAdmin) return true;
    if (!userId || !targetRegionId) return false;

    // Check if user has global ORGA role anywhere
    const globalOrga = this.db.prepare(`
      SELECT 1 FROM fs_user_roles WHERE user_id = ? AND role = ? LIMIT 1
    `).get(userId, UserRoleType.ORGA);

    if (globalOrga) return true;

    // CTE recursive upward traversal:
    // Starts at targetRegionId, climbs up to parent_id
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

  // Creates high-entropy cryptographic one-time invite token
  createInviteToken(data: {
    region_id: number;
    created_by_user_id: string;
    target_role?: UserRoleType;
    expiresInDays?: number;
  }): { rawToken: string; expiresAt: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    
    const days = data.expiresInDays || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    this.db.prepare(`
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

    return { rawToken, expiresAt };
  }

  // Redeems invite token (atomic verification + double opt-in role assignment)
  redeemInviteToken(rawToken: string, redeemingUserId: string): { success: boolean; region_id?: number; role?: UserRoleType; error?: string } {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const redeemTransaction = this.db.transaction(() => {
      const tokenRecord = this.db.prepare(`
        SELECT * FROM fs_invite_token 
        WHERE token_hash = ? AND redeemed_by_user_id IS NULL
      `).get(tokenHash) as any;

      if (!tokenRecord) {
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

      return {
        success: true,
        region_id: tokenRecord.region_id,
        role: tokenRecord.target_role as UserRoleType
      };
    });

    return redeemTransaction();
  }
}
