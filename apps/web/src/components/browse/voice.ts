/**
 * Voice search helpers (M45-S10, S134). Browsers send the audio to their own speech service, so the first use asks
 * once. Nothing here stores what is said.
 */
export const VOICE_OK_KEY = 'ad:voice:ok';
export const VOICE_LANGUAGES = ['en-NG', 'en-US'] as const;
/** The search starts this long after the last word, so a short pause does not cut a sentence off. */
export const VOICE_SUBMIT_DELAY_MS = 600;

export interface SpeechResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
export interface SpeechEventLike {
  results: ArrayLike<SpeechResultLike>;
}
export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionConstructor = new () => RecognitionLike;
export interface SpeechWindow {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
}

export function speechConstructor(win: SpeechWindow | undefined): RecognitionConstructor | null {
  if (!win) return null;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

/** Hidden for Kids profiles, under Data saver and in browsers without speech recognition. */
export function voiceAvailable(input: {
  win: SpeechWindow | undefined;
  kids: boolean;
  dataSaver: boolean;
}): boolean {
  return !input.kids && !input.dataSaver && speechConstructor(input.win) !== null;
}

const PERMISSION = 'Microphone access is off. Allow it in your browser settings, or type your search.';

/** Plain words per error code. Null for a stop the viewer asked for. */
export function voiceErrorMessage(code: string): string | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return PERMISSION;
    case 'no-speech':
      return 'We did not hear anything. Tap the microphone and try again.';
    case 'network':
      return 'Voice search needs a connection. Check your data or Wi-Fi, or type your search.';
    case 'audio-capture':
      return 'We could not find a microphone. Check it is connected, or type your search.';
    default:
      return 'Voice search did not work this time. Type your search instead.';
  }
}

export function transcriptOf(event: SpeechEventLike): { text: string; final: boolean } {
  const parts = Array.from(event.results);
  const text = parts
    .map((r) => r[0]?.transcript ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return { text, final: parts.length > 0 && parts[parts.length - 1]!.isFinal };
}

interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readVoiceOk(store: KeyValue | null): boolean {
  try {
    return store?.getItem(VOICE_OK_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveVoiceOk(store: KeyValue | null): void {
  try {
    store?.setItem(VOICE_OK_KEY, '1');
  } catch {
    // Blocked storage: the question is asked again next time.
  }
}
