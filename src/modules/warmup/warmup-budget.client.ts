import { Injectable } from '@nestjs/common';
import { request } from 'undici';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ExternalServiceError } from '@shared/errors/domain.error';

export interface WarmupBudget {
  enabled: boolean;
  status: 'active' | 'rest_day' | 'paused' | 'auto_paused' | 'no_warmup_configured';
  allowedToday: number;
  alreadySent: number;
  remaining: number;
}

/// Calls the Supabase Edge Function (brief §6.1.4). Kept deployed during
/// migration per decision #5 — Nest consumes it with service-role auth.
@Injectable()
export class WarmupBudgetClient {
  private readonly url?: string;
  private readonly serviceKey?: string;

  constructor(config: TypedConfigService) {
    this.url = config.get('WARMUP_BUDGET_URL');
    this.serviceKey = config.get('SUPABASE_SERVICE_ROLE_KEY');
  }

  async getBudget(senderEmailId: string): Promise<WarmupBudget> {
    if (!this.url || !this.serviceKey) {
      throw new ExternalServiceError(
        'WarmupBudget',
        'WARMUP_BUDGET_URL or SUPABASE_SERVICE_ROLE_KEY not configured',
      );
    }
    const response = await request(`${this.url}?sender_email_id=${senderEmailId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        accept: 'application/json',
      },
    });
    if (response.statusCode >= 400) {
      const body = await response.body.text();
      throw new ExternalServiceError('WarmupBudget', `${response.statusCode}: ${body}`);
    }
    const payload = (await response.body.json()) as Partial<WarmupBudget>;
    return {
      enabled: Boolean(payload.enabled),
      status: payload.status ?? 'no_warmup_configured',
      allowedToday: payload.allowedToday ?? 0,
      alreadySent: payload.alreadySent ?? 0,
      remaining: payload.remaining ?? 0,
    };
  }
}
