import { Injectable, Logger } from '@nestjs/common';
import { ExternalServiceError } from '@shared/errors/domain.error';
import type { IEmailProvider, SendEmailArgs, SendEmailResult } from '../types';

/// Google / Gmail API — wave 3 (warmup) needs this for the GBC personas.
/// TODO(wave-3): implement using OAuth2 + gmail.users.messages.send.
/// Until then this throws and dispatch must skip senders with provider='google'.
@Injectable()
export class GoogleEmailProvider implements IEmailProvider {
  readonly name = 'google' as const;
  private readonly logger = new Logger(GoogleEmailProvider.name);

  send(_args: SendEmailArgs): Promise<SendEmailResult> {
    this.logger.warn('GoogleEmailProvider.send not implemented yet — see TODO');
    throw new ExternalServiceError(
      'Google',
      'GoogleEmailProvider not implemented yet (planned for wave 3 warmup)',
    );
  }
}
