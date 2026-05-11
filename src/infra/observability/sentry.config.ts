import * as Sentry from '@sentry/node';

interface SentryBootOptions {
  dsn?: string;
  environment: string;
  release?: string;
}

export function initSentry({ dsn, environment, release }: SentryBootOptions): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: environment === 'production' ? 0.1 : 1,
    profilesSampleRate: 0,
    integrations: [Sentry.httpIntegration(), Sentry.nodeContextIntegration()],
  });
}

export { Sentry };
