import { z } from 'zod';
import { senderPlatforms } from '@modules/senders/dto/sender.dto';

/// `platform` in prod defaults to 'any'. We accept the sender platforms plus 'any'.
export const templatePlatforms = ['any', ...senderPlatforms] as const;

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  platform: z.enum(templatePlatforms).default('any'),
  isDefault: z.boolean().optional(),
});
export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;
