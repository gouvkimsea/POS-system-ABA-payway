import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartPOS — Enterprise Point of Sale',
  description: 'Production-ready touch-first commercial Point of Sale system with dual currency and offline capability.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevent accidental pinch zooming on touchscreen POS terminals
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="antialiased min-h-screen bg-slate-100 text-slate-900 select-none overflow-hidden">
        {children}
      </body>
    </html>
  );
}
