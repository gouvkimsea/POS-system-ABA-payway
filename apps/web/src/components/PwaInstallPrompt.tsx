'use client';

import React, { useState, useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosTip, setShowIosTip] = useState<boolean>(false);
  const [installed, setInstalled] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already installed / standalone
    if (typeof window !== 'undefined') {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);

      // 2. Detect iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIos(isIosDevice);

      // 3. Listen for Chrome/Edge/Android beforeinstallprompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      const handleAppInstalled = () => {
        setInstalled(true);
        setDeferredPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  if (isStandalone || installed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosTip(true);
    }
  };

  return (
    <>
      {/* Install Button Trigger */}
      {(deferredPrompt || isIos) && (
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
          title="Install Angkor POS App to home screen / desktop"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      )}

      {/* iOS Instructions Sheet */}
      {showIosTip && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full text-slate-100 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Share className="w-4 h-4 text-indigo-400" />
                <span>Install on iPhone / iPad</span>
              </h3>
              <button
                onClick={() => setShowIosTip(false)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-300">
              <p>To install Angkor POS on iOS for fullscreen offline use:</p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-400">
                <li>
                  Tap the <strong className="text-white">Share</strong> button (box with arrow) in
                  Safari.
                </li>
                <li>
                  Scroll down and select{' '}
                  <strong className="text-white">"Add to Home Screen"</strong>.
                </li>
                <li>
                  Tap <strong className="text-indigo-400">Add</strong> in the top-right corner.
                </li>
              </ol>
            </div>
            <button
              onClick={() => setShowIosTip(false)}
              className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
