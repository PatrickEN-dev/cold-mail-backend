export interface DomainEvent<TPayload = unknown> {
  readonly name: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export abstract class BaseDomainEvent<TPayload> implements DomainEvent<TPayload> {
  abstract readonly name: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;

  protected constructor(payload: TPayload) {
    this.occurredAt = new Date();
    this.payload = payload;
  }
}
