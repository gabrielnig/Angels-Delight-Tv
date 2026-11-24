'use client';

/** Progress for a chunked run: a number as well as a bar, Cancel between batches, an offline note. */
export function BulkProgress({
  label,
  done,
  total,
  offline,
  onCancel,
}: {
  label: string;
  done: number;
  total: number;
  offline?: boolean;
  onCancel: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="adm-bulk-progress">
      <div className="adm-progress">
        <div
          className="adm-progress__rail"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-valuetext={`${done} of ${total}`}
        >
          <div className="adm-progress__fill adm-progress__fill--primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="adm-progress__num">Done {done} of {total}</span>
      </div>
      {offline ? (
        <p className="adm-muted" role="status">
          Waiting for the connection. This carries on by itself when it is back.
        </p>
      ) : null}
      <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>
        Cancel
      </button>
      <p className="adm-muted">Cancel stops after the current batch. Items already done stay done.</p>
    </div>
  );
}
