import type { SenderEmail } from '@prisma/client';

export interface WarmupPair {
  sender: SenderEmail;
  receiver: SenderEmail;
}

/// Brief §18.3 `randomizador1`: shuffles senders and pairs sender→receiver.
/// Decision #16: pairing is tenant-scoped (only same userId).
/// TODO(future): opt-in shared network across tenants if a client subscribes.
export function buildWarmupPairs(active: SenderEmail[]): WarmupPair[] {
  if (active.length < 2) return [];

  const byUser = new Map<string, SenderEmail[]>();
  for (const s of active) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  const pairs: WarmupPair[] = [];
  for (const senders of byUser.values()) {
    if (senders.length < 2) continue;
    const shuffled = shuffle(senders);
    for (let i = 0; i < shuffled.length; i++) {
      const sender = shuffled[i];
      let receiver = shuffled[(i + 1) % shuffled.length];
      if (sender.id === receiver.id) {
        receiver = shuffled[(i + 2) % shuffled.length];
      }
      pairs.push({ sender, receiver });
    }
  }
  return pairs;
}

export function threadIdFor(senderEmail: string, receiverEmail: string): string {
  return [senderEmail.toLowerCase(), receiverEmail.toLowerCase()].sort().join('_');
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
