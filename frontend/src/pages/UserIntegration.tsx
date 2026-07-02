import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem, HoverCard } from '../components/ui/animations';

const UserIntegration: React.FC = () => {
  const { fullWalletAddress, openModal } = useWallet();
  const [btnState, setBtnState] = useState<'idle' | 'loading' | 'success'>('idle');

  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  useEffect(() => {
    fetchProfile();
    if (fullWalletAddress) {
      const approved = localStorage.getItem(`recurra_approved_${fullWalletAddress}`);
      if (approved === 'true') {
        setBtnState('success');
      }
    } else {
      setBtnState('idle');
    }
  }, [fullWalletAddress]);

  const fetchProfile = async () => {
    const { ok, data } = await api('/user/profile');
    if (ok && data?.phoneNumber) {
      setPhoneNumber(data.phoneNumber);
    }
  };

  const handleSavePhone = async () => {
    if (phoneNumber && !phoneNumber.startsWith('+')) {
      toast.error('Please include your country code (e.g., +1)');
      return;
    }
    
    setIsSavingPhone(true);
    const { ok } = await api('/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ phoneNumber })
    });
    setIsSavingPhone(false);
    if (ok) {
      toast.success('WhatsApp number saved!');
    } else {
      toast.error('Failed to save WhatsApp number');
    }
  };

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
    <PageWrapper>
    <main className="pt-nav" style={{ paddingBottom: '64px' }}>
      <section className="container" style={{ marginTop: '40px' }}>
        <FadeIn>
          <h2 className="text-h2">User Portal</h2>
          <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', marginTop: '8px', marginBottom: '40px', maxWidth: '600px' }}>
            Connect your smart wallet, manage cryptographic allowances, and approve recurring spending limits.
          </p>
        </FadeIn>

        <StaggerContainer className="grid-12">
          {/* Smart Wallet Settings */}
          <StaggerItem className="card flex flex-col gap-6" style={{ gridColumn: 'span 6' }}>
            <h3 className="text-h3" style={{ fontSize: '24px' }}>Smart Wallet Settings</h3>

            <div className="flex flex-col gap-4">
              <div className="panel" style={{ padding: '24px', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>security</span>
                    <span className="text-body-lg" style={{ fontWeight: 600 }}>Payment Engine Allowance</span>
                  </div>
                  {btnState === 'success' && (
                    <span className="chip" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginBottom: '16px' }}>
                  Approve the Rekura smart contract to pull funds for your active subscriptions.
                </p>
                <HoverCard>
                  <button
                    id="btn-approve-allowance"
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      ...(btnState === 'success' ? { opacity: 0.8, cursor: 'default' } : {})
                    }}
                    onClick={approveAllowance}
                    disabled={btnState === 'loading' || btnState === 'success'}
                  >
                    {btnState === 'idle' && 'Approve Allowance'}
                    {btnState === 'loading' && <><span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>progress_activity</span> Approving...</>}
                    {btnState === 'success' && <><span className="material-symbols-outlined">check_circle</span> Approved</>}
                  </button>
                </HoverCard>
                {btnState === 'success' && (
                  <HoverCard>
                    <button
                      className="btn btn-ghost"
                      style={{ width: '100%', marginTop: '8px', fontSize: '14px' }}
                      onClick={revokeAllowance}
                    >
                      Revoke Allowance
                    </button>
                  </HoverCard>
                )}
              </div>
            </div>
          </StaggerItem>

          {/* Wallet Info Card */}
          <StaggerItem className="card flex flex-col gap-6" style={{ gridColumn: 'span 6' }}>
            <h3 className="text-h3" style={{ fontSize: '24px' }}>Wallet Info</h3>
            <div className="panel" style={{ padding: '24px', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)' }}>
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
                    <span style={{ color: btnState === 'success' ? 'var(--on-surface)' : 'var(--on-surface-variant)', fontWeight: 600 }}>
                      {btnState === 'success' ? ' Approved' : ' Not Approved'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--on-surface-variant)' }}>Network</span>
                    <span style={{ fontWeight: 600 }}>{import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? 'Stellar Mainnet' : 'Stellar Testnet'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Settings */}
            <h3 className="text-h3" style={{ fontSize: '24px', marginTop: '16px' }}>Profile Settings</h3>
            <div className="panel" style={{ padding: '24px', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>chat</span>
                <span className="text-body-lg" style={{ fontWeight: 600 }}>WhatsApp Notifications</span>
              </div>
              <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginBottom: '16px' }}>
                Enter your WhatsApp number to receive instant receipts and renewal reminders. Include your country code (e.g., +14155552671).
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="input-field flex-1" 
                  placeholder="+1 (555) 000-0000" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{ background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)', padding: '12px', borderRadius: '8px', color: 'var(--on-surface)', outline: 'none' }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleSavePhone}
                  disabled={isSavingPhone}
                >
                  {isSavingPhone ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

          </StaggerItem>
        </StaggerContainer>
      </section>
    </main>
    </PageWrapper>
  );
};

export default UserIntegration;
