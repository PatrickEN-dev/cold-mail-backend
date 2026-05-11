import { describe, expect, it } from 'vitest';
import { ResendWebhookParser } from './resend.parser';

describe('ResendWebhookParser', () => {
  const parser = new ResendWebhookParser();

  it('parses email.delivered', () => {
    const event = parser.parse({
      type: 'email.delivered',
      created_at: '2026-05-10T10:00:00Z',
      data: { email_id: 'msg-1', from: 'a@b.com', to: ['x@y.com'] },
    });
    expect(event).not.toBeNull();
    expect(event!.type).toBe('delivered');
    expect(event!.externalMessageId).toBe('msg-1');
    expect(event!.from).toBe('a@b.com');
    expect(event!.to).toBe('x@y.com');
  });

  it('parses email.bounced with name in from', () => {
    const event = parser.parse({
      type: 'email.bounced',
      created_at: '2026-05-10T10:00:00Z',
      data: { email_id: 'msg-2', from: 'Sofia <sofia@gbc.com>', to: ['x@y.com'] },
    });
    expect(event!.type).toBe('bounced');
    expect(event!.from).toBe('sofia@gbc.com');
  });

  it('ignores email.complained', () => {
    const event = parser.parse({
      type: 'email.complained',
      created_at: '2026-05-10T10:00:00Z',
      data: { email_id: 'msg-3', from: 'a@b.com', to: ['x@y.com'] },
    });
    expect(event).toBeNull();
  });

  it('rejects malformed payload', () => {
    expect(() => parser.parse({ foo: 'bar' })).toThrow();
  });
});
