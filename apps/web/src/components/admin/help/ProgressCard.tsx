import type { summarizeProgress } from '@/lib/data/admin/help-progress';

type Summary = ReturnType<typeof summarizeProgress>;

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="hlp-meter">
      <p>
        <span>{label}</span>
        <span>
          {value} of {total}
        </span>
      </p>
      <progress
        value={value}
        max={Math.max(total, 1)}
        aria-label={`${label}: ${value} of ${total}`}
      />
    </div>
  );
}

/** Your progress on the help home. It follows the account, not the browser (M50-S25). */
export function ProgressCard({ summary }: { summary: Summary }) {
  const none = summary.guidesDone === 0 && summary.videosWatched === 0;
  return (
    <section className="hlp-progress adm-card" aria-label="Your progress">
      <h2 className="adm-h3">Your progress</h2>
      <Meter label="Guides finished" value={summary.guidesDone} total={summary.guidesTotal} />
      {summary.videosTotal ? (
        <Meter label="Videos watched" value={summary.videosWatched} total={summary.videosTotal} />
      ) : null}
      <p className="hlp-progress__note">
        {none
          ? 'You have not finished a guide yet. Start with Start here.'
          : 'Saved to your account, so it follows you to your phone.'}
      </p>
    </section>
  );
}
