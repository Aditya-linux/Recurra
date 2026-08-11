import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, AlertTriangle, Activity, CreditCard, Lock, Unlock, Clock } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import toast from 'react-hot-toast';
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem } from '../components/ui/animations';

const mockWalletState = {
  isDeployed: true,
  isFrozen: false,
  dailyLimit: '100 USDC',
  monthlyLimit: '1000 USDC',
  dailySpent: '24 USDC',
  monthlySpent: '120 USDC',
  autoApproveThreshold: '10 USDC',
  sessionKeys: [
    { id: '1', key: 'G...A1B2', expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(), limit: '50 USDC' },
    { id: '2', key: 'G...X9Y0', expiresAt: new Date(Date.now() - 86400000).toISOString(), limit: '10 USDC' }
  ]
};

const SmartWallet: React.FC = () => {
  const { walletAddress } = useWallet();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'limits' | 'security'>('overview');
  const walletState = mockWalletState;

  const handleDeploy = async () => {
    setLoading(true);
    setTimeout(() => { toast.success('Smart Wallet deployed successfully!'); setLoading(false); }, 2000);
  };

  const toggleFreeze = () => {
    const action = walletState.isFrozen ? 'unfrozen' : 'frozen';
    toast.success(`Wallet successfully ${action}`);
  };

  if (!walletAddress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
        <div className="text-center text-black">
          <Shield className="mx-auto mb-4 h-16 w-16 text-black/20" />
          <h2 className="text-2xl font-bold">Connect your wallet</h2>
          <p className="mt-2 text-black/50">Please connect your Stellar wallet to manage your Smart Wallet.</p>
        </div>
      </div>
    );
  }

  if (!walletState.isDeployed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md bg-white border border-black/5 shadow-sm rounded-3xl p-8 text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
            <Shield className="h-10 w-10 text-blue-600" />
          </div>
          <h2 className="mb-4 text-2xl font-bold text-black">Upgrade to Smart Wallet</h2>
          <p className="mb-8 text-black/50">
            Deploy an Account Abstraction contract to enable session keys, spending limits, and seamless auto-payments without popups.
          </p>
          <button
            onClick={handleDeploy}
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-black py-3 font-semibold text-white transition hover:bg-black/80 disabled:opacity-50"
          >
            {loading ? <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div> : 'Deploy Smart Wallet'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <PageWrapper>
      <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
        <section className="container mx-auto px-6 mt-10 max-w-6xl">
          <FadeIn delay={0.1}>
            <div className="mb-8 flex flex-col justify-between space-y-4 sm:flex-row sm:items-end sm:space-y-0">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-black" style={{ letterSpacing: '-0.03em' }}>
                  Smart Wallet
                </h2>
                <p className="text-lg text-black/60 mt-2">
                  Manage your Account Abstraction features and security settings.
                </p>
              </div>
              <button
                onClick={toggleFreeze}
                className={`flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold transition self-start sm:self-auto ${
                  walletState.isFrozen
                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'
                    : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                }`}
              >
                {walletState.isFrozen ? <><Unlock className="mr-2 h-4 w-4" /> Unfreeze Wallet</> : <><Lock className="mr-2 h-4 w-4" /> Emergency Freeze</>}
              </button>
            </div>
          </FadeIn>

          {walletState.isFrozen && (
            <div className="mb-8 rounded-2xl bg-red-50 border border-red-100 p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-red-600">Wallet is currently frozen</h3>
                  <p className="mt-1 text-sm text-red-500/70">All outgoing transactions and session keys are temporarily suspended.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <FadeIn delay={0.2}>
            <div className="mb-8 flex space-x-1 overflow-x-auto rounded-2xl bg-white border border-black/5 shadow-sm p-1">
              {['overview', 'sessions', 'limits', 'security'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-5 py-2.5 text-sm font-semibold capitalize rounded-xl transition-colors ${
                    activeTab === tab ? 'bg-black text-white shadow-sm' : 'text-black/40 hover:text-black'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </FadeIn>

          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {activeTab === 'overview' && (
              <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <StaggerItem>
                  <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center text-black/50 text-sm font-bold uppercase tracking-wider">
                      <Activity className="mr-2 h-5 w-5 text-blue-500" /> Daily Spending
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-black">{walletState.dailySpent}</div>
                        <div className="text-sm text-black/30">of {walletState.dailyLimit}</div>
                      </div>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-black/5">
                        <div className="h-full w-1/4 bg-blue-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </StaggerItem>

                <StaggerItem>
                  <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center text-black/50 text-sm font-bold uppercase tracking-wider">
                      <CreditCard className="mr-2 h-5 w-5 text-emerald-500" /> Monthly Limit
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-black">{walletState.monthlySpent}</div>
                        <div className="text-sm text-black/30">of {walletState.monthlyLimit}</div>
                      </div>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-black/5">
                        <div className="h-full w-[12%] bg-emerald-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </StaggerItem>

                <StaggerItem>
                  <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center text-black/50 text-sm font-bold uppercase tracking-wider">
                      <Key className="mr-2 h-5 w-5 text-purple-500" /> Active Session Keys
                    </div>
                    <div className="mt-4 text-2xl font-bold text-black">
                      {walletState.sessionKeys.filter(k => new Date(k.expiresAt) > new Date()).length}
                    </div>
                    <div className="mt-1 text-sm text-black/30">Providing seamless UX for dApps</div>
                  </div>
                </StaggerItem>
              </StaggerContainer>
            )}

            {activeTab === 'sessions' && (
              <FadeIn>
                <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-6 hover:shadow-md transition-shadow">
                  <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-black">Session Keys</h3>
                      <p className="text-sm text-black/40">Manage delegated keys that can sign on your behalf</p>
                    </div>
                    <button className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/80 transition">
                      Create New Key
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-black/60">
                      <thead className="border-b border-black/5 text-xs font-bold uppercase text-black/30 tracking-wider">
                        <tr>
                          <th className="px-4 py-3 text-left">Key ID</th>
                          <th className="px-4 py-3 text-left">Spending Limit</th>
                          <th className="px-4 py-3 text-left">Expires At</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletState.sessionKeys.map((key) => {
                          const isExpired = new Date(key.expiresAt) < new Date();
                          return (
                            <tr key={key.id} className="border-b border-black/5 hover:bg-[#F5F5F5]/50">
                              <td className="px-4 py-4 font-mono font-semibold text-black">{key.key}</td>
                              <td className="px-4 py-4">{key.limit}</td>
                              <td className="px-4 py-4">
                                <div className="flex items-center">
                                  <Clock className="mr-2 h-4 w-4 text-black/20" />
                                  {new Date(key.expiresAt).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                                  isExpired ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {isExpired ? 'Expired' : 'Active'}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <button className="text-red-500 hover:text-red-600 font-semibold text-sm">Revoke</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </FadeIn>
            )}

            {activeTab === 'limits' && (
              <FadeIn>
                <div className="max-w-2xl bg-white border border-black/5 shadow-sm rounded-3xl p-8 hover:shadow-md transition-shadow">
                  <h3 className="mb-6 text-xl font-bold text-black">Global Spending Limits</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-black/60">Auto-Approve Threshold</label>
                      <p className="mb-3 text-xs text-black/30">Transactions below this amount require no signature</p>
                      <div className="flex rounded-xl shadow-sm">
                        <input type="text" defaultValue="10"
                          className="block w-full rounded-l-xl border border-black/10 bg-[#F5F5F5] py-2.5 pl-4 text-black ring-0 focus:ring-2 focus:ring-black/20 focus:border-transparent outline-none sm:text-sm" />
                        <span className="inline-flex items-center rounded-r-xl border border-l-0 border-black/10 bg-[#F5F5F5] px-4 text-black/40 sm:text-sm font-medium">USDC</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-black/60">Daily Limit</label>
                      <div className="flex rounded-xl shadow-sm">
                        <input type="text" defaultValue="100"
                          className="block w-full rounded-l-xl border border-black/10 bg-[#F5F5F5] py-2.5 pl-4 text-black ring-0 focus:ring-2 focus:ring-black/20 focus:border-transparent outline-none sm:text-sm" />
                        <span className="inline-flex items-center rounded-r-xl border border-l-0 border-black/10 bg-[#F5F5F5] px-4 text-black/40 sm:text-sm font-medium">USDC</span>
                      </div>
                    </div>
                    <button className="mt-4 rounded-xl bg-black px-6 py-2.5 font-semibold text-white transition hover:bg-black/80">
                      Update Limits
                    </button>
                  </div>
                </div>
              </FadeIn>
            )}

            {activeTab === 'security' && (
              <FadeIn>
                <div className="max-w-2xl bg-white border border-black/5 shadow-sm rounded-3xl p-8 hover:shadow-md transition-shadow">
                  <h3 className="mb-6 text-xl font-bold text-black">Security Settings</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-2xl border border-black/5 bg-[#F5F5F5] p-5 gap-4">
                      <div>
                        <h4 className="font-bold text-black">Multi-signature Support</h4>
                        <p className="mt-1 text-sm text-black/40">Require multiple devices to approve large transactions</p>
                      </div>
                      <button className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-black/5 transition">
                        Configure
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-2xl border border-black/5 bg-[#F5F5F5] p-5 gap-4">
                      <div>
                        <h4 className="font-bold text-black">Social Recovery</h4>
                        <p className="mt-1 text-sm text-black/40">Recover your wallet using trusted guardians</p>
                      </div>
                      <button className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/80 transition">
                        Setup
                      </button>
                    </div>
                  </div>
                </div>
              </FadeIn>
            )}
          </motion.div>
        </section>
      </main>
    </PageWrapper>
  );
};

export default SmartWallet;
