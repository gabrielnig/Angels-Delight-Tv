'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LanguagePicker, type PickerLocale } from '@ad/ui';
import { msg } from '@ad/shared/messages';
import { setLanguageAction } from '../../app/actions-language';
import { rememberLocale } from '../../lib/i18n/stored-locale';

/** Wires the picker to the server action and refreshes the page in the new language. */
export function LanguagePickerHost({
  locales,
  current,
  incomplete,
}: {
  locales: PickerLocale[];
  current: string;
  incomplete?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <LanguagePicker
      locales={locales}
      current={current}
      incomplete={incomplete}
      labels={{
        button: msg('language.picker.button'),
        menu: msg('language.picker.menu'),
        stillEnglish: msg('language.picker.stillEnglish'),
      }}
      onSelect={(code) =>
        start(async () => {
          const result = await setLanguageAction(code);
          if (result.ok) {
            rememberLocale(result.locale);
            router.refresh();
          }
        })
      }
    />
  );
}
