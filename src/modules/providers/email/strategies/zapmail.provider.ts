import { Injectable } from '@nestjs/common';
import { request } from 'undici';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ExternalServiceError } from '@shared/errors/domain.error';
import type { IEmailProvider, SendEmailArgs, SendEmailResult } from '../types';

/// Zapmail strategy — parity with N8N pt2 §18.1 `Zapmail - Enviar Email`.
/// POST https://api.zapmail.ai/api/v2/onebox/send-email, header x-auth-zapmail.
@Injectable()
export class ZapmailEmailProvider implements IEmailProvider {
  readonly name = 'zapmail' as const;
  private readonly apiKey?: string;

  constructor(config: TypedConfigService) {
    this.apiKey = config.get('ZAPMAIL_API_KEY');
  }

  async send(args: SendEmailArgs): Promise<SendEmailResult> {
    if (!this.apiKey) {
      throw new ExternalServiceError('Zapmail', 'ZAPMAIL_API_KEY not configured');
    }

    const response = await request('https://api.zapmail.ai/api/v2/onebox/send-email', {
      method: 'POST',
      headers: {
        'x-auth-zapmail': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: args.from.name ?? args.from.address,
        account: args.from.address,
        to: args.to,
        subject: args.subject,
        body: args.html,
      }),
    });

    if (response.statusCode >= 400) {
      const body = await response.body.text();
      throw new ExternalServiceError('Zapmail', `${response.statusCode}: ${body}`);
    }

    const payload = (await response.body.json()) as { id?: string; message_id?: string };
    const messageId = payload.message_id ?? payload.id;
    if (!messageId) {
      // Without the provider's own id we lose traceability between this send
      // and incoming webhooks. Treat as a Zapmail-side malformed response.
      throw new ExternalServiceError('Zapmail', 'Missing message id in response');
    }
    return { providerMessageId: messageId, acceptedAt: new Date() };
  }
}
