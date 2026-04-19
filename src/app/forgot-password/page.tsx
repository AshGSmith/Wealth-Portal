import { redirect } from 'next/navigation';
import AuthScreen from '@/components/auth/AuthScreen';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import { auth } from '@/lib/auth/server';

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <AuthScreen
      eyebrow="Password Reset"
      title="Forgot password"
      description="Enter your email address and we’ll send a secure reset link if an account exists for it."
    >
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
