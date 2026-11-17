import { cx } from './cx';

export function ProgressBar({
  value,
  label,
  showValue,
  tone = 'primary',
  size = 'md',
  className,
}: {
  value: number;
  label: string;
  showValue?: boolean;
  tone?: 'primary' | 'accent' | 'success';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const clamped = Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  return (
    <div className={cx('ad-progress', className)} data-tone={tone} data-size={size}>
      <div
        className="ad-progress__rail"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-valuetext={`${clamped} percent`}
      >
        <div className="ad-progress__fill" style={{ width: `${clamped}%` }} />
      </div>
      {showValue ? <span className="ad-progress__value">{clamped}%</span> : null}
    </div>
  );
}
