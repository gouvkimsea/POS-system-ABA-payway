'use client';

import React, { useState } from 'react';
import { PosCustomer } from '@pos/types';
import { X, User, UserPlus, Search, Phone, Mail, Award, Check, MapPin } from 'lucide-react';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: PosCustomer[];
  selectedCustomer: PosCustomer | null;
  onSelectCustomer: (customer: PosCustomer | null) => void;
  onCreateCustomer: (customerData: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }) => Promise<PosCustomer | null>;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onCreateCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Customer Form
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Customer name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onCreateCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (created) {
        onSelectCustomer(created);
        onClose();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4">
      <div className="bg-slate-900 rounded-lg max-w-lg w-full shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[85dvh] text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-white">
            <User className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Select Customer (F4)</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 px-5 pt-2 bg-slate-950/60">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Directory</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Body Content */}
        {activeTab === 'search' ? (
          <div className="p-5 flex flex-col flex-1 overflow-hidden">
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, or email..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Walk-in Customer Option */}
            <button
              onClick={() => {
                onSelectCustomer(null);
                onClose();
              }}
              className={`mb-2 p-3 rounded-lg border flex items-center justify-between text-left transition-colors ${
                !selectedCustomer
                  ? 'border-emerald-500/60 bg-emerald-950/40 text-slate-100'
                  : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div>
                <div className="font-semibold text-xs sm:text-sm text-slate-100">
                  Walk-in Customer
                </div>
                <div className="text-[11px] text-slate-400">
                  Sale without assigned customer profile
                </div>
              </div>
              {!selectedCustomer && <Check className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Customers List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
              {filteredCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => {
                      onSelectCustomer(cust);
                      onClose();
                    }}
                    className={`pt-2 p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-emerald-500/60 bg-emerald-950/40'
                        : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs sm:text-sm text-slate-100 flex items-center gap-2">
                        <span>{cust.name}</span>
                        {cust.loyaltyPoints > 0 && (
                          <span className="bg-amber-950 text-amber-300 border border-amber-800/80 text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                            <Award className="w-3 h-3 text-amber-400" />
                            {cust.loyaltyPoints} pts
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1">
                        {cust.phone && (
                          <span className="flex items-center gap-1 font-mono text-slate-300">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {cust.phone}
                          </span>
                        )}
                        {cust.email && (
                          <span className="flex items-center gap-1 truncate max-w-[180px]">
                            <Mail className="w-3 h-3 text-slate-500" />
                            {cust.email}
                          </span>
                        )}
                        {cust.address && (
                          <span className="flex items-center gap-1 text-slate-400 truncate max-w-[200px]">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {cust.address}
                          </span>
                        )}
                        {cust.creditBalanceUSD > 0 && (
                          <span className="text-purple-300 font-semibold bg-purple-950 border border-purple-800/80 px-1.5 py-0.2 rounded text-[10px]">
                            Credit: ${cust.creditBalanceUSD.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {cust.notes && (
                        <div className="text-[11px] text-slate-400 italic mt-0.5 truncate max-w-[300px]">
                          Note: {cust.notes}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit} className="p-5 space-y-3.5 flex-1 overflow-y-auto">
            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sophea Meas"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 012 888 999"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. customer@gmail.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. #128 Preah Monivong Blvd, Phnom Penh"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional customer notes"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save and Select'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
