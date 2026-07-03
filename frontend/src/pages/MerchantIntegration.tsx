import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api, API_BASE } from '../utils/api';
import toast from 'react-hot-toast';
import AnalyticsPage from './AnalyticsPage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Plus, Loader2, Copy, CheckCircle2, Upload } from "lucide-react";
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem, HoverCard } from '../components/ui/animations';
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

  useEffect(() => {
    if (userRole === 'merchant') {
      fetchWebhooks();
      fetchPlans();
      fetchSettings();
    }
  }, [userRole]);

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
        <main className="pt-nav" style={{ paddingBottom: '64px' }}>
          <section className="container" style={{ marginTop: '40px' }}>
            <FadeIn>
              <Card className="flex flex-col items-center gap-4 text-center p-8 max-w-md mx-auto mt-20">
                <h2 className="text-h3">Connect Wallet to Continue</h2>
                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                  You need to connect your wallet to access the Merchant Portal.
                </p>
                <Button onClick={openModal}>Connect Wallet</Button>
              </Card>
            </FadeIn>
          </section>
        </main>
      </PageWrapper>
    );
  }

  if (userRole !== 'merchant') {
    return (
      <PageWrapper>
        <main className="pt-nav" style={{ paddingBottom: '64px' }}>
          <section className="container" style={{ marginTop: '40px' }}>
            <FadeIn>
              <Card className="max-w-[600px] mx-auto mt-10">
                <CardHeader>
                  <CardTitle className="text-h2">Register as a Merchant</CardTitle>
                  <CardDescription className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                    Upgrade your account to create subscription plans and integrate Rekura payments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={registerMerchant} className="flex flex-col gap-6">
                    <div>
                      <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px' }}>Business Name</label>
                      <Input 
                        type="text" 
                        placeholder="e.g. Acme Streaming" 
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        required
                        className="text-[var(--on-surface)]"
                      />
                    </div>
                    <div>
                      <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px' }}>Business Email</label>
                      <Input 
                        type="email" 
                        placeholder="e.g. billing@acme.com" 
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                        required
                        className="text-[var(--on-surface)]"
                      />
                    </div>
                    <div>
                      <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px' }}>Business Logo</label>
                      {!logoUrl ? (
                        <div className="relative border-2 border-dashed rounded-lg p-8 transition-colors flex flex-col items-center justify-center cursor-pointer" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploadingLogo}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          {isUploadingLogo ? (
                            <div className="flex flex-col items-center text-primary">
                              <Loader2 className="animate-spin mb-2" size={28} />
                              <span className="text-sm font-medium">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center" style={{ color: 'var(--on-surface-variant)' }}>
                              <div className="p-3 rounded-full mb-3" style={{ background: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>
                                <Upload size={24} />
                              </div>
                              <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>Click to upload from device</span>
                              <span className="text-xs mt-1" style={{ color: 'var(--on-surface-variant)' }}>SVG, PNG, JPG (max 5MB)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative border rounded-lg p-4 flex items-center justify-between shadow-sm" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                          <div className="flex items-center gap-4">
                            <div className="p-2 border rounded-lg flex items-center justify-center" style={{ width: '60px', height: '60px', background: 'var(--surface-container)', borderColor: 'var(--glass-border)' }}>
                              <img src={logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>Logo uploaded</span>
                              <span className="text-xs font-medium" style={{ color: 'var(--accent-cyan)' }}>Ready for display</span>
                            </div>
                          </div>
                          <div className="relative">
                            <Button type="button" variant="outline" size="sm" disabled={isUploadingLogo} className="text-[var(--on-surface)]">
                              {isUploadingLogo ? <><Loader2 className="animate-spin mr-2" size={14} /> Replacing...</> : 'Replace'}
                            </Button>
                            <Input
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
                    <HoverCard>
                      <Button type="submit" disabled={isRegistering} className="w-full">
                        {isRegistering ? <><Loader2 className="animate-spin mr-2" size={16} /> Registering...</> : 'Complete Registration'}
                      </Button>
                    </HoverCard>
                  </form>
                </CardContent>
              </Card>
            </FadeIn>
          </section>
        </main>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <main className="pt-nav" style={{ paddingBottom: '64px' }}>
        <section className="container" style={{ marginTop: '40px' }}>
          <FadeIn delay={0.1}>
            <h2 className="text-h2">Merchant Portal</h2>
            <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', marginTop: '8px', marginBottom: '32px', maxWidth: '600px' }}>
              Manage your subscription plans, webhooks, and performance analytics.
            </p>
          </FadeIn>

          {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', borderBottom: '1px solid var(--outline-variant)' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: '15px',
              borderBottom: activeTab === 'overview' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'overview' ? 'var(--on-surface)' : 'var(--on-surface-variant)',
              backgroundColor: 'transparent',
              transition: 'all 0.2s',
            }}
          >
            Plans & Integration
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: '15px',
              borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'analytics' ? 'var(--on-surface)' : 'var(--on-surface-variant)',
              backgroundColor: 'transparent',
              transition: 'all 0.2s',
            }}
          >
            Performance Analytics
          </button>
          <button
            onClick={() => setActiveTab('discounts')}
            style={{
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: '15px',
              borderBottom: activeTab === 'discounts' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'discounts' ? 'var(--on-surface)' : 'var(--on-surface-variant)',
              backgroundColor: 'transparent',
              transition: 'all 0.2s',
            }}
          >
            Discounts
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: '15px',
              borderBottom: activeTab === 'settings' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'settings' ? 'var(--on-surface)' : 'var(--on-surface-variant)',
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
            <Card className="max-w-[600px] mx-auto">
              <CardHeader>
                <CardTitle className="text-h3" style={{ fontSize: '24px' }}>Merchant Settings</CardTitle>
                <CardDescription className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                  Update your business name and display logo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={updateSettings} className="flex flex-col gap-6">
                  <div>
                    <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px' }}>Business Name</label>
                    <Input 
                      type="text" 
                      placeholder="e.g. Acme Streaming" 
                      value={settingsBusinessName}
                      onChange={(e) => setSettingsBusinessName(e.target.value)}
                      required
                      className="text-[var(--on-surface)]"
                    />
                  </div>
                  <div>
                    <label className="text-label-caps" style={{ display: 'block', marginBottom: '8px' }}>Business Logo</label>
                    {!settingsLogoUrl ? (
                      <div className="relative border-2 border-dashed rounded-lg p-8 transition-colors flex flex-col items-center justify-center cursor-pointer" style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleSettingsLogoUpload}
                          disabled={isUploadingLogo}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {isUploadingLogo ? (
                          <div className="flex flex-col items-center text-primary">
                            <Loader2 className="animate-spin mb-2" size={28} />
                            <span className="text-sm font-medium">Uploading...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center" style={{ color: 'var(--on-surface-variant)' }}>
                            <div className="p-3 rounded-full mb-3" style={{ background: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>
                              <Upload size={24} />
                            </div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>Click to upload from device</span>
                            <span className="text-xs mt-1" style={{ color: 'var(--on-surface-variant)' }}>SVG, PNG, JPG (max 5MB)</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative border rounded-lg p-4 flex items-center justify-between shadow-sm" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                        <div className="flex items-center gap-4">
                          <div className="p-2 border rounded-lg flex items-center justify-center" style={{ width: '60px', height: '60px', background: 'var(--surface-container)', borderColor: 'var(--glass-border)' }}>
                            <img src={settingsLogoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>Logo uploaded</span>
                            <span className="text-xs font-medium" style={{ color: 'var(--accent-cyan)' }}>Ready for display</span>
                          </div>
                        </div>
                        <div className="relative">
                          <Button type="button" variant="outline" size="sm" disabled={isUploadingLogo} className="text-[var(--on-surface)]">
                            {isUploadingLogo ? <><Loader2 className="animate-spin mr-2" size={14} /> Replacing...</> : 'Replace'}
                          </Button>
                          <Input
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
                  <HoverCard>
                    <Button type="submit" disabled={isUpdatingSettings} className="w-full">
                      {isUpdatingSettings ? <><Loader2 className="animate-spin mr-2" size={16} /> Saving...</> : 'Save Settings'}
                    </Button>
                  </HoverCard>
                </form>
              </CardContent>
            </Card>
          </FadeIn>
        ) : (
        <StaggerContainer className="grid-12">
          {/* Plan Creation */}
          <StaggerItem style={{ gridColumn: 'span 7' }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-h3" style={{ fontSize: '24px' }}>Create Subscription Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createPlan} className="grid-12" style={{ gap: '24px' }}>
                  <div style={{ gridColumn: 'span 6' }}>
                    <label className="text-label-caps" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '8px' }}>Plan Name</label>
                    <Input required type="text" placeholder="e.g. Pro Tier" value={planName} onChange={(e) => setPlanName(e.target.value)} className="text-[var(--on-surface)]" />
                  </div>
                  <div style={{ gridColumn: 'span 6' }}>
                    <label className="text-label-caps" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '8px' }}>Amount (USDC)</label>
                    <Input required type="number" step="0.01" placeholder="e.g. 15.00" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} className="text-[var(--on-surface)]" />
                  </div>

                  <div style={{ gridColumn: 'span 12' }}>
                    <label className="text-label-caps" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '8px' }}>Billing Interval</label>
                    <Select value={planInterval} onValueChange={(val) => setPlanInterval(val)}>
                      <SelectTrigger className="w-full border border-[var(--glass-border)] focus:ring-[var(--accent-cyan)] outline-none rounded-[10px] h-[48px]">
                        <SelectValue placeholder="Select billing interval" />
                      </SelectTrigger>
                      <SelectContent className="border border-[var(--glass-border)] rounded-[10px] shadow-lg bg-[var(--surface)] z-50">
                        <SelectItem value="2592000" className="cursor-pointer">Monthly (30 days)</SelectItem>
                        <SelectItem value="604800" className="cursor-pointer">Weekly (7 days)</SelectItem>
                        <SelectItem value="31536000" className="cursor-pointer">Yearly (365 days)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ gridColumn: 'span 12' }}>
                    <HoverCard>
                      <Button type="submit" disabled={isCreatingPlan} className="w-full">
                        {isCreatingPlan ? <><Loader2 className="animate-spin mr-2" size={16} /> Deploying...</> : 'Deploy Plan to Contract'}
                      </Button>
                    </HoverCard>
                  </div>
                </form>

              {/* Plans List */}
              {plans.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <h4 className="text-label-caps" style={{ marginBottom: '12px', color: 'var(--on-surface-variant)' }}>Your Plans</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {plans.map(plan => {
                      const intervalLabel = plan.interval_seconds === 2592000 ? '/mo' : plan.interval_seconds === 604800 ? '/wk' : plan.interval_seconds === 31536000 ? '/yr' : `/${plan.interval_seconds}s`;
                      const amountDisplay = (Number(plan.amount) / 10000000).toFixed(2);
                      return (
                        <div key={plan.id} style={{
                          padding: '14px 18px',
                          backgroundColor: 'var(--surface)',
                          borderRadius: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid var(--outline-variant)',
                        }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '15px' }}>{plan.name}</span>
                            <span style={{ color: 'var(--on-surface-variant)', fontSize: '13px', marginLeft: '8px' }}>
                              {amountDisplay} USDC{intervalLabel}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              fontSize: '12px',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              backgroundColor: plan.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: plan.is_active ? 'var(--emerald-500, #10b981)' : '#ef4444',
                            }}>
                              {plan.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginRight: '8px' }}>
                              {plan.subscriber_count || 0} subs
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </CardContent>
            </Card>
          </StaggerItem>

          {/* Webhook Management */}
          <StaggerItem style={{ gridColumn: 'span 5' }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-h3" style={{ fontSize: '24px' }}>Webhook Configuration</CardTitle>
                <CardDescription className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                  Receive real-time notifications when a user subscribes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createWebhook} className="flex flex-col gap-4">
                  <div>
                    <Input required type="url" placeholder="https://your-server.com/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="text-[var(--on-surface)]" />
                  </div>
                  <HoverCard>
                    <Button type="submit" variant="secondary" disabled={isCreatingWebhook} className="w-full">
                      {isCreatingWebhook ? <><Loader2 className="animate-spin mr-2" size={16} /> Saving...</> : 'Add Webhook Endpoint'}
                    </Button>
                  </HoverCard>
                </form>

              {webhookSecret && (
                <div style={{ padding: '16px', backgroundColor: 'rgba(255, 204, 0, 0.1)', border: '1px solid var(--accent)', borderRadius: '8px', marginTop: '16px' }}>
                  <p className="text-label-caps" style={{ color: 'var(--accent)', marginBottom: '8px' }}>Secret Key (Save this now!)</p>
                  <code style={{ wordBreak: 'break-all', fontSize: '12px' }}>{webhookSecret}</code>
                </div>
              )}

              {webhooks.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4 className="text-label-caps" style={{ marginBottom: '8px' }}>Active Webhooks</h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {webhooks.map(wh => (
                      <li key={wh.id} style={{ padding: '12px', backgroundColor: 'var(--surface)', borderRadius: '8px', fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{wh.url}</span>
                        <span style={{ color: wh.is_active ? 'var(--emerald-500)' : 'var(--on-surface-variant)' }}>
                          {wh.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>
        )}
      </section>
    </main>
    </PageWrapper>
  );
};

export default MerchantIntegration;
