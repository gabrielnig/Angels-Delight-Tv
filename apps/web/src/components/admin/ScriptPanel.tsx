'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CaptionResult } from '@/lib/data/admin/caption-commands';
import { Button } from './Button';
import { TextArea } from './fields';
import { Banner } from './states';
import { useToast } from './Toast';

/**
 * Paste a script and align it to the audio (M15-S02). The preview shows the text the way it will be used, with
 * speaker names and stage directions removed. Cues the aligner is unsure about are marked in the cue list.
 */
export function ScriptPanel({
  preview,
  align,
}: {
  preview: (script: string) => Promise<string>;
  align: (script: string) => Promise<CaptionResult>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState('');
  const [cleaned, setCleaned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button icon="file" onClick={() => setOpen(true)}>
        Align a script
      </Button>
    );
  }

  async function onPreview() {
    setError(null);
    try {
      setCleaned(await preview(script));
    } catch {
      setError('Could not prepare the preview. Try again.');
    }
  }

  async function onAlign() {
    setError(null);
    setBusy(true);
    try {
      const result = await align(script);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.show({
        tone: 'success',
        message: 'Aligning your script to the audio. Captions will be ready to review soon.',
      });
      setOpen(false);
      setScript('');
      setCleaned(null);
      router.refresh();
    } catch {
      setError('Could not start alignment. Your script was not lost. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adm-card adm-stack" aria-label="Align a script">
      <h2 className="adm-h3">Align a script</h2>
      <p className="adm-muted" style={{ margin: 0 }}>
        Paste the script. Your wording is kept and the timing comes from the audio. Speaker names
        like NARRATOR: and notes in brackets are removed.
      </p>
      <TextArea
        label="Script"
        value={script}
        rows={8}
        onChange={(e) => {
          setScript(e.target.value);
          setCleaned(null);
        }}
      />
      {cleaned !== null ? (
        <div>
          <p className="adm-list__title">Text that will be used</p>
          <pre className="adm-detail">{cleaned}</pre>
        </div>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <div className="adm-row">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={onPreview}>Preview</Button>
        <Button variant="primary" loading={busy} onClick={onAlign}>
          Align to audio
        </Button>
      </div>
    </section>
  );
}
