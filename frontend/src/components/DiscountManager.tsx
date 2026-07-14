import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { Loader2, Trash2 } from "lucide-react";

export const DiscountManager: React.FC = () => {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [maxUses, setMaxUses] = useState('');

  const fetchDiscounts = async () => {
    setIsLoading(true);
    const { ok, data } = await api('/merchant/discounts');
    if (ok && data) {
      setDiscounts(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const { ok, error } = await api('/merchant/discounts', {
      method: 'POST',
      body: JSON.stringify({
        code: code.toUpperCase(),
        discountPercent: discountPercent ? parseFloat(discountPercent) : undefined,
        maxUses: maxUses ? parseInt(maxUses) : 0
      })
    });

    if (ok) {
      toast.success('Discount code created successfully');
      setCode('');
      setDiscountPercent('');
      setMaxUses('');
      fetchDiscounts();
    } else {
      toast.error(error || 'Failed to create discount code');
    }
    setIsCreating(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this code?')) return;
    const { ok, error } = await api(`/merchant/discounts/${id}`, { method: 'DELETE' });
    if (ok) {
      toast.success('Code deactivated');
      fetchDiscounts();
    } else {
      toast.error(error || 'Failed to deactivate code');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
      <div className="md:col-span-5">
        <div className="bg-white border border-black/5 rounded-3xl shadow-sm hover:shadow-md transition-shadow p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-black">Create Discount Code</h2>
          </div>
          <form onSubmit={handleCreate} className="flex flex-col gap-6">
            <div>
              <label className="text-[13px] font-bold text-black/80 block mb-2">Code (e.g. SUMMER20)</label>
              <input required type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-bold placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="text-[13px] font-bold text-black/80 block mb-2">Discount Percent (0-100)</label>
              <input type="number" step="1" max="100" min="1" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="text-[13px] font-bold text-black/80 block mb-2">Max Uses (0 = unlimited)</label>
              <input type="number" step="1" min="0" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors" />
            </div>
            <button type="submit" disabled={isCreating} className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-black text-white hover:bg-gray-800 shadow-sm transition-all flex justify-center items-center">
              {isCreating ? <><Loader2 className="animate-spin mr-2" size={16} /> Creating...</> : 'Create Code'}
            </button>
          </form>
        </div>
      </div>
      <div className="md:col-span-7">
        <div className="bg-white border border-black/5 rounded-3xl shadow-sm hover:shadow-md transition-shadow p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-black">Active & Past Codes</h2>
          </div>
          {isLoading ? <Loader2 className="animate-spin mx-auto text-black/40 my-8" /> : discounts.length === 0 ? <p className="text-sm font-medium text-black/60">No discount codes found.</p> : (
            <div className="flex flex-col gap-3">
              {discounts.map(d => (
                <div key={d.id} className="flex justify-between items-center p-4 bg-white border border-black/10 rounded-2xl shadow-sm">
                  <div>
                    <div className="font-bold text-base text-black">{d.code}</div>
                    <div className="text-sm font-medium text-black/60">
                      {d.discount_percent}% off • {d.used_count}/{d.max_uses || '∞'} uses
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {d.is_active && (
                      <button onClick={() => handleDeactivate(d.id)} className="text-red-500 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 p-2 rounded-xl">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
