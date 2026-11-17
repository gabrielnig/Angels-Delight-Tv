export type ProgressTone = 'primary' | 'success' | 'danger' | 'paused';

interface ProgressBarProps {
  value: number;
  label: string;
  tone?: ProgressTone;
  /** Unknown length steps only, for waits with text beside the bar. */
  indeterminate?: boolean;
  small?: boolean;
  showNumber?: boolean;
}

/** DESIGN-SYSTEM 11.18. Never a bar without a number on admin tasks. */
export function ProgressBar({
  value,
  label,
  tone = 'primary',
  indeterminate,
  small,
  showNumber = true,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="adm-progress">
      <div
        className={`adm-progress__rail${small ? ' adm-progress__rail--small' : ''}${indeterminate ? ' is-indeterminate' : ''}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuetext={indeterminate ? 'Working' : `${pct} percent`}
      >
        <div
          className={`adm-progress__fill adm-progress__fill--${tone}`}
          style={{ width: indeterminate ? '40%' : `${pct}%` }}
        />
      </div>
      {showNumber && !indeterminate ? <span className="adm-progress__num">{pct}%</span> : null}
    </div>
  );
}
