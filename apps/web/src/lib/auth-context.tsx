'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, LoginResult, PermissionCode, RoleCode } from '@pos/types';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  pinLogin: (username: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasPermission: (permission: PermissionCode) => boolean;
  hasRole: (role: RoleCode) => boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'pos_access_token';
const REFRESH_KEY = 'pos_refresh_token';
const USER_KEY = 'pos_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const saveSession = useCallback((data: LoginResult) => {
    localStorage.setItem(TOKEN_KEY, data.tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, data.tokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    setToken(data.tokens.accessToken);
    setError(null);
  }, []);

  // Initialize and validate session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);

        if (!savedToken || !savedUser) {
          setIsLoading(false);
          return;
        }

        setToken(savedToken);
        setUser(JSON.parse(savedUser));

        // Validate token with backend /api/auth/me
        const res = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (!res.ok) {
          // Token expired, attempt refresh
          const savedRefresh = localStorage.getItem(REFRESH_KEY);
          if (savedRefresh) {
            const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: savedRefresh }),
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              const newToken = refreshData.data.accessToken;
              localStorage.setItem(TOKEN_KEY, newToken);
              setToken(newToken);
              setIsLoading(false);
              return;
            }
          }
          clearSession();
        }
      } catch (err) {
        console.warn(
          '[Auth] Session check failed, preserving local cached session if available:',
          err,
        );
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [apiUrl, clearSession]);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      saveSession(data.data);
      return true;
    } catch (err: any) {
      setError(err.message || 'Unable to connect to server');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const pinLogin = async (username: string, pin: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'PIN login failed');
      }

      saveSession(data.data);
      return true;
    } catch (err: any) {
      setError(err.message || 'Unable to connect to server');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const savedRefresh = localStorage.getItem(REFRESH_KEY);
      if (token) {
        await fetch(`${apiUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ refreshToken: savedRefresh }),
        });
      }
    } catch (err) {
      console.warn('[Auth] Logout network error:', err);
    } finally {
      clearSession();
    }
  };

  const hasPermission = (permission: PermissionCode): boolean => {
    if (!user) return false;
    if (user.roles.includes('ADMIN')) return true;
    return user.permissions.includes(permission);
  };

  const hasRole = (role: RoleCode): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        pinLogin,
        logout,
        hasPermission,
        hasRole,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
