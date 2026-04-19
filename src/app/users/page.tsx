import PageHeader from '@/components/layout/PageHeader';
import UsersManager from '@/components/users/UsersManager';
import { listUsers, requireAdminUser } from '@/lib/auth/server';

export default async function UsersPage() {
  const session = await requireAdminUser();
  const users = listUsers();
  const actingUser = session.originalUser ?? session.user;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${users.length} users`}
      />
      <UsersManager currentUserId={actingUser.id} users={users} />
    </>
  );
}
