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

  const fetchProfile = async () => {
    const { ok, data } = await api('/user/profile');
    if (ok && data?.phoneNumber) {
      setPhoneNumber(data.phoneNumber);
    }
  };

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
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-6xl">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>User Portal</h2>
            <p className="text-lg text-black/60 mt-2 mb-10 max-w-2xl">
              Connect your smart wallet, manage cryptographic allowances, and approve recurring spending limits.
            </p>
          </FadeIn>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Smart Wallet Settings */}
            <StaggerItem className="flex flex-col gap-6">
              <h3 className="text-2xl font-bold text-black tracking-tight">Smart Wallet Settings</h3>

              <div className="flex flex-col gap-4">
                <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 md:p-8 transition-shadow hover:shadow-md">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-black/5 rounded-xl">
                        <span className="material-symbols-outlined text-black">security</span>
                      </div>
                      <span className="text-lg font-bold text-black tracking-tight">Payment Engine Allowance</span>
                    </div>
                    {btnState === 'success' && (
                      <span className="px-3 py-1 text-xs font-bold uppercase tracking-widest text-green-600 bg-green-50 rounded-lg">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-black/60 mb-6">
                    Approve the Rekura smart contract to pull funds for your active subscriptions.
                  </p>
                  <HoverCard>
                    <button
                      id="btn-approve-allowance"
                      className={`w-full py-4 px-6 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                        btnState === 'success' 
                          ? 'bg-black/5 text-black/60 cursor-default shadow-none border border-black/5' 
                          : 'bg-black text-white hover:bg-gray-800 shadow-sm hover:shadow-md'
                      }`}
                      onClick={approveAllowance}
                      disabled={btnState === 'loading' || btnState === 'success'}
                    >
                      {btnState === 'idle' && 'Approve Allowance'}
                      {btnState === 'loading' && <><span className="material-symbols-outlined animate-spin">progress_activity</span> Approving...</>}
                      {btnState === 'success' && <><span className="material-symbols-outlined text-green-500">check_circle</span> Approved</>}
                    </button>
                  </HoverCard>
                  {btnState === 'success' && (
                    <HoverCard>
                      <button
                        className="w-full mt-3 py-3 px-6 rounded-2xl font-bold text-sm text-red-600 hover:bg-red-50 transition-colors"
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
            <StaggerItem className="flex flex-col gap-6">
              <h3 className="text-2xl font-bold text-black tracking-tight">Wallet Info</h3>
              <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 md:p-8 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-black/5 rounded-xl">
                    <span className="material-symbols-outlined text-black">account_balance_wallet</span>
                  </div>
                  <span className="text-lg font-bold text-black tracking-tight">Connected Wallet</span>
                </div>
                {fullWalletAddress ? (
                  <div className="font-mono text-sm bg-black/5 p-4 rounded-2xl text-black/80 font-medium border border-black/5 flex items-center justify-between">
                    <span>{fullWalletAddress.substring(0, 6)}...{fullWalletAddress.substring(fullWalletAddress.length - 4)}</span>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-black/60">
                    No wallet connected. Click "Connect Wallet" in the navbar to get started.
                  </p>
                )}

                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-black text-xl">shield</span>
                    <span className="text-base font-bold text-black">Security Status</span>
                  </div>
                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-black/5">
                      <span className="text-black/60 font-medium">Payment Allowance</span>
                      <span className={`font-bold ${btnState === 'success' ? 'text-green-600' : 'text-black/40'}`}>
                        {btnState === 'success' ? 'Approved' : 'Not Approved'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-black/60 font-medium">Network</span>
                      <span className="font-bold text-black">{import.meta.env.VITE_STELLAR_NETWORK === 'MAINNET' ? 'Stellar Mainnet' : 'Stellar Testnet'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Settings */}
              <h3 className="text-2xl font-bold text-black tracking-tight mt-4">Profile Settings</h3>
              <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 md:p-8 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-black/5 rounded-xl">
                    <span className="material-symbols-outlined text-black">chat</span>
                  </div>
                  <span className="text-lg font-bold text-black tracking-tight">WhatsApp Notifications</span>
                </div>
                <p className="text-sm font-medium text-black/60 mb-5">
                  Enter your WhatsApp number to receive instant receipts and renewal reminders. Include your country code (e.g., +14155552671).
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    className="flex-1 bg-black/5 border border-black/10 p-4 rounded-2xl text-black font-medium outline-none focus:border-black/30 focus:bg-white transition-colors placeholder:text-black/30" 
                    placeholder="+1 (555) 000-0000" 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <button 
                    className="py-4 px-8 bg-black text-white rounded-2xl font-bold transition-all hover:bg-gray-800 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-none whitespace-nowrap" 
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
