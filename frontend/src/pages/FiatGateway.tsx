import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, ArrowRightLeft, CreditCard, Building2, CheckCircle2 } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const FiatGateway: React.FC = () => {
  const { walletAddress } = useWallet();
  const [rates, setRates] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState('100');
  const [currency, setCurrency] = useState('USD');
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [loading, setLoading] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState('0');

  const fetchRates = async () => {
    try {
      const res = await api('/anchor/rates');
      if (!res.ok) throw new Error(res.error || 'Failed to fetch rates');
      // Adding USDC mapping manually if anchor returns native rates
      setRates({ ...res.data.rates, USDC: 1.0 });
    } catch (err) {
      console.error('Failed to fetch rates', err);
      // Fallback
      setRates({ USD: 1.0, EUR: 0.92, GBP: 0.79, INR: 83.5, USDC: 1.0 });
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  useEffect(() => {
    if (rates[currency] && rates['USDC']) {
      // Very simplified mock calculation
      const rateToUSD = rates[currency] || 1;
      const usdcAmount = Number(amount) / rateToUSD;
      setConvertedAmount(usdcAmount.toFixed(2));
    }
  }, [amount, currency, rates, action]);

  const handleInteractiveFlow = async () => {
    if (!walletAddress) {
      toast.error('Connect your wallet first');
      return;
    }
    
    setLoading(true);
    try {
      // Mock SEP-24 anchor domain
      const domain = 'testanchor.stellar.org';
      
      const res = await api('/anchor/interactive', {
        method: 'POST',
        body: JSON.stringify({
          domain,
          action,
          assetCode: 'USDC',
          account: walletAddress,
          jwtToken: 'mock-sep10-jwt' // In reality, we'd do SEP-10 auth on frontend first
        })
      });
      
      if (!res.ok) throw new Error(res.error || `Failed to initiate ${action}`);
      
      if (res.data.url) {
        // Open the interactive popup window
        window.open(res.data.url, 'sep24-interactive', 'width=500,height=700');
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to initiate ${action}`);
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        Please connect your wallet to access Fiat On/Off Ramps.
      </div>
    );
  }

  return (
    <div className="pt-nav min-h-screen bg-gray-950 px-4 pb-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <Globe className="mx-auto mb-4 h-16 w-16 text-blue-500" />
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Cross-Border Fiat Gateway</h1>
          <p className="mt-4 text-lg text-gray-400">
            Seamlessly convert your local currency to USDC on-chain (SEP-24/SEP-31).
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Exchange Card */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-6 flex space-x-2 rounded-xl bg-gray-950 p-1">
              <button
                onClick={() => setAction('deposit')}
                className={`flex-1 rounded-lg py-3 text-sm font-semibold transition ${
                  action === 'deposit' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Deposit (On-Ramp)
              </button>
              <button
                onClick={() => setAction('withdraw')}
                className={`flex-1 rounded-lg py-3 text-sm font-semibold transition ${
                  action === 'withdraw' ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Withdraw (Off-Ramp)
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 transition focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {action === 'deposit' ? 'You Pay' : 'You Send'}
                </label>
                <div className="mt-2 flex items-center">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent text-3xl font-bold text-white outline-none"
                    placeholder="0.00"
                  />
                  <select
                    value={action === 'deposit' ? currency : 'USDC'}
                    onChange={(e) => action === 'deposit' && setCurrency(e.target.value)}
                    disabled={action === 'withdraw'}
                    className="ml-4 cursor-pointer appearance-none rounded-lg bg-gray-800 py-2 pl-4 pr-8 font-semibold text-white outline-none"
                  >
                    {action === 'withdraw' ? (
                      <option value="USDC">USDC</option>
                    ) : (
                      <>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 ring-4 ring-gray-900">
                  <ArrowRightLeft className="h-5 w-5 text-gray-400 rotate-90" />
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {action === 'deposit' ? 'You Receive (approx)' : 'You Receive (approx)'}
                </label>
                <div className="mt-2 flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={convertedAmount}
                    className="w-full bg-transparent text-3xl font-bold text-gray-300 outline-none"
                  />
                  <select
                    value={action === 'withdraw' ? currency : 'USDC'}
                    onChange={(e) => action === 'withdraw' && setCurrency(e.target.value)}
                    disabled={action === 'deposit'}
                    className="ml-4 cursor-pointer appearance-none rounded-lg bg-gray-800 py-2 pl-4 pr-8 font-semibold text-white outline-none"
                  >
                    {action === 'deposit' ? (
                      <option value="USDC">USDC</option>
                    ) : (
                      <>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              
              <div className="rounded-lg bg-blue-500/10 p-4 text-sm text-blue-400">
                1 {currency} = {rates[currency] ? (1 / rates[currency]).toFixed(4) : '...'} USDC
              </div>

              <button
                onClick={handleInteractiveFlow}
                disabled={loading}
                className={`w-full rounded-xl py-4 text-lg font-bold transition flex justify-center items-center ${
                  action === 'deposit' 
                    ? 'bg-blue-600 text-white hover:bg-blue-500' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {loading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-white"></div>
                ) : action === 'deposit' ? 'Start Deposit with Anchor' : 'Start Withdraw to Bank'}
              </button>
            </div>
          </div>

          {/* Info Side */}
          <div className="flex flex-col justify-center space-y-8 lg:pl-8">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="flex">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-500">
                  <Building2 className="h-6 w-6" />
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-semibold text-white">Interactive Anchors (SEP-24)</h3>
                <p className="mt-2 text-gray-400">
                  Connect directly with verified local financial institutions to move money in and out of the Stellar network using a simple web interface.
                </p>
              </div>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="flex">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-500">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-semibold text-white">Local Payment Methods</h3>
                <p className="mt-2 text-gray-400">
                  Support for Credit Cards, Bank Transfers, SEPA, ACH, Pix, and Mobile Money depending on the anchor you choose.
                </p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="flex">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-semibold text-white">KYC & Compliance</h3>
                <p className="mt-2 text-gray-400">
                  Identity verification is handled securely by the anchors. Your data stays safe while complying with local regulations.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiatGateway;
