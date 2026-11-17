import type { ReactNode } from 'react';
import type { AdminVideoStatus, CaptionState } from '@/lib/data/admin/types';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span className={`adm-badge adm-badge--${tone}`}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

export const STATUS_BADGES: Record<
  AdminVideoStatus,
  { label: string; tone: BadgeTone; icon: IconName }
> = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'file' },
  uploading: { label: 'Uploading', tone: 'info', icon: 'upload' },
  processing: { label: 'Processing', tone: 'info', icon: 'clock' },
  needs_captions: { label: 'Needs captions', tone: 'warning', icon: 'captions' },
  ready: { label: 'Ready', tone: 'success', icon: 'check' },
  scheduled: { label: 'Scheduled', tone: 'warning', icon: 'calendar' },
  published: { label: 'Published', tone: 'success', icon: 'check' },
  failed: { label: 'Failed', tone: 'danger', icon: 'alert' },
};

export function StatusBadge({ status }: { status: AdminVideoStatus }) {
  const { label, tone, icon } = STATUS_BADGES[status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

export const CAPTION_BADGES: Record<
  CaptionState,
  { label: string; tone: BadgeTone; icon: IconName }
> = {
  none: { label: 'None', tone: 'neutral', icon: 'captions' },
  generating: { label: 'Generating', tone: 'info', icon: 'clock' },
  needs_review: { label: 'Needs review', tone: 'warning', icon: 'captions' },
  approved: { label: 'Approved', tone: 'success', icon: 'check' },
  failed: { label: 'Failed', tone: 'danger', icon: 'alert' },
};

export function CaptionBadge({ state }: { state: CaptionState }) {
  const { label, tone, icon } = CAPTION_BADGES[state];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}
