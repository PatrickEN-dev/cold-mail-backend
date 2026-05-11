import { Injectable, Logger } from '@nestjs/common';
import {
  type EmailEventProvider,
  type NormalizedEmailEvent,
} from './normalized-event';

/// Zapmail webhook payload — shape was not available during the audit.
/// TODO(wave-2): confirm payload shape with Zapmail samples and finalize parser.
@Injectable()
export class ZapmailWebhookParser {
  readonly provider: EmailEventProvider = 'zapmail';
  private readonly logger = new Logger(ZapmailWebhookParser.name);

  parse(_raw: unknown): NormalizedEmailEvent | null {
    this.logger.warn('ZapmailWebhookParser is a stub — TODO confirm payload shape');
    return null;
  }
}
