import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@ad/ui/tokens.css';
import './globals.css';
import { DEFAULT_PLATFORM_NAME } from '../lib/platform';

export const metadata: Metadata = {
  title: DEFAULT_PLATFORM_NAME,
  description: 'Free learning videos for everyone.',
};

export const viewport: Viewport = {
  themeColor: '#1F6FB5',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
