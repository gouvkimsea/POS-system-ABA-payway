'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
  queuedCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  queuedCount,
  isSyncing,
  onSyncNow,
}) => {
  if (isOnline && queuedCount === 0) return null;

  return (
    <div
      className={`px-4 py-2 text-xs flex items-center justify-between transition-all shrink-0 select-none ${
        !isOnline
          ? 'bg-amber-600 text-white'
          : 'bg-blue-600 text-white'
      }`}
    >
      <div className="flex items-center space-x-2">
        {!isOnline ? <WifiOff className="w-4 h-4" /> : <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
        <span>
          {!isOnline
            ? `Offline Mode Active — ${queuedCount} order(s) queued locally in IndexedDB`
            : `${queuedCount} offline order(s) waiting to be synced to backend server`}
        </span>
      </div>

      {isOnline && queuedCount > 0 && (
        <button
          onClick={onSyncNow}
          disabled={isSyncing}
          className="px-3 py-1 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-md transition shadow-xs flex items-center space-x-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      )}
    </div>
  );
};
