import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api, getValidToken, API_BASE } from '../utils/api';
import { Wallet, RefreshCw, DollarSign, ExternalLink, Share2, Copy, Check } from "lucide-react";
import { trackEvent } from '../utils/analytics';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem, HoverCard } from '../components/ui/animations';

const Dashboard: React.FC = () => {
  const { fullWalletAddress } = useWallet();
  const [balances, setBalances] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(`https://rekura.com/invite/${fullWalletAddress?.substring(0, 8) || 'user'}`);
    setCopiedLink(true);
    trackEvent('copy_referral_link', { user: fullWalletAddress });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Fetch wallet balances from Horizon
  useEffect(() => {
    if (!fullWalletAddress) {
      setBalances(null);
      return;
    }

    const fetchBalances = async () => {
      setLoading(true);
      setError('');
      try {
        const horizonUrl = import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET'
          ? 'https://horizon.stellar.org'
          : 'https://horizon-testnet.stellar.org';
        const response = await fetch(`${horizonUrl}/accounts/${fullWalletAddress}`);
        if (!response.ok) {
          setBalances({ error: `Account not yet funded on ${import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? 'Mainnet' : 'Testnet'}.${import.meta.env.VITE_STELLAR_NETWORK !== 'MAINNET' ? ' Use friendbot to fund it.' : ''}` });
        } else {
          const data = await response.json();
          setBalances(data.balances);
        }
      } catch (err) {
        setError('Failed to load balances.');
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [fullWalletAddress]);

  // Fetch subscriptions from backend
  useEffect(() => {
    const fetchSubs = async () => {
      // Only fetch if we have a valid token
      if (!getValidToken()) return;

      const { ok, data } = await api('/user/subscriptions');
      if (ok && data) {
        setSubscriptions(data.data || []);
      }
      
      const paymentsRes = await api('/payments/history?limit=5');
      if (paymentsRes.ok && paymentsRes.data) {
        setPayments(paymentsRes.data.data || []);
      }
    };
    fetchSubs();
  }, [fullWalletAddress]);

  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const totalMonthlySpend = activeSubs.reduce((acc, s) => {
    const amount = parseFloat(s.amount) || 0;
    return acc + (amount / 10000000);
  }, 0);

  // Merchant style mapping
  const merchantStyles: Record<string, { color: string; icon: string }> = {
    'Spotify Premium': { color: '#1DB954', icon: '' },
    'Claude Pro': { color: '#D4A574', icon: '' },
    'Netflix Standard': { color: '#E50914', icon: '' },
    'Amazon Prime': { color: '#FF9900', icon: '' },
  };

  const getDaysRemaining = (dateString: string) => {
    if (!dateString) return null;
    const nextDate = new Date(dateString);
    const now = new Date();
    const diffTime = nextDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <PageWrapper>
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-6xl">
          <FadeIn delay={0.1}>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>Dashboard Overview</h2>
            <p className="text-lg text-black/60 mt-2 mb-10">
              Monitor your automated Web3 payments and account balance.
            </p>
          </FadeIn>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10">
            {/* Balance Card */}
            <StaggerItem className="md:col-span-8 h-full">
              <div className="bg-white border border-black/5 shadow-sm relative overflow-hidden h-full rounded-3xl p-8 flex flex-col justify-between transition-shadow hover:shadow-md">
                <div className="flex justify-between items-center mb-8">
                  <span className="text-sm font-bold uppercase tracking-wider text-black/50">Total Balance</span>
                  <div className="p-2 bg-black/5 rounded-xl">
                    <Wallet className="text-black" size={24} />
                  </div>
                </div>
                <div id="dashboard-balances" className="flex flex-col gap-2">
                  {!fullWalletAddress && (
                    <>
                      <div className="text-4xl md:text-6xl font-bold tracking-tighter text-black">$0.00 <span className="text-xl md:text-2xl text-black/40 font-medium tracking-normal">USDC</span></div>
                      <div className="text-base text-black/60 font-medium mt-2">Connect wallet to view assets</div>
                    </>
                  )}
                  {loading && (
                    <div className="flex flex-col gap-3">
                      <div className="bg-black/5 animate-pulse w-3/5 h-16 rounded-xl"></div>
                      <div className="bg-black/5 animate-pulse w-2/5 h-6 rounded-lg"></div>
                    </div>
                  )}
                  {error && <div className="text-xl font-semibold text-red-500">{error}</div>}
                  {balances && balances.error && (
                    <>
                      <div className="text-3xl md:text-5xl font-bold tracking-tighter text-black">0.00 <span className="text-xl md:text-2xl text-black/40 font-medium tracking-normal">XLM</span></div>
                      <div className="text-base text-black/60 font-medium mt-2">{balances.error}</div>
                    </>
                  )}
                  {balances && Array.isArray(balances) && balances.length === 0 && (
                    <div className="text-3xl md:text-5xl font-bold tracking-tighter text-black">0.00 <span className="text-xl md:text-2xl text-black/40 font-medium tracking-normal">Assets</span></div>
                  )}
                  {balances && Array.isArray(balances) && balances.length > 0 && balances.map((b: any, idx: number) => {
                    const assetCode = b.asset_type === 'native' ? 'XLM' : b.asset_code;
                    const amount = parseFloat(b.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return (
                      <div key={idx} className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-black leading-tight">
                        {amount} <span className="text-2xl text-black/40 font-medium tracking-normal">{assetCode}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </StaggerItem>

            {/* Quick Stats */}
            <div className="flex flex-col gap-6 md:col-span-4 h-full">
              <StaggerItem className="flex-1">
                <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 flex flex-col justify-between h-full transition-shadow hover:shadow-md">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-black/50">Active Subscriptions</span>
                    <div className="p-2 bg-black/5 rounded-xl">
                      <RefreshCw className="text-black" size={20} />
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold tracking-tighter text-black">{activeSubs.length}</div>
                    <div className="text-sm font-medium text-black/60 mt-1">
                      {activeSubs.length > 0 ? 'Recurring payments active' : 'No active subscriptions'}
                    </div>
                  </div>
                </div>
              </StaggerItem>
              <StaggerItem className="flex-1">
                <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 flex flex-col justify-between h-full transition-shadow hover:shadow-md">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-black/50">Monthly Spend</span>
                    <div className="p-2 bg-black/5 rounded-xl">
                      <DollarSign className="text-black" size={20} />
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold tracking-tighter text-black">${totalMonthlySpend.toFixed(2)}</div>
                    <div className="text-sm font-medium text-black/60 mt-1">
                      USDC / month
                    </div>
                  </div>
                </div>
              </StaggerItem>
            </div>
          </StaggerContainer>

          {/* Referral Card */}
          <FadeIn delay={0.3}>
            <HoverCard>
              <div className="mb-10 bg-gradient-to-r from-white to-[#F8F9FA] border border-black/5 shadow-sm rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-5 w-full md:w-auto">
                  <div className="p-4 bg-black/5 text-black rounded-2xl shrink-0">
                    <Share2 size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-black tracking-tight mb-1">Refer a Friend, Earn USDC</h3>
                    <p className="text-sm md:text-base font-medium text-black/60">Invite your friends and get 5 USDC when they make their first subscription.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto md:max-w-md">
                  <div className="flex-1 min-w-0 px-3 md:px-4 py-3 bg-black/5 rounded-xl border border-black/5 text-xs md:text-sm font-medium text-black/70 overflow-hidden text-ellipsis whitespace-nowrap">
                    {`https://rekura.com/invite/${fullWalletAddress?.substring(0, 8) || 'user'}`}
                  </div>
                  <button 
                    onClick={handleCopyReferral} 
                    className="flex items-center gap-2 px-5 py-3 bg-white border border-black/10 rounded-xl hover:bg-black/5 font-semibold text-black transition-colors shadow-sm shrink-0 min-w-[100px] justify-center"
                  >
                    {copiedLink ? <><Check size={18} /> Copied</> : <><Copy size={18} /> Copy</>}
                  </button>
                </div>
              </div>
            </HoverCard>
          </FadeIn>

          {/* Active Subscriptions List */}
          <FadeIn delay={0.4}>
            <h3 className="text-2xl font-bold text-black tracking-tight mb-6">Active Subscriptions</h3>
            <div className="flex flex-col gap-4">
              {activeSubs.length === 0 && !loading && (
                <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-8 text-center">
                  <p className="text-lg text-black/60 font-medium">
                    No active subscriptions. Head to the <strong className="text-black">Subscriptions</strong> tab to subscribe to your favorite services!
                  </p>
                </div>
              )}
              {loading && activeSubs.length === 0 && (
                <>
                  <div className="bg-black/5 animate-pulse w-full h-24 rounded-3xl"></div>
                  <div className="bg-black/5 animate-pulse w-full h-24 rounded-3xl"></div>
                </>
              )}
              {activeSubs.map((sub, idx) => {
                const style = merchantStyles[sub.name] || { color: '#3B82F6', icon: sub.name?.charAt(0) || '?' };
                return (
                  <HoverCard key={idx}>
                    <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 transition-shadow hover:shadow-md">
                      <div className="flex items-center gap-5">
                        <div style={{
                          width: '56px', height: '56px', borderRadius: '14px',
                          background: style.color, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '24px', color: 'white',
                          overflow: 'hidden'
                        }} className="shadow-sm">
                          {sub.logo_url ? <img src={sub.logo_url} alt={sub.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span className="font-bold">{style.icon}</span>}
                        </div>
                        <div>
                          <div className="text-xl font-bold text-black tracking-tight">{sub.name}</div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-black/50 mt-1">
                            Recurring • Next: {sub.next_payment_time ? new Date(sub.next_payment_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (sub.nextPayment || 'Upcoming')}
                          </div>
                          {(sub.next_payment_time || sub.nextPaymentDate) && (
                            <div className="text-xs font-bold uppercase tracking-wider text-black mt-2 bg-black/5 w-fit px-2 py-0.5 rounded-md">
                              {getDaysRemaining(sub.next_payment_time || sub.nextPaymentDate)} Days Remaining
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                        {/* Platform redirect quick-link */}
                        {sub.redirect?.url && (
                          <button
                            className="px-4 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-black font-semibold text-sm transition-colors flex items-center gap-2"
                            onClick={() => {
                              trackEvent('open_merchant_platform', { merchant: sub.name });
                              window.open(sub.redirect.url, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            <ExternalLink size={14} />
                            {sub.redirect.platformName ? `Open ${sub.redirect.platformName}` : 'Open Platform'}
                          </button>
                        )}
                        <div className="flex flex-col items-end">
                          <div className="text-xl font-bold text-black tracking-tight">
                            -{(parseFloat(sub.amount) / 10000000).toFixed(2)} USDC
                          </div>
                          <div className="mt-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black bg-black/5 rounded-md">
                            Active
                          </div>
                        </div>
                      </div>
                    </div>
                  </HoverCard>
                );
              })}
            </div>
          </FadeIn>

          {/* Payment History List */}
          <FadeIn delay={0.5}>
            <h3 className="text-2xl font-bold text-black tracking-tight mb-6 mt-12">Payment History</h3>
            <div className="flex flex-col gap-4">
              {payments.length === 0 && !loading && (
                <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-8 text-center">
                  <p className="text-lg text-black/60 font-medium">
                    No payment history available yet.
                  </p>
                </div>
              )}
              {payments.map((payment, idx) => {
                const isSuccess = payment.status === 'completed';
                const statusColorClass = isSuccess ? 'text-black bg-black/5' : payment.status === 'failed' ? 'text-black/60 bg-black/5' : 'text-black/60 bg-black/5';
                
                return (
                  <HoverCard key={idx}>
                    <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 transition-shadow hover:shadow-md">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black shadow-sm">
                          <DollarSign size={24} />
                        </div>
                        <div>
                          <div className="text-xl font-bold text-black tracking-tight">{payment.plan_name}</div>
                          <div className="text-sm font-medium text-black/50 mt-1">
                            {new Date(payment.executed_at).toLocaleDateString()} • {payment.merchant_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                        {isSuccess && (
                          <button
                            className="px-4 py-2 bg-white border border-black/10 hover:bg-black/5 rounded-xl text-black font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm"
                            onClick={() => window.open(`${API_BASE}/payments/${payment.id}/receipt?token=${getValidToken()}`, '_blank')}
                          >
                            <ExternalLink size={14} /> Receipt
                          </button>
                        )}
                        <div className="flex flex-col items-end">
                          <div className="text-xl font-bold text-black tracking-tight">
                            {(parseFloat(payment.amount) / 10000000).toFixed(2)} {payment.token_address === 'USDC' ? 'USDC' : 'Token'}
                          </div>
                          <div className={`mt-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md ${statusColorClass}`}>
                            {payment.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  </HoverCard>
                );
              })}
            </div>
          </FadeIn>
        </section>
      </main>
    </PageWrapper>
  );
};

export default Dashboard;
