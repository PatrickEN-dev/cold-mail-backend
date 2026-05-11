import { Injectable, Logger } from '@nestjs/common';
import { SendBatchUseCase } from '@modules/dispatch/application/send-batch.use-case';
import { SendersRepository } from '@modules/senders/senders.repository';
import { LeadsRepository } from '@modules/leads/leads.repository';
import { NotFoundError } from '@shared/errors/domain.error';
import type { Schedule } from '@prisma/client';

interface LeadSelection {
  id?: string;
  email?: string;
  name?: string;
}

/// Wave 5 ↔ Wave 4 bridge: turns a fired schedule into a dispatch batch.
/// `lead_selections` is a jsonb array stored as `[{ id?, email?, name? }, ...]`
/// (paridade with the legacy front payload §6.2.1).
@Injectable()
export class FireScheduleUseCase {
  private readonly logger = new Logger(FireScheduleUseCase.name);

  constructor(
    private readonly senders: SendersRepository,
    private readonly leads: LeadsRepository,
    private readonly sendBatch: SendBatchUseCase,
  ) {}

  async execute(schedule: Schedule): Promise<{ enqueued: number }> {
    if (!schedule.senderEmailId) {
      this.logger.warn(
        { scheduleId: schedule.id },
        'schedule has no sender_email_id — cannot fire',
      );
      return { enqueued: 0 };
    }
    const sender = await this.senders.findByIdForUser(
      schedule.senderEmailId,
      schedule.userId,
    );
    if (!sender) {
      throw new NotFoundError(
        `Sender ${schedule.senderEmailId} not found for user ${schedule.userId}`,
      );
    }

    const leads = this.parseLeadSelections(schedule.leadSelections);
    if (leads.length === 0) {
      this.logger.warn({ scheduleId: schedule.id }, 'schedule fired with empty lead selection');
      return { enqueued: 0 };
    }

    // Hydrate missing email addresses from emails table when only id is given.
    const hydratedLeads = await Promise.all(
      leads.map(async (lead) => {
        if (lead.email) return { id: lead.id, email: lead.email, name: lead.name };
        if (!lead.id) return null;
        const fetched = await this.leads.findByIdForUser(lead.id, schedule.userId);
        return fetched
          ? { id: fetched.id, email: fetched.email, name: fetched.leadName ?? undefined }
          : null;
      }),
    );
    const validLeads = hydratedLeads.filter(
      (l): l is { id: string | undefined; email: string; name: string | undefined } =>
        l !== null && Boolean(l.email),
    );

    if (validLeads.length === 0) {
      return { enqueued: 0 };
    }

    const result = await this.sendBatch.execute(schedule.userId, {
      dispatches: [
        {
          sender_email: {
            id: sender.id,
            email_address: sender.emailAddress,
            display_name: sender.displayName,
            domain: sender.domain,
            provider: sender.provider,
            provider_id: sender.providerId,
            platform: sender.platform as 'none' | 'smartlead' | 'resend' | 'zapmail' | 'google' | 'outlook',
          },
          platform: sender.platform,
          emails: validLeads.map((l) => ({
            id: l.id,
            email: l.email,
            name: l.name ?? null,
          })),
        },
      ],
      total_leads: validLeads.length,
      schedule: false,
    });

    this.logger.log(
      { scheduleId: schedule.id, enqueued: result.enqueued },
      'schedule fired',
    );
    return { enqueued: result.enqueued };
  }

  private parseLeadSelections(raw: unknown): LeadSelection[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is LeadSelection => {
      if (typeof item !== 'object' || item === null) return false;
      const it = item as Record<string, unknown>;
      return typeof it.id === 'string' || typeof it.email === 'string';
    });
  }
}
