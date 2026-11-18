'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { SearchBox } from './SearchBox';
import { suggestAction } from '../../app/actions';

export function SearchScreen({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  return (
    <SearchBox
      autoFocus={!initialValue}
      initialValue={initialValue}
      loadSuggestions={suggestAction}
      onLiveQuery={(q) =>
        startTransition(() => router.replace(q ? `/search?q=${encodeURIComponent(q)}` : '/search'))
      }
      onSearch={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
      onNavigate={(href) => router.push(href)}
    />
  );
}
