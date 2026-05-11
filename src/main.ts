import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyUnderPressure from '@fastify/under-pressure';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { initSentry } from '@infra/observability/sentry.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // trustProxy must be a list/CIDR in production to avoid IP spoofing via
      // X-Forwarded-For. Railway puts a single proxy in front; trusting "1"
      // hop is enough.
      trustProxy: 1,
      bodyLimit: 1_048_576 * 4,
      // rawBody is required for HMAC signature verification on webhook payloads.
      // The provider signs the raw bytes; re-stringifying the parsed body breaks comparison.
    }),
    { bufferLogs: true, rawBody: true },
  );

  app.useLogger(app.get(PinoLogger));

  const config = app.get(TypedConfigService);
  const port = config.get('PORT');
  const frontendUrl = config.get('FRONTEND_URL');
  const isProd = config.get('NODE_ENV') === 'production';

  initSentry({
    dsn: config.get('SENTRY_DSN'),
    environment: config.get('SENTRY_ENVIRONMENT'),
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: false } : false,
  });

  await app.register(fastifyRateLimit, {
    // 300 req/min per IP across the whole app. Webhooks come from a handful
    // of provider IPs so this is generous enough; abusive clients get 429.
    max: 300,
    timeWindow: '1 minute',
    cache: 10_000,
    allowList: [],
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  await app.register(fastifyUnderPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 700_000_000,
    maxRssBytes: 900_000_000,
    maxEventLoopUtilization: 0.95,
    retryAfter: 5,
    exposeStatusRoute: false,
  });

  await app.register(fastifyCors, {
    origin: [frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });

  app.enableShutdownHooks();

  await app.listen({ port, host: '0.0.0.0' });
  const logger = app.get(PinoLogger);
  logger.log(`coldmail-backend listening on :${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
