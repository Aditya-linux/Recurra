import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { api, getValidToken } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ExternalLink } from "lucide-react";
import toast from 'react-hot-toast';
import SubscriptionSuccessModal from '../components/SubscriptionSuccessModal';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem, HoverCard } from '../components/ui/animations';
import { ImageWithFallback } from '../components/ui/ImageWithFallback';

const SubscriptionCenter: React.FC = () => {
  const { fullWalletAddress, openModal, signTransaction } = useWallet();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'active' | 'inactive' | 'available'>('available');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubscribedPlan, setLastSubscribedPlan] = useState<{ name: string; amount: string; redirect: any; txHash?: string | null } | null>(null);
  const [selectedMerchantAddress, setSelectedMerchantAddress] = useState<string | null>(null);

  const socket = useSocket();

  const formatStellarAmount = (amount: number) => (Number(amount) / 10000000).toFixed(2);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setFetchError('');
      
      // Fetch public plans (no auth needed)
      const plansResponse = await api('/plans', { public: true });
      if (plansResponse.ok && plansResponse.data) {
        setAvailablePlans(plansResponse.data.data || []);
      }

      // Fetch user's subscriptions (only if authenticated)
      const token = getValidToken();
      if (token) {
        const subsResponse = await api('/subscriptions');
        if (subsResponse.ok && subsResponse.data) {
          setSubscriptions(subsResponse.data.data || []);
        } else {
          setSubscriptions([]);
        }
      } else {
        setSubscriptions([]);
      }
    } catch (e) {
      console.error(e);
      setFetchError('Failed to connect to Rekura Backend.');
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        fetchSubscriptions();
      };
      socket.on('subscription_updated', handleUpdate);
      return () => {
        socket.off('subscription_updated', handleUpdate);
      };
    }
  }, [socket, fetchSubscriptions]);

  // Subscribe via Soroban contract and backend API
  // Subscribe via backend API
  // NOTE: On-chain smart contract integration is disabled until the Soroban contract
  // is deployed on Testnet. When ready, re-enable the contract call before Step 2.
  const handleSubscribe = async (plan: any) => {
    if (!fullWalletAddress) {
      openModal();
      return;
    }
    setLoadingAction(plan.id);

    let txHash: string | null = null;

    try {
      const { Contract, rpc, TransactionBuilder, Networks, nativeToScVal, Transaction } = await import('@stellar/stellar-sdk');
      
      const rpcUrl = import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' 
        ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
        : 'https://soroban-testnet.stellar.org';
      const server = new rpc.Server(rpcUrl);
      const account = await server.getAccount(fullWalletAddress);
      
      // Payment Engine contract address from env
      const contractAddress = import.meta.env.VITE_CONTRACT_PAYMENT_ENGINE || 'CC5DLW4KX7NBDQKBS7F4N2QJEXECVSZMZTZ5WQ2FSFNUM3F7Z37J24XR';
      const contract = new Contract(contractAddress);
      
      const defaultTokenAddress = import.meta.env.VITE_USDC_TOKEN_ADDRESS || 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR';
      let tokenAddress = plan.token_address || defaultTokenAddress;
      if (tokenAddress === 'CCW67TSZV3YI5B5U7T2O5SOPFCRJ55HQQM5Q7QYYNMYY7LZZYYZ6VIVN') {
        tokenAddress = defaultTokenAddress;
      }
      
      // Build transaction
      let tx = new TransactionBuilder(account, {
        fee: '100000', // Base fee, will be updated by prepareTransaction
        networkPassphrase: import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET
      })
      .addOperation(contract.call('create_subscription', 
        nativeToScVal(fullWalletAddress, { type: 'address' }), 
        nativeToScVal(plan.plan_id_on_chain || plan.id, { type: 'string' }),
        nativeToScVal(plan.merchant_address || 'GB3DJRW7V3NRNLLJU7D3YBEAFFRMXORVC55QRFXBG2E5PD4GPFNYS5BW', { type: 'address' }),
        nativeToScVal(tokenAddress, { type: 'address' }),
        nativeToScVal(plan.amount || 10000000, { type: 'i128' }),
        nativeToScVal(plan.interval_seconds || 2592000, { type: 'u64' }),
        nativeToScVal(12, { type: 'u32' }) // max payments
      ))
      .setTimeout(300)
      .build();

      const toastId = toast.loading('Preparing smart contract transaction...');
      const preparedTx = await server.prepareTransaction(tx);

      // Sign transaction
      toast.loading('Please sign the transaction in Freighter...', { id: toastId });
      const signedXdr = await signTransaction(preparedTx.toXDR());
      const signedTx = new Transaction(signedXdr, import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET);

      // Submit transaction
      toast.loading('Submitting transaction to network...', { id: toastId });
      const txResponse = await server.sendTransaction(signedTx);
      
      if (txResponse.status === 'PENDING') {
        txHash = txResponse.hash;
        
        // Wait for network confirmation
        toast.loading('Waiting for network confirmation...', { id: toastId });
        let status = 'PENDING';
        let retries = 0;
        let lastResponse: any = null;
        while ((status === 'PENDING' || status === 'NOT_FOUND') && retries < 15) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          lastResponse = await server.getTransaction(txHash);
          status = lastResponse.status;
          retries++;
        }
        if (status === 'FAILED') {
          let errMsg = 'Transaction failed on-chain.';
          if (lastResponse && lastResponse.errorResultXdr) {
            errMsg += ' Error XDR: ' + lastResponse.errorResultXdr;
          }
          if (lastResponse && lastResponse.resultMetaXdr) {
             console.error("Meta XDR:", lastResponse.resultMetaXdr);
          }
          throw new Error(errMsg);
        } else if (status !== 'SUCCESS') {
          throw new Error(`Transaction timed out (Status: ${status})`);
        }
      } else {
        throw new Error('Transaction submission failed (Status: ' + txResponse.status + '): ' + JSON.stringify(txResponse));
      }
    } catch (err: any) {
      console.error("Full on-chain error:", err);
      let msg = err.message || String(err);
      if (err.response && err.response.data) {
        msg += " - " + JSON.stringify(err.response.data);
      }
      toast.dismiss();
      toast.error('On-chain error: ' + msg, { duration: 5000 });
      setLoadingAction(null);
      return;
    }

    // Step 2: Register subscription in backend
    try {
      const toastId = toast.loading('Registering subscription on backend...');
      const discountCode = undefined;
      const { ok, data, error } = await api('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ 
          planId: plan.id,
          subscriptionIdOnChain: txHash,
          discountCode
        })
      });

      if (ok) {
        const planName = plan.plan_name || plan.name;
        const amountStr = `$${formatStellarAmount(plan.amount)} / mo`;
        toast.success(`Successfully subscribed to ${planName}!`, { id: toastId });
        await fetchSubscriptions();

        // Inject the platformLogoUrl from frontend config if not supplied by backend
        const finalRedirect = data?.redirect || { url: null, label: 'Go to Platform', platformName: plan.merchant_name || planName };
        if (!finalRedirect.platformLogoUrl) {
           finalRedirect.platformLogoUrl = merchantStyles[plan.merchant_name]?.logo || null;
        }

        // Show the success modal with redirect info from backend
        setLastSubscribedPlan({ 
          name: planName, 
          amount: amountStr, 
          redirect: finalRedirect,
          txHash
        });
        setShowSuccessModal(true);
      } else {
        toast.error(`Backend Error: ${error || 'Subscription failed'}`, { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.dismiss();
      toast.error('Subscription failed. ' + (err.message || ''));
    } finally {
      setLoadingAction(null);
    }
  };

  // Cancel or reactivate via backend API
  const handleAction = async (sub: any) => {
    const isCanceling = sub.status === 'active';
    setLoadingAction(sub.id);

    try {
      const endpoint = isCanceling ? 'cancel' : 'resume';
      const { ok } = await api(`/subscriptions/${sub.id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'User initiated' })
      });

      if (ok) {
        toast.success(isCanceling ? `${sub.name} cancelled.` : `${sub.name} reactivated!`);
        await fetchSubscriptions();
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Action failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  // Merchant color/logo mapping — uses local HD logos from /public/logos/
  const merchantStyles: Record<string, { color: string; logo: string; objectFit?: 'cover' | 'contain' }> = {
    'Spotify':    { color: '#1DB954', logo: '/logos/spotify.jpg' },
    'Netflix':    { color: '#E50914', logo: 'https://cdn.simpleicons.org/netflix/white' },
    'Amazon':     { color: '#FF9900', logo: '/logos/amazon.jpg', objectFit: 'contain' },
    'Canva':      { color: '#00C4CC', logo: '/logos/canva.jpg' },
    'JioHotstar': { color: '#6B2D8B', logo: '/logos/jiohotstar.jpg' },
    'Apple TV+':  { color: '#1C1C1E', logo: '/logos/apple-tv-plus.jpg' },
    'Apple':      { color: '#1C1C1E', logo: '/logos/apple-tv-plus.jpg' },
    'Adobe':      { color: '#FFFFFF', logo: '/logos/adobe.jpg', objectFit: 'contain' },
    'YouTube':    { color: '#FF0000', logo: '/logos/youtube.jpg' },
    'Claude':     { color: '#D4A574', logo: 'https://cdn.simpleicons.org/anthropic/white' },
    'Kotha':      { color: '#3B82F6', logo: '' }, // Fallback for your custom test data
  };

  const getMerchantStyle = (nameToMatch: string, fallbackUrl?: string) => {
    if (!nameToMatch) return { color: '#3B82F6', logo: fallbackUrl || '' };
    const normalized = nameToMatch.toLowerCase();
    const match = Object.entries(merchantStyles).find(([key]) => normalized.includes(key.toLowerCase()));
    if (match) return match[1];
    return { color: '#3B82F6', logo: fallbackUrl || '' };
  };

  const filtered = filter === 'available' ? availablePlans : subscriptions.filter(s => s.status === filter);
  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const inactiveCount = subscriptions.filter(s => s.status === 'inactive').length;

  return (
    <PageWrapper>
    <main className="pt-nav" style={{ paddingBottom: '64px' }}>
      <section className="container" style={{ marginTop: '40px' }}>
        <FadeIn delay={0.1}>
          <h2 className="text-h2">Subscription Center & Retail Store</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', marginTop: '8px', marginBottom: '40px' }}>
            Manage your active recurring payments and explore retail subscriptions powered by Rekura.
          </p>
        </FadeIn>

        <div className="grid-12">
          {/* Subscriptions List */}
          <div className="flex flex-col gap-6" style={{ gridColumn: 'span 12' }}>
            <FadeIn delay={0.2} className="flex gap-4 sm-flex-col sm-w-full">
              <Button
                variant={filter === 'available' ? 'outline' : 'ghost'}
                onClick={() => { setFilter('available'); setSelectedMerchantAddress(null); }}
              >
                Retail Storefront ({availablePlans.length} Plans)
              </Button>
              <Button
                variant={filter === 'active' ? 'outline' : 'ghost'}
                onClick={() => setFilter('active')}
              >
                Active ({activeCount})
              </Button>
              <Button
                variant={filter === 'inactive' ? 'outline' : 'ghost'}
                onClick={() => setFilter('inactive')}
              >
                Inactive ({inactiveCount})
              </Button>
            </FadeIn>

            <StaggerContainer id="subscriptions-container" className="flex flex-col gap-4">
              {fetchError && <p className="text-body-lg" style={{ color: 'var(--error)', textAlign: 'center', padding: '40px' }}>{fetchError}</p>}
              {!fetchError && filtered.length === 0 && (
                <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', textAlign: 'center', padding: '40px' }}>
                  {filter === 'available' ? 'No retail plans available right now.' : filter === 'active' ? 'No active subscriptions yet. Browse the Retail Storefront to subscribe!' : 'No inactive subscriptions.'}
                </p>
              )}

              {/* Available Plans - Brands / Plans View */}
              {!fetchError && filter === 'available' && !selectedMerchantAddress && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                  {Array.from(new Set(availablePlans.map(p => p.merchant_address))).map(address => {
                    const plan = availablePlans.find(p => p.merchant_address === address);
                    if (!plan) return null;
                    const style = getMerchantStyle(plan.merchant_name, plan.logo_url);
                    const planCount = availablePlans.filter(p => p.merchant_address === address).length;
                    return (
                      <StaggerItem key={address}>
                        <HoverCard>
                          <Card style={{ transition: 'transform 0.2s', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', cursor: 'pointer' }} onClick={() => setSelectedMerchantAddress(address)}>
                            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                              <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: style.color, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                              }}>
                                <ImageWithFallback src={style.logo} fallbackText={plan.merchant_name} fallbackColor="transparent" style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'cover' }} alt={plan.merchant_name} />
                              </div>
                              <div>
                                <h3 className="text-h3" style={{ fontSize: '20px' }}>{plan.merchant_name}</h3>
                                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                                  {planCount} plan{planCount > 1 ? 's' : ''} available
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </HoverCard>
                      </StaggerItem>
                    );
                  })}
                </div>
              )}

              {!fetchError && filter === 'available' && selectedMerchantAddress && (
                <>
                  <Button variant="ghost" onClick={() => setSelectedMerchantAddress(null)} style={{ alignSelf: 'flex-start', marginBottom: '10px' }}>
                    &larr; Back to Brands
                  </Button>
                  {availablePlans.filter(p => p.merchant_address === selectedMerchantAddress).map(plan => {
                    const baseName = plan.plan_name?.replace(' Premium', '').replace(' Standard', '').replace(' Pro', '') || '';
                    const style = getMerchantStyle(plan.merchant_name, plan.logo_url);
                    const alreadySubscribed = subscriptions.some(s => s.name === plan.plan_name && s.status === 'active');
                    return (
                      <StaggerItem key={plan.id}>
                        <div className="flex flex-col md:flex-row items-center justify-between bg-[var(--surface-container)] border border-[var(--glass-border)] rounded-2xl p-4 md:p-6 w-full gap-6">
                          {/* Left: Logo & Name */}
                          <div className="flex items-center gap-4 w-full md:w-auto">
                            <div style={{
                              width: '48px', height: '48px', borderRadius: '12px',
                              background: style.color, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                            }}>
                              <ImageWithFallback src={style.logo} fallbackText={baseName} fallbackColor="transparent" style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'cover' }} alt={baseName} />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-white leading-tight tracking-tight">{plan.plan_name}</h3>
                              <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                                by {plan.merchant_name}
                              </p>
                            </div>
                          </div>

                          {/* Right: Price & Actions */}
                          <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto ml-auto">
                            <div className="flex items-baseline gap-1">
                              <span className="text-[36px] font-bold text-white tracking-tighter leading-none">${formatStellarAmount(plan.amount)}</span>
                              <span className="text-sm font-medium text-[var(--on-surface-variant)] ml-1">/ {plan.interval_seconds === 2592000 ? 'mo' : plan.interval_seconds === 31536000 ? 'yr' : 'cycle'}</span>
                            </div>
                            
                            {plan.tier && (
                              <div className="hidden sm:block px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)] border border-[var(--glass-border)] rounded-md bg-[var(--surface-container-high)]">
                                {plan.tier}
                              </div>
                            )}

                            <div className="flex items-center gap-4 w-full sm:w-auto">
                              <Button variant="outline" onClick={() => toast('Discount codes coming soon')} className="w-full sm:w-auto text-sm h-10 px-4 text-[var(--on-surface-variant)] hover:text-white border-[var(--glass-border)]">
                                Discount Code
                              </Button>
                              
                              {alreadySubscribed ? (
                                <span className="text-sm font-medium text-[var(--on-surface-variant)] px-4">Subscribed</span>
                              ) : (
                                <Button 
                                  onClick={() => handleSubscribe(plan)}
                                  disabled={loadingAction === plan.id}
                                  className="w-full sm:w-auto h-10 px-6 bg-[var(--on-surface)] hover:opacity-90 text-[var(--surface)] font-medium transition-opacity"
                                >
                                  {loadingAction === plan.id ? <><Loader2 className="animate-spin mr-2" size={16} /> Subscribing...</> : 'Subscribe'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </>
              )}

              {/* Active / Inactive Subscriptions */}
              {!fetchError && filter !== 'available' && filtered.map(sub => {
                const isInactive = sub.status === 'inactive';
                const subBaseName = sub.name?.replace(' Premium', '').replace(' Standard', '').replace(' Pro', '') || '';
                const style = getMerchantStyle(subBaseName || sub.name);

                return <StaggerItem key={sub.id}><Card style={{ transition: 'transform 0.2s', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', opacity: isInactive ? 0.6 : 1 }}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div style={{
                            width: '52px', height: '52px', borderRadius: '14px',
                            background: isInactive ? 'var(--surface-container-high)' : style.color, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                          }}>
                            {style.logo ? <img src={style.logo} alt={sub.name} style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'cover', filter: isInactive ? 'grayscale(100%)' : 'none' }} /> : <span style={{color:'white', fontWeight:600}}>{(sub.name || '?').charAt(0)}</span>}
                          </div>
                          <div>
                            <h3 className="text-h3" style={{ fontSize: '20px' }}>{sub.name}</h3>
                            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                              {isInactive ? 'Cancelled' : `Next Payment: ${sub.nextPayment}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 sm-items-start sm-mt-4 sm-w-full">
                          <div className="text-h3" style={{ fontSize: '22px', fontWeight: 700, color: isInactive ? 'var(--on-surface-variant)' : 'var(--on-surface)' }}>
                            {sub.amount}
                          </div>
                          <div className="flex gap-2 sm-w-full">
                            {/* Platform redirect button */}
                            {!isInactive && sub.redirect?.url && (
                              <HoverCard>
                                <Button
                                  variant="outline"
                                  className="sm-w-full"
                                  onClick={() => window.open(sub.redirect.url, '_blank', 'noopener,noreferrer')}
                                  style={{ minWidth: '120px', gap: '6px' }}
                                >
                                  <ExternalLink size={14} />
                                  {sub.redirect.label || `Open ${sub.redirect.platformName || 'Platform'}`}
                                </Button>
                              </HoverCard>
                            )}
                            {!isInactive && (
                              <HoverCard>
                                <Button
                                  variant="destructive"
                                  className="sm-w-full"
                                  onClick={() => handleAction(sub)}
                                  disabled={loadingAction === sub.id}
                                  style={{ minWidth: '120px' }}
                                >
                                  {loadingAction === sub.id ? (
                                    <><Loader2 className="animate-spin mr-2" size={16} /> Cancelling...</>
                                  ) : 'Cancel Plan'}
                                </Button>
                              </HoverCard>
                            )}
                          </div>
                          {!isInactive && sub.subscription_id_on_chain && (
                            <a
                              href={`https://stellar.expert/explorer/${import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? 'public' : 'testnet'}/tx/${sub.subscription_id_on_chain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium mt-2 flex items-center gap-1 hover:underline"
                              style={{ color: 'var(--primary, #3B82F6)' }}
                            >
                              Verify on Stellar Explorer <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card></StaggerItem>;
              })}
            </StaggerContainer>
          </div>
        </div>
      </section>
    </main>

    {/* Success Modal */}
    <SubscriptionSuccessModal
      isOpen={showSuccessModal}
      onClose={() => {
        setShowSuccessModal(false);
        setLastSubscribedPlan(null);
        setFilter('active');
      }}
      planName={lastSubscribedPlan?.name || ''}
      amount={lastSubscribedPlan?.amount || ''}
      redirect={lastSubscribedPlan?.redirect || null}
      txHash={lastSubscribedPlan?.txHash || null}
      />
    </PageWrapper>
  );
};

export default SubscriptionCenter;
