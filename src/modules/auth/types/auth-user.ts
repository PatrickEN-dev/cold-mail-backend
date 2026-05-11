export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
