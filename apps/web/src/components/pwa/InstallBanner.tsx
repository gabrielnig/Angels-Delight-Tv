import './pwa.css';

export function InstallBanner({
  platformName,
  onInstall,
  onDismiss,
}: {
  platformName: string;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="pwa-banner" aria-labelledby="pwa-install-title">
      <h2 id="pwa-install-title" className="pwa-banner__title">
        Add {platformName} to your phone
      </h2>
      <p className="pwa-banner__body">Open it like an app. Uses very little storage.</p>
      <div className="pwa-actions">
        <button type="button" className="pwa-btn pwa-btn--primary" onClick={onInstall}>
          Install
        </button>
        <button type="button" className="pwa-btn" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}

export function IosInstructions({ onClose }: { onClose: () => void }) {
  return (
    <section className="pwa-banner" role="dialog" aria-labelledby="pwa-ios-title">
      <h2 id="pwa-ios-title" className="pwa-banner__title">
        Add to your Home Screen
      </h2>
      <p className="pwa-banner__body">
        On iPhone, Safari does this in 3 steps. Use Safari, not another browser.
      </p>
      <ol className="pwa-steps">
        <li>
          <strong>Tap Share</strong>
          <span className="pwa-banner__body">
            It is the square with an arrow, at the bottom of Safari.
          </span>
        </li>
        <li>
          <strong>Choose Add to Home Screen</strong>
          <span className="pwa-banner__body">Scroll down the list if you do not see it.</span>
        </li>
        <li>
          <strong>Tap Add</strong>
          <span className="pwa-banner__body">It now sits on your Home Screen.</span>
        </li>
      </ol>
      <div className="pwa-actions">
        <button type="button" className="pwa-btn pwa-btn--primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </section>
  );
}

export function InAppBrowserNotice({
  onCopy,
  onClose,
}: {
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <section className="pwa-banner" role="dialog" aria-labelledby="pwa-inapp-title">
      <h2 id="pwa-inapp-title" className="pwa-banner__title">
        This browser cannot add apps to your Home Screen
      </h2>
      <p className="pwa-banner__body">Open this page in Safari.</p>
      <div className="pwa-actions">
        <button type="button" className="pwa-btn pwa-btn--primary" onClick={onCopy}>
          Copy page link
        </button>
        <button type="button" className="pwa-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
