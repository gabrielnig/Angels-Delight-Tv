'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { formatDuration } from '@/lib/admin/format';
import {
  candidateFrames,
  clampFocus,
  focusFromPoint,
  previewStyle,
  validatePosterChoice,
  validatePosterFile,
} from '@/lib/admin/poster-rules';
import type { Focus, PosterChoice } from '@/lib/admin/poster-rules';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Button, LinkButton } from './Button';
import { TextField, TextArea } from './fields';
import { Card } from './PageHeader';
import { PosterTile, seedOf } from './PosterTile';
import { Banner } from './states';
import { useToast } from './Toast';

interface Props {
  videoId: string;
  title: string;
  durationSeconds: number;
  initial: {
    posterId: string | null;
    alt: string | null;
    focus: { x: number; y: number; zoom: number } | null;
  };
  save: (choice: PosterChoice) => Promise<CommandResult>;
}

interface Source {
  id: string;
  label: string;
  /** Object URL for an uploaded image. Frames are placeholders until the worker makes real ones. */
  url?: string;
}

function Crop({
  source,
  title,
  focus,
  zoom,
  ratio,
  label,
}: {
  source: Source;
  title: string;
  focus: Focus;
  zoom: number;
  ratio: string;
  label: string;
}) {
  const style = previewStyle(focus, zoom);
  return (
    <figure className="adm-crop" style={{ aspectRatio: ratio }}>
      {source.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source.url}
          alt=""
          style={{ ...style, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span className="adm-crop__tile" style={style}>
          <PosterTile title={title} seed={seedOf(source.id)} size="lg" />
        </span>
      )}
      <figcaption className="adm-sr">{label}</figcaption>
    </figure>
  );
}

