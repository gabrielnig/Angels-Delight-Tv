'use client';

import { useEffect, useState } from 'react';
import { msg } from '@ad/shared/messages';
import { Button, Modal, useToast } from '@ad/ui';
import { buildImportItems, runImport } from '../../lib/guest/import';

const ASKED = 'ad:guest:import-asked';

/**
 * S86. After a visitor signs in, offers to add what this device remembers to their history. Asked once per visit,
 * never of a kids profile, and the device copy is only removed after the server took it.
 */
export function ImportPrompt({ profileId, kids }: { profileId: string; kids: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (kids) return;
    try {
      if (window.sessionStorage.getItem(ASKED)) return;
    } catch {
      return;
    }
    if (buildImportItems(window.localStorage).length > 0) setOpen(true);
  }, [kids]);

  function close() {
    try {
      window.sessionStorage.setItem(ASKED, '1');
    } catch {
      // Without session storage the prompt may come back on the next page. That is acceptable.
    }
    setOpen(false);
  }

  async function add() {
    setBusy(true);
    const result = await runImport({
      store: window.localStorage,
      profileId,
      post: async (request) => {
        const response = await fetch('/api/progress/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
        });
        if (!response.ok) return { ok: false };
        const body = (await response.json()) as { imported?: number };
        return { ok: true, imported: body.imported ?? 0 };
      },
    });
    setBusy(false);
    close();
    toast.show(
      result.ok
        ? { message: msg('guest.import.done', { count: result.imported }), variant: 'success' }
        : { message: msg('guest.import.failed'), variant: 'error' },
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={msg('guest.import.title')}
      hideClose
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            {msg('guest.import.notNow')}
          </Button>
          <Button onClick={() => void add()} loading={busy}>
            {msg('guest.import.add')}
          </Button>
        </>
      }
    >
      <p>{msg('guest.import.body')}</p>
    </Modal>
  );
}
