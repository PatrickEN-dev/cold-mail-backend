import { ExternalServiceError } from '@shared/errors/domain.error';

const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/,
];

/// Lightweight outbound URL guard. Used on configurable / user-influenced
/// destinations (e.g. tenant-provided webhook receivers) to prevent SSRF.
/// Static destinations under our control (Resend API, OpenAI) don't need this.
export function assertSafeOutboundUrl(rawUrl: string, source: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExternalServiceError(source, `Invalid URL: ${rawUrl}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ExternalServiceError(source, `Unsupported protocol: ${url.protocol}`);
  }
  // In production we forbid plain http and any private/loopback hostname.
  if (process.env.NODE_ENV === 'production') {
    if (url.protocol !== 'https:') {
      throw new ExternalServiceError(source, 'http:// not allowed in production');
    }
    const host = url.hostname.toLowerCase();
    if (PRIVATE_RANGES.some((re) => re.test(host))) {
      throw new ExternalServiceError(source, `Refusing to call private host: ${host}`);
    }
  }
  return url;
}
