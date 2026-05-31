import React from 'react';
import { Link } from 'react-router-dom';

const Landing: React.FC = () => {
  return (
    <main className="pt-nav">
      <section className="section-md container">
        <div className="hero-grid">
          <div className="hero-content flex flex-col gap-6">
            <div className="chip inline-flex items-center gap-2" style={{ width: 'fit-content', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.1))', border: '1px solid rgba(59,130,246,0.2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>currency_exchange</span>
              <span className="text-label-caps" style={{ color: 'var(--primary)', fontWeight: 600 }}>Web3 Subscription Protocol</span>
            </div>
            
            <h1 className="text-h1">Trustless<br />Automation.</h1>
            <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '500px' }}>
              Combining the technical precision of blockchain infrastructure with the high-end polished feel of a premium fintech application. Seamlessly manage recurring crypto payments.
            </p>
            
            <div className="flex gap-4" style={{ marginTop: '16px' }}>
              <Link to="/merchant" className="btn btn-primary">Start Integrating</Link>
              <Link to="/user" className="btn btn-secondary">Explore as User</Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="panel flex flex-col gap-6" style={{ background: 'linear-gradient(135deg, var(--surface-container-low), var(--surface-container-highest))', border: '1px solid var(--outline-variant)', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
              <div className="flex justify-between items-center">
                <span className="text-label-caps" style={{ color: 'var(--on-surface-variant)' }}>Recent Activity</span>
                <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>monitoring</span>
              </div>
              
              <div className="card flex justify-between items-center" style={{ padding: '16px' }}>
                <div className="flex items-center gap-4">
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>payments</span>
                  </div>
                  <div>
                    <div className="text-body-md" style={{ fontWeight: 500 }}>Netflix Subscription</div>
                    <div className="text-label-caps" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>Automated • 2 mins ago</div>
                  </div>
                </div>
                <div className="text-body-md" style={{ fontWeight: 600 }}>-15.00 USDC</div>
              </div>

              <div className="card flex justify-between items-center" style={{ padding: '16px' }}>
                <div className="flex items-center gap-4">
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>dns</span>
                  </div>
                  <div>
                    <div className="text-body-md" style={{ fontWeight: 500 }}>AWS Hosting</div>
                    <div className="text-label-caps" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>Automated • 1 hr ago</div>
                  </div>
                </div>
                <div className="text-body-md" style={{ fontWeight: 600 }}>-45.20 USDC</div>
              </div>
              
            </div>
          </div>
        </div>
      </section>

      <section className="section-lg container">
        <div className="flex flex-col items-center text-center gap-4" style={{ marginBottom: '64px' }}>
          <h2 className="text-h2">Invisible Power.</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '600px' }}>
            Experience pristine, stark-white base interfaces punctuated by deep neutral elements and vibrant, spectral color blurs that signify the power of smart contracts.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-blur-bg" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.2))' }}></div>
            <div className="glass-content flex flex-col gap-4">
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>account_balance_wallet</span>
              <h3 className="text-h3" style={{ fontSize: '24px' }}>Smart Wallets</h3>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                Enterprise merchants and tech-savvy crypto users can leverage account abstraction for seamless experiences.
              </p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-blur-bg"></div>
            <div className="glass-content flex flex-col gap-4">
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>cycle</span>
              <h3 className="text-h3" style={{ fontSize: '24px' }}>Recurring Payments</h3>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                Trustless automation ensuring your subscriptions are paid exactly on time without manual intervention.
              </p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-blur-bg" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(236,72,153,0.2))', top: 'auto', bottom: '-50px' }}></div>
            <div className="glass-content flex flex-col gap-4">
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>verified_user</span>
              <h3 className="text-h3" style={{ fontSize: '24px' }}>Secure & Transparent</h3>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                Deep obsidian black elements provide maximum authority and legibility for your cryptographic data.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Landing;
