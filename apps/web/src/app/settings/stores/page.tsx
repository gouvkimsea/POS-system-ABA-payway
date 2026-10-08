'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../../components/AuthGuard';
import { useAuth } from '../../../lib/auth-context';
import { StoreDetail, StoreSettings } from '@pos/types';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Printer,
  Sliders,
  Package,
  MapPin,
  Phone,
  Mail,
  X,
  AlertCircle,
} from 'lucide-react';

export default function StoresManagementPage() {
  return (
    <AuthGuard requiredPermission="settings.manage">
      <StoresManagementContent />
    </AuthGuard>
  );
}

function StoresManagementContent() {
  const { token } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const [stores, setStores] = useState<StoreDetail[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreDetail | null>(null);
  const [activeTab, setActiveTab] = useState<
    'info' | 'settings' | 'registers' | 'users' | 'products'
  >('info');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showCreateStoreModal, setShowCreateStoreModal] = useState<boolean>(false);
  const [showCreateRegisterModal, setShowCreateRegisterModal] = useState<boolean>(false);
  const [showAssignUserModal, setShowAssignUserModal] = useState<boolean>(false);

  // Sub-data for selected store
  const [registers, setRegisters] = useState<any[]>([]);
  const [storeUsers, setStoreUsers] = useState<any[]>([]);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [subLoading, setSubLoading] = useState<boolean>(false);

  // Form states
  const [newStoreForm, setNewStoreForm] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    address: '',
    receiptHeader: '',
    receiptFooter: '',
    defaultCurrency: 'USD',
    taxRate: 0.1,
  });

  const [settingsForm, setSettingsForm] = useState<StoreSettings>({
    defaultCurrency: 'USD',
    timezone: 'Asia/Phnom_Penh',
    taxRate: 0.1,
    autoPrintReceipt: true,
    allowNegativeStock: false,
    receiptHeader: '',
    receiptFooter: '',
  });

  const [registerForm, setRegisterForm] = useState({
    name: '',
    code: '',
  });

  const [assignUserForm, setAssignUserForm] = useState({
    userId: '',
    roleId: '',
  });

  const [productSearch, setProductSearch] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Fetch stores
  const fetchStores = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/stores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load stores');
      const json = await res.json();
      setStores(json.data || []);
      if (json.data && json.data.length > 0 && !selectedStore) {
        setSelectedStore(json.data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching branches');
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, token, selectedStore]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // 2. Fetch sub-data when selectedStore or activeTab changes
  const fetchStoreSubData = useCallback(
    async (storeId: string) => {
      if (!token) return;
      setSubLoading(true);
      try {
        if (activeTab === 'registers') {
          const res = await fetch(`${apiUrl}/stores/${storeId}/registers`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          setRegisters(json.data || []);
        } else if (activeTab === 'users') {
          const [usersRes, metaRes] = await Promise.all([
            fetch(`${apiUrl}/stores/${storeId}/users`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${apiUrl}/reports/filters-meta`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          const usersJson = await usersRes.json();
          const metaJson = await metaRes.json();
          setStoreUsers(usersJson.data || []);
          setAllUsers(metaJson.data?.cashiers || []);
        } else if (activeTab === 'products') {
          const res = await fetch(`${apiUrl}/stores/${storeId}/products`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          setStoreProducts(json.data || []);
        } else if (activeTab === 'settings') {
          const res = await fetch(`${apiUrl}/stores/${storeId}/settings`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.data?.settings) {
            setSettingsForm({
              ...json.data.settings,
              receiptHeader: json.data.receiptHeader || '',
              receiptFooter: json.data.receiptFooter || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load store sub-data:', err);
      } finally {
        setSubLoading(false);
      }
    },
    [apiUrl, token, activeTab],
  );

  useEffect(() => {
    if (selectedStore) {
      fetchStoreSubData(selectedStore.id);
    }
  }, [selectedStore, activeTab, fetchStoreSubData]);

  // Handle Create Store
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newStoreForm.name,
          code: newStoreForm.code,
          phone: newStoreForm.phone || null,
          email: newStoreForm.email || null,
          address: newStoreForm.address || null,
          receiptHeader: newStoreForm.receiptHeader || null,
          receiptFooter: newStoreForm.receiptFooter || null,
          settings: {
            defaultCurrency: newStoreForm.defaultCurrency,
            taxRate: Number(newStoreForm.taxRate),
            autoPrintReceipt: true,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to create branch');

      setShowCreateStoreModal(false);
      setNewStoreForm({
        name: '',
        code: '',
        phone: '',
        email: '',
        address: '',
        receiptHeader: '',
        receiptFooter: '',
        defaultCurrency: 'USD',
        taxRate: 0.1,
      });
      setStatusMessage(`Branch "${json.data.name}" created successfully!`);
      setTimeout(() => setStatusMessage(null), 4000);
      await fetchStores();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStore) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`${apiUrl}/stores/${selectedStore.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settingsForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to save settings');

      setStatusMessage('Store settings updated successfully!');
      setTimeout(() => setStatusMessage(null), 3000);
      await fetchStores();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Add Register
  const handleAddRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStore) return;
    try {
      const res = await fetch(`${apiUrl}/stores/${selectedStore.id}/registers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(registerForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to add register');

      setShowCreateRegisterModal(false);
      setRegisterForm({ name: '', code: '' });
      fetchStoreSubData(selectedStore.id);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Handle Assign User
  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStore) return;
    try {
      const res = await fetch(`${apiUrl}/stores/${selectedStore.id}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(assignUserForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to assign user');

      setShowAssignUserModal(false);
      setAssignUserForm({ userId: '', roleId: '' });
      fetchStoreSubData(selectedStore.id);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Handle Store Product Override
  const handleUpdateStoreProduct = async (productId: string, override: any) => {
    if (!token || !selectedStore) return;
    try {
      const res = await fetch(`${apiUrl}/stores/${selectedStore.id}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(override),
      });
      if (res.ok) {
        fetchStoreSubData(selectedStore.id);
      }
    } catch (err) {
      console.error('Failed to update product override', err);
    }
  };

  const filteredStores = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const filteredProducts = storeProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Multi-Branch Management</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {stores.length} Branches
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Configure branches, localized pricing, registers, users &amp; branch permissions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/inventory/transfers"
            className="hidden md:flex px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs font-medium items-center gap-2 border border-slate-700/60"
          >
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Transfers</span>
          </Link>
          <button
            onClick={() => setShowCreateStoreModal(true)}
            className="px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create New Branch</span>
            <span className="sm:hidden">Branch</span>
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 flex items-center gap-2 text-xs font-medium text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Status banner */}
      {statusMessage && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 flex items-center gap-2 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {statusMessage}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Branches List (Responsive Master-Detail) */}
        <aside
          className={`${selectedStore ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 border-r border-slate-800/80 bg-slate-900/30 flex-col shrink-0 pb-20 lg:pb-0`}
        >
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search branches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="text-center py-10 text-xs text-slate-500">Loading stores...</div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">No stores found</div>
            ) : (
              filteredStores.map((s) => {
                const isSelected = selectedStore?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStore(s)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-start justify-between ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs tracking-tight">{s.name}</span>
                        {s.isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono font-medium">
                        Code: {s.code}
                      </div>
                      {s.address && (
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          {s.address}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                        <span>{s.registerCount || 0} Registers</span>
                        <span>•</span>
                        <span>{s.userCount || 0} Staff</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition ${
                        isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600'
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Detail Pane */}
        {selectedStore ? (
          <main className="flex-1 flex flex-col bg-slate-950 overflow-y-auto pb-24 lg:pb-8">
            {/* Store Banner */}
            <div className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <button
                    onClick={() => setSelectedStore(null)}
                    className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 text-xs"
                    title="Back to all branches"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Branches</span>
                  </button>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {selectedStore.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-mono text-xs font-semibold border border-slate-700">
                    {selectedStore.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      selectedStore.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {selectedStore.isActive ? 'Active Branch' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                  {selectedStore.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      {selectedStore.phone}
                    </span>
                  )}
                  {selectedStore.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      {selectedStore.email}
                    </span>
                  )}
                  {selectedStore.address && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {selectedStore.address}
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'info'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Branch Overview
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'settings'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Store Settings
                </button>
                <button
                  onClick={() => setActiveTab('registers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'registers'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Registers ({registers.length})
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'users'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Store Users ({storeUsers.length})
                </button>
                <button
                  onClick={() => setActiveTab('products')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'products'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Store Products
                </button>
              </div>
            </div>

            {/* Sub-tab loading indicator */}
            {subLoading && (
              <div className="h-0.5 w-full bg-indigo-950 overflow-hidden">
                <div className="h-full bg-indigo-500 w-1/3" />
              </div>
            )}

            {/* Tab 1: Overview */}
            {activeTab === 'info' && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-xs text-slate-400">Total Registers</span>
                    <p className="text-2xl font-bold text-white mt-1">
                      {selectedStore.registerCount || 0}
                    </p>
                    <span className="text-[11px] text-indigo-400 mt-1 block">
                      Active checkout points
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-xs text-slate-400">Assigned Staff</span>
                    <p className="text-2xl font-bold text-white mt-1">
                      {selectedStore.userCount || 0}
                    </p>
                    <span className="text-[11px] text-emerald-400 mt-1 block">
                      Authorized branch users
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-xs text-slate-400">Custom Price Overrides</span>
                    <p className="text-2xl font-bold text-white mt-1">
                      {selectedStore.productCount || 0}
                    </p>
                    <span className="text-[11px] text-amber-400 mt-1 block">
                      Branch pricing rules
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-xs text-slate-400">Branch Status</span>
                    <p
                      className={`text-2xl font-bold mt-1 ${selectedStore.isActive ? 'text-emerald-400' : 'text-slate-500'}`}
                    >
                      {selectedStore.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </p>
                    <span className="text-[11px] text-slate-500 mt-1 block">Operation state</span>
                  </div>
                </div>

                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80 space-y-4">
                  <h3 className="text-sm font-bold text-white">Branch Profile Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Branch Name:</span>
                      <p className="font-semibold text-slate-200 mt-0.5">{selectedStore.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Unique Code:</span>
                      <p className="font-mono font-semibold text-indigo-400 mt-0.5">
                        {selectedStore.code}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Contact Telephone:</span>
                      <p className="font-medium text-slate-200 mt-0.5">
                        {selectedStore.phone || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Official Email:</span>
                      <p className="font-medium text-slate-200 mt-0.5">
                        {selectedStore.email || 'Not specified'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Physical Address:</span>
                      <p className="font-medium text-slate-200 mt-0.5">
                        {selectedStore.address || 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Store Settings */}
            {activeTab === 'settings' && (
              <div className="p-6 max-w-3xl space-y-6">
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-400" />
                      Branch Financial & Operational Settings
                    </h3>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">
                          Default Currency
                        </label>
                        <select
                          value={settingsForm.defaultCurrency || 'USD'}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              defaultCurrency: e.target.value as any,
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500 focus:outline-hidden"
                        >
                          <option value="USD">USD ($ - US Dollar)</option>
                          <option value="KHR">KHR (៛ - Khmer Riel)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">
                          Default Tax Rate (e.g. 0.1 for 10%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={settingsForm.taxRate ?? 0.1}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              taxRate: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">
                          Branch Timezone
                        </label>
                        <input
                          type="text"
                          value={settingsForm.timezone || 'Asia/Phnom_Penh'}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, timezone: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500 focus:outline-hidden font-mono"
                        />
                      </div>

                      <div className="flex flex-col justify-end space-y-2 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={settingsForm.autoPrintReceipt ?? true}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                autoPrintReceipt: e.target.checked,
                              })
                            }
                            className="rounded border-slate-800 text-indigo-600 focus:ring-0"
                          />
                          Auto-print customer receipts upon checkout
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Customization */}
                  <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Printer className="w-4 h-4 text-emerald-400" />
                      Branch Receipt Header & Footer Customization
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">
                          Receipt Header Text
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Angkor Fresh Mart - Toul Kork Flagship&#10;Street 315, Phnom Penh | Tel: 023 888 101"
                          value={settingsForm.receiptHeader || ''}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, receiptHeader: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">
                          Receipt Footer Text
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Thank you for your patronage!&#10;Goods sold are non-refundable after 7 days."
                          value={settingsForm.receiptFooter || ''}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, receiptFooter: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-xs disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving Settings...' : 'Save Branch Settings'}
                  </button>
                </form>
              </div>
            )}

            {/* Tab 3: Store Registers */}
            {activeTab === 'registers' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Branch Cash Registers</h3>
                  <button
                    onClick={() => setShowCreateRegisterModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Register
                  </button>
                </div>

                <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400 bg-slate-950/60 font-medium">
                        <th className="py-3 px-4">Register Name</th>
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Active Cashier</th>
                        <th className="py-3 px-4">Total Orders</th>
                        <th className="py-3 px-4">Total Sessions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {registers.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3 px-4 font-semibold text-white">{r.name}</td>
                          <td className="py-3 px-4 font-mono text-indigo-400">{r.code}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {r.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {r.activeSession ? (
                              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {r.activeSession.cashierName}
                              </span>
                            ) : (
                              <span className="text-slate-500">Drawer Closed</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">{r.totalOrders || 0}</td>
                          <td className="py-3 px-4 text-slate-300">{r.totalSessions || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 4: Store Users & Permissions */}
            {activeTab === 'users' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Branch Users & Permissions</h3>
                    <p className="text-xs text-slate-400">
                      Only authorized branch users and Administrators can access this store
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAssignUserModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Assign User to Branch
                  </button>
                </div>

                <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400 bg-slate-950/60 font-medium">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Permissions</th>
                        <th className="py-3 px-4">Assigned On</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {storeUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                            No branch-specific users assigned yet. Administrators have access to all
                            branches by default.
                          </td>
                        </tr>
                      ) : (
                        storeUsers.map((su) => (
                          <tr key={su.assignmentId} className="hover:bg-slate-900/40 transition">
                            <td className="py-3 px-4">
                              <span className="font-semibold text-white block">{su.fullName}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                @{su.username}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                                {su.roleName}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[11px] text-slate-400">
                                {su.permissions?.length || 0} granular permissions granted
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {new Date(su.assignedAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove ${su.fullName} from this branch?`)) return;
                                  await fetch(
                                    `${apiUrl}/stores/${selectedStore.id}/users/${su.userId}/roles/${su.roleId}`,
                                    {
                                      method: 'DELETE',
                                      headers: { Authorization: `Bearer ${token}` },
                                    },
                                  );
                                  fetchStoreSubData(selectedStore.id);
                                }}
                                className="text-rose-400 hover:text-rose-300 text-xs font-semibold"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 5: Store-Specific Products */}
            {activeTab === 'products' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Store-Specific Product Catalog & Overrides
                    </h3>
                    <p className="text-xs text-slate-400">
                      Customize product availability and branch-specific selling prices
                    </p>
                  </div>
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search store products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400 bg-slate-950/60 font-medium">
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Base Catalog Price</th>
                        <th className="py-3 px-4">Branch Selling Price (USD)</th>
                        <th className="py-3 px-4">Stock on Hand</th>
                        <th className="py-3 px-4">Branch Active</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white block">{p.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              SKU: {p.sku}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono font-medium">
                            ${p.basePriceUSD.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={p.storePriceUSD != null ? p.storePriceUSD : ''}
                                placeholder={p.basePriceUSD.toFixed(2)}
                                onBlur={(e) => {
                                  const val = e.target.value ? parseFloat(e.target.value) : null;
                                  handleUpdateStoreProduct(p.id, {
                                    customPriceUSD: val,
                                    customPriceKHR: val != null ? Math.round(val * 4100) : null,
                                  });
                                }}
                                className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-indigo-500 focus:outline-hidden"
                              />
                              {p.storePriceUSD != null && (
                                <span className="text-[10px] text-indigo-400 font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                                  Custom
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-white">
                            {p.stockOnHand}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => {
                                handleUpdateStoreProduct(p.id, {
                                  isActive: !p.isStoreActive,
                                });
                              }}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition ${
                                p.isStoreActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {p.isStoreActive ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {p.storePriceUSD != null && (
                              <button
                                onClick={() => {
                                  handleUpdateStoreProduct(p.id, {
                                    customPriceUSD: null,
                                    customPriceKHR: null,
                                  });
                                }}
                                className="text-[11px] text-slate-500 hover:text-slate-300 underline"
                              >
                                Reset to Base
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
            Select a branch to view details
          </div>
        )}
      </div>

      {/* Modal: Create Store */}
      {showCreateStoreModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                Create New Branch
              </h3>
              <button
                onClick={() => setShowCreateStoreModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Branch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tuol Kouk Flagship Branch"
                  value={newStoreForm.name}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Unique Branch Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TK-01"
                  value={newStoreForm.code}
                  onChange={(e) =>
                    setNewStoreForm({ ...newStoreForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Telephone</label>
                  <input
                    type="text"
                    placeholder="+855 23 888 101"
                    value={newStoreForm.phone}
                    onChange={(e) => setNewStoreForm({ ...newStoreForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    placeholder="branch@domain.com"
                    value={newStoreForm.email}
                    onChange={(e) => setNewStoreForm({ ...newStoreForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Physical Address</label>
                <input
                  type="text"
                  placeholder="Street 315, Khan Tuol Kouk, Phnom Penh"
                  value={newStoreForm.address}
                  onChange={(e) => setNewStoreForm({ ...newStoreForm, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateStoreModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shadow-xs"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Register */}
      {showCreateRegisterModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Add Cash Register</h3>
              <button
                onClick={() => setShowCreateRegisterModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddRegister} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Register Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Counter 02"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Register Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REG-02"
                  value={registerForm.code}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateRegisterModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold"
                >
                  Add Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign User */}
      {showAssignUserModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Assign User to Branch</h3>
              <button
                onClick={() => setShowAssignUserModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAssignUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Select User *</label>
                <select
                  required
                  value={assignUserForm.userId}
                  onChange={(e) => setAssignUserForm({ ...assignUserForm, userId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="">-- Choose User --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Branch Role *</label>
                <select
                  required
                  value={assignUserForm.roleId}
                  onChange={(e) => setAssignUserForm({ ...assignUserForm, roleId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Role --</option>
                  {/* Common roles */}
                  <option value="CASHIER">CASHIER (Point of sale & drawer access)</option>
                  <option value="MANAGER">MANAGER (Inventory, voids, branch reports)</option>
                  <option value="ADMIN">ADMIN (Full permissions)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignUserModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold"
                >
                  Assign User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
