import { describe, expect, it } from 'vitest';
import type { SenderEmail } from '@prisma/client';
import { buildWarmupPairs, threadIdFor } from './warmup-pairing';

const sender = (id: string, userId: string, email: string): SenderEmail =>
  ({
    id,
    userId,
    emailAddress: email,
    displayName: email,
    domain: null,
    provider: 'resend',
    providerId: null,
    platform: 'resend',
    status: 'active',
    dailyLimit: 30,
    todayUsage: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as unknown as SenderEmail;

describe('buildWarmupPairs', () => {
  it('returns no pairs when a tenant has fewer than 2 senders', () => {
    const pairs = buildWarmupPairs([sender('1', 'u1', 'a@x.com')]);
    expect(pairs).toHaveLength(0);
  });

  it('pairs senders only within the same tenant', () => {
    const senders = [
      sender('1', 'u1', 'a@x.com'),
      sender('2', 'u1', 'b@x.com'),
      sender('3', 'u2', 'c@y.com'),
      sender('4', 'u2', 'd@y.com'),
    ];
    const pairs = buildWarmupPairs(senders);
    for (const p of pairs) {
      expect(p.sender.userId).toBe(p.receiver.userId);
      expect(p.sender.id).not.toBe(p.receiver.id);
    }
  });
});

describe('threadIdFor', () => {
  it('is symmetric and case-insensitive', () => {
    expect(threadIdFor('A@x.com', 'B@x.com')).toBe(threadIdFor('b@x.com', 'a@x.com'));
  });
});
