import type { Translator } from './types';

/** Test double. Rejected in production by the env check. */
export class FakeTranslator implements Translator {
  readonly name = 'fake';
  supports() {
    return true;
  }
  async translate(req: { texts: string[]; target: string }) {
    return {
      texts: req.texts.map((t) => `[${req.target}] ${t}`),
      model: 'fake',
      chars: req.texts.reduce((n, s) => n + s.length, 0),
    };
  }
}
