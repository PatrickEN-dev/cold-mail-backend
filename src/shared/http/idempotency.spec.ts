import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyHmacSignature } from './idempotency';

describe('verifyHmacSignature', () => {
  const secret = 'test-secret-for-hmac-suite';

  it('accepts a valid signature', () => {
    const body = JSON.stringify({ hello: 'world' });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyHmacSignature({ rawBody: body, signature, secret })).toBe(true);
  });

  it('rejects an invalid signature', () => {
    const body = JSON.stringify({ hello: 'world' });
    expect(verifyHmacSignature({ rawBody: body, signature: 'deadbeef', secret })).toBe(false);
  });

  it('rejects mismatched-length signatures without timing leak', () => {
    const body = JSON.stringify({ a: 1 });
    expect(verifyHmacSignature({ rawBody: body, signature: 'abc', secret })).toBe(false);
  });
});