export function PosterPicker({ videoId, title, durationSeconds, initial, save }: Props) {
  const router = useRouter();
  const toast = useToast();
  const frames: Source[] = candidateFrames(durationSeconds).map((s) => ({
    id: `frame_${videoId}_${s}`,
    label: formatDuration(s),
  }));
  const [uploaded, setUploaded] = useState<Source | null>(null);
  const [selectedId, setSelectedId] = useState<string>(initial.posterId ?? frames[2]!.id);
  const [focus, setFocus] = useState<Focus>({
    x: initial.focus?.x ?? 50,
    y: initial.focus?.y ?? 50,
  });
  const [zoom, setZoom] = useState(initial.focus?.zoom ?? 100);
  const [alt, setAlt] = useState(initial.alt ?? '');
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  const all = uploaded ? [uploaded, ...frames] : frames;
  const selected = all.find((s) => s.id === selectedId) ?? frames[0]!;

  function onFile(file: File) {
    setFileError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const problem = validatePosterFile({
        type: file.type,
        size: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      if (problem) {
        setFileError(problem);
        URL.revokeObjectURL(url);
        return;
      }
      const source = { id: `upload_${videoId}_${Date.now()}`, label: 'Your image', url };
      setUploaded(source);
      setSelectedId(source.id);
    };
    img.onerror = () => {
      setFileError('That file could not be read as an image.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const onKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    const move: Record<string, Focus> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = move[event.key];
    if (!delta) return;
    event.preventDefault();
    setFocus((f) => clampFocus({ x: f.x + delta.x, y: f.y + delta.y }));
  };

  async function onSave() {
    const choice: PosterChoice = { posterId: selected.id, focus, zoom, alt };
    const problems = validatePosterChoice(choice);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true);
    setServerError(null);
    try {
      const result = await save(choice);
      if (result.ok) {
        toast.show({ tone: 'success', message: 'Poster saved.' });
        router.push(`/admin/videos/${videoId}`);
      } else setServerError(result.error);
    } catch {
      setServerError('Could not save the poster. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-stack">
      <Card title="Pick a frame">
        <p className="adm-muted" style={{ margin: 0 }}>
          Six frames from your video. Pick one or upload your own.
        </p>
        <ul className="adm-frames" aria-label="Candidate frames">
          {all.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                className="adm-frame"
                aria-pressed={source.id === selectedId}
                onClick={() => setSelectedId(source.id)}
              >
                {source.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={source.url} alt="" className="adm-frame__img" />
                ) : (
                  <PosterTile title={title} seed={seedOf(source.id)} size="lg" />
                )}
                <span className="adm-frame__label">
                  {source.label}
                  <span className="adm-sr">{source.id === selectedId ? ', selected' : ''}</span>
                </span>
                <span className="adm-frame__cta">
                  {source.id === selectedId ? 'Selected' : 'Use this'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="adm-row">
          <input
            ref={picker}
            type="file"
            hidden
            accept="image/jpeg,image/png"
            aria-label="Choose a poster image"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <Button icon="image" onClick={() => picker.current?.click()}>
            Upload your own
          </Button>
          <span className="adm-muted">JPG or PNG, at least 1280 by 720, up to 5 MB.</span>
        </div>
        {fileError ? <Banner tone="danger">{fileError}</Banner> : null}
      </Card>

      <div className="adm-grid-2">
        <Card title="Crop and focus">
          <p className="adm-muted" style={{ margin: 0 }}>
            Click the picture to set the focus point. Keep faces and text inside the dashed safe
            area so they survive every crop.
          </p>
          <div
            ref={stage}
            className="adm-stage"
            onClick={(e) =>
              setFocus(
                focusFromPoint(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY),
              )
            }
          >
            <Crop
              source={selected}
              title={title}
              focus={focus}
              zoom={100}
              ratio="16 / 9"
              label="Full picture"
            />
            <span className="adm-stage__safe" aria-hidden="true" />
            <button
              type="button"
              className="adm-stage__focus"
              style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
              aria-label={`Focus point at ${focus.x}, ${focus.y}. Use the arrow keys to move it.`}
              onKeyDown={onKey}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="adm-grid-2">
            <TextField
              label="Focus across (0 to 100)"
              type="number"
              min={0}
              max={100}
              value={focus.x}
              onChange={(e) => setFocus(clampFocus({ ...focus, x: Number(e.target.value) }))}
            />
            <TextField
              label="Focus down (0 to 100)"
              type="number"
              min={0}
              max={100}
              value={focus.y}
              onChange={(e) => setFocus(clampFocus({ ...focus, y: Number(e.target.value) }))}
            />
          </div>
          <div className="adm-field">
            <label htmlFor="zoom" className="adm-field__label">
              Zoom: {zoom}%
            </label>
            <input
              id="zoom"
              type="range"
              min={100}
              max={200}
              step={5}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-valuetext={`${zoom} percent`}
            />
            {errors.zoom ? (
              <p className="adm-field__error" role="alert">
                {errors.zoom}
              </p>
            ) : null}
          </div>
          <TextArea
            label="Poster description (alt text)"
            hint="For people who cannot see the picture."
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            error={errors.alt}
            maxLength={200}
          />
        </Card>

        <Card title="Previews">
          <p className="adm-list__title">Hero banner crop</p>
          <Crop
            source={selected}
            title={title}
            focus={focus}
            zoom={zoom}
            ratio="21 / 9"
            label="Hero banner crop"
          />
          <p className="adm-list__title">Video card 16:9</p>
          <Crop
            source={selected}
            title={title}
            focus={focus}
            zoom={zoom}
            ratio="16 / 9"
            label="Video card crop"
          />
          <p className="adm-list__title">Phone hero</p>
          <div style={{ width: '9rem' }}>
            <Crop
              source={selected}
              title={title}
              focus={focus}
              zoom={zoom}
              ratio="4 / 5"
              label="Phone hero crop"
            />
          </div>
        </Card>
      </div>

      {errors.posterId ? <Banner tone="danger">{errors.posterId}</Banner> : null}
      {serverError ? <Banner tone="danger">{serverError}</Banner> : null}
      <div className="adm-form-actions">
        <LinkButton href={`/admin/videos/${videoId}`} variant="ghost">
          Cancel
        </LinkButton>
        <Button variant="primary" loading={saving} onClick={onSave}>
          Save poster
        </Button>
      </div>
    </div>
  );
}
