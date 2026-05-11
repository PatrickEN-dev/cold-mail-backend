import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ExternalServiceError } from '@shared/errors/domain.error';
import { WARMUP_REPLY_PROMPT, WARMUP_SEND_PROMPT } from './prompts/warmup.prompts';
import type { GeneratedEmail, IAiProvider } from './types';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(config: TypedConfigService) {
    const apiKey = config.get('OPENAI_API_KEY');
    this.model = config.get('OPENAI_MODEL');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  generateWarmupEmail(): Promise<GeneratedEmail> {
    return this.callJson(WARMUP_SEND_PROMPT);
  }

  generateWarmupReply(context: {
    incomingSubject?: string;
    incomingBody?: string;
  }): Promise<GeneratedEmail> {
    const userPrompt = [
      `Incoming subject: ${context.incomingSubject ?? ''}`,
      `Incoming body: ${context.incomingBody ?? ''}`,
      'Generate a concise, friendly reply.',
    ].join('\n');
    return this.callJson(WARMUP_REPLY_PROMPT, userPrompt);
  }

  private async callJson(systemPrompt: string, userPrompt = 'Generate.'): Promise<GeneratedEmail> {
    if (!this.client) {
      throw new ExternalServiceError('OpenAI', 'OPENAI_API_KEY not configured');
    }
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new ExternalServiceError('OpenAI', 'Empty completion response');
    }
    try {
      const parsed = JSON.parse(text) as Partial<GeneratedEmail>;
      if (!parsed.subject || !parsed.html) {
        throw new Error('Missing subject or html');
      }
      return { subject: parsed.subject, html: parsed.html };
    } catch (err) {
      this.logger.error({ raw: text }, 'failed to parse OpenAI JSON');
      throw new ExternalServiceError(
        'OpenAI',
        `Invalid JSON output: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}
