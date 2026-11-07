import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { UserRoleModel } from '../db/models/userRoles';
import { RegionModel } from '../db/models/regions';
import { PermissionService } from '../auth/permissions';
import { requireAuthMiddleware } from '../auth/authMiddleware';
import { UserRoleType } from '@shared/types';

const VALID_ROLES = new Set<string>([
  UserRoleType.FOODSAVER,
  UserRoleType.WORKGROUP_GIVING_STORES,
  UserRoleType.AMBASSADOR,
  UserRoleType.ORGA
]);

export async function teamRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const userRoleModel = new UserRoleModel(options.db);
  const regionModel = new RegionModel(options.db);
  const permissionService = new PermissionService(options.db);

  // GET /api/team/members — List active/revoked collaborators & their regional roles
  fastify.get('/api/team/members', {
    preHandler: requireAuthMiddleware
  }, async (request) => {
    const { isGlobalAdmin, adminRegionIds } = permissionService.enforceTeamAdmin(request.user);
    const members = userRoleModel.listTeamMembers(isGlobalAdmin ? undefined : adminRegionIds);
    return {
      members,
      isGlobalAdmin,
      adminRegionIds
    };
  });

  // POST /api/team/members/:userId/roles — Grant a regional role to an existing member
  fastify.post('/api/team/members/:userId/roles', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const body = request.body as { region_id?: number; role?: UserRoleType };

    const regionId = Number(body?.region_id);
    const role = (body?.role || UserRoleType.WORKGROUP_GIVING_STORES) as UserRoleType;

    if (!regionId || Number.isNaN(regionId)) {
      return reply.status(400).send({ error: 'region_id ist erforderlich' });
    }
    if (!VALID_ROLES.has(role)) {
      return reply.status(400).send({ error: 'Ungültige Rolle angegeben' });
    }

    const region = regionModel.getRegionById(regionId);
    if (!region) {
      return reply.status(404).send({ error: `Region #${regionId} nicht gefunden` });
    }

    const { isGlobalAdmin } = permissionService.enforceRegionTeamAdmin(request.user, regionId);

    if (!isGlobalAdmin) {
      if (userRoleModel.isGlobalOrga(userId)) {
        return reply.status(403).send({
          error: 'Zugriff verweigert: ORGA-Konten können nur von globalen Super-Admins bearbeitet werden'
        });
      }
      if (role === UserRoleType.ORGA || role === UserRoleType.AMBASSADOR) {
        return reply.status(403).send({
          error: 'Nur ORGA / Super-Admins können Botschafter- oder ORGA-Rollen vergeben'
        });
      }
    }

    userRoleModel.assignRole(userId, regionId, role);
    if (role === UserRoleType.ORGA) {
      userRoleModel.setUserSuperAdmin(userId, true);
    }

    return {
      success: true,
      roles: userRoleModel.getUserRoles(userId)
    };
  });

  // DELETE /api/team/members/:userId/roles — Revoke a specific regional role from a member
  fastify.delete('/api/team/members/:userId/roles', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const query = (request.query || {}) as { region_id?: string; role?: string };
    const body = (request.body || {}) as { region_id?: number; role?: string };

    const regionId = Number(query.region_id ?? body.region_id);
    const role = (query.role || body.role) as UserRoleType;

    if (!regionId || !role) {
      return reply.status(400).send({ error: 'region_id und role sind erforderlich' });
    }

    const { isGlobalAdmin } = permissionService.enforceRegionTeamAdmin(request.user, regionId);

    if (!isGlobalAdmin) {
      if (userRoleModel.isGlobalOrga(userId)) {
        return reply.status(403).send({
          error: 'Zugriff verweigert: ORGA-Konten können nur von globalen Super-Admins bearbeitet werden'
        });
      }
      if (role === UserRoleType.ORGA || role === UserRoleType.AMBASSADOR) {
        return reply.status(403).send({
          error: 'Zugriff verweigert: Botschafter- und ORGA-Rollen können nur von Super-Admins entzogen werden'
        });
      }
    }

    if (role === UserRoleType.ORGA) {
      if (userId === request.user!.uid) {
        return reply.status(400).send({
          error: 'Selbst-Aussperrschutz: Du kannst dir deine eigene ORGA-Berechtigung nicht selbst entziehen.'
        });
      }
      if (userRoleModel.countActiveGlobalAdmins(userId) === 0) {
        return reply.status(400).send({
          error: 'Mindestens ein aktiver ORGA / Super-Admin muss im System verbleiben.'
        });
      }
    }

    const removed = userRoleModel.removeRole(userId, regionId, role);
    if (!removed) {
      return reply.status(404).send({ error: 'Rollenzuweisung nicht gefunden' });
    }

    // If ORGA role was removed and user holds no remaining ORGA roles, clear superadmin flag
    if (role === UserRoleType.ORGA) {
      const remainingRoles = userRoleModel.getUserRoles(userId);
      if (!remainingRoles.some(r => r.role === UserRoleType.ORGA)) {
        userRoleModel.setUserSuperAdmin(userId, false);
      }
    }

    return {
      success: true,
      roles: userRoleModel.getUserRoles(userId)
    };
  });

  // PATCH /api/team/members/:userId/status — Immediately block (is_active=false) or unblock account
  fastify.patch('/api/team/members/:userId/status', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const body = request.body as { is_active?: boolean };

    if (!permissionService.isGlobalAdmin(request.user)) {
      return reply.status(403).send({
        error: 'Zugriff verweigert: Kontosperrungen und -freigaben sind nur für ORGA / Super-Admins möglich'
      });
    }

    if (typeof body?.is_active !== 'boolean') {
      return reply.status(400).send({ error: 'is_active (boolean) ist erforderlich' });
    }

    if (!body.is_active) {
      if (userId === request.user!.uid) {
        return reply.status(400).send({
          error: 'Selbst-Aussperrschutz: Du kannst dein eigenes Konto nicht sperren.'
        });
      }
      if (userRoleModel.isGlobalOrga(userId) && userRoleModel.countActiveGlobalAdmins(userId) === 0) {
        return reply.status(400).send({
          error: 'Der letzte aktive ORGA / Super-Admin kann nicht gesperrt werden.'
        });
      }
    }

    const updated = userRoleModel.setUserActiveStatus(userId, body.is_active);
    if (!updated) {
      return reply.status(404).send({ error: 'Benutzerkonto nicht gefunden' });
    }

    return {
      success: true,
      user_id: userId,
      is_active: body.is_active
    };
  });

  // DELETE /api/team/members/:userId — Permanently delete user & roles (GDPR / clean up legacy roles)
  fastify.delete('/api/team/members/:userId', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    if (!permissionService.isGlobalAdmin(request.user)) {
      return reply.status(403).send({
        error: 'Zugriff verweigert: Kontolöschungen sind nur für ORGA / Super-Admins möglich'
      });
    }

    if (userId === request.user!.uid) {
      return reply.status(400).send({
        error: 'Selbst-Aussperrschutz: Du kannst dein eigenes Konto nicht löschen.'
      });
    }

    if (userRoleModel.isGlobalOrga(userId) && userRoleModel.countActiveGlobalAdmins(userId) === 0) {
      return reply.status(400).send({
        error: 'Der letzte aktive ORGA / Super-Admin kann nicht gelöscht werden.'
      });
    }

    const deleted = userRoleModel.deleteUserAccount(userId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Konto oder Rollenzuweisung nicht gefunden' });
    }

    return {
      success: true,
      user_id: userId
    };
  });

  // GET /api/team/invites — List open, redeemed, expired, and revoked invite links
  fastify.get('/api/team/invites', {
    preHandler: requireAuthMiddleware
  }, async (request) => {
    const { isGlobalAdmin, adminRegionIds } = permissionService.enforceTeamAdmin(request.user);
    const invites = userRoleModel.listInviteTokens(isGlobalAdmin ? undefined : adminRegionIds);
    return { invites };
  });

  // DELETE /api/team/invites/:inviteId — Revoke an open invite link immediately
  fastify.delete('/api/team/invites/:inviteId', {
    preHandler: requireAuthMiddleware
  }, async (request, reply) => {
    const { inviteId } = request.params as { inviteId: string };
    const id = Number(inviteId);
    if (!id || Number.isNaN(id)) {
      return reply.status(400).send({ error: 'Ungültige Einladungs-ID' });
    }

    const invite = userRoleModel.getInviteById(id);
    if (!invite) {
      return reply.status(404).send({ error: 'Einladungslink nicht gefunden' });
    }

    const { isGlobalAdmin } = permissionService.enforceRegionTeamAdmin(request.user, invite.region_id);
    if (!isGlobalAdmin && invite.target_role !== UserRoleType.WORKGROUP_GIVING_STORES) {
      return reply.status(403).send({
        error: 'Zugriff verweigert: Nur ORGA kann höherstufige Einladungslinks widerrufen'
      });
    }

    const revoked = userRoleModel.revokeInviteToken(id);
    if (!revoked) {
      return reply.status(400).send({
        error: 'Einladungslink wurde bereits eingelöst oder widerrufen'
      });
    }

    return {
      success: true,
      id
    };
  });
}
