/// DI tokens for each strategy. Use these — never inject the concrete class.
export const EMAIL_PROVIDER_TOKENS = {
  resend: Symbol('EMAIL_PROVIDER:resend'),
  zapmail: Symbol('EMAIL_PROVIDER:zapmail'),
  smtp: Symbol('EMAIL_PROVIDER:smtp'),
  google: Symbol('EMAIL_PROVIDER:google'),
  ses: Symbol('EMAIL_PROVIDER:ses'),
  mailgun: Symbol('EMAIL_PROVIDER:mailgun'),
  outlook: Symbol('EMAIL_PROVIDER:outlook'),
} as const;
