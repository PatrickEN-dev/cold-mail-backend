import { Injectable } from '@nestjs/common';
import { request } from 'undici';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ExternalServiceError } from '@shared/errors/domain.error';
import type { IEmailProvider, SendEmailArgs, SendEmailResult } from '../types';

/// Mailgun — brief notes 0 senders today, kept dormant.
@Injectable()
export class MailgunEmailProvider implements IEmailProvider {
  readonly name = 'mailgun' as const;
  private readonly apiKey?: string;
  private readonly domain?: string;

  constructor(config: TypedConfigService) {
    this.apiKey = config.get('MAILGUN_API_KEY');
    this.domain = config.get('MAILGUN_DOMAIN');
  }

  async send(args: SendEmailArgs): Promise<SendEmailResult> {
    if (!this.apiKey || !this.domain) {
      throw new ExternalServiceError('Mailgun', 'MAILGUN_API_KEY or MAILGUN_DOMAIN not configured');
    }
    const form = new URLSearchParams();
    form.set('from', args.from.name ? `${args.from.name} <${args.from.address}>` : args.from.address);
    form.set('to', args.to);
    form.set('subject', args.subject);
    form.set('html', args.html);
    if (args.text) form.set('text', args.text);
    if (args.replyTo) form.set('h:Reply-To', args.replyTo);
    if (args.threadingHints?.inReplyTo)
      form.set('h:In-Reply-To', args.threadingHints.inReplyTo);
    if (args.threadingHints?.references)
      form.set('h:References', args.threadingHints.references);

    const auth = Buffer.from(`api:${this.apiKey}`).toString('base64');
    const response = await request(`https://api.mailgun.net/v3/${this.domain}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (response.statusCode >= 400) {
      const body = await response.body.text();
      throw new ExternalServiceError('Mailgun', `${response.statusCode}: ${body}`);
    }
    const payload = (await response.body.json()) as { id?: string };
    if (!payload.id) {
      throw new ExternalServiceError('Mailgun', 'Missing message id in response');
    }
    return { providerMessageId: payload.id, acceptedAt: new Date() };
  }
}
