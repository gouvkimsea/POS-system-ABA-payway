'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../../components/AuthGuard';
import { useAuth } from '../../../lib/auth-context';
import {
  Truck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Package,
  ChevronRight,
  X,
  AlertCircle,
  Check,
  Layers,
} from 'lucide-react';

interface TransferItem {
  id: string;
  transferId: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  sku: string;
  unit: string;
  requestedQuantity: number;
  sentQuantity: number;
  receivedQuantity: number;
  notes?: string | null;
}

interface TransferRecord {
  id: string;
  transferNumber: string;
  businessId: string;
  sourceStoreId: string;
  sourceStoreName: string;
  targetStoreId: string;
  targetStoreName: string;
  status: 'REQUESTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  requestedById: string;
  requestedByName: string;
  sentById?: string | null;
  sentByName?: string | null;
  receivedById?: string | null;
  receivedByName?: string | null;
  requestedAt: string;
  sentAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
  itemsCount: number;
  items: TransferItem[];
  createdAt: string;
  updatedAt: string;
}

interface StoreOption {
  id: string;
  name: string;
  code: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unit: string;
  sellingPriceUSD: number;
  stockQuantity: number;
}

export default function TransfersPage() {
  return (
    <AuthGuard>
      <TransfersContent />
    </AuthGuard>
  );
}

