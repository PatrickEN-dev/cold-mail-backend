import { randomUUID } from 'node:crypto';

export abstract class Entity<TProps> {
  protected readonly _id: string;
  protected readonly props: TProps;

  protected constructor(props: TProps, id?: string) {
    this._id = id ?? randomUUID();
    this.props = props;
  }

  get id(): string {
    return this._id;
  }

  equals(other?: Entity<TProps>): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this._id === other._id;
  }
}
