import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import SubscriptionSuccessModal from '../components/SubscriptionSuccessModal';

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
      
      const server = new rpc.Server('https://soroban-testnet.stellar.org');
      const account = await server.getAccount(fullWalletAddress);
      
      const contract = new Contract('CBOMKCJGCFEYJTTOKQX53NSA6OF66WIFYC4WVKJIF7GWSTVV6JI265AP');
      const tokenAddress = plan.token_address || 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR';
      
      const tx = new TransactionBuilder(account, {
        fee: '1000',
        networkPassphrase: Networks.TESTNET
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
      const sendRes = await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET));
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

  if (!planId) return <div className="p-10 text-center">Invalid checkout link</div>;

  return (
    <>
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white text-center">
          <h1 className="text-2xl font-bold">Recurra Checkout</h1>
          <p className="text-blue-200 text-sm mt-1">Secure crypto payments</p>
        </div>
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-500 font-medium">Merchant</span>
            <span className="font-bold text-gray-900">{merchantName}</span>
          </div>
          
          {plan ? (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg">{plan.name}</span>
                <span className="font-bold text-xl">${plan.amount} <span className="text-sm text-gray-500 font-normal">USDC</span></span>
              </div>
              <p className="text-sm text-gray-500">Billed every month. Cancel anytime.</p>
            </div>
          ) : (
            <div className="animate-pulse bg-gray-200 h-24 rounded-xl mb-6"></div>
          )}

          <div className="border-t border-gray-200 pt-6">
            {!fullWalletAddress ? (
              <button 
                onClick={openModal}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 px-4 rounded-xl font-bold transition-colors"
              >
                Connect Wallet to Pay
              </button>
            ) : (
              <div>
                <p className="text-sm text-gray-500 text-center mb-4">
                  Connected as: <span className="font-mono text-gray-900">{fullWalletAddress.substring(0,6)}...{fullWalletAddress.substring(52)}</span>
                </p>
                <button 
                  onClick={handleCheckout}
                  disabled={loading || !plan}
                  className={`w-full ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white py-3 px-4 rounded-xl font-bold transition-colors flex justify-center items-center gap-2`}
                >
                  {loading ? (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    'Confirm Subscription'
                  )}
                </button>
              </div>
            )}
          </div>
          
          <p className="text-xs text-gray-400 text-center mt-6">
            By confirming, you agree to the smart contract terms. Powered by Stellar.
          </p>
        </div>
      </div>
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
    </>
  );
};

export default CheckoutWidget;
