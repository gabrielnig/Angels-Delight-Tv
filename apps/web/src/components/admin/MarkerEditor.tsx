'use client';

import type { PlayerController } from '@ad/player';
import {
  MAX_CHAPTERS,
  MAX_CHAPTER_TITLE,
  MIN_CHAPTER_GAP_MS,
  MIN_WINDOW_MS,
  parseChapterText,
  parseClock,
  type ChapterInput,
  type MarkerInput,
  type MarkerKind,
} from '@ad/video/markers';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextField, TextArea } from './fields';
import { Banner } from './states';

type Handle = Pick<PlayerController, 'getState' | 'seekTo'> & { play?: () => void };

export interface MarkerSibling {
  id: string;
  title: string;
  label: string;
  markers: MarkerInput[];
}

export interface MarkerEditorProps {
  video: { id: string; title: string; durationSeconds: number };
  initial: { markers: MarkerInput[]; chapters: ChapterInput[] };
  siblings: MarkerSibling[];
  save(payload: {
    markers: MarkerInput[];
    chapters: ChapterInput[];
  }): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>;
  /** Renders the preview player and hands its controller to `onReady`. */
  renderPlayer(onReady: (controller: PlayerController | null) => void): ReactNode;
  /** Shows a toast. Optional so tests do not need a provider. */
  notify?: (tone: 'success' | 'danger', message: string) => void;
}

const KINDS: { kind: MarkerKind; label: string; hint: string }[] = [
  { kind: 'intro', label: 'Intro', hint: 'Starts and ends in the opening' },
  { kind: 'recap', label: 'Recap', hint: 'Optional. Leave empty if not needed' },
  { kind: 'credits', label: 'Credits', hint: 'Ends at the end of the video' },
];

interface Row {
  start: string;
  end: string;
}
interface ChapterRow {
  key: number;
  time: string;
  title: string;
}

export const clock = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

const toRows = (markers: MarkerInput[]): Record<MarkerKind, Row> => {
  const rows: Record<MarkerKind, Row> = {
    intro: { start: '', end: '' },
    recap: { start: '', end: '' },
    credits: { start: '', end: '' },
  };
  for (const m of markers)
    rows[m.kind] = { start: clock(m.startMs), end: m.endMs === null ? '' : clock(m.endMs) };
  return rows;
};

let keySeed = 0;
const toChapterRows = (chapters: ChapterInput[]): ChapterRow[] =>
  chapters.map((c) => ({ key: (keySeed += 1), time: clock(c.startMs), title: c.title }));

const labelOf = (kind: MarkerKind) => KINDS.find((k) => k.kind === kind)!.label;

interface Parsed {
  startMs: number | null;
  endMs: number | null;
}

/** Everything the editor says about the three marker rows: one error per row, plus warnings. */
function checkMarkers(rows: Record<MarkerKind, Row>, durationMs: number) {
  const errors: Partial<Record<MarkerKind, string>> = {};
  const warnings: Partial<Record<MarkerKind, string>> = {};
  const parsed: Partial<Record<MarkerKind, Parsed>> = {};
  const past = `This time is after the end of the video (${clock(durationMs)}). Use a time inside the video.`;
  for (const { kind, label } of KINDS) {
    const row = rows[kind];
    const startText = row.start.trim();
    const endText = row.end.trim();
    if (startText === '' && endText === '') continue;
    const startMs = startText === '' ? null : parseClock(startText);
    const endMs = endText === '' ? null : parseClock(endText);
    if ((startText !== '' && startMs === null) || (endText !== '' && endMs === null)) {
      errors[kind] = 'Use minutes and seconds, like 1:45.';
      continue;
    }
    if (startMs === null) {
      errors[kind] = `Add a start time for ${label.toLowerCase()}.`;
      continue;
    }
    if (kind !== 'credits' && endMs === null) {
      errors[kind] = `Add an end time for ${label.toLowerCase()}.`;
      continue;
    }
    if (startMs >= durationMs || (endMs !== null && endMs > durationMs)) {
      errors[kind] = past;
      continue;
    }
    if (endMs !== null && endMs <= startMs) {
      errors[kind] = 'End must be after start. Change the end or the start.';
      continue;
    }
    if (kind !== 'credits' && endMs !== null && endMs - startMs < MIN_WINDOW_MS) {
      errors[kind] = `${label} must be at least 3 seconds long. Move the end later.`;
      continue;
    }
    parsed[kind] = { startMs, endMs };
    if (kind === 'credits' && startMs < durationMs / 2) {
      warnings[kind] =
        'Credits start before half of the video. Check the time. You can still save.';
    }
  }
  const ordered = (Object.keys(parsed) as MarkerKind[])
    .filter((k) => !errors[k])
    .sort((a, b) => parsed[a]!.startMs! - parsed[b]!.startMs!);
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1]!;
    const current = ordered[i]!;
    const previousEnd = parsed[previous]!.endMs ?? durationMs;
    if (parsed[current]!.startMs! < previousEnd) {
      errors[current] = `${labelOf(current)} overlaps the ${labelOf(previous).toLowerCase()}. Move one of them.`;
    }
  }
  return { errors, warnings, parsed };
}

