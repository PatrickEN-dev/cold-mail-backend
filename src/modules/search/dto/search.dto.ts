import { z } from 'zod';

export const searchRequestSchema = z.object({
  region: z.string().min(1),
  keywords: z.string().min(1),
  industry: z.string().min(1),
  campaign: z.string().optional(),
});
export type SearchRequestDto = z.infer<typeof searchRequestSchema>;
