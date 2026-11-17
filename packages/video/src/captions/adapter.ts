import { PipelineError } from '../failure';
import type { TimedWord } from '../vtt';

export interface TranscribeRequest {
  /** Mono 16 kHz WAV bytes. The service never gets storage credentials or urls. */
  audio: Uint8Array;
  language: string;
  signal?: AbortSignal;
}

export interface TranscribeResult {
  language: string;
  durationMs: number;
  model: string;
  words: TimedWord[];
}

/** The seam between the worker and whatever recognises speech: the faster-whisper service, a fake, or a paid API later. */
export interface Transcriber {
  transcribe(request: TranscribeRequest): Promise<TranscribeResult>;
}

export interface HttpWhisperOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** ARCHITECTURE section 9: long, the job expiry is larger. Default 20 minutes. */
  timeoutMs?: number;
}

interface WhisperWord {
  word?: unknown;
  start?: unknown;
  end?: unknown;
  probability?: unknown;
}

export class HttpWhisperClient implements Transcriber {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: HttpWhisperOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;
  }

  async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    const url = `${this.baseUrl}/transcribe?language=${encodeURIComponent(request.language)}`;
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'audio/wav' },
        body: request.audio as unknown as RequestInit['body'],
        signal,
      });
    } catch (error) {
      throw new PipelineError(
        'caption_service_unavailable',
        `whisper request failed: ${(error as Error).message}`,
      );
    }

    if (response.status === 400 || response.status === 415 || response.status === 413) {
      throw new PipelineError(
        'caption_failed',
        `whisper rejected the audio (${response.status})`,
        true,
      );
    }
    if (!response.ok) {
      throw new PipelineError('caption_service_unavailable', `whisper answered ${response.status}`);
    }

    let body: { language?: unknown; duration?: unknown; model?: unknown; words?: unknown };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      throw new PipelineError('caption_failed', 'whisper answer was not json');
    }
    if (!Array.isArray(body.words) || typeof body.duration !== 'number') {
      throw new PipelineError('caption_failed', 'whisper answer had an unexpected shape');
    }
    const words: TimedWord[] = [];
    for (const raw of body.words as WhisperWord[]) {
      if (
        typeof raw.word !== 'string' ||
        typeof raw.start !== 'number' ||
        typeof raw.end !== 'number'
      ) {
        throw new PipelineError('caption_failed', 'whisper returned a malformed word');
      }
      const word = raw.word.trim();
      if (word === '') continue;
      words.push({
        word,
        startMs: Math.round(raw.start * 1000),
        endMs: Math.round(raw.end * 1000),
        ...(typeof raw.probability === 'number' ? { confidence: raw.probability } : {}),
      });
    }
    return {
      language: typeof body.language === 'string' ? body.language : request.language,
      durationMs: Math.round(body.duration * 1000),
      model: typeof body.model === 'string' ? body.model : 'unknown',
      words,
    };
  }
}

/** Scripted transcriber for tests. */
export class FakeTranscriber implements Transcriber {
  requests: TranscribeRequest[] = [];
  failWith: Error | null = null;

  constructor(
    private readonly script: { words: TimedWord[]; durationMs?: number; model?: string } = {
      words: [],
    },
  ) {}

  async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    this.requests.push(request);
    if (this.failWith) throw this.failWith;
    const last = this.script.words.at(-1);
    return {
      language: request.language,
      durationMs: this.script.durationMs ?? (last ? last.endMs + 500 : 1000),
      model: this.script.model ?? 'fake',
      words: this.script.words,
    };
  }
}