function TransfersContent() {
  const { token } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  // State
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Transfer for detail drawer / actions
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState<{
    sourceStoreId: string;
    targetStoreId: string;
    notes: string;
    items: { productId: string; requestedQuantity: number; notes: string }[];
  }>({
    sourceStoreId: '',
    targetStoreId: '',
    notes: '',
    items: [{ productId: '', requestedQuantity: 1, notes: '' }],
  });

  // Send Form State
  const [sendForm, setSendForm] = useState<{
    notes: string;
    items: { productId: string; sentQuantity: number; notes: string }[];
  }>({
    notes: '',
    items: [],
  });

  // Receive Form State
  const [receiveForm, setReceiveForm] = useState<{
    notes: string;
    items: { productId: string; receivedQuantity: number; notes: string }[];
  }>({
    notes: '',
    items: [],
  });

  // 1. Fetch Transfers list
  const fetchTransfers = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (storeFilter !== 'ALL') params.set('storeId', storeFilter);

      const res = await fetch(`${apiUrl}/transfers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setTransfers(json.data || []);
      // If a transfer was selected, refresh its reference
      if (selectedTransfer) {
        const updated = (json.data || []).find((t: TransferRecord) => t.id === selectedTransfer.id);
        if (updated) setSelectedTransfer(updated);
      }
    } catch (err: any) {
      console.error('Failed to load transfers:', err);
      setError(err.message || 'Failed to fetch inventory transfers');
    } finally {
      setIsLoading(false);
    }
  }, [token, apiUrl, statusFilter, storeFilter, selectedTransfer?.id]);

  // 2. Fetch metadata (stores & products)
  const fetchMetadata = useCallback(async () => {
    if (!token) return;
    try {
      const [storesRes, productsRes] = await Promise.all([
        fetch(`${apiUrl}/stores`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/catalog/products?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (storesRes.ok) {
        const sJson = await storesRes.json();
        setStores(sJson.data || []);
      }
      if (productsRes.ok) {
        const pJson = await productsRes.json();
        setProducts(pJson.data || []);
      }
    } catch (err) {
      console.error('Failed to load stores/products metadata:', err);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchTransfers();
  }, [statusFilter, storeFilter]);

  // Filter transfers locally by search query
  const filteredTransfers = transfers.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.transferNumber.toLowerCase().includes(q) ||
      t.sourceStoreName.toLowerCase().includes(q) ||
      t.targetStoreName.toLowerCase().includes(q) ||
      t.requestedByName.toLowerCase().includes(q) ||
      (t.sentByName && t.sentByName.toLowerCase().includes(q)) ||
      (t.receivedByName && t.receivedByName.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q)) ||
      t.items.some(
        (item) => item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q),
      )
    );
  });

  // Calculate Metrics
  const totalCount = transfers.length;
  const inTransitCount = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
  const requestedCount = transfers.filter((t) => t.status === 'REQUESTED').length;
  const completedCount = transfers.filter((t) => t.status === 'COMPLETED').length;

  // Handle New Transfer Request
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.sourceStoreId || !createForm.targetStoreId) {
      setActionError('Please select both source and destination stores');
      return;
    }
    if (createForm.sourceStoreId === createForm.targetStoreId) {
      setActionError('Source store and destination store must be different');
      return;
    }
    const validItems = createForm.items.filter(
      (item) => item.productId && item.requestedQuantity > 0,
    );
    if (validItems.length === 0) {
      setActionError('Please add at least one item with a valid quantity');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${apiUrl}/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceStoreId: createForm.sourceStoreId,
          targetStoreId: createForm.targetStoreId,
          notes: createForm.notes,
          items: validItems.map((item) => ({
            productId: item.productId,
            requestedQuantity: Number(item.requestedQuantity),
            notes: item.notes || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${res.status}`);
      }

      setShowCreateModal(false);
      setCreateForm({
        sourceStoreId: '',
        targetStoreId: '',
        notes: '',
        items: [{ productId: '', requestedQuantity: 1, notes: '' }],
      });
      fetchTransfers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create transfer request');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Send Modal
  const openSendModal = (t: TransferRecord) => {
    setSelectedTransfer(t);
    setSendForm({
      notes: t.notes || '',
      items: t.items.map((i) => ({
        productId: i.productId,
        sentQuantity: i.requestedQuantity, // default sent quantity to requested quantity
        notes: i.notes || '',
      })),
    });
    setActionError(null);
    setShowSendModal(true);
  };

  // Submit Send / Dispatch
  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${apiUrl}/transfers/${selectedTransfer.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notes: sendForm.notes,
          items: sendForm.items.map((item) => ({
            productId: item.productId,
            sentQuantity: Number(item.sentQuantity),
            notes: item.notes || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${res.status}`);
      }

      setShowSendModal(false);
      fetchTransfers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to dispatch inventory transfer');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Receive Modal
  const openReceiveModal = (t: TransferRecord) => {
    setSelectedTransfer(t);
    setReceiveForm({
      notes: t.notes || '',
      items: t.items.map((i) => ({
        productId: i.productId,
        receivedQuantity: i.sentQuantity, // default received quantity to sent quantity
        notes: i.notes || '',
      })),
    });
    setActionError(null);
    setShowReceiveModal(true);
  };

  // Submit Receive / Receipt
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${apiUrl}/transfers/${selectedTransfer.id}/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notes: receiveForm.notes,
          items: receiveForm.items.map((item) => ({
            productId: item.productId,
            receivedQuantity: Number(item.receivedQuantity),
            notes: item.notes || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${res.status}`);
      }

      setShowReceiveModal(false);
      fetchTransfers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to confirm inventory receipt');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Transfer
  const handleCancelTransfer = async (t: TransferRecord) => {
    const isTransiting = t.status === 'IN_TRANSIT';
    const confirmMessage = isTransiting
      ? `This transfer is currently IN_TRANSIT. Cancelling will automatically RETURN deducted stock back to ${t.sourceStoreName}. Proceed?`
      : 'Are you sure you want to cancel this transfer request?';

    if (!window.confirm(confirmMessage)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/transfers/${t.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: 'Cancelled by operator via portal' }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${res.status}`);
      }

      fetchTransfers();
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: TransferRecord['status']) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>REQUESTED</span>
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 animate-pulse">
            <Truck className="w-3.5 h-3.5" />
            <span>IN TRANSIT</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>COMPLETED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>CANCELLED</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                Inter-Store Inventory Transfers
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-sky-500/10 text-sky-400 border border-sky-500/30">
                STORE A &rarr; STORE B
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>
                Track requested, sent, and received quantities with end-to-end audit trails
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/inventory"
            className="hidden md:flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Catalog &amp; Stock</span>
          </Link>

          <Link
            href="/settings/stores"
            className="hidden lg:flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Manage Stores</span>
          </Link>

          <Link
            href="/pos"
            className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors items-center gap-1.5"
          >
            <span>POS Register</span>
          </Link>

          <button
            onClick={() => {
              setActionError(null);
              setShowCreateModal(true);
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Transfer</span>
          </button>

          <button
            onClick={fetchTransfers}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh transfers"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* 2. Top Summary KPI Cards */}
      <section className="px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Total Transfers</p>
              <h3 className="text-2xl font-black text-white mt-1">{totalCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-300">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-sky-400">In Transit</p>
              <h3 className="text-2xl font-black text-sky-300 mt-1">{inTransitCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Truck className="w-5 h-5 animate-pulse" />
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-400">Pending Requests</p>
              <h3 className="text-2xl font-black text-amber-300 mt-1">{requestedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-400">Completed Transfers</p>
              <h3 className="text-2xl font-black text-emerald-300 mt-1">{completedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Filters & Search Strip */}
      <section className="px-4 sm:px-6 pt-4 pb-2">
        <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
            {['ALL', 'REQUESTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            {/* Store Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800/80 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="bg-transparent text-slate-200 border-none outline-hidden text-xs font-medium cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">
                  All Branch Transits
                </option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search TRF #, product, sender, receiver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Main Transfers Table */}
      <main className="flex-1 px-4 sm:px-6 py-4 pb-24 lg:pb-8">
        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-4">Route (Store A &rarr; Store B)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Items &amp; Quantities</th>
                  <th className="py-3 px-4">Personnel (Sender / Receiver)</th>
                  <th className="py-3 px-4">Timestamps</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                      Loading inventory transfers...
                    </td>
                  </tr>
                ) : filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Truck className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      No inventory transfers found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((t) => {
                    const totalReq = t.items.reduce((acc, i) => acc + i.requestedQuantity, 0);
                    const totalSent = t.items.reduce((acc, i) => acc + i.sentQuantity, 0);
                    const totalRecv = t.items.reduce((acc, i) => acc + i.receivedQuantity, 0);

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedTransfer(t)}
                      >
                        {/* Transfer Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-sky-400 whitespace-nowrap">
                          {t.transferNumber}
                        </td>

                        {/* Route */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{t.sourceStoreName}</span>
                            <span className="text-sky-400 flex items-center">&rarr;</span>
                            <span className="font-semibold text-white">{t.targetStoreName}</span>
                          </div>
                          {t.notes && (
                            <p className="text-[11px] text-slate-400 italic truncate max-w-xs mt-0.5">
                              "{t.notes}"
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(t.status)}
                        </td>

                        {/* Items & Quantities */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-xs">
                            <span className="font-semibold text-white">{t.itemsCount} SKU(s)</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>
                              Req: <strong className="text-amber-400">{totalReq}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Sent: <strong className="text-sky-400">{totalSent}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Recv: <strong className="text-emerald-400">{totalRecv}</strong>
                            </span>
                          </div>
                        </td>

                        {/* Personnel */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-xs">
                            <span className="text-slate-400">Req: </span>
                            <span className="font-medium text-slate-200">{t.requestedByName}</span>
                          </div>
                          {t.sentByName && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              <span>Sent: </span>
                              <span className="text-sky-300">{t.sentByName}</span>
                            </div>
                          )}
                          {t.receivedByName && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              <span>Recv: </span>
                              <span className="text-emerald-300">{t.receivedByName}</span>
                            </div>
                          )}
                        </td>

                        {/* Timestamps */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-400">
                          <div>
                            <span>Req: </span>
                            <span className="text-slate-300 font-mono">
                              {new Date(t.requestedAt).toLocaleDateString()}{' '}
                              {new Date(t.requestedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {t.sentAt && (
                            <div className="mt-0.5">
                              <span>Sent: </span>
                              <span className="text-sky-300 font-mono">
                                {new Date(t.sentAt).toLocaleDateString()}{' '}
                                {new Date(t.sentAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
                          {t.receivedAt && (
                            <div className="mt-0.5">
                              <span>Recv: </span>
                              <span className="text-emerald-300 font-mono">
                                {new Date(t.receivedAt).toLocaleDateString()}{' '}
                                {new Date(t.receivedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
                          {t.cancelledAt && (
                            <div className="mt-0.5 text-rose-400">
                              <span>Cancelled: </span>
                              <span className="font-mono">
                                {new Date(t.cancelledAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td
                          className="py-3.5 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {/* If REQUESTED -> Dispatch button */}
                            {t.status === 'REQUESTED' && (
                              <button
                                onClick={() => openSendModal(t)}
                                className="px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/40 font-semibold text-xs transition flex items-center gap-1"
                                title="Dispatch transfer items from Store A"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Send</span>
                              </button>
                            )}

                            {/* If IN_TRANSIT -> Receive button */}
                            {t.status === 'IN_TRANSIT' && (
                              <button
                                onClick={() => openReceiveModal(t)}
                                className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 font-semibold text-xs transition flex items-center gap-1"
                                title="Confirm delivery and add stock to Store B"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Receive</span>
                              </button>
                            )}

                            {/* If REQUESTED or IN_TRANSIT -> Cancel button */}
                            {(t.status === 'REQUESTED' || t.status === 'IN_TRANSIT') && (
                              <button
                                onClick={() => handleCancelTransfer(t)}
                                className="p-1 rounded bg-slate-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition"
                                title="Cancel transfer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Detail Drawer trigger */}
                            <button
                              onClick={() => setSelectedTransfer(t)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                              title="View details & audit timeline"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ==============================================================================
          5. DETAILS & AUDIT TIMELINE DRAWER / MODAL
      ============================================================================== */}
      {selectedTransfer && !showSendModal && !showReceiveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Transfer {selectedTransfer.transferNumber}</span>
                    {getStatusBadge(selectedTransfer.status)}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Route:{' '}
                    <strong className="text-slate-200">{selectedTransfer.sourceStoreName}</strong>{' '}
                    &rarr;{' '}
                    <strong className="text-slate-200">{selectedTransfer.targetStoreName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTransfer(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 py-4 space-y-6">
              {/* Route Card */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Origin Store (A)
                    </span>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {selectedTransfer.sourceStoreName}
                    </p>
                    <p className="text-xs text-slate-400">Deduction of physical stock</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Destination Store (B)
                    </span>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {selectedTransfer.targetStoreName}
                    </p>
                    <p className="text-xs text-slate-400">Increment of physical stock</p>
                  </div>
                </div>
                {selectedTransfer.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300">
                    <span className="text-slate-500 font-semibold">Notes: </span>
                    <span>{selectedTransfer.notes}</span>
                  </div>
                )}
              </div>

              {/* Complete Audit Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Transfer Lifecycle Timeline</span>
                </h3>

                <div className="relative pl-6 space-y-4 border-l-2 border-slate-800 text-xs">
                  {/* 1. Requested */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-amber-500/20 border-2 border-amber-500" />
                    <p className="font-semibold text-white">Transfer Requested</p>
                    <p className="text-slate-400 text-[11px]">
                      By{' '}
                      <strong className="text-slate-200">{selectedTransfer.requestedByName}</strong>{' '}
                      on {new Date(selectedTransfer.requestedAt).toLocaleString()}
                    </p>
                  </div>

                  {/* 2. Sent / Dispatched */}
                  <div className="relative">
                    <div
                      className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full ${
                        selectedTransfer.sentAt
                          ? 'bg-sky-500/20 border-2 border-sky-500'
                          : 'bg-slate-800 border-2 border-slate-700'
                      }`}
                    />
                    <p
                      className={`font-semibold ${selectedTransfer.sentAt ? 'text-white' : 'text-slate-500'}`}
                    >
                      Dispatched / In Transit
                    </p>
                    {selectedTransfer.sentAt ? (
                      <p className="text-slate-400 text-[11px]">
                        Dispatched by{' '}
                        <strong className="text-sky-300">{selectedTransfer.sentByName}</strong> on{' '}
                        {new Date(selectedTransfer.sentAt).toLocaleString()} (Stock deducted from{' '}
                        {selectedTransfer.sourceStoreName})
                      </p>
                    ) : (
                      <p className="text-slate-500 text-[11px]">
                        Awaiting dispatch from source store
                      </p>
                    )}
                  </div>

                  {/* 3. Received */}
                  <div className="relative">
                    <div
                      className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full ${
                        selectedTransfer.receivedAt
                          ? 'bg-emerald-500/20 border-2 border-emerald-500'
                          : 'bg-slate-800 border-2 border-slate-700'
                      }`}
                    />
                    <p
                      className={`font-semibold ${selectedTransfer.receivedAt ? 'text-white' : 'text-slate-500'}`}
                    >
                      Received &amp; Stocked
                    </p>
                    {selectedTransfer.receivedAt ? (
                      <p className="text-slate-400 text-[11px]">
                        Received by{' '}
                        <strong className="text-emerald-300">
                          {selectedTransfer.receivedByName}
                        </strong>{' '}
                        on {new Date(selectedTransfer.receivedAt).toLocaleString()} (Stock credited
                        to {selectedTransfer.targetStoreName})
                      </p>
                    ) : (
                      <p className="text-slate-500 text-[11px]">
                        Awaiting destination receipt and reconciliation
                      </p>
                    )}
                  </div>

                  {/* 4. Cancelled if applicable */}
                  {selectedTransfer.cancelledAt && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-rose-500/20 border-2 border-rose-500" />
                      <p className="font-semibold text-rose-400">Transfer Cancelled</p>
                      <p className="text-slate-400 text-[11px]">
                        Cancelled on {new Date(selectedTransfer.cancelledAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-sky-400" />
                  <span>Items &amp; Quantities Reconciled</span>
                </h3>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-semibold">
                        <th className="py-2.5 px-3">Product / SKU</th>
                        <th className="py-2.5 px-3 text-right">Requested</th>
                        <th className="py-2.5 px-3 text-right">Sent</th>
                        <th className="py-2.5 px-3 text-right">Received</th>
                        <th className="py-2.5 px-3 text-center">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {selectedTransfer.items.map((item) => {
                        const variance = item.receivedQuantity - item.sentQuantity;
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-white">{item.productName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                SKU: {item.sku} &bull; Unit: {item.unit}
                              </p>
                              {item.notes && (
                                <p className="text-[10px] text-slate-400 italic">"{item.notes}"</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                              {item.requestedQuantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-400">
                              {item.sentQuantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                              {item.receivedQuantity}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {item.sentQuantity > 0 ? (
                                variance === 0 ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                                    MATCH
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold">
                                    {variance > 0 ? `+${variance}` : variance}
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] text-slate-500">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
              {selectedTransfer.status === 'REQUESTED' && (
                <button
                  onClick={() => openSendModal(selectedTransfer)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Dispatch / Send Items</span>
                </button>
              )}
              {selectedTransfer.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => openReceiveModal(selectedTransfer)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Receipt &amp; Restock</span>
                </button>
              )}
              {(selectedTransfer.status === 'REQUESTED' ||
                selectedTransfer.status === 'IN_TRANSIT') && (
                <button
                  onClick={() => handleCancelTransfer(selectedTransfer)}
                  className="px-3 py-2 bg-slate-800 hover:bg-rose-900/30 text-rose-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel Transfer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================================
          6. CREATE TRANSFER REQUEST MODAL
      ============================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Create Inter-Store Transfer Request
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {/* Origin & Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Origin Store (Store A - Source) *
                  </label>
                  <select
                    value={createForm.sourceStoreId}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, sourceStoreId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-sky-500"
                    required
                  >
                    <option value="">Select Origin Branch...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Destination Store (Store B - Target) *
                  </label>
                  <select
                    value={createForm.targetStoreId}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, targetStoreId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-sky-500"
                    required
                  >
                    <option value="">Select Destination Branch...</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Transfer Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Replenishment for weekend rush or emergency stock transfer"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>

              {/* Items List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Requested Items
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm({
                        ...createForm,
                        items: [
                          ...createForm.items,
                          { productId: '', requestedQuantity: 1, notes: '' },
                        ],
                      })
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {createForm.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-6">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const newItems = [...createForm.items];
                            newItems[idx].productId = e.target.value;
                            setCreateForm({ ...createForm, items: newItems });
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-sky-500"
                          required
                        >
                          <option value="">Select Product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          type="number"
                          min="1"
                          placeholder="Req Qty"
                          value={item.requestedQuantity}
                          onChange={(e) => {
                            const newItems = [...createForm.items];
                            newItems[idx].requestedQuantity = Number(e.target.value);
                            setCreateForm({ ...createForm, items: newItems });
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-sky-500 font-mono"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="Note"
                          value={item.notes}
                          onChange={(e) => {
                            const newItems = [...createForm.items];
                            newItems[idx].notes = e.target.value;
                            setCreateForm({ ...createForm, items: newItems });
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-sky-500"
                        />
                      </div>

                      <div className="sm:col-span-1 text-right">
                        {createForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = createForm.items.filter((_, i) => i !== idx);
                              setCreateForm({ ...createForm, items: newItems });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Create Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================================
          7. SEND / DISPATCH MODAL
      ============================================================================== */}
      {showSendModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Dispatch Transfer {selectedTransfer.transferNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    From <strong>{selectedTransfer.sourceStoreName}</strong> &rarr; To{' '}
                    <strong>{selectedTransfer.targetStoreName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs text-sky-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Dispatching will atomically deduct stock from{' '}
                <strong>{selectedTransfer.sourceStoreName}</strong>, record audit movement{' '}
                <code>TRANSFER_OUT</code>, and mark status as <strong>IN_TRANSIT</strong>.
              </span>
            </div>

            {actionError && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSendSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Dispatch Notes / Tracking Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Driver John, Van #1, Packed in bin #4"
                  value={sendForm.notes}
                  onChange={(e) => setSendForm({ ...sendForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
              </div>

              {/* Items Sent Quantities */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Confirm Sent Quantities
                </span>
                <div className="space-y-2">
                  {selectedTransfer.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">{item.productName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Requested:{' '}
                          <strong className="text-amber-400">{item.requestedQuantity}</strong>{' '}
                          {item.unit}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-400">Sent Qty:</label>
                        <input
                          type="number"
                          min="0"
                          value={sendForm.items[idx]?.sentQuantity ?? item.requestedQuantity}
                          onChange={(e) => {
                            const newItems = [...sendForm.items];
                            if (newItems[idx]) {
                              newItems[idx].sentQuantity = Number(e.target.value);
                              setSendForm({ ...sendForm, items: newItems });
                            }
                          }}
                          className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right font-mono font-bold focus:border-sky-500"
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Truck className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Dispatch &amp; Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================================
          8. RECEIVE / RECEIPT MODAL
      ============================================================================== */}
      {showReceiveModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Receive Transfer {selectedTransfer.transferNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Delivered to <strong>{selectedTransfer.targetStoreName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Confirming receipt will atomically increment inventory stock in{' '}
                <strong>{selectedTransfer.targetStoreName}</strong>, record audit movement{' '}
                <code>TRANSFER_IN</code>, and mark status as <strong>COMPLETED</strong>.
              </span>
            </div>

            {actionError && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleReceiveSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Receipt Notes / Verification Comments
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified by Store Manager, all boxes in good condition"
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Items Received Quantities */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Verify Physically Received Quantities
                </span>
                <div className="space-y-2">
                  {selectedTransfer.items.map((item, idx) => {
                    const receivedQty =
                      receiveForm.items[idx]?.receivedQuantity ?? item.sentQuantity;
                    const diff = receivedQty - item.sentQuantity;

                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-semibold text-white">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Sent from Origin:{' '}
                            <strong className="text-sky-400">{item.sentQuantity}</strong>{' '}
                            {item.unit}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {diff !== 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                              Variance: {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-400">Recv Qty:</label>
                            <input
                              type="number"
                              min="0"
                              value={receivedQty}
                              onChange={(e) => {
                                const newItems = [...receiveForm.items];
                                if (newItems[idx]) {
                                  newItems[idx].receivedQuantity = Number(e.target.value);
                                  setReceiveForm({ ...receiveForm, items: newItems });
                                }
                              }}
                              className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-right font-mono font-bold focus:border-emerald-500"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Receipt &amp; Restock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
