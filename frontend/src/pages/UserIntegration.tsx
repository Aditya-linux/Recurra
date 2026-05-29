import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';

const UserIntegration: React.FC = () => {
  const { fullWalletAddress, openModal } = useWallet();
  const [btnState, setBtnState] = useState<'idle' | 'loading' | 'success'>('idle');

  // Persist approval state in localStorage so it doesn't reset on re-render
  useEffect(() => {
    if (fullWalletAddress) {
      const approved = localStorage.getItem(`recurra_approved_${fullWalletAddress}`);
      if (approved === 'true') {
        setBtnState('success');
      }
    } else {
      setBtnState('idle');
    }
  }, [fullWalletAddress]);

  const approveAllowance = async () => {
    if (!fullWalletAddress) {
      openModal();
      return;
    }

    setBtnState('loading');

    // Simulate a short processing delay (in production this would be a real on-chain tx)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Persist approval
    localStorage.setItem(`recurra_approved_${fullWalletAddress}`, 'true');
    setBtnState('success');
  };

  const revokeAllowance = () => {
    if (fullWalletAddress) {
      localStorage.removeItem(`recurra_approved_${fullWalletAddress}`);
      setBtnState('idle');
    }
  };

  return (
    <main className="pt-nav" style={{ paddingBottom: '64px' }}>
      <section className="container" style={{ marginTop: '40px' }}>
        <h2 className="text-h2">User Portal</h2>
        <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', marginTop: '8px', marginBottom: '40px', maxWidth: '600px' }}>
          Connect your smart wallet, manage cryptographic allowances, and approve recurring spending limits.
        </p>

        <div className="grid-12">
          {/* Smart Wallet Settings */}
          <div className="card flex flex-col gap-6" style={{ gridColumn: 'span 6' }}>
            <h3 className="text-h3" style={{ fontSize: '24px' }}>Smart Wallet Settings</h3>

            <div className="flex flex-col gap-4">
              <div className="panel" style={{ padding: '24px' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>security</span>
                    <span className="text-body-lg" style={{ fontWeight: 600 }}>Payment Engine Allowance</span>
                  </div>
                  {btnState === 'success' && (
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: 'rgba(29,185,84,0.15)', color: '#1DB954' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginBottom: '16px' }}>
                  Approve the Recurra smart contract to pull funds for your active subscriptions.
                </p>
                <button
                  id="btn-approve-allowance"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    ...(btnState === 'success' ? { backgroundColor: '#1DB954', color: '#fff', cursor: 'default' } : {})
                  }}
                  onClick={approveAllowance}
                  disabled={btnState === 'loading' || btnState === 'success'}
                >
                  {btnState === 'idle' && 'Approve Allowance'}
                  {btnState === 'loading' && <><span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>progress_activity</span> Approving...</>}
                  {btnState === 'success' && <><span className="material-symbols-outlined">check_circle</span> Approved</>}
                </button>
                {btnState === 'success' && (
                  <button
                    className="btn"
                    style={{ width: '100%', marginTop: '8px', background: 'transparent', color: 'var(--on-surface-variant)', fontSize: '13px' }}
                    onClick={revokeAllowance}
                  >
                    Revoke Allowance
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Wallet Info Card */}
          <div className="card flex flex-col gap-6" style={{ gridColumn: 'span 6' }}>
            <h3 className="text-h3" style={{ fontSize: '24px' }}>Wallet Info</h3>
            <div className="panel" style={{ padding: '24px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>account_balance_wallet</span>
                <span className="text-body-lg" style={{ fontWeight: 600 }}>Connected Wallet</span>
              </div>
              {fullWalletAddress ? (
                <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '13px', background: 'var(--surface-container-high)', padding: '12px', borderRadius: '8px', color: 'var(--on-surface)' }}>
                  {fullWalletAddress}
                </div>
              ) : (
                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                  No wallet connected. Click "Connect Wallet" in the navbar to get started.
                </p>
              )}

              <div style={{ marginTop: '20px' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>shield</span>
                  <span className="text-body-md" style={{ fontWeight: 600 }}>Security Status</span>
                </div>
                <div className="flex flex-col gap-2" style={{ fontSize: '13px' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--on-surface-variant)' }}>Payment Allowance</span>
                    <span style={{ color: btnState === 'success' ? '#1DB954' : 'var(--on-surface-variant)', fontWeight: 600 }}>
                      {btnState === 'success' ? '✓ Approved' : '✗ Not Approved'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--on-surface-variant)' }}>Network</span>
                    <span style={{ fontWeight: 600 }}>Stellar Testnet</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default UserIntegration;
