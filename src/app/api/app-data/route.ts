import { NextResponse } from 'next/server';
import { getAuthView } from '@/lib/auth/server';
import {
  filterPersistedAppDataForUser,
  getPersistedAppData,
  normalizePersistedAppData,
  savePersistedAppDataForUser,
} from '@/lib/data/server';

export const dynamic = 'force-dynamic';

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET() {
  const auth = await getAuthView();
  if (!auth) return unauthorizedResponse();

  const accessibleUserIds = auth.accessibleUsers.map(user => user.id);
  const data = filterPersistedAppDataForUser(getPersistedAppData(), accessibleUserIds);

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function PUT(request: Request) {
  const auth = await getAuthView();
  if (!auth) return unauthorizedResponse();

  const accessibleUserIds = auth.accessibleUsers.map(user => user.id);
  const body = await request.json().catch(() => null);
  const payload = normalizePersistedAppData(body);
  const data = savePersistedAppDataForUser(payload, accessibleUserIds);

  return NextResponse.json(filterPersistedAppDataForUser(data, accessibleUserIds), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
