import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { api, getValidToken } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import SubscriptionSuccessModal from '../components/SubscriptionSuccessModal';

const SubscriptionCenter: React.FC = () => {
  const { fullWalletAddress, openModal, signTransaction } = useWallet();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'active' | 'inactive' | 'available'>('available');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubscribedPlan, setLastSubscribedPlan] = useState<{ name: string; amount: string; redirect: any; txHash?: string | null } | null>(null);
  const socket = useSocket();

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
      setFetchError('Failed to connect to Recurra Backend.');
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
    setSuccessMsg('');

    let txHash: string | null = null;

    // Step 1: On-chain transaction via Soroban
    try {
      setSuccessMsg('Preparing smart contract transaction...');
      const { Contract, rpc, TransactionBuilder, Networks, nativeToScVal, Transaction } = await import('@stellar/stellar-sdk');
      
      const rpcUrl = import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' 
        ? 'https://soroban-mainnet.stellar.org'
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

      setSuccessMsg('Preparing smart contract transaction (footprint)...');
      const preparedTx = await server.prepareTransaction(tx);

      // Sign transaction
      setSuccessMsg('Please sign the transaction in Freighter...');
      const signedXdr = await signTransaction(preparedTx.toXDR());
      const signedTx = new Transaction(signedXdr, import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET);

      // Submit transaction
      setSuccessMsg('Submitting transaction to network...');
      const txResponse = await server.sendTransaction(signedTx);
      
      if (txResponse.status === 'PENDING') {
        txHash = txResponse.hash;
        
        // Wait for network confirmation
        setSuccessMsg('Waiting for network confirmation...');
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
        throw new Error('Transaction submission failed: ' + (txResponse as any).errorResultXdr);
      }
    } catch (err: any) {
      console.error("Full on-chain error:", err);
      let msg = err.message || String(err);
      if (err.response && err.response.data) {
        msg += " - " + JSON.stringify(err.response.data);
      }
      setSuccessMsg('On-chain error: ' + msg);
      setLoadingAction(null);
      return;
    }

    // Step 2: Register subscription in backend
    try {
      setSuccessMsg('Registering subscription on backend...');
      const { ok, data, error } = await api('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ 
          planId: plan.id,
          subscriptionIdOnChain: txHash
        })
      });

      if (ok) {
        const planName = plan.plan_name || plan.name;
        const amountStr = `$${(Number(plan.amount) / 10000000).toFixed(2)} / mo`;
        setSuccessMsg(`Successfully subscribed to ${planName}!`);
        await fetchSubscriptions();

        // Show the success modal with redirect info from backend
        setLastSubscribedPlan({
          name: planName,
          amount: amountStr,
          redirect: data?.redirect || null,
          txHash: txHash
        });
        setShowSuccessModal(true);
      } else {
        setSuccessMsg(`Backend Error: ${error || 'Subscription failed'}`);
      }
    } catch (err: any) {
      console.error(err);
      setSuccessMsg('Subscription failed. ' + (err.message || ''));
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
        setSuccessMsg(isCanceling ? `${sub.name} cancelled.` : `${sub.name} reactivated!`);
        await fetchSubscriptions();
        setTimeout(() => setSuccessMsg(''), 2000);
      }
    } catch (err: any) {
      console.error(err);
      setSuccessMsg('Action failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  // Merchant color/logo mapping
  const merchantStyles: Record<string, { color: string; logo: string }> = {
    'Spotify': { color: '#1DB954', logo: 'https://cdn.simpleicons.org/spotify/white' },
    'Claude': { color: '#D4A574', logo: 'https://cdn.simpleicons.org/anthropic/white' },
    'Netflix': { color: '#E50914', logo: 'https://cdn.simpleicons.org/netflix/white' },
    'Amazon': { color: '#FF9900', logo: 'https://cdn.simpleicons.org/amazon/white' },
  };

  const filtered = filter === 'available' ? availablePlans : subscriptions.filter(s => s.status === filter);
  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const inactiveCount = subscriptions.filter(s => s.status === 'inactive').length;

  return (
    <>
    <main className="pt-nav" style={{ paddingBottom: '64px' }}>
      <section className="container" style={{ marginTop: '40px' }}>
        <h2 className="text-h2">Subscription Center & Retail Store</h2>
        <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', marginTop: '8px', marginBottom: '40px' }}>
          Manage your active recurring payments and explore retail subscriptions powered by Recurra.
        </p>

        {/* Success / Error toast */}
        {successMsg && (
          <div style={{
            padding: '12px 20px',
            marginBottom: '20px',
            borderRadius: '12px',
            background: successMsg.startsWith('Error') ? 'rgba(255,80,80,0.15)' : 'rgba(29,185,84,0.15)',
            color: successMsg.startsWith('Error') ? '#ff6b6b' : '#1DB954',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {successMsg.startsWith('Error') ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            {successMsg}
          </div>
        )}

        <div className="grid-12">
          {/* Subscriptions List */}
          <div className="flex flex-col gap-6" style={{ gridColumn: 'span 12' }}>
            <div className="flex gap-4 sm-flex-col sm-w-full">
              <Button
                variant={filter === 'available' ? 'outline' : 'ghost'}
                onClick={() => setFilter('available')}
              >
                Retail Storefront ({availablePlans.length})
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
            </div>

            <div id="subscriptions-container" className="flex flex-col gap-4">
              {fetchError && <p className="text-body-lg" style={{ color: 'var(--error)', textAlign: 'center', padding: '40px' }}>{fetchError}</p>}
              {!fetchError && filtered.length === 0 && (
                <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', textAlign: 'center', padding: '40px' }}>
                  {filter === 'available' ? 'No retail plans available right now.' : filter === 'active' ? 'No active subscriptions yet. Browse the Retail Storefront to subscribe!' : 'No inactive subscriptions.'}
                </p>
              )}

              {/* Available Plans */}
              {!fetchError && filter === 'available' && availablePlans.map(plan => {
                const baseName = plan.plan_name?.replace(' Premium', '').replace(' Standard', '').replace(' Pro', '') || '';
                const style = merchantStyles[baseName] || { color: '#3B82F6', logo: '' };
                const alreadySubscribed = subscriptions.some(s => s.name === plan.plan_name && s.status === 'active');
                return (
                  <Card key={plan.id} style={{ transition: 'transform 0.2s', border: '1px solid var(--outline-variant)' }}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div style={{
                            width: '52px', height: '52px', borderRadius: '14px',
                            background: style.color, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', padding: '12px'
                          }}>
                            {style.logo ? <img src={style.logo} alt={baseName} style={{ width: '28px', height: '28px' }} /> : <span style={{color:'white', fontWeight:600}}>{baseName.charAt(0)}</span>}
                          </div>
                          <div>
                            <h3 className="text-h3" style={{ fontSize: '20px' }}>{plan.plan_name}</h3>
                            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                              by {plan.merchant_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 sm-items-start sm-mt-4 sm-w-full">
                          <div className="text-h3" style={{ fontSize: '22px', fontWeight: 700 }}>
                            ${(plan.amount / 10000000).toFixed(2)} <span className="text-body-md" style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}>/ mo</span>
                          </div>
                          {alreadySubscribed ? (
                            <span style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(29,185,84,0.15)', color: '#1DB954' }}>
                               Subscribed
                            </span>
                          ) : (
                            <Button
                              className="sm-w-full"
                              onClick={() => handleSubscribe(plan)}
                              disabled={loadingAction === plan.id}
                              style={{ minWidth: '120px' }}
                            >
                              {loadingAction === plan.id ? (
                                <><Loader2 className="animate-spin mr-2" size={16} /> Subscribing...</>
                              ) : 'Subscribe'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Active / Inactive Subscriptions */}
              {!fetchError && filter !== 'available' && filtered.map(sub => {
                const isInactive = sub.status === 'inactive';
                const subBaseName = sub.name?.replace(' Premium', '').replace(' Standard', '').replace(' Pro', '') || '';
                const style = merchantStyles[subBaseName] || merchantStyles[sub.name] || { color: '#3B82F6', logo: '' };

                return <Card key={sub.id} style={{ transition: 'transform 0.2s', border: '1px solid var(--outline-variant)', opacity: isInactive ? 0.6 : 1 }}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div style={{
                            width: '52px', height: '52px', borderRadius: '14px',
                            background: isInactive ? 'var(--surface-container-high)' : style.color, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', padding: '12px'
                          }}>
                            {style.logo ? <img src={style.logo} alt={sub.name} style={{ width: '28px', height: '28px', filter: isInactive ? 'grayscale(100%)' : 'none' }} /> : <span style={{color:'white', fontWeight:600}}>{(sub.name || '?').charAt(0)}</span>}
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
                              <Button
                                variant="outline"
                                className="sm-w-full"
                                onClick={() => window.open(sub.redirect.url, '_blank', 'noopener,noreferrer')}
                                style={{ minWidth: '120px', gap: '6px' }}
                              >
                                <ExternalLink size={14} />
                                {sub.redirect.label || `Open ${sub.redirect.platformName || 'Platform'}`}
                              </Button>
                            )}
                            {!isInactive && (
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
                            )}
                          </div>
                          {!isInactive && sub.subscription_id_on_chain && (
                            <a
                              href={`https://stellar.expert/explorer/testnet/tx/${sub.subscription_id_on_chain}`}
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
                  </Card>;
              })}
            </div>
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
        setSuccessMsg('');
      }}
      planName={lastSubscribedPlan?.name || ''}
      amount={lastSubscribedPlan?.amount || ''}
      redirect={lastSubscribedPlan?.redirect || null}
      txHash={lastSubscribedPlan?.txHash || null}
    />
    </>
  );
};

export default SubscriptionCenter;
