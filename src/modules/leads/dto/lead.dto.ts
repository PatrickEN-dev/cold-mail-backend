import { z } from 'zod';

export const emailStatuses = [
  'sent',
  'delivered',
  'opened',
  'bounced',
  'replied',
  'finished',
] as const;

export const leadClassifications = ['hot', 'warm', 'cold'] as const;
export const dealStatuses = ['open', 'won', 'lost'] as const;

export const createLeadSchema = z.object({
  email: z.string().email(),
  company: z.string(),
  region: z.string(),
  industry: z.string(),
  leadName: z.string().optional(),
  phone: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  googleMapsUrl: z.string().url().optional(),
  leadCategory: z.string().optional(),
  leadClassification: z.enum(leadClassifications).optional(),
  campaignName: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateLeadDto = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = createLeadSchema.partial();
export type UpdateLeadDto = z.infer<typeof updateLeadSchema>;

export const listLeadsQuerySchema = z.object({
  status: z.enum(emailStatuses).optional(),
  campaignName: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
