'use client';

import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { Lane } from '@/lib/uploader/types';
import { Button } from './Button';
import { SelectField } from './fields';
import { Icon } from './Icon';
import { Banner, EmptyState } from './states';
import { UploadLane } from './UploadLane';
import type { LaneActions } from './UploadLane';
import { useUploaderState } from './UploaderContext';

const ACCEPT = '.mp4,.mov,.mkv,video/mp4,video/quicktime,video/x-matroska';

/**
 * Drop zone, settings and the queue. Every file is its own lane, so one failure never blocks the
 * others. `registerUpload` is the fixture hook that creates a draft video when a lane finishes.
 */
export function UploadScreen({
  registerUpload,
  maxFileLabel = '5 GB',
  replace,
}: {
  registerUpload?: (name: string, size: number) => Promise<{ id: string }>;
  maxFileLabel?: string;
  /** Upload a new file for this existing video (a failed encode) instead of making a new draft. */
  replace?: { videoId: string; title: string };
}) {
  const { uploader, lanes, online } = useUploaderState();
  const [over, setOver] = useState(false);
  const [parallel, setParallel] = useState('2');
  const [videoIds, setVideoIds] = useState<Record<string, string>>({});
  const registered = useRef(new Set<string>());
  const input = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (replace) {
        // One file replaces one video.
        if (list[0]) uploader.add(list[0], { replaceVideoId: replace.videoId });
        return;
      }
      for (const file of list) uploader.add(file);
    },
    [uploader, replace],
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
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
