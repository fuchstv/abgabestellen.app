import crypto from 'crypto';
import { AuthUser } from '@shared/types';

const SECRET = process.env.JWT_SECRET || process.env.INITIAL_ORGA_SECRET || 'abgabestellen-default-super-secret-key-32b';

export interface TokenPayload {
  uid: string;
  email: string;
  name?: string;
  isSuperAdmin?: boolean;
  exp: number;
}

export function signToken(user: AuthUser, expiresInDays = 30): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: TokenPayload = {
    uid: user.uid,
    email: user.email,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    exp: Math.floor(Date.now() / 1000) + (expiresInDays * 86400)
  };
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${payloadEncoded}`;
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payloadEncoded, signature] = parts;
    const data = `${header}.${payloadEncoded}`;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

    // Constant-time comparison
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return {
      uid: payload.uid,
      email: payload.email,
      name: payload.name,
      isSuperAdmin: payload.isSuperAdmin
    };
  } catch (e) {
    return null;
  }
}
