'use client';

import { useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { Banner } from '../states';

const MAX_BYTES = 2 * 1024 * 1024;

export interface ImportPlanView {
  dryRun: boolean;
  added: { row: number; key: string }[];
  changed: { row: number; key: string }[];
  unchanged: { row: number; key: string }[];
  rejected: { row: number; key: string; reason: string }[];
  blank: number;
}
type PostResult = { ok: true; plan: ImportPlanView } | { ok: false; error: string };

/** Posts the CSV text to the import route. */
export async function postImport(code: string, text: string, dryRun: boolean): Promise<PostResult> {
  const response = await fetch(`/api/admin/languages/${code}/import${dryRun ? '?dryRun=1' : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'text/csv' },
    body: text,
  });
  if (!response.ok) return { ok: false, error: await response.text() };
  return { ok: true, plan: (await response.json()) as ImportPlanView };
}

export function ImportDialog({
  open,
  locale,
  onClose,
  onDone,
  post,
}: {
  open: boolean;
  locale: { code: string; englishName: string };
  onClose: () => void;
  onDone: () => void;
  post?: (text: string, dryRun: boolean) => Promise<PostResult>;
}) {
  const send = post ?? ((text: string, dryRun: boolean) => postImport(locale.code, text, dryRun));
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ImportPlanView | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const writes = plan ? plan.added.length + plan.changed.length : 0;

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await send(await file.text(), dryRun);
      if (!result.ok) setError(result.error);
      else if (dryRun) setPlan(result.plan);
      else {
        setFinished(true);
        onDone();
      }
    } catch {
      setError('We could not reach the server. Your file is still here. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Import ${locale.englishName} text`}
      description="Imported text goes to review. Nothing is shown to viewers until an Admin approves it."
      footer={
        finished ? (
          <Button variant="primary" onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            {plan && writes > 0 ? (
              <Button variant="primary" loading={busy} onClick={() => void run(false)}>{`Import ${writes} rows`}</Button>
            ) : (
              <Button variant="primary" loading={busy} disabled={!file} onClick={() => void run(true)}>Check file</Button>
            )}
          </>
        )
      }
    >
      {error ? <p role="alert" className="adm-field__error">{error}</p> : null}
      {finished ? (
        <Banner tone="success">Imported. The rows go to review.</Banner>
      ) : (
        <>
          <label className="adm-field__label" htmlFor="import-file">CSV file</label>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setPlan(null);
              if (next && next.size > MAX_BYTES) {
                setFile(null);
                setError('That file is over the 2 MB limit. Split it into smaller files.');
                return;
              }
              setError(undefined);
              setFile(next);
            }}
          />
          {file ? <p className="adm-muted">{file.name}</p> : null}
          {plan ? (
            <div aria-live="polite">
              <p>{`${plan.added.length} added, ${plan.changed.length} changed, ${plan.unchanged.length} unchanged, ${plan.rejected.length} rejected`}</p>
              {plan.rejected.length > 0 ? (
                <table className="adm-table">
                  <caption className="adm-sr">Rejected rows</caption>
                  <thead>
                    <tr><th scope="col">Row</th><th scope="col">Key</th><th scope="col">Reason</th></tr>
                  </thead>
                  <tbody>
                    {plan.rejected.map((r) => (
                      <tr key={`${r.row}-${r.key}`}><td>{r.row}</td><td>{r.key}</td><td>{r.reason}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Dialog>
  );
}
