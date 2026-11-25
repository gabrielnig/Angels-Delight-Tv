'use client';

import { Button } from '../Button';

/** Uses the browser print dialog, which also saves as PDF (M50-S09). The print stylesheet does the layout. */
export function PrintButton() {
  return (
    <Button icon="print" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
