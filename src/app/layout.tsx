import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/lib/theme';
import { AppProvider }   from '@/lib/store';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Wealth Management Portal',
  description: 'Track your finances, budget, and wealth in one place.',
  icons: { icon: '/logo.jpg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <AppProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <div className="flex flex-1 mx-auto w-full max-w-5xl">
              <Sidebar />
              <main className="flex-1 min-w-0 p-4 pb-24 md:pb-6 md:p-6" style={{ background: 'var(--background)' }}>
                {children}
              </main>
            </div>
          </div>
          <BottomNav />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
