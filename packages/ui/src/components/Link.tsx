'use client';

import { createContext, useContext, type AnchorHTMLAttributes, type ComponentType } from 'react';

export type LinkComponent = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement>>;

const LinkContext = createContext<LinkComponent | 'a'>('a');

/** The app supplies next/link here so package components navigate without a full reload. */
export function LinkProvider({
  component,
  children,
}: {
  component: LinkComponent;
  children: React.ReactNode;
}) {
  return <LinkContext.Provider value={component}>{children}</LinkContext.Provider>;
}

export function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const Component = useContext(LinkContext);
  return <Component {...props} />;
}