function checkChapters(rows: ChapterRow[], durationMs: number): string | null {
  if (rows.length > MAX_CHAPTERS) return `A video can have up to ${MAX_CHAPTERS} chapters.`;
  const parsed = rows.map((r) => ({ ms: parseClock(r.time), title: r.title.trim() }));
  if (parsed.some((p) => p.ms === null)) return 'Use minutes and seconds, like 1:45.';
  if (parsed.some((p) => p.title === '')) return 'Every chapter needs a title.';
  if (parsed.some((p) => p.title.length > MAX_CHAPTER_TITLE))
    return `Titles can have up to ${MAX_CHAPTER_TITLE} characters.`;
  const times = parsed.map((p) => p.ms!).sort((a, b) => a - b);
  if (times.length > 0 && times[0] !== 0) return 'First chapter must start at 0:00.';
  for (let i = 1; i < times.length; i += 1) {
    if (times[i]! - times[i - 1]! < MIN_CHAPTER_GAP_MS)
      return 'Chapters need at least 5 seconds between them.';
  }
  if (times.some((t) => t >= durationMs))
    return `A chapter starts after the end of the video (${clock(durationMs)}).`;
  return null;
}

/**
 * Admin editor for skip markers and chapters (M43-S04, S06, screen S119). Times are typed as m:ss, read from the
 * preview player with "Use current time", and checked live. Saving applies to the published video at once.
 */
