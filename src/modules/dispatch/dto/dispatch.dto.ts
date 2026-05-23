import { z } from 'zod';
import { senderPlatforms } from '@modules/senders/dto/sender.dto';

/// Contract from the Next.js front (brief §6.2.1) — must be accepted verbatim
/// so NEXT_PUBLIC_WEBHOOK_N8N can be flipped without front changes.
export const senderEmailFragmentSchema = z.object({
  id: z.string().uuid(),
  email_address: z.string().email(),
  display_name: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  provider: z.string(),
  provider_id: z.string().nullable().optional(),
  platform: z.enum(senderPlatforms),
});

export const leadFragmentSchema = z
  .object({
    id: z.string().uuid().optional(),
    email: z.string().email(),
    name: z.string().nullable().optional(),
  })
  .passthrough();

export const dispatchBatchSchema = z.object({
  dispatches: z
    .array(
      z.object({
        sender_email: senderEmailFragmentSchema,
        platform: z.string(),
        emails: z.array(leadFragmentSchema).min(1),
      }),
    )
    .min(1),
  total_leads: z.number().int().nonnegative(),
  schedule: z.boolean().default(false),
  date: z.string().datetime().optional(),
  schedule_id: z.string().uuid().optional(),
  schedule_name: z.string().nullable().optional(),
  schedule_type: z.enum(['one_time', 'recurring']).optional(),
  scheduled_date: z.string().nullable().optional(),
  scheduled_time: z.string().optional(),
  recurring_days: z.array(z.string()).optional(),
  // legacy duplicates — accept but ignore
  sender_email: senderEmailFragmentSchema.optional(),
  platform: z.string().optional(),
  emails: z.array(leadFragmentSchema).optional(),
});
export type DispatchBatchDto = z.infer<typeof dispatchBatchSchema>;

export interface DispatchSendJobData {
  userId: string;
  batchId: string;
  leadEmail: string;
  leadName?: string;
  emailId?: string;
  senderEmailId: string;
  senderEmailAddress: string;
  senderDisplayName?: string;
  senderProvider: string;
  platform: string;
  scheduledFor?: string;
}
