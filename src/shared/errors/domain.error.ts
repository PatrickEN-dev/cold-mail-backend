export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly status: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly status = 404;
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly status = 401;
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly status = 403;
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly status = 422;
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly status = 409;
}

export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly status = 502;
  constructor(service: string, message: string) {
    super(`[${service}] ${message}`);
  }
}

export class RateLimitedError extends DomainError {
  readonly code = 'RATE_LIMITED';
  readonly status = 429;
}
