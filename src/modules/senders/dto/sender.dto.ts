import { z } from 'zod';

export const senderPlatforms = [
  'none',
  'smartlead',
  'resend',
  'zapmail',
  'google',
  'outlook',
] as const;

/// Prod accepts `manual` plus the provider names — keep it permissive.
export const senderProviders = [
  'manual',
  'resend',
  'zapmail',
  'smtp',
  'google',
  'ses',
  'mailgun',
  'outlook',
] as const;

export const createSenderSchema = z.object({
  emailAddress: z.string().email(),
  displayName: z.string().optional(),
  domain: z.string().optional(),
  provider: z.enum(senderProviders).default('manual'),
  providerId: z.string().optional(),
  platform: z.enum(senderPlatforms).default('none'),
  dailyLimit: z.number().int().min(0).max(500).default(0),
  isDefault: z.boolean().optional(),
});
export type CreateSenderDto = z.infer<typeof createSenderSchema>;

export const updateSenderSchema = createSenderSchema.partial().extend({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});
export type UpdateSenderDto = z.infer<typeof updateSenderSchema>;