export function MarkerEditor({
  video,
  initial,
  siblings,
  save,
  renderPlayer,
  notify,
}: MarkerEditorProps) {
  const durationMs = video.durationSeconds * 1000;
  const [rows, setRows] = useState(() => toRows(initial.markers));
  const [chapters, setChapters] = useState(() => toChapterRows(initial.chapters));
  const [baseline, setBaseline] = useState(() => JSON.stringify([rows, chapters.map(({ time, title }) => ({ time, title }))]));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFrom, setCopyFrom] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const handle = useRef<Handle | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const onReady = useCallback((c: PlayerController | null) => {
    handle.current = c;
  }, []);

  const dirty = JSON.stringify([rows, chapters.map(({ time, title }) => ({ time, title }))]) !== baseline;
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const checked = useMemo(() => checkMarkers(rows, durationMs), [rows, durationMs]);
  const chapterError = useMemo(() => checkChapters(chapters, durationMs), [chapters, durationMs]);

  const set = (kind: MarkerKind, side: 'start' | 'end', value: string) => {
    setRows((r) => ({ ...r, [kind]: { ...r[kind], [side]: value } }));
    setServerErrors((e) => ({ ...e, [kind]: '' }));
    setStatus(null);
  };

  const now = (): number | null => {
    const t = handle.current?.getState().currentTime;
    return typeof t === 'number' && Number.isFinite(t) ? Math.round(t * 1000) : null;
  };

  const useCurrent = (kind: MarkerKind, side: 'start' | 'end') => {
    const ms = now();
    if (ms === null) {
      setStatus({ tone: 'danger', text: 'Use current time needs the preview. Reload the preview or type the time.' });
      return;
    }
    set(kind, side, clock(ms));
  };

  const nudge = (kind: MarkerKind, side: 'start' | 'end', delta: number) => {
    const current = parseClock(rows[kind][side]) ?? (side === 'start' ? 0 : durationMs);
    set(kind, side, clock(Math.min(durationMs, Math.max(0, current + delta * 1000))));
  };

  const test = (kind: MarkerKind) => {
    const start = parseClock(rows[kind].start);
    if (start === null) return;
    handle.current?.seekTo(Math.max(0, start / 1000 - 3));
    handle.current?.play?.();
  };

  const addChapter = () => {
    const ms = now() ?? 0;
    setChapters((list) => sortRows([...list, { key: (keySeed += 1), time: clock(ms), title: '' }]));
    setStatus(null);
  };

  const sortRows = (list: ChapterRow[]) =>
    [...list].sort((a, b) => (parseClock(a.time) ?? Infinity) - (parseClock(b.time) ?? Infinity));

  const paste = useMemo(() => parseChapterText(pasteText), [pasteText]);
  const firstPasteError = paste.errors[0];

  const copyMarkers = () => {
    const from = siblings.find((s) => s.id === copyFrom);
    if (!from) return;
    const next = toRows(from.markers);
    setRows(next);
    setServerErrors({});
    const names = from.markers.map((m) => m.kind).join(' and ');
    setCopied(`Copied ${names || 'no markers'} from ${from.label} ${from.title}. Review the times, then save.`);
  };

  const buildPayload = () => {
    const markers: MarkerInput[] = [];
    for (const { kind } of KINDS) {
      const p = checked.parsed[kind];
      if (p && p.startMs !== null) markers.push({ kind, startMs: p.startMs, endMs: p.endMs });
    }
    const list: ChapterInput[] = chapters.map((c) => ({
      startMs: parseClock(c.time) ?? 0,
      title: c.title.trim(),
    }));
    return { markers, chapters: list };
  };

  const doSave = async () => {
    const first = KINDS.find((k) => checked.errors[k.kind]);
    const message = first ? `${first.label}: ${checked.errors[first.kind]}` : chapterError;
    if (message) {
      setProblem(message);
      if (first) root.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
      return;
    }
    setProblem(null);
    setSaving(true);
    setStatus(null);
    try {
      const result = await save(buildPayload());
      if (result.ok) {
        setBaseline(JSON.stringify([rows, chapters.map(({ time, title }) => ({ time, title }))]));
        setServerErrors({});
        setCopied(null);
        setStatus({ tone: 'success', text: 'Saved. Viewers see this now.' });
        notify?.('success', 'Saved. Viewers see this now.');
      } else {
        setServerErrors(result.errors);
      }
    } catch {
      setStatus({ tone: 'danger', text: 'Could not save. Check your connection and try again.' });
      notify?.('danger', 'Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setRows(toRows(initial.markers));
    setChapters(toChapterRows(initial.chapters));
    setServerErrors({});
    setProblem(null);
    setCopied(null);
  };

  return (
    <div ref={root} className="adm-stack adm-markers">
      {renderPlayer(onReady)}

      <p className="adm-markers__help">
        Play or drag the player, then press Use current time beside a field. Test plays from 3
        seconds before the window. Video length {clock(durationMs)}.
      </p>

      {copied ? <Banner tone="info">{copied}</Banner> : null}

      {siblings.length > 0 ? (
        <div className="adm-markers__copy">
          <label className="adm-field__label" htmlFor="copy-from">
            Copy from another episode
          </label>
          <select
            id="copy-from"
            className="adm-input"
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value)}
          >
            <option value="">Choose another video</option>
            {siblings.map((s) => (
              <option key={s.id} value={s.id}>{`${s.label} ${s.title}`}</option>
            ))}
          </select>
          <Button onClick={copyMarkers} disabled={copyFrom === ''}>
            Copy markers
          </Button>
          <p className="adm-field__hint">
            Copies intro, recap and credits. Chapters are not copied. Same series only.
          </p>
        </div>
      ) : null}

      {KINDS.map(({ kind, label, hint }) => {
        const error = serverErrors[kind] || checked.errors[kind];
        return (
          <section key={kind} className="adm-card adm-markers__row" aria-label={label}>
            <h2 className="adm-markers__title">{label}</h2>
            <p className="adm-field__hint">{hint}</p>
            <div className="adm-markers__fields">
              {(['start', 'end'] as const).map((side) => (
                <div key={side} className="adm-markers__side">
                  <TextField
                    label={`${label} ${side}`}
                    value={rows[kind][side]}
                    placeholder="m:ss"
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(e) => set(kind, side, e.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                  <div className="adm-markers__buttons">
                    <Button
                      aria-label={`Use current time for ${label} ${side}`}
                      onClick={() => useCurrent(kind, side)}
                    >
                      Use current time
                    </Button>
                    <Button aria-label={`${label} ${side} minus 1 second`} onClick={() => nudge(kind, side, -1)}>
                      -1 s
                    </Button>
                    <Button aria-label={`${label} ${side} plus 1 second`} onClick={() => nudge(kind, side, 1)}>
                      +1 s
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {error ? (
              <p className="adm-field__error" role="alert">
                {error}
              </p>
            ) : null}
            {!error && checked.warnings[kind] ? (
              <p className="adm-markers__warning" role="status">
                {checked.warnings[kind]}
              </p>
            ) : null}
            <div className="adm-markers__buttons">
              <Button
                aria-label={`Test ${label.toLowerCase()}`}
                disabled={!checked.parsed[kind]}
                onClick={() => test(kind)}
              >
                Test
              </Button>
              <Button
                aria-label={`Clear ${label.toLowerCase()}`}
                onClick={() => {
                  set(kind, 'start', '');
                  set(kind, 'end', '');
                }}
              >
                Clear
              </Button>
            </div>
          </section>
        );
      })}

      <section className="adm-card adm-markers__chapters" aria-label="Chapters">
        <h2 className="adm-markers__title">Chapters</h2>
        <p className="adm-field__hint">{`${chapters.length} of ${MAX_CHAPTERS}`}</p>
        <div className="adm-markers__buttons">
          <Button onClick={() => setPasteOpen(true)}>Paste a list</Button>
          <Button onClick={addChapter} disabled={chapters.length >= MAX_CHAPTERS}>
            Add chapter at current time
          </Button>
        </div>
        {chapters.length === 0 ? (
          <p className="adm-markers__empty">No chapters yet. Add one at the current time.</p>
        ) : (
          <ul className="adm-markers__list">
            {chapters.map((c, i) => (
              <li key={c.key} className="adm-markers__chapter">
                <TextField
                  label={`Chapter ${i + 1} time`}
                  value={c.time}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(e) =>
                    setChapters((l) => l.map((x) => (x.key === c.key ? { ...x, time: e.target.value } : x)))
                  }
                  onBlur={() => setChapters((l) => sortRows(l))}
                />
                <TextField
                  label={`Chapter ${i + 1} title`}
                  value={c.title}
                  maxLength={MAX_CHAPTER_TITLE + 20}
                  onChange={(e) =>
                    setChapters((l) => l.map((x) => (x.key === c.key ? { ...x, title: e.target.value } : x)))
                  }
                />
                <Button
                  aria-label={`Delete chapter ${i + 1}`}
                  onClick={() => setChapters((l) => l.filter((x) => x.key !== c.key))}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
        {chapterError || serverErrors.chapters ? (
          <p className="adm-field__error" role="alert">
            {serverErrors.chapters || chapterError}
          </p>
        ) : null}
      </section>

      <div className="adm-markers__bar">
        <p className="adm-markers__state" role="status">
          {dirty ? 'You have unsaved changes.' : 'Published. Saved changes are live.'}
        </p>
        {problem ? (
          <p className="adm-field__error" role="status">{`Fix this first: ${problem}`}</p>
        ) : null}
        {status ? (
          <p className={status.tone === 'danger' ? 'adm-field__error' : 'adm-markers__ok'} role="status">
            {status.text}
          </p>
        ) : null}
        <Button onClick={discard} disabled={!dirty}>
          Discard changes
        </Button>
        <Button variant="primary" loading={saving} onClick={() => void doSave()}>
          Save changes
        </Button>
      </div>

      <Dialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Paste a chapter list"
        description="One chapter per line, like 0:00 Welcome. Replaces the current list when you add it."
        footer={
          <>
            <Button onClick={() => setPasteOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={Boolean(firstPasteError) || paste.chapters.length === 0}
              onClick={() => {
                setChapters(toChapterRows(paste.chapters));
                setPasteOpen(false);
                setPasteText('');
              }}
            >
              {firstPasteError ? `Fix line ${firstPasteError.line} to continue` : 'Add chapters'}
            </Button>
          </>
        }
      >
        <TextArea
          label="Chapter list"
          rows={8}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <ul className="adm-markers__preview" aria-label="What will be saved">
          {paste.chapters.map((c) => (
            <li key={`${c.startMs}-${c.title}`}>{`${clock(c.startMs)} ${c.title} Ready`}</li>
          ))}
          {paste.errors.map((e) => (
            <li key={e.line} className="adm-field__error">{`Line ${e.line}: ${e.message}`}</li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
