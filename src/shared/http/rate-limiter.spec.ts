import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('lets the first N acquires through immediately', async () => {
    const limiter = new RateLimiter(3, 1000);
    const start = Date.now();
    await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('blocks the (N+1)th acquire until the window slides', async () => {
    const limiter = new RateLimiter(2, 200);
    await limiter.acquire();
    await limiter.acquire();
    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(180);
    expect(elapsed).toBeLessThan(400);
  });
});
