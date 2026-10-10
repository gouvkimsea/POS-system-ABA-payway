'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../components/AuthGuard';
import { useAuth } from '../../lib/auth-context';
import { useSettings } from '../../lib/settings-context';
import {
  Building2,
  Store,
  Monitor,
  Users,
  CreditCard,
  Globe,
  Save,
  CheckCircle2,
  RefreshCw,
  Plus,
  ArrowLeft,
  Volume2,
  Printer,
  Barcode,
  Keyboard,
  Shield,
  Clock,
  DollarSign,
  Sliders,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import { UserDetailExtended, RoleDetailExtended } from '@pos/types';

export default function SettingsPage() {
  return (
    <AuthGuard requiredPermission="settings.manage">
      <SettingsContent />
    </AuthGuard>
  );
}

type SettingsTab = 'business' | 'store' | 'pos' | 'users' | 'payments' | 'localization';

function SettingsContent() {
  const { token } = useAuth();
  const {
    business,
    store,
    pos,
    localization,
    paymentMethods,
    storesList,
    selectedStoreId,
    setSelectedStoreId,
    updateBusiness,
    updateStoreSettings,
    updatePosSettings,
    updateLocalizationSettings,
    refreshSettings,
    formatCurrency,
    formatDateTime,
  } = useSettings();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const [activeTab, setActiveTab] = useState<SettingsTab>('business');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form local states for editing
  const [bizForm, setBizForm] = useState({ ...business });
  const [storeForm, setStoreForm] = useState({ ...store });
  const [posForm, setPosForm] = useState({ ...pos });
  const [locForm, setLocForm] = useState({ ...localization });

  // Users & Roles state
  const [usersList, setUsersList] = useState<UserDetailExtended[]>([]);
  const [rolesList, setRolesList] = useState<RoleDetailExtended[]>([]);
  const [, setAllPermissions] = useState<any[]>([]);
  const [, setIsLoadingUsers] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  // New User Form State
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    pinCode: '',
    roleId: '',
    storeIds: [] as string[],
  });

  // New Payment Method Form State
  const [newPaymentForm, setNewPaymentForm] = useState({
    name: '',
    code: '',
    type: 'DIGITAL_QR',
    isActive: true,
    isDefault: false,
    merchantId: '',
    apiKey: '',
  });

  // Sync initial forms when context loads
  useEffect(() => {
    setBizForm({ ...business });
  }, [business]);

  useEffect(() => {
    setStoreForm({ ...store });
  }, [store]);

  useEffect(() => {
    setPosForm({ ...pos });
  }, [pos]);

  useEffect(() => {
    setLocForm({ ...localization });
  }, [localization]);

  // Load Users & Roles when Users tab opened
  const loadUsersAndRoles = async () => {
    if (!token) return;
    setIsLoadingUsers(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch(`${apiUrl}/settings/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/settings/roles`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (usersRes.ok) {
        const uJson = await usersRes.json();
        if (uJson.success) setUsersList(uJson.data);
      }
      if (rolesRes.ok) {
        const rJson = await rolesRes.json();
        if (rJson.success) {
          setRolesList(rJson.data.roles);
          setAllPermissions(rJson.data.allPermissions);
          if (rJson.data.roles.length > 0 && !newUserForm.roleId) {
            setNewUserForm((prev) => ({ ...prev, roleId: rJson.data.roles[0].id }));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load users/roles:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsersAndRoles();
    }
  }, [activeTab]);

  const showToast = (msg: string, isErr = false) => {
    if (isErr) {
      setSaveError(msg);
      setTimeout(() => setSaveError(null), 4000);
    } else {
      setSaveSuccess(msg);
      setTimeout(() => setSaveSuccess(null), 3500);
    }
  };

  // 1. Save Business
  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateBusiness({
        name: bizForm.name,
        logoUrl: bizForm.logoUrl,
        address: bizForm.address,
        phone: bizForm.phone,
        email: bizForm.email,
        taxNumber: bizForm.taxNumber,
        defaultCurrency: bizForm.defaultCurrency,
        baseExchangeRate: Number(bizForm.baseExchangeRate),
        timezone: bizForm.timezone,
      });
      showToast('Business settings saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save business settings', true);
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Save Store
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const activeStoreId = selectedStoreId || store.storeId;
      await updateStoreSettings(activeStoreId, {
        storeName: storeForm.storeName,
        receipt: storeForm.receipt,
        tax: storeForm.tax,
        inventory: storeForm.inventory,
      });
      showToast('Store settings saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save store settings', true);
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Save POS
  const handleSavePos = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updatePosSettings(posForm);
      showToast('POS operational settings saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save POS settings', true);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Save Localization
  const handleSaveLocalization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateLocalizationSettings(locForm);
      showToast('Localization settings saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save localization settings', true);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Payment Method
  const handleTogglePaymentMethod = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/settings/payments/${id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('Payment method toggled successfully!');
        await refreshSettings();
      }
    } catch (e: any) {
      showToast(e.message || 'Error updating payment method', true);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/settings/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUserForm),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create user');
      }

      showToast(`User ${newUserForm.fullName} created successfully!`);
      setShowAddUserModal(false);
      setNewUserForm({
        username: '',
        fullName: '',
        email: '',
        phone: '',
        password: '',
        pinCode: '',
        roleId: rolesList[0]?.id || '',
        storeIds: [],
      });
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Toggle User Active Status
  const handleToggleUser = async (id: string) => {
    try {
      const res = await fetch(`${apiUrl}/settings/users/${id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to toggle user');
      }
      showToast(json.message || 'User status updated');
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  // Create Payment Method
  const handleCreatePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/settings/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPaymentForm.name,
          code: newPaymentForm.code,
          type: newPaymentForm.type,
          isActive: newPaymentForm.isActive,
          isDefault: newPaymentForm.isDefault,
          config: {
            merchantId: newPaymentForm.merchantId,
            apiKey: newPaymentForm.apiKey,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create payment method');
      }

      showToast('Payment method added successfully!');
      setShowAddPaymentModal(false);
      setNewPaymentForm({
        name: '',
        code: '',
        type: 'DIGITAL_QR',
        isActive: true,
        isDefault: false,
        merchantId: '',
        apiKey: '',
      });
      refreshSettings();
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Back to POS"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sliders className="w-6 h-6 text-emerald-400" />
              Settings
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage your business, store, POS terminal, and payment options.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refreshSettings()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Settings
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold font-mono">
            {business.code}
          </div>
        </div>
      </header>

      {/* Feedback Toast */}
      {saveSuccess && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold border border-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          {saveSuccess}
        </div>
      )}
      {saveError && (
        <div className="fixed top-20 right-6 z-50 bg-rose-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold border border-rose-400">
          <AlertCircle className="w-5 h-5" />
          {saveError}
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 pb-24 lg:pb-8 flex flex-col md:flex-row gap-6">
        {/* Left Navigation Tabs */}
        <aside className="w-full md:w-64 shrink-0 flex md:flex-col gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('business')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap text-left ${
              activeTab === 'business'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4 text-slate-300" />
            Business
          </button>

          <button
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap text-left ${
              activeTab === 'store'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Store className="w-4 h-4 text-slate-300" />
            Store & Receipts
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap text-left ${
              activeTab === 'pos'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Monitor className="w-4 h-4 text-slate-300" />
            POS & Sound
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap text-left ${
              activeTab === 'users'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-slate-300" />
            Users & Roles
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap text-left ${
              activeTab === 'payments'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <CreditCard className="w-4 h-4 text-slate-300" />
            Payment Methods
          </button>

          <button
            onClick={() => setActiveTab('localization')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap text-left ${
              activeTab === 'localization'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Globe className="w-4 h-4 text-slate-300" />
            Localization
          </button>
        </aside>

        {/* Right Active Panel Content */}
        <main className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-lg p-5 sm:p-7">
          {/* TAB 1: BUSINESS */}
          {activeTab === 'business' && (
            <form onSubmit={handleSaveBusiness} className="space-y-6">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  Business Details
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Information printed on receipts and invoices.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={bizForm.name}
                    onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Tax / VAT ID
                  </label>
                  <input
                    type="text"
                    value={bizForm.taxNumber || ''}
                    onChange={(e) => setBizForm({ ...bizForm, taxNumber: e.target.value })}
                    placeholder="e.g. K001-90023412"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Phone Contact
                  </label>
                  <input
                    type="text"
                    value={bizForm.phone || ''}
                    onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={bizForm.email || ''}
                    onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Official Address
                  </label>
                  <textarea
                    rows={2}
                    value={bizForm.address || ''}
                    onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Logo URL</label>
                  <input
                    type="url"
                    value={bizForm.logoUrl || ''}
                    onChange={(e) => setBizForm({ ...bizForm, logoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Base Exchange Rate (KHR per USD)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bizForm.baseExchangeRate}
                    onChange={(e) =>
                      setBizForm({ ...bizForm, baseExchangeRate: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Default Timezone
                  </label>
                  <select
                    value={bizForm.timezone}
                    onChange={(e) => setBizForm({ ...bizForm, timezone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Asia/Phnom_Penh">Asia/Phnom_Penh (UTC+7)</option>
                    <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                    <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                    <option value="UTC">UTC (Universal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Default Currency
                  </label>
                  <select
                    value={bizForm.defaultCurrency}
                    onChange={(e) => setBizForm({ ...bizForm, defaultCurrency: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="KHR">KHR (៛)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: STORE */}
          {activeTab === 'store' && (
            <form onSubmit={handleSaveStore} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-emerald-400" />
                    Store Settings
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Receipt layout, tax rates, and inventory policies for this store.
                  </p>
                </div>

                {storesList.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-400">Branch:</label>
                    <select
                      value={selectedStoreId || store.storeId}
                      onChange={(e) => setSelectedStoreId(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    >
                      {storesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Receipt Layout Section */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Thermal Receipt Layout
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Receipt Header Greeting
                    </label>
                    <input
                      type="text"
                      value={storeForm.receipt.customHeader || ''}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          receipt: { ...storeForm.receipt, customHeader: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Receipt Footer Note
                    </label>
                    <input
                      type="text"
                      value={storeForm.receipt.customFooter || ''}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          receipt: { ...storeForm.receipt, customFooter: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <span className="text-xs font-medium text-slate-300">Print Store Logo</span>
                    <input
                      type="checkbox"
                      checked={storeForm.receipt.showLogo}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          receipt: { ...storeForm.receipt, showLogo: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-0"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <span className="text-xs font-medium text-slate-300">Show Tax Breakdown</span>
                    <input
                      type="checkbox"
                      checked={storeForm.receipt.showTaxBreakdown}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          receipt: { ...storeForm.receipt, showTaxBreakdown: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-0"
                    />
                  </div>
                </div>
              </div>

              {/* Tax Settings Section */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Tax Configuration
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Default Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={storeForm.tax.defaultTaxRate}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          tax: { ...storeForm.tax, defaultTaxRate: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/50 sm:col-span-2">
                    <div>
                      <div className="text-xs font-bold text-slate-200">Tax Inclusive Pricing</div>
                      <div className="text-[10px] text-slate-400">
                        Catalog prices already include VAT
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={storeForm.tax.isTaxInclusive}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          tax: { ...storeForm.tax, isTaxInclusive: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-0"
                    />
                  </div>
                </div>
              </div>

              {/* Inventory Settings Section */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  Inventory Rules
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Default Low Stock Alert Threshold
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={storeForm.inventory.defaultLowStockAlert}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          inventory: {
                            ...storeForm.inventory,
                            defaultLowStockAlert: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div>
                      <div className="text-xs font-bold text-slate-200">Allow Negative Stock</div>
                      <div className="text-[10px] text-slate-400">
                        Checkout even if recorded inventory is 0
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={storeForm.inventory.allowNegativeStock}
                      onChange={(e) =>
                        setStoreForm({
                          ...storeForm,
                          inventory: {
                            ...storeForm.inventory,
                            allowNegativeStock: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-0"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: POS */}
          {activeTab === 'pos' && (
            <form onSubmit={handleSavePos} className="space-y-6">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-amber-400" />
                  POS Terminal Settings
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure receipt size, scanner behavior, sound feedback, and shortcuts.
                </p>
              </div>

              {/* Receipt Size & Barcode Behavior */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-3">
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    Thermal Receipt Paper Size
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPosForm({ ...posForm, receiptSize: '80mm' })}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        posForm.receiptSize === '80mm'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      80mm (Standard)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosForm({ ...posForm, receiptSize: '58mm' })}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        posForm.receiptSize === '58mm'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      58mm (Compact Mobile)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-3">
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                    <Barcode className="w-4 h-4" />
                    Barcode Scanner Behavior
                  </h3>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Auto-add to cart on match</span>
                    <input
                      type="checkbox"
                      checked={posForm.barcodeBehavior.autoAddToCart}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          barcodeBehavior: {
                            ...posForm.barcodeBehavior,
                            autoAddToCart: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded text-amber-600 focus:ring-0"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Audible beep on scan</span>
                    <input
                      type="checkbox"
                      checked={posForm.barcodeBehavior.beepOnScan}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          barcodeBehavior: {
                            ...posForm.barcodeBehavior,
                            beepOnScan: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded text-amber-600 focus:ring-0"
                    />
                  </div>
                </div>
              </div>

              {/* Sound & Audio Effects */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    Terminal Sound & Audio Signals
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Master Audio:</span>
                    <input
                      type="checkbox"
                      checked={posForm.sound.enabled}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          sound: { ...posForm.sound, enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-amber-600 focus:ring-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Volume: {Math.round((posForm.sound.volume ?? 0.7) * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={posForm.sound.volume ?? 0.7}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          sound: { ...posForm.sound, volume: Number(e.target.value) },
                        })
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 text-slate-300">
                      <input
                        type="checkbox"
                        checked={posForm.sound.playSuccess}
                        onChange={(e) =>
                          setPosForm({
                            ...posForm,
                            sound: { ...posForm.sound, playSuccess: e.target.checked },
                          })
                        }
                        className="w-3.5 h-3.5 rounded text-amber-600"
                      />
                      Success Chime
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-300">
                      <input
                        type="checkbox"
                        checked={posForm.sound.playWarning}
                        onChange={(e) =>
                          setPosForm({
                            ...posForm,
                            sound: { ...posForm.sound, playWarning: e.target.checked },
                          })
                        }
                        className="w-3.5 h-3.5 rounded text-amber-600"
                      />
                      Warning Buzz
                    </label>
                  </div>
                </div>
              </div>

              {/* Keyboard Shortcuts Mapping */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-3">
                <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <Keyboard className="w-4 h-4" />
                  Keyboard Shortcuts Mapping
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Search Products</label>
                    <input
                      type="text"
                      value={posForm.keyboardShortcuts.customBindings.search || 'F1'}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          keyboardShortcuts: {
                            ...posForm.keyboardShortcuts,
                            customBindings: {
                              ...posForm.keyboardShortcuts.customBindings,
                              search: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Barcode Focus</label>
                    <input
                      type="text"
                      value={posForm.keyboardShortcuts.customBindings.barcode || 'F2'}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          keyboardShortcuts: {
                            ...posForm.keyboardShortcuts,
                            customBindings: {
                              ...posForm.keyboardShortcuts.customBindings,
                              barcode: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Customer Modal</label>
                    <input
                      type="text"
                      value={posForm.keyboardShortcuts.customBindings.customer || 'F4'}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          keyboardShortcuts: {
                            ...posForm.keyboardShortcuts,
                            customBindings: {
                              ...posForm.keyboardShortcuts.customBindings,
                              customer: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Open Payment</label>
                    <input
                      type="text"
                      value={posForm.keyboardShortcuts.customBindings.payment || 'F8'}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          keyboardShortcuts: {
                            ...posForm.keyboardShortcuts,
                            customBindings: {
                              ...posForm.keyboardShortcuts.customBindings,
                              payment: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Display & Cash Drawer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4" />
                      VFD 2x20 Customer Display
                    </h3>
                    <input
                      type="checkbox"
                      checked={posForm.customerDisplay.enabled}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          customerDisplay: {
                            ...posForm.customerDisplay,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded text-amber-600"
                    />
                  </div>
                  <input
                    type="text"
                    value={posForm.customerDisplay.welcomeMessage}
                    onChange={(e) =>
                      setPosForm({
                        ...posForm,
                        customerDisplay: {
                          ...posForm.customerDisplay,
                          welcomeMessage: e.target.value,
                        },
                      })
                    }
                    placeholder="Welcome Message"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" />
                      Cash Drawer Trigger
                    </h3>
                    <input
                      type="checkbox"
                      checked={posForm.cashDrawer.openOnCashSale}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          cashDrawer: { ...posForm.cashDrawer, openOnCashSale: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-amber-600"
                    />
                  </div>
                  <div className="text-xs text-slate-400">
                    Auto-kick cash drawer pulse signal (0x1B 0x70) upon completing cash sales.
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: USERS & ACCESS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    Users & Roles
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage user accounts, roles, and store access.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Store Access</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{u.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold border border-slate-700">
                            {u.roles[0]?.roleName || 'Custom'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.storeAccess.length === 0 ? (
                            <span className="text-emerald-400 font-medium">
                              All Stores
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {u.storeAccess.map((s) => (
                                <span
                                  key={s.storeId}
                                  className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300"
                                >
                                  {s.storeName}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.isActive
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleUser(u.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                              u.isActive
                                ? 'bg-rose-950/60 text-rose-300 hover:bg-rose-900/80 border border-rose-800/50'
                                : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/80 border border-emerald-800/50'
                            }`}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Roles & Permissions Summary */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-3">
                <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Roles ({rolesList.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {rolesList.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-slate-950/80 rounded-lg border border-slate-800"
                    >
                      <div className="font-bold text-white text-xs">{r.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {r.permissions.length} Permissions Active
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    Payment Methods
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage active payment options, default method, and credentials.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddPaymentModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Payment Method
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className={`p-4 rounded-lg border transition-all ${
                      pm.isActive
                        ? 'bg-slate-900/80 border-slate-700/80'
                        : 'bg-slate-900/30 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          {pm.name}
                          {pm.isDefault && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          Code: {pm.code} ({pm.type})
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTogglePaymentMethod(pm.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          pm.isActive
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {pm.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </div>

                    {pm.config && Object.keys(pm.config).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                        Merchant: {pm.config.merchantId || pm.config.terminalId || 'Configured'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: LOCALIZATION */}
          {activeTab === 'localization' && (
            <form onSubmit={handleSaveLocalization} className="space-y-6">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Localization
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Currency and date format settings for POS registers.
                </p>
              </div>

              {/* Live Preview Card */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    Preview
                  </div>
                  <div className="text-xl font-bold text-white mt-1">
                    {formatCurrency(1250.5)}{' '}
                    <span className="text-slate-400 text-sm">
                      / {formatCurrency(1250.5, 'KHR')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {formatDateTime(new Date())}
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-xs font-mono font-semibold text-slate-300 border border-slate-800">
                  Locale: {locForm.language.toUpperCase()} | {locForm.defaultCurrency}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Primary Interface Language
                  </label>
                  <select
                    value={locForm.language}
                    onChange={(e) => setLocForm({ ...locForm, language: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="en">English (US/UK)</option>
                    <option value="km">Khmer ភាសាខ្មែរ</option>
                    <option value="zh">Chinese 中文</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Default Currency
                  </label>
                  <select
                    value={locForm.defaultCurrency}
                    onChange={(e) =>
                      setLocForm({ ...locForm, defaultCurrency: e.target.value as any })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="KHR">KHR (៛)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Currency Symbol Position
                  </label>
                  <select
                    value={locForm.currencyFormatting.position}
                    onChange={(e) =>
                      setLocForm({
                        ...locForm,
                        currencyFormatting: {
                          ...locForm.currencyFormatting,
                          position: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="prefix">Prefix ($100)</option>
                    <option value="suffix">Suffix (100 $)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Decimal Places
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={locForm.currencyFormatting.decimalPlaces}
                    onChange={(e) =>
                      setLocForm({
                        ...locForm,
                        currencyFormatting: {
                          ...locForm.currencyFormatting,
                          decimalPlaces: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Date Format String
                  </label>
                  <select
                    value={locForm.dateTimeFormatting.dateFormat}
                    onChange={(e) =>
                      setLocForm({
                        ...locForm,
                        dateTimeFormatting: {
                          ...locForm.dateTimeFormatting,
                          dateFormat: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 08/10/2026)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/08/2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 2026-10-08)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-slate-200">24-Hour Time Format</div>
                    <div className="text-[10px] text-slate-400">
                      Display 14:30 instead of 2:30 PM
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={locForm.dateTimeFormatting.use24Hour}
                    onChange={(e) =>
                      setLocForm({
                        ...locForm,
                        dateTimeFormatting: {
                          ...locForm.dateTimeFormatting,
                          use24Hour: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* Modal: Add User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Add User
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  placeholder="e.g. cashier2"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  placeholder="e.g. Sreymom Meas"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    PIN (4-6 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={newUserForm.pinCode}
                    onChange={(e) => setNewUserForm({ ...newUserForm, pinCode: e.target.value })}
                    placeholder="1234"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Role</label>
                <select
                  value={newUserForm.roleId}
                  onChange={(e) => setNewUserForm({ ...newUserForm, roleId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {rolesList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Payment Method */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Add Payment Method
            </h3>

            <form onSubmit={handleCreatePaymentMethod} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Method Name</label>
                <input
                  type="text"
                  required
                  value={newPaymentForm.name}
                  onChange={(e) => setNewPaymentForm({ ...newPaymentForm, name: e.target.value })}
                  placeholder="e.g. Wing Pay QR"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Unique Code</label>
                <input
                  type="text"
                  required
                  value={newPaymentForm.code}
                  onChange={(e) =>
                    setNewPaymentForm({ ...newPaymentForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. WING_QR"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Type</label>
                <select
                  value={newPaymentForm.type}
                  onChange={(e) => setNewPaymentForm({ ...newPaymentForm, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="DIGITAL_QR">Digital QR (KHQR / Bakong / e-Wallet)</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Voucher / Other Tender</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Merchant / Account ID
                </label>
                <input
                  type="text"
                  value={newPaymentForm.merchantId}
                  onChange={(e) =>
                    setNewPaymentForm({ ...newPaymentForm, merchantId: e.target.value })
                  }
                  placeholder="e.g. 000192831"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-sm transition-colors"
                >
                  Add Payment Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
