'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreviewClock } from './usePreviewClock';
import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import { formatDateTime } from '@/lib/admin/format';
import {
  WARNING_LABELS,
  changesSinceApproval,
  createHistory,
  findActiveCue,
  findReplace,
  formatTimestamp,
  mergeCues,
  parseTimestamp,
  parseVtt,
  push,
  redo,
  splitCue,
  toVtt,
  undo,
  validateCues,
} from '@/lib/admin/cues';
import type { Cue, CueWarning, History } from '@/lib/admin/cues';
import type { CaptionResult, SaveResult } from '@/lib/data/admin/caption-commands';
import type { CaptionTrack, VideoRecord } from '@/lib/data/admin/types';
import { Badge, CaptionBadge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog, Dialog } from './Dialog';
import { Checkbox, TextField } from './fields';
import { Icon } from './Icon';
import { ProgressBar } from './ProgressBar';
import { Banner } from './states';
import { useToast } from './Toast';

export interface ReviewActions {
  save(cues: Cue[]): Promise<SaveResult>;
  approve(): Promise<CaptionResult>;
  regenerate(): Promise<CaptionResult>;
  upload(cues: Cue[]): Promise<CaptionResult>;
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

let idCounter = 0;
const newId = () => `cue_new_${Date.now().toString(36)}_${++idCounter}`;

interface Props {
  video: VideoRecord;
  track: CaptionTrack | null;
  role: AccountRole;
  actions: ReviewActions;
  /** True when staff preview sessions are available for this video (real data and finished encoding). */
  preview?: boolean;
}

export function CaptionReview({ video, track, role, actions, preview = false }: Props) {
  const router = useRouter();
  const toast = useToast();
  const canEdit = can(role, 'caption.review');
  const [history, setHistory] = useState<History<Cue[]>>(() => createHistory(track?.cues ?? []));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [changes, setChanges] = useState(() =>
    track?.approvedCues ? changesSinceApproval(track.approvedCues, track.cues) : 0,
  );
  const [follow, setFollow] = useState(true);
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<Cue[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carets = useRef<Record<string, number>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const cues = history.present;
  const durationMs = Math.max(video.durationSeconds * 1000, (cues.at(-1)?.end ?? 0) + 1000);
  const clock = usePreviewClock({
    videoId: video.id,
    durationMs,
    enabled: preview && video.status === 'ready',
    appOrigin: typeof window === 'undefined' ? '' : window.location.origin,
  });
  const active = findActiveCue(cues, clock.ms);
  const warnings = useMemo(() => validateCues(cues), [cues]);
  const warningTotals = useMemo(() => {
    const totals: Record<CueWarning, number> = { overlap: 0, too_long: 0, empty: 0, bad_timing: 0 };
    for (const list of warnings.values()) for (const w of list) totals[w]++;
    return totals;
  }, [warnings]);
  const warningCount = [...warnings.values()].reduce((n, list) => n + list.length, 0);

  // ---- autosave ----
  const flush = useCallback(
    async (next: Cue[]) => {
      setSaveState('saving');
      try {
        const result = await actions.save(next);
        if (result.ok) {
          setChanges(result.changesSinceApproval);
          setSavedAt(Date.now());
          setSaveState('saved');
        } else setSaveState('error');
      } catch {
        setSaveState('error');
      }
    },
    [actions],
  );
  const schedule = (next: Cue[]) => {
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(next), 800);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  // Poll while captions are being made.
  useEffect(() => {
    if (track?.state !== 'generating') return;
    const poll = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(poll);
  }, [track?.state, router]);

  // ---- editing ----
  const commit = (next: Cue[], coalesceKey?: string) => {
    const now = Date.now();
    const same =
      coalesceKey && lastEdit.current?.key === coalesceKey && now - lastEdit.current.at < 1000;
    lastEdit.current = coalesceKey ? { key: coalesceKey, at: now } : null;
    setHistory((h) => (same ? { ...h, present: next } : push(h, next)));
    schedule(next);
  };
  const patch = (id: string, change: Partial<Cue>, key: string) =>
    commit(
      cues.map((c) => (c.id === id ? { ...c, ...change } : c)),
      `${id}:${key}`,
    );

  const doUndo = () => {
    const next = undo(history);
    setHistory(next);
    lastEdit.current = null;
    schedule(next.present);
  };
  const doRedo = () => {
    const next = redo(history);
    setHistory(next);
    lastEdit.current = null;
    schedule(next.present);
  };

  const onSplit = (cue: Cue) => {
    const at = carets.current[cue.id] ?? Math.floor(cue.text.length / 2);
    const parts = splitCue(cue, at, newId);
    if (parts.length === 1) {
      toast.show({ message: 'Click in the text where you want to split, then press Split.' });
      return;
    }
    const index = cues.findIndex((c) => c.id === cue.id);
    commit([...cues.slice(0, index), ...parts, ...cues.slice(index + 1)]);
  };
  const onMerge = (index: number) => {
    const a = cues[index];
    const b = cues[index + 1];
    if (!a || !b) return;
    commit([...cues.slice(0, index), mergeCues(a, b), ...cues.slice(index + 2)]);
  };

  const matches = useMemo(
    () => findReplace(cues, find, replaceWith, { matchCase }).count,
    [cues, find, replaceWith, matchCase],
  );

  // Keep the current cue in view while the video plays.
  useEffect(() => {
    if (!follow || active < 0) return;
    const row = listRef.current?.children[active] as HTMLElement | undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row?.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [active, follow]);

  async function approve() {
    setApproving(true);
    try {
      if (saveState !== 'saved') {
        if (timer.current) clearTimeout(timer.current);
        const saved = await actions.save(cues);
        if (!saved.ok) {
          setSaveState('error');
          return;
        }
      }
      const result = await actions.approve();
      toast.show(
        result.ok
          ? { tone: 'success', message: 'Captions approved.' }
          : { tone: 'danger', message: result.error },
      );
      router.refresh();
    } catch {
      toast.show({ tone: 'danger', message: 'Could not approve. Your edits are kept. Try again.' });
    } finally {
      setApproving(false);
    }
  }

  function download() {
    const blob = new Blob([toVtt(cues)], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${video.title.replace(/[^\w]+/g, '-').toLowerCase()}.vtt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File) {
    setUploadError(null);
    const result = parseVtt(await file.text(), (n) => `cue_up_${n}`);
    if (!result.ok) setUploadError(result.error);
    else setPendingUpload(result.cues);
  }

  // ---- states without a cue list ----
  if (!track) {
    return (
      <div className="adm-card adm-stack">
        <h2 className="adm-h3">No captions yet</h2>
        <p className="adm-muted" style={{ margin: 0 }}>
          Make captions automatically, or upload a caption file.
        </p>
        <div className="adm-row">
          <Button
            variant="primary"
            disabled={!canEdit}
            onClick={async () => {
              await actions.regenerate();
              router.refresh();
            }}
          >
            Generate captions
          </Button>
        </div>
      </div>
    );
  }
  if (track.state === 'generating') {
    return (
      <div className="adm-card adm-stack" role="status">
        <div className="adm-row">
          <CaptionBadge state="generating" />
          <strong>
            Making captions. Step {track.progress?.step} of {track.progress?.of}.
          </strong>
        </div>
        <ProgressBar
          label="Making captions"
          value={((track.progress?.step ?? 1) / (track.progress?.of ?? 5)) * 100}
        />
        <p className="adm-muted" style={{ margin: 0 }}>
          About {track.progress?.minutesLeft} min left. You can leave this page.
        </p>
      </div>
    );
  }
  if (track.state === 'failed') {
    return (
      <div className="adm-stack">
        <Banner tone="danger">
          <strong>Captions could not be made for this video.</strong> {track.failure} Upload a
          caption file or try again.
        </Banner>
        <div className="adm-row">
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".vtt,text/vtt"
            aria-label="Choose a caption file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = '';
            }}
          />
          <Button icon="upload" onClick={() => fileInput.current?.click()}>
            Upload captions
          </Button>
          <Button
            variant="primary"
            icon="retry"
            onClick={async () => {
              await actions.regenerate();
              router.refresh();
            }}
          >
            Try again
          </Button>
        </div>
        {uploadError ? <Banner tone="danger">{uploadError}</Banner> : null}
        <ConfirmDialog
          open={pendingUpload !== null}
          title="Use this caption file?"
          consequence={`${pendingUpload?.length ?? 0} cues will be loaded for review.`}
          confirmLabel="Use file"
          onClose={() => setPendingUpload(null)}
          onConfirm={async () => {
            if (pendingUpload) await actions.upload(pendingUpload);
            setPendingUpload(null);
            router.refresh();
          }}
        />
      </div>
    );
  }

  const approved = track.state === 'approved';
  const caption = active >= 0 ? cues[active]!.text : '';
  const saveText =
    saveState === 'saving'
      ? 'Saving'
      : saveState === 'dirty'
        ? 'Unsaved changes'
        : saveState === 'error'
          ? 'Not saved'
          : savedAt
            ? 'Saved just now'
            : 'All changes saved';

  return (
    <div className="adm-stack">
      <div className="adm-toolbar" role="toolbar" aria-label="Caption tools">
        <Button icon="search" onClick={() => setFindOpen(true)}>
          Find and replace
        </Button>
        <Button icon="undo" disabled={history.past.length === 0 || !canEdit} onClick={doUndo}>
          Undo
        </Button>
        <Button icon="redo" disabled={history.future.length === 0 || !canEdit} onClick={doRedo}>
          Redo
        </Button>
        <Button icon="retry" disabled={!canEdit} onClick={() => setRegenOpen(true)}>
          Regenerate
        </Button>
        <Button icon="download" onClick={download}>
          Download
        </Button>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept=".vtt,text/vtt"
          aria-label="Choose a caption file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
        <Button icon="upload" disabled={!canEdit} onClick={() => fileInput.current?.click()}>
          Upload
        </Button>
        <span className="adm-top__space" />
        <span className="adm-muted" role="status" aria-live="polite">
          {saveText}
        </span>
        {saveState === 'error' ? <Button onClick={() => void flush(cues)}>Retry</Button> : null}
        <Button
          variant="primary"
          loading={approving}
          disabledReason={!canEdit ? 'Your role cannot approve captions.' : undefined}
          onClick={approve}
        >
          {approved && changes > 0 ? 'Approve changes' : approved ? 'Approved' : 'Approve captions'}
        </Button>
      </div>

      {saveState === 'error' ? (
        <Banner tone="danger" action={<Button onClick={() => void flush(cues)}>Retry</Button>}>
          <strong>We could not save your last change.</strong> Your edits are kept on this page.
          Check your connection and try again.
        </Banner>
      ) : null}
      {uploadError ? <Banner tone="danger">{uploadError}</Banner> : null}
      {approved && track.approvedBy ? (
        <Banner tone={changes > 0 ? 'warning' : 'success'}>
          Approved by {track.approvedBy}, {formatDateTime(track.approvedAt!)}.{' '}
          {changes > 0 ? (
            <>
              <strong>
                You changed {changes} {changes === 1 ? 'cue' : 'cues'} after approval.
              </strong>{' '}
              Viewers still see the approved version until you approve again.
            </>
          ) : null}
        </Banner>
      ) : null}

      <div className="adm-review">
        <div className="adm-review__video">
          <div className="adm-sim" aria-label="Video preview">
            {clock.status !== 'off' && clock.status !== 'unavailable' ? (
              <video
                ref={clock.videoRef}
                className="adm-sim__video"
                playsInline
                preload="metadata"
              />
            ) : null}
            {clock.status === 'unavailable' ? (
              <p className="adm-sim__note">
                The video preview could not start. Timing still works.
              </p>
            ) : null}
            <button
              type="button"
              className="adm-sim__play"
              onClick={clock.toggle}
              aria-label={clock.playing ? 'Pause' : 'Play'}
            >
              <Icon name={clock.playing ? 'pause' : 'play'} size={32} />
            </button>
            {caption ? (
              <p className="adm-sim__caption" aria-live="off">
                {caption}
              </p>
            ) : null}
          </div>
          <div className="adm-sim__bar">
            <input
              type="range"
              min={0}
              max={durationMs}
              step={100}
              value={clock.ms}
              aria-label="Seek"
              aria-valuetext={`${formatTimestamp(clock.ms).slice(0, 8)} of ${formatTimestamp(durationMs).slice(0, 8)}`}
              onChange={(e) => clock.seek(Number(e.target.value))}
            />
            <span className="adm-num">
              {formatTimestamp(clock.ms).slice(0, 8)} / {formatTimestamp(durationMs).slice(0, 8)}
            </span>
          </div>
          <div className="adm-row">
            <Badge
              tone={warningCount ? 'warning' : 'success'}
              icon={warningCount ? 'alert' : 'check'}
            >
              {warningCount
                ? `${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'} to check`
                : 'No warnings'}
            </Badge>
            {(Object.keys(warningTotals) as CueWarning[])
              .filter((w) => warningTotals[w] > 0)
              .map((w) => (
                <Badge key={w} tone="neutral">
                  {warningTotals[w]} {WARNING_LABELS[w].toLowerCase()}
                </Badge>
              ))}
          </div>
          {warningCount ? (
            <p className="adm-muted" style={{ margin: 0 }}>
              Approving is allowed with warnings. Fixing them first makes captions easier to read.
            </p>
          ) : null}
        </div>

        <section className="adm-review__cues" aria-label="Cues">
          <div className="adm-row" style={{ justifyContent: 'space-between' }}>
            <span className="adm-muted">{cues.length} cues</span>
            <Checkbox
              label="Current cue follows the video"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
            />
          </div>
          <ol className="adm-cuelist" ref={listRef}>
            {cues.map((cue, index) => {
              const list = warnings.get(cue.id) ?? [];
              return (
                <li
                  key={cue.id}
                  className={`adm-cue${index === active ? ' is-active' : ''}`}
                  aria-current={index === active ? 'true' : undefined}
                >
                  <div className="adm-cue__head">
                    <button
                      type="button"
                      className="adm-cue__index"
                      onClick={() => clock.seek(cue.start)}
                      aria-label={`Go to cue ${index + 1} in the video`}
                    >
                      {index + 1}
                    </button>
                    <TimeField
                      label={`Start of cue ${index + 1}`}
                      value={cue.start}
                      disabled={!canEdit}
                      onCommit={(v) => patch(cue.id, { start: v }, 'start')}
                    />
                    <span aria-hidden="true">to</span>
                    <TimeField
                      label={`End of cue ${index + 1}`}
                      value={cue.end}
                      disabled={!canEdit}
                      onCommit={(v) => patch(cue.id, { end: v }, 'end')}
                    />
                    {list.map((w) => (
                      <Badge key={w} tone="warning" icon="alert">
                        {WARNING_LABELS[w]}
                      </Badge>
                    ))}
                  </div>
                  <textarea
                    className="adm-input adm-input--area adm-cue__text"
                    aria-label={`Words in cue ${index + 1}`}
                    aria-invalid={
                      list.includes('empty') || list.includes('too_long') ? true : undefined
                    }
                    placeholder="Add the words spoken here"
                    value={cue.text}
                    rows={2}
                    readOnly={!canEdit}
                    onChange={(e) => patch(cue.id, { text: e.target.value }, 'text')}
                    onSelect={(e) => (carets.current[cue.id] = e.currentTarget.selectionStart)}
                    onFocus={() => clock.seek(cue.start)}
                  />
                  {canEdit ? (
                    <div className="adm-row">
                      <Button
                        variant="ghost"
                        onClick={() => onSplit(cue)}
                        aria-label={`Split cue ${index + 1} at the cursor`}
                      >
                        Split
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={index === cues.length - 1}
                        onClick={() => onMerge(index)}
                        aria-label={`Merge with next (cue ${index + 1})`}
                      >
                        Merge with next
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <Dialog
        open={findOpen}
        onClose={() => setFindOpen(false)}
        title="Find and replace"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFindOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              disabledReason={
                !find ? 'Type the words to find.' : matches === 0 ? 'No matches.' : undefined
              }
              onClick={() => {
                const result = findReplace(cues, find, replaceWith, { matchCase });
                commit(result.cues);
                toast.show({
                  tone: 'success',
                  message: `Replaced ${result.count} ${result.count === 1 ? 'match' : 'matches'}.`,
                });
                setFindOpen(false);
              }}
            >
              Replace all{find ? ` (${matches})` : ''}
            </Button>
          </>
        }
      >
        <TextField label="Find" value={find} onChange={(e) => setFind(e.target.value)} />
        <TextField
          label="Replace with"
          value={replaceWith}
          onChange={(e) => setReplaceWith(e.target.value)}
        />
        <Checkbox
          label="Match case"
          checked={matchCase}
          onChange={(e) => setMatchCase(e.target.checked)}
        />
        <p role="status" className="adm-muted" style={{ margin: 0 }}>
          {find ? `${matches} ${matches === 1 ? 'match' : 'matches'} in ${cues.length} cues.` : ''}
        </p>
      </Dialog>

      <ConfirmDialog
        open={regenOpen}
        title="Make the captions again?"
        consequence="This replaces every cue, including your edits, with a new automatic version. You will review it again."
        confirmLabel="Regenerate"
        danger
        onClose={() => setRegenOpen(false)}
        onConfirm={async () => {
          await actions.regenerate();
          setRegenOpen(false);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={pendingUpload !== null}
        title="Replace the cues with this file?"
        consequence={`${pendingUpload?.length ?? 0} cues will replace the ${cues.length} you have now. You will review them again.`}
        confirmLabel="Replace cues"
        danger
        onClose={() => setPendingUpload(null)}
        onConfirm={async () => {
          if (pendingUpload) await actions.upload(pendingUpload);
          setPendingUpload(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/** Timestamp text box. Accepts mm:ss.mmm and tells the person when it cannot read it. */
function TimeField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onCommit: (ms: number) => void;
}) {
  const [text, setText] = useState(formatTimestamp(value));
  const [error, setError] = useState(false);
  useEffect(() => {
    setText(formatTimestamp(value));
    setError(false);
  }, [value]);
  return (
    <input
      className="adm-input adm-cue__time"
      aria-label={label}
      aria-invalid={error || undefined}
      title={error ? 'Use minutes:seconds.milliseconds, for example 01:04.200' : undefined}
      inputMode="decimal"
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseTimestamp(text);
        if (parsed === null) {
          setError(true);
          return;
        }
        setError(false);
        if (parsed !== value) onCommit(parsed);
        else setText(formatTimestamp(value));
      }}
    />
  );
}
