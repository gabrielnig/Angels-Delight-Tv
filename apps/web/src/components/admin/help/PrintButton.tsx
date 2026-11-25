'use client';

import { Button } from '../Button';

/**
 * Print or save as PDF uses the browser print dialog. Download PDF takes the prebuilt file of the release when there
 * is one and falls back to the same dialog when it is missing (M50-S09). The print stylesheet does the layout.
 */
export function PrintButton({ guide }: { guide: string }) {
  const download = async () => {
    const href = `/admin/help/media/pdf/${guide}.pdf`;
    try {
      const res = await fetch(href, { method: 'HEAD' });
      if (res.ok) {
        const a = document.createElement('a');
        a.href = href;
        a.download = `help-${guide}.pdf`;
        a.click();
        return;
      }
    } catch {
      // No connection or no file: print instead.
    }
    window.print();
  };
  return (
    <>
      <Button icon="print" onClick={() => window.print()}>
        Print or save as PDF
      </Button>
      <Button icon="download" variant="secondary" onClick={() => void download()}>
        Download PDF
      </Button>
    </>
  );
}
