import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        discount_percent: discountPercent ? parseFloat(discountPercent) : undefined,
        max_uses: maxUses ? parseInt(maxUses) : 0
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
    <div className="grid-12 gap-6">
      <div style={{ gridColumn: 'span 5' }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Create Discount Code</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px' }}>Code (e.g. SUMMER20)</label>
                <Input required type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px' }}>Discount Percent (0-100)</label>
                <Input type="number" step="1" max="100" min="1" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
              </div>
              <div>
                <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px' }}>Max Uses (0 = unlimited)</label>
                <Input type="number" step="1" min="0" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </div>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? <><Loader2 className="animate-spin mr-2" size={16} /> Creating...</> : 'Create Code'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <div style={{ gridColumn: 'span 7' }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">Active & Past Codes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : discounts.length === 0 ? <p className="text-body-md text-[var(--on-surface-variant)]">No discount codes found.</p> : (
              <div className="flex flex-col gap-3">
                {discounts.map(d => (
                  <div key={d.id} className="flex justify-between items-center p-4 border rounded-lg" style={{ borderColor: 'var(--outline-variant)' }}>
                    <div>
                      <div className="font-bold text-lg">{d.code}</div>
                      <div className="text-sm text-[var(--on-surface-variant)]">
                        {d.discount_percent}% off • {d.used_count}/{d.max_uses || '∞'} uses
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 rounded text-xs ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {d.is_active && (
                        <button onClick={() => handleDeactivate(d.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
