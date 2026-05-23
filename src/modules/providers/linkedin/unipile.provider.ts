import { Injectable } from '@nestjs/common';
import { request } from 'undici';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ExternalServiceError } from '@shared/errors/domain.error';
import type {
  ILinkedInProvider,
  SendDmArgs,
  SendInviteArgs,
  UnipileProfile,
  UnipileSendResult,
} from './types';

/// Unipile adapter — parity with N8N workflows §18.5.
/// All endpoints under https://{UNIPILE_DSN}/api/v1/...
@Injectable()
export class UnipileProvider implements ILinkedInProvider {
  private readonly apiKey?: string;
  private readonly baseUrl?: string;

  constructor(config: TypedConfigService) {
    this.apiKey = config.get('UNIPILE_API_KEY');
    const dsn = config.get('UNIPILE_DSN');
    this.baseUrl = dsn ? `https://${dsn}` : undefined;
  }

  async lookupProfile({
    accountId,
    publicIdentifier,
  }: {
    accountId: string;
    publicIdentifier: string;
  }): Promise<UnipileProfile> {
    const response = await this.call('GET', `/api/v1/users/${publicIdentifier}`, {
      query: { account_id: accountId, linkedin_sections: '*' },
    });
    const payload = (await response.body.json()) as Record<string, unknown>;
    const providerId =
      typeof payload.provider_id === 'string' || typeof payload.provider_id === 'number'
        ? String(payload.provider_id)
        : '';
    return {
      providerId,
      publicIdentifier,
      fullName: typeof payload.name === 'string' ? payload.name : undefined,
      headline: typeof payload.headline === 'string' ? payload.headline : undefined,
      isRelationship: Boolean(payload.is_relationship),
      raw: payload,
    };
  }

  async sendDm(args: SendDmArgs): Promise<UnipileSendResult> {
    const response = await this.call('POST', '/api/v1/chats', {
      body: {
        account_id: args.accountId,
        text: args.text,
        attendees_ids: args.attendeesIds,
      },
    });
    const payload = (await response.body.json()) as { id?: string; message_id?: string };
    return {
      messageId: payload.message_id ?? payload.id ?? '',
      acceptedAt: new Date(),
    };
  }

  async sendInvite(args: SendInviteArgs): Promise<UnipileSendResult> {
    const response = await this.call('POST', '/api/v1/users/invite', {
      body: {
        account_id: args.accountId,
        provider_id: args.providerId,
        message: args.message,
      },
    });
    const payload = (await response.body.json()) as { id?: string };
    return { messageId: payload.id ?? '', acceptedAt: new Date() };
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    options: { query?: Record<string, string>; body?: unknown } = {},
  ): Promise<Awaited<ReturnType<typeof request>>> {
    if (!this.apiKey || !this.baseUrl) {
      throw new ExternalServiceError('Unipile', 'UNIPILE_API_KEY or UNIPILE_DSN not configured');
    }
    const qs = options.query ? `?${new URLSearchParams(options.query).toString()}` : '';
    const response = await request(`${this.baseUrl}${path}${qs}`, {
      method,
      headers: {
        'X-API-KEY': this.apiKey,
        accept: 'application/json',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (response.statusCode >= 400) {
      const body = await response.body.text();
      throw new ExternalServiceError('Unipile', `${response.statusCode}: ${body}`);
    }
    return response;
  }
}
