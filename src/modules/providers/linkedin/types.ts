export interface UnipileProfile {
  providerId: string;
  publicIdentifier: string;
  fullName?: string;
  headline?: string;
  isRelationship: boolean;
  raw: Record<string, unknown>;
}

export interface SendDmArgs {
  accountId: string;
  attendeesIds: string[];
  text: string;
}

export interface SendInviteArgs {
  accountId: string;
  providerId: string;
  message?: string;
}

export interface UnipileSendResult {
  messageId: string;
  acceptedAt: Date;
}

export interface ILinkedInProvider {
  lookupProfile(args: { accountId: string; publicIdentifier: string }): Promise<UnipileProfile>;
  sendDm(args: SendDmArgs): Promise<UnipileSendResult>;
  sendInvite(args: SendInviteArgs): Promise<UnipileSendResult>;
}
