import { describe, expect, it } from 'vitest';
import { PipelineError } from '../failure';
import { FakeTranscriber, HttpWhisperClient } from './adapter';

const audio = new Uint8Array([1, 2, 3, 4]);

function client(fetchImpl: typeof fetch) {
  return new HttpWhisperClient({
    baseUrl: 'http://whisper:8000/',
    fetch: fetchImpl,
    timeoutMs: 1000,
  });
}

describe('HttpWhisperClient', () => {
  it('posts the audio bytes with the language and returns timed words', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const result = await client(async (url, init) => {
      seen = { url: String(url), init: init! };
      return Response.json({
        language: 'en',
        duration: 4.5,
        model: 'small.en',
        words: [{ word: 'Hello', start: 0.1, end: 0.5, probability: 0.98 }],
      });
    }).transcribe({ audio, language: 'en' });

    expect(seen?.url).toBe('http://whisper:8000/transcribe?language=en');
    expect(seen?.init.method).toBe('POST');
    expect((seen?.init.headers as Record<string, string>)['content-type']).toBe('audio/wav');
    expect(result).toEqual({
      language: 'en',
      durationMs: 4500,
      model: 'small.en',
      words: [{ word: 'Hello', startMs: 100, endMs: 500, confidence: 0.98 }],
    });
  });

  it('returns no words (not an error) when the service heard no speech', async () => {
    const result = await client(async () =>
      Response.json({ language: 'en', duration: 3, model: 'm', words: [] }),
    ).transcribe({ audio, language: 'en' });
    expect(result.words).toEqual([]);
  });

  it('maps a busy or failing service to a retryable caption_service_unavailable', async () => {
    for (const status of [429, 502, 503, 500]) {
      const error = await client(async () => new Response('no', { status }))
        .transcribe({ audio, language: 'en' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PipelineError);
      expect(error).toMatchObject({ code: 'caption_service_unavailable', permanent: false });
    }
  });

  it('maps a network failure to a retryable error', async () => {
    const error = await client(async () => {
      throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    })
      .transcribe({ audio, language: 'en' })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'caption_service_unavailable', permanent: false });
  });

  it('treats a 400 as unusable audio, which retrying cannot fix', async () => {
    const error = await client(async () => new Response('bad audio', { status: 400 }))
      .transcribe({ audio, language: 'en' })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'caption_failed', permanent: true });
  });

  it('rejects a malformed answer', async () => {
    const error = await client(async () => Response.json({ nope: true }))
      .transcribe({ audio, language: 'en' })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'caption_failed' });
  });
});

describe('HttpWhisperClient language handling (M46)', () => {
  it('passes auto through and reads the detected language and its probability', async () => {
    let url = '';
    const result = await client(async (u) => {
      url = String(u);
      return Response.json({ language: 'yo', language_probability: 0.91, duration: 2, model: 'medium', words: [] });
    }).transcribe({ audio, language: 'auto' });
    expect(url).toBe('http://whisper:8000/transcribe?language=auto');
    expect(result).toMatchObject({ language: 'yo', languageProbability: 0.91 });
  });

  it('leaves languageProbability out when the service does not send it', async () => {
    const result = await client(async () => Response.json({ language: 'en', duration: 1, model: 'm', words: [] })).transcribe({ audio, language: 'en' });
    expect('languageProbability' in result).toBe(false);
  });

  it('a 422 is the English only message and never retried', async () => {
    await expect(
      client(async () => Response.json({ error: 'x' }, { status: 422 })).transcribe({ audio, language: 'yo' }),
    ).rejects.toMatchObject({
      permanent: true,
      message: expect.stringMatching(/only recognises English/),
    });
  });
});

describe('FakeTranscriber', () => {
  it('returns scripted words and records what it was asked', async () => {
    const fake = new FakeTranscriber({ words: [{ word: 'Hi', startMs: 0, endMs: 400 }] });
    const result = await fake.transcribe({ audio, language: 'en' });
    expect(result.words).toHaveLength(1);
    expect(fake.requests).toHaveLength(1);
  });
});
