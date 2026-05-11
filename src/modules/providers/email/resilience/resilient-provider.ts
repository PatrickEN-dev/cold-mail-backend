import {
  ConsecutiveBreaker,
  ExponentialBackoff,
  TimeoutStrategy,
  circuitBreaker,
  handleAll,
  retry,
  timeout,
  wrap,
} from 'cockatiel';
import type { IEmailProvider, SendEmailArgs, SendEmailResult } from '../types';

/// Wraps an IEmailProvider with retry + timeout + circuit breaker.
/// Brief §9.2: timeout 15s, retry 2x, circuit breaker 50% errors / 30s.
export class ResilientEmailProvider implements IEmailProvider {
  readonly name: IEmailProvider['name'];
  private readonly policy: ReturnType<typeof wrap>;

  constructor(private readonly inner: IEmailProvider) {
    this.name = inner.name;
    const retryPolicy = retry(handleAll, {
      maxAttempts: 2,
      backoff: new ExponentialBackoff({ initialDelay: 500, maxDelay: 5_000 }),
    });
    const timeoutPolicy = timeout(15_000, TimeoutStrategy.Aggressive);
    const breakerPolicy = circuitBreaker(handleAll, {
      halfOpenAfter: 30_000,
      breaker: new ConsecutiveBreaker(5),
    });
    this.policy = wrap(retryPolicy, breakerPolicy, timeoutPolicy);
  }

  async send(args: SendEmailArgs): Promise<SendEmailResult> {
    return (await this.policy.execute(() => this.inner.send(args))) as SendEmailResult;
  }

  verifyDomain(domain: string) {
    return this.inner.verifyDomain?.(domain) ?? Promise.resolve({ domain, verified: false });
  }
}
