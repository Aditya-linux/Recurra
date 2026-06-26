import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem, HoverCard } from '../components/ui/animations';

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
    <PageWrapper>
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '80px' }}>
      <FadeIn className="card" style={{ width: '100%', maxWidth: '680px', padding: 0, overflow: 'hidden' }}>
        {/* Header with fractal gradient */}
        <div style={{
          background: 'var(--fractal-gradient)',
          backgroundSize: '200% 100%',
          animation: 'shimmerBtn 4s ease infinite',
          padding: '48px 32px',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em', color: '#ffffff' }}>Subscription Hub</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '8px', fontSize: '16px' }}>Manage all your premium subscriptions in one place.</p>
        </div>
        
        <div style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {!fullWalletAddress ? (
            <div style={{ textAlign: 'center' }}>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginBottom: '24px' }}>Please "log in" by connecting your wallet to view your account.</p>
              <HoverCard>
                <button 
                  onClick={openModal}
                  className="btn btn-primary"
                  style={{ padding: '14px 32px' }}
                >
                  Log In (Connect Wallet)
                </button>
              </HoverCard>
            </div>
          ) : isActive ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'rgba(6, 214, 160, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <svg style={{ width: '40px', height: '40px', color: 'var(--accent-cyan)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-h3" style={{ marginBottom: '8px' }}>Welcome Back!</h2>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginBottom: '24px' }}>Your Premium Subscription is active.</p>
              <HoverCard>
                <button className="btn btn-secondary">
                  Start Watching
                </button>
              </HoverCard>
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <h2 className="text-h3" style={{ marginBottom: '8px' }}>Available Subscriptions</h2>
                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>Subscribe with your Stellar wallet and pay in USDC.</p>
              </div>
              
              <StaggerContainer style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
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
                  <StaggerItem key={plan.id} className="card glass-shimmer" style={{ 
                    padding: '24px', position: 'relative', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}>
                    {index === 0 && <div style={{ 
                      position: 'absolute', top: 0, right: 0, 
                      background: 'var(--fractal-gradient)', backgroundSize: '200% 100%',
                      fontSize: '11px', fontWeight: 700, padding: '6px 14px', 
                      borderBottomLeftRadius: '12px', color: 'white',
                      letterSpacing: '0.05em',
                    }}>RECOMMENDED</div>}
                    <div>
                      <div style={{ 
                        width: '56px', height: '56px', borderRadius: '16px', 
                        overflow: 'hidden', marginBottom: '16px', 
                        background: 'var(--surface-container)', padding: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid var(--glass-border)',
                      }}>
                        <img src={`https://logo.clearbit.com/${hostname}`} alt={plan.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(plan.name)}&background=random&color=fff&size=150`; }} />
                      </div>
                      <h3 className="text-h3" style={{ fontSize: '20px', marginBottom: '8px' }}>{plan.name}</h3>
                      <p style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {(Number(plan.amount) / 10000000).toFixed(2)} <span className="text-body-md" style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}>USDC/mo</span>
                      </p>
                    </div>
                    
                    <HoverCard>
                      <button 
                        onClick={() => handleSubscribe(plan.id, plan.name)}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '20px', padding: '14px 24px', fontSize: '15px' }}
                      >
                        <svg style={{ width: '18px', height: '18px', marginRight: '8px', display: 'inline-block', verticalAlign: 'text-bottom' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Pay with Crypto
                      </button>
                    </HoverCard>
                  </StaggerItem>
                )})}
              </StaggerContainer>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
    </PageWrapper>
  );
};

export default DemoMerchant;
