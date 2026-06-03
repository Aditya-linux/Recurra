import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Blocks, Wallet, ShieldCheck, Activity, Zap, Repeat, CheckCircle } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

const Landing: React.FC = () => {
  const chartData = [35, 55, 42, 68, 50, 75, 60, 85, 72, 90, 78, 95];
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
    if (walletAddress) {
      navigate(type === 'merchant' ? '/merchant' : '/subscriptions');
    } else {
      setIntent(type);
      openModal();
    }
  };

  return (
    <main>
      {/* ─── Hero Section ─── */}
      <section className="landing-hero">
        <div className="container flex flex-col items-center gap-8">
          <div className="hero-badge animate-in">
            <Activity size={16} strokeWidth={2.5} />
            Powered by Stellar
          </div>

          <div className="hero-heading animate-in animate-delay-1">
            <h1 className="text-display">
              The Future of{' '}
              <span className="accent">Recurring Payments</span>
            </h1>
          </div>

          <p className="text-body-lg hero-sub animate-in animate-delay-2" style={{ maxWidth: '720px' }}>
            Trustless subscription automation built on the Stellar network. 
            Seamlessly manage recurring crypto payments for your business with enterprise-grade 
            security, zero downtime, and absolute precision. Eliminate the need for legacy payment processors 
            and take full control of your revenue streams globally.
          </p>

          <div className="hero-cta-group animate-in animate-delay-3">
            <button onClick={() => handleAction('merchant')} className="btn btn-primary" id="cta-start-building">
              Start Selling
              <ArrowRight size={20} strokeWidth={2.5} />
            </button>
            <button onClick={() => handleAction('user')} className="btn btn-secondary" id="cta-explore">
              Start Subscribing
            </button>
          </div>
        </div>
      </section>

      {/* ─── Bento Grid Section ─── */}
      <section className="container animate-in animate-delay-4">
        <div className="bento-grid">

          {/* Card 1: Hero Stat — 2×2 */}
          <div className="bento-card bento-hero" id="bento-hero-stat" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="mesh-gradient" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="bento-label" style={{ marginBottom: '24px' }}>Protocol Metrics</div>
              <div className="bento-stat" style={{ fontSize: '88px', marginBottom: '8px' }}>10,000+</div>
              <div className="text-h3" style={{ color: 'var(--on-surface)', marginTop: '8px' }}>
                Transactions Secured
              </div>
              <p className="bento-desc" style={{ marginTop: '24px', maxWidth: '440px', fontSize: '18px', lineHeight: '1.7' }}>
                On-chain subscription payments processed seamlessly with zero downtime 
                and cryptographic verification at every step of the settlement process.
                Our protocol ensures funds are only moved when explicitly authorized by the underlying smart contract logic.
              </p>
            </div>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '56px', marginTop: '40px' }}>
              <div>
                <div className="text-display" style={{ letterSpacing: '-0.03em', fontSize: '56px' }}>99.9%</div>
                <div className="bento-desc" style={{ marginTop: '8px', fontSize: '18px' }}>Uptime</div>
              </div>
              <div>
                <div className="text-display" style={{ letterSpacing: '-0.03em', fontSize: '56px' }}>{'<'}2s</div>
                <div className="bento-desc" style={{ marginTop: '8px', fontSize: '18px' }}>Settlement</div>
              </div>
              <div>
                <div className="text-display" style={{ letterSpacing: '-0.03em', fontSize: '56px' }}>$0.01</div>
                <div className="bento-desc" style={{ marginTop: '8px', fontSize: '18px' }}>Avg. Fee</div>
              </div>
            </div>
          </div>

          {/* Card 2: Smart Contracts — 1×1 */}
          <div className="bento-card" id="bento-smart-contracts">
            <div className="bento-icon" style={{ background: 'rgba(52, 120, 246, 0.1)', color: 'var(--accent-blue)', marginBottom: '24px' }}>
              <Blocks size={32} strokeWidth={2} />
            </div>
            <div className="bento-title" style={{ marginBottom: '12px' }}>Trustless Automation</div>
            <p className="bento-desc">
              Smart contracts handle every payment cycle — no intermediaries, 
              no manual triggers. Pure on-chain logic executing flawlessly.
            </p>
          </div>

          {/* Card 3: Multi-Wallet — 1×1 */}
          <div className="bento-card" id="bento-multi-wallet">
            <div className="bento-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)', marginBottom: '24px' }}>
              <Wallet size={32} strokeWidth={2} />
            </div>
            <div className="bento-title" style={{ marginBottom: '12px' }}>Connect Any Wallet</div>
            <p className="bento-desc">
              Seamless integration with Freighter, Albedo, and xBull. 
              One-click connection with universal compatibility across devices.
            </p>
            <div className="flex gap-3" style={{ marginTop: '24px', flexWrap: 'wrap' }}>
              {['Freighter', 'Albedo', 'xBull'].map((wallet) => (
                <span
                  key={wallet}
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: 'var(--rounded-full)',
                    background: 'var(--surface-container)',
                    color: 'var(--on-surface-variant)',
                    border: '1px solid var(--outline-variant)',
                  }}
                >
                  {wallet}
                </span>
              ))}
            </div>
          </div>

          {/* Card 4: Live Activity — 2×1 wide */}
          <div className="bento-card bento-wide" id="bento-activity-feed">
            <div className="flex justify-between items-center" style={{ marginBottom: '24px' }}>
              <div className="bento-label">Live Activity</div>
              <div className="flex items-center gap-2">
                <div className="pulse-dot" style={{ marginRight: 0 }} />
                <span style={{ fontSize: '14px', color: 'var(--emerald-500)', fontWeight: 600 }}>Live</span>
              </div>
            </div>
            <div className="activity-ticker">
              <div className="activity-row">
                <div className="flex items-center gap-4">
                  <div className="activity-dot" style={{ background: 'var(--accent-blue)' }} />
                  <span className="activity-meta">Netflix Premium</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="activity-amount">−15.00 USDC</span>
                  <span className="activity-time">2 min ago</span>
                </div>
              </div>
              <div className="activity-row">
                <div className="flex items-center gap-4">
                  <div className="activity-dot" style={{ background: 'var(--accent-purple)' }} />
                  <span className="activity-meta">AWS Hosting</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="activity-amount">−45.20 USDC</span>
                  <span className="activity-time">1 hr ago</span>
                </div>
              </div>
              <div className="activity-row">
                <div className="flex items-center gap-4">
                  <div className="activity-dot" style={{ background: 'var(--emerald-500)' }} />
                  <span className="activity-meta">Figma Team</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="activity-amount">−12.00 USDC</span>
                  <span className="activity-time">3 hrs ago</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Security — 1×1 */}
          <div className="bento-card" id="bento-security">
            <div className="bento-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald-500)', marginBottom: '24px' }}>
              <ShieldCheck size={32} strokeWidth={2} />
            </div>
            <div className="bento-title" style={{ marginBottom: '12px' }}>Bank-Grade Security</div>
            <p className="bento-desc">
              Multi-signature escrow, comprehensive on-chain audit trails, and 
              cryptographic verification for absolutely every transaction.
            </p>
          </div>

          {/* Card 6: Analytics — 1×1 */}
          <div className="bento-card" id="bento-analytics">
            <div className="flex justify-between items-center" style={{ marginBottom: '12px' }}>
              <div className="bento-label">Growth</div>
              <span style={{ fontSize: '15px', fontWeight: 650, color: 'var(--emerald-500)' }}>+24%</span>
            </div>
            <div className="bento-title" style={{ marginBottom: '6px' }}>Subscription Volume</div>
            <p className="bento-desc">Monthly active subscriptions</p>
            <div className="mini-chart">
              {chartData.map((height, i) => (
                <div
                  key={i}
                  className="mini-chart-bar"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ─── How it Works Section ─── */}
      <section className="container" style={{ marginTop: '140px' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 className="text-display" style={{ fontSize: '48px', marginBottom: '16px' }}>How Rekura Works</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '600px', margin: '0 auto' }}>
            A radically transparent approach to recurring payments. We replace complex legacy banking rails with elegant, verifiable smart contracts.
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          {/* Step 1 */}
          <div className="card" style={{ padding: '40px' }}>
            <div className="bento-icon" style={{ background: 'rgba(52, 120, 246, 0.1)', color: 'var(--accent-blue)', marginBottom: '24px' }}>
              <Zap size={32} strokeWidth={2} />
            </div>
            <h3 className="text-h3" style={{ fontSize: '28px', marginBottom: '16px' }}>1. Connect & Authorize</h3>
            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', lineHeight: '1.7' }}>
              Merchants define their subscription plans (price, interval, currency). Users connect their preferred Stellar wallet and sign a single cryptographic transaction to authorize the recurring allowance. No credit cards, no sensitive data shared.
            </p>
          </div>
          
          {/* Step 2 */}
          <div className="card" style={{ padding: '40px' }}>
            <div className="bento-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)', marginBottom: '24px' }}>
              <Repeat size={32} strokeWidth={2} />
            </div>
            <h3 className="text-h3" style={{ fontSize: '28px', marginBottom: '16px' }}>2. Automated Cycles</h3>
            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', lineHeight: '1.7' }}>
              When a billing cycle is due, Rekura's decentralized keeper network triggers the smart contract. The contract strictly verifies the allowance, timestamp, and amount before executing the transfer directly on the Stellar ledger.
            </p>
          </div>
          
          {/* Step 3 */}
          <div className="card" style={{ padding: '40px' }}>
            <div className="bento-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald-500)', marginBottom: '24px' }}>
              <CheckCircle size={32} strokeWidth={2} />
            </div>
            <h3 className="text-h3" style={{ fontSize: '28px', marginBottom: '16px' }}>3. Instant Settlement</h3>
            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', lineHeight: '1.7' }}>
              Funds settle in the merchant's wallet in less than 2 seconds with negligible fees. Webhooks instantly notify the merchant's backend to grant the user access, creating a flawless, trustless loop.
            </p>
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="container" style={{ marginTop: '140px', marginBottom: '60px' }}>
        <div className="cta-banner animate-in animate-delay-5">
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
          <button
            onClick={() => handleAction('merchant')}
            className="btn btn-primary"
            id="cta-get-started"
            style={{ position: 'relative', zIndex: 1, display: 'inline-flex', border: 'none', cursor: 'pointer' }}
          >
            Get Started
            <ArrowRight size={20} strokeWidth={2.5} />
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <section className="container">
        <footer className="landing-footer">
          <span className="landing-footer-text text-body-md" style={{ fontWeight: 500 }}>© 2026 Rekura.</span>
          <span className="landing-footer-text text-body-md" style={{ color: 'var(--on-surface-variant)' }}>Built on Stellar</span>
        </footer>
      </section>
    </main>
  );
};

export default Landing;

