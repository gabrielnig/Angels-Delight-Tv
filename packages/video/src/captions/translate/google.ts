import { PipelineError } from '../../failure';
import type { TranslateRequest, TranslateResult, Translator } from './types';

const CODES: Record<string, string> = { en: 'en', yo: 'yo', ig: 'ig', ha: 'ha' };
const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);

export interface GoogleOptions {
  apiKey: string;
  fetch?: typeof fetch;
  endpoint?: string;
}

export class GoogleTranslator implements Translator {
  readonly name = 'google';
  constructor(private readonly o: GoogleOptions) {}

  supports(source: string, target: string): boolean {
    return source in CODES && target in CODES;
  }

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const f = this.o.fetch ?? fetch;
    const url = this.o.endpoint ?? 'https://translation.googleapis.com/language/translate/v2';
    let res: Response;
    try {
      res = await f(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.o.apiKey },
        body: JSON.stringify({ q: req.texts, source: CODES[req.source], target: CODES[req.target], format: 'text' }),
      });
    } catch (e) {
      const msg = String((e as Error).message ?? e).split(this.o.apiKey).join('[key]');
      throw new PipelineError('caption_service_unavailable', `translate request failed: ${msg}`, false);
    }
    if (!res.ok) {
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
      throw new PipelineError('caption_service_unavailable', `translate provider status ${res.status}`, permanent);
    }
    const json = (await res.json()) as { data?: { translations?: { translatedText: string }[] } };
    const list = json.data?.translations ?? [];
    return {
      texts: list.map((x) => decode(x.translatedText).normalize('NFC')),
      model: 'google-nmt',
      chars: req.texts.reduce((n, s) => n + s.length, 0),
    };
  }
}
