'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { LinkProvider, ToastProvider } from '@ad/ui';

function NextLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { href, children, ...rest } = props;
  return (
    <Link href={href ?? '#'} {...rest}>
      {children}
    </Link>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LinkProvider component={NextLink}>
      <ToastProvider>{children}</ToastProvider>
    </LinkProvider>
  );
}
