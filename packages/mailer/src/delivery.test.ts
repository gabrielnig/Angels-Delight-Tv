import { describe, expect, it, vi } from 'vitest';
import { Mailer, MemoryTransport, type MailTransport, type OutgoingMail } from './mailer';
import { OutageMonitor, RetryingTransport, RETRY_DELAYS_MS } from './delivery';

const mail: OutgoingMail = { from: 'a@x.org', to: 'b@x.org', subject: 's', text: 't', html: 'h' };

function flaky(failures: number): MailTransport & { calls: number } {
  const t = {
    calls: 0,
    async send() {
      t.calls += 1;
      if (t.calls <= failures) throw new Error('smtp down');
      return { messageId: 'ok' };
    },
  };
  return t;
}

describe('RetryingTransport', () => {
  it('retries with growing backoff and succeeds', async () => {
    const sleeps: number[] = [];
    const inner = flaky(2);
    const t = new RetryingTransport(inner, { sleep: async (ms) => void sleeps.push(ms) });
    await expect(t.send(mail)).resolves.toEqual({ messageId: 'ok' });
    expect(inner.calls).toBe(3);
    expect(sleeps).toEqual(RETRY_DELAYS_MS.slice(0, 2));
    expect(RETRY_DELAYS_MS.every((d, i, a) => i === 0 || d > a[i - 1]!)).toBe(true);
  });

  it('gives up after the attempt limit and throws the last error', async () => {
    const inner = flaky(99);
    const t = new RetryingTransport(inner, { attempts: 5, sleep: async () => {} });
    await expect(t.send(mail)).rejects.toThrow('smtp down');
    expect(inner.calls).toBe(5);
  });

  it('does not retry a permanent rejection', async () => {
    const inner = {
      calls: 0,
      async send(): Promise<{ messageId: string }> {
        inner.calls += 1;
        throw Object.assign(new Error('mailbox does not exist'), { responseCode: 550 });
      },
    };
    const t = new RetryingTransport(inner, { sleep: async () => {} });
    await expect(t.send(mail)).rejects.toThrow('mailbox');
    expect(inner.calls).toBe(1);
  });

  it('reports each outcome to the monitor', async () => {
    const monitor = { failure: vi.fn(), success: vi.fn() };
    await new RetryingTransport(flaky(99), { attempts: 2, sleep: async () => {}, monitor })
      .send(mail)
      .catch(() => {});
    expect(monitor.failure).toHaveBeenCalledTimes(1);
    await new RetryingTransport(flaky(0), { sleep: async () => {}, monitor }).send(mail);
    expect(monitor.success).toHaveBeenCalledTimes(1);
  });
});

describe('OutageMonitor', () => {
  it('alerts once after 10 minutes of continuous failure and again only after recovery', () => {
    let now = 0;
    const alert = vi.fn();
    const m = new OutageMonitor({ now: () => now, alert });
    m.failure(new Error('down'));
    now = 9 * 60_000;
    m.failure(new Error('down'));
    expect(alert).not.toHaveBeenCalled();
    now = 10 * 60_000;
    m.failure(new Error('down'));
    m.failure(new Error('down'));
    expect(alert).toHaveBeenCalledTimes(1);
    m.success();
    now = 30 * 60_000;
    m.failure(new Error('down'));
    now = 41 * 60_000;
    m.failure(new Error('down'));
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it('a success resets the window', () => {
    let now = 0;
    const alert = vi.fn();
    const m = new OutageMonitor({ now: () => now, alert });
    m.failure(new Error('x'));
    now = 8 * 60_000;
    m.success();
    now = 12 * 60_000;
    m.failure(new Error('x'));
    expect(alert).not.toHaveBeenCalled();
  });

  it('a throwing alert hook never breaks sending', () => {
    let now = 0;
    const m = new OutageMonitor({
      now: () => now,
      alert: () => {
        throw new Error('hook');
      },
    });
    m.failure(new Error('x'));
    now = 11 * 60_000;
    expect(() => m.failure(new Error('x'))).not.toThrow();
  });
});

describe('suppression', () => {
  const settings = {
    from: 'TV <no-reply@example.org>',
    appName: 'TV',
    appOrigin: 'https://tv.example.org',
    supportEmail: 'help@example.org',
  };

  it('skips non essential mail to a bounced address', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, { ...settings, isSuppressed: async () => true });
    await mailer.sendWelcome({ to: 'gone@example.com' });
    expect(transport.outbox).toHaveLength(0);
  });

  it('still sends security mail to a bounced address', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, { ...settings, isSuppressed: async () => true });
    await mailer.sendPasswordReset({ to: 'gone@example.com', token: 't', minutes: 30 });
    await mailer.sendVerifyEmail({ to: 'gone@example.com', code: '123456', token: 't' });
    expect(transport.outbox).toHaveLength(2);
  });

  it('sends when the suppression lookup fails', async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport, {
      ...settings,
      isSuppressed: async () => {
        throw new Error('db');
      },
    });
    await mailer.sendWelcome({ to: 'a@example.com' });
    expect(transport.outbox).toHaveLength(1);
  });
});
