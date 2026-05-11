import { createHmac, timingSafeEqual } from 'node:crypto';

interface VerifyArgs {
  rawBody: Buffer | string;
  signature: string;
  secret: string;
  algorithm?: 'sha256' | 'sha1';
  /// When set, also requires `timestamp` to be within `toleranceSec` of "now"
  /// and uses `${timestamp}.${rawBody}` as the signed payload (Stripe-style).
  timestamp?: string | number;
  toleranceSec?: number;
}

export function verifyHmacSignature(args: VerifyArgs): boolean {
  const { rawBody, signature, secret, algorithm = 'sha256' } = args;

  if (args.timestamp !== undefined) {
    const tsNum = Number(args.timestamp);
    if (!Number.isFinite(tsNum)) return false;
    const ageSec = Math.abs(Date.now() / 1000 - tsNum);
    if (ageSec > (args.toleranceSec ?? 300)) return false;
    const signedPayload = `${tsNum}.${rawBody.toString('utf8')}`;
    return timingSafeHexCompare(
      createHmac(algorithm, secret).update(signedPayload).digest('hex'),
      signature,
    );
  }

  return timingSafeHexCompare(
    createHmac(algorithm, secret).update(rawBody).digest('hex'),
    signature,
  );
}

function timingSafeHexCompare(expected: string, given: string): boolean {
  // Strip optional algorithm prefix ("sha256=...") to be forgiving with the
  // formats different providers use.
  const cleanGiven = given.includes('=') ? given.split('=', 2)[1] : given;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(cleanGiven, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
