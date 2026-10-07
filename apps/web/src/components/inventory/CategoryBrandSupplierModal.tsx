'use client';

import React, { useState, useEffect } from 'react';

export type ClassificationType = 'category' | 'brand' | 'supplier';

interface CategoryBrandSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ClassificationType;
  item?: any | null;
  onSaveSuccess: () => void;
}

export function CategoryBrandSupplierModal({
  isOpen,
  onClose,
  type,
  item,
  onSaveSuccess,
}: CategoryBrandSupplierModalProps) {
  const isEditing = !!item;

  const [name, setName] = useState('');
  // Category specific
  const [code, setCode] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [sortOrder, setSortOrder] = useState('0');
  // Brand specific
  const [description, setDescription] = useState('');
  // Supplier specific
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setCode(item.code || '');
      setColor(item.color || '#4f46e5');
      setSortOrder(String(item.sortOrder || 0));
      setDescription(item.description || '');
      setContactPerson(item.contactPerson || '');
      setPhone(item.phone || '');
      setEmail(item.email || '');
      setAddress(item.address || '');
      setTaxId(item.taxId || '');
    } else {
      setName('');
      setCode('');
      setColor('#4f46e5');
      setSortOrder('0');
      setDescription('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setTaxId('');
    }
    setError(null);
  }, [item, isOpen, type]);

  if (!isOpen) return null;

  const titles = {
    category: isEditing ? 'Edit Category' : 'Create Category',
    brand: isEditing ? 'Edit Brand' : 'Create Brand',
    supplier: isEditing ? 'Edit Supplier' : 'Create Supplier',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    let payload: any = { name: name.trim() };
    const endpoint = `/api/catalog/${type === 'category' ? 'categories' : type === 'brand' ? 'brands' : 'suppliers'}`;

    if (type === 'category') {
      payload = {
        ...payload,
        code: code.trim() || undefined,
        color: color || '#4f46e5',
        sortOrder: parseInt(sortOrder, 10) || 0,
      };
    } else if (type === 'brand') {
      payload = {
        ...payload,
        description: description.trim() || undefined,
      };
    } else if (type === 'supplier') {
      payload = {
        ...payload,
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        taxId: taxId.trim() || undefined,
      };
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('pos_access_token');
      const url = isEditing ? `${endpoint}/${item.id}` : endpoint;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || `Failed to save ${type}`);
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{titles[type]}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {type === 'category' ? 'Category Name *' : type === 'brand' ? 'Brand Name *' : 'Company / Supplier Name *'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {type === 'category' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Code (Short)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="BEV"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Badge Color</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-9 p-1 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Display Order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>
            </div>
          )}

          {type === 'brand' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Brand Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product line or manufacturer notes..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              />
            </div>
          )}

          {type === 'supplier' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Mr. Vanna"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="orders@supplier.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tax ID / VAT Reg</label>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Physical Address / Warehouse</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street / Sangkat, Phnom Penh"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
