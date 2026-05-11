import { z } from 'zod';

export const sendLinkedInMessageSchema = z.object({
  accountId: z.string().min(1),
  publicIdentifier: z.string().min(1),
  message: z.string().min(1),
  inviteMessage: z.string().optional(),
});
export type SendLinkedInMessageDto = z.infer<typeof sendLinkedInMessageSchema>;
