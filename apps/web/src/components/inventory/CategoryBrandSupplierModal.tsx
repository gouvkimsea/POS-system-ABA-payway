'use client';

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

export type ClassificationType = 'category' | 'brand' | 'supplier';

interface CategoryBrandSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ClassificationType;
  item?: any | null;
  onSaveSuccess: () => void;
}

interface EntityFormProps {
  item?: any | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryBrandSupplierModal({
  isOpen,
  onClose,
  type,
  item,
  onSaveSuccess,
}: CategoryBrandSupplierModalProps) {
  if (!isOpen) return null;

  const isEditing = Boolean(item);
  const titles = {
    category: isEditing ? 'Edit Category' : 'Add Category',
    brand: isEditing ? 'Edit Brand' : 'Add Brand',
    supplier: isEditing ? 'Edit Supplier' : 'Add Supplier',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg overflow-hidden shadow-xl text-slate-100">
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{titles[type]}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {type === 'category' && (
          <CategoryForm item={item} onSuccess={onSaveSuccess} onCancel={onClose} />
        )}
        {type === 'brand' && (
          <BrandForm item={item} onSuccess={onSaveSuccess} onCancel={onClose} />
        )}
        {type === 'supplier' && (
          <SupplierForm item={item} onSuccess={onSaveSuccess} onCancel={onClose} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Category Form
// ---------------------------------------------------------------------------
function CategoryForm({ item, onSuccess, onCancel }: EntityFormProps) {
  const isEditing = Boolean(item);
  const [name, setName] = useState(item?.name || '');
  const [code, setCode] = useState(item?.code || '');
  const [color, setColor] = useState(item?.color || '#10b981');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder || 0));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('pos_access_token');
      const url = isEditing ? `/api/catalog/categories/${item.id}` : '/api/catalog/categories';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          color: color || '#4f46e5',
          sortOrder: parseInt(sortOrder, 10) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to save category');
      onSuccess();
      onCancel();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <FormErrorMessage message={error} />}

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Category Name *
        </label>
        <input
          type="text"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BEV"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full h-9 p-1 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
        </div>
      </div>

      <FormActions isSubmitting={isSubmitting} isEditing={isEditing} label="Category" onCancel={onCancel} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// 2. Brand Form
// ---------------------------------------------------------------------------
function BrandForm({ item, onSuccess, onCancel }: EntityFormProps) {
  const isEditing = Boolean(item);
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Brand name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('pos_access_token');
      const url = isEditing ? `/api/catalog/brands/${item.id}` : '/api/catalog/brands';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to save brand');
      onSuccess();
      onCancel();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <FormErrorMessage message={error} />}

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Brand Name *
        </label>
        <input
          type="text"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Description
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Product line or manufacturer notes..."
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      <FormActions isSubmitting={isSubmitting} isEditing={isEditing} label="Brand" onCancel={onCancel} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// 3. Supplier Form
// ---------------------------------------------------------------------------
function SupplierForm({ item, onSuccess, onCancel }: EntityFormProps) {
  const isEditing = Boolean(item);
  const [name, setName] = useState(item?.name || '');
  const [contactPerson, setContactPerson] = useState(item?.contactPerson || '');
  const [phone, setPhone] = useState(item?.phone || '');
  const [email, setEmail] = useState(item?.email || '');
  const [taxId, setTaxId] = useState(item?.taxId || '');
  const [address, setAddress] = useState(item?.address || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Supplier name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('pos_access_token');
      const url = isEditing ? `/api/catalog/suppliers/${item.id}` : '/api/catalog/suppliers';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          taxId: taxId.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to save supplier');
      onSuccess();
      onCancel();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <FormErrorMessage message={error} />}

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Supplier Name *
        </label>
        <input
          type="text"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Contact Person
          </label>
          <input
            type="text"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="Mr. Vanna"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Phone
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+855 12 555 777"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="orders@supplier.com"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Tax ID
          </label>
          <input
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="K001-902..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Address
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street / Sangkat, Phnom Penh"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
        />
      </div>

      <FormActions isSubmitting={isSubmitting} isEditing={isEditing} label="Supplier" onCancel={onCancel} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared Form Helpers
// ---------------------------------------------------------------------------
function FormErrorMessage({ message }: { message: string }) {
  return (
    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

interface FormActionsProps {
  isSubmitting: boolean;
  isEditing: boolean;
  label: string;
  onCancel: () => void;
}

function FormActions({ isSubmitting, isEditing, label, onCancel }: FormActionsProps) {
  return (
    <div className="pt-2 flex items-center justify-end space-x-3">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-xs transition disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : `Add ${label}`}
      </button>
    </div>
  );
}
