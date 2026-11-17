'use client';

import { useState } from 'react';
import { Select, Switch, useToast } from '@ad/ui';
import { savePlaybackAction } from '../../app/actions';
import type { PlaybackSettings } from '../../lib/data';

/** Playback preferences. Every change saves at once and rolls back with a message if it fails. */
export function PlaybackSettingsForm({
  initial,
  save = savePlaybackAction,
}: {
  initial: PlaybackSettings;
  save?: (patch: Partial<PlaybackSettings>) => Promise<unknown>;
}) {
  const [values, setValues] = useState(initial);
  const toast = useToast();

  async function change<K extends keyof PlaybackSettings>(key: K, value: PlaybackSettings[K]) {
    const previous = values[key];
    setValues((v) => ({ ...v, [key]: value }));
    try {
      await save({ [key]: value } as Partial<PlaybackSettings>);
    } catch {
      setValues((v) => ({ ...v, [key]: previous }));
      toast.show({
        message: 'We could not save that. Your setting was not changed.',
        variant: 'error',
      });
    }
  }

  return (
    <form className="web-form" onSubmit={(event) => event.preventDefault()}>
      <Switch
        label="Autoplay next episode"
        checked={values.autoplayNext}
        onCheckedChange={(v) => void change('autoplayNext', v)}
      />
      <Switch
        label="Data saver"
        hint="Uses lower quality video to save mobile data."
        checked={values.dataSaver}
        onCheckedChange={(v) => void change('dataSaver', v)}
      />
      <Switch
        label="Captions on by default"
        checked={values.captionsDefault}
        onCheckedChange={(v) => void change('captionsDefault', v)}
      />
      <Select
        label="Video quality"
        value={values.quality}
        onChange={(e) => void change('quality', e.target.value as PlaybackSettings['quality'])}
      >
        <option value="auto">Auto</option>
        <option value="1080">1080p</option>
        <option value="720">720p</option>
        <option value="480">480p</option>
        <option value="360">360p</option>
      </Select>
      <Select
        label="Caption size"
        value={values.captionSize}
        onChange={(e) =>
          void change('captionSize', e.target.value as PlaybackSettings['captionSize'])
        }
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
        <option value="xlarge">Extra large</option>
      </Select>
    </form>
  );
}
