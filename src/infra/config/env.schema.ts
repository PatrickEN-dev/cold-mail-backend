import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() === 'true'));

/// Treats empty strings (common in .env files) as missing.
const optionalUrl = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v),
  z.string().url().optional(),
);
const optionalString = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v),
  z.string().optional(),
);

export const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  BACKEND_PUBLIC_URL: optionalUrl,

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: optionalUrl,

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  // Redis
  REDIS_URL: z.string().url(),

  // Webhooks
  WEBHOOK_HMAC_SECRET: z.string().min(16),
  UNIPILE_WEBHOOK_SECRET: optionalString,
  ZAPMAIL_WEBHOOK_SECRET: optionalString,
  SMARTLEAD_WEBHOOK_SECRET: optionalString,

  // Email providers
  RESEND_API_KEY: optionalString,
  ZAPMAIL_API_KEY: optionalString,
  SMARTLEAD_API_KEY: optionalString,
  MAILGUN_API_KEY: optionalString,
  MAILGUN_DOMAIN: optionalString,
  SES_AWS_ACCESS_KEY_ID: optionalString,
  SES_AWS_SECRET_ACCESS_KEY: optionalString,
  SES_REGION: z.string().default('us-east-1'),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,

  // AI
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),

  // LinkedIn / Unipile
  UNIPILE_API_KEY: optionalString,
  UNIPILE_DSN: optionalString,

  // Search
  RAPIDAPI_KEY: optionalString,

  // Edge function
  WARMUP_BUDGET_URL: optionalUrl,

  // Observability
  SENTRY_DSN: optionalUrl,
  SENTRY_ENVIRONMENT: z.string().default('development'),

  // Feature flags
  DISPATCH_VIA_N8N: booleanFromString.default(false),
  ENABLE_WARMUP_WORKER: booleanFromString.default(true),
  ENABLE_SCHEDULES_CRON: booleanFromString.default(true),
  ENABLE_FOLLOWUPS_CRON: booleanFromString.default(true),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
