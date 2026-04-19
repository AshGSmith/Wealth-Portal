import Link from 'next/link';
import AuthScreen from '@/components/auth/AuthScreen';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { auth, getResetTokenUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (session) redirect('/dashboard');

  const { token } = await params;
  const user = getResetTokenUser(token);

  return (
    <AuthScreen
      eyebrow="Password Reset"
      title="Reset password"
      description={user
        ? `Choose a strong new password for ${user.email}.`
        : 'This reset link is invalid or has expired. You can request a new one below.'}
      footer={!user ? (
        <Link href="/forgot-password" className="font-medium" style={{ color: 'var(--primary)' }}>
          Request a new reset link
        </Link>
      ) : undefined}
    >
      {user ? <ResetPasswordForm token={token} /> : null}
    </AuthScreen>
  );
}
