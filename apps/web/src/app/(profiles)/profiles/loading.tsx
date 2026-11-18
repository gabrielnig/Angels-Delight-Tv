'use client';

import { useEffect, useState } from 'react';
import { PickerScreen } from '../../../components/profiles/ProfileScreens';
import { hintFromCookie } from '../../../lib/profiles/picker-cache';

/**
 * Shown while the picker page loads. The cached tiles from the last visit appear straight away on a slow network
 * (M03-S13). Whose cache it is comes from the account hint cookie, so a list from another account never shows.
 */
export default function ProfilesLoading() {
  const [accountId, setAccountId] = useState<string | null>(null);
  useEffect(() => setAccountId(hintFromCookie(document.cookie) ?? ''), []);
  return <PickerScreen accountId={accountId ?? ''} profiles="loading" max={99} mode="pick" />;
}
