import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/admin/AuthLayout';
import { Banner } from '@/components/admin/states';
import { getActor, safeNext } from '@/lib/data/admin/session-next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getActor()) redirect(next);
  return (
    <AuthLayout
      title="Admin sign in"
      lead="Use your staff email and password."
      notice={
        params.expired ? (
          <Banner tone="warning">Your session ended after 30 minutes without activity. Sign in to continue.</Banner>
        ) : null
      }
    >
      <LoginForm next={next} />
    </AuthLayout>
  );
}
