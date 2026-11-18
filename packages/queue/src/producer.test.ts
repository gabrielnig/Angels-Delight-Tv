import { describe, expect, it } from 'vitest';
import { ensureQueues } from './worker';
import { JobProducer } from './producer';
import { FakeBoss, MemoryMirror } from './testing';

const exportId = '0192f0a0-0000-7000-8000-000000000009';

describe('JobProducer.enqueueUntracked', () => {
  async function setup() {
    const boss = new FakeBoss();
    await ensureQueues(boss);
    const mirror = new MemoryMirror();
    return { boss, mirror, producer: new JobProducer({ boss, mirror }) };
  }

  it('queues a job that has its own row elsewhere, without a mirror row', async () => {
    const { boss, mirror, producer } = await setup();
    const id = await producer.enqueueUntracked('exports.generate', { exportId });
    expect(id).toBeTruthy();
    expect(boss.jobs).toHaveLength(1);
    expect(boss.jobs[0]).toMatchObject({ name: 'exports.generate', data: { exportId } });
    expect(mirror.rows ?? []).toHaveLength(0);
  });

  it('queues one job per export id, so a double click does not build the file twice', async () => {
    const { boss, producer } = await setup();
    await producer.enqueueUntracked('exports.generate', { exportId });
    const second = await producer.enqueueUntracked('exports.generate', { exportId });
    expect(second).toBeNull();
    expect(boss.jobs).toHaveLength(1);
  });

  it('refuses a payload that is not valid', async () => {
    const { producer } = await setup();
    await expect(
      producer.enqueueUntracked('exports.generate', { exportId: 'nope' } as never),
    ).rejects.toThrow();
  });
});
