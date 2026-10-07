'use client';

import React, { useEffect, useState } from 'react';
import { StatusBadge, Card, Button } from '@pos/ui';
import { SystemHealthCheck } from '@pos/types';

export default function FoundationPage() {
  const [health, setHealth] = useState<SystemHealthCheck | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/health`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: SystemHealthCheck = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Unable to reach API server');
      setHealth(null);
    } finally {
      setLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      {/* Top Banner */}
      <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Enterprise Point of Sale
            </h1>
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
              Foundation Stage
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Production-grade monorepo architecture verification & connectivity test
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={checkHealth} disabled={loading}>
            {loading ? 'Testing...' : 'Refresh Health Check'}
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend & Services Connection Card */}
        <Card title="Full-Stack Connectivity Status" description={`API Endpoint: ${apiUrl}/health`}>
          {loading && !health && !error && (
            <div className="py-8 text-center text-slate-500 text-sm">
              Connecting to backend services...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
              <div className="font-semibold flex items-center gap-2 mb-1">
                <StatusBadge status="disconnected" label="Offline" />
                Backend Connection Failed
              </div>
              <p className="text-xs">{error}</p>
              <p className="text-xs text-rose-600 mt-2">
                Ensure backend API is running on port 4000 (`pnpm --filter @pos/api dev`).
              </p>
            </div>
          )}

          {health && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200">
                <div className="text-sm font-medium text-slate-800">Overall System Health</div>
                <StatusBadge status={health.status} />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200">
                <div>
                  <div className="text-sm font-medium text-slate-800">PostgreSQL Database</div>
                  <div className="text-xs text-slate-500">
                    {health.services.database.latencyMs !== undefined
                      ? `Latency: ${health.services.database.latencyMs}ms`
                      : 'Prisma Client Connected'}
                  </div>
                </div>
                <StatusBadge status={health.services.database.status} />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200">
                <div>
                  <div className="text-sm font-medium text-slate-800">Redis Cache Layer</div>
                  <div className="text-xs text-slate-500">
                    {health.services.redis.status === 'in-memory-fallback'
                      ? 'Local In-Memory Cache Active'
                      : 'Standalone Redis Connected'}
                  </div>
                </div>
                <StatusBadge status={health.services.redis.status} />
              </div>

              <div className="pt-2 text-xs text-slate-400 flex justify-between">
                <span>Server Uptime: {health.uptimeSeconds}s</span>
                <span>Environment: {health.environment}</span>
                <span>Last verified: {lastChecked}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Monorepo Architecture Overview Card */}
        <Card
          title="Monorepo Package Architecture"
          description="Modular boundaries verified across workspaces"
        >
          <ul className="divide-y divide-slate-100 text-sm">
            <li className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-indigo-600">apps/web</span>
                <p className="text-xs text-slate-500">Next.js 14 App Router, React 18, Tailwind</p>
              </div>
              <span className="text-xs font-medium text-emerald-600">Active</span>
            </li>
            <li className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-indigo-600">apps/api</span>
                <p className="text-xs text-slate-500">Node.js Express, TypeScript, Pino Logger</p>
              </div>
              <span className="text-xs font-medium text-emerald-600">Ready</span>
            </li>
            <li className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-indigo-600">
                  packages/types
                </span>
                <p className="text-xs text-slate-500">Shared TypeScript contracts & DTOs</p>
              </div>
              <span className="text-xs font-medium text-emerald-600">Linked</span>
            </li>
            <li className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-indigo-600">
                  packages/config
                </span>
                <p className="text-xs text-slate-500">Zod environment & system constants</p>
              </div>
              <span className="text-xs font-medium text-emerald-600">Linked</span>
            </li>
            <li className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-indigo-600">packages/ui</span>
                <p className="text-xs text-slate-500">
                  Accessible UI primitives (StatusBadge, Card, Button)
                </p>
              </div>
              <span className="text-xs font-medium text-emerald-600">Linked</span>
            </li>
            <li className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-indigo-600">prisma/</span>
                <p className="text-xs text-slate-500">
                  PostgreSQL schema, migrations, connection layer
                </p>
              </div>
              <span className="text-xs font-medium text-emerald-600">Configured</span>
            </li>
          </ul>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="mt-8 p-4 bg-slate-100 rounded-lg text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div>
          Default Localization:{' '}
          <span className="font-semibold text-slate-800">USD & KHR (1 USD = 4,100 KHR)</span> |
          Timezone: <span className="font-semibold text-slate-800">Asia/Phnom_Penh</span>
        </div>
        <div>POS Architecture Foundation v1.0.0</div>
      </div>
    </main>
  );
}
