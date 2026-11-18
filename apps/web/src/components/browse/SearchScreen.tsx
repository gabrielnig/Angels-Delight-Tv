'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { SearchBox } from './SearchBox';
import { SearchProgress } from './SearchProgress';
import { suggestAction } from '../../app/actions';

export function SearchScreen({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <SearchBox
        autoFocus={!initialValue}
        initialValue={initialValue}
        loadSuggestions={suggestAction}
        onLiveQuery={(q) =>
          startTransition(() =>
            router.replace(q ? `/search?q=${encodeURIComponent(q)}` : '/search'),
          )
        }
        onSearch={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
        onNavigate={(href) => router.push(href)}
      />
      <SearchProgress active={pending} />
    </>
  );
}
