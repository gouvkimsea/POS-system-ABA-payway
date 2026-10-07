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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Verifying session credentials...</p>
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
      <div className="max-w-md mx-auto mt-20 px-4">
        <Card title="Access Denied" description="Insufficient Permissions">
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs">
              Your account (<strong>{user.username}</strong>) does not possess the required
              permission:{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-semibold">
                {requiredPermission}
              </code>
            </div>
            <div className="text-xs text-slate-500">
              Your assigned roles:{' '}
              {user.roles.map((r) => (
                <span
                  key={r}
                  className="inline-block bg-slate-100 px-2 py-0.5 rounded mr-1 font-semibold"
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
    );
  }

  // Check required role
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <Card title="Access Denied" description="Role Restricted">
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">
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
    );
  }

  return <>{children}</>;
};
