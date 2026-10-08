import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';
import { SettingsProvider } from '../lib/settings-context';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import { BottomNavigation } from '../components/BottomNavigation';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  title: 'Angkor Fresh Mart POS',
  description: 'Enterprise Point of Sale System & Multi-Branch Retail Management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Angkor POS',
  },
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-192.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <AuthProvider>
          <SettingsProvider>
            <ServiceWorkerRegister />
            {children}
            <BottomNavigation />
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
