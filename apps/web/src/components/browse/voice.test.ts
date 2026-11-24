import { describe, expect, it } from 'vitest';
import {
  VOICE_LANGUAGES,
  VOICE_OK_KEY,
  VOICE_SUBMIT_DELAY_MS,
  readVoiceOk,
  saveVoiceOk,
  speechConstructor,
  transcriptOf,
  voiceAvailable,
  voiceErrorMessage,
} from './voice';

class Fake {}

describe('voice search detection (M45-S10)', () => {
  it('finds the standard and the prefixed constructor', () => {
    expect(speechConstructor({ SpeechRecognition: Fake } as never)).toBe(Fake);
    expect(speechConstructor({ webkitSpeechRecognition: Fake } as never)).toBe(Fake);
    expect(speechConstructor({ SpeechRecognition: Fake, webkitSpeechRecognition: class {} } as never)).toBe(Fake);
  });

  it('is unsupported without a constructor and outside a browser', () => {
    expect(speechConstructor({} as never)).toBeNull();
    expect(speechConstructor(undefined)).toBeNull();
  });

  it('is available only when supported, not Kids and not Data saver', () => {
    const win = { webkitSpeechRecognition: Fake } as never;
    expect(voiceAvailable({ win, kids: false, dataSaver: false })).toBe(true);
    expect(voiceAvailable({ win, kids: true, dataSaver: false })).toBe(false);
    expect(voiceAvailable({ win, kids: false, dataSaver: true })).toBe(false);
    expect(voiceAvailable({ win: {} as never, kids: false, dataSaver: false })).toBe(false);
  });
});

describe('voice search copy and rules', () => {
  it('tries Nigerian English first, then US English, and waits 600 ms after speech', () => {
    expect(VOICE_LANGUAGES).toEqual(['en-NG', 'en-US']);
    expect(VOICE_SUBMIT_DELAY_MS).toBe(600);
  });

  it('maps each error to plain words and says nothing for a stop by the viewer', () => {
    expect(voiceErrorMessage('not-allowed')).toBe(
      'Microphone access is off. Allow it in your browser settings, or type your search.',
    );
    expect(voiceErrorMessage('service-not-allowed')).toBe(voiceErrorMessage('not-allowed'));
    expect(voiceErrorMessage('no-speech')).toBe('We did not hear anything. Tap the microphone and try again.');
    expect(voiceErrorMessage('network')).toBe(
      'Voice search needs a connection. Check your data or Wi-Fi, or type your search.',
    );
    expect(voiceErrorMessage('audio-capture')).toMatch(/type your search/);
    expect(voiceErrorMessage('aborted')).toBeNull();
  });

  it('never uses dashes or a promise about what the browser vendor does', () => {
    for (const code of ['not-allowed', 'no-speech', 'network', 'other']) {
      expect(voiceErrorMessage(code)).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
    }
  });

  it('joins the transcripts of a result list and says if the last one is final', () => {
    const results = [
      Object.assign([{ transcript: 'how to ' }], { isFinal: true }),
      Object.assign([{ transcript: 'save money' }], { isFinal: false }),
    ];
    expect(transcriptOf({ results } as never)).toEqual({ text: 'how to save money', final: false });
    results[1] = Object.assign([{ transcript: 'save money' }], { isFinal: true });
    expect(transcriptOf({ results } as never)).toEqual({ text: 'how to save money', final: true });
  });
});

describe('first use consent', () => {
  const store = () => {
    const data: Record<string, string> = {};
    return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
  };

  it('remembers Continue under ad:voice:ok', () => {
    const s = store();
    expect(VOICE_OK_KEY).toBe('ad:voice:ok');
    expect(readVoiceOk(s)).toBe(false);
    saveVoiceOk(s);
    expect(s.data[VOICE_OK_KEY]).toBe('1');
    expect(readVoiceOk(s)).toBe(true);
  });

  it('survives blocked storage by asking again', () => {
    const blocked = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(readVoiceOk(blocked)).toBe(false);
    expect(() => saveVoiceOk(blocked)).not.toThrow();
    expect(readVoiceOk(null)).toBe(false);
  });
});
