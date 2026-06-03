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

  const handleSubscribe = (planId: string, merchantName: string) => {
    if (!fullWalletAddress) {
      openModal();
      return;
    }
    
    // Redirect to Rekura Checkout
    navigate(`/checkout?planId=${planId}&merchantName=${encodeURIComponent(merchantName)}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center pt-20">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
        <div className="bg-gradient-to-r from-blue-600 to-purple-800 p-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'sans-serif' }}>Subscription Hub</h1>
          <p className="text-blue-200 mt-2">Manage all your premium subscriptions in one place.</p>
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
                <h2 className="text-2xl font-bold mb-2">Available Subscriptions</h2>
                <p className="text-gray-400">Subscribe with your Stellar wallet and pay in USDC.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {plans.map((plan, index) => {
                  let hostname = 'netflix.com';
                  if (plan.redirect_url) {
                    try {
                      hostname = new URL(plan.redirect_url).hostname;
                    } catch(e){}
                  } else {
                    if (plan.name.toLowerCase().includes('amazon')) hostname = 'amazon.com';
                    if (plan.name.toLowerCase().includes('spotify')) hostname = 'spotify.com';
                    if (plan.name.toLowerCase().includes('jiocinema')) hostname = 'jiocinema.com';
                  }
                  
                  return (
                  <div key={plan.id} className="border border-gray-700 rounded-xl p-6 relative overflow-hidden bg-gray-900/50 hover:border-blue-500 transition-colors flex flex-col justify-between">
                    {index === 0 && <div className="absolute top-0 right-0 bg-blue-600 text-xs font-bold px-3 py-1 rounded-bl-lg">RECOMMENDED</div>}
                    <div>
                      <div className="w-14 h-14 rounded-2xl overflow-hidden mb-4 bg-white p-2 flex items-center justify-center">
                        <img src={`https://logo.clearbit.com/${hostname}`} alt={plan.name} className="w-full h-full object-contain rounded-lg" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(plan.name)}&background=random&color=fff&size=150`; }} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                      <p className="text-3xl font-extrabold mb-4">{(Number(plan.amount) / 10000000).toFixed(2)} <span className="text-sm text-gray-400 font-normal">USDC/mo</span></p>
                    </div>
                    
                    <button 
                      onClick={() => handleSubscribe(plan.id, plan.name)}
                      className="w-full bg-white hover:bg-gray-200 text-black px-6 py-3 rounded-xl font-bold transition-all shadow-md flex justify-center items-center gap-2 mt-4"
                    >
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Pay with Crypto
                    </button>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoMerchant;
