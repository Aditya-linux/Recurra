import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api, API_BASE } from '../utils/api';
import toast from 'react-hot-toast';
import AnalyticsPage from './AnalyticsPage';
import { Upload, Loader2 } from "lucide-react";
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem } from '../components/ui/animations';
import { DiscountManager } from '../components/DiscountManager';

const MerchantIntegration: React.FC = () => {
  const { walletAddress, fullWalletAddress, userRole, openModal, setUserRole } = useWallet();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'discounts' | 'settings'>('overview');

  // Registration state
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('recurra_token') || ''}`
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        const baseUrl = API_BASE.replace('/api/v1', '');
        setLogoUrl(`${baseUrl}${data.url}`);
        toast.success('Logo uploaded successfully');
      } else {
        toast.error(data.error || 'Failed to upload logo');
      }
    } catch (err) {
      toast.error('Network error during upload');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Plan creation state
  const [planName, setPlanName] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planInterval, setPlanInterval] = useState('2592000'); // Default to monthly
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [webhooks, setWebhooks] = useState<any[]>([]);

  // Settings state
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [settingsBusinessName, setSettingsBusinessName] = useState('');
  const [settingsLogoUrl, setSettingsLogoUrl] = useState('');

  // Plans state
  const [plans, setPlans] = useState<any[]>([]);

  const fetchSettings = async () => {
    const { ok, data } = await api('/merchant/settings');
    if (ok && data?.merchant) {
      setSettingsBusinessName(data.merchant.business_name || '');
      setSettingsLogoUrl(data.merchant.logo_url || '');
    }
  };

  const fetchWebhooks = async () => {
    const { ok, data } = await api('/webhooks');
    if (ok && data) {
      setWebhooks(data.data);
    }
  };

  const fetchPlans = async () => {
    const { ok, data } = await api('/merchant/plans');
    if (ok && data) {
      setPlans(data.data);
    }
  };

  useEffect(() => {
    if (userRole === 'merchant') {
      fetchWebhooks();
      fetchPlans();
      fetchSettings();
    }
  }, [userRole]);

  const registerMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullWalletAddress) {
      toast.error('Connect your wallet first');
      return;
    }
    setIsRegistering(true);
    try {
      const { ok, data, status, error } = await api('/merchant/register', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: fullWalletAddress,
          businessName,
          businessEmail,
          logoUrl,
        })
      });

      if (ok && data) {
        localStorage.setItem('recurra_token', data.accessToken);
        setUserRole('merchant');
        toast.success('Successfully registered as Merchant!');
      } else {
        // If already registered, re-authenticate to get merchant JWT
        if (status === 400 && error?.includes('already registered')) {
          toast('Already registered! Refreshing session...', { icon: '' });
          const authRes = await fetch(`${API_BASE}/auth/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: fullWalletAddress,
              signature: 'dummy_sig',
              message: `Sign in to Rekura with wallet ${fullWalletAddress}`,
              publicKey: fullWalletAddress,
            })
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            localStorage.setItem('recurra_token', authData.accessToken);
            setUserRole(authData.user.role);
          }
          return;
        }
        if (status !== 401) {
          toast.error(error || 'Failed to register');
        }
      }
    } catch (e) {
      toast.error('Network error during registration');
    }
    setIsRegistering(false);
  };

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPlan(true);
    try {
      const amountInStroops = Math.floor(parseFloat(planAmount) * 10000000);
      const { ok, error, status } = await api('/merchant/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: planName,
          amount: amountInStroops,
          intervalSeconds: parseInt(planInterval),
          tokenAddress: import.meta.env.VITE_USDC_TOKEN_ADDRESS || 'CD5TE4CUOKX6T5UMHL4JUTX7FTCN2G7CK3XPP7XV35COKJ6RZA6SG7YR',
        })
      });

      if (ok) {
        toast.success('Subscription plan created!');
        setPlanName('');
        setPlanAmount('');
        fetchPlans();
      } else if (status !== 401) {
        if (status === 403) {
          toast.error('Permission denied: ' + (error || 'Insufficient role. Try reconnecting wallet.'));
        } else {
          toast.error(error || 'Failed to create plan');
        }
      }
    } catch (e) {
      toast.error('Network error creating plan');
    }
    setIsCreatingPlan(false);
  };



  const createWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingWebhook(true);
    try {
      const { ok, data, error, status } = await api('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          url: webhookUrl,
          events: ['subscription.created']
        })
      });

      if (ok && data) {
        toast.success('Webhook configured successfully');
        setWebhookSecret(data.webhook.signingSecret);
        setWebhookUrl('');
        fetchWebhooks();
      } else if (status !== 401) {
        toast.error(error || 'Failed to configure webhook');
      }
    } catch (e) {
      toast.error('Network error configuring webhook');
    }
    setIsCreatingWebhook(false);
  };

  const updateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      const { ok, error } = await api('/merchant/settings', {
        method: 'PUT',
        body: JSON.stringify({
          businessName: settingsBusinessName,
          logoUrl: settingsLogoUrl,
        })
      });

      if (ok) {
        toast.success('Settings updated successfully!');
      } else {
        toast.error(error || 'Failed to update settings');
      }
    } catch (e) {
      toast.error('Network error updating settings');
    }
    setIsUpdatingSettings(false);
  };

  const handleSettingsLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('recurra_token') || ''}`
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        const baseUrl = API_BASE.replace('/api/v1', '');
        setSettingsLogoUrl(`${baseUrl}${data.url}`);
        toast.success('Logo uploaded successfully');
      } else {
        toast.error(data.error || 'Failed to upload logo');
      }
    } catch (err) {
      toast.error('Network error during upload');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (!walletAddress) {
    return (
      <PageWrapper>
        <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
          <section className="container mx-auto px-6 mt-10 max-w-6xl">
            <FadeIn>
              <div className="bg-white border border-black/5 rounded-3xl flex flex-col items-center gap-4 text-center p-8 max-w-md mx-auto mt-20 shadow-sm hover:shadow-md transition-shadow">
                <h2 className="text-2xl font-bold tracking-tight text-black">Connect Wallet to Continue</h2>
                <p className="text-sm font-medium text-black/60">
                  You need to connect your wallet to access the Merchant Portal.
                </p>
                <button className="bg-black text-white hover:bg-gray-800 font-bold py-3 px-6 rounded-2xl shadow-sm transition-all w-full" onClick={openModal}>Connect Wallet</button>
              </div>
            </FadeIn>
          </section>
        </main>
      </PageWrapper>
    );
  }

  if (userRole !== 'merchant') {
    return (
      <PageWrapper>
        <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
          <section className="container mx-auto px-6 mt-10 max-w-6xl">
            <FadeIn>
              <div className="bg-white border border-black/5 rounded-3xl shadow-sm hover:shadow-md transition-shadow max-w-[600px] mx-auto mt-10 p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight text-black">Register as a Merchant</h2>
                  <p className="text-sm font-medium text-black/60 mt-1">
                    Upgrade your account to create subscription plans and integrate Rekura payments.
                  </p>
                </div>
                <form onSubmit={registerMerchant} className="flex flex-col gap-6">
                  <div>
                    <label className="text-[13px] font-bold text-black/80 block mb-2">Business Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Acme Streaming" 
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required
                      className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[13px] font-bold text-black/80 block mb-2">Business Email</label>
                    <input 
                      type="email" 
                      placeholder="e.g. billing@acme.com" 
                      value={businessEmail}
                      onChange={(e) => setBusinessEmail(e.target.value)}
                      required
                      className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[13px] font-bold text-black/80 block mb-2">Business Logo</label>
                    {!logoUrl ? (
                      <div className="relative border-2 border-dashed rounded-2xl p-8 transition-colors flex flex-col items-center justify-center cursor-pointer border-black/10 bg-black/5 hover:bg-black/10">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {isUploadingLogo ? (
                          <div className="flex flex-col items-center text-black">
                            <Loader2 className="animate-spin mb-2 text-black/60" size={28} />
                            <span className="text-sm font-bold text-black/80">Uploading...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-black/60">
                            <div className="p-3 rounded-full mb-3 bg-white shadow-sm border border-black/5 text-black">
                              <Upload size={24} />
                            </div>
                            <span className="text-sm font-bold text-black">Click to upload from device</span>
                            <span className="text-xs font-medium mt-1 text-black/50">SVG, PNG, JPG (max 5MB)</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative border rounded-2xl p-4 flex items-center justify-between shadow-sm bg-white border-black/10">
                        <div className="flex items-center gap-4">
                          <div className="p-2 border rounded-xl flex items-center justify-center bg-black/5 border-black/5 w-[60px] h-[60px]">
                            <img src={logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain rounded" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-black">Logo uploaded</span>
                            <span className="text-xs font-bold text-green-600">Ready for display</span>
                          </div>
                        </div>
                        <div className="relative">
                          <button type="button" disabled={isUploadingLogo} className="px-4 py-2 bg-black/5 hover:bg-black/10 text-black font-bold rounded-xl text-sm transition-colors flex items-center">
                            {isUploadingLogo ? <><Loader2 className="animate-spin mr-2" size={14} /> Replacing...</> : 'Replace'}
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploadingLogo}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="submit" disabled={isRegistering} className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-black text-white hover:bg-gray-800 shadow-sm transition-all flex justify-center items-center">
                    {isRegistering ? <><Loader2 className="animate-spin mr-2" size={16} /> Registering...</> : 'Complete Registration'}
                  </button>
                </form>
              </div>
            </FadeIn>
          </section>
        </main>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-6xl">
          <FadeIn delay={0.1}>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>Merchant Portal</h2>
            <p className="text-lg text-black/60 mt-2 mb-8 max-w-2xl">
              Manage your subscription plans, webhooks, and performance analytics.
            </p>
          </FadeIn>

          {/* Tab Navigation */}
        <div className="merchant-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '32px', borderBottom: '1px solid rgba(0,0,0,0.1)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`.merchant-tabs::-webkit-scrollbar { display: none; }`}</style>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 20px',
              fontWeight: 700,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              borderBottom: activeTab === 'overview' ? '2px solid #000' : '2px solid transparent',
              color: activeTab === 'overview' ? '#000' : 'rgba(0,0,0,0.5)',
              backgroundColor: 'transparent',
              transition: 'all 0.2s',
            }}
          >
            Plans & Integration
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '12px 20px',
              fontWeight: 700,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              borderBottom: activeTab === 'analytics' ? '2px solid #000' : '2px solid transparent',
              color: activeTab === 'analytics' ? '#000' : 'rgba(0,0,0,0.5)',
              backgroundColor: 'transparent',
              transition: 'all 0.2s',
            }}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('discounts')}
            style={{
              padding: '12px 20px',
              fontWeight: 700,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              borderBottom: activeTab === 'discounts' ? '2px solid #000' : '2px solid transparent',
              color: activeTab === 'discounts' ? '#000' : 'rgba(0,0,0,0.5)',
              backgroundColor: 'transparent',
              transition: 'all 0.2s',
            }}
          >
            Discounts
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '12px 20px',
              fontWeight: 700,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              borderBottom: activeTab === 'settings' ? '2px solid #000' : '2px solid transparent',
              color: activeTab === 'settings' ? '#000' : 'rgba(0,0,0,0.5)',
              backgroundColor: 'transparent',
              transition: 'all 0.2s',
            }}
          >
            Settings
          </button>
        </div>

        {activeTab === 'analytics' ? (
          <FadeIn delay={0.2}><AnalyticsPage isEmbedded={true} /></FadeIn>
        ) : activeTab === 'discounts' ? (
          <FadeIn delay={0.2}><DiscountManager /></FadeIn>
        ) : activeTab === 'settings' ? (
          <FadeIn delay={0.2}>
            <div className="bg-white border border-black/5 rounded-3xl shadow-sm hover:shadow-md transition-shadow max-w-[600px] mx-auto p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-black">Merchant Settings</h2>
                <p className="text-sm font-medium text-black/60 mt-1">
                  Update your business name and display logo.
                </p>
              </div>
              <form onSubmit={updateSettings} className="flex flex-col gap-6">
                <div>
                  <label className="text-[13px] font-bold text-black/80 block mb-2">Business Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Acme Streaming" 
                    value={settingsBusinessName}
                    onChange={(e) => setSettingsBusinessName(e.target.value)}
                    required
                    className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-bold text-black/80 block mb-2">Business Logo</label>
                  {!settingsLogoUrl ? (
                    <div className="relative border-2 border-dashed rounded-2xl p-8 transition-colors flex flex-col items-center justify-center cursor-pointer border-black/10 bg-black/5 hover:bg-black/10">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSettingsLogoUpload}
                        disabled={isUploadingLogo}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      {isUploadingLogo ? (
                        <div className="flex flex-col items-center text-black">
                          <Loader2 className="animate-spin mb-2 text-black/60" size={28} />
                          <span className="text-sm font-bold text-black/80">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-black/60">
                          <div className="p-3 rounded-full mb-3 bg-white shadow-sm border border-black/5 text-black">
                            <Upload size={24} />
                          </div>
                          <span className="text-sm font-bold text-black">Click to upload from device</span>
                          <span className="text-xs font-medium mt-1 text-black/50">SVG, PNG, JPG (max 5MB)</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative border rounded-2xl p-4 flex items-center justify-between shadow-sm bg-white border-black/10">
                      <div className="flex items-center gap-4">
                        <div className="p-2 border rounded-xl flex items-center justify-center bg-black/5 border-black/5 w-[60px] h-[60px]">
                          <img src={settingsLogoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain rounded" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-black">Logo uploaded</span>
                          <span className="text-xs font-bold text-green-600">Ready for display</span>
                        </div>
                      </div>
                      <div className="relative">
                        <button type="button" disabled={isUploadingLogo} className="px-4 py-2 bg-black/5 hover:bg-black/10 text-black font-bold rounded-xl text-sm transition-colors flex items-center">
                          {isUploadingLogo ? <><Loader2 className="animate-spin mr-2" size={14} /> Replacing...</> : 'Replace'}
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSettingsLogoUpload}
                          disabled={isUploadingLogo}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={isUpdatingSettings} className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-black text-white hover:bg-gray-800 shadow-sm transition-all flex justify-center items-center">
                  {isUpdatingSettings ? <><Loader2 className="animate-spin mr-2" size={16} /> Saving...</> : 'Save Settings'}
                </button>
              </form>
            </div>
          </FadeIn>
        ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Plan Creation */}
          <StaggerItem className="md:col-span-7">
            <div className="bg-white border border-black/5 rounded-3xl shadow-sm hover:shadow-md transition-shadow p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-black">Create Subscription Plan</h2>
              </div>
              <form onSubmit={createPlan} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[13px] font-bold text-black/80 block mb-2">Plan Name</label>
                  <input required type="text" placeholder="e.g. Pro Tier" value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors" />
                </div>
                <div>
                  <label className="text-[13px] font-bold text-black/80 block mb-2">Amount (USDC)</label>
                  <input required type="number" step="0.01" placeholder="e.g. 15.00" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors" />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[13px] font-bold text-black/80 block mb-2">Billing Interval</label>
                  <select value={planInterval} onChange={(e) => setPlanInterval(e.target.value)} className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium focus:outline-none focus:border-black/30 focus:bg-white transition-colors appearance-none cursor-pointer">
                    <option value="2592000">Monthly (30 days)</option>
                    <option value="604800">Weekly (7 days)</option>
                    <option value="31536000">Yearly (365 days)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <button type="submit" disabled={isCreatingPlan} className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-black text-white hover:bg-gray-800 shadow-sm transition-all flex justify-center items-center">
                    {isCreatingPlan ? <><Loader2 className="animate-spin mr-2" size={16} /> Deploying...</> : 'Deploy Plan to Contract'}
                  </button>
                </div>
              </form>

              {/* Plans List */}
              {plans.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-[13px] font-bold text-black/80 mb-3">Your Plans</h4>
                  <div className="flex flex-col gap-3">
                    {plans.map(plan => {
                      const intervalLabel = plan.interval_seconds === 2592000 ? '/mo' : plan.interval_seconds === 604800 ? '/wk' : plan.interval_seconds === 31536000 ? '/yr' : `/${plan.interval_seconds}s`;
                      const amountDisplay = (Number(plan.amount) / 10000000).toFixed(2);
                      return (
                        <div key={plan.id} className="p-4 bg-white border border-black/10 rounded-2xl flex justify-between items-center shadow-sm">
                          <div>
                            <span className="font-bold text-base text-black">{plan.name}</span>
                            <span className="text-black/60 font-medium text-sm ml-2">
                              {amountDisplay} USDC{intervalLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold px-3 py-1 rounded-xl ${plan.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {plan.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-xs font-medium text-black/50">
                              {plan.subscriber_count || 0} subs
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </StaggerItem>

          {/* Webhook Management */}
          <StaggerItem className="md:col-span-5">
            <div className="bg-white border border-black/5 rounded-3xl shadow-sm hover:shadow-md transition-shadow p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-black">Webhook Configuration</h2>
                <p className="text-sm font-medium text-black/60 mt-1">
                  Receive real-time notifications when a user subscribes.
                </p>
              </div>
              <form onSubmit={createWebhook} className="flex flex-col gap-4">
                <div>
                  <input required type="url" placeholder="https://your-server.com/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm text-black font-medium placeholder-black/30 focus:outline-none focus:border-black/30 focus:bg-white transition-colors" />
                </div>
                <button type="submit" disabled={isCreatingWebhook} className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-black/5 text-black hover:bg-black/10 transition-colors flex justify-center items-center">
                  {isCreatingWebhook ? <><Loader2 className="animate-spin mr-2" size={16} /> Saving...</> : 'Add Webhook Endpoint'}
                </button>
              </form>

              {webhookSecret && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
                  <p className="text-[13px] font-bold text-yellow-800 mb-2">Secret Key (Save this now!)</p>
                  <code className="text-xs break-all font-mono text-yellow-900 bg-yellow-100/50 p-2 rounded-lg block">{webhookSecret}</code>
                </div>
              )}

              {webhooks.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-[13px] font-bold text-black/80 mb-3">Active Webhooks</h4>
                  <ul className="flex flex-col gap-2">
                    {webhooks.map(wh => (
                      <li key={wh.id} className="p-3 bg-white border border-black/10 rounded-xl text-sm flex justify-between shadow-sm">
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[80%] text-black font-medium">{wh.url}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${wh.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {wh.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </StaggerItem>
        </StaggerContainer>
        )}
      </section>
    </main>
    </PageWrapper>
  );
};

export default MerchantIntegration;
