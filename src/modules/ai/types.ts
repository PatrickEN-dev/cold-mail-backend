export interface GeneratedEmail {
  subject: string;
  html: string;
}

export interface IAiProvider {
  generateWarmupEmail(context: { language?: 'en-US' | 'pt-BR' }): Promise<GeneratedEmail>;
  generateWarmupReply(context: {
    incomingSubject?: string;
    incomingBody?: string;
    language?: 'en-US' | 'pt-BR';
  }): Promise<GeneratedEmail>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
