import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Blocks, Wallet, ShieldCheck, Activity, Zap, Repeat, CheckCircle } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { trackEvent } from '../utils/analytics';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem, HoverCard, CountUp } from '../components/ui/animations';
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
            <div className="hero-badge">
              <Activity size={16} strokeWidth={2.5} />
              Powered by Stellar
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
              Trustless subscription automation built on the Stellar network. 
              Seamlessly manage recurring crypto payments for your business with enterprise-grade 
              security, zero downtime, and absolute precision. Eliminate the need for legacy payment processors 
              and take full control of your revenue streams globally.
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

      {/* ─── Feature Grid Section ─── */}
      <StaggerContainer className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Feature 1: Proven Protocol */}
          <StaggerItem>
            <BorderGlow className="h-full" borderRadius={16} glowColor="200 80 80" colors={['#38bdf8', '#818cf8', '#c084fc']} backgroundColor="var(--surface-container)">
              <div className="flex flex-col h-full p-8">
                <div className="text-[56px] font-bold text-[var(--on-surface)] mb-2 tracking-tight">
                  <CountUp to={10000} duration={2} suffix="+" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--on-surface)] mb-4">Transactions Secured</h3>
                <p className="text-[var(--on-surface-variant)] leading-relaxed">
                  On-chain subscription payments processed seamlessly with zero downtime 
                  and cryptographic verification at every step of the settlement process.
                </p>
                <div className="mt-8 pt-6 border-t border-[var(--glass-border)] grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-[var(--on-surface)] tracking-tight">{'<'}2s</div>
                    <div className="text-sm text-[var(--on-surface-variant)] mt-1">Settlement</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[var(--on-surface)] tracking-tight">$0.01</div>
                    <div className="text-sm text-[var(--on-surface-variant)] mt-1">Avg. Fee</div>
                  </div>
                </div>
              </div>
            </BorderGlow>
          </StaggerItem>

          {/* Feature 2: Trustless Automation */}
          <StaggerItem>
            <BorderGlow className="h-full" borderRadius={16} glowColor="160 80 80" colors={['#06d6a0', '#118ab2', '#8338ec']} backgroundColor="var(--surface-container)">
              <div className="flex flex-col h-full p-8">
                <div className="w-14 h-14 rounded-xl bg-[rgba(6,214,160,0.12)] text-[var(--accent-cyan)] flex items-center justify-center mb-6">
                  <Blocks size={28} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-semibold text-[var(--on-surface)] mb-4">Trustless Automation</h3>
                <p className="text-[var(--on-surface-variant)] leading-relaxed">
                  Smart contracts handle every payment cycle — no intermediaries, 
                  no manual triggers. Pure on-chain logic executing flawlessly.
                </p>
              </div>
            </BorderGlow>
          </StaggerItem>

          {/* Feature 3: Universal & Secure */}
          <StaggerItem>
            <BorderGlow className="h-full" borderRadius={16} glowColor="270 80 80" colors={['#c084fc', '#f472b6', '#38bdf8']} backgroundColor="var(--surface-container)">
              <div className="flex flex-col h-full p-8">
                <div className="w-14 h-14 rounded-xl bg-[rgba(131,56,236,0.12)] text-[var(--accent-violet)] flex items-center justify-center mb-6">
                  <ShieldCheck size={28} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-semibold text-[var(--on-surface)] mb-4">Bank-Grade Security</h3>
                <p className="text-[var(--on-surface-variant)] leading-relaxed mb-8">
                  Multi-signature escrow and cryptographic verification. Seamlessly connect any Stellar wallet.
                </p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {['Freighter', 'Albedo', 'xBull'].map((wallet) => (
                    <span
                      key={wallet}
                      className="px-3 py-1 text-xs font-semibold rounded-full bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] border border-[var(--outline-variant)]"
                    >
                      {wallet}
                    </span>
                  ))}
                </div>
              </div>
            </BorderGlow>
          </StaggerItem>

        </div>
      </StaggerContainer>

      {/* ─── How it Works Section ─── */}
      <section className="container" style={{ marginTop: '140px' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 className="text-display" style={{ fontSize: '48px', marginBottom: '16px' }}>How Rekura Works</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '600px', margin: '0 auto' }}>
            A radically transparent approach to recurring payments. We replace complex legacy banking rails with elegant, verifiable smart contracts.
          </p>
        </div>
        
        <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          {/* Vertical connecting line */}
          <div style={{ position: 'absolute', left: '48px', top: '0', bottom: '0', width: '2px', background: 'var(--outline-variant)', zIndex: 0 }} />

          {/* Step 1 */}
          <motion.div 
            initial={{ opacity: 0.3, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, margin: "-20%" }}
            transition={{ duration: 0.5 }}
            style={{ display: 'flex', gap: '32px', position: 'relative', zIndex: 1, marginBottom: '64px' }}
          >
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--surface-bright)', border: '2px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-lg)' }}>
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
            style={{ display: 'flex', gap: '32px', position: 'relative', zIndex: 1, marginBottom: '64px' }}
          >
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--surface-bright)', border: '2px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-lg)' }}>
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
            style={{ display: 'flex', gap: '32px', position: 'relative', zIndex: 1 }}
          >
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--surface-bright)', border: '2px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-lg)' }}>
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
      <section className="container" style={{ marginTop: '140px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 className="text-display" style={{ fontSize: '40px', marginBottom: '16px' }}>Ecosystem & Partners</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '600px', margin: '0 auto' }}>
            Powered by the robust infrastructure of the Stellar network and growing through community partnerships.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '64px', flexWrap: 'wrap' }}>
          <HoverCard>
            <div style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--on-surface-variant)', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--on-surface)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--on-surface-variant)'}>
              <Activity size={32} /> Stellar
            </div>
          </HoverCard>
          <HoverCard>
            <div style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--on-surface-variant)', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--on-surface)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--on-surface-variant)'}>
              <Wallet size={32} /> Freighter
            </div>
          </HoverCard>
          <HoverCard>
            <div style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--on-surface-variant)', transition: 'color 0.3s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--on-surface)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--on-surface-variant)'}>
              <Blocks size={32} /> Soroban
            </div>
          </HoverCard>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="container" style={{ marginTop: '140px', marginBottom: '60px' }}>
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

