'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  clearSessionCookie,
  consumeResetToken,
  createPasswordReset,
  createUser,
  deleteUser,
  sendUserInvitation,
  requireAdminUser,
  signIn,
  signOut,
  startImpersonation,
  stopImpersonation,
  updateUser,
  setUserPassword,
  getResetTokenUser,
} from '@/lib/auth/server';

export type AuthFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const loginSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.email().trim(),
});

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[0-9]/, 'Password must include a number.');

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string().min(1),
}).refine(values => values.password === values.confirmPassword, {
  message: 'Passwords must match.',
  path: ['confirmPassword'],
});

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters.').trim(),
  email: z.email().trim(),
  dateOfBirth: z.string().optional(),
  isAdmin: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const createUserSchema = userSchema;

const adminPasswordResetSchema = z.object({
  userId: z.string().min(1),
  password: passwordSchema,
});

export async function loginAction(_state: AuthFormState | undefined, formData: FormData): Promise<AuthFormState | undefined> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    rememberMe: formData.get('rememberMe') === 'on',
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: 'Please check your email and password.',
    };
  }

  const session = await signIn(parsed.data.email, parsed.data.password, Boolean(parsed.data.rememberMe));
  if (!session) {
    return { message: 'We could not sign you in with those details.' };
  }

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await signOut();
  await clearSessionCookie();
  redirect('/login');
}

export async function forgotPasswordAction(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState | undefined> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: 'Please enter a valid email address.',
    };
  }

  await createPasswordReset(parsed.data.email);
  return {
    message: 'If that email is registered, a password reset link has been sent.',
  };
}

export async function resetPasswordAction(
  _state: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState | undefined> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: 'Please review the password fields below.',
    };
  }

  const validUser = getResetTokenUser(parsed.data.token);
  if (!validUser) {
    return { message: 'This reset link is invalid or has expired.' };
  }

  const updatedUser = consumeResetToken(parsed.data.token, parsed.data.password);
  if (!updatedUser) {
    return { message: 'This reset link is invalid or has expired.' };
  }

  redirect('/login?reset=success');
}

export async function createUserAction(formData: FormData): Promise<{ error?: string }> {
  await requireAdminUser();

  const parsed = createUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    dateOfBirth: formData.get('dateOfBirth') || undefined,
    isAdmin: formData.get('isAdmin') === 'on',
    isActive: formData.get('isActive') !== 'off',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Unable to create user.' };
  }

  try {
    const createdUser = createUser(parsed.data);
    await sendUserInvitation(createdUser.email);
    revalidatePath('/users');
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create user.' };
  }
}

export async function updateUserAction(formData: FormData): Promise<{ error?: string }> {
  await requireAdminUser();

  const parsed = userSchema.extend({ id: z.string().min(1) }).safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    email: formData.get('email'),
    dateOfBirth: formData.get('dateOfBirth') || undefined,
    isAdmin: formData.get('isAdmin') === 'on',
    isActive: formData.get('isActive') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Unable to save user.' };
  }

  try {
    updateUser({
      ...parsed.data,
      linkedUserIds: formData.getAll('linkedUserIds').map(value => String(value)),
    });
    revalidatePath('/users');
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to save user.' };
  }
}

export async function adminResetPasswordAction(formData: FormData): Promise<{ error?: string }> {
  await requireAdminUser();

  const parsed = adminPasswordResetSchema.safeParse({
    userId: formData.get('userId'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Unable to reset password.' };
  }

  setUserPassword(parsed.data.userId, parsed.data.password);
  revalidatePath('/users');
  return {};
}

export async function deleteUserAction(formData: FormData): Promise<{ error?: string }> {
  const session = await requireAdminUser();
  const actingUser = session.originalUser ?? session.user;
  const targetUserId = String(formData.get('userId') || '');

  if (!targetUserId) {
    return { error: 'User id is required.' };
  }

  if (targetUserId === actingUser.id || targetUserId === session.user.id) {
    return { error: 'You cannot delete the account currently in use.' };
  }

  try {
    deleteUser(targetUserId);
    revalidatePath('/users');
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to delete user.' };
  }
}

export async function impersonateUserAction(formData: FormData): Promise<void> {
  await requireAdminUser();
  const userId = String(formData.get('userId') || '');
  await startImpersonation(userId);
  redirect('/dashboard');
}

export async function stopImpersonationAction(): Promise<void> {
  await stopImpersonation();
  redirect('/users');
}
