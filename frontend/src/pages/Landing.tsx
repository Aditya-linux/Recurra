import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Blocks, Wallet, Activity, Zap, Repeat, CheckCircle } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { trackEvent } from '../utils/analytics';
import { PageWrapper, FadeIn, HoverCard } from '../components/ui/animations';
import { FeeCalculator } from '../components/FeeCalculator';
import BorderGlow from '../components/ui/BorderGlow';

const Landing: React.FC = () => {
  const { walletAddress, openModal } = useWallet();
  const navigate = useNavigate();
  const [intent, setIntent] = useState<'merchant' | 'user' | null>(null);

  useEffect(() => {
    if (walletAddress && intent) {
      navigate(intent === 'merchant' ? '/merchant' : '/subscriptions');
      setIntent(null);
    }
  }, [walletAddress, intent, navigate]);

  const handleAction = (type: 'merchant' | 'user') => {
    trackEvent('landing_cta_click', { type });
    localStorage.setItem('recurra_intent', type);
    
    // Trigger the feedback modal once per session
    if (!sessionStorage.getItem('feedback_shown')) {
      window.dispatchEvent(new Event('open-feedback'));
      sessionStorage.setItem('feedback_shown', 'true');
    }

    if (walletAddress) {
      navigate(type === 'merchant' ? '/merchant' : '/subscriptions');
    } else {
      setIntent(type);
      openModal();
    }
  };

  return (
    <PageWrapper>
      <main>
        {/* ─── Hero Section ─── */}
      <section className="landing-hero">
        {/* Fractal background orbs */}
        <div className="fractal-orb fractal-orb-1" />
        <div className="fractal-orb fractal-orb-2" />
        <div className="fractal-orb fractal-orb-3" />

        <div className="container flex flex-col items-center gap-8" style={{ position: 'relative', zIndex: 1 }}>
          <FadeIn delay={0.1}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <svg width="48" height="41" viewBox="0 0 236.36 200" xmlns="http://www.w3.org/2000/svg" style={{ fill: 'var(--on-surface)' }}>
                <path d="M203,26.16l-28.46,14.5-137.43,70a82.49,82.49,0,0,1-.7-10.69A81.87,81.87,0,0,1,158.2,28.6l16.29-8.3,2.43-1.24A100,100,0,0,0,18.18,100q0,3.82.29,7.61a18.19,18.19,0,0,1-9.88,17.58L0,129.57V150l25.29-12.89,0,0,8.19-4.18,8.07-4.11v0L186.43,55l16.28-8.29,33.65-17.15V9.14Z"/>
                <path d="M236.36,50,49.78,145,33.5,153.31,0,170.38v20.41l33.27-16.95,28.46-14.5L199.3,89.24A83.45,83.45,0,0,1,200,100,81.87,81.87,0,0,1,78.09,171.36l-1,.53-17.66,9A100,100,0,0,0,218.18,100c0-2.57-.1-5.14-.29-7.68a18.2,18.2,0,0,1,9.87-17.58l8.6-4.38Z"/>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface-variant)', letterSpacing: '1px', textTransform: 'uppercase' }}>Powered by Stellar</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="hero-heading">
              <h1 className="text-display">
                The Future of{' '}
                <span className="text-prismatic">Recurring Payments</span>
              </h1>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="text-body-lg hero-sub" style={{ maxWidth: '720px' }}>
              The Ultimate Web3 Subscription Layer for Global Creators & SaaS. 
              Bypass massive 4-5% forex spreads and receive international payments instantly in USDC. 
              Built on the Stellar network with native UPI on/off-ramps, giving you full control of your revenue globally.
            </p>
          </FadeIn>

          <FadeIn delay={0.4}>
            <div className="hero-cta-group">
              <HoverCard>
                <button onClick={() => handleAction('merchant')} className="btn btn-accent" id="cta-start-building">
                  Start Selling
                  <ArrowRight size={20} strokeWidth={2.5} />
                </button>
              </HoverCard>
              <HoverCard>
                <button onClick={() => handleAction('user')} className="btn btn-secondary" id="cta-explore">
                  Start Subscribing
                </button>
              </HoverCard>
            </div>
          </FadeIn>
        </div>

        {/* Informative Calculator Widget */}
        <FadeIn delay={0.5} style={{ marginTop: '64px', zIndex: 1, position: 'relative' }}>
          <div className="container" style={{ maxWidth: '800px' }}>
            <BorderGlow
              edgeSensitivity={30}
              glowColor="160 80 80"
              backgroundColor="var(--surface-container, #120F17)"
              borderRadius={28}
              glowRadius={40}
              glowIntensity={1.0}
              coneSpread={25}
              animated={true}
              colors={['#06d6a0', '#118ab2', '#8338ec']}
            >
              <FeeCalculator />
            </BorderGlow>
          </div>
        </FadeIn>
      </section>

      {/* ─── How It Stacks Up Section ─── */}
      <section className="container landing-section-gap" style={{ marginTop: '80px' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 className="text-display" style={{ fontSize: '48px', marginBottom: '16px' }}>How It Stacks Up</h2>
            <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '600px', margin: '0 auto' }}>
              See how Recurra compares to legacy payment processors.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.2}>
          <BorderGlow borderRadius={20} glowColor="160 80 80" colors={['#06d6a0', '#118ab2', '#8338ec']} backgroundColor="var(--surface-container)">
            <div className="comparison-table-wrapper" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '20px 24px', fontSize: '14px', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '1px' }}>Feature</th>
                    <th style={{ padding: '20px 24px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                      <span style={{ background: 'linear-gradient(135deg, #06d6a0, #118ab2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Recurra</span>
                    </th>
                    <th style={{ padding: '20px 24px', fontSize: '14px', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '1px' }}>Stripe</th>
                    <th style={{ padding: '20px 24px', fontSize: '14px', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '1px' }}>PayPal</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Transaction Fee', recurra: '~$0.01', stripe: '2.9% + $0.30', paypal: '3.49% + $0.49', highlight: true },
                    { feature: 'Forex / Conversion', recurra: '0% (USDC)', stripe: '2-4% spread', paypal: '3-5% spread', highlight: true },
                    { feature: 'Indian Fiat On/Off-Ramp', recurra: 'Instant (UPI)', stripe: 'N/A', paypal: 'Bank Transfer (3-5 days)', highlight: true },
                    { feature: 'Settlement Time', recurra: '<5 seconds', stripe: '2-7 days', paypal: '1-3 days', highlight: true },
                    { feature: 'Chargebacks', recurra: 'Impossible', stripe: 'Common risk', paypal: 'Common risk', highlight: true },
                    { feature: 'Self-Custody', recurra: '✓ Always', stripe: '✗ Custodial', paypal: '✗ Custodial', highlight: true },
                    { feature: 'Global Reach', recurra: 'Borderless', stripe: '46 countries', paypal: '200+ (restricted)', highlight: false },
                    { feature: 'KYC Required', recurra: 'None', stripe: 'Full KYC', paypal: 'Full KYC', highlight: false },
                    { feature: 'Open Source', recurra: '✓ Fully', stripe: '✗ Proprietary', paypal: '✗ Proprietary', highlight: true },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 500, color: 'var(--on-surface)', fontSize: '15px' }}>{row.feature}</td>
                      <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: '15px', color: row.highlight ? 'var(--accent-cyan)' : 'var(--on-surface)' }}>{row.recurra}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--on-surface-variant)', fontSize: '15px' }}>{row.stripe}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--on-surface-variant)', fontSize: '15px' }}>{row.paypal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BorderGlow>
        </FadeIn>
      </section>

      {/* ─── How it Works Section ─── */}
      <section className="container landing-section-gap-lg" style={{ marginTop: '140px' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 className="text-display" style={{ fontSize: '48px', marginBottom: '16px' }}>How Rekura Works</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '600px', margin: '0 auto' }}>
            A radically transparent approach to recurring payments. We replace complex legacy banking rails with elegant, verifiable smart contracts.
          </p>
        </div>
        
        <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          {/* Vertical connecting line */}
          <div className="how-it-works-line" style={{ position: 'absolute', left: '48px', top: '0', bottom: '0', width: '2px', background: 'var(--outline-variant)', zIndex: 0 }} />

          {/* Step 1 */}
          <motion.div 
            initial={{ opacity: 0.3, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, margin: "-20%" }}
            transition={{ duration: 0.5 }}
            className="how-it-works-step"
            style={{ display: 'flex', gap: '32px', position: 'relative', zIndex: 1, marginBottom: '64px' }}
          >
            <div className="how-it-works-icon" style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--surface-bright)', border: '2px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-lg)' }}>
              <Zap size={40} color="var(--accent-cyan)" />
            </div>
            <div style={{ paddingTop: '16px' }}>
              <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '14px' }}>Step 1</div>
              <h3 className="text-h3" style={{ fontSize: '32px', marginBottom: '16px' }}>Connect & Authorize</h3>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', lineHeight: '1.7', fontSize: '18px' }}>
                Merchants define their subscription plans (price, interval, currency). Users connect their preferred Stellar wallet and sign a single cryptographic transaction to authorize the recurring allowance. No credit cards, no sensitive data shared.
              </p>
            </div>
          </motion.div>
          
          {/* Step 2 */}
          <motion.div 
            initial={{ opacity: 0.3, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, margin: "-20%" }}
            transition={{ duration: 0.5 }}
            className="how-it-works-step"
            style={{ display: 'flex', gap: '32px', position: 'relative', zIndex: 1, marginBottom: '64px' }}
          >
            <div className="how-it-works-icon" style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--surface-bright)', border: '2px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-lg)' }}>
              <Repeat size={40} color="var(--accent-violet)" />
            </div>
            <div style={{ paddingTop: '16px' }}>
              <div style={{ color: 'var(--accent-violet)', fontWeight: 600, marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '14px' }}>Step 2</div>
              <h3 className="text-h3" style={{ fontSize: '32px', marginBottom: '16px' }}>Automated Cycles</h3>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', lineHeight: '1.7', fontSize: '18px' }}>
                When a billing cycle is due, Rekura's decentralized keeper network triggers the smart contract. The contract strictly verifies the allowance, timestamp, and amount before executing the transfer directly on the Stellar ledger.
              </p>
            </div>
          </motion.div>
          
          {/* Step 3 */}
          <motion.div 
            initial={{ opacity: 0.3, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, margin: "-20%" }}
            transition={{ duration: 0.5 }}
            className="how-it-works-step"
            style={{ display: 'flex', gap: '32px', position: 'relative', zIndex: 1 }}
          >
            <div className="how-it-works-icon" style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--surface-bright)', border: '2px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-lg)' }}>
              <CheckCircle size={40} color="var(--accent-blue)" />
            </div>
            <div style={{ paddingTop: '16px' }}>
              <div style={{ color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '14px' }}>Step 3</div>
              <h3 className="text-h3" style={{ fontSize: '32px', marginBottom: '16px' }}>Instant Settlement</h3>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', lineHeight: '1.7', fontSize: '18px' }}>
                Funds settle in the merchant's wallet in less than 2 seconds with negligible fees. Webhooks instantly notify the merchant's backend to grant the user access, creating a flawless, trustless loop.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Ecosystem & Partners Section ─── */}
      <section className="container landing-section-gap-lg" style={{ marginTop: '140px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 className="text-display" style={{ fontSize: '40px', marginBottom: '16px' }}>Ecosystem & Partners</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '600px', margin: '0 auto' }}>
            Powered by the robust infrastructure of the Stellar network and growing through community partnerships.
          </p>
        </div>
        <div style={{ overflow: 'hidden', position: 'relative', width: '100vw', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw', padding: '20px 0' }}>
          {/* Gradient masks for smooth fade in/out at edges */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '150px', background: 'linear-gradient(to right, var(--background), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '150px', background: 'linear-gradient(to left, var(--background), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          
          <div className="animate-marquee" style={{ gap: '48px', paddingLeft: '48px' }}>
            {/* We duplicate the array to create a seamless infinite loop */}
            {[
              { name: 'Stellar', logo: '/logos/ecosystem/stellar.png', fallback: <Activity size={28} /> },
              { name: 'Soroban', logo: '/logos/ecosystem/soroban.png', fallback: <Blocks size={28} /> },
              { name: 'Onramp', logo: '/logos/ecosystem/onramp.png', fallback: <Wallet size={28} /> },
              { name: 'Mudrex', logo: '/logos/ecosystem/mudrex.png', fallback: <Wallet size={28} /> },
              { name: 'Freighter', logo: '/logos/ecosystem/freighter.png', fallback: <Wallet size={28} /> },
              { name: 'xBull', logo: '/logos/ecosystem/xbull.png', fallback: <Wallet size={28} /> },
              { name: 'Albedo', logo: '/logos/ecosystem/albedo.png', fallback: <Wallet size={28} /> },
              { name: 'Lobstr', logo: '/logos/ecosystem/lobstr.png', fallback: <Wallet size={28} /> },
              { name: 'USDC', logo: '/logos/ecosystem/usdc.png', fallback: <CheckCircle size={28} /> },
              { name: 'MoonPay', logo: '/logos/ecosystem/moonpay.png', fallback: <Zap size={28} /> },
              { name: 'Transak', logo: '/logos/ecosystem/transak.png', fallback: <Zap size={28} /> },
              { name: 'SendGrid', logo: '/logos/ecosystem/sendgrid.png', fallback: <Activity size={28} /> },
              // Duplicated set below for infinite loop
              { name: 'Stellar ', logo: '/logos/ecosystem/stellar.png', fallback: <Activity size={28} /> },
              { name: 'Soroban ', logo: '/logos/ecosystem/soroban.png', fallback: <Blocks size={28} /> },
              { name: 'Onramp ', logo: '/logos/ecosystem/onramp.png', fallback: <Wallet size={28} /> },
              { name: 'Mudrex ', logo: '/logos/ecosystem/mudrex.png', fallback: <Wallet size={28} /> },
              { name: 'Freighter ', logo: '/logos/ecosystem/freighter.png', fallback: <Wallet size={28} /> },
              { name: 'xBull ', logo: '/logos/ecosystem/xbull.png', fallback: <Wallet size={28} /> },
              { name: 'Albedo ', logo: '/logos/ecosystem/albedo.png', fallback: <Wallet size={28} /> },
              { name: 'Lobstr ', logo: '/logos/ecosystem/lobstr.png', fallback: <Wallet size={28} /> },
              { name: 'USDC ', logo: '/logos/ecosystem/usdc.png', fallback: <CheckCircle size={28} /> },
              { name: 'MoonPay ', logo: '/logos/ecosystem/moonpay.png', fallback: <Zap size={28} /> },
              { name: 'Transak ', logo: '/logos/ecosystem/transak.png', fallback: <Zap size={28} /> },
              { name: 'SendGrid ', logo: '/logos/ecosystem/sendgrid.png', fallback: <Activity size={28} /> },
            ].map((partner) => (
              <HoverCard key={partner.name}>
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '16px 32px',
                    background: 'var(--surface-container-high)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    color: 'var(--on-surface-variant)', 
                    transition: 'all 0.3s',
                    cursor: 'default',
                    whiteSpace: 'nowrap'
                  }} 
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--on-surface)';
                    e.currentTarget.style.borderColor = 'var(--outline)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }} 
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--on-surface-variant)';
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src={partner.logo} 
                      alt={`${partner.name} logo`} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        // Hide broken image and show fallback icon
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) {
                          (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                    <div style={{ display: 'none', color: 'inherit' }}>
                      {partner.fallback}
                    </div>
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '0.5px' }}>{partner.name.trim()}</span>
                </div>
              </HoverCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="container landing-section-gap-lg" style={{ marginTop: '140px', marginBottom: '60px' }}>
        <FadeIn>
          <BorderGlow borderRadius={32} glowColor="160 80 80" colors={['#06d6a0', '#118ab2', '#8338ec']} backgroundColor="var(--surface-container)">
            <div className="cta-banner" style={{ background: 'transparent', border: 'none', backdropFilter: 'none' }}>
              <h2 className="text-display" style={{ fontSize: '64px', position: 'relative', zIndex: 1, marginBottom: '24px' }}>
                Ready to integrate?
              </h2>
              <p
                className="text-body-lg"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  color: 'var(--on-surface-variant)',
                  maxWidth: '640px',
                  margin: '0 auto 40px',
                }}
              >
                Set up trustless recurring payments for your platform in minutes, 
                not months. No deep blockchain expertise required to get started today.
                Join the decentralized subscription economy.
              </p>
              <HoverCard>
                <button
                  onClick={() => handleAction('merchant')}
                  className="btn btn-accent"
                  id="cta-get-started"
                  style={{ position: 'relative', zIndex: 1, display: 'inline-flex', border: 'none', cursor: 'pointer' }}
                >
                  Get Started
                  <ArrowRight size={20} strokeWidth={2.5} />
                </button>
              </HoverCard>
            </div>
          </BorderGlow>
        </FadeIn>
      </section>

      {/* ─── Footer ─── */}
      <section className="container">
        <footer className="landing-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', padding: '40px 0' }}>
          <div>
            <span className="landing-footer-text text-body-md" style={{ fontWeight: 500 }}>© 2026 Rekura.</span>
            <span className="landing-footer-text text-body-md" style={{ color: 'var(--on-surface-variant)', marginLeft: '12px' }}>Built on Stellar</span>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <a href="https://discord.gg/hrBrdNhA" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--on-surface)', textDecoration: 'none', fontWeight: 500 }} onClick={() => trackEvent('social_click', { platform: 'discord' })}>
              Discord
            </a>
            <a href="https://x.com/recurra116" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--on-surface)', textDecoration: 'none', fontWeight: 500 }} onClick={() => trackEvent('social_click', { platform: 'x' })}>
              X (Twitter)
            </a>
          </div>
        </footer>
      </section>
      </main>
    </PageWrapper>
  );
};

export default Landing;

