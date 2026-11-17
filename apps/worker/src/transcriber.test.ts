import { HttpWhisperClient } from '@ad/video';
import { describe, expect, it } from 'vitest';
import { chooseTranscriber } from './transcriber';

describe('chooseTranscriber', () => {
  it('uses the scripted fake when WHISPER_FAKE is on, even if a url is set', async () => {
    const result = await chooseTranscriber({
      WHISPER_FAKE: true,
      WHISPER_URL: 'http://whisper:8000',
    }).transcribe({ audio: new Uint8Array(4), language: 'en' });
    expect(result.model).toBe('fake');
    expect(result.words.length).toBeGreaterThan(5);
    expect(result.words.every((w, i, all) => i === 0 || w.startMs >= all[i - 1]!.endMs)).toBe(true);
  });

  it('uses the whisper service when only a url is set', () => {
    expect(
      chooseTranscriber({ WHISPER_FAKE: false, WHISPER_URL: 'http://whisper:8000' }),
    ).toBeInstanceOf(HttpWhisperClient);
  });

  it('fails permanently with a clear message when nothing is configured', async () => {
    await expect(
      chooseTranscriber({ WHISPER_FAKE: false }).transcribe({
        audio: new Uint8Array(1),
        language: 'en',
      }),
    ).rejects.toMatchObject({
      code: 'caption_failed',
      message: expect.stringContaining('WHISPER_URL'),
    });
  });
});
