/** Settings the help recording stack starts with so the Donate and transparency pages exist. Clearly fake demo wording. */
export const KB_DEMO_MONEY_SETTINGS = {
  'donate.enabled': true,
  'donate.org_name': 'Demo Organisation (test)',
  'donate.bank_transfer.enabled': true,
  'donate.bank_transfer.instructions': 'Demo bank, account name Demo Organisation (test), account number 0000000000. Test text only.',
  'donate.transparency.enabled': true,
  'donate.transparency.intro': 'Test figures for the help videos.',
  'donate.transparency.items': [
    { label: 'Hosting', percent: 50, note: 'Test line' },
    { label: 'Captions', percent: 30, note: 'Test line' },
    { label: 'New lessons', percent: 20, note: 'Test line' },
  ],
  'donate.transparency.updated_at': '2026-03-01',
};
