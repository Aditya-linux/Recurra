import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api, API_BASE } from '../utils/api';
import toast from 'react-hot-toast';
import AnalyticsPage from './AnalyticsPage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const MerchantIntegration: React.FC = () => {
  const { walletAddress, fullWalletAddress, userRole, openModal, setUserRole } = useWallet();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

  // Registration state
  const [businessName, setBusinessName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

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

  // Plans state
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    if (userRole === 'merchant') {
      fetchWebhooks();
      fetchPlans();
    }
  }, [userRole]);

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
              message: `Sign in to Recurra with wallet ${fullWalletAddress}`,
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

  if (!walletAddress) {
    return (
      <main className="pt-nav" style={{ paddingBottom: '64px' }}>
        <section className="container" style={{ marginTop: '40px' }}>
          <Card className="flex flex-col items-center gap-4 text-center p-8 max-w-md mx-auto mt-20">
            <h2 className="text-h3">Connect Wallet to Continue</h2>
            <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
              You need to connect your wallet to access the Merchant Portal.
            </p>
            <Button onClick={openModal}>Connect Wallet</Button>
          </Card>
        </section>
      </main>
    );
  }

  if (userRole !== 'merchant') {
    return (
      <main className="pt-nav" style={{ paddingBottom: '64px' }}>
        <section className="container" style={{ marginTop: '40px' }}>
          <Card className="max-w-[600px] mx-auto mt-10">
            <CardHeader>
              <CardTitle className="text-h2">Register as a Merchant</CardTitle>
              <CardDescription className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                Upgrade your account to create subscription plans and integrate Recurra payments.
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
                    className="text-black"
                  />
                </div>
                <Button type="submit" disabled={isRegistering}>
                  {isRegistering ? <><Loader2 className="animate-spin mr-2" size={16} /> Registering...</> : 'Complete Registration'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="pt-nav" style={{ paddingBottom: '64px' }}>
      <section className="container" style={{ marginTop: '40px' }}>
        <h2 className="text-h2">Merchant Portal</h2>
        <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', marginTop: '8px', marginBottom: '32px', maxWidth: '600px' }}>
          Manage your subscription plans, webhooks, and performance analytics.
        </p>

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
        </div>

        {activeTab === 'analytics' ? (
          <AnalyticsPage isEmbedded={true} />
        ) : (
        <div className="grid-12">
          {/* Plan Creation */}
          <Card style={{ gridColumn: 'span 7' }}>
            <CardHeader>
              <CardTitle className="text-h3" style={{ fontSize: '24px' }}>Create Subscription Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createPlan} className="grid-12" style={{ gap: '24px' }}>
                <div style={{ gridColumn: 'span 6' }}>
                  <label className="text-label-caps" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '8px' }}>Plan Name</label>
                  <Input required type="text" placeholder="e.g. Pro Tier" value={planName} onChange={(e) => setPlanName(e.target.value)} className="text-black" />
                </div>
                <div style={{ gridColumn: 'span 6' }}>
                  <label className="text-label-caps" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '8px' }}>Amount (USDC)</label>
                  <Input required type="number" step="0.01" placeholder="e.g. 15.00" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} className="text-black" />
                </div>

                <div style={{ gridColumn: 'span 12' }}>
                  <label className="text-label-caps" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '8px' }}>Billing Interval</label>
                  <Select value={planInterval} onValueChange={(val) => setPlanInterval(val)}>
                    <SelectTrigger className="w-full bg-white text-black border border-[var(--outline-variant)] focus:ring-[var(--primary)] outline-none rounded-[10px] h-[48px]">
                      <SelectValue placeholder="Select billing interval" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-black border border-[var(--outline-variant)] rounded-[10px] shadow-lg">
                      <SelectItem value="2592000" className="cursor-pointer focus:bg-gray-100 focus:text-black text-black">Monthly (30 days)</SelectItem>
                      <SelectItem value="604800" className="cursor-pointer focus:bg-gray-100 focus:text-black text-black">Weekly (7 days)</SelectItem>
                      <SelectItem value="31536000" className="cursor-pointer focus:bg-gray-100 focus:text-black text-black">Yearly (365 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ gridColumn: 'span 12' }}>
                  <Button type="submit" disabled={isCreatingPlan} className="w-full">
                    {isCreatingPlan ? <><Loader2 className="animate-spin mr-2" size={16} /> Deploying...</> : 'Deploy Plan to Contract'}
                  </Button>
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
                          <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
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

          {/* Webhook Management */}
          <Card style={{ gridColumn: 'span 5' }}>
            <CardHeader>
              <CardTitle className="text-h3" style={{ fontSize: '24px' }}>Webhook Configuration</CardTitle>
              <CardDescription className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                Receive real-time notifications when a user subscribes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createWebhook} className="flex flex-col gap-4">
                <div>
                  <Input required type="url" placeholder="https://your-server.com/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="text-black" />
                </div>
                <Button type="submit" variant="secondary" disabled={isCreatingWebhook} className="w-full">
                  {isCreatingWebhook ? <><Loader2 className="animate-spin mr-2" size={16} /> Saving...</> : 'Add Webhook Endpoint'}
                </Button>
              </form>

            {webhookSecret && (
              <div style={{ padding: '16px', backgroundColor: 'rgba(255, 204, 0, 0.1)', border: '1px solid var(--accent)', borderRadius: '8px' }}>
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
        </div>
        )}
      </section>
    </main>
  );
};

export default MerchantIntegration;
