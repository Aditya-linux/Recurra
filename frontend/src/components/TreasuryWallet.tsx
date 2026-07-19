import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Wallet, TrendingUp, ArrowUpRight, Copy, Check } from 'lucide-react';
import { FadeIn } from './ui/animations';

interface TreasuryData {
  treasury: {
    walletAddress: string;
    feeBps: number;
    feePercent: string;
    totalFeesCollected: number;
    totalFeesFormatted: string;
    totalTransactions: number;
  };
  dailyBreakdown: Array<{
    date: string;
    fees: number;
    feesFormatted: string;
    transactionCount: number;
  }>;
  recentTransactions: Array<{
    id: string;
    feeAmount: number;
    feeFormatted: string;
    planName: string;
    transactionHash: string;
    createdAt: string;
  }>;
}

const TreasuryWallet: React.FC = () => {
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState(false);

  useEffect(() => {
    const fetchTreasury = async () => {
      setLoading(true);
      const { ok, data: resData } = await api('/payments/treasury');
      if (ok && resData) {
        setData(resData);
      }
      setLoading(false);
    };
    fetchTreasury();
  }, []);

  const handleCopyAddress = () => {
    if (data?.treasury.walletAddress) {
      navigator.clipboard.writeText(data.treasury.walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash) return '—';
    return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
  };

  if (loading) {
    return (
      <div className="bg-white border border-black/5 rounded-3xl p-8 shadow-sm animate-pulse">
        <div className="h-6 bg-black/5 rounded w-48 mb-4" />
        <div className="h-10 bg-black/5 rounded w-32 mb-6" />
        <div className="h-4 bg-black/5 rounded w-full mb-2" />
        <div className="h-4 bg-black/5 rounded w-3/4" />
      </div>
    );
  }

  if (!data) return null;

  const { treasury, recentTransactions } = data;

  return (
    <FadeIn>
      <div className="bg-white border border-black/5 rounded-3xl shadow-sm overflow-hidden">
        {/* Header with gradient accent */}
        <div className="relative px-8 pt-8 pb-6">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <Wallet size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-black">Treasury Wallet</h3>
                <p className="text-xs text-black/40 font-medium">{treasury.feePercent} protocol fee on all transactions</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full">
              <TrendingUp size={14} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">{treasury.totalTransactions} txns</span>
            </div>
          </div>

          {/* Total Fees Card */}
          <div className="bg-gradient-to-br from-black to-black/90 rounded-2xl p-6 text-white mb-6">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">Total Fees Collected</p>
            <p className="text-3xl font-bold tracking-tight">{treasury.totalFeesFormatted}</p>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-white/50 font-mono truncate flex-1">
                {treasury.walletAddress}
              </p>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                title="Copy wallet address"
              >
                {copiedAddress ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white/50" />}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Fee Transactions */}
        {recentTransactions.length > 0 && (
          <div className="px-8 pb-8">
            <h4 className="text-sm font-semibold text-black/70 mb-3">Recent Fee Collections</h4>
            <div className="space-y-2">
              {recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2.5 px-4 bg-black/[0.02] rounded-xl hover:bg-black/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <ArrowUpRight size={14} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black truncate">{tx.planName}</p>
                      <p className="text-xs text-black/40 font-mono">{truncateHash(tx.transactionHash)}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold text-emerald-600">{tx.feeFormatted}</p>
                    <p className="text-xs text-black/40">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FadeIn>
  );
};

export default TreasuryWallet;
