import { describe, expect, it } from 'vitest';
import { extractEmailAddress } from './normalized-event';

describe('extractEmailAddress', () => {
  it('extracts addr from "Name <addr>"', () => {
    expect(extractEmailAddress('Sofia Martins <sofia@gbc.com>')).toBe('sofia@gbc.com');
  });

  it('returns input as-is when no angle brackets', () => {
    expect(extractEmailAddress('sofia@gbc.com')).toBe('sofia@gbc.com');
  });

  it('trims whitespace', () => {
    expect(extractEmailAddress('  sofia@gbc.com  ')).toBe('sofia@gbc.com');
  });
});
