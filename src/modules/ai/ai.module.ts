import { Module } from '@nestjs/common';
import { OpenAiProvider } from './openai.provider';
import { AI_PROVIDER } from './types';

@Module({
  providers: [{ provide: AI_PROVIDER, useClass: OpenAiProvider }],
  exports: [AI_PROVIDER],
})
export class AiModule {}
