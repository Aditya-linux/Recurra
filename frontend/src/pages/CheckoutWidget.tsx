import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import SubscriptionSuccessModal from '../components/SubscriptionSuccessModal';
import { PageWrapper, FadeIn, HoverCard } from '../components/ui/animations';

const CheckoutWidget: React.FC = () => {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('planId');
  const merchantName = searchParams.get('merchantName') || 'Merchant';
  
  const { fullWalletAddress, openModal, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [redirectInfo, setRedirectInfo] = useState<any>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  useEffect(() => {
    // Fetch plan details (public endpoint, no auth needed)
    if (planId) {
      api('/plans', { public: true })
        .then(({ ok, data }) => {
          if (ok && data) {
            const p = data.find((x: any) => x.id === planId);
            if (p) setPlan(p);
          }
        })
        .catch(() => toast.error('Failed to load plan details'));
    }
  }, [planId]);

  const handleCheckout = async () => {
    if (!fullWalletAddress) {
      openModal();
      return;
    }
    if (!plan) return;

    setLoading(true);
    const toastId = toast.loading('Waiting for wallet approval...');

    let txHash: string | null = null;

    // Step 1: Try on-chain transaction
    try {
      const { Contract, rpc, TransactionBuilder, Networks, TimeoutInfinite, nativeToScVal } = await import('@stellar/stellar-sdk');
      
      const rpcUrl = import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET'
        ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
        : 'https://soroban-testnet.stellar.org';
      const server = new rpc.Server(rpcUrl);
      const account = await server.getAccount(fullWalletAddress);
      
      const contractAddress = import.meta.env.VITE_CONTRACT_PAYMENT_ENGINE || 'CC5DLW4KX7NBDQKBS7F4N2QJEXECVSZMZTZ5WQ2FSFNUM3F7Z37J24XR';
      const contract = new Contract(contractAddress);
      const defaultTokenAddress = import.meta.env.VITE_USDC_TOKEN_ADDRESS || 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR';
      const tokenAddress = plan.token_address || defaultTokenAddress;
      
      const networkPassphrase = import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
      const tx = new TransactionBuilder(account, {
        fee: '1000',
        networkPassphrase
      })
      .addOperation(contract.call('create_subscription', 
        nativeToScVal(fullWalletAddress, { type: 'address' }), 
        nativeToScVal(plan.plan_id_on_chain || plan.id, { type: 'string' }),
        nativeToScVal(plan.merchant_address || 'GB3DJRW7V3NRNLLJU7D3YBEAFFRMXORVC55QRFXBG2E5PD4GPFNYS5BW', { type: 'address' }),
        nativeToScVal(tokenAddress, { type: 'address' }),
        nativeToScVal(plan.amount || 10000000, { type: 'i128' }),
        nativeToScVal(plan.interval_seconds || 2592000, { type: 'u64' }),
        nativeToScVal(plan.max_payments || 0, { type: 'u32' })
      ))
      .setTimeout(TimeoutInfinite)
      .build();

      const preparedTx = await server.prepareTransaction(tx);
      const signedXdr = await signTransaction(preparedTx.toXDR());
      
      toast.loading('Submitting transaction...', { id: toastId });
      const sendRes = await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, networkPassphrase));
      txHash = sendRes.hash;
      setTransactionHash(txHash);
    } catch (contractErr: any) {
      const errMsg = contractErr?.message || String(contractErr);
      
      if (errMsg.includes('User declined') || errMsg.includes('cancelled') || errMsg.includes('rejected')) {
        toast.error('Transaction cancelled.', { id: toastId });
        setLoading(false);
        return;
      } else {
        toast.error('Payment failed: ' + (errMsg.length > 150 ? errMsg.substring(0, 150) + '...' : errMsg), { id: toastId });
        setLoading(false);
        return;
      }
    }

    try {
      // If phone number is provided, update profile first
      if (phoneNumber) {
        await api('/user/profile', {
          method: 'PUT',
          body: JSON.stringify({ phoneNumber })
        });
      }

      const { ok, data, error } = await api('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ 
          planId: plan.id,
          subscriptionIdOnChain: txHash
        })
      });

      if (ok) {
        toast.success('Payment Successful!', { id: toastId });
        // Show success modal with redirect info from backend
        setRedirectInfo(data?.redirect || null);
        setShowSuccessModal(true);
      } else {
        throw new Error(error || 'Subscription failed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Payment failed: ' + (err.message || ''), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!planId) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>Invalid checkout link</div>;

  return (
    <PageWrapper>
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <FadeIn className="card" style={{ maxWidth: '440px', width: '100%', padding: 0, overflow: 'hidden' }}>
        {/* Header with fractal gradient */}
        <div style={{
          background: 'var(--fractal-gradient)',
          backgroundSize: '200% 100%',
          animation: 'shimmerBtn 4s ease infinite',
          padding: '32px 24px',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>Rekura Checkout</h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', marginTop: '4px' }}>Secure crypto payments</p>
        </div>
        
        <div style={{ padding: '28px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <span className="text-body-md" style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>Merchant</span>
            <span className="text-body-md" style={{ fontWeight: 700, color: 'var(--on-surface)' }}>{merchantName}</span>
          </div>
          
          {plan ? (
            <div className="panel" style={{ padding: '20px', marginBottom: '24px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--on-surface)' }}>{plan.name}</span>
                <span style={{ fontWeight: 700, fontSize: '20px', color: 'var(--on-surface)' }}>
                  ${plan.amount} <span className="text-body-sm" style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}>USDC</span>
                </span>
              </div>
              <p className="text-body-sm" style={{ color: 'var(--on-surface-variant)' }}>
                Billed every month. Cancel anytime.
                {plan.trial_days > 0 && <span style={{ color: '#10b981', display: 'block', marginTop: '4px', fontWeight: 600 }}>Includes {plan.trial_days}-day free trial</span>}
              </p>
            </div>
          ) : (
            <div style={{ height: '96px', borderRadius: '16px', marginBottom: '24px', background: 'var(--surface-container)', animation: 'pulse 2s infinite' }}></div>
          )}

          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
            {!fullWalletAddress ? (
              <HoverCard>
                <button 
                  onClick={openModal}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px 24px' }}
                >
                  Connect Wallet to Pay
                </button>
              </HoverCard>
            ) : (
              <div>
                <p className="text-body-sm" style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginBottom: '16px' }}>
                  Connected as: <span style={{ fontFamily: 'monospace', color: 'var(--on-surface)' }}>{fullWalletAddress.substring(0,6)}...{fullWalletAddress.substring(52)}</span>
                </p>

                <div style={{ marginBottom: '12px' }}>
                  <label className="text-body-sm" style={{ fontWeight: 600, color: 'var(--on-surface)' }}>Discount Code (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="ENTER CODE" 
                    style={{ 
                      width: '100%', 
                      marginTop: '4px',
                      background: 'var(--surface-container-high)', 
                      border: '1px solid var(--outline-variant)', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      color: 'var(--on-surface)', 
                      outline: 'none',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="text-body-sm" style={{ fontWeight: 600, color: 'var(--on-surface)' }}>WhatsApp Number for Receipts (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="+1 (555) 000-0000" 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    style={{ 
                      width: '100%', 
                      marginTop: '4px',
                      background: 'var(--surface-container-high)', 
                      border: '1px solid var(--outline-variant)', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      color: 'var(--on-surface)', 
                      outline: 'none' 
                    }}
                  />
                </div>

                <HoverCard>
                  <button 
                    onClick={handleCheckout}
                    disabled={loading || !plan}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px 24px', opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? (
                      <svg style={{ animation: 'spin 1s linear infinite', width: '20px', height: '20px', color: 'white' }} fill="none" viewBox="0 0 24 24">
                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      'Confirm Subscription'
                    )}
                  </button>
                </HoverCard>
              </div>
            )}
          </div>
          
          <p className="text-body-sm" style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '24px', fontSize: '12px', opacity: 0.7 }}>
            By confirming, you agree to the smart contract terms. Powered by Stellar.
          </p>
        </div>
      </FadeIn>
    </div>

    {/* Success Modal with auto-redirect */}
    <SubscriptionSuccessModal
      isOpen={showSuccessModal}
      onClose={() => setShowSuccessModal(false)}
      planName={plan?.name || ''}
      amount={`$${plan?.amount || '0'} USDC`}
      redirect={redirectInfo}
      autoRedirectSeconds={5}
      txHash={transactionHash}
    />
    </PageWrapper>
  );
};

export default CheckoutWidget;
