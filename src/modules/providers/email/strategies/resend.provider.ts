import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ExternalServiceError } from '@shared/errors/domain.error';
import { RateLimiter } from '@shared/http/rate-limiter';
import type { IEmailProvider, SendEmailArgs, SendEmailResult } from '../types';

/// Resend strategy — paridade com pt2 §18.1 `HTTP Request1`.
/// Rate limited to 5 req/s (Resend default plan). The legacy pt2 hit 429 here
/// because N8N runs 10 executions in parallel without coordination.
@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  readonly name = 'resend' as const;
  private readonly client: Resend | null;
  private readonly rateLimiter = new RateLimiter(5, 1000);

  constructor(config: TypedConfigService) {
    const apiKey = config.get('RESEND_API_KEY');
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  async send(args: SendEmailArgs): Promise<SendEmailResult> {
    if (!this.client) {
      throw new ExternalServiceError('Resend', 'RESEND_API_KEY not configured');
    }
    await this.rateLimiter.acquire();
    const from = args.from.name
      ? `${args.from.name} <${args.from.address}>`
      : args.from.address;

    const result = await this.client.emails.send({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo ?? args.from.address,
      headers: {
        ...(args.headers ?? {}),
        ...(args.threadingHints?.inReplyTo
          ? { 'In-Reply-To': args.threadingHints.inReplyTo }
          : {}),
        ...(args.threadingHints?.references
          ? { References: args.threadingHints.references }
          : {}),
      },
    });

    if (result.error) {
      throw new ExternalServiceError('Resend', result.error.message);
    }
    if (!result.data?.id) {
      throw new ExternalServiceError('Resend', 'Missing message id in response');
    }
    return { providerMessageId: result.data.id, acceptedAt: new Date() };
  }
}
