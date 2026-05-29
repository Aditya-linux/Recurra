import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const DemoMerchant: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [isActive, setIsActive] = useState(false);
  const navigate = useNavigate();
  const { fullWalletAddress, openModal } = useWallet();

  // Mock checking the status from the merchant's backend
  const checkStatus = async () => {
    if (!fullWalletAddress) return;
    try {
      const { ok, data } = await api(`/demo-merchant/status/${fullWalletAddress}`, { public: true });
      if (ok && data) {
        if (data.isActive && !isActive) {
          setIsActive(true);
          toast.success('Webhook received! Account activated.');
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    // Fetch available plans (just grabbing the first one for the demo)
    api('/plans', { public: true })
      .then(({ ok, data }) => {
        if (ok && data && data.length > 0) setPlans(data);
      })
      .catch(() => {});

    // Poll status every 2 seconds to detect webhook
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [fullWalletAddress, isActive]);

  const handleSubscribe = () => {
    if (!fullWalletAddress) {
      openModal();
      return;
    }
    if (plans.length === 0) {
      toast.error('No plans available');
      return;
    }
    
    // Redirect to Recurra Checkout
    const planId = plans[0].id;
    navigate(`/checkout?planId=${planId}&merchantName=Acme Streaming`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center pt-20">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
        <div className="bg-gradient-to-r from-red-600 to-red-800 p-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">Acme Streaming</h1>
          <p className="text-red-200 mt-2">Unlimited movies, TV shows, and more.</p>
        </div>
        
        <div className="p-8 flex flex-col items-center">
          {!fullWalletAddress ? (
            <div className="text-center">
              <p className="text-gray-400 mb-6">Please "log in" by connecting your wallet to view your account.</p>
              <button 
                onClick={openModal}
                className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-full font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)]"
              >
                Log In (Connect Wallet)
              </button>
            </div>
          ) : isActive ? (
            <div className="text-center animate-fade-in">
              <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome Back!</h2>
              <p className="text-gray-400 mb-6">Your Premium Subscription is active.</p>
              <button className="bg-gray-700 hover:bg-gray-600 px-8 py-3 rounded-xl font-medium transition-colors">
                Start Watching
              </button>
            </div>
          ) : (
            <div className="w-full">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Choose your plan</h2>
                <p className="text-gray-400">Cancel anytime.</p>
              </div>
              
              <div className="border border-red-500 rounded-xl p-6 relative overflow-hidden bg-gray-900/50">
                <div className="absolute top-0 right-0 bg-red-600 text-xs font-bold px-3 py-1 rounded-bl-lg">RECOMMENDED</div>
                <h3 className="text-xl font-bold mb-2">Premium 4K</h3>
                <p className="text-3xl font-extrabold mb-1">10 <span className="text-lg text-gray-400 font-normal">USDC/mo</span></p>
                <ul className="text-sm text-gray-400 space-y-3 mt-6 mb-8">
                  <li className="flex items-center"><span className="text-red-500 mr-2"></span> Watch on 4 supported devices at a time</li>
                  <li className="flex items-center"><span className="text-red-500 mr-2"></span> Unlimited ad-free movies, TV shows</li>
                  <li className="flex items-center"><span className="text-red-500 mr-2"></span> Download on 6 supported devices</li>
                </ul>
                
                <button 
                  onClick={handleSubscribe}
                  className="w-full bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] flex justify-center items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Pay with Crypto via Recurra
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoMerchant;
