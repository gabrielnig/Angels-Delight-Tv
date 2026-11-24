'use client';

import { loadMoreHomeRowsAction } from '../../app/actions';
import { LazyHomeRows } from './LazyHomeRows';

/** Binds the lazy rows to the server action. */
export function HomeRowsLoader(props: {
  initialCursor: string;
  inList: string[];
  profileId: string;
  viewAllLabel?: string;
}) {
  return <LazyHomeRows {...props} load={loadMoreHomeRowsAction} />;
}
