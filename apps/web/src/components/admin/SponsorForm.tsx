'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from './Button';
import { TextArea, TextField } from './fields';
import { useCommand } from './useCommand';

export interface SponsorFormValues {
  name: string;
  startDay: string;
  endDay: string;
  contactName: string;
  contactEmail: string;
  notes: string;
}

type SaveResult = { ok: true; id?: string } | { ok: false; error: string; fields?: Record<string, string[]> };

const EMPTY: SponsorFormValues = { name: '', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' };

/** Sponsor details. Contact details are staff only and never reach the public site. */
export function SponsorForm({
  initial = EMPTY,
  save,
  contactEmailHint,
}: {
  initial?: SponsorFormValues;
  save: (values: SponsorFormValues) => Promise<SaveResult>;
  contactEmailHint?: string;
}) {
  const router = useRouter();
  const { run, busy } = useCommand();
  const [values, setValues] = useState(initial);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const set = (key: keyof SponsorFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const err = (key: string) => fields[key]?.[0];

  async function submit() {
    setFields({});
    let created: string | undefined;
    const result = await run(async () => {
      const r = await save(values);
      if (!r.ok) {
        setFields(r.fields ?? {});
        return { ok: false as const, error: r.error };
      }
      created = r.id;
      return { ok: true as const };
    }, 'Sponsor saved.');
    if (result.ok && created) router.push(`/admin/sponsors/${created}`);
  }

  return (
    <form
      className="adm-stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TextField label="Sponsor name" value={values.name} onChange={set('name')} error={err('name')} maxLength={80} required />
      <div className="adm-row">
        <TextField label="Starts on" type="date" value={values.startDay} onChange={set('startDay')} error={err('startDay')} hint="Lagos time. Leave empty to start when approved." />
        <TextField label="Ends on" type="date" value={values.endDay} onChange={set('endDay')} error={err('endDay')} hint="The last day it shows, Lagos time." />
      </div>
      <TextField label="Contact name" value={values.contactName} onChange={set('contactName')} error={err('contactName')} hint="Staff only. Never shown to viewers." />
      <TextField label="Contact email" type="email" value={values.contactEmail} onChange={set('contactEmail')} error={err('contactEmail')} hint={contactEmailHint ?? 'Staff only. Stored sealed.'} />
      <TextArea label="Notes" value={values.notes} onChange={set('notes')} error={err('notes')} rows={4} hint="Staff only." />
      <div className="adm-row">
        <Button variant="primary" type="submit" loading={busy}>
          Save sponsor
        </Button>
      </div>
    </form>
  );
}
