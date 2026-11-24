import { schema, type Database } from '@ad/db';
import { localeInfo } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { and, eq } from 'drizzle-orm';
import { PipelineError } from '../failure';
import { MAX_LINE_CHARS, parseVtt, sanitizeCueText, type Cue } from '../vtt';
import { ensureTrack, storeRevision } from './revisions';
import { applyGlossary, parseGlossary } from './translate/glossary';
import { translateTexts } from './translate/batch';
import type { Translator } from './translate/types';

export interface CaptionTranslatorDeps {
  db: Database;
  originals: StorageAdapter;
  translator: Translator;
  /** The `translation.glossary` setting. Terms in it are kept as written. */
  glossary?: () => Promise<string>;
  /** TRANSLATE_MAX_CHARS_PER_JOB. */
  maxChars?: number;
}

export type TranslateProgress = (stage: string, percent: number) => Promise<void>;

/**
 * Two lines of at most 42 characters where the words allow it. A word longer than a line stays whole and
 * validateCues reports it in review, so nothing is cut silently.
 */
export function reflowCueText(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= MAX_LINE_CHARS || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 2) return [lines[0], lines.slice(1).join(' ')].join('\n');
  if (lines.length === 2) return lines.join('\n');
  return lines[0] ?? '';
}

/** `caption.translate`: the approved spoken language revision becomes a reviewable draft in another language. */
export class CaptionTranslator {
  constructor(private readonly deps: CaptionTranslatorDeps) {}

  async translate(
    videoId: string,
    targetLanguage: string,
    options: { sourceCaptionId?: string },
    progress: TranslateProgress,
  ): Promise<void> {
    const { db, originals, translator } = this.deps;
    const target = localeInfo(targetLanguage);
    if (!target) throw new PipelineError('caption_failed', `unknown language ${targetLanguage}`, true);

    const [video] = await db.select().from(schema.videos).where(eq(schema.videos.id, videoId)).limit(1);
    if (!video) throw new PipelineError('unknown', `video ${videoId} not found`, true);
    const spoken = video.language || 'en';
    if (spoken === target.code)
      throw new PipelineError('caption_failed', 'The captions are already in this language.', true);

    await progress('Reading the approved captions', 5);
    const [sourceTrack] = await db
      .select()
      .from(schema.captionTracks)
      .where(and(eq(schema.captionTracks.videoId, videoId), eq(schema.captionTracks.language, spoken)))
      .limit(1);
    const sourceId = options.sourceCaptionId ?? sourceTrack?.approvedCaptionId ?? null;
    const [source] = sourceId
      ? await db.select().from(schema.captions).where(eq(schema.captions.id, sourceId)).limit(1)
      : [];
    if (!sourceTrack || !source || source.trackId !== sourceTrack.id || source.status !== 'approved') {
      throw new PipelineError(
        'caption_failed',
        'Approve the captions in the spoken language first. Translations start from an approved track.',
        true,
      );
    }

    const body = await this.read(source.storageKey);
    const cues = parseVtt(body);
    if (cues.length === 0 || cues.every((c) => c.text.trim() === '')) {
      throw new PipelineError('caption_failed', 'There is no speech in the source captions, so there is nothing to translate.', true);
    }

    await progress('Translating', 25);
    const glossary = applyGlossary(parseGlossary((await this.deps.glossary?.()) ?? ''), cues.map((c) => c.text));
    const done = await translateTexts(translator, glossary.texts, {
      source: spoken,
      target: target.code,
      maxChars: this.deps.maxChars,
    });

    await progress('Building captions', 85);
    const translated: Cue[] = glossary.restore(done.texts).map((text, i) => ({
      startMs: cues[i]!.startMs,
      endMs: cues[i]!.endMs,
      text: reflowCueText(sanitizeCueText(text.normalize('NFC'))),
    }));

    const track = await ensureTrack(db, videoId, target.code, target.endonym, {
      kind: 'subtitles',
      published: false,
      isDefault: false,
    });
    await storeRevision(db, originals, track, {
      cues: translated,
      source: 'translation',
      model: done.model || translator.name,
      sourceCaptionId: source.id,
      sourceSha256: Buffer.from(source.sha256),
    });
    await progress('Done', 100);
  }

  private async read(key: string): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of await this.deps.originals.get(key)) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8');
  }
}
