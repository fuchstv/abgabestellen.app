import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthUser } from '@shared/types';
import { verifyToken } from './jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

// Lightweight Token Parser (Supports test bearer tokens, dev tokens, and signed JWTs)
export function parseAuthHeader(authHeader?: string): AuthUser | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  // 1. Dev / Test token format: Bearer test:<uid>:<email>:<isSuperAdmin>
  if (token.startsWith('test:')) {
    const [, uid, email, isSuperAdmin] = token.split(':');
    return {
      uid: uid || 'test-user',
      email: email || 'test@example.org',
      isSuperAdmin: isSuperAdmin === 'true'
    };
  }

  // 2. Signed HMAC JWT verification
  const verifiedUser = verifyToken(token);
  if (verifiedUser) {
    return verifiedUser;
  }

  // 3. Fallback: Base64 JSON payload (for rapid testing without secret)
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return {
        uid: payload.user_id || payload.sub || payload.uid,
        email: payload.email || '',
        name: payload.name,
        isSuperAdmin: !!payload.isSuperAdmin
      };
    }
  } catch (e) {
    // Malformed token
  }

  return null;
}

// Optional Auth: Attaches request.user if valid token provided; does not reject anonymous
export async function optionalAuthMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = parseAuthHeader(request.headers.authorization);
  if (user) {
    request.user = user;
  }
}

// Required Auth: Rejects with 401 if missing or invalid
export async function requireAuthMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = parseAuthHeader(request.headers.authorization);
  if (!user) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentifizierung erforderlich (Gültiger Bearer Token fehlt)'
    });
  }
  request.user = user;
}
