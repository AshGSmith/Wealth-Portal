import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/lib/theme';
import { AppProvider }   from '@/lib/store';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import LegacyDataMigrationBanner from '@/components/layout/LegacyDataMigrationBanner';
import { getAuthView, isBirthdayMonth } from '@/lib/auth/server';
import { stopImpersonationAction } from '@/lib/auth/actions';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Wealth Management Portal',
  description: 'Track your finances, budget, and wealth in one place.',
  applicationName: 'WealthPortal',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WealthPortal',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthView();
  const showBirthdayMessage = auth ? isBirthdayMonth(auth.user.dateOfBirth) : false;
  const appProviderKey = auth
    ? `${auth.user.id}:${auth.originalUser?.id ?? 'self'}`
    : 'anonymous';

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <AppProvider
            key={appProviderKey}
            currentUserId={auth?.user.id ?? null}
            accessibleUsers={auth?.accessibleUsers ?? []}
          >
          <div className="flex flex-col min-h-screen">
            <Header auth={auth} />
            {auth?.isImpersonating && auth.originalUser && (
              <div className="border-b" style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}>
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">
                      Impersonation mode
                    </p>
                    <p className="text-xs sm:text-sm">
                      Viewing the app as {auth.user.name} while signed in as {auth.originalUser.name}.
                    </p>
                  </div>
                  <form action={stopImpersonationAction}>
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}
                    >
                      Return to my account
                    </button>
                  </form>
                </div>
              </div>
            )}
            {showBirthdayMessage && (
              <div className="border-b" style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', borderColor: 'var(--border)', color: 'var(--primary)' }}>
                <div className="mx-auto max-w-5xl px-4 py-2 text-sm">
                  Your birthday is this month, Happy Birthday!
                </div>
              </div>
            )}
            {auth && <LegacyDataMigrationBanner />}
            <div className="flex flex-1 mx-auto w-full max-w-5xl">
              <Sidebar isAdmin={auth?.user.isAdmin ?? false} />
              <main
                className="flex-1 min-w-0 p-4 md:pb-6 md:p-6"
                style={{
                  background: 'var(--background)',
                  paddingBottom: 'calc(6.5rem + var(--safe-area-bottom))',
                }}
              >
                {children}
              </main>
            </div>
          </div>
          <BottomNav isAdmin={auth?.user.isAdmin ?? false} />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
