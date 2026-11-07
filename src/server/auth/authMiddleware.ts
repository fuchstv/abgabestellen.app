import { FastifyRequest, FastifyReply } from 'fastify';
import { Database } from 'better-sqlite3';
import { AuthUser } from '@shared/types';
import { verifyToken } from './jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
  interface FastifyInstance {
    db?: Database;
  }
}

export interface AuthResolution {
  user: AuthUser | null;
  revoked?: boolean;
}

export function parseAuthHeader(authHeader?: string, db?: Database): AuthUser | null {
  return resolveAuthHeader(authHeader, db).user;
}

export function resolveAuthHeader(authHeader?: string, db?: Database): AuthResolution {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null };
  }

  const token = authHeader.substring(7).trim();
  if (!token) return { user: null };

  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Dev / Test token format: Bearer test:<uid>:<email>:<isSuperAdmin> (NEVER allowed in production)
  if (token.startsWith('test:')) {
    if (isProduction) {
      return { user: null };
    }
    const [, uid, email, isSuperAdmin] = token.split(':');
    const resolvedUid = uid || 'test-user';

    if (db && db.open) {
      try {
        const dbUser = db
          .prepare('SELECT id, email, name, is_super_admin, is_active FROM fs_user WHERE id = ?')
          .get(resolvedUid) as any;
        if (dbUser && Number(dbUser.is_active) === 0) {
          return { user: null, revoked: true };
        }
      } catch {
        // fs_user might not exist in minimal unit test DBs
      }
    }

    return {
      user: {
        uid: resolvedUid,
        email: email || 'test@example.org',
        isSuperAdmin: isSuperAdmin === 'true'
      }
    };
  }

  // 2. Signed HMAC JWT verification + live database status check
  const verifiedUser = verifyToken(token);
  if (verifiedUser) {
    if (db && db.open) {
      try {
        let dbUser = db
          .prepare('SELECT id, email, name, is_super_admin, is_active FROM fs_user WHERE id = ?')
          .get(verifiedUser.uid) as any;

        // Seamless recovery for pre-existing valid JWTs matching canonical email (e.g. after bootstrap)
        if (!dbUser && verifiedUser.email) {
          dbUser = db
            .prepare('SELECT id, email, name, is_super_admin, is_active FROM fs_user WHERE lower(email) = lower(?)')
            .get(verifiedUser.email) as any;
        }

        if (!dbUser || Number(dbUser.is_active) === 0) {
          return { user: null, revoked: true };
        }

        const hasOrgaRole = Boolean(
          db
            .prepare('SELECT 1 FROM fs_user_roles WHERE user_id = ? AND role = ? LIMIT 1')
            .get(dbUser.id, 'ORGA')
        );

        return {
          user: {
            uid: dbUser.id,
            email: dbUser.email,
            name: dbUser.name || verifiedUser.name || dbUser.email.split('@')[0],
            isSuperAdmin: Boolean(dbUser.is_super_admin) || hasOrgaRole
          }
        };
      } catch {
        // Fallback only if fs_user query failed in minimal schema test
      }
    }

    return { user: verifiedUser };
  }

  return { user: null };
}

// Optional Auth: Attaches request.user if valid active token provided; does not reject anonymous
export async function optionalAuthMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  const { user } = resolveAuthHeader(request.headers.authorization, request.server.db);
  if (user) {
    request.user = user;
  }
}

// Required Auth: Rejects with 401 if missing, invalid, or revoked
export async function requireAuthMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const { user, revoked } = resolveAuthHeader(request.headers.authorization, request.server.db);
  if (!user) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: revoked
        ? 'Dein Zugang wurde deaktiviert oder entzogen. Bitte wende dich an die Koordination.'
        : 'Authentifizierung erforderlich (Gültiger Bearer Token fehlt)'
    });
  }
  request.user = user;
}
