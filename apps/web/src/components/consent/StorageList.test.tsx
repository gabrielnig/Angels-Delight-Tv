import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { visitorInventory } from '../../lib/consent/inventory';
import { StorageList } from './StorageList';

describe('StorageList on the Privacy page (M45-S11 AC3)', () => {
  const html = renderToStaticMarkup(<StorageList />);

  it('is the target of the notice link and has a heading and a captioned table', () => {
    expect(html).toContain('id="storage"');
    expect(html).toContain('What we store on your device');
    expect(html).toContain('<caption');
  });

  it('lists every visitor entry from the shared inventory with its real name and how long it is kept', () => {
    for (const item of visitorInventory()) {
      expect(html, item.name).toContain(item.name.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      expect(html, item.name).toContain(item.kept);
    }
  });

  it('leaves out staff only rows and shows no build markers', () => {
    expect(html).not.toContain('ad.upload.');
    expect(html).not.toMatch(/confirm at build/i);
  });

  it('names the guest Kids mode choice and the import answer', () => {
    expect(html).toContain('__Host-ad_gaud');
    expect(html).toContain('ad:guest:import-asked');
  });

  it('says there is no advertising or tracking from other companies', () => {
    expect(html).toContain('no advertising');
  });

  it('has column headers for name, what it does, kept and type', () => {
    for (const label of ['Name', 'What it does', 'Kept', 'Type']) {
      expect(html).toContain(`>${label}</th>`);
    }
  });
});
