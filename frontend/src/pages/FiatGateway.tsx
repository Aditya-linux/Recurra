import React, { useState, useEffect } from 'react';
import { Globe, ArrowRightLeft, CreditCard, Building2, CheckCircle2 } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem } from '../components/ui/animations';
import { AnchorClient } from '../utils/AnchorClient';

const FiatGateway: React.FC = () => {
  const { walletAddress, fullWalletAddress, signTransaction } = useWallet();
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
      setRates({ ...res.data.rates, USDC: 1.0 });
    } catch (err) {
      console.error('Failed to fetch rates', err);
      setRates({ USD: 1.0, EUR: 0.92, GBP: 0.79, INR: 83.5, USDC: 1.0 });
    }
  };

  useEffect(() => { fetchRates(); }, []);

  useEffect(() => {
    if (rates[currency] && rates['USDC']) {
      const rateToUSD = rates[currency] || 1;
      if (action === 'deposit') {
        setConvertedAmount((Number(amount) / rateToUSD).toFixed(2));
      } else {
        setConvertedAmount((Number(amount) * rateToUSD).toFixed(2));
      }
    }
  }, [amount, currency, rates, action]);

  const handleInteractiveFlow = async () => {
    if (!walletAddress || !fullWalletAddress) { toast.error('Connect your wallet first'); return; }
    setLoading(true);
    
    let toastId;
    try {
      const domain = 'testanchor.stellar.org';
      
      // Step 1: SEP-10 Authentication
      toastId = toast.loading('Waiting for wallet signature to authenticate...', { duration: 60000 });
      const jwt = await AnchorClient.authenticate(domain, fullWalletAddress, signTransaction);
      toast.success('Wallet authenticated!', { id: toastId });
      
      // Step 2: SEP-24 Interactive Flow
      toastId = toast.loading('Initiating interactive flow...');
      const url = await AnchorClient.initiateInteractiveFlow(domain, action, 'USDC', fullWalletAddress, jwt);
      toast.dismiss(toastId);
      
      if (url) {
        window.open(url, 'sep24-interactive', 'width=500,height=700');
      }
    } catch (err: any) {
      if (toastId) toast.dismiss(toastId);
      toast.error(err.message || `Failed to initiate ${action}`);
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F5F5] text-black">
        <div className="text-center">
          <Globe className="mx-auto mb-4 h-16 w-16 text-black/20" />
          <h2 className="text-2xl font-bold">Connect your wallet</h2>
          <p className="mt-2 text-black/50">Please connect your Stellar wallet to access Fiat On/Off Ramps.</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-6xl">
          <FadeIn delay={0.1}>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>
              Cross-Border Fiat Gateway
            </h2>
            <p className="text-lg text-black/60 mt-2 mb-10">
              Seamlessly convert your local currency to USDC on-chain (SEP-24/SEP-31).
            </p>
          </FadeIn>

          <StaggerContainer className="grid gap-8 lg:grid-cols-2">
            {/* Exchange Card */}
            <StaggerItem>
              <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-8">
                <div className="mb-6 flex rounded-2xl bg-[#F5F5F5] p-1">
                  <button
                    onClick={() => setAction('deposit')}
                    className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                      action === 'deposit' ? 'bg-black text-white shadow-sm' : 'text-black/40 hover:text-black'
                    }`}
                  >
                    Deposit (On-Ramp)
                  </button>
                  <button
                    onClick={() => setAction('withdraw')}
                    className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                      action === 'withdraw' ? 'bg-black text-white shadow-sm' : 'text-black/40 hover:text-black'
                    }`}
                  >
                    Withdraw (Off-Ramp)
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-black/5 bg-[#F5F5F5] p-4 transition focus-within:border-black/20 focus-within:ring-1 focus-within:ring-black/10">
                    <label className="text-xs font-bold text-black/40 uppercase tracking-wider">
                      {action === 'deposit' ? 'You Pay' : 'You Send'}
                    </label>
                    <div className="mt-2 flex items-center">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-transparent text-3xl font-bold text-black outline-none"
                        placeholder="0.00"
                      />
                      <select
                        value={action === 'deposit' ? currency : 'USDC'}
                        onChange={(e) => action === 'deposit' && setCurrency(e.target.value)}
                        disabled={action === 'withdraw'}
                        className="ml-4 cursor-pointer appearance-none rounded-xl bg-white border border-black/5 py-2 pl-4 pr-8 font-bold text-black outline-none text-sm"
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F5] border border-black/5">
                      <ArrowRightLeft className="h-5 w-5 text-black/30 rotate-90" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/5 bg-[#F5F5F5] p-4">
                    <label className="text-xs font-bold text-black/40 uppercase tracking-wider">
                      You Receive (approx)
                    </label>
                    <div className="mt-2 flex items-center">
                      <input
                        type="text"
                        readOnly
                        value={convertedAmount}
                        className="w-full bg-transparent text-3xl font-bold text-black/60 outline-none"
                      />
                      <select
                        value={action === 'withdraw' ? currency : 'USDC'}
                        onChange={(e) => action === 'withdraw' && setCurrency(e.target.value)}
                        disabled={action === 'deposit'}
                        className="ml-4 cursor-pointer appearance-none rounded-xl bg-white border border-black/5 py-2 pl-4 pr-8 font-bold text-black outline-none text-sm"
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
                  
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3.5 text-sm text-blue-700 font-medium">
                    1 {currency} = {rates[currency] ? (1 / rates[currency]).toFixed(4) : '...'} USDC
                  </div>

                  <button
                    onClick={handleInteractiveFlow}
                    disabled={loading}
                    className="w-full rounded-2xl bg-black py-4 text-lg font-bold text-white transition hover:bg-black/80 flex justify-center items-center"
                  >
                    {loading ? (
                      <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-white"></div>
                    ) : action === 'deposit' ? 'Start Deposit with Anchor' : 'Start Withdraw to Bank'}
                  </button>
                </div>
              </div>
            </StaggerItem>

            {/* Info Side */}
            <StaggerItem>
              <div className="flex flex-col justify-center space-y-6 lg:pl-4">
                <FadeIn delay={0.3}>
                  <div className="flex bg-white border border-black/5 shadow-sm rounded-3xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Building2 className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-bold text-black">Interactive Anchors (SEP-24)</h3>
                      <p className="mt-1 text-black/50 text-sm leading-relaxed">
                        Connect directly with verified local financial institutions to move money in and out of the Stellar network.
                      </p>
                    </div>
                  </div>
                </FadeIn>
                
                <FadeIn delay={0.4}>
                  <div className="flex bg-white border border-black/5 shadow-sm rounded-3xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                        <CreditCard className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-bold text-black">Local Payment Methods</h3>
                      <p className="mt-1 text-black/50 text-sm leading-relaxed">
                        Support for Credit Cards, Bank Transfers, SEPA, ACH, Pix, and Mobile Money depending on your anchor.
                      </p>
                    </div>
                  </div>
                </FadeIn>

                <FadeIn delay={0.5}>
                  <div className="flex bg-white border border-black/5 shadow-sm rounded-3xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-bold text-black">KYC & Compliance</h3>
                      <p className="mt-1 text-black/50 text-sm leading-relaxed">
                        Identity verification is handled securely by the anchors while complying with local regulations.
                      </p>
                    </div>
                  </div>
                </FadeIn>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </section>
      </main>
    </PageWrapper>
  );
};

export default FiatGateway;
