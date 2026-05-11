import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { TypedConfigService } from '../config/typed-config.service';
import { randomUUID } from 'node:crypto';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [TypedConfigService],
      useFactory: (config: TypedConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL'),
            genReqId: (req) => {
              const headerId = req.headers['x-request-id'];
              return (Array.isArray(headerId) ? headerId[0] : headerId) ?? randomUUID();
            },
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'HH:MM:ss',
                  },
                },
            redact: {
              paths: [
                // Request/response headers
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'req.headers["x-auth-zapmail"]',
                'req.headers["x-unipile-signature"]',
                'req.headers["x-signature"]',
                'req.headers["x-webhook-secret"]',
                'res.headers["set-cookie"]',
                // Common nested secret fields anywhere in the log payload
                '*.password',
                '*.token',
                '*.apiKey',
                '*.api_key',
                '*.secret',
                '*.access_token',
                '*.refresh_token',
                '*.client_secret',
                '*.private_key',
                '*.providerMetadata',
                'body.password',
                'body.token',
                'body.secret',
                'body.api_key',
                'body.secret_key',
                // Env-style names that may leak through error metadata
                'SUPABASE_SERVICE_ROLE_KEY',
                'SUPABASE_JWT_SECRET',
                'SUPABASE_ANON_KEY',
                'OPENAI_API_KEY',
                'RESEND_API_KEY',
                'ZAPMAIL_API_KEY',
                'UNIPILE_API_KEY',
                'SMARTLEAD_API_KEY',
                'RAPIDAPI_KEY',
                'WEBHOOK_HMAC_SECRET',
                'UNIPILE_WEBHOOK_SECRET',
                'ZAPMAIL_WEBHOOK_SECRET',
                'SMARTLEAD_WEBHOOK_SECRET',
                'MAILGUN_API_KEY',
                'SES_AWS_ACCESS_KEY_ID',
                'SES_AWS_SECRET_ACCESS_KEY',
                'SMTP_PASSWORD',
                'DATABASE_URL',
                'DATABASE_POOL_URL',
                'REDIS_URL',
              ],
              remove: true,
            },
            customProps: () => ({
              service: 'coldmail-backend',
              env: config.get('SENTRY_ENVIRONMENT'),
            }),
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
