import './donate.css';

/** Optional bank transfer details (M48-S40). The owner's text is shown as plain text, so markup in it is never run. */
export function BankTransfer({ instructions }: { instructions: string }) {
  const text = instructions.trim();
  if (!text) return null;
  return (
    <section className="donate-bank" aria-labelledby="donate-bank-title">
      <h2 id="donate-bank-title" className="donate-state__title">
        Give by bank transfer
      </h2>
      <p className="donate-bank__text">{text}</p>
    </section>
  );
}
