import { schema, type Database } from '@ad/db';
import { NotFound } from '@ad/shared';
import type { StorageAdapter } from '@ad/storage';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { extractAudioArgs, nodeRunner, type ProcessRunner } from '../encode/ffmpeg';
import { downloadTo, readHead } from '../encode/files';
import { withScratch, type ScratchOptions } from '../encode/scratch';
import { PipelineError } from '../failure';
import { sniffContainer } from '../magic';
import { cuesFromWords } from '../vtt';
import type { Transcriber } from './adapter';
import { alignScript, cleanScript, cuesFromAlignment } from './align';
import { ensureTrack, storeRevision } from './revisions';

export interface CaptionGeneratorDeps {
  db: Database;
  originals: StorageAdapter;
  transcriber: Transcriber;
  scratch: ScratchOptions;
  runner?: ProcessRunner;
  ffmpegPath?: string;
}

export type CaptionProgress = (stage: string, percent: number) => Promise<void>;

/** `caption.generate`: audio out of the source, speech to words, words to a reviewable WebVTT draft. */
export class CaptionGenerator {
  private readonly runner: ProcessRunner;

  constructor(private readonly deps: CaptionGeneratorDeps) {
    this.runner = deps.runner ?? nodeRunner;
  }

  async generate(
    videoId: string,
    mode: 'transcribe' | 'align',
    progress: CaptionProgress,
    signal?: AbortSignal,
  ): Promise<void> {
    const { db, originals } = this.deps;
    const [video] = await db
      .select()
      .from(schema.videos)
      .where(eq(schema.videos.id, videoId))
      .limit(1);
    if (!video) throw new PipelineError('unknown', `video ${videoId} not found`, true);
    if (!video.originalKey) throw new PipelineError('upload_incomplete', 'video has no original');

    let script: string | null = null;
    if (mode === 'align') {
      script = await this.readScript(videoId);
      if (!script)
        throw new PipelineError('caption_failed', 'no script was uploaded for this video', true);
    }

    await progress('Extracting audio', 5);
    const audio = await withScratch(
      this.deps.scratch,
      `captions-${videoId}`,
      video.originalBytes ?? 0,
      async (dir) => {
        const source = join(dir, 'source');
        try {
          await downloadTo(originals, video.originalKey!, source);
        } catch (error) {
          if (error instanceof NotFound)
            throw new PipelineError('upload_incomplete', 'original object missing');
          throw error;
        }
        const container = sniffContainer(await readHead(source, 64));
        if (!container)
          throw new PipelineError(
            'unsupported_format',
            'magic bytes did not match an allowed container',
          );
        const output = join(dir, 'audio.wav');
        const result = await this.runner.run(
          this.deps.ffmpegPath ?? 'ffmpeg',
          extractAudioArgs({ input: source, container, output }),
          { timeoutMs: 15 * 60 * 1000, signal, niceness: 10 },
        );
        if (result.code !== 0)
          throw new PipelineError(
            'caption_failed',
            `audio extraction failed: ${result.stderr.slice(0, 300)}`,
          );
        return new Uint8Array(await readFile(output));
      },
    );

    await progress('Recognising speech', 25);
    const language = video.language || 'en';
    const heard = await this.deps.transcriber.transcribe({ audio, language: 'en', signal });

    await progress('Building captions', 85);
    let cues = cuesFromWords(heard.words);
    let lowConfidenceCues: number[] = [];
    let source: 'whisper' | 'aligned' = 'whisper';
    if (script && heard.words.length > 0) {
      const aligned = cuesFromAlignment(alignScript(cleanScript(script), heard.words));
      cues = aligned.cues;
      lowConfidenceCues = aligned.lowConfidenceStarts;
      source = 'aligned';
    }

    const track = await ensureTrack(db, videoId, language);
    await storeRevision(db, originals, track, {
      cues,
      source,
      model: heard.model,
      reviewNote: heard.words.length === 0 ? 'No speech detected' : null,
      lowConfidenceCues,
    });
    await progress('Done', 100);
  }

  private async readScript(videoId: string): Promise<string | null> {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of await this.deps.originals.get(`scripts/${videoId}.txt`))
        chunks.push(chunk as Buffer);
      return Buffer.concat(chunks).toString('utf8');
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }
}
