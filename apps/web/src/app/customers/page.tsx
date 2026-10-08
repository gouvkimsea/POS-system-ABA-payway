'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../components/AuthGuard';
import { useAuth } from '../../lib/auth-context';
import { CustomerProfile, CustomerHistoryResponse } from '@pos/types';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Award,
  CreditCard,
  ChevronRight,
  X,
  Edit2,
  Trash2,
  Receipt,
  RotateCcw,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { ReturnRefundModal } from '../../components/pos/ReturnRefundModal';

export default function CustomersPage() {
  return (
    <AuthGuard requiredPermission="customers.view">
      <CustomerManagementContent />
    </AuthGuard>
  );
}

function CustomerManagementContent() {
  const { user } = useAuth();

  // Data collections
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'regular' | 'walk-in' | 'credit'>('all');

  // Customer Profile & History Drawer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistoryResponse | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  // Create / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    taxNumber: '',
    isWalkIn: false,
    loyaltyPoints: 0,
    creditBalanceUSD: 0,
  });
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Return / Refund Modal Trigger from order history
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getToken = () => localStorage.getItem('pos_access_token');

  // Fetch Customers
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getToken();
      let url = `/api/customers?limit=100`;
      if (searchQuery.trim()) {
        url += `&query=${encodeURIComponent(searchQuery.trim())}`;
      }
      if (filterType === 'walk-in') {
        url += `&isWalkIn=true`;
      } else if (filterType === 'regular') {
        url += `&isWalkIn=false`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch customers');
      }

      let data: CustomerProfile[] = json.data.customers;
      if (filterType === 'credit') {
        data = data.filter((c) => c.creditBalanceUSD > 0);
      }

      setCustomers(data);
      setTotalCount(json.data.total);
    } catch (err: any) {
      showToast(err.message || 'Error loading customers', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  // Fetch Customer History
  const fetchCustomerHistory = async (id: string) => {
    setSelectedCustomerId(id);
    setIsHistoryLoading(true);
    setCustomerHistory(null);

    try {
      const token = getToken();
      const res = await fetch(`/api/customers/${id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch customer history');
      }
      setCustomerHistory(json.data);
    } catch (err: any) {
      showToast(err.message || 'Error loading purchase history', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      taxNumber: '',
      isWalkIn: false,
      loyaltyPoints: 0,
      creditBalanceUSD: 0,
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (customer: CustomerProfile) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
      taxNumber: customer.taxNumber || '',
      isWalkIn: customer.isWalkIn,
      loyaltyPoints: customer.loyaltyPoints,
      creditBalanceUSD: customer.creditBalanceUSD,
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Save Customer (Create or Update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Customer name is required');
      return;
    }

    setFormSubmitting(true);
    try {
      const token = getToken();
      const isEdit = Boolean(editingCustomer);
      const url = isEdit ? `/api/customers/${editingCustomer!.id}` : '/api/customers';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        notes: formData.notes.trim() || null,
        taxNumber: formData.taxNumber.trim() || null,
        isWalkIn: formData.isWalkIn,
        ...(isEdit && {
          loyaltyPoints: Number(formData.loyaltyPoints) || 0,
          creditBalanceUSD: Number(formData.creditBalanceUSD) || 0,
        }),
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to save customer');
      }

      showToast(isEdit ? 'Customer profile updated' : 'New customer created successfully');
      setIsFormModalOpen(false);
      fetchCustomers();

      if (selectedCustomerId && editingCustomer?.id === selectedCustomerId) {
        fetchCustomerHistory(selectedCustomerId);
      }
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (customer: CustomerProfile) => {
    if (customer.isWalkIn) {
      showToast('The walk-in guest account cannot be deleted', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove customer "${customer.name}"?`)) {
      return;
    }

    try {
      const token = getToken();
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to delete customer');
      }

      showToast('Customer profile deleted');
      if (selectedCustomerId === customer.id) {
        setSelectedCustomerId(null);
      }
      fetchCustomers();
    } catch (err: any) {
      showToast(err.message || 'Error deleting customer', 'error');
    }
  };

  // Metrics
  const totalSpentAll = customers.reduce((acc, c) => acc + c.totalSpentUSD, 0);
  const totalStoreCreditAll = customers.reduce((acc, c) => acc + c.creditBalanceUSD, 0);
  const totalLoyaltyPointsAll = customers.reduce((acc, c) => acc + c.loyaltyPoints, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-md text-xs font-semibold flex items-center gap-2 border animate-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
              : 'bg-rose-950 text-rose-300 border-rose-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/pos"
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to POS</span>
          </Link>
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                Customers
                <span className="text-[11px] font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                  {totalCount} Total
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Manage customer accounts, purchase history, and store credit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </header>

      {/* Main Content Split: Overview, Table, Profile Drawer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Directory & Stats */}
        <main className="flex-1 flex flex-col min-w-0 p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Customers</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-white mt-2">{totalCount}</div>
              <div className="text-[11px] text-slate-400 mt-1">Including walk-ins</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Spent</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-2">
                ${totalSpentAll.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total customer purchases</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Loyalty Points</span>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 mt-2">
                {totalLoyaltyPointsAll.toLocaleString()} pts
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total points earned</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Store Credit</span>
                <CreditCard className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-400 mt-2">
                ${totalStoreCreditAll.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Available balance</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, email, or address..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  filterType === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('regular')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  filterType === 'regular'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                Regular
              </button>
              <button
                onClick={() => setFilterType('walk-in')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  filterType === 'walk-in'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                Walk-In
              </button>
              <button
                onClick={() => setFilterType('credit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  filterType === 'credit'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                Store Credit
              </button>
            </div>
          </div>

          {/* Customers Table / Grid */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading customers...
              </div>
            ) : customers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No customers found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-700/60 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Address & Notes</th>
                      <th className="py-3 px-4">Loyalty & Credit</th>
                      <th className="py-3 px-4">Orders & Spent</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {customers.map((c) => {
                      const isSelected = selectedCustomerId === c.id;
                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-700/30 transition-colors ${
                            isSelected ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : ''
                          }`}
                        >
                          {/* Name & Badge */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  c.isWalkIn
                                    ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                                    : 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50'
                                }`}
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                  <span>{c.name}</span>
                                  {c.isWalkIn && (
                                    <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded font-normal">
                                      Walk-in
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Added {new Date(c.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Contact Info */}
                          <td className="py-3.5 px-4 font-mono">
                            {c.phone ? (
                              <div className="flex items-center gap-1.5 text-slate-200">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{c.phone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">No phone</span>
                            )}
                            {c.email && (
                              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate max-w-[180px] mt-0.5">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span>{c.email}</span>
                              </div>
                            )}
                          </td>

                          {/* Address & Notes */}
                          <td className="py-3.5 px-4 max-w-xs">
                            {c.address && (
                              <div className="flex items-center gap-1.5 text-slate-300 truncate">
                                <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                <span className="truncate">{c.address}</span>
                              </div>
                            )}
                            {c.notes ? (
                              <div className="text-[11px] text-slate-400 italic truncate mt-0.5">
                                "{c.notes}"
                              </div>
                            ) : !c.address ? (
                              <span className="text-slate-500 italic">—</span>
                            ) : null}
                          </td>

                          {/* Loyalty & Credit */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {c.loyaltyPoints > 0 ? (
                                <span className="bg-amber-950 text-amber-300 border border-amber-800/80 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Award className="w-3 h-3 text-amber-400" />
                                  {c.loyaltyPoints} pts
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">0 pts</span>
                              )}

                              {c.creditBalanceUSD > 0 && (
                                <span className="bg-purple-950 text-purple-300 border border-purple-800/80 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CreditCard className="w-3 h-3 text-purple-400" />$
                                  {c.creditBalanceUSD.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Orders & Spent */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-100">
                              ${c.totalSpentUSD.toFixed(2)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {c.totalOrdersCount} order(s)
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => fetchCustomerHistory(c.id)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                title="Order History"
                              >
                                <span>History</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(c)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
                                title="Edit Customer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!c.isWalkIn && (
                                <button
                                  onClick={() => handleDeleteCustomer(c)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                                  title="Delete Customer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* Right Drawer: Customer Purchase History & Profile */}
        {selectedCustomerId && (
          <aside className="w-96 xl:w-[460px] bg-slate-950 border-l border-slate-800 flex flex-col shrink-0 h-full overflow-hidden animate-in slide-in-from-right-2 duration-150">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Purchase History</h3>
                  <p className="text-[11px] text-slate-400">Past orders and refunds</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            {isHistoryLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs flex-1 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                Loading purchase history...
              </div>
            ) : customerHistory ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Profile Card Summary */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{customerHistory.customer.name}</span>
                        {customerHistory.customer.isWalkIn && (
                          <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-800">
                            Walk-in
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {customerHistory.customer.phone || 'No phone number'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenEdit(customerHistory.customer)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors text-xs"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {customerHistory.customer.address && (
                    <div className="text-xs text-slate-300 flex items-start gap-1.5 pt-1 border-t border-slate-800">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>{customerHistory.customer.address}</span>
                    </div>
                  )}

                  {customerHistory.customer.notes && (
                    <div className="text-xs text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      Note: {customerHistory.customer.notes}
                    </div>
                  )}

                  {/* Summary Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">Total Orders</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {customerHistory.summary.totalOrders}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">Lifetime Spent</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">
                        ${customerHistory.summary.totalSpentUSD.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase">Avg Order</div>
                      <div className="text-sm font-bold text-indigo-300 mt-0.5">
                        ${customerHistory.summary.averageOrderValueUSD.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Orders History List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Order Transactions</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {customerHistory.orders.length} orders
                    </span>
                  </div>

                  {customerHistory.orders.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs bg-slate-900 rounded-xl border border-slate-800">
                      No orders completed yet for this customer.
                    </div>
                  ) : (
                    customerHistory.orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs hover:border-slate-700 transition-colors"
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-indigo-300">
                              {order.orderNumber}
                            </span>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{new Date(order.createdAt).toLocaleString()}</span>
                              <span>•</span>
                              <span>{order.storeName}</span>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              order.status === 'REFUNDED'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : order.status === 'PARTIALLY_REFUNDED'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        {/* Items Purchased */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-[11px] text-slate-300"
                            >
                              <div className="truncate max-w-[240px]">
                                <span className="font-medium text-slate-200">
                                  {item.productName}
                                </span>
                                <span className="text-slate-500 text-[10px] ml-1.5">
                                  × {item.quantity} (${item.unitPriceUSD.toFixed(2)})
                                </span>
                              </div>
                              <div className="text-right font-mono">
                                <span>${item.totalUSD.toFixed(2)}</span>
                                {item.refundedQuantity > 0 && (
                                  <span className="text-[10px] text-rose-400 ml-1.5">
                                    (-{item.refundedQuantity} ret)
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Order Totals & Linked Return Info */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-slate-500">Paid: </span>
                            <span className="font-bold text-slate-200">
                              ${order.paidUSD.toFixed(2)}
                            </span>
                            {order.refundedAmountUSD > 0 && (
                              <span className="text-rose-400 font-semibold ml-2">
                                (Refunded: ${order.refundedAmountUSD.toFixed(2)})
                              </span>
                            )}
                          </div>

                          {/* Trigger Refund Modal */}
                          {order.status !== 'REFUNDED' && (
                            <button
                              onClick={() => setIsRefundModalOpen(true)}
                              className="px-2 py-1 rounded bg-rose-950/60 text-rose-300 hover:bg-rose-900/60 border border-rose-800/80 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Refund Order</span>
                            </button>
                          )}
                        </div>

                        {/* Linked Returns Relationship */}
                        {order.returns && order.returns.length > 0 && (
                          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-[10px] space-y-1">
                            <div className="text-slate-400 font-semibold flex items-center gap-1">
                              <RotateCcw className="w-3 h-3 text-rose-400" />
                              <span>Linked Returns & Refunds:</span>
                            </div>
                            {order.returns.map((ret) => (
                              <div key={ret.id} className="flex justify-between text-slate-300">
                                <span className="font-mono text-indigo-400">
                                  {ret.returnNumber}
                                </span>
                                <span>${ret.totalUSD.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        )}
      </div>

      {/* Customer Create / Edit Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">
                  {editingCustomer ? 'Edit Customer Profile' : 'Create New Customer'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sopheap Chan"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 012 888 123"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. customer@gmail.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. #45, St 240, Daun Penh, Phnom Penh"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. VIP client, preferred payment method ABA KHQR"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {editingCustomer && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Loyalty Points
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.loyaltyPoints}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          loyaltyPoints: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Store Credit ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={formData.creditBalanceUSD}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          creditBalanceUSD: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {formSubmitting
                    ? 'Saving...'
                    : editingCustomer
                      ? 'Update Profile'
                      : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return & Refund Modal Triggered from Order */}
      <ReturnRefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        userPermissions={user?.permissions || []}
        userRoles={user?.roles || []}
        onRefundCompleted={() => {
          showToast('Refund processed successfully');
          if (selectedCustomerId) {
            fetchCustomerHistory(selectedCustomerId);
          }
          fetchCustomers();
        }}
      />
    </div>
  );
}
