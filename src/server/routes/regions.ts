import { FastifyInstance } from 'fastify';
import { Database } from 'better-sqlite3';
import { RegionModel } from '../db/models/regions';
import { StoreModel } from '../db/models/stores';
import { UserRoleModel } from '../db/models/userRoles';
import { PermissionService } from '../auth/permissions';
import { optionalAuthMiddleware } from '../auth/authMiddleware';
import { UserRoleType } from '@shared/types';

export async function regionRoutes(fastify: FastifyInstance, options: { db: Database }) {
  const model = new RegionModel(options.db);
  const storeModel = new StoreModel(options.db);
  const userRoleModel = new UserRoleModel(options.db);
  const permissionService = new PermissionService(options.db);

  // List all regions or hierarchical tree
  fastify.get('/api/regions', async (request, reply) => {
    const { tree } = request.query as { tree?: string };
    if (tree === 'true' || tree === '1') {
      return model.getTree();
    }
    return model.getAllRegions();
  });

  // Get specific region
  fastify.get('/api/regions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const region = model.getRegionById(Number(id));
    if (!region) {
      return reply.status(404).send({ error: 'Region nicht gefunden' });
    }
    return region;
  });

  // GET /api/regions/:id/export-berlin.csv (1-Click CSV Backup with 16 original Berlin columns for managers)
  fastify.get('/api/regions/:id/export-berlin.csv', {
    preHandler: optionalAuthMiddleware
  }, async (request, reply) => {
    // 1. Check authentication (blocked for public)
    if (!request.user) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Zugriff verweigert: Authentifizierung als Manager erforderlich'
      });
    }

    const { id } = request.params as { id: string };
    const regionId = Number(id);

    const region = model.getRegionById(regionId);
    if (!region) {
      return reply.status(404).send({ error: 'Region nicht gefunden' });
    }

    // 2. Enforce manager permission (WORKGROUP_GIVING_STORES, AMBASSADOR, ORGA)
    try {
      permissionService.enforceRegionManager(request.user, regionId);
    } catch (err: any) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: err.message || 'Zugriff verweigert: Keine Berechtigung für diese Region'
      });
    }

    // 3. Fetch all stores in region & all descendant sub-districts
    const regionIds = model.getRegionDescendantIds(regionId);
    const stores = storeModel.getStoresByRegion(regionIds, { onlyActive: false });

    // 4. Prepare contact log lookup for notes and stand
    const contactLogStmt = options.db.prepare(
      'SELECT note, contacted_at FROM fs_store_contact_log WHERE store_id = ? ORDER BY contacted_at DESC, id DESC LIMIT 1'
    );

    const headers = [
      'Abgabestelle (schwarz:aktualisiert, rot:in Aktualisierung, lila: momentan außer Betrieb)',
      'Anschrift',
      'PLZ',
      'Großbezirk',
      'Ortsteil',
      'AnsprechpartnerIn',
      'Telefon',
      'Wann können Lebensmittel abgegeben werden?',
      'Was wird angenommen?',
      'vorherige telefon. Anmeldung nötig?',
      'Anzahl Abnehmer*innen',
      'Bemerkungen',
      'Webseite',
      'Stand',
      'latitude',
      'longitude'
    ];

    function escapeCsvCell(val: any): string {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const rows = stores.map(s => {
      const contactLog = contactLogStmt.get(s.id) as { note?: string; contacted_at?: string } | undefined;
      
      let bemerkungen = s.public_info || '';
      let stand = '';

      if (contactLog?.note) {
        const bm = contactLog.note.match(/Bemerkungen:\s*([^|]+)/);
        if (bm) {
          bemerkungen = bm[1].trim();
        } else if (!bemerkungen) {
          bemerkungen = contactLog.note.replace(/Stand:\s*[^|]+/, '').trim();
        }

        const sm = contactLog.note.match(/Stand:\s*([^|]+)/);
        if (sm) {
          stand = sm[1].trim();
        }
      }

      if (!stand && s.giving_details?.last_contact_at) {
        try {
          const d = new Date(s.giving_details.last_contact_at);
          stand = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
        } catch {
          stand = s.giving_details.last_contact_at;
        }
      }

      return [
        s.name,
        s.str || '',
        s.plz || '',
        s.region_name || region.name || '',
        s.stadt || '',
        s.ansprechpartner || '', // STRICTLY CONFIDENTIAL - included for authorized managers
        s.telefon || '',         // STRICTLY CONFIDENTIAL - included for authorized managers
        s.giving_details?.dropoff_times || '',
        s.giving_details?.accepted_items || '',
        s.giving_details?.registration_required ? 'TRUE' : 'FALSE',
        s.giving_details?.recipient_count || '',
        bemerkungen,
        s.giving_details?.website || '',
        stand,
        s.lat != null && s.lat !== 0 ? String(s.lat) : '',
        s.lon != null && s.lon !== 0 ? String(s.lon) : ''
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.map(escapeCsvCell).join(','),
      ...rows.map(r => r.map(escapeCsvCell).join(','))
    ].join('\r\n');

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="abgabestellen-${region.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-backup.csv"`)
      .send(csvContent);
  });

  // POST /api/admin/regions (Onboard new city or district)
  fastify.post('/api/admin/regions', {
    preHandler: optionalAuthMiddleware
  }, async (request, reply) => {
    const orgaSecretHeader = request.headers['x-orga-secret'];
    const configuredSecret = process.env.INITIAL_ORGA_SECRET;

    const isAuthorizedBySecret = configuredSecret && orgaSecretHeader === configuredSecret;
    const isAuthorizedByUser = request.user && (
      request.user.isSuperAdmin || 
      userRoleModel.hasPermissionInRegion(request.user.uid, 1, [UserRoleType.ORGA], true)
    );

    if (!isAuthorizedBySecret && !isAuthorizedByUser) {
      return reply.status(403).send({ error: 'Zugriff verweigert: Nur für ORGA autorisiert' });
    }

    const body = request.body as {
      name: string;
      parent_id?: number | null;
      type?: number;
      lat?: number | null;
      lon?: number | null;
      external_fs_bezirk_id?: number | null;
      create_invite?: boolean;
    };

    if (!body.name) {
      return reply.status(400).send({ error: 'name ist erforderlich' });
    }

    const newRegion = model.createRegion({
      name: body.name,
      parent_id: body.parent_id ?? null,
      type: body.type ?? (body.parent_id ? 2 : 1),
      lat: body.lat ?? null,
      lon: body.lon ?? null,
      external_fs_bezirk_id: body.external_fs_bezirk_id ?? null
    });

    let invite = null;
    if (body.create_invite) {
      const creatorId = request.user?.uid || 'system:initial-orga';
      invite = userRoleModel.createInviteToken({
        region_id: newRegion.id,
        created_by_user_id: creatorId,
        target_role: UserRoleType.WORKGROUP_GIVING_STORES,
        expiresInDays: 14
      });
    }

    return reply.status(201).send({
      region: newRegion,
      invite: invite ? {
        token: invite.rawToken,
        expiresAt: invite.expiresAt,
        inviteUrl: `/invite?token=${invite.rawToken}`
      } : null
    });
  });
}
