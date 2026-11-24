'use client';

import { loadMoreMyListAction } from '../../app/actions';
import { MyListGrid, type MyListGridProps } from './MyListGrid';

export function MyListScreen(props: Omit<MyListGridProps, 'loadMore' | 'remove' | 'add'>) {
  return (
    <MyListGrid
      {...props}
      loadMore={(cursor) =>
        loadMoreMyListAction(cursor, { filter: props.filter, sort: props.sort })
      }
    />
  );
}
