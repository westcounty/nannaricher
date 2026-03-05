// server/src/auth/jwt.ts — JWT verification using shared tuchan secret
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;    // user_id (UUID)
  phone?: string; // phone number
  iat: number;
  exp: number;
}

export interface VerifyResult {
  payload: JwtPayload;
  verified: boolean;  // true = signature verified; false = decode-only (dev mode)
}

let jwtSecret: Buffer | null = null;

export function initJwt(): void {
  const secretBase64 = process.env.TUCHAN_JWT_SECRET;
  if (!secretBase64) {
    console.warn('[Auth] TUCHAN_JWT_SECRET not set — JWT verification disabled (dev mode)');
    return;
  }
  jwtSecret = Buffer.from(secretBase64, 'base64');
  console.log('[Auth] JWT verification enabled');
}

export function verifyToken(token: string): VerifyResult | null {
  if (!jwtSecret) {
    // Dev mode: decode without verification
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      if (!decoded?.sub) return null;
      return { payload: decoded, verified: false };
    } catch {
      return null;
    }
  }

  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
    return { payload, verified: true };
  } catch {
    return null;
  }
}
