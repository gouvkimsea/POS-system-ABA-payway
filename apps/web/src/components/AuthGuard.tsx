'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { PermissionCode, RoleCode } from '@pos/types';
import { Card, Button } from '@pos/ui';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: PermissionCode;
  requiredRole?: RoleCode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requiredPermission,
  requiredRole,
}) => {
  const { user, isLoading, hasPermission, hasRole, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check required permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card title="Access Denied" description="Insufficient Permissions">
            <div className="space-y-4">
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-md text-amber-300 text-xs">
                Your account (<strong className="text-white">{user.username}</strong>) does not have permission:{' '}
                <code className="bg-amber-900/60 text-amber-200 px-1 py-0.5 rounded font-mono font-semibold">
                  {requiredPermission}
                </code>
              </div>
              <div className="text-xs text-slate-400">
                Your roles:{' '}
                {user.roles.map((r) => (
                  <span
                    key={r}
                    className="inline-block bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded mr-1 font-semibold"
                  >
                    {r}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
                  Go to Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={logout}>
                  Log Out
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Check required role
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card title="Access Denied" description="Role Restricted">
            <div className="space-y-4">
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-md text-rose-300 text-xs">
                This area requires the <strong>{requiredRole}</strong> role.
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
