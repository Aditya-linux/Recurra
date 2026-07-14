import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { api, getValidToken } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import { Button } from "@/components/ui/button";

import { Loader2, ExternalLink } from "lucide-react";
import toast from 'react-hot-toast';
import SubscriptionSuccessModal from '../components/SubscriptionSuccessModal';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem, HoverCard } from '../components/ui/animations';
import { ImageWithFallback } from '../components/ui/ImageWithFallback';

const SubscriptionCenter: React.FC = () => {
  const { fullWalletAddress, openModal, signTransaction } = useWallet();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState<'active' | 'inactive' | 'available' | 'history'>('available');
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

      // Fetch user's subscriptions and payments (only if authenticated)
      const token = getValidToken();
      if (token) {
        const subsResponse = await api('/subscriptions');
        if (subsResponse.ok && subsResponse.data) {
          setSubscriptions(subsResponse.data.data || []);
        } else {
          setSubscriptions([]);
        }
        
        const paymentsResponse = await api('/payments/history');
        if (paymentsResponse.ok && paymentsResponse.data) {
          setPayments(paymentsResponse.data.data || []);
        } else {
          setPayments([]);
        }
      } else {
        setSubscriptions([]);
        setPayments([]);
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
    const defaultColor = '#3B82F6';
    if (!nameToMatch) return { color: defaultColor, logo: fallbackUrl || '' };
    const normalized = nameToMatch.toLowerCase();
    const match = Object.entries(merchantStyles).find(([key]) => normalized.includes(key.toLowerCase()));
    const hardcoded = match ? match[1] : null;
    return {
      color: hardcoded?.color || defaultColor,
      logo: fallbackUrl || hardcoded?.logo || '',
      objectFit: hardcoded?.objectFit
    };
  };

  const getDaysRemaining = (dateString: string) => {
    if (!dateString) return null;
    const nextDate = new Date(dateString);
    const now = new Date();
    const diffTime = nextDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const isActiveSub = (s: any) => ['active', 'trialing', 'past_due'].includes(s.status);
  const isInactiveSub = (s: any) => ['inactive', 'cancelled', 'expired'].includes(s.status);

  const filtered = filter === 'available' ? availablePlans : subscriptions.filter(s => filter === 'active' ? isActiveSub(s) : (filter === 'inactive' ? isInactiveSub(s) : s.status === filter));
  const activeCount = subscriptions.filter(isActiveSub).length;
  const inactiveCount = subscriptions.filter(isInactiveSub).length;

  return (
    <PageWrapper>
    <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
      <section className="container mx-auto px-4 md:px-6 mt-10 max-w-6xl">
        <FadeIn delay={0.1}>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>Subscription Center & Retail Store</h2>
          <p className="text-lg text-black/60 mt-2 mb-10">
            Manage your active recurring payments and explore retail subscriptions powered by Rekura.
          </p>
        </FadeIn>

        <div className="w-full">
          {/* Subscriptions List */}
          <div className="flex flex-col gap-8 w-full">
            <FadeIn delay={0.2} className="flex flex-wrap gap-3">
              <Button
                variant={filter === 'available' ? 'default' : 'outline'}
                onClick={() => { setFilter('available'); setSelectedMerchantAddress(null); }}
                className={`rounded-full px-4 md:px-6 text-sm transition-all duration-200 ${filter === 'available' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black border-black/10 hover:bg-black/5 shadow-sm'}`}
              >
                Retail Storefront ({availablePlans.length} Plans)
              </Button>
              <Button
                variant={filter === 'active' ? 'default' : 'outline'}
                onClick={() => setFilter('active')}
                className={`rounded-full px-4 md:px-6 text-sm transition-all duration-200 ${filter === 'active' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black border-black/10 hover:bg-black/5 shadow-sm'}`}
              >
                Active ({activeCount})
              </Button>
              <Button
                variant={filter === 'inactive' ? 'default' : 'outline'}
                onClick={() => setFilter('inactive')}
                className={`rounded-full px-4 md:px-6 text-sm transition-all duration-200 ${filter === 'inactive' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black border-black/10 hover:bg-black/5 shadow-sm'}`}
              >
                Inactive ({inactiveCount})
              </Button>
              <Button
                variant={filter === 'history' ? 'default' : 'outline'}
                onClick={() => setFilter('history')}
                className={`rounded-full px-4 md:px-6 text-sm transition-all duration-200 ${filter === 'history' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black border-black/10 hover:bg-black/5 shadow-sm'}`}
              >
                History ({payments.length})
              </Button>
            </FadeIn>

            <StaggerContainer id="subscriptions-container" className="flex flex-col gap-4">
              {fetchError && <p className="text-lg text-red-500 text-center py-10">{fetchError}</p>}
              {!fetchError && filtered.length === 0 && (
                <p className="text-lg text-black/50 text-center py-10">
                  {filter === 'available' ? 'No retail plans available right now.' : filter === 'active' ? 'No active subscriptions yet. Browse the Retail Storefront to subscribe!' : 'No inactive subscriptions.'}
                </p>
              )}

              {/* Available Plans - Brands / Plans View */}
              {!fetchError && filter === 'available' && !selectedMerchantAddress && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Array.from(new Set(availablePlans.map(p => p.merchant_address))).map(address => {
                    const plan = availablePlans.find(p => p.merchant_address === address);
                    if (!plan) return null;
                    const style = getMerchantStyle(plan.merchant_name, plan.logo_url);
                    const planCount = availablePlans.filter(p => p.merchant_address === address).length;
                    return (
                      <StaggerItem key={address}>
                        <HoverCard>
                          <div 
                            className="bg-white rounded-3xl p-6 flex flex-col items-center text-center gap-4 border border-black/5 shadow-sm hover:shadow-md transition-all cursor-pointer h-full"
                            onClick={() => setSelectedMerchantAddress(address)}
                          >
                            <div style={{
                              width: '64px', height: '64px', borderRadius: '16px',
                              background: style.color, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                            }} className="shadow-sm">
                              <ImageWithFallback src={style.logo} fallbackText={plan.merchant_name} fallbackColor="transparent" style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'cover' }} alt={plan.merchant_name} />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-black">{plan.merchant_name}</h3>
                              <p className="text-sm text-black/50 mt-1 font-medium">
                                {planCount} plan{planCount > 1 ? 's' : ''} available
                              </p>
                            </div>
                          </div>
                        </HoverCard>
                      </StaggerItem>
                    );
                  })}
                </div>
              )}

              {!fetchError && filter === 'available' && selectedMerchantAddress && (
                <>
                  <button 
                    onClick={() => setSelectedMerchantAddress(null)} 
                    className="self-start mb-2 px-4 py-2 text-black/60 hover:text-black hover:bg-black/5 rounded-full transition-colors flex items-center gap-2 font-medium"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '18px'}}>arrow_back</span>
                    Back to Brands
                  </button>
                  {availablePlans.filter(p => p.merchant_address === selectedMerchantAddress).map(plan => {
                    const baseName = plan.plan_name?.replace(' Premium', '').replace(' Standard', '').replace(' Pro', '') || '';
                    const style = getMerchantStyle(plan.merchant_name, plan.logo_url);
                    const activeSub = subscriptions.find(s => s.name === plan.plan_name && s.status === 'active');
                    const alreadySubscribed = !!activeSub;
                    return (
                      <StaggerItem key={plan.id}>
                        <div className="flex flex-col md:flex-row items-center justify-between bg-white border border-black/5 shadow-sm rounded-3xl p-6 w-full gap-6 hover:shadow-md transition-shadow">
                          {/* Left: Logo & Name */}
                          <div className="flex items-center gap-5 w-full md:w-auto">
                            <div style={{
                              width: '56px', height: '56px', borderRadius: '14px',
                              background: style.color, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                            }} className="shadow-sm">
                              <ImageWithFallback src={style.logo} fallbackText={baseName} fallbackColor="transparent" style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'cover' }} alt={baseName} />
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-black leading-tight tracking-tight">{plan.plan_name}</h3>
                              <p className="text-sm font-medium text-black/50 mt-1">
                                by {plan.merchant_name}
                              </p>
                            </div>
                          </div>

                          {/* Right: Price & Actions */}
                          <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto ml-auto">
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-bold text-black tracking-tighter leading-none">${formatStellarAmount(plan.amount)}</span>
                              <span className="text-sm font-semibold text-black/40 ml-1">/ {plan.interval_seconds === 2592000 ? 'mo' : plan.interval_seconds === 31536000 ? 'yr' : 'cycle'}</span>
                            </div>
                            
                            {plan.tier && (
                              <div className="hidden sm:block px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-black/60 border border-black/10 rounded-lg bg-black/5">
                                {plan.tier}
                              </div>
                            )}

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <button 
                                onClick={() => toast('Discount codes coming soon')} 
                                className="w-full sm:w-auto text-sm font-medium h-12 px-5 text-black/60 hover:text-black bg-transparent hover:bg-black/5 rounded-xl transition-colors"
                              >
                                Discount Code
                              </button>
                              
                              {alreadySubscribed && activeSub ? (
                                <button 
                                  onClick={() => handleAction(activeSub)} 
                                  disabled={loadingAction === activeSub.id}
                                  className="w-full sm:w-auto h-12 px-8 font-semibold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center disabled:opacity-50"
                                >
                                  {loadingAction === activeSub.id ? <><Loader2 className="animate-spin mr-2" size={18} /> Cancelling...</> : 'Unsubscribe'}
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleSubscribe(plan)}
                                  disabled={loadingAction === plan.id}
                                  className="w-full sm:w-auto h-12 px-8 font-semibold rounded-xl bg-black text-white hover:bg-gray-800 transition-colors flex items-center justify-center shadow-md hover:shadow-lg disabled:opacity-50"
                                >
                                  {loadingAction === plan.id ? <><Loader2 className="animate-spin mr-2" size={18} /> Subscribing...</> : 'Subscribe'}
                                </button>
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
              {!fetchError && (filter === 'active' || filter === 'inactive') && filtered.map(sub => {
                const isInactive = isInactiveSub(sub);
                const subBaseName = sub.name.split(' - ')[0];
                const style = getMerchantStyle(subBaseName || sub.name, sub.logoUrl);

                return (
                  <StaggerItem key={sub.id}>
                    <div className={`bg-white rounded-3xl p-6 border border-black/5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all ${isInactive ? 'opacity-60 grayscale' : 'hover:shadow-md'}`}>
                      <div className="flex items-center gap-5">
                        <div style={{
                          width: '56px', height: '56px', borderRadius: '14px',
                          background: isInactive ? '#E5E5E5' : style.color, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', overflow: 'hidden', flexShrink: 0
                        }} className="shadow-sm">
                          {style.logo ? <img src={style.logo} alt={sub.name} style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'cover' }} /> : <span className="text-white font-bold text-xl">{(sub.name || '?').charAt(0)}</span>}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-black tracking-tight">{sub.name}</h3>
                          <p className="text-sm font-medium text-black/50 mt-1">
                            {isInactive ? 'Cancelled' : `Next Payment: ${sub.nextPayment}`}
                          </p>
                          {!isInactive && sub.nextPaymentDate && (
                            <p className="text-xs font-bold uppercase tracking-wider text-green-600 mt-2 bg-green-50 w-fit px-2 py-1 rounded-md">
                              {getDaysRemaining(sub.nextPaymentDate)} Days Remaining
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
                        <div className="text-3xl font-bold text-black tracking-tight">
                          {sub.amount}
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-start md:justify-end">
                          {/* Platform redirect button */}
                          {!isInactive && sub.redirect?.url && (
                            <button
                              className="h-10 px-4 rounded-xl bg-black/5 text-black hover:bg-black/10 font-semibold text-sm transition-colors flex items-center gap-2"
                              onClick={() => window.open(sub.redirect.url, '_blank', 'noopener,noreferrer')}
                            >
                              <ExternalLink size={16} />
                              {sub.redirect.label || `Open ${sub.redirect.platformName || 'Platform'}`}
                            </button>
                          )}
                          {!isInactive && (
                            <button
                              className="h-10 px-5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-semibold text-sm transition-colors flex items-center disabled:opacity-50"
                              onClick={() => handleAction(sub)}
                              disabled={loadingAction === sub.id}
                            >
                              {loadingAction === sub.id ? (
                                <><Loader2 className="animate-spin mr-2" size={16} /> Cancelling...</>
                              ) : 'Cancel Plan'}
                            </button>
                          )}
                          {isInactive && (
                            <button
                              className="h-10 px-5 rounded-xl bg-black text-white hover:bg-gray-800 font-semibold text-sm transition-colors flex items-center disabled:opacity-50 shadow-sm"
                              onClick={() => handleAction(sub)}
                              disabled={loadingAction === sub.id}
                            >
                              {loadingAction === sub.id ? (
                                <><Loader2 className="animate-spin mr-2" size={16} /> Resubscribing...</>
                              ) : 'Resubscribe'}
                            </button>
                          )}
                        </div>
                        {!isInactive && sub.subscription_id_on_chain && (
                          <a
                            href={`https://stellar.expert/explorer/${import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? 'public' : 'testnet'}/tx/${sub.subscription_id_on_chain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold mt-1 flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                          >
                            Verify on Stellar Explorer <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}

              {/* Transaction History Timeline */}
              {!fetchError && filter === 'history' && (
                <div className="flex flex-col gap-6 relative pl-6 mt-4">
                  {/* Timeline vertical line */}
                  <div className="absolute left-[11px] top-4 bottom-0 w-[2px] bg-black/10 rounded-full"></div>
                  
                  {payments.map((payment, index) => {
                    const isSuccess = payment.status === 'success';
                    return (
                      <StaggerItem key={payment.id || index}>
                        <div className="relative pl-8">
                          {/* Timeline dot */}
                          <div className={`absolute left-[-21px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-[#F5F5F5] z-10 ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          
                          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:shadow-md transition-shadow">
                            <div>
                              <h4 className="font-bold text-black text-lg">{payment.plan_name}</h4>
                              <p className="text-sm font-medium text-black/50 mt-0.5">by {payment.merchant_name}</p>
                              <p className="text-xs font-semibold text-black/40 mt-3 uppercase tracking-wider">
                                {new Date(payment.executed_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1">
                              <div className="text-2xl font-bold text-black">
                                ${formatStellarAmount(payment.amount)}
                              </div>
                              <div className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${isSuccess ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {payment.status}
                              </div>
                              {payment.transaction_hash && (
                                <a
                                  href={`https://stellar.expert/explorer/${import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? 'public' : 'testnet'}/tx/${payment.transaction_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold flex items-center gap-1 mt-1 sm:mt-2 text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                                >
                                  View on Stellar <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </div>
              )}
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
