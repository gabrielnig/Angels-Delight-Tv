'use client';

import { useState } from 'react';
import { ReauthDialog } from './ReauthDialog';
import { Switch } from './fields';
import { useCommand } from './useCommand';

type R = { ok: true } | { ok: false; error: string };

/** The one switch that turns every sponsor surface on or off. Changing it needs the password again. */
export function MasterSwitchCard({
  enabled,
  canChange,
  setSwitch,
}: {
  enabled: boolean;
  canChange: boolean;
  setSwitch: (on: boolean, password: string) => Promise<R>;
}) {
  const { run, busy } = useCommand();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const next = !enabled;
  return (
    <section className="adm-card adm-stack" aria-label="Sponsors master switch">
      <div className="adm-row">
        <Switch
          label="Show sponsors on the site"
          checked={enabled}
          disabled={!canChange}
          onChange={() => {
            setError(undefined);
            setAsking(true);
          }}
        />
        <p>{enabled ? 'Sponsors are on. Live sponsors can appear to adults.' : 'Sponsors are off. Viewers see nothing.'}</p>
      </div>
      <p className="adm-muted">Kids profiles and Kids mode never show sponsors, whatever this says.</p>
      <ReauthDialog
        open={asking}
        busy={busy}
        error={error}
        onCancel={() => setAsking(false)}
        onSubmit={async (password) => {
          const r = await run(
            async () => {
              const out = await setSwitch(next, password);
              if (!out.ok) setError(out.error);
              return out;
            },
            next ? 'Sponsors are on.' : 'Sponsors are off.',
          );
          if (r.ok) setAsking(false);
        }}
      />
    </section>
  );
}
