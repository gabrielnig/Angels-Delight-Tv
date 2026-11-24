import { formatMoney } from '@ad/payments/money';
import './donate.css';

export type TransparencyItem =
  | { label: string; percent: number; note: string }
  | { label: string; amount_minor: number; note: string };

const longDate = (day: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${day}T00:00:00Z`));

/**
 * How gifts are used (M48-S38). Plain text only: the owner's words are rendered as text, never as markup, and the
 * page names no donor. Percent lines get a progress bar with the number beside it, amount lines show naira.
 */
export function TransparencyList({
  title,
  intro,
  items,
  updatedAt,
}: {
  title: string;
  intro: string;
  items: TransparencyItem[];
  updatedAt: string | null;
}) {
  return (
    <div className="donate-page">
      <h1 className="donate-page__title">{title}</h1>
      {intro ? <p className="donate-page__lead">{intro}</p> : null}
      {items.length === 0 ? (
        <p>We have not published the details yet. Please check back soon.</p>
      ) : (
        <ul className="donate-uses">
          {items.map((item) => (
            <li key={item.label} className="donate-uses__item">
              <div className="donate-uses__head">
                <strong>{item.label}</strong>
                <span>{'percent' in item ? `${item.percent}%` : formatMoney(item.amount_minor, 'NGN')}</span>
              </div>
              {'percent' in item ? (
                <progress className="donate-uses__bar" max={100} value={item.percent} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.percent} aria-label={`${item.label}, ${item.percent} percent`} />
              ) : null}
              {item.note ? <p className="donate-form__note">{item.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {updatedAt ? <p className="donate-form__note">Updated {longDate(updatedAt)}</p> : null}
    </div>
  );
}
