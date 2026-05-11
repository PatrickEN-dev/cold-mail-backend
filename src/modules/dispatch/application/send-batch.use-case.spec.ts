import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SendBatchUseCase } from './send-batch.use-case';
import type { DispatchBatchDto } from '../dto/dispatch.dto';

interface AddedJob {
  name: string;
  data: { leadEmail: string; senderEmailAddress: string };
  opts: { jobId: string; delay: number };
}

function makeQueue() {
  const added: AddedJob[] = [];
  return {
    queue: {
      addBulk: vi.fn((jobs: AddedJob[]) => {
        added.push(...jobs);
        return Promise.resolve();
      }),
    },
    added,
  };
}

function dtoWith(
  senderId: string,
  leads: { id?: string; email: string }[],
): DispatchBatchDto {
  return {
    dispatches: [
      {
        sender_email: {
          id: senderId,
          email_address: `${senderId}@x.com`,
          display_name: senderId,
          domain: 'x.com',
          provider: 'resend',
          provider_id: null,
          platform: 'resend',
        },
        platform: 'resend',
        emails: leads,
      },
    ],
    total_leads: leads.length,
    schedule: false,
  };
}

describe('SendBatchUseCase pacing', () => {
  let queue: ReturnType<typeof makeQueue>;
  let useCase: SendBatchUseCase;

  beforeEach(() => {
    queue = makeQueue();
    // bypass DI — we only need the queue dependency
    useCase = new SendBatchUseCase(queue.queue as unknown as never);
  });

  it('first lead in a sender block has zero delay', async () => {
    await useCase.execute('user-1', dtoWith('s1', [{ email: 'a@x.com' }]));
    expect(queue.added).toHaveLength(1);
    expect(queue.added[0].opts.delay).toBe(0);
  });

  it('subsequent leads have monotonically increasing delays', async () => {
    await useCase.execute(
      'user-1',
      dtoWith('s1', [{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'c@x.com' }]),
    );
    expect(queue.added).toHaveLength(3);
    const delays = queue.added.map((j) => j.opts.delay);
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBeGreaterThanOrEqual(90_000);
    expect(delays[1]).toBeLessThanOrEqual(150_000);
    expect(delays[2]).toBeGreaterThan(delays[1]);
  });

  it('builds unique jobIds per (batch, sender, index)', async () => {
    await useCase.execute('user-1', dtoWith('s1', [{ email: 'a@x.com' }, { email: 'b@x.com' }]));
    const ids = queue.added.map((j) => j.opts.jobId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
