import { redirect } from 'next/navigation';
import AuthScreen from '@/components/auth/AuthScreen';
import LoginForm from '@/components/auth/LoginForm';
import { auth } from '@/lib/auth/server';
import packageJson from '../../../package.json';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const session = await auth();
  if (session) redirect('/dashboard');
  const params = await searchParams;

  return (
    <AuthScreen
      eyebrow="Secure Access"
      title="Sign in"
      description="Use your email and password to access your finances. If you chose Remember Me before, returning here will take you straight back in."
      footer={
        <p className="text-center text-[11px]" style={{ color: 'var(--muted)' }}>
          v{packageJson.version}
        </p>
      }
    >
      <LoginForm resetSuccess={params.reset === 'success'} />
    </AuthScreen>
  );
}
