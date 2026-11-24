'use client';

import type { CaptionTrack } from '@ad/player';
import { MarkerEditor, type MarkerEditorProps } from './MarkerEditor';
import { PreviewPlayer } from './PreviewPlayer';
import { useToast } from './Toast';

/** Joins the editor to the staff preview player and the toast stack. The page passes the bound save action. */
export function MarkerEditorScreen({
  video,
  captions,
  backHref,
  ...rest
}: Omit<MarkerEditorProps, 'renderPlayer' | 'notify'> & {
  captions: CaptionTrack[];
  backHref: string;
}) {
  const toast = useToast();
  return (
    <MarkerEditor
      video={video}
      {...rest}
      notify={(tone, message) => toast.show({ tone, message })}
      renderPlayer={(onReady) => (
        <PreviewPlayer
          video={{ ...video, posterUrl: null }}
          captions={captions}
          backHref={backHref}
          onReady={onReady}
        />
      )}
    />
  );
}
