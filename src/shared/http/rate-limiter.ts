/// Simple in-process token-bucket / sliding-window rate limiter.
/// Process-local — fine for one Nest worker per container.
/// For multi-worker, move to a Redis-backed limiter.
export class RateLimiter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  /// Resolves as soon as a slot is available. Never rejects.
  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.evictExpired(now);
      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }
      const waitMs = this.windowMs - (now - this.timestamps[0]) + 5;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private evictExpired(now: number): void {
    while (this.timestamps.length > 0 && now - this.timestamps[0] >= this.windowMs) {
      this.timestamps.shift();
    }
  }
}
