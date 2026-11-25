'use client';

import { useCallback, useState } from 'react';
import { Button, IconButton } from '@ad/ui';
import { useT } from '../../lib/i18n/provider';
import { ShareSheet } from './ShareSheet';
import { resolveShareUrl } from './resolve-url';
import type { ShareTargetId } from './share-targets';

export interface ShareButtonProps {
  title: string;
  text: string;
  channels: readonly ShareTargetId[];
  kind: 'video' | 'series';
  /** The clean canonical address, or its path. Without it the current page without query or hash is used. */
  url?: string;
  thumbnail?: string;
  /** `button` is the labelled secondary button of pages. `icon` is the 44 px round control of the hero and cards. */
  variant?: 'button' | 'icon';
  onShare?: (target: ShareTargetId) => void;
}

/** The Share control (L15a). It always opens the sheet, so every place to share is visible on every device. */
export function ShareButton({
  title,
  text,
  channels,
  kind,
  url,
  thumbnail,
  variant = 'button',
  onShare,
}: ShareButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [target, setTarget] = useState('');
  const ref = useCallback((node: HTMLSpanElement | null) => setAnchor(node), []);
  const onClose = useCallback(() => setOpen(false), []);

  function openSheet() {
    setTarget(resolveShareUrl(url));
    setOpen(true);
  }

  return (
    <span className="share" ref={ref}>
      {variant === 'icon' ? (
        <IconButton
          label={`${t('share.button')} ${title}`}
          icon="share"
          variant="surface"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={openSheet}
        />
      ) : (
        <Button
          variant="secondary"
          icon="share"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={openSheet}
        >
          {t('share.button')}
        </Button>
      )}
      <ShareSheet
        open={open}
        onClose={onClose}
        title={title}
        text={text}
        url={target}
        kind={kind}
        channels={channels}
        thumbnail={thumbnail}
        anchor={anchor}
        onShare={onShare}
      />
    </span>
  );
}
