import { describe, expect, it } from 'vitest';
import { createUploader } from './engine';
import { createFakeTransport, fakeFile } from './fake-transport';
import { TransportError } from './types';

function failing(error: Error) {
  const transport = createFakeTransport();
  transport.start = async () => {
    throw error;
  };
  const uploader = createUploader({ transport, sleep: async () => {} });
  return uploader;
}

async function lane(error: Error) {
  const uploader = failing(error);
  uploader.add(fakeFile('copy_7B7CA63F.mov', 1024));
  await uploader.idle();
  return uploader.getLanes()[0]!;
}

describe('uploader engine: why a start failed', () => {
  it('shows the server field message for a 4xx and records the status', async () => {
    const result = await lane(
      new TransportError('Server answered 422', 'rejected', {
        status: 422,
        detail: 'This file is larger than the 5 GB limit.',
      }),
    );
    expect(result.status).toBe('failed');
    expect(result.message).toBe(
      'This file is larger than the 5 GB limit. Remove it and choose another file.',
    );
    expect(result.errorStatus).toBe(422);
    expect(JSON.stringify(result)).not.toContain('Server answered');
  });

  it('asks to sign in again for 401 and 403', async () => {
    for (const status of [401, 403]) {
      const result = await lane(new TransportError('x', 'rejected', { status }));
      expect(result.message).toBe('Your session ended. Sign in again, then press Retry.');
      expect(result.errorStatus).toBe(status);
    }
  });

  it('keeps the retry text for a 5xx and for a network error', async () => {
    const server = await lane(new TransportError('x', 'server', { status: 502 }));
    expect(server.message).toBe('Upload failed before it began. Try again.');
    expect(server.errorStatus).toBe(502);
    const network = await lane(new TransportError('x', 'network'));
    expect(network.message).toBe('Upload failed before it began. Try again.');
    expect(network.errorStatus).toBeUndefined();
  });

  it('falls back to the retry text for a 4xx with no readable message', async () => {
    const result = await lane(new TransportError('x', 'rejected', { status: 400 }));
    expect(result.message).toBe('Upload failed before it began. Try again.');
  });
});
