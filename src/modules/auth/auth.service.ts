import { Injectable } from '@nestjs/common';
import { jwtVerify } from 'jose';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { UnauthorizedError } from '@shared/errors/domain.error';
import type { AuthUser } from './types/auth-user';

@Injectable()
export class AuthService {
  private readonly secret: Uint8Array;

  constructor(config: TypedConfigService) {
    this.secret = new TextEncoder().encode(config.getOrThrow('SUPABASE_JWT_SECRET'));
  }

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        // Supabase Auth signs user tokens with aud='authenticated'. Refusing
        // any other audience prevents accepting tokens issued for a different
        // purpose (service-role tokens, admin tokens, etc.) that share secret.
        audience: 'authenticated',
      });
      const sub = payload.sub;
      if (!sub) throw new UnauthorizedError('JWT missing sub');
      return {
        id: sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        role: typeof payload.role === 'string' ? payload.role : undefined,
        appMetadata: (payload.app_metadata as Record<string, unknown>) ?? undefined,
        userMetadata: (payload.user_metadata as Record<string, unknown>) ?? undefined,
      };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
