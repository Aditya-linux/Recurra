import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api, getValidToken, API_BASE } from '../utils/api';
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, RefreshCw, DollarSign, ExternalLink, Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <PageWrapper className="pt-nav" style={{ paddingBottom: '64px' }}>
      <section className="container" style={{ marginTop: '40px' }}>
        <FadeIn delay={0.1}>
          <h2 className="text-h2">Dashboard Overview</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', marginTop: '8px', marginBottom: '40px' }}>
            Monitor your automated Web3 payments and account balance.
          </p>
        </FadeIn>

        <StaggerContainer className="grid-12" style={{ marginBottom: '40px' }}>
          {/* Balance Card */}
          <StaggerItem style={{ gridColumn: 'span 8' }}>
          <Card style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', position: 'relative', overflow: 'hidden', height: '100%' }}>
            <CardContent className="p-6 flex flex-col h-full justify-between">
              <div className="flex justify-between items-center" style={{ marginBottom: '24px' }}>
                <span className="text-label-caps" style={{ color: 'var(--on-surface-variant)' }}>Total Balance</span>
                <Wallet className="text-primary" size={24} />
              </div>
              <div id="dashboard-balances" className="flex flex-col gap-2">
                {!fullWalletAddress && (
                  <>
                    <div className="text-h1" style={{ fontSize: '64px' }}>$0.00 <span className="text-body-lg" style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>USDC</span></div>
                    <div className="text-body-md flex items-center gap-2" style={{ color: 'var(--on-surface-variant)', marginTop: '8px' }}>Connect wallet to view assets</div>
                  </>
                )}
                {loading && (
                  <div className="flex flex-col gap-3">
                    <div className="skeleton" style={{ width: '60%', height: '64px', borderRadius: '8px' }}></div>
                    <div className="skeleton" style={{ width: '40%', height: '24px', borderRadius: '4px' }}></div>
                  </div>
                )}
                {error && <div className="text-h3" style={{ color: 'var(--error)' }}>{error}</div>}
                {balances && balances.error && (
                  <>
                    <div className="text-h1" style={{ fontSize: '48px' }}>0.00 <span className="text-body-lg" style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>XLM</span></div>
                    <div className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '8px' }}>{balances.error}</div>
                  </>
                )}
                {balances && Array.isArray(balances) && balances.length === 0 && (
                  <div className="text-h1" style={{ fontSize: '48px' }}>0.00 <span className="text-body-lg" style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>Assets</span></div>
                )}
                {balances && Array.isArray(balances) && balances.length > 0 && balances.map((b: any, idx: number) => {
                  const assetCode = b.asset_type === 'native' ? 'XLM' : b.asset_code;
                  const amount = parseFloat(b.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return (
                    <div key={idx} className="text-h1" style={{ fontSize: '48px', lineHeight: 1.2 }}>
                      {amount} <span className="text-body-lg" style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>{assetCode}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          </StaggerItem>

          {/* Quick Stats */}
          <div className="flex flex-col gap-4" style={{ gridColumn: 'span 4' }}>
            <StaggerItem style={{ flex: 1 }}>
              <Card style={{ height: '100%' }}>
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
                  <span className="text-label-caps" style={{ color: 'var(--on-surface-variant)' }}>Active Subscriptions</span>
                  <RefreshCw className="text-primary" size={20} />
                </div>
                <div>
                  <div className="text-h1" style={{ fontSize: '48px' }}>{activeSubs.length}</div>
                  <div className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                    {activeSubs.length > 0 ? 'Recurring payments active' : 'No active subscriptions'}
                  </div>
                </div>
              </CardContent>
            </Card>
            </StaggerItem>
            <StaggerItem style={{ flex: 1 }}>
              <Card style={{ height: '100%' }}>
                <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
                  <span className="text-label-caps" style={{ color: 'var(--on-surface-variant)' }}>Monthly Spend</span>
                  <DollarSign className="text-primary" size={20} />
                </div>
                <div>
                  <div className="text-h1" style={{ fontSize: '36px' }}>${totalMonthlySpend.toFixed(2)}</div>
                  <div className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                    USDC / month
                  </div>
                </div>
              </CardContent>
            </Card>
            </StaggerItem>
          </div>
        </StaggerContainer>

        {/* Referral Card */}
        <FadeIn delay={0.3}>
          <HoverCard>
            <Card style={{ marginBottom: '40px', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid rgba(6, 214, 160, 0.2)' }}>
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div style={{ padding: '12px', background: 'rgba(52, 120, 246, 0.1)', color: 'var(--accent-blue)', borderRadius: '12px' }}>
                <Share2 size={24} />
              </div>
              <div>
                <h3 className="text-h3" style={{ fontSize: '20px', marginBottom: '4px' }}>Refer a Friend, Earn USDC</h3>
                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>Invite your friends and get 5 USDC when they make their first subscription.</p>
              </div>
            </div>
            <div className="flex items-center gap-2" style={{ width: '100%', maxWidth: '350px' }}>
              <div style={{ flex: 1, padding: '10px 16px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--outline-variant)', fontSize: '14px', color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {`https://rekura.com/invite/${fullWalletAddress?.substring(0, 8) || 'user'}`}
              </div>
              <Button onClick={handleCopyReferral} variant="outline" style={{ display: 'flex', gap: '8px', minWidth: '100px' }}>
                {copiedLink ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
              </Button>
            </div>
          </CardContent>
        </Card>
        </HoverCard>
        </FadeIn>

        {/* Active Subscriptions List */}
        <FadeIn delay={0.4}>
          <h3 className="text-h3" style={{ marginBottom: '24px', fontSize: '24px' }}>Active Subscriptions</h3>
          <div className="panel flex flex-col gap-4">
          {activeSubs.length === 0 && !loading && (
            <Card style={{ padding: '24px', textAlign: 'center' }}>
              <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)' }}>
                No active subscriptions. Head to the <strong>Subscriptions</strong> tab to subscribe to your favorite services!
              </p>
            </Card>
          )}
          {loading && activeSubs.length === 0 && (
            <>
              <div className="skeleton" style={{ width: '100%', height: '80px', borderRadius: '12px' }}></div>
              <div className="skeleton" style={{ width: '100%', height: '80px', borderRadius: '12px' }}></div>
            </>
          )}
          {activeSubs.map((sub, idx) => {
            const style = merchantStyles[sub.name] || { color: '#3B82F6', icon: sub.name?.charAt(0) || '?' };
            return (
              <HoverCard key={idx}>
              <Card className="flex justify-between items-center p-4">
                <div className="flex items-center gap-4">
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: style.color, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '22px', color: 'white',
                    overflow: 'hidden'
                  }}>
                    {sub.logo_url ? <img src={sub.logo_url} alt={sub.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : style.icon}
                  </div>
                  <div>
                    <div className="text-body-lg" style={{ fontWeight: 500 }}>{sub.name}</div>
                    <div className="text-label-caps" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                      Recurring • Next: {sub.next_payment_time ? new Date(sub.next_payment_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (sub.nextPayment || 'Upcoming')}
                    </div>
                    {(sub.next_payment_time || sub.nextPaymentDate) && (
                      <div className="text-label-caps" style={{ color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                        {getDaysRemaining(sub.next_payment_time || sub.nextPaymentDate)} Days Remaining
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Platform redirect quick-link */}
                  {sub.redirect?.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        trackEvent('open_merchant_platform', { merchant: sub.name });
                        window.open(sub.redirect.url, '_blank', 'noopener,noreferrer');
                      }}
                      style={{ gap: '4px', fontSize: '12px' }}
                    >
                      <ExternalLink size={12} />
                      {sub.redirect.platformName ? `Open ${sub.redirect.platformName}` : 'Open Platform'}
                    </Button>
                  )}
                  <div className="flex flex-col items-end">
                    <div className="text-body-lg" style={{ fontWeight: 600 }}>
                      -{(parseFloat(sub.amount) / 10000000).toFixed(2)} USDC
                    </div>
                    <div className="status-chip" style={{ marginTop: '4px', padding: '2px 8px', fontSize: '10px', color: '#1DB954', borderColor: '#1DB954' }}>Active</div>
                  </div>
                </div>
              </Card>
              </HoverCard>
            );
          })}
          </div>
        </FadeIn>

        {/* Payment History List */}
        <FadeIn delay={0.5}>
          <h3 className="text-h3" style={{ marginBottom: '24px', fontSize: '24px', marginTop: '40px' }}>Payment History</h3>
          <div className="panel flex flex-col gap-4">
            {payments.length === 0 && !loading && (
              <Card style={{ padding: '24px', textAlign: 'center' }}>
                <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)' }}>
                  No payment history available yet.
                </p>
              </Card>
            )}
            {payments.map((payment, idx) => {
              const statusColor = payment.status === 'completed' ? '#1DB954' : payment.status === 'failed' ? '#E50914' : '#F59E0B';
              return (
                <HoverCard key={idx}>
                  <Card className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-4">
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: 'var(--surface-container-high)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '18px', color: 'var(--primary)'
                      }}>
                        <DollarSign size={20} />
                      </div>
                      <div>
                        <div className="text-body-lg" style={{ fontWeight: 500 }}>{payment.plan_name}</div>
                        <div className="text-label-caps" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                          {new Date(payment.executed_at).toLocaleDateString()} • {payment.merchant_name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {payment.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`${API_BASE}/payments/${payment.id}/receipt?token=${getValidToken()}`, '_blank')}
                          style={{ gap: '4px', fontSize: '12px' }}
                        >
                          <ExternalLink size={12} /> Receipt
                        </Button>
                      )}
                      <div className="flex flex-col items-end">
                        <div className="text-body-lg" style={{ fontWeight: 600 }}>
                          {(parseFloat(payment.amount) / 10000000).toFixed(2)} {payment.token_address === 'USDC' ? 'USDC' : 'Token'}
                        </div>
                        <div className="status-chip" style={{ marginTop: '4px', padding: '2px 8px', fontSize: '10px', color: statusColor, borderColor: statusColor, textTransform: 'capitalize' }}>
                          {payment.status}
                        </div>
                      </div>
                    </div>
                  </Card>
                </HoverCard>
              );
            })}
          </div>
        </FadeIn>
      </section>
    </PageWrapper>
  );
};

export default Dashboard;
