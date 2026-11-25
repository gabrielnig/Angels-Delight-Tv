'use client';

import { type SeriesLabelSetting } from '@ad/shared/series-labels';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { Lane } from '@/lib/uploader/types';
import {
  EMPTY_DETAILS,
  resolveDetails,
  toVideoPatch,
  validateDetails,
  type FileOverride,
  type UploadDetails,
} from '@/lib/uploader/upload-details';
import type { VideoPatch } from '@/lib/data/admin/video-commands';
import { Button } from './Button';
import { SelectField } from './fields';
import { Icon } from './Icon';
import { Banner, EmptyState } from './states';
import { UploadDetailsForm } from './UploadDetailsForm';
import { UploadLane } from './UploadLane';
import { UploadOverrides } from './UploadOverrides';
import type { LaneActions } from './UploadLane';
import { useUploaderState } from './UploaderContext';

const ACCEPT = '.mp4,.mov,.mkv,video/mp4,video/quicktime,video/x-matroska';

/**
 * Drop zone, settings and the queue. Every file is its own lane, so one failure never blocks the
 * others. `registerUpload` is the fixture hook that creates a draft video when a lane finishes.
 */
export function UploadScreen({
  registerUpload,
  applyDetails,
  categories = [],
  series = [],
  maxFileLabel = '5 GB',
  replace,
}: {
  registerUpload?: (name: string, size: number) => Promise<{ id: string }>;
  /** Saves the details onto the draft once it exists. Same validation as the video editor. */
  applyDetails?: (videoId: string, patch: VideoPatch) => Promise<{ ok: boolean; error?: string }>;
  categories?: Array<{ id: string; name: string }>;
  series?: Array<{ id: string; title: string; labels?: SeriesLabelSetting }>;
  maxFileLabel?: string;
  /** Upload a new file for this existing video (a failed encode) instead of making a new draft. */
  replace?: { videoId: string; title: string };
}) {
  const { uploader, lanes, online } = useUploaderState();
  const [over, setOver] = useState(false);
  const [parallel, setParallel] = useState('2');
  const [videoIds, setVideoIds] = useState<Record<string, string>>({});
  const registered = useRef(new Set<string>());
  const [details, setDetails] = useState<UploadDetails>(EMPTY_DETAILS);
  const [formOpen, setFormOpen] = useState(true);
  const [notes, setNotes] = useState<string[]>([]);
  // Place of each file in the batch, for episode numbering. Details are resolved when the draft exists,
  // so a file that has not been registered yet follows the shared form and its own overrides.
  const laneIndex = useRef(new Map<string, number>());
  const [overrides, setOverrides] = useState<Record<string, FileOverride>>({});
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const detailsRef = useRef(details);
  detailsRef.current = details;
  const applied = useRef(new Set<string>());
  const [saved, setSaved] = useState<Record<string, true>>({});
  const cursor = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (replace) {
        // One file replaces one video.
        if (list[0]) uploader.add(list[0], { replaceVideoId: replace.videoId });
        return;
      }
      setNotes(
        validateDetails(
          details,
          new Set(categories.map((c) => c.id)),
          new Set(series.map((s) => s.id)),
        ).errors,
      );
      for (const file of list) {
        const lane = uploader.add(file);
        laneIndex.current.set(lane.id, cursor.current++);
      }
      if (list.length) setFormOpen(false);
    },
    [uploader, replace, details, categories, series],
  );

  // Fixture: when a lane finishes and the server did not name a video, create the draft.
  for (const lane of lanes) {
    if (
      lane.status === 'done' &&
      !lane.videoId &&
      registerUpload &&
      !registered.current.has(lane.id)
    ) {
      registered.current.add(lane.id);
      void registerUpload(lane.name, lane.size).then(({ id }) =>
        setVideoIds((cur) => ({ ...cur, [lane.id]: id })),
      );
    }
  }

  // Once a draft exists for a lane, save the details it was added with. Each lane is saved once.
  useEffect(() => {
    if (!applyDetails) return;
    for (const lane of lanes) {
      const videoId = lane.videoId ?? videoIds[lane.id];
      const index = laneIndex.current.get(lane.id);
      if (!videoId || index === undefined || applied.current.has(lane.id)) continue;
      applied.current.add(lane.id);
      const { details: current } = validateDetails(
        detailsRef.current,
        new Set(categories.map((c) => c.id)),
        new Set(series.map((s) => s.id)),
      );
      const resolved = resolveDetails(current, overridesRef.current[lane.id], index);
      const patch = resolved ? toVideoPatch(resolved) : {};
      if (Object.keys(patch).length === 0) continue;
      void applyDetails(videoId, patch)
        .then((r) => {
          if (r.ok) setSaved((cur) => ({ ...cur, [lane.id]: true }));
          else setNotes((cur) => [...cur, `${lane.name}: ${r.error ?? 'Details were not saved.'}`]);
        })
        .catch(() => setNotes((cur) => [...cur, `${lane.name}: Details were not saved.`]));
    }
  }, [lanes, videoIds, applyDetails, categories, series]);

  const actions: LaneActions = {
    pause: (id) => uploader.pause(id),
    resume: (id) => uploader.resume(id),
    retry: (id) => uploader.retry(id),
    cancel: (id) => uploader.cancel(id),
    remove: (id) => uploader.remove(id),
    replace: (id, file) => {
      uploader.remove(id);
      uploader.add(file);
    },
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };

  const rejected = lanes.filter((l) => l.status === 'rejected');
  const queue = lanes.filter((l) => l.status !== 'rejected');

  return (
    <div className="adm-stack">
      {replace ? (
        <Banner tone="info">
          Choose a new file for <strong>{replace.title}</strong>. It replaces the one that failed and
          the video is prepared again.
        </Banner>
      ) : null}
      {!replace ? (
        <UploadDetailsForm
          details={details}
          onChange={(next) => {
            // Episode numbering restarts when the series or the start number changes.
            if (next.seriesId !== details.seriesId || next.startEpisode !== details.startEpisode)
              cursor.current = 0;
            setDetails(next);
          }}
          categories={categories}
          series={series}
          fileCount={lanes.filter((l) => l.status !== 'rejected').length}
          open={formOpen}
          onOpen={() => setFormOpen(true)}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
      {!replace ? (
        <UploadOverrides
          rows={lanes
            .filter((l) => l.status !== 'rejected' && laneIndex.current.has(l.id))
            .map((l) => ({
              id: l.id,
              name: l.name,
              size: l.size,
              locked: Boolean(l.videoId ?? videoIds[l.id]),
              override: overrides[l.id] ?? {},
            }))}
          shared={details}
          categories={categories}
          series={series}
          onChange={(id, patch) =>
            setOverrides((cur) => {
              const merged = { ...(cur[id] ?? {}), ...patch };
              for (const key of Object.keys(merged) as Array<keyof FileOverride>)
                if (merged[key] === undefined || merged[key] === '') delete merged[key];
              return { ...cur, [id]: merged };
            })
          }
          onReset={(id) =>
            setOverrides((cur) => {
              const { [id]: _gone, ...rest } = cur;
              return rest;
            })
          }
        />
      ) : null}
      {notes.map((note) => (
        <Banner key={note} tone="warning">
          {note}
        </Banner>
      ))}
      {!online ? (
        <Banner tone="warning">
          You are offline. Uploads will continue when you are back online.
        </Banner>
      ) : null}

      <div
        className={`adm-drop${over ? ' is-over' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setOver(false);
        }}
        onDrop={onDrop}
      >
        <Icon name="upload" size={40} />
        <p className="adm-drop__title">{over ? 'Release to upload' : 'Drop videos here'}</p>
        <p className="adm-muted adm-drop__or">or choose from your device</p>
        <input
          ref={input}
          type="file"
          multiple={!replace}
          accept={ACCEPT}
          hidden
          aria-label="Choose videos to upload"
          data-testid="file-input"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button variant="primary" onClick={() => input.current?.click()}>
          {replace ? 'Choose the new file' : 'Choose videos'}
        </Button>
        <p className="adm-muted adm-drop__hint">
          MP4, MOV or MKV. Up to {maxFileLabel} each. You can add many at once.
        </p>
      </div>

      {rejected.length ? (
        <ul className="adm-lanes adm-card" aria-label="Files that were not added">
          {rejected.map((lane) => (
            <UploadLane key={lane.id} lane={lane} actions={actions} />
          ))}
        </ul>
      ) : null}

      <section className="adm-card" aria-labelledby="queue-title">
        <div className="adm-card__head">
          <h2 className="adm-h3" id="queue-title">
            Upload queue
          </h2>
          <div style={{ width: '11rem' }}>
            <SelectField
              label="Files at once"
              value={parallel}
              options={[
                { value: '1', label: '1 at a time' },
                { value: '2', label: '2 at a time' },
                { value: '3', label: '3 at a time' },
              ]}
              onChange={(e) => {
                setParallel(e.target.value);
                uploader.setFileConcurrency(Number(e.target.value));
              }}
            />
          </div>
        </div>
        {queue.length === 0 ? (
          <EmptyState title="Nothing uploading." icon="upload" />
        ) : (
          <ul className="adm-lanes" aria-label="Uploads">
            {queue.map((lane: Lane) => (
              <UploadLane
                key={lane.id}
                lane={lane}
                actions={actions}
                videoId={lane.videoId ?? videoIds[lane.id]}
                note={saved[lane.id] ? 'Details were saved with the draft.' : undefined}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
