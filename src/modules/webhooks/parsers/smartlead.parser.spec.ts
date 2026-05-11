import { describe, expect, it } from 'vitest';
import { SmartLeadWebhookParser } from './smartlead.parser';

describe('SmartLeadWebhookParser', () => {
  const parser = new SmartLeadWebhookParser();

  it('parses EMAIL_REPLY with full reply object', () => {
    const event = parser.parse({
      event_type: 'EMAIL_REPLY',
      from_email: 'lead@example.com',
      to_email: 'sender@scalesops.co',
      subject: 'Re: hello',
      reply_message: {
        message_id: '<reply@x>',
        in_reply_to: '<orig@y>',
        html: '<p>thanks</p>',
        text: 'thanks',
        subject: 'Re: hello',
      },
    });
    expect(event.type).toBe('replied');
    expect(event.externalMessageId).toBe('<reply@x>');
    expect(event.reply?.inReplyTo).toBe('<orig@y>');
    expect(event.reply?.bodyHtml).toBe('<p>thanks</p>');
  });

  it('parses EMAIL_BOUNCE', () => {
    const event = parser.parse({
      event_type: 'EMAIL_BOUNCE',
      from_email: 'sender@scalesops.co',
      to_email: 'lead@dead.com',
      sent_message: { message_id: '<sent@x>' },
      bounce: { type: 'hard', reason: 'mailbox not found' },
    });
    expect(event.type).toBe('bounced');
    expect(event.bounce?.type).toBe('hard');
  });
});
